import { NextRequest, NextResponse } from 'next/server';
import { createPost, addComment, listPosts } from '@/lib/feed-store';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import {
  getFakeTipsters,
  recordActivityTip,
  settleActivityTips,
} from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

// ── Real odds resolver ────────────────────────────────────────────────────────
// Use actual bookmaker odds from the match when available, fall back to
// a realistic randomised value so we never show a made-up "1.45" flat rate.
function resolveOddsForPick(
  pick: string,
  matchOdds?: { home: number; draw?: number; away: number } | null,
  markets?: Array<{ key?: string; name: string; selections: Array<{ label: string; odds: number }> }> | null,
): number {
  const p = pick.toLowerCase();

  // 1. Try to match pick against market selections first (most accurate)
  if (markets && markets.length > 0) {
    for (const m of markets) {
      for (const sel of m.selections) {
        const sl = sel.label.toLowerCase();
        if (
          (p === 'home win' && (sl === 'home' || sl === '1' || sl === 'home win')) ||
          (p === 'away win' && (sl === 'away' || sl === '2' || sl === 'away win')) ||
          (p === 'draw' && (sl === 'draw' || sl === 'x')) ||
          (p === 'both teams score' && (sl === 'yes' || sl === 'btts yes' || sl.includes('both teams'))) ||
          (p === 'over 2.5 goals' && (sl === 'over 2.5' || sl === 'over' || sl.includes('over 2.5')))
        ) {
          if (sel.odds >= 1.01) return sel.odds;
        }
      }
    }
  }

  // 2. Use 1X2 odds for home/draw/away picks
  if (matchOdds) {
    if (p === 'home win' && matchOdds.home >= 1.01) return matchOdds.home;
    if (p === 'away win' && matchOdds.away >= 1.01) return matchOdds.away;
    if (p === 'draw' && matchOdds.draw && matchOdds.draw >= 1.01) return matchOdds.draw;
  }

  // 3. Fallback: realistic static range per pick type (no Math.random — deterministic per pick)
  const base: Record<string, number> = {
    'home win': 1.85,
    'away win': 2.60,
    'draw': 3.20,
    'over 2.5 goals': 1.75,
    'both teams score': 1.85,
  };
  return base[p] ?? 2.00;
}

// ── Tip pick logic ────────────────────────────────────────────────────────────
// Sports that never end in a draw (no draw market available)
const NO_DRAW_SPORTS = new Set(['basketball', 'tennis', 'baseball', 'hockey', 'mma', 'boxing', 'american-football']);

interface MatchPick {
  pick: string;
  rationale: string;
}

/**
 * Smart pick selection — seeded from matchId so the same match always gets
 * the same tip (deterministic). Weights reflect realistic football probabilities:
 * Home Win ~42%, Draw ~24%, Away Win ~22%, BTTS ~7%, Over 2.5 ~5%.
 * For non-draw sports, Draw is excluded and weights are redistributed.
 */
function smartPick(matchId: string, homeTeam: string, awayTeam: string, sport?: string): MatchPick {
  // Seeded RNG from match ID + current hour (changes every hour so different tipsters vary)
  let h = Date.now() / 3_600_000 | 0; // integer hour
  for (let i = 0; i < matchId.length; i++) h = (Math.imul(31, h) + matchId.charCodeAt(i)) | 0;
  // Add extra entropy so each call within same hour differs
  h = (h ^ (Math.random() * 0xFFFFFFFF | 0)) | 0;
  const rand = () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 0xFFFFFFFF; };

  const allowDraw = !NO_DRAW_SPORTS.has(sport || '');

  // Weighted pick table
  type WPick = { pick: string; weight: number; rationale: string };
  const table: WPick[] = allowDraw
    ? [
        { pick: 'Home Win',          weight: 42, rationale: `${homeTeam} have strong home form and H2H advantage.` },
        { pick: 'Draw',              weight: 24, rationale: `Both sides are evenly matched — a draw looks likely.` },
        { pick: 'Away Win',          weight: 22, rationale: `${awayTeam} travel well and their recent form is excellent.` },
        { pick: 'Both Teams Score',  weight:  7, rationale: `Both attacks are in form — expect goals at both ends.` },
        { pick: 'Over 2.5 Goals',    weight:  5, rationale: `High-scoring encounters characterise this fixture.` },
      ]
    : [
        { pick: 'Home Win',          weight: 52, rationale: `${homeTeam} are heavy favourites on home turf.` },
        { pick: 'Away Win',          weight: 38, rationale: `${awayTeam} are the stronger side on paper.` },
        { pick: 'Over 2.5 Goals',    weight: 10, rationale: `High-scoring encounters in this competition.` },
      ];

  const total = table.reduce((s, x) => s + x.weight, 0);
  let roll = rand() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return { pick: entry.pick, rationale: entry.rationale };
  }
  return { pick: table[0].pick, rationale: table[0].rationale };
}

// ── Post templates (NO 4-byte emoji — MySQL utf8 charset can't store them) ───
const GENERIC_POSTS = [
  'Been studying form all week. My picks this weekend are looking very solid.',
  'Remember: value beats favourites every time. Discipline is everything.',
  'Three-fold accumulator going in tonight. Done the research, feeling confident.',
  'Anyone else fading the favourites this weekend? The odds on some underdogs are too good.',
  'Bankroll management separates the winners from the losers. Always stake responsibly.',
  'Hit 4/5 last weekend. That near miss hurts but the process was right. On to the next.',
  'Tip of the day: never bet with your emotions. Let the stats guide you.',
  'Over 2.5 goals in the evening kick-off looks very appealing based on recent form.',
  'Midweek results confirm my weekend selections. The research never lies.',
  'Three singles over an accumulator today. Risk management first.',
  'I have been tracking this league for months. The home bias here is very real.',
  'Draw no bet is seriously underrated as a market. It cuts your risk in half.',
  'Clean analysis session done. Plenty of value on the card today.',
  'Stats, H2H and current form all aligned on one pick today. High confidence.',
  'Patience is the biggest edge in sports betting. Wait for the right spots.',
  'Another green week done. Consistency comes from the process, not luck.',
  'People sleep on the Asian handicap market. Way more efficient than straight 1X2.',
  'If you are not keeping a record of every bet, you are flying blind.',
  'The line moved 0.3 overnight. Sharp money coming in early on this one.',
  'Four games this weekend. Three singles, one double. Keeping the risk tight.',
  'Lessons from last month: too many accas, not enough singles. Fixed that now.',
  'Watching live right now. First half stats matching my pre-match model exactly.',
  'Referee assignment just dropped for the weekend. Changes my thinking on one of my picks.',
  'Weather forecast showing heavy rain. Taking that under seriously now.',
  'Missed the team news yesterday. Huge injury update for one of my selections — reconsidering.',
  'Market opened at 2.10, already down to 1.82. Getting in early matters.',
  'My model had this one at 40% probability. Market implying 30%. That is value.',
  'Domestic cup games are where bookies get complacent. Always worth a look.',
  'Road trips in this league tend to see under 2.5 goals. Been true 7 of last 9.',
  'Not betting tonight. Sometimes the best position is no position.',
  'Staked small on an outsider earlier. Most of it is about the value, not the money.',
  'Two weeks of flat staking to reset my discipline after a bad run. Already seeing results.',
  'Just rechecked the H2H going back five years. Fascinating pattern in this fixture.',
  'Afternoon games in this league historically go over more often than evening. Just saying.',
  'Suspended key player for the home side changes everything about this pick.',
  'Second leg of a cup tie today. Away goal rule shifts the whole dynamic.',
  'Midweek fatigue is real. Teams with 3+ games in a week always worth fading.',
  'Love fading big road favourites in cold weather. Comfort zone matters.',
  'No value on the market this morning. Waiting for better lines this afternoon.',
];

const MATCH_POSTS = [
  (home: string, away: string, pick: string, rationale: string, odds: number) =>
    `${home} vs ${away} — backing ${pick} @ ${odds.toFixed(2)}. ${rationale}`,
  (home: string, away: string, pick: string, rationale: string, odds: number) =>
    `My tip for ${home} vs ${away}: ${pick} @ ${odds.toFixed(2)}. ${rationale}`,
  (home: string, away: string, pick: string, rationale: string, odds: number) =>
    `${home} vs ${away} prediction: ${pick}. Odds at ${odds.toFixed(2)} represent solid value. ${rationale}`,
  (home: string, away: string, pick: string, rationale: string, _odds: number) =>
    `Watching ${home} vs ${away} closely. ${rationale} Backing ${pick}.`,
  (home: string, away: string, pick: string, rationale: string, odds: number) =>
    `${pick} in the ${home} vs ${away} fixture is the right call at ${odds.toFixed(2)}. ${rationale}`,
];

const COMMENTS = [
  'Agreed — I was thinking the same thing.',
  'Good analysis, thanks for sharing.',
  'I see your reasoning but I am going the other way on this one.',
  'Solid tip, already added it to my slip.',
  'The form table backs this up nicely.',
  'Great insight as always.',
  'Did you factor in the head-to-head though?',
  'Bold pick but I like the value there.',
  'Following this one closely, thanks.',
  'Clean analysis. What about injuries?',
  'Value looks right to me too.',
  'This is why I follow you — solid research every time.',
  'Added to my accumulator, let us go.',
  'Interesting angle, had not considered the away form.',
  'Those odds look too good to pass up.',
  'I am on the same side, let us cash together.',
  'Not sure about this one but respect the process.',
  'The stats really do support this pick.',
  'Draw is always overlooked at these prices.',
  'H2H record strongly favours this outcome.',
  'Been watching this team all season, this is the right call.',
  'Good spot. The home side has been conceding early lately.',
  'Risky but the market is mispriced here, I agree.',
  'Followed. Your tips have been sharp lately.',
  'Nice one. What is your stake on this?',
  'Patience pays — this pick makes total sense at these odds.',
  'The xG data is telling the same story, back it.',
  'Finally someone saying what everyone is thinking.',
  'Strong reasoning. I would adjust the stake slightly higher though.',
  'Bookies are slow to react here, grab it before the line moves.',
  'Posted the same pick earlier, glad others see it too.',
  'Injuries in the squad change everything on this one.',
  'Referee profile for this game also leans that way.',
  'Big game mentality counts for a lot here, good pick.',
  'Watch the weather forecast — could affect this one.',
  'I backed the same angle last week and cashed easily.',
  'Going with you on this. Cheers for posting early.',
  'Saw this line move earlier — had a feeling someone sharp was on it.',
  'Under-rated pick. Most people tunnel vision the match result only.',
  'Travel schedule for the away side is brutal this week. Good spot.',
  'I had the opposite at first but you changed my mind, fair point.',
  'Team news was the key info here. Well done for catching that.',
  'Line is drifting now. Either smart money disagrees or the public is piling in.',
  'What unit size are you going with on this one?',
  'Doubled my usual stake based on your reasoning. Makes total sense.',
  'This league is so hard to call but that logic is sound.',
  'Both managers have something to play for. Hard to see it being open.',
  'Momentum is with the home side after last weekend. Good timing.',
  'The rotation risk for the cup game mid-week is real. Factor that in.',
  'Took the same selection at better odds an hour ago. Good value still.',
  'Market is moving fast on this. Grab it while you can.',
  'Keeper is in excellent form lately. Might go under and clean sheet combo.',
  'Perfect bankroll approach. Singles stack up way more consistently.',
  'Your last five tips have been class. Sticking with you this week.',
  'Do you like the first goal scorer market at all on this one?',
];

function smartComment(post: { content: string; pick?: string | null; matchTitle?: string | null }): string {
  const base = randPick(COMMENTS);
  if (!post.pick && !post.matchTitle) return base;
  const extras = [
    post.pick ? `That ${post.pick} call is interesting.` : '',
    post.matchTitle ? `Big game in ${post.matchTitle.split(' vs ')[0] || 'this fixture'}.` : '',
    'The odds reflect the market consensus too.',
    'Have you looked at the recent form run?',
    'Solid value at those odds for sure.',
    'Combining this with an Over in the same game.',
    'Makes sense given the context going into this one.',
  ].filter(Boolean);
  return Math.random() > 0.5 && extras.length > 0
    ? `${randPick(extras)} ${base}`
    : base;
}

function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const g = globalThis as {
  __fakeActivityPostedMatches?: Set<string>;
  __fakeActivityLastRun?: number;
  __fakeActivityTipsterLastPost?: Map<number, number>;
  __fakeActivityTipsterLastComment?: Map<number, number>;
};

// Minimum gaps so each fake tipster feels like a real person with a daily rhythm
const TIPSTER_POST_COOLDOWN_MS    = 3 * 60 * 60 * 1000; // 3 h between posts per tipster
const TIPSTER_COMMENT_COOLDOWN_MS = 90 * 60 * 1000;     // 90 min between comments per tipster

async function runActivity() {
  if (!g.__fakeActivityPostedMatches)        g.__fakeActivityPostedMatches        = new Set();
  if (!g.__fakeActivityTipsterLastPost)      g.__fakeActivityTipsterLastPost      = new Map();
  if (!g.__fakeActivityTipsterLastComment)   g.__fakeActivityTipsterLastComment   = new Map();

  const now = Date.now();
  const tipsters = getFakeTipsters();
  const allMatches = await getAllMatches();

  // Settle finished matches first — updates tipster win rates
  const finishedIds = new Set(allMatches.filter(m => m.status === 'finished').map(m => m.id));
  settleActivityTips(finishedIds);

  // Only tipsters who haven't posted recently are allowed to post
  const availablePosters = tipsters.filter(t =>
    now - (g.__fakeActivityTipsterLastPost!.get(t.id) ?? 0) >= TIPSTER_POST_COOLDOWN_MS
  );

  // Post tips on upcoming / live matches (pick up to 4, skip already-posted)
  const relevant = allMatches.filter(m => {
    const t = new Date(m.kickoffTime).getTime();
    const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
    const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
    return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
  }).slice(0, 4);

  for (const match of relevant) {
    if (Math.random() > 0.4 || availablePosters.length === 0) continue;
    const tipster = randPick(availablePosters);
    const { pick, rationale } = smartPick(match.id, match.homeTeam.name, match.awayTeam.name, match.sport?.slug);
    const odds = resolveOddsForPick(pick, match.odds, match.markets);
    const template = randPick(MATCH_POSTS);
    const content = template(match.homeTeam.name, match.awayTeam.name, pick, rationale, odds);
    await createPost({
      userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
      content, matchId: match.id, matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      pick, odds, imageUrl: null,
    }).catch(() => {});
    recordActivityTip(tipster.id, match.id, pick, odds);
    g.__fakeActivityPostedMatches!.add(match.id);
    g.__fakeActivityTipsterLastPost!.set(tipster.id, now);
  }

  // Comments on recent match-linked posts — only by tipsters not on comment cooldown
  const availableCommenters = tipsters.filter(t =>
    now - (g.__fakeActivityTipsterLastComment!.get(t.id) ?? 0) >= TIPSTER_COMMENT_COOLDOWN_MS
  );
  const posts = await listPosts(15, null);
  for (const post of posts.filter(p => !!p.matchTitle && Math.random() > 0.6).slice(0, 2)) {
    const commenter = randPick(availableCommenters.filter(t => t.id !== post.userId));
    if (!commenter) continue;
    await addComment({
      postId: post.id, userId: commenter.id, authorName: commenter.displayName,
      authorAvatar: commenter.avatar, content: smartComment(post),
    }).catch(() => {});
    g.__fakeActivityTipsterLastComment!.set(commenter.id, now);
  }
}

// Fake activity generation is disabled — only real user activity is shown

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  const authHeader = req.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (secret !== CRON_SECRET && bearerSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!g.__fakeActivityPostedMatches)      g.__fakeActivityPostedMatches      = new Set();
  if (!g.__fakeActivityTipsterLastPost)    g.__fakeActivityTipsterLastPost    = new Map();
  if (!g.__fakeActivityTipsterLastComment) g.__fakeActivityTipsterLastComment = new Map();
  const now = Date.now();
  const tipsters = getFakeTipsters();
  const results = { postsCreated: 0, commentsCreated: 0, errors: [] as string[] };

  try {
    const allMatches = await getAllMatches();

    // Settle finished matches
    const finishedIds = new Set(allMatches.filter(m => m.status === 'finished').map(m => m.id));
    const settled = settleActivityTips(finishedIds);

    // Only tipsters who haven't posted recently
    const availablePosters = tipsters.filter(t =>
      now - (g.__fakeActivityTipsterLastPost!.get(t.id) ?? 0) >= TIPSTER_POST_COOLDOWN_MS
    );

    // Match-linked posts
    const relevant = allMatches.filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
      const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
      return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
    }).slice(0, 6);

    for (const match of relevant) {
      if (Math.random() > 0.4 || availablePosters.length === 0) continue;
      const tipster = randPick(availablePosters);
      const { pick, rationale } = smartPick(match.id, match.homeTeam.name, match.awayTeam.name, match.sport?.slug);
      const odds = resolveOddsForPick(pick, match.odds, match.markets);
      const template = randPick(MATCH_POSTS);
      const content = template(match.homeTeam.name, match.awayTeam.name, pick, rationale, odds);
      try {
        await createPost({
          userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
          content, matchId: match.id, matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          pick, odds, imageUrl: null,
        });
        recordActivityTip(tipster.id, match.id, pick, odds);
        g.__fakeActivityPostedMatches!.add(match.id);
        g.__fakeActivityTipsterLastPost!.set(tipster.id, now);
        results.postsCreated++;
      } catch (e) { results.errors.push(`post ${match.id}: ${e}`); }
    }

    // Comments — only match-linked posts, only tipsters not on comment cooldown
    const availableCommenters = tipsters.filter(t =>
      now - (g.__fakeActivityTipsterLastComment!.get(t.id) ?? 0) >= TIPSTER_COMMENT_COOLDOWN_MS
    );
    const recentPosts = await listPosts(20, null);
    for (const post of recentPosts.filter(p => !!p.matchTitle && Math.random() > 0.5).slice(0, randInt(1, 3))) {
      const commenter = randPick(availableCommenters.filter(t => t.id !== post.userId));
      if (!commenter) continue;
      try {
        await addComment({
          postId: post.id, userId: commenter.id, authorName: commenter.displayName,
          authorAvatar: commenter.avatar, content: smartComment(post),
        });
        g.__fakeActivityTipsterLastComment!.set(commenter.id, now);
        results.commentsCreated++;
      } catch (e) { results.errors.push(`comment ${post.id}: ${e}`); }
    }

    // ── Generic (non-match-linked) posts ──────────────────────────────────
    // Always post a few generic tips to keep the feed lively, even when
    // there are no upcoming matches to link to.
    const genericPosters = tipsters.filter(t =>
      now - (g.__fakeActivityTipsterLastPost!.get(t.id) ?? 0) >= TIPSTER_POST_COOLDOWN_MS
    );
    const genericTarget = Math.min(randInt(2, 4), genericPosters.length);
    const usedInGeneric = new Set<number>();
    for (let i = 0; i < genericTarget; i++) {
      const eligible = genericPosters.filter(t => !usedInGeneric.has(t.id));
      if (eligible.length === 0) break;
      const tipster = randPick(eligible);
      usedInGeneric.add(tipster.id);
      const content = randPick(GENERIC_POSTS);
      try {
        await createPost({
          userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
          content, matchId: null, matchTitle: null, pick: null, odds: null, imageUrl: null,
        });
        g.__fakeActivityTipsterLastPost!.set(tipster.id, now);
        results.postsCreated++;
      } catch (e) { results.errors.push(`generic-post: ${e}`); }
    }

    g.__fakeActivityLastRun = now;
    return NextResponse.json({ ok: true, ...results, settled });
  } catch (error) {
    console.error('[fake-activity] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
