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
];

function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const g = globalThis as {
  __fakeActivityPostedMatches?: Set<string>;
  __fakeActivityLastRun?: number;
};

async function runActivity() {
  if (!g.__fakeActivityPostedMatches) g.__fakeActivityPostedMatches = new Set();
  const now = Date.now();
  const tipsters = getFakeTipsters();
  const allMatches = await getAllMatches();

  // Settle finished matches first — updates tipster win rates
  const finishedIds = new Set(allMatches.filter(m => m.status === 'finished').map(m => m.id));
  settleActivityTips(finishedIds);

  // Post tips on upcoming / live matches
  const relevant = allMatches.filter(m => {
    const t = new Date(m.kickoffTime).getTime();
    const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
    const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
    return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
  }).slice(0, 4);

  for (const match of relevant) {
    if (Math.random() > 0.4) continue;
    const tipster = randPick(tipsters);
    const { pick, rationale } = smartPick(match.id, match.homeTeam.name, match.awayTeam.name, match.sport?.slug);
    const odds = parseFloat((1.45 + Math.random() * 2.3).toFixed(2));
    const template = randPick(MATCH_POSTS);
    const content = template(match.homeTeam.name, match.awayTeam.name, pick, rationale, odds);
    await createPost({
      userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
      content, matchId: match.id, matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      pick, odds, imageUrl: null,
    }).catch(() => {});
    recordActivityTip(tipster.id, match.id, pick, odds);
    g.__fakeActivityPostedMatches!.add(match.id);
  }

  // Generic post
  const genericTipster = randPick(tipsters);
  await createPost({
    userId: genericTipster.id, authorName: genericTipster.displayName,
    authorAvatar: genericTipster.avatar, content: randPick(GENERIC_POSTS),
    matchId: null, matchTitle: null, pick: null, odds: null, imageUrl: null,
  }).catch(() => {});

  // Comments on recent posts
  const posts = await listPosts(15, null);
  for (const post of posts.filter(() => Math.random() > 0.6).slice(0, 3)) {
    const commenter = randPick(tipsters.filter(t => t.id !== post.userId));
    await addComment({
      postId: post.id, userId: commenter.id, authorName: commenter.displayName,
      authorAvatar: commenter.avatar, content: randPick(COMMENTS),
    }).catch(() => {});
  }
}

// Auto-run on startup (5s delay) then every 20 minutes
if (typeof globalThis !== 'undefined') {
  setTimeout(() => { g.__fakeActivityLastRun = Date.now(); runActivity().catch(() => {}); }, 5000);
  setInterval(() => { g.__fakeActivityLastRun = Date.now(); runActivity().catch(() => {}); }, 20 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!g.__fakeActivityPostedMatches) g.__fakeActivityPostedMatches = new Set();
  const now = Date.now();
  const tipsters = getFakeTipsters();
  const results = { postsCreated: 0, commentsCreated: 0, errors: [] as string[] };

  try {
    const allMatches = await getAllMatches();

    // Settle finished matches
    const finishedIds = new Set(allMatches.filter(m => m.status === 'finished').map(m => m.id));
    const settled = settleActivityTips(finishedIds);

    // Match-linked posts
    const relevant = allMatches.filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
      const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
      return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
    }).slice(0, 6);

    for (const match of relevant) {
      if (Math.random() > 0.4) continue;
      const tipster = randPick(tipsters);
      const { pick, rationale } = smartPick(match.id, match.homeTeam.name, match.awayTeam.name, match.sport?.slug);
      const odds = parseFloat((1.45 + Math.random() * 2.3).toFixed(2));
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
        results.postsCreated++;
      } catch (e) { results.errors.push(`post ${match.id}: ${e}`); }
    }

    // Generic posts
    for (let i = 0; i < randInt(1, 2); i++) {
      const tipster = randPick(tipsters);
      try {
        await createPost({
          userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
          content: randPick(GENERIC_POSTS), matchId: null, matchTitle: null, pick: null, odds: null, imageUrl: null,
        });
        results.postsCreated++;
      } catch (e) { results.errors.push(`generic post: ${e}`); }
    }

    // Comments
    const recentPosts = await listPosts(20, null);
    for (const post of recentPosts.filter(() => Math.random() > 0.5).slice(0, randInt(2, 4))) {
      const commenter = randPick(tipsters.filter(t => t.id !== post.userId));
      try {
        await addComment({
          postId: post.id, userId: commenter.id, authorName: commenter.displayName,
          authorAvatar: commenter.avatar, content: randPick(COMMENTS),
        });
        results.commentsCreated++;
      } catch (e) { results.errors.push(`comment ${post.id}: ${e}`); }
    }

    g.__fakeActivityLastRun = now;
    return NextResponse.json({ ok: true, ...results, settled });
  } catch (error) {
    console.error('[fake-activity] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
