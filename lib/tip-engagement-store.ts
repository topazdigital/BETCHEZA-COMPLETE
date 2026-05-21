import { execute, query, getPool } from './db';

// ─── TYPES ───────────────────────────────────────
interface EngagementStores {
  likes: Map<string, Set<number>>;
  dislikes: Map<string, Set<number>>;
  comments: Map<string, TipCommentRow[]>;
}

export interface TipCommentRow {
  id: string;
  tipId: string;
  userId: number;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

// ─── STATE ────────────────────────────────────────
const g = globalThis as { __tipEngagement?: EngagementStores };
if (!g.__tipEngagement) {
  g.__tipEngagement = { likes: new Map(), dislikes: new Map(), comments: new Map() };
}
const s = g.__tipEngagement;

function hasDb(): boolean {
  return !!getPool();
}

// ─── COMMENT TEMPLATES ────────────────────────────
export const COMMENT_TEMPLATES = [
  "Solid analysis, I'm on this one too!",
  "Great pick, the form supports it.",
  "I've been watching this team closely — agree with the call.",
  "Interesting take, odds look good value here.",
  "This aligns with what I'm seeing in the stats.",
  "Good read on the match-up, following this tip.",
  "I like the thinking behind this, backing it.",
  "Value tip right here, well spotted.",
  "The head-to-head numbers back this up.",
  "Sharp analysis, I'm in agreement.",
  "Love the reasoning — this market is underpriced.",
  "Been tracking this league all season, tip makes sense.",
  "Confidence backed by data, I'll follow this one.",
  "This is exactly the edge I was looking for.",
  "Strong pick — the market hasn't priced this right.",
  "Agree with the analysis, odds are generous.",
  "Good spot, I was leaning the same way.",
  "The recent form tells the same story, well played.",
  "Tactical insight is on point here.",
  "I trust this tipster's track record, going in.",
  "Bookies haven't adjusted yet — good time to get on.",
  "Same read on my end. The price is too big.",
  "Late team news helps this selection even more.",
  "Seen this pattern play out three times this season already.",
  "Form chart says the same thing. Confident follow.",
  "Weather conditions favour this pick — smart angle.",
  "Checked the xG data too, fully agree with the call.",
  "Disciplined pick given the context. Backing it.",
  "Nice value here. The public has it wrong.",
  "Got on at slightly better odds — both ways value.",
  "Away form is often overlooked. Good spot.",
  "Referee stats support this selection too.",
  "Injury to their key midfielder changes everything.",
  "Manager rotation pattern confirmed this is the right call.",
  "Market moved my way already — still got juice left.",
  "Their defensive record away from home is shocking.",
  "Followed this tipster's last 10 picks, on a roll.",
  "Home crowd advantage is massive here, backing the hosts.",
  "This league has a clear trend for overs this month.",
  "Took a bit more stake on this one, confident it lands.",
  "Their top scorer is back fit — changes the dynamic.",
  "Road record is underrated, this side travels well.",
  "Early-season blip behind them, back to full strength now.",
  "Love this market. Undervalued by at least 15%.",
  "Momentum is everything in this competition. Right side here.",
  "Followed the line movement, syndicates are on this.",
  "Classic bounce-back game after last week's loss.",
  "Closing line says the same thing. Sharp play.",
  "This one jumped out at me from the model too.",
  "Double chance makes sense at these odds, less variance.",
  "Clean sheets in 3 of last 4 away, back the under.",
];

// ─── CONTEXTUAL COMMENT GENERATORS ───────────────
const FAKE_AUTHORS = [
  'BetSmart_Ke', 'TipKing254', 'OddsWatcher', 'PuntPro', 'SportsFan',
  'SharpBettor', 'DataDriven', 'FormGuide', 'ValueHunter', 'AccaKing',
  'MatchAnalyst', 'NairobiNaps', 'MombasaBets', 'KisumeTips', 'NakuruPicks',
  'EPLExpert', 'LaLigaLens', 'BundesligaBet', 'Serie_A_Pro', 'ChampionsEdge',
  'GoalMachine', 'CleanSheet', 'BothTeams', 'OverUnder', 'AsianHandicap',
];

function buildContextComment(
  rand: () => number,
  home: string,
  away: string,
  market: string,
  league?: string,
): string {
  const contextual = [
    `${home} at home in this form — the price is wrong. On it.`,
    `${away}'s away record tells the real story. Good spot.`,
    `Both ${home} and ${away} have been scoring freely lately.`,
    `${home} haven't lost at home in 6 — market is slow to price that.`,
    `${away} travel in terrible form. ${home} should take this.`,
    `${league ? league + ' ' : ''}fixtures like this tend to go one way — backing the tip.`,
    `Checked the H2H for ${home} vs ${away}. Makes sense.`,
    `${market} is exactly what I was looking for in this game.`,
    `${home} line-up looks strong. Good value at these odds.`,
    `${away} have key players suspended — changes the picture completely.`,
    `Been watching ${home} closely this campaign, fully agree.`,
    `This ${market} selection in ${league || 'this fixture'} is the move.`,
    `Spotted the same thing on the line. Solid value.`,
    `${home} vs ${away} — ${market} has paid out in 4 of their last 5 meetings.`,
    `The stats on both sides scream ${market}. No brainer.`,
  ];
  return contextual[Math.floor(rand() * contextual.length)];
}

// ─── LIKES ────────────────────────────────────────
const FAKE_LIKE_SEED: Record<string, number> = {};
function getBaseline(tipId: string): number {
  if (FAKE_LIKE_SEED[tipId] === undefined) {
    let h = 0;
    for (const c of tipId) h = ((h << 5) - h) + c.charCodeAt(0);
    FAKE_LIKE_SEED[tipId] = 3 + (Math.abs(h) % 28);
  }
  return FAKE_LIKE_SEED[tipId];
}

export async function getLikeCount(tipId: string, viewerId?: number): Promise<{ count: number; liked: boolean }> {
  const baseline = getBaseline(tipId);
  if (hasDb()) {
    try {
      const r = await query<{ c: string; liked: string }>(
        `SELECT COUNT(*) AS c,
                SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS liked
         FROM tip_likes WHERE tip_id = ?`,
        [viewerId ?? 0, tipId]
      );
      const dbCount = Number(r.rows[0]?.c ?? 0);
      const liked = Number(r.rows[0]?.liked ?? 0) > 0;
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
      await execute(`INSERT INTO tip_likes (tip_id, user_id, created_at) VALUES (?, ?, NOW()) ON CONFLICT (tip_id, user_id) DO NOTHING`, [tipId, userId]);
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
      await execute(`DELETE FROM tip_likes WHERE tip_id = ? AND user_id = ?`, [tipId, userId]);
      return getLikeCount(tipId, userId);
    } catch { /* fall through */ }
  }
  const set = s.likes.get(tipId);
  if (set) { set.delete(userId); }
  return getLikeCount(tipId, userId);
}

/** Override the auto-generated baseline like count for a tip (used by tips route). */
const OVERRIDE_BASELINE: Record<string, number> = {};
export function setBaselineLikes(tipId: string, count: number): void {
  OVERRIDE_BASELINE[tipId] = count;
}

// ─── COMMENTS ────────────────────────────────────
export async function getComments(tipId: string): Promise<TipCommentRow[]> {
  if (hasDb()) {
    try {
      const r = await query<{
        id: string; tip_id: string; user_id: number; author_name: string;
        author_avatar: string | null; content: string; created_at: string;
      }>(
        `SELECT id, tip_id, user_id, author_name, author_avatar, content, created_at
         FROM tip_comments WHERE tip_id = ? ORDER BY created_at ASC LIMIT 100`,
        [tipId]
      );
      if (r.rows.length > 0) {
        return r.rows.map(x => ({
          id: x.id,
          tipId: x.tip_id,
          userId: x.user_id,
          authorName: x.author_name,
          authorAvatar: x.author_avatar ?? undefined,
          content: x.content,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch { /* fall through */ }
  }
  return s.comments.get(tipId) ?? [];
}

export async function getCommentCount(tipId: string): Promise<number> {
  if (hasDb()) {
    try {
      const r = await query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM tip_comments WHERE tip_id = ?`,
        [tipId]
      );
      return Number(r.rows[0]?.c ?? 0);
    } catch { /* fall through */ }
  }
  return (s.comments.get(tipId) ?? []).length;
}

export async function addComment(tipId: string, userId: number, authorName: string, content: string, authorAvatar?: string): Promise<TipCommentRow> {
  const id = `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const comment: TipCommentRow = { id, tipId, userId, authorName, authorAvatar, content, createdAt: new Date().toISOString() };
  if (hasDb()) {
    try {
      await execute(
        `INSERT INTO tip_comments (id, tip_id, user_id, author_name, author_avatar, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [id, tipId, userId, authorName, authorAvatar || null, content]
      );
    } catch { /* fall through */ }
  }
  const list = s.comments.get(tipId) ?? [];
  list.push(comment);
  s.comments.set(tipId, list);
  return comment;
}

// ─── SEEDING ─────────────────────────────────────
interface SeedContext {
  likes?: number;
  comments?: number;
  tipsters?: Array<{ id: number; username: string; displayName: string; avatar?: string }>;
  homeTeam?: string;
  awayTeam?: string;
  venue?: string;
  confidence?: number;
  createdAt?: string;
  league?: string;
  market?: string;
  odds?: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

export async function seedTipEngagement(tipId: string, ctx: SeedContext | number = 3): Promise<void> {
  if (hasDb()) return;
  const existing = s.likes.get(tipId);
  if (existing && existing.size > 0) return;

  const numericCount = typeof ctx === 'number' ? ctx : (ctx.likes ?? 3);
  const rand = rng(hashStr(tipId));

  const fakeSet = new Set<number>();
  for (let i = 0; i < numericCount; i++) {
    fakeSet.add(-(1000 + i));
  }
  s.likes.set(tipId, fakeSet);

  const existing2 = s.comments.get(tipId);
  if (existing2 && existing2.length > 0) return;

  const richCtx = typeof ctx === 'object' ? ctx : {};
  const commentCount = typeof ctx === 'object'
    ? Math.min(ctx.comments ?? 2, 5)
    : 1 + (Math.abs(tipId.charCodeAt(0) ?? 0) % 3);

  const home = richCtx.homeTeam || '';
  const away = richCtx.awayTeam || '';
  const market = richCtx.market || '';
  const league = richCtx.league || '';
  const baseTs = richCtx.createdAt ? new Date(richCtx.createdAt).getTime() : Date.now();

  // Build a pool of potential authors: fake tipsters + generic author names
  const tipsterAuthors = (richCtx.tipsters || []).map(t => ({
    name: t.displayName,
    avatar: t.avatar,
    id: t.id,
  }));
  const genericAuthors = FAKE_AUTHORS.map((name, i) => ({ name, avatar: undefined, id: -(3000 + i) }));
  const authorPool = [...tipsterAuthors, ...genericAuthors];

  const fakeComments: TipCommentRow[] = [];
  const usedAuthors = new Set<string>();

  for (let i = 0; i < commentCount; i++) {
    // Pick a unique author per comment
    let author = authorPool[Math.floor(rand() * authorPool.length)];
    let tries = 0;
    while (usedAuthors.has(author.name) && tries < 20) {
      author = authorPool[Math.floor(rand() * authorPool.length)];
      tries++;
    }
    usedAuthors.add(author.name);

    // Mix contextual and generic comments
    const useContextual = home && away && rand() > 0.4;
    const content = useContextual
      ? buildContextComment(rand, home, away, market, league)
      : COMMENT_TEMPLATES[Math.floor(rand() * COMMENT_TEMPLATES.length)];

    // Spread timestamps naturally after the tip was created
    const minutesLater = Math.floor(rand() * 120) + i * 15;
    const createdAt = new Date(baseTs + minutesLater * 60_000).toISOString();

    fakeComments.push({
      id: `fake_${tipId}_${i}`,
      tipId,
      userId: author.id,
      authorName: author.name,
      authorAvatar: author.avatar,
      content,
      createdAt,
    });
  }
  // Sort by timestamp ascending
  fakeComments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  s.comments.set(tipId, fakeComments);
}

// ─── ALIASES ─────────────────────────────────────
export const listComments = getComments;
