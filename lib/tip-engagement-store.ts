// Tip engagement store: per-tip likes + comments.
// Uses MySQL when DATABASE_URL is set, otherwise falls back to in-memory
// global state (consistent with the rest of the codebase).

import { query, execute } from './db';

export interface TipComment {
  id: string;
  tipId: string;
  userId: number;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  createdAt: string;
}

interface Stores {
  // tipId → set of userIds who liked it
  likes: Map<string, Set<number>>;
  // tipId → list of comments (real, written by visitors)
  comments: Map<string, TipComment[]>;
  // baseline like count seeded from auto-tips so the UI keeps the original number
  baseline: Map<string, number>;
  // tipId → list of synthetic comments by other fake tipsters (cross-engagement)
  seededComments: Map<string, TipComment[]>;
}

const g = globalThis as { __tipEngagementStore?: Stores };
g.__tipEngagementStore = g.__tipEngagementStore || {
  likes: new Map(),
  comments: new Map(),
  baseline: new Map(),
  seededComments: new Map(),
};
const s = g.__tipEngagementStore;

const hasDb = () => !!process.env.DATABASE_URL;

function makeId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── LIKES ───────────────────────────────────────────────────────────

export function setBaselineLikes(tipId: string, count: number) {
  s.baseline.set(tipId, Math.max(0, count));
}

export async function getLikeCount(tipId: string, viewerId?: number | null): Promise<{ count: number; liked: boolean }> {
  const baseline = s.baseline.get(tipId) || 0;
  if (hasDb()) {
    try {
      const r = await query<{ c: string }>(`SELECT COUNT(*) as c FROM tip_likes WHERE tip_id = $1`, [tipId]);
      const dbCount = Number(r.rows[0]?.c || 0);
      let liked = false;
      if (viewerId) {
        const lr = await query<{ user_id: number }>(`SELECT user_id FROM tip_likes WHERE tip_id = $1 AND user_id = $2 LIMIT 1`, [tipId, viewerId]);
        liked = lr.rows.length > 0;
      }
      return { count: baseline + dbCount, liked };
    } catch { /* fall through */ }
  }
  const set = s.likes.get(tipId);
  const count = baseline + (set?.size || 0);
  const liked = !!(viewerId && set?.has(viewerId));
  return { count, liked };
}

export async function likeTip(tipId: string, userId: number): Promise<{ count: number; liked: boolean }> {
  if (hasDb()) {
    try {
      await execute(`INSERT INTO tip_likes (tip_id, user_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`, [tipId, userId]);
      return getLikeCount(tipId, userId);
    } catch { /* fall through */ }
  }
  const set = s.likes.get(tipId) || new Set<number>();
  set.add(userId);
  s.likes.set(tipId, set);
  return getLikeCount(tipId, userId);
}

export async function unlikeTip(tipId: string, userId: number): Promise<{ count: number; liked: boolean }> {
  if (hasDb()) {
    try {
      await execute(`DELETE FROM tip_likes WHERE tip_id = $1 AND user_id = $2`, [tipId, userId]);
      return getLikeCount(tipId, userId);
    } catch { /* fall through */ }
  }
  const set = s.likes.get(tipId);
  if (set) set.delete(userId);
  return getLikeCount(tipId, userId);
}

// ─── COMMENTS ─────────────────────────────────────────────────────────

export async function listComments(tipId: string, limit = 50): Promise<TipComment[]> {
  const seeded = s.seededComments.get(tipId) || [];
  let real: TipComment[] = [];
  if (hasDb()) {
    try {
      const r = await query<{ id: string; tip_id: string; user_id: number; author_name: string; author_avatar: string | null; content: string; created_at: string | Date }>(
        `SELECT id, tip_id, user_id, author_name, author_avatar, content, created_at
         FROM tip_comments WHERE tip_id = $1 ORDER BY created_at ASC LIMIT $2`,
        [tipId, limit],
      );
      real = r.rows.map(x => ({
        id: x.id,
        tipId: x.tip_id,
        userId: x.user_id,
        authorName: x.author_name,
        authorAvatar: x.author_avatar,
        content: x.content,
        createdAt: typeof x.created_at === 'string' ? x.created_at : x.created_at.toISOString(),
      }));
    } catch { /* fall through */ }
  } else {
    real = s.comments.get(tipId) || [];
  }
  // Show seeded fake-tipster chatter first, then real visitor comments.
  return [...seeded, ...real].slice(0, limit);
}

export async function addComment(input: {
  tipId: string;
  userId: number;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
}): Promise<TipComment> {
  const id = makeId();
  const createdAt = new Date().toISOString();
  if (hasDb()) {
    try {
      await execute(
        `INSERT INTO tip_comments (id, tip_id, user_id, author_name, author_avatar, content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [id, input.tipId, input.userId, input.authorName, input.authorAvatar || null, input.content],
      );
      return { id, tipId: input.tipId, userId: input.userId, authorName: input.authorName, authorAvatar: input.authorAvatar, content: input.content, createdAt };
    } catch { /* fall through */ }
  }
  const list = s.comments.get(input.tipId) || [];
  const c: TipComment = { id, tipId: input.tipId, userId: input.userId, authorName: input.authorName, authorAvatar: input.authorAvatar, content: input.content, createdAt };
  list.push(c);
  s.comments.set(input.tipId, list);
  return c;
}

export async function getCommentCount(tipId: string): Promise<number> {
  const seededN = (s.seededComments.get(tipId) || []).length;
  if (hasDb()) {
    try {
      const r = await query<{ c: string }>(`SELECT COUNT(*) as c FROM tip_comments WHERE tip_id = $1`, [tipId]);
      return Number(r.rows[0]?.c || 0) + seededN;
    } catch { /* fall through */ }
  }
  return (s.comments.get(tipId) || []).length + seededN;
}

// ─── SEEDED FAKE-TIPSTER ENGAGEMENT ──────────────────────────────────
// Cross-engagement: other fake tipsters comment on (and like) each
// generated tip. Output is deterministic per (tipId, seed) so every
// page render shows the same chatter.

// Big, varied template pool. We mix four "voices" (analyst, hype, sceptic,
// stake-talk) so a comment thread reads like a real chatroom — not the same
// twelve catchphrases on every tip. Placeholders: {team}, {venue},
// {confidence}, {opp}, {odds}, {market}, {league}.
const COMMENT_TEMPLATES: string[] = [
  // Analyst voice — references xG, form, tactics
  "{team}'s xG over the last 5 games backs this — {confidence}% feels about right.",
  'Tactically this fits {team} perfectly against a {opp} press that leaks early.',
  'H2H goals trend says {market} is the smarter side of this fixture.',
  'Watch the first 20 mins — if {team} hold the ball, this lands easily.',
  '{opp} concede goals in 7 of last 10 on the road. Tracks for me.',
  "Set-piece edge to {team} — that's where this market wins.",
  'Possession share favours {team} but the chance quality is closer than people think.',
  'Expected goals lean {team}, expected assists lean {opp}. Balanced — but value is your side.',
  'Tempo data says this stays low-block — careful with overs.',
  'Rest days favour {team} (+1 day) — fitness edge in the last 30 mins.',
  '{team} have kept a clean sheet in 4 of their last 5 home games. Defence is the story here.',
  '{opp} have scored in every away game this season. This is a high-risk market.',
  'Corners and set pieces are where {team} generate most of their xG. Worth monitoring.',
  // Hype / agreement voice
  "Booked at {odds}. Let's ride.",
  'On this too. Sliding 2% bankroll, no more.',
  'Tail confirmed. Cleanest write-up I have read all week.',
  'Locked in. {team} under the lights is a different animal.',
  'Adding to my 3-fold. Thanks for the reasoning.',
  'Took the same line at {odds}. Holding.',
  'Live odds dropping fast — market is catching up to you.',
  'Steam already moving on {market}. Sharp money confirmed.',
  '+EV all day. Closing line value will reward this.',
  "I've been tracking {team} all month and this is the right time to back them.",
  'Same read here. Posted mine 10 mins ago at slightly better odds.',
  // Sceptic / counter voice
  "I'd go alt {market} for the same return — less variance.",
  'Risky one. Watch the team news 24h before kickoff.',
  "Faded {team} twice this season at home — let's see if third time is different.",
  '{team} away form is the wildcard. Stake small.',
  'Public is heavy on this side — fade alarm bells for me.',
  'Closing line might drift. I would wait an hour.',
  'Weather forecast says rain — {market} usually shifts in those games.',
  'Refs in this league average 4.5 cards — could disrupt the flow.',
  'Lineups drop in 90 min. Hold off until then.',
  "Injury list is brutal — I'm sitting this one out.",
  "Not sold on the odds. {opp} are better than their table position suggests.",
  // Stake / bankroll voice
  '1.5% bankroll for me. Variance is real.',
  'Treating as a single, not adding to acca.',
  'Hedging on the alt at half-time if it lands early.',
  'Cashout option will be juicy if first goal goes your way.',
  '5% on this — confidence high but I cap there.',
  'No live-betting this one. Pre-match price only.',
  'Stake reduced because of the odds drop.',
  'Single only — accumulators kill ROI on picks like this.',
  // Short reactions
  'Solid call.',
  'Reading my mind today.',
  'Sharp.',
  'Sleeper pick of the week.',
  'Underrated angle.',
  "Numbers don't lie — backing it.",
  'In. Good luck all.',
  'Bold but I see it.',
  'Different gravy.',
  "This is the one I've been waiting for all week.",
  'Good analysis. Backing it with a 2 unit stake.',
  // League / context voice
  '{league} has been wild this season — anything goes.',
  'Form in {league} flips every two weeks. Worth a small play.',
  'European nights at {venue} are a different game — pace drops.',
  'Local derbies skew toward draws here — be aware.',
  "Late kickoffs in {league} historically favour {market}.",
  '{team} are unbeaten in their last 8 at {venue}. Home advantage is real here.',
  "Both managers will set up defensively early. Don't expect an open game.",
];

function deterministicRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

interface SeedTipster {
  id: number;
  username: string;
  displayName: string;
  avatar?: string | null;
}

/**
 * Seeds synthetic comments + baseline likes for a tip. Idempotent —
 * a given tipId is only ever seeded once per process.
 *
 * Variety guarantees:
 *   - No two comments inside the same thread reuse the same template.
 *   - No two consecutive comments share an author.
 *   - Placeholder fills (team / venue / opponent) rotate per comment so the
 *     same template surfaced on a different tip reads differently.
 */
export function seedTipEngagement(
  tipId: string,
  opts: {
    likes: number;
    comments: number;
    tipsters: SeedTipster[];
    homeTeam?: string;
    awayTeam?: string;
    venue?: string;
    confidence?: number;
    createdAt?: string;
    league?: string;
    market?: string;
    odds?: number;
  },
) {
  if (s.seededComments.has(tipId)) return;
  setBaselineLikes(tipId, opts.likes);

  const list: TipComment[] = [];
  if (opts.tipsters.length > 0 && opts.comments > 0) {
    let seedNum = 0;
    for (let i = 0; i < tipId.length; i++) seedNum = (seedNum * 31 + tipId.charCodeAt(i)) >>> 0;
    const r = deterministicRng(seedNum);
    const baseTime = opts.createdAt ? new Date(opts.createdAt).getTime() : Date.now() - 6 * 3600_000;
    const home = opts.homeTeam || 'they';
    const away = opts.awayTeam || 'the visitors';
    const venue = opts.venue || 'home';
    const league = opts.league || 'this league';
    const market = opts.market || 'this market';
    const odds = opts.odds ? opts.odds.toFixed(2) : '1.92';
    const conf = String(opts.confidence ?? 70);

    // Shuffle the template pool so the first N comments are guaranteed
    // template-unique within this thread.
    const pool = [...COMMENT_TEMPLATES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let lastAuthorId = -1;
    for (let i = 0; i < opts.comments; i++) {
      // Pick an author distinct from the previous one (when possible).
      let author = opts.tipsters[Math.floor(r() * opts.tipsters.length)];
      if (opts.tipsters.length > 1 && author.id === lastAuthorId) {
        author = opts.tipsters[(opts.tipsters.indexOf(author) + 1) % opts.tipsters.length];
      }
      lastAuthorId = author.id;

      const tpl = pool[i % pool.length];
      // Alternate which team the {team} placeholder refers to so the same
      // template doesn't always praise the home side.
      const teamForThis = i % 2 === 0 ? home : away;
      const oppForThis = i % 2 === 0 ? away : home;
      const content = tpl
        .replace(/\{team\}/g, teamForThis)
        .replace(/\{opp\}/g, oppForThis)
        .replace(/\{venue\}/g, venue)
        .replace(/\{confidence\}/g, conf)
        .replace(/\{league\}/g, league)
        .replace(/\{market\}/g, market)
        .replace(/\{odds\}/g, odds);

      const minsAfter = Math.floor(r() * 5 * 3600); // up to 5h later, in seconds
      list.push({
        id: `seed-${tipId}-${i}`,
        tipId,
        userId: author.id,
        authorName: author.displayName,
        authorAvatar: author.avatar || null,
        content,
        createdAt: new Date(baseTime + minsAfter * 1000).toISOString(),
      });
    }
    list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
  s.seededComments.set(tipId, list);
}
