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
  likes: Map<string, Set<number>>;
  comments: Map<string, TipComment[]>;
  baseline: Map<string, number>;
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

const hasDb = () => !!(process.env.DATABASE_URL || process.env.MYSQL_URL);

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
      const r = await query<{ c: number }>(`SELECT COUNT(*) as c FROM tip_likes WHERE tip_id = ?`, [tipId]);
      const dbCount = Number(r.rows[0]?.c || 0);
      let liked = false;
      if (viewerId) {
        const lr = await query<{ user_id: number }>(`SELECT user_id FROM tip_likes WHERE tip_id = ? AND user_id = ? LIMIT 1`, [tipId, viewerId]);
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
  set?.delete(userId);
  return getLikeCount(tipId, userId);
}

// ─── COMMENTS ────────────────────────────────────────────────────────

export async function listComments(tipId: string, limit = 50): Promise<TipComment[]> {
  let real: TipComment[] = [];
  if (hasDb()) {
    try {
      const r = await query<{ id: string; tip_id: string; user_id: number; author_name: string; author_avatar: string | null; content: string; created_at: string | Date }>(
        `SELECT id, tip_id, user_id, author_name, author_avatar, content, created_at
         FROM tip_comments WHERE tip_id = ? ORDER BY created_at ASC LIMIT ?`,
        [tipId, limit],
      );
      real = r.rows.map(x => ({
        id: x.id,
        tipId: x.tip_id,
        userId: x.user_id,
        authorName: x.author_name,
        authorAvatar: x.author_avatar,
        content: x.content,
        createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
      }));
    } catch { /* fall through */ }
  } else {
    real = (s.comments.get(tipId) || []).slice(0, limit);
  }
  const seeded = s.seededComments.get(tipId) || [];
  return [...real, ...seeded].slice(0, limit);
}

export async function addComment(input: Omit<TipComment, 'id' | 'createdAt'>): Promise<TipComment> {
  const id = makeId();
  const createdAt = new Date().toISOString();
  if (hasDb()) {
    try {
      await execute(
        `INSERT INTO tip_comments (id, tip_id, user_id, author_name, author_avatar, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [id, input.tipId, input.userId, input.authorName, input.authorAvatar || null, input.content],
      );
      return { id, tipId: input.tipId, userId: input.userId, authorName: input.authorName, authorAvatar: input.authorAvatar, content: input.content, createdAt };
    } catch { /* fall through */ }
  }
  const c: TipComment = { id, ...input, createdAt };
  const arr = s.comments.get(input.tipId) || [];
  arr.push(c);
  s.comments.set(input.tipId, arr);
  return c;
}

export async function getCommentCount(tipId: string): Promise<number> {
  const seededN = (s.seededComments.get(tipId) || []).length;
  if (hasDb()) {
    try {
      const r = await query<{ c: number }>(`SELECT COUNT(*) as c FROM tip_comments WHERE tip_id = ?`, [tipId]);
      return Number(r.rows[0]?.c || 0) + seededN;
    } catch { /* fall through */ }
  }
  return (s.comments.get(tipId) || []).length + seededN;
}

// Seed fake/auto-generated comments (used by auto-tip system)
export function seedComments(tipId: string, comments: TipComment[]) {
  s.seededComments.set(tipId, comments);
}

// Full engagement seed: sets baseline likes AND generates fake comments.
// Called by auto-tips-store to initialise engagement on generated tips.
export function seedTipEngagement(tipId: string, opts: {
  likes: number;
  comments: number;
  tipsters: Array<{ id: string; username: string; displayName: string; avatar?: string | null }>;
  homeTeam?: string;
  awayTeam?: string;
  createdAt?: string;
  [k: string]: unknown;
}) {
  setBaselineLikes(tipId, opts.likes);

  const count = Math.min(opts.comments, COMMENT_TEMPLATES.length);
  if (count <= 0 || opts.tipsters.length === 0) return;

  const baseDate = opts.createdAt ? new Date(opts.createdAt) : new Date();
  const shuffledTemplates = [...COMMENT_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, count);
  const fakeComments: TipComment[] = shuffledTemplates.map((content, i) => {
    const tipster = opts.tipsters[i % opts.tipsters.length];
    const d = new Date(baseDate.getTime() + (i + 1) * 5 * 60 * 1000);
    return {
      id: `sc_${tipId}_${i}`,
      tipId,
      userId: -1,
      authorName: tipster.displayName || tipster.username,
      authorAvatar: tipster.avatar ?? null,
      content,
      createdAt: d.toISOString(),
    };
  });
  seedComments(tipId, fakeComments);
}

// COMMENT_TEMPLATES for auto-generated community engagement
export const COMMENT_TEMPLATES = [
  "Backing this one! The form's been outstanding lately.",
  "Solid analysis. I'm in on this pick.",
  "This market has value written all over it. Good find.",
  "Been watching this team closely — they're looking sharp right now.",
  "The odds aren't reflecting the true probability here. Smart bet.",
  "I like this pick, the home advantage is massive for this fixture.",
  "Form table says it all. Can't argue with this selection.",
  "Great pick — the defensive record has been rock solid.",
  "This is the right call. Midweek fatigue is a real factor here.",
  "Reasonable odds for what's essentially a banker. I'm on it.",
  "Their attacking stats this month have been elite. Expect goals.",
  "Can't fault this reasoning. Going with the same pick.",
  "Top-quality analysis as always. The stats back this up 100%.",
  "Interesting angle — hadn't considered the weather impact on this one.",
  "The head-to-head record here is telling. Smart pick.",
  "Both managers will set up cautiously — I'd add BTTS No as a side market.",
  "Value is there at these odds. Following this one.",
  "The injury news really swings this in their favour. Well spotted.",
  "Strong reasoning. I'm adding this to my accumulator.",
  "Watching the line movement, the sharp money is on the same side.",
  "This team always shows up in big games. Backing them with confidence.",
  "The xG numbers from recent games support this pick strongly.",
  "Late fitness doubts for key players changes things — this is the right call.",
  "Already placed this one. The timing on the odds was perfect.",
  "Their away record is elite this season. Agree with this tip.",
];
