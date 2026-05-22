// Community feed store — MySQL-backed with in-memory fallback when DB is unavailable.

import { query, getPool } from './db';
import { dispatchNotification, dispatchToMany } from './notification-dispatcher';
import { listFollowersOfTipster } from './follows-store';

export interface FeedPost {
  id: string;
  userId: number;
  authorName: string;
  authorUsername?: string | null;
  authorRole?: string | null;
  authorAvatar?: string | null;
  content: string;
  matchId?: string | null;
  matchTitle?: string | null;
  pick?: string | null;
  odds?: number | null;
  imageUrl?: string | null;
  roomId?: number | null;
  likes: number;
  commentCount: number;
  liked?: boolean;
  createdAt: string;
  hashtags?: string[];
}

// ─── HASHTAG HELPERS ──────────────────────────────────────────────────────────
export function extractHashtags(content: string): string[] {
  const matches = content.match(/#([a-zA-Z][a-zA-Z0-9_]{0,49})/g) ?? [];
  return [...new Set(matches.map(h => h.slice(1).toLowerCase()))].slice(0, 10);
}

async function storeHashtags(postId: string, content: string): Promise<void> {
  if (!hasDb()) return;
  const tags = extractHashtags(content);
  for (const tag of tags) {
    await query(
      `INSERT IGNORE INTO feed_hashtags (tag, post_id, created_at) VALUES (?, ?, NOW())`,
      [tag, postId]
    ).catch(() => {});
  }
}

export async function getTrendingHashtags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
  if (!hasDb()) return [];
  try {
    const r = await query<{ tag: string; count: number }>(
      `SELECT tag, COUNT(*) AS count
       FROM feed_hashtags
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY tag
       ORDER BY count DESC
       LIMIT ?`,
      [limit]
    );
    return r.rows;
  } catch { return []; }
}

export async function listPostsByHashtag(tag: string, limit = 50, viewerId?: number | null): Promise<FeedPost[]> {
  if (!hasDb()) return [];
  try {
    const r = await query<{
      id: string; user_id: number; author_name: string; author_avatar: string | null;
      content: string; match_id: string | null; match_title: string | null;
      pick: string | null; odds: number | null; image_url: string | null;
      likes: number; comment_count: number; created_at: string;
      author_role: string | null; author_username: string | null; hashtags: string | null;
    }>(
      `SELECT fp.id, fp.user_id, fp.author_name, fp.author_avatar, fp.content,
              fp.match_id, fp.match_title, fp.pick, fp.odds, fp.image_url,
              fp.likes, fp.comment_count, fp.created_at,
              u.role AS author_role, u.username AS author_username,
              GROUP_CONCAT(fh2.tag ORDER BY fh2.id SEPARATOR ',') AS hashtags
       FROM feed_posts fp
       JOIN feed_hashtags fh ON fh.post_id = fp.id AND fh.tag = ?
       LEFT JOIN feed_hashtags fh2 ON fh2.post_id = fp.id
       LEFT JOIN users u ON u.id = fp.user_id
       GROUP BY fp.id
       ORDER BY fp.created_at DESC
       LIMIT ?`,
      [tag.toLowerCase(), limit]
    );
    let likedSet = new Set<string>();
    if (viewerId && r.rows.length > 0) {
      const ids = r.rows.map(p => p.id);
      const placeholders = ids.map(() => '?').join(',');
      const lr = await query<{ post_id: string }>(
        `SELECT post_id FROM feed_post_likes WHERE user_id = ? AND post_id IN (${placeholders})`,
        [viewerId, ...ids]
      );
      likedSet = new Set(lr.rows.map(x => x.post_id));
    }
    return r.rows.map(x => ({
      id: x.id, userId: x.user_id, authorName: x.author_name, authorAvatar: x.author_avatar,
      authorRole: x.author_role, authorUsername: x.author_username,
      content: x.content, matchId: x.match_id, matchTitle: x.match_title, pick: x.pick,
      odds: x.odds, imageUrl: x.image_url, likes: x.likes || 0, commentCount: x.comment_count || 0,
      liked: likedSet.has(x.id),
      hashtags: x.hashtags ? x.hashtags.split(',') : [],
      createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
    }));
  } catch (e) {
    console.error('[feed] listPostsByHashtag error:', e);
    return [];
  }
}

export interface FeedComment {
  id: string;
  postId: string;
  userId: number;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  createdAt: string;
}

// ─── IN-MEMORY FALLBACK ───────────────────────────────────────────────────────
interface MemStore {
  posts: FeedPost[];
  comments: FeedComment[];
  likes: Map<string, Set<number>>; // postId → set of userIds
}

const gm = globalThis as { __feedMem?: MemStore };
if (!gm.__feedMem) {
  gm.__feedMem = { posts: [], comments: [], likes: new Map() };
}
const mem = gm.__feedMem;

function hasDb(): boolean {
  return !!getPool();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitise(str: string | null | undefined): string | null {
  if (!str) return str ?? null;
  return str.replace(/[\uD800-\uDFFF]/g, '');
}

// ─── TABLE INIT ───────────────────────────────────────────────────────────────
async function ensureFeedHashtagsTable(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS feed_hashtags (
      id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      tag        VARCHAR(50)  NOT NULL,
      post_id    VARCHAR(64)  NOT NULL,
      created_at DATETIME     NOT NULL DEFAULT NOW(),
      INDEX idx_fh_tag     (tag),
      INDEX idx_fh_post_id (post_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    [],
  );
}

async function ensureCommunityRoomsTable(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS community_rooms (
      id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(80) NOT NULL,
      slug        VARCHAR(80) NOT NULL,
      description TEXT DEFAULT NULL,
      icon        VARCHAR(10) DEFAULT NULL,
      color       VARCHAR(80) DEFAULT NULL,
      post_count  INT NOT NULL DEFAULT 0,
      sort_order  INT NOT NULL DEFAULT 0,
      is_active   TINYINT(1) NOT NULL DEFAULT 1,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_room_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    [],
  );
  // Seed defaults
  await query(
    `INSERT IGNORE INTO community_rooms (name, slug, description, icon, color, sort_order) VALUES
      ('General',       'general',    'General betting chat',                '💬', 'bg-blue-500/15 text-blue-500 border-blue-500/30',        1),
      ('Football Tips', 'football',   'Football predictions & analysis',     '⚽', 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',2),
      ('Value Bets',    'value-bets', 'High value picks & odds hunting',     '🎯', 'bg-amber-500/15 text-amber-600 border-amber-500/30',     3),
      ('Live Chat',     'live-chat',  'Chat during live matches',            '🔴', 'bg-rose-500/15 text-rose-500 border-rose-500/30',        4),
      ('Analysis',      'analysis',   'Deep dives, stats and breakdowns',    '📊', 'bg-purple-500/15 text-purple-600 border-purple-500/30',  5),
      ('Basketball',    'basketball', 'NBA, EuroLeague & more',              '🏀', 'bg-orange-500/15 text-orange-600 border-orange-500/30',  6),
      ('Premium Picks', 'premium',    'Top tipster premium predictions',     '👑', 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',  7)`,
    [],
  ).catch(() => {});
  // Add room_id column to feed_posts if not present
  await query(`ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS room_id INT DEFAULT NULL`, []).catch(() => {});
  await query(`ALTER TABLE feed_posts ADD INDEX IF NOT EXISTS idx_fp_room_id (room_id)`, []).catch(() => {});
}

export interface CommunityRoom {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  postCount: number;
  sortOrder: number;
}

const DEFAULT_ROOMS: CommunityRoom[] = [
  { id: 1, name: 'General',       slug: 'general',    description: 'General betting chat',             icon: '💬', color: 'bg-blue-500/15 text-blue-500 border-blue-500/30',        postCount: 0, sortOrder: 1 },
  { id: 2, name: 'Football Tips', slug: 'football',   description: 'Football predictions & analysis',  icon: '⚽', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', postCount: 0, sortOrder: 2 },
  { id: 3, name: 'Value Bets',    slug: 'value-bets', description: 'High value picks & odds hunting',  icon: '🎯', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30',      postCount: 0, sortOrder: 3 },
  { id: 4, name: 'Live Chat',     slug: 'live-chat',  description: 'Chat during live matches',         icon: '🔴', color: 'bg-rose-500/15 text-rose-500 border-rose-500/30',          postCount: 0, sortOrder: 4 },
  { id: 5, name: 'Analysis',      slug: 'analysis',   description: 'Deep dives, stats and breakdowns', icon: '📊', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30',   postCount: 0, sortOrder: 5 },
  { id: 6, name: 'Basketball',    slug: 'basketball', description: 'NBA, EuroLeague & more',           icon: '🏀', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30',   postCount: 0, sortOrder: 6 },
  { id: 7, name: 'Premium Picks', slug: 'premium',    description: 'Top tipster premium predictions',  icon: '👑', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',   postCount: 0, sortOrder: 7 },
];

export async function listRooms(): Promise<CommunityRoom[]> {
  if (!hasDb()) return DEFAULT_ROOMS;
  try {
    const r = await query<{
      id: number; name: string; slug: string; description: string | null;
      icon: string | null; color: string | null; post_count: number; sort_order: number;
    }>(
      `SELECT id, name, slug, description, icon, color, post_count, sort_order
       FROM community_rooms WHERE is_active = 1 ORDER BY sort_order ASC`,
      [],
    ).catch(async (e: { code?: string }) => {
      if (e?.code === 'ER_NO_SUCH_TABLE') {
        await ensureCommunityRoomsTable();
        return query<{ id: number; name: string; slug: string; description: string | null; icon: string | null; color: string | null; post_count: number; sort_order: number }>(
          `SELECT id, name, slug, description, icon, color, post_count, sort_order
           FROM community_rooms WHERE is_active = 1 ORDER BY sort_order ASC`,
          [],
        );
      }
      throw e;
    });
    return r.rows.map(x => ({
      id: x.id, name: x.name, slug: x.slug, description: x.description,
      icon: x.icon, color: x.color, postCount: x.post_count, sortOrder: x.sort_order,
    }));
  } catch { return DEFAULT_ROOMS; }
}

export async function listPostsByRoom(roomSlug: string, limit = 50, viewerId?: number | null): Promise<FeedPost[]> {
  if (!hasDb()) return [];
  try {
    const room = await query<{ id: number }>(
      `SELECT id FROM community_rooms WHERE slug = ? AND is_active = 1 LIMIT 1`, [roomSlug]);
    if (!room.rows[0]) return [];
    const roomId = room.rows[0].id;
    const r = await query<PostRow>(
      `SELECT fp.id, fp.user_id, fp.author_name, fp.author_avatar, fp.content,
              fp.match_id, fp.match_title, fp.pick, fp.odds, fp.image_url,
              fp.likes, fp.comment_count, fp.created_at,
              u.role AS author_role, u.username AS author_username,
              GROUP_CONCAT(fh.tag ORDER BY fh.id SEPARATOR ',') AS hashtags
       FROM feed_posts fp
       LEFT JOIN users u ON u.id = fp.user_id
       LEFT JOIN feed_hashtags fh ON fh.post_id = fp.id
       WHERE fp.room_id = ?
       GROUP BY fp.id
       ORDER BY fp.created_at DESC LIMIT ?`,
      [roomId, limit],
    );
    let likedSet = new Set<string>();
    if (viewerId && r.rows.length > 0) {
      const ids = r.rows.map(p => p.id);
      const placeholders = ids.map(() => '?').join(',');
      const lr = await query<{ post_id: string }>(
        `SELECT post_id FROM feed_post_likes WHERE user_id = ? AND post_id IN (${placeholders})`,
        [viewerId, ...ids],
      );
      likedSet = new Set(lr.rows.map(x => x.post_id));
    }
    return mapPostRows(r.rows, likedSet);
  } catch (e) {
    console.error('[feed] listPostsByRoom error:', e);
    return [];
  }
}

// ─── POSTS ───────────────────────────────────────
type PostRow = {
  id: string; user_id: number; author_name: string; author_avatar: string | null;
  content: string; match_id: string | null; match_title: string | null;
  pick: string | null; odds: number | null; image_url: string | null;
  room_id: number | null;
  likes: number; comment_count: number; created_at: string;
  author_role: string | null; author_username: string | null; hashtags: string | null;
};

function mapPostRows(rows: PostRow[], likedSet: Set<string>): FeedPost[] {
  return rows.map(x => ({
    id: x.id, userId: x.user_id, authorName: x.author_name, authorAvatar: x.author_avatar,
    authorRole: x.author_role, authorUsername: x.author_username,
    content: x.content, matchId: x.match_id, matchTitle: x.match_title, pick: x.pick,
    odds: x.odds, imageUrl: x.image_url, roomId: x.room_id ?? null,
    likes: x.likes || 0, commentCount: x.comment_count || 0,
    liked: likedSet.has(x.id),
    hashtags: x.hashtags ? x.hashtags.split(',') : [],
    createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
  }));
}

export async function listPosts(limit = 50, viewerId?: number | null): Promise<FeedPost[]> {
  if (hasDb()) {
    try {
      let r = await query<PostRow>(
        `SELECT fp.id, fp.user_id, fp.author_name, fp.author_avatar, fp.content,
                 fp.match_id, fp.match_title, fp.pick, fp.odds, fp.image_url,
                 fp.room_id,
                 fp.likes, fp.comment_count, fp.created_at,
                 u.role AS author_role, u.username AS author_username,
                 GROUP_CONCAT(fh.tag ORDER BY fh.id SEPARATOR ',') AS hashtags
          FROM feed_posts fp
          LEFT JOIN users u ON u.id = fp.user_id
          LEFT JOIN feed_hashtags fh ON fh.post_id = fp.id
          GROUP BY fp.id
          ORDER BY fp.created_at DESC LIMIT ?`,
        [limit],
      ).catch(async (e: { code?: string }) => {
        if (e?.code === 'ER_NO_SUCH_TABLE') {
          console.log('[feed] feed_hashtags table missing — creating it now');
          await ensureFeedHashtagsTable().catch(() => {});
          return query<PostRow>(
            `SELECT fp.id, fp.user_id, fp.author_name, fp.author_avatar, fp.content,
                     fp.match_id, fp.match_title, fp.pick, fp.odds, fp.image_url,
                     NULL AS room_id,
                     fp.likes, fp.comment_count, fp.created_at,
                     u.role AS author_role, u.username AS author_username,
                     NULL AS hashtags
              FROM feed_posts fp
              LEFT JOIN users u ON u.id = fp.user_id
              ORDER BY fp.created_at DESC LIMIT ?`,
            [limit],
          );
        }
        throw e;
      });

      if (r.rows.length > 0) {
        let likedSet = new Set<string>();
        if (viewerId) {
          const ids = r.rows.map(p => p.id);
          const placeholders = ids.map(() => '?').join(',');
          const lr = await query<{ post_id: string }>(
            `SELECT post_id FROM feed_post_likes WHERE user_id = ? AND post_id IN (${placeholders})`,
            [viewerId, ...ids],
          );
          likedSet = new Set(lr.rows.map(x => x.post_id));
        }
        return mapPostRows(r.rows, likedSet);
      }
    } catch (e) {
      console.error('[feed] listPosts DB error:', e);
    }
  }
  // In-memory fallback
  const posts = mem.posts.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
  if (viewerId != null) {
    return posts.map(p => ({ ...p, liked: mem.likes.get(p.id)?.has(viewerId) ?? false }));
  }
  return posts;
}

export async function createPost(input: Omit<FeedPost, 'id' | 'likes' | 'commentCount' | 'createdAt'>): Promise<FeedPost> {
  const post: FeedPost = { id: makeId('post'), likes: 0, commentCount: 0, createdAt: new Date().toISOString(), ...input };

  if (hasDb()) {
    try {
      await query(
        `INSERT INTO feed_posts
          (id, user_id, author_name, author_avatar, content, match_id, match_title,
           pick, odds, image_url, room_id, likes, comment_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW())`,
        [post.id, post.userId, sanitise(post.authorName), post.authorAvatar || null,
         sanitise(post.content),
         post.matchId || null, sanitise(post.matchTitle), sanitise(post.pick),
         post.odds || null, post.imageUrl || null, post.roomId ?? null],
      );
      // Store hashtags extracted from content (non-blocking)
      void storeHashtags(post.id, post.content ?? '');
      // DB succeeded — don't duplicate in memory
    } catch (e) {
      // DB write failed — log loudly and propagate rather than silently
      // falling back to memory (which would lose data on next server restart).
      console.error('[feed] createPost DB write failed:', (e as Error).message);
      throw e;
    }
  } else {
    mem.posts.unshift(post);
    // Cap memory store at 200 posts
    if (mem.posts.length > 200) mem.posts.length = 200;
  }

  try {
    const followers = await listFollowersOfTipster(post.userId);
    if (followers.length > 0) {
      void dispatchToMany(followers, { type: 'tipster_post', title: `${post.authorName} posted`, content: post.content.length > 140 ? `${post.content.slice(0, 140)}…` : post.content, link: `/feed#${post.id}` });
    }
  } catch (e) { console.warn('[feed] post fan-out failed', e); }
  return post;
}

export async function deletePost(postId: string): Promise<void> {
  if (hasDb()) {
    await query(`DELETE FROM feed_post_likes WHERE post_id = ?`, [postId]);
    await query(`DELETE FROM feed_comments WHERE post_id = ?`, [postId]);
    await query(`DELETE FROM feed_posts WHERE id = ?`, [postId]);
  } else {
    const idx = mem.posts.findIndex(p => p.id === postId);
    if (idx !== -1) mem.posts.splice(idx, 1);
    mem.comments = mem.comments.filter(c => c.postId !== postId);
    mem.likes.delete(postId);
  }
}

// ─── LIKES ───────────────────────────────────────
export async function toggleLike(postId: string, userId: number, likerName?: string): Promise<{ liked: boolean; likes: number }> {
  if (hasDb()) {
    try {
      const existing = await query<{ id: number }>(
        `SELECT id FROM feed_post_likes WHERE post_id = ? AND user_id = ? LIMIT 1`, [postId, userId]);
      let liked: boolean;
      if (existing.rows.length > 0) {
        await query(`DELETE FROM feed_post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId]);
        await query(`UPDATE feed_posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?`, [postId]);
        liked = false;
      } else {
        await query(`INSERT IGNORE INTO feed_post_likes (post_id, user_id, created_at) VALUES (?, ?, NOW())`, [postId, userId]);
        await query(`UPDATE feed_posts SET likes = likes + 1 WHERE id = ?`, [postId]);
        liked = true;
      }
      const r = await query<{ likes: number; user_id: number; content: string }>(
        `SELECT likes, user_id, content FROM feed_posts WHERE id = ? LIMIT 1`, [postId]);
      const likes = r.rows[0]?.likes ?? 0;
      if (liked && r.rows[0] && r.rows[0].user_id !== userId) {
        const content = r.rows[0].content;
        void dispatchNotification({ userId: r.rows[0].user_id, type: 'post_like', title: `${likerName || 'Someone'} liked your post`, content: content.length > 100 ? `${content.slice(0, 100)}…` : content, link: `/feed#${postId}` }).catch(e => console.warn('[feed] like notify failed', e));
      }
      return { liked, likes };
    } catch {}
  }
  // Memory fallback
  const likers = mem.likes.get(postId) ?? new Set<number>();
  let liked: boolean;
  if (likers.has(userId)) { likers.delete(userId); liked = false; }
  else { likers.add(userId); liked = true; }
  mem.likes.set(postId, likers);
  const post = mem.posts.find(p => p.id === postId);
  if (post) post.likes = likers.size;
  return { liked, likes: likers.size };
}

// ─── COMMENTS ────────────────────────────────────
export async function listComments(postId: string): Promise<FeedComment[]> {
  if (hasDb()) {
    try {
      const r = await query<{
        id: string; post_id: string; user_id: number; author_name: string;
        author_avatar: string | null; content: string; created_at: string;
      }>(
        `SELECT id, post_id, user_id, author_name, author_avatar, content, created_at
         FROM feed_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 100`,
        [postId]
      );
      if (r.rows.length > 0 || !mem.comments.some(c => c.postId === postId)) {
        return r.rows.map(x => ({
          id: x.id, postId: x.post_id, userId: x.user_id,
          authorName: x.author_name, authorAvatar: x.author_avatar,
          content: x.content,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch (e) {
      console.error('[feed] listComments DB error:', e);
    }
  }
  return mem.comments.filter(c => c.postId === postId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function addComment(input: Omit<FeedComment, 'id' | 'createdAt'>): Promise<FeedComment> {
  const comment: FeedComment = { id: makeId('cmt'), createdAt: new Date().toISOString(), ...input };

  if (hasDb()) {
    try {
      await query(
        `INSERT INTO feed_comments (id, post_id, user_id, author_name, author_avatar, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [comment.id, comment.postId, comment.userId, sanitise(comment.authorName), comment.authorAvatar || null, sanitise(comment.content)]
      );
      await query(`UPDATE feed_posts SET comment_count = comment_count + 1 WHERE id = ?`, [comment.postId]);
    } catch {
      mem.comments.push(comment);
      const post = mem.posts.find(p => p.id === comment.postId);
      if (post) post.commentCount++;
    }
  } else {
    mem.comments.push(comment);
    const post = mem.posts.find(p => p.id === comment.postId);
    if (post) post.commentCount++;
  }

  try {
    if (hasDb()) {
      const r = await query<{ user_id: number; content: string }>(
        `SELECT user_id, content FROM feed_posts WHERE id = ? LIMIT 1`, [comment.postId]);
      if (r.rows[0] && r.rows[0].user_id !== comment.userId) {
        void dispatchNotification({ userId: r.rows[0].user_id, type: 'post_comment', title: `${comment.authorName} commented on your post`, content: comment.content, link: `/feed` }).catch(() => {});
      }
    } else {
      const post = mem.posts.find(p => p.id === comment.postId);
      if (post && post.userId !== comment.userId) {
        void dispatchNotification({ userId: post.userId, type: 'post_comment', title: `${comment.authorName} commented on your post`, content: comment.content, link: `/feed` }).catch(() => {});
      }
    }
  } catch { /* notification is non-critical */ }
  return comment;
}

export const createComment = addComment;

export async function deleteComment(commentId: string): Promise<boolean> {
  if (hasDb()) {
    try {
      const r = await query<{ post_id: string }>(
        `SELECT post_id FROM feed_comments WHERE id = ? LIMIT 1`, [commentId]);
      const postId = r.rows[0]?.post_id;
      const del = await query(`DELETE FROM feed_comments WHERE id = ?`, [commentId]);
      if ((del.affectedRows ?? 0) > 0 && postId) {
        await query(`UPDATE feed_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?`, [postId]).catch(() => {});
        return true;
      }
    } catch {}
  }
  const idx = mem.comments.findIndex(c => c.id === commentId);
  if (idx !== -1) {
    const postId = mem.comments[idx].postId;
    mem.comments.splice(idx, 1);
    const post = mem.posts.find(p => p.id === postId);
    if (post) post.commentCount = Math.max(0, post.commentCount - 1);
    return true;
  }
  return false;
}

export async function listAllComments(limit = 100): Promise<FeedComment[]> {
  if (hasDb()) {
    try {
      const r = await query<{
        id: string; post_id: string; user_id: number;
        author_name: string; author_avatar: string | null;
        content: string; created_at: string;
      }>(`SELECT id, post_id, user_id, author_name, author_avatar, content, created_at
          FROM feed_comments ORDER BY created_at DESC LIMIT ?`, [limit]);
      if (r.rows.length > 0) {
        return r.rows.map(row => ({
          id: row.id, postId: row.post_id, userId: row.user_id,
          authorName: row.author_name, authorAvatar: row.author_avatar,
          content: row.content, createdAt: row.created_at,
        }));
      }
    } catch (e) {
      console.error('[feed] listAllComments DB error:', e);
    }
  }
  return mem.comments.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
}
