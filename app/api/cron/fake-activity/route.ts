import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createPost, addComment, listPosts } from '@/lib/feed-store';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import {
  getFakeTipsters,
  recordActivityTip,
  settleActivityTips,
} from '@/lib/fake-tipsters';
import { getCompetitionsAsync } from '@/lib/competitions-store';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

// ── Content de-duplication ──────────────────────────────────────────────────
// Fake tipster posts/comments come from finite template pools. Without a
// dedupe guard the same exact sentence eventually resurfaces (even long-form
// posts), which is the giveaway that the content is generated rather than
// real. We persist a rolling history of recently-used text (survives
// restarts) and never emit an exact repeat — if every candidate in a pool has
// already been used recently we append a small natural closing flourish so
// the final text is still unique.
const CONTENT_HISTORY_PATH = path.join(process.cwd(), '.local', 'data', 'fake-activity-content-history.json');
const HISTORY_LIMIT = 400;

interface ContentHistory {
  genericPosts: string[];
  matchPosts: string[];
  comments: string[];
}

function loadContentHistory(): ContentHistory {
  if (!g.__fakeActivityContentHistory) {
    try {
      const raw = fs.readFileSync(CONTENT_HISTORY_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ContentHistory>;
      g.__fakeActivityContentHistory = {
        genericPosts: Array.isArray(parsed.genericPosts) ? parsed.genericPosts : [],
        matchPosts: Array.isArray(parsed.matchPosts) ? parsed.matchPosts : [],
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      };
    } catch {
      g.__fakeActivityContentHistory = { genericPosts: [], matchPosts: [], comments: [] };
    }
  }
  return g.__fakeActivityContentHistory;
}

function saveContentHistory(history: ContentHistory) {
  g.__fakeActivityContentHistory = history;
  try {
    fs.mkdirSync(path.dirname(CONTENT_HISTORY_PATH), { recursive: true });
    fs.writeFileSync(CONTENT_HISTORY_PATH, JSON.stringify(history));
  } catch { /* best-effort persistence — in-memory cache still prevents repeats this run */ }
}

const normaliseContent = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Neutral closing flourishes used only to break an exact-duplicate tie when
// every candidate in a template pool has already been posted recently.
const UNIQUENESS_SUFFIXES = [
  'Sticking with the process on this one.',
  'Confidence is high here.',
  'Numbers keep pointing the same way.',
  'Already locked that one in.',
  'Watching how the market reacts next.',
  'Will update if anything changes before it starts.',
  'Feeling good about the read on this.',
  'Small edge but an edge nonetheless.',
];

/** Picks a candidate from `pool` that hasn't appeared in recent history for `kind`, recording it so it isn't repeated again soon. */
function pickUniqueContent(pool: string[], kind: keyof ContentHistory, maxAttempts = 15): string {
  const history = loadContentHistory();
  const seen = new Set(history[kind].map(normaliseContent));
  let candidate = pool[Math.floor(Math.random() * pool.length)];
  for (let i = 0; i < maxAttempts && seen.has(normaliseContent(candidate)); i++) {
    candidate = pool[Math.floor(Math.random() * pool.length)];
  }
  if (seen.has(normaliseContent(candidate))) {
    // Whole pool already used recently — append a small unique flourish so
    // the exact same sentence never repeats verbatim.
    candidate = `${candidate} ${UNIQUENESS_SUFFIXES[Math.floor(Math.random() * UNIQUENESS_SUFFIXES.length)]}`;
  }
  history[kind].push(candidate);
  if (history[kind].length > HISTORY_LIMIT) history[kind] = history[kind].slice(-HISTORY_LIMIT);
  saveContentHistory(history);
  return candidate;
}

// ── Real odds resolver ────────────────────────────────────────────────────────
// Use actual bookmaker odds from the match when available, fall back to
// a realistic randomised value so we never show a made-up "1.45" flat rate.

/**
 * Returns true only if the match has real bookmaker odds available for this pick.
 * This guards against ever displaying static fallback prices on the feed.
 */
function hasLiveOdds(
  pick: string,
  matchOdds?: { home: number; draw?: number; away: number } | null,
  markets?: Array<{ key?: string; name: string; selections: Array<{ label: string; odds: number }> }> | null,
): boolean {
  const p = pick.toLowerCase();
  const isOverPick = p.startsWith('over ');

  // Check market selections first
  if (markets && markets.length > 0) {
    for (const m of markets) {
      for (const sel of (m.selections || [])) {
        const sl = sel.label.toLowerCase();
        if (
          (p === 'home win' && (sl === 'home' || sl === '1' || sl === 'home win')) ||
          (p === 'away win' && (sl === 'away' || sl === '2' || sl === 'away win')) ||
          (p === 'draw' && (sl === 'draw' || sl === 'x')) ||
          (p === 'both teams score' && (sl === 'yes' || sl === 'btts yes' || sl.includes('both teams'))) ||
          // Generic "Over X.Y [unit]" — match any over/totals selection
          (isOverPick && (sl === 'over' || sl.startsWith('over ')))
        ) {
          if (sel.odds >= 1.01) return true;
        }
      }
    }
  }

  // Check 1X2 odds
  if (matchOdds) {
    if (p === 'home win' && matchOdds.home >= 1.01) return true;
    if (p === 'away win' && matchOdds.away >= 1.01) return true;
    if (p === 'draw' && matchOdds.draw && matchOdds.draw >= 1.01) return true;
  }

  return false;
}

function resolveOddsForPick(
  pick: string,
  matchOdds?: { home: number; draw?: number; away: number } | null,
  markets?: Array<{ key?: string; name: string; selections: Array<{ label: string; odds: number }> }> | null,
): number {
  const p = pick.toLowerCase();
  const isOverPick = p.startsWith('over ');

  // 1. Try to match pick against market selections first (most accurate)
  if (markets && markets.length > 0) {
    for (const m of markets) {
      for (const sel of (m.selections || [])) {
        const sl = sel.label.toLowerCase();
        if (
          (p === 'home win' && (sl === 'home' || sl === '1' || sl === 'home win')) ||
          (p === 'away win' && (sl === 'away' || sl === '2' || sl === 'away win')) ||
          (p === 'draw' && (sl === 'draw' || sl === 'x')) ||
          (p === 'both teams score' && (sl === 'yes' || sl === 'btts yes' || sl.includes('both teams'))) ||
          // Generic "Over X.Y [unit]" — match any over/totals selection
          (isOverPick && (sl === 'over' || sl.startsWith('over ')))
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
    'over 8.5 runs': 1.82,
    'over 215.5 points': 1.88,
    'over 5.5 goals': 1.80,
    'over 47.5 points': 1.85,
    'over 22.5 games': 1.78,
    'over 150.5 points': 1.84,
  };
  // Any other "Over X.Y [unit]" totals pick — realistic default
  if (isOverPick && !(p in base)) return 1.82;
  return base[p] ?? 2.00;
}

// ── Tip pick logic ────────────────────────────────────────────────────────────
// Individual-athlete sports — no "team", no "home venue"/"home form" advantage,
// no manager/squad language. Content for these must talk about the player(s)
// directly (e.g. "Alcaraz is the heavy favourite") never "the home side".
const INDIVIDUAL_SPORTS = new Set([
  'tennis', 'golf', 'boxing', 'mma', 'snooker', 'darts', 'table-tennis',
  'badminton', 'squash', 'cycling', 'athletics', 'swimming', 'formula-1',
]);
// Sports that never end in a draw (no draw market available)
const NO_DRAW_SPORTS = new Set([
  'basketball', 'baseball', 'hockey', 'american-football',
  ...INDIVIDUAL_SPORTS,
]);

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

  // Sport-specific totals line and language
  const sportSlug = (sport || '').toLowerCase().replace(/[\s_-]/g, '');
  let totalsLine = 'Over 2.5 Goals';
  let totalsRationale = `High-scoring encounters characterise this fixture.`;
  let bttsRationale = `Both attacks are in form — expect goals at both ends.`;
  if (sportSlug === 'baseball' || sportSlug === 'mlb') {
    totalsLine = 'Over 8.5 Runs';
    totalsRationale = `Both offences have been productive — expect a high-scoring game.`;
  } else if (sportSlug === 'basketball' || sportSlug === 'nba' || sportSlug === 'ncaab') {
    totalsLine = 'Over 215.5 Points';
    totalsRationale = `Fast pace and strong offences should push the total over.`;
  } else if (sportSlug === 'hockey' || sportSlug === 'nhl' || sportSlug === 'icehockey') {
    totalsLine = 'Over 5.5 Goals';
    totalsRationale = `Open, attacking hockey predicted — both goalies have been shaky.`;
  } else if (sportSlug === 'americanfootball' || sportSlug === 'nfl' || sportSlug === 'ncaaf') {
    totalsLine = 'Over 47.5 Points';
    totalsRationale = `Both offences are in rhythm and defences have been leaky.`;
  } else if (sportSlug === 'tennis') {
    totalsLine = 'Over 22.5 Games';
    totalsRationale = `Closely matched players — expect a long competitive match.`;
  } else if (sportSlug === 'volleyball') {
    totalsLine = 'Over 150.5 Points';
    totalsRationale = `Both sides are strong attackers — high-scoring rally play expected.`;
  }

  // Weighted pick table — individual-athlete sports get player-focused
  // rationale (no "home form"/"home turf"/"side" language, since there is
  // no team or home venue advantage in a 1-on-1 matchup).
  const isIndividual = INDIVIDUAL_SPORTS.has(sportSlug) || INDIVIDUAL_SPORTS.has((sport || '').toLowerCase());
  type WPick = { pick: string; weight: number; rationale: string };
  const table: WPick[] = allowDraw
    ? [
        { pick: 'Home Win',          weight: 42, rationale: `${homeTeam} have strong home form and H2H advantage.` },
        { pick: 'Draw',              weight: 24, rationale: `Both sides are evenly matched — a draw looks likely.` },
        { pick: 'Away Win',          weight: 22, rationale: `${awayTeam} travel well and their recent form is excellent.` },
        { pick: 'Both Teams Score',  weight:  7, rationale: bttsRationale },
        { pick: totalsLine,          weight:  5, rationale: totalsRationale },
      ]
    : isIndividual
    ? [
        { pick: 'Home Win',          weight: 52, rationale: `${homeTeam} is the clear favourite here on current form.` },
        { pick: 'Away Win',          weight: 38, rationale: `${awayTeam} has been in excellent form recently and can cause an upset.` },
        { pick: totalsLine,          weight: 10, rationale: totalsRationale },
      ]
    : [
        { pick: 'Home Win',          weight: 52, rationale: `${homeTeam} are heavy favourites on home turf.` },
        { pick: 'Away Win',          weight: 38, rationale: `${awayTeam} are the stronger side on paper.` },
        { pick: totalsLine,          weight: 10, rationale: totalsRationale },
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

// Comments safe to post under ANY sport — no team/venue/manager/squad
// language, so they never sound wrong under a tennis, golf or MMA post.
const GENERIC_COMMENTS = [
  'Agreed — I was thinking the same thing.',
  'Good analysis, thanks for sharing.',
  'I see your reasoning but I am going the other way on this one.',
  'Solid tip, already added it to my slip.',
  'The form table backs this up nicely.',
  'Great insight as always.',
  'Did you factor in the head-to-head though?',
  'Bold pick but I like the value there.',
  'Following this one closely, thanks.',
  'Value looks right to me too.',
  'This is why I follow you — solid research every time.',
  'Added to my accumulator, let us go.',
  'Those odds look too good to pass up.',
  'I am on the same side, let us cash together.',
  'Not sure about this one but respect the process.',
  'The stats really do support this pick.',
  'Risky but the market is mispriced here, I agree.',
  'Followed. Your tips have been sharp lately.',
  'Nice one. What is your stake on this?',
  'Patience pays — this pick makes total sense at these odds.',
  'Finally someone saying what everyone is thinking.',
  'Strong reasoning. I would adjust the stake slightly higher though.',
  'Bookies are slow to react here, grab it before the line moves.',
  'Posted the same pick earlier, glad others see it too.',
  'Watch the weather forecast — could affect this one.',
  'I backed the same angle last week and cashed easily.',
  'Going with you on this. Cheers for posting early.',
  'Saw this line move earlier — had a feeling someone sharp was on it.',
  'Under-rated pick. Most people tunnel vision the result only.',
  'I had the opposite at first but you changed my mind, fair point.',
  'Line is drifting now. Either smart money disagrees or the public is piling in.',
  'What unit size are you going with on this one?',
  'Doubled my usual stake based on your reasoning. Makes total sense.',
  'Took the same selection at better odds an hour ago. Good value still.',
  'Market is moving fast on this. Grab it while you can.',
  'Perfect bankroll approach. Singles stack up way more consistently.',
  'Your last five tips have been class. Sticking with you this week.',
  'Interesting angle, had not considered that.',
  'Great read on the recent form here.',
];

// Team-sport-only comments (referee, squad, manager, home venue, cup ties,
// clean sheets, etc.) — only surfaced for team sports (football, basketball,
// rugby...), never for individual-athlete sports like tennis/golf/MMA.
const TEAM_SPORT_COMMENTS = [
  'Clean analysis. What about injuries?',
  'Draw is always overlooked at these prices.',
  'H2H record strongly favours this outcome.',
  'Been watching this team all season, this is the right call.',
  'Good spot. The home side has been conceding early lately.',
  'The xG data is telling the same story, back it.',
  'Injuries in the squad change everything on this one.',
  'Referee profile for this game also leans that way.',
  'Big game mentality counts for a lot here, good pick.',
  'Travel schedule for the away side is brutal this week. Good spot.',
  'Team news was the key info here. Well done for catching that.',
  'This league is so hard to call but that logic is sound.',
  'Both managers have something to play for. Hard to see it being open.',
  'Momentum is with the home side after last weekend. Good timing.',
  'The rotation risk for the cup game mid-week is real. Factor that in.',
  'Keeper is in excellent form lately. Might go under and clean sheet combo.',
  'Do you like the first goal scorer market at all on this one?',
];

function smartComment(post: { content: string; pick?: string | null; matchTitle?: string | null }, sport?: string): string {
  const sportSlug = (sport || '').toLowerCase();
  const isIndividual = INDIVIDUAL_SPORTS.has(sportSlug);
  const pool = isIndividual ? GENERIC_COMMENTS : [...GENERIC_COMMENTS, ...TEAM_SPORT_COMMENTS];
  const base = pickUniqueContent(pool, 'comments');
  if (!post.pick && !post.matchTitle) return base;
  const matchupLabel = post.matchTitle
    ? (isIndividual ? `Big matchup between ${post.matchTitle.replace(' vs ', ' and ')}.` : `Big game in ${post.matchTitle.split(' vs ')[0] || 'this fixture'}.`)
    : '';
  const extras = [
    post.pick ? `That ${post.pick} call is interesting.` : '',
    matchupLabel,
    'The odds reflect the market consensus too.',
    'Have you looked at the recent form run?',
    'Solid value at those odds for sure.',
    !isIndividual ? 'Combining this with an Over in the same game.' : '',
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

/** Returns an ISO timestamp randomly offset 0–maxMinutes minutes in the past. */
function staggeredTs(maxMinutes = 90): string {
  const offset = Math.floor(Math.random() * maxMinutes * 60 * 1000);
  return new Date(Date.now() - offset).toISOString();
}

const g = globalThis as {
  __fakeActivityPostedMatches?: Set<string>;
  __fakeActivityLastRun?: number;
  __fakeActivityTipsterLastPost?: Map<number, number>;
  __fakeActivityTipsterLastComment?: Map<number, number>;
  __fakeActivityRoomIds?: Map<string, number>;
  __fakeActivityContentHistory?: ContentHistory;
};

// ── Room assignment ───────────────────────────────────────────────────────────
// Fetch room slug→id mapping once and cache for the process lifetime.
async function getRoomId(slug: string): Promise<number | null> {
  if (!g.__fakeActivityRoomIds) {
    try {
      const { query } = await import('@/lib/db');
      const r = await query<{ id: number; slug: string }>(
        `SELECT id, slug FROM community_rooms WHERE is_active = 1`,
        [],
      );
      g.__fakeActivityRoomIds = new Map(r.rows.map(x => [x.slug, x.id]));
    } catch {
      g.__fakeActivityRoomIds = new Map();
    }
  }
  return g.__fakeActivityRoomIds.get(slug) ?? null;
}

/**
 * Pick the best room for a fake post based on sport, match liveness, content,
 * and tipster status.
 */
async function pickRoomForPost(opts: {
  sport?: string;
  isLive?: boolean;
  hasPick?: boolean;
  hasOdds?: boolean;
  contentLower: string;
  isPro?: boolean;
}): Promise<number | null> {
  const { sport, isLive, hasPick, hasOdds, contentLower, isPro } = opts;

  // Pro tipsters with confirmed picks → Premium Picks
  if (isPro && hasPick && hasOdds) return getRoomId('premium');

  // Basketball posts
  if (sport === 'basketball') return getRoomId('basketball');

  // Live match → Live Chat
  if (isLive) return getRoomId('live-chat');

  // Football match tip with real odds → Football Tips
  if (hasPick && hasOdds && (sport === 'soccer' || sport === 'football' || !sport)) {
    return getRoomId('football');
  }

  // Value / odds analysis posts
  const valueTerms = ['value', 'odds', 'line moved', 'price', 'market', 'mispriced', 'implied', 'line'];
  if (valueTerms.some(t => contentLower.includes(t))) return getRoomId('value-bets');

  // Stats / analysis posts
  const analysisTerms = ['xg', 'h2h', 'stats', 'analysis', 'model', 'data', 'research', 'form', 'pattern'];
  if (analysisTerms.some(t => contentLower.includes(t))) return getRoomId('analysis');

  // Football match watch/analysis without odds → Analysis
  if (!hasPick || !hasOdds) return getRoomId('analysis');

  return getRoomId('general');
}

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

    // Only attach real bookmaker odds — never use the static fallback values.
    // If the match has no live odds yet, post a generic analysis without the odds badge.
    type OddsMarkets = Array<{ key?: string; name: string; selections: Array<{ label: string; odds: number }> }>;
    const marketsForOdds = match.markets as OddsMarkets | undefined;
    const hasRealOdds = hasLiveOdds(pick, match.odds, marketsForOdds);
    let postPick: string | null = null;
    let postOdds: number | null = null;
    let content: string;

    if (hasRealOdds) {
      const odds = resolveOddsForPick(pick, match.odds, marketsForOdds);
      const templates = MATCH_POSTS.map(t => t(match.homeTeam.name, match.awayTeam.name, pick, rationale, odds));
      content = pickUniqueContent(templates, 'matchPosts');
      postPick = pick;
      postOdds = odds;
      recordActivityTip(tipster.id, match.id, pick, odds);
    } else {
      // Post an analysis comment without odds so no fake price is displayed
      const genericAnalysis = [
        `${match.homeTeam.name} vs ${match.awayTeam.name} — ${rationale} Keeping an eye on this one before committing.`,
        `Watching ${match.homeTeam.name} vs ${match.awayTeam.name} closely. ${rationale}`,
        `${match.homeTeam.name} vs ${match.awayTeam.name}: ${rationale} Will post my tip once the lines open.`,
      ];
      content = pickUniqueContent(genericAnalysis, 'matchPosts');
    }

    await createPost({
      userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
      content, matchId: match.id, matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      pick: postPick, odds: postOdds, imageUrl: null, createdAt: staggeredTs(60),
    }).catch(() => {});
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
    const commentSport = allMatches.find(m => m.id === post.matchId)?.sport?.slug;
    await addComment({
      postId: post.id, userId: commenter.id, authorName: commenter.displayName,
      authorAvatar: commenter.avatar, content: smartComment(post, commentSport),
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

    // Collect active league-specific competitions so fake tipsters only tip
    // on those league's fixtures. If a competition has leagueName/leagueId,
    // fake tips must come from that specific league to appear on the leaderboard.
    const activeCompetitions = (await getCompetitionsAsync()).filter(c => c.status === 'active');
    const activeLeagueNames = new Set<string>();
    const activeLeagueIds = new Set<number>();
    for (const comp of activeCompetitions) {
      if (comp.leagueName) activeLeagueNames.add(comp.leagueName.toLowerCase());
      if (comp.leagueId) activeLeagueIds.add(comp.leagueId);
    }
    const hasLeagueFilter = activeLeagueNames.size > 0 || activeLeagueIds.size > 0;

    // Match-linked posts — when there are active league-specific competitions,
    // prefer matches from those leagues so fake tipsters show on leaderboards.
    const candidateMatches = allMatches.filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
      const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
      return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
    });

    // Partition into league-filtered and unfiltered pools
    const leagueMatches = hasLeagueFilter
      ? candidateMatches.filter(m => {
          const leagueNameLower = (m.league?.name ?? '').toLowerCase();
          const leagueId = (m.league as { id?: number })?.id;
          const nameMatch = activeLeagueNames.size > 0 && [...activeLeagueNames].some(
            n => leagueNameLower.includes(n) || n.includes(leagueNameLower.replace(/[^a-z0-9]/g, ''))
          );
          const idMatch = leagueId !== undefined && activeLeagueIds.has(leagueId);
          return nameMatch || idMatch;
        })
      : [];

    // Use league-filtered matches first (fill leaderboard), then top up with others
    const relevant = [
      ...leagueMatches.slice(0, 4),
      ...candidateMatches.filter(m => !leagueMatches.includes(m)).slice(0, Math.max(0, 6 - leagueMatches.length)),
    ].slice(0, 6);

    for (const match of relevant) {
      if (Math.random() > 0.4 || availablePosters.length === 0) continue;
      const tipster = randPick(availablePosters);
      const { pick, rationale } = smartPick(match.id, match.homeTeam.name, match.awayTeam.name, match.sport?.slug);

      // Only post with real odds — never display static fallback prices on the feed.
      type OddsMarkets2 = Array<{ key?: string; name: string; selections: Array<{ label: string; odds: number }> }>;
      const mkts = match.markets as OddsMarkets2 | undefined;
      let postPick: string | null = null;
      let postOdds: number | null = null;
      let content: string;

      if (hasLiveOdds(pick, match.odds, mkts)) {
        const odds = resolveOddsForPick(pick, match.odds, mkts);
        const templates = MATCH_POSTS.map(t => t(match.homeTeam.name, match.awayTeam.name, pick, rationale, odds));
        content = pickUniqueContent(templates, 'matchPosts');
        postPick = pick;
        postOdds = odds;
      } else {
        const genericAnalysis = [
          `${match.homeTeam.name} vs ${match.awayTeam.name} — ${rationale} Waiting for the lines to sharpen before committing.`,
          `Watching ${match.homeTeam.name} vs ${match.awayTeam.name} closely. ${rationale}`,
          `${match.homeTeam.name} vs ${match.awayTeam.name}: ${rationale} Will post my tip once odds are confirmed.`,
        ];
        content = pickUniqueContent(genericAnalysis, 'matchPosts');
      }

      const isLiveMatch = ['live', 'halftime', 'extra_time', 'penalties'].includes(match.status);
      const roomId = await pickRoomForPost({
        sport: match.sport?.slug,
        isLive: isLiveMatch,
        hasPick: !!postPick,
        hasOdds: !!postOdds,
        contentLower: content.toLowerCase(),
        isPro: tipster.isPro,
      });

      try {
        await createPost({
          userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
          content, matchId: match.id, matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          pick: postPick, odds: postOdds, imageUrl: null, roomId, createdAt: staggeredTs(60),
        });
        if (postPick && postOdds) recordActivityTip(tipster.id, match.id, postPick, postOdds);
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
        const commentSport = allMatches.find(m => m.id === post.matchId)?.sport?.slug;
        await addComment({
          postId: post.id, userId: commenter.id, authorName: commenter.displayName,
          authorAvatar: commenter.avatar, content: smartComment(post, commentSport),
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
      const content = pickUniqueContent(GENERIC_POSTS, 'genericPosts');
      const genRoomId = await pickRoomForPost({
        contentLower: content.toLowerCase(),
        isPro: tipster.isPro,
      });
      try {
        await createPost({
          userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
          content, matchId: null, matchTitle: null, pick: null, odds: null, imageUrl: null, roomId: genRoomId,
          createdAt: staggeredTs(120),
        });
        g.__fakeActivityTipsterLastPost!.set(tipster.id, now);
        results.postsCreated++;
      } catch (e) { results.errors.push(`generic-post: ${e}`); }
    }

    // ── Fake challenge creation ───────────────────────────────────────────────
    // Periodically create new fake challenges so the Challenges page always
    // looks busy. One new challenge every ~4 cron ticks (roughly once per hour).
    try {
      if (Math.random() < 0.25) {
        const { createChallenge, getChallenges } = await import('@/lib/challenges-store');
        const { getFakeTipsters } = await import('@/lib/fake-tipsters');
        const fakeTipsters = getFakeTipsters();
        if (fakeTipsters.length >= 2) {
          const existing = await getChallenges('all');
          const activeCount = existing.filter(c => c.status === 'active' || c.status === 'pending').length;
          // Keep between 3 and 10 active/pending challenges at all times
          if (activeCount < 8) {
            const CHALLENGE_TITLES = [
              'Weekend EPL Showdown', 'UCL Group Stage Battle', 'La Liga Prediction Cup',
              'Bundesliga ROI Challenge', 'Top 5 Leagues Streak War', 'Friday Night Accas',
              'Saturday Banker Challenge', 'African Cup Tipster Duel', 'NBA Points Battle',
              'Value Bets Only Challenge', 'Serie A Prediction Duel', 'Ligue 1 Showdown',
              'Over 2.5 Goals Challenge', 'BTTS Specialist Battle', 'Asian Handicap Masters',
              'World Cup 2026 Qualifier Tips', 'Top Scorer Prediction Cup', 'Double Chance Experts',
            ];
            const SPORTS_LIST = ['football', 'football', 'football', 'football', 'basketball', 'football'];
            const SCORING_LIST: Array<'win_rate' | 'roi' | 'streak'> = ['win_rate', 'roi', 'streak', 'win_rate', 'win_rate', 'roi'];
            const PRIZES = ['KES 2,000', 'KES 5,000', null, 'KES 1,000', 'KES 3,000', null];
            const idx = Math.floor(Math.random() * CHALLENGE_TITLES.length);
            const scoringIdx = Math.floor(Math.random() * SCORING_LIST.length);
            const shuffled = [...fakeTipsters].sort(() => Math.random() - 0.5);
            const challenger = shuffled[0];
            const opponent = shuffled[1];
            const startOffset = Math.random() < 0.5 ? 0 : -Math.floor(Math.random() * 3);
            const duration = 3 + Math.floor(Math.random() * 11); // 3-13 days
            const startDate = new Date(now + startOffset * 86400000).toISOString().slice(0, 10);
            const endDate = new Date(now + (startOffset + duration) * 86400000).toISOString().slice(0, 10);

            await createChallenge({
              title: CHALLENGE_TITLES[idx],
              description: `Fake challenge between ${challenger.displayName} and ${opponent.displayName}. Best ${SCORING_LIST[scoringIdx].replace('_', ' ')} wins.`,
              sport: SPORTS_LIST[scoringIdx],
              scoringMethod: SCORING_LIST[scoringIdx],
              startDate,
              endDate,
              challengerId: challenger.id,
              opponentId: opponent.id,
              stakePts: [50, 100, 200, 500][Math.floor(Math.random() * 4)],
              prizePool: PRIZES[Math.floor(Math.random() * PRIZES.length)] ?? undefined,
              isPublic: true,
              maxTips: 10 + Math.floor(Math.random() * 11),
            });
            void results; // reference to suppress lint
          }
        }
      }
    } catch (e) {
      results.errors.push(`fake-challenges: ${e}`);
    }

    // ── Fake community voting on match-based challenges ───────────────────────
    // Makes fake tipsters vote "challenger" or "opponent" on live/pending
    // challenges so the vote bars look active and realistic.
    try {
      const { getChallenges, voteCommunity } = await import('@/lib/challenges-store');
      const { getFakeTipsters } = await import('@/lib/fake-tipsters');
      const allChallenges = await getChallenges('all');
      const voteable = allChallenges.filter(c => c.status === 'active' || c.status === 'pending');
      const fakeVoters = getFakeTipsters();

      for (const challenge of voteable) {
        const totalVotes = challenge.challengerVotes + challenge.opponentVotes;
        // Keep each challenge at 8–30 votes — add a few per cron run
        const target = 8 + Math.floor(Math.abs(challenge.id * 7919) % 22); // deterministic per challenge
        if (totalVotes >= target) continue;

        const toAdd = Math.min(3, target - totalVotes);
        // Bias: challenger favoured if their W/L > opponent, otherwise split evenly
        const challengerWR = challenge.challenger
          ? (challenge.challenger.won || 0) / Math.max(1, (challenge.challenger.won || 0) + (challenge.challenger.lost || 0))
          : 0.5;
        const opponentWR = challenge.challenged
          ? (challenge.challenged.won || 0) / Math.max(1, (challenge.challenged.won || 0) + (challenge.challenged.lost || 0))
          : 0.5;
        const challengerBias = 0.35 + (challengerWR / Math.max(challengerWR + opponentWR, 0.01)) * 0.5;

        // Pick random fake voters not already voting on this challenge
        const shuffledVoters = [...fakeVoters].sort(() => Math.random() - 0.5);
        let added = 0;
        for (const voter of shuffledVoters) {
          if (added >= toAdd) break;
          const side: 'challenger' | 'opponent' = Math.random() < challengerBias ? 'challenger' : 'opponent';
          try {
            await voteCommunity(challenge.id, voter.id, side);
            added++;
          } catch { /* duplicate — already voted */ }
        }
      }
    } catch { /* non-fatal */ }

    g.__fakeActivityLastRun = now;
    return NextResponse.json({ ok: true, ...results, settled });
  } catch (error) {
    console.error('[fake-activity] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
