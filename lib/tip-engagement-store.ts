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
  "I've been watching this team closely, agree with the call.",
  "Interesting take — odds look good value here.",
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
];

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
                SUM(CASE WHEN user_id = $1 THEN 1 ELSE 0 END) AS liked
         FROM tip_likes WHERE tip_id = $2`,
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
         FROM tip_comments WHERE tip_id = $1 ORDER BY created_at ASC LIMIT 100`,
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
        `SELECT COUNT(*) AS c FROM tip_comments WHERE tip_id = $1`,
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
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
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
export async function seedTipEngagement(tipId: string, count = 3): Promise<void> {
  if (hasDb()) return;
  const existing = s.likes.get(tipId);
  if (existing && existing.size > 0) return;
  const fakeSet = new Set<number>();
  for (let i = 0; i < count; i++) {
    fakeSet.add(-(1000 + i));
  }
  s.likes.set(tipId, fakeSet);

  const existing2 = s.comments.get(tipId);
  if (existing2 && existing2.length > 0) return;
  const commentCount = 1 + (Math.abs(tipId.charCodeAt(0) ?? 0) % 3);
  const fakeComments: TipCommentRow[] = [];
  for (let i = 0; i < commentCount; i++) {
    const idx = Math.abs((tipId.charCodeAt(i % tipId.length) ?? 0) + i) % COMMENT_TEMPLATES.length;
    fakeComments.push({
      id: `fake_${tipId}_${i}`,
      tipId,
      userId: -(2000 + i),
      authorName: ['SportsFan', 'BetSmarter', 'TipKing', 'OddsWatcher', 'PuntPro'][i % 5],
      content: COMMENT_TEMPLATES[idx],
      createdAt: new Date(Date.now() - (commentCount - i) * 600_000).toISOString(),
    });
  }
  s.comments.set(tipId, fakeComments);
}
