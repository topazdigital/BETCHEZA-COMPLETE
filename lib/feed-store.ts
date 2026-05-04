// Community feed store — MySQL-backed with in-memory fallback.

import { query, getPool } from './db';
import { dispatchNotification, dispatchToMany } from './notification-dispatcher';
import { listFollowersOfTipster } from './follows-store';

export interface FeedPost {
  id: string;
  userId: number;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  matchId?: string | null;
  matchTitle?: string | null;
  pick?: string | null;
  odds?: number | null;
  imageUrl?: string | null;
  likes: number;
  commentCount: number;
  liked?: boolean;
  createdAt: string;
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

interface Stores {
  posts: Map<string, FeedPost>;
  comments: Map<string, FeedComment[]>;
  likes: Map<string, Set<number>>;
}

const g = globalThis as { __feedStore?: Stores };
g.__feedStore = g.__feedStore || { posts: new Map(), comments: new Map(), likes: new Map() };
const s = g.__feedStore;

const hasDb = () => !!getPool();

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── POSTS ───────────────────────────────────────
export async function listPosts(limit = 50, viewerId?: number | null): Promise<FeedPost[]> {
  if (hasDb()) {
    try {
      const r = await query<{
        id: string; user_id: number; author_name: string; author_avatar: string | null;
        content: string; match_id: string | null; match_title: string | null;
        pick: string | null; odds: number | null; image_url: string | null;
        likes: number; comment_count: number; created_at: string;
      }>(`SELECT id, user_id, author_name, author_avatar, content,
                 match_id, match_title, pick, odds, image_url,
                 likes, comment_count, created_at
          FROM feed_posts
          ORDER BY created_at DESC LIMIT ?`,
        [limit]);
      if (r.rows.length > 0) {
        const ids = r.rows.map(p => p.id);
        let likedSet = new Set<string>();
        if (viewerId && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          const lr = await query<{ post_id: string }>(
            `SELECT post_id FROM feed_post_likes WHERE user_id = ? AND post_id IN (${placeholders})`,
            [viewerId, ...ids],
          );
          likedSet = new Set(lr.rows.map(x => x.post_id));
        }
        return r.rows.map(x => ({
          id: x.id, userId: x.user_id, authorName: x.author_name, authorAvatar: x.author_avatar,
          content: x.content, matchId: x.match_id, matchTitle: x.match_title, pick: x.pick,
          odds: x.odds, imageUrl: x.image_url, likes: x.likes || 0, commentCount: x.comment_count || 0,
          liked: likedSet.has(x.id),
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch (e) { console.warn('[feed] db read failed, falling back to memory', e); }
  }
  const arr = Array.from(s.posts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  return arr.map(p => ({ ...p, liked: viewerId ? !!s.likes.get(p.id)?.has(viewerId) : false }));
}

export async function createPost(input: Omit<FeedPost, 'id' | 'likes' | 'commentCount' | 'createdAt'>): Promise<FeedPost> {
  const post: FeedPost = { id: makeId('post'), likes: 0, commentCount: 0, createdAt: new Date().toISOString(), ...input };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO feed_posts
          (id, user_id, author_name, author_avatar, content, match_id, match_title,
           pick, odds, image_url, likes, comment_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW())`,
        [post.id, post.userId, post.authorName, post.authorAvatar || null, post.content,
         post.matchId || null, post.matchTitle || null, post.pick || null, post.odds || null, post.imageUrl || null],
      );
    } catch (e) { console.warn('[feed] db insert failed', e); }
  }
  s.posts.set(post.id, post);
  s.comments.set(post.id, []);
  s.likes.set(post.id, new Set());
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
    try {
      await query(`DELETE FROM feed_post_likes WHERE post_id = ?`, [postId]);
      await query(`DELETE FROM feed_comments WHERE post_id = ?`, [postId]);
      await query(`DELETE FROM feed_posts WHERE id = ?`, [postId]);
    } catch (e) { console.warn('[feed] db deletePost failed', e); }
  }
  s.posts.delete(postId);
  s.comments.delete(postId);
  s.likes.delete(postId);
}

// ─── LIKES ───────────────────────────────────────
export async function toggleLike(postId: string, userId: number, likerName?: string): Promise<{ liked: boolean; likes: number }> {
  let liked = false;
  let likes = 0;
  if (hasDb()) {
    try {
      const existing = await query<{ id: number }>(
        `SELECT id FROM feed_post_likes WHERE post_id = ? AND user_id = ? LIMIT 1`, [postId, userId]);
      if (existing.rows.length > 0) {
        await query(`DELETE FROM feed_post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId]);
        await query(`UPDATE feed_posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?`, [postId]);
        liked = false;
      } else {
        await query(`INSERT IGNORE INTO feed_post_likes (post_id, user_id, created_at) VALUES (?, ?, NOW())`, [postId, userId]);
        await query(`UPDATE feed_posts SET likes = likes + 1 WHERE id = ?`, [postId]);
        liked = true;
      }
      const r = await query<{ likes: number }>(`SELECT likes FROM feed_posts WHERE id = ? LIMIT 1`, [postId]);
      likes = r.rows[0]?.likes ?? 0;
    } catch (e) { console.warn('[feed] db toggleLike failed', e); }
  }
  let set = s.likes.get(postId);
  if (!set) { set = new Set(); s.likes.set(postId, set); }
  if (set.has(userId)) { set.delete(userId); liked = false; }
  else { set.add(userId); liked = true; }
  const post = s.posts.get(postId);
  if (post) { post.likes = set.size; likes = post.likes; }
  if (liked && post && post.userId !== userId) {
    void dispatchNotification({ userId: post.userId, type: 'post_like', title: `${likerName || 'Someone'} liked your post`, content: post.content.length > 100 ? `${post.content.slice(0, 100)}…` : post.content, link: `/feed#${post.id}` }).catch(e => console.warn('[feed] like notify failed', e));
  }
  return { liked, likes };
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
      if (r.rows.length > 0) {
        return r.rows.map(x => ({
          id: x.id, postId: x.post_id, userId: x.user_id,
          authorName: x.author_name, authorAvatar: x.author_avatar,
          content: x.content,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch (e) { console.warn('[feed] db listComments failed', e); }
  }
  return s.comments.get(postId) ?? [];
}

export async function addComment(input: Omit<FeedComment, 'id' | 'createdAt'>): Promise<FeedComment> {
  const comment: FeedComment = { id: makeId('cmt'), createdAt: new Date().toISOString(), ...input };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO feed_comments (id, post_id, user_id, author_name, author_avatar, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [comment.id, comment.postId, comment.userId, comment.authorName, comment.authorAvatar || null, comment.content]
      );
      await query(`UPDATE feed_posts SET comment_count = comment_count + 1 WHERE id = ?`, [comment.postId]);
    } catch (e) { console.warn('[feed] db addComment failed', e); }
  }
  const list = s.comments.get(comment.postId) ?? [];
  list.push(comment);
  s.comments.set(comment.postId, list);
  const post = s.posts.get(comment.postId);
  if (post) post.commentCount = list.length;
  if (post && post.userId !== comment.userId) {
    void dispatchNotification({ userId: post.userId, type: 'comment', title: `${comment.authorName} commented on your post`, content: comment.content, link: `/feed#${comment.postId}` }).catch(() => {});
  }
  return comment;
}

// ─── ALIASES & EXTRAS ────────────────────────────
export const createComment = addComment;

export async function deleteComment(commentId: string): Promise<boolean> {
  if (hasDb()) {
    try {
      const r = await query(
        `DELETE FROM feed_comments WHERE id = ?`, [commentId]
      );
      if ((r.affectedRows ?? 0) > 0) {
        await query(`UPDATE feed_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = (SELECT post_id FROM feed_comments WHERE id = ? LIMIT 1)`, [commentId]).catch(() => {});
        return true;
      }
    } catch (e) { console.warn('[feed] db deleteComment failed', e); }
  }
  for (const [postId, list] of s.comments) {
    const idx = list.findIndex(c => c.id === commentId);
    if (idx !== -1) {
      list.splice(idx, 1);
      s.comments.set(postId, list);
      const post = s.posts.get(postId);
      if (post) post.commentCount = list.length;
      return true;
    }
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
      return r.rows.map(row => ({
        id: row.id, postId: row.post_id, userId: row.user_id,
        authorName: row.author_name, authorAvatar: row.author_avatar,
        content: row.content, createdAt: row.created_at,
      }));
    } catch (e) { console.warn('[feed] db listAllComments failed', e); }
  }
  const all: FeedComment[] = [];
  for (const list of s.comments.values()) all.push(...list);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function seedDemoPostsIfEmpty(): void {
  // No-op: demo seeding handled by createPost calls on first load
}
