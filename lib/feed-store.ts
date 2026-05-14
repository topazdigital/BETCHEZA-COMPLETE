// Community feed store — MySQL-backed (no in-memory fallback).

import { query } from './db';
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

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitise(str: string | null | undefined): string | null {
  if (!str) return str ?? null;
  return str.replace(/[\uD800-\uDFFF]/g, '');
}

// ─── POSTS ───────────────────────────────────────
export async function listPosts(limit = 50, viewerId?: number | null): Promise<FeedPost[]> {
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

    return r.rows.map(x => ({
      id: x.id, userId: x.user_id, authorName: x.author_name, authorAvatar: x.author_avatar,
      content: x.content, matchId: x.match_id, matchTitle: x.match_title, pick: x.pick,
      odds: x.odds, imageUrl: x.image_url, likes: x.likes || 0, commentCount: x.comment_count || 0,
      liked: likedSet.has(x.id),
      createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
    }));
  } catch (e) {
    console.error('[feed] listPosts DB error:', e);
    return [];
  }
}

export async function createPost(input: Omit<FeedPost, 'id' | 'likes' | 'commentCount' | 'createdAt'>): Promise<FeedPost> {
  const post: FeedPost = { id: makeId('post'), likes: 0, commentCount: 0, createdAt: new Date().toISOString(), ...input };
  await query(
    `INSERT INTO feed_posts
      (id, user_id, author_name, author_avatar, content, match_id, match_title,
       pick, odds, image_url, likes, comment_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW())`,
    [post.id, post.userId, sanitise(post.authorName), post.authorAvatar || null,
     sanitise(post.content),
     post.matchId || null, sanitise(post.matchTitle), sanitise(post.pick),
     post.odds || null, post.imageUrl || null],
  );
  try {
    const followers = await listFollowersOfTipster(post.userId);
    if (followers.length > 0) {
      void dispatchToMany(followers, { type: 'tipster_post', title: `${post.authorName} posted`, content: post.content.length > 140 ? `${post.content.slice(0, 140)}…` : post.content, link: `/feed#${post.id}` });
    }
  } catch (e) { console.warn('[feed] post fan-out failed', e); }
  return post;
}

export async function deletePost(postId: string): Promise<void> {
  await query(`DELETE FROM feed_post_likes WHERE post_id = ?`, [postId]);
  await query(`DELETE FROM feed_comments WHERE post_id = ?`, [postId]);
  await query(`DELETE FROM feed_posts WHERE id = ?`, [postId]);
}

// ─── LIKES ───────────────────────────────────────
export async function toggleLike(postId: string, userId: number, likerName?: string): Promise<{ liked: boolean; likes: number }> {
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
}

// ─── COMMENTS ────────────────────────────────────
export async function listComments(postId: string): Promise<FeedComment[]> {
  try {
    const r = await query<{
      id: string; post_id: string; user_id: number; author_name: string;
      author_avatar: string | null; content: string; created_at: string;
    }>(
      `SELECT id, post_id, user_id, author_name, author_avatar, content, created_at
       FROM feed_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 100`,
      [postId]
    );
    return r.rows.map(x => ({
      id: x.id, postId: x.post_id, userId: x.user_id,
      authorName: x.author_name, authorAvatar: x.author_avatar,
      content: x.content,
      createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
    }));
  } catch (e) {
    console.error('[feed] listComments DB error:', e);
    return [];
  }
}

export async function addComment(input: Omit<FeedComment, 'id' | 'createdAt'>): Promise<FeedComment> {
  const comment: FeedComment = { id: makeId('cmt'), createdAt: new Date().toISOString(), ...input };
  await query(
    `INSERT INTO feed_comments (id, post_id, user_id, author_name, author_avatar, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [comment.id, comment.postId, comment.userId, sanitise(comment.authorName), comment.authorAvatar || null, sanitise(comment.content)]
  );
  await query(`UPDATE feed_posts SET comment_count = comment_count + 1 WHERE id = ?`, [comment.postId]);
  try {
    const r = await query<{ user_id: number; content: string }>(
      `SELECT user_id, content FROM feed_posts WHERE id = ? LIMIT 1`, [comment.postId]);
    if (r.rows[0] && r.rows[0].user_id !== comment.userId) {
      void dispatchNotification({ userId: r.rows[0].user_id, type: 'comment', title: `${comment.authorName} commented on your post`, content: comment.content, link: `/feed#${comment.postId}` }).catch(() => {});
    }
  } catch { /* notification is non-critical */ }
  return comment;
}

export const createComment = addComment;

export async function deleteComment(commentId: string): Promise<boolean> {
  const r = await query<{ post_id: string }>(
    `SELECT post_id FROM feed_comments WHERE id = ? LIMIT 1`, [commentId]);
  const postId = r.rows[0]?.post_id;
  const del = await query(`DELETE FROM feed_comments WHERE id = ?`, [commentId]);
  if ((del.affectedRows ?? 0) > 0 && postId) {
    await query(`UPDATE feed_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?`, [postId]).catch(() => {});
    return true;
  }
  return false;
}

export async function listAllComments(limit = 100): Promise<FeedComment[]> {
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
  } catch (e) {
    console.error('[feed] listAllComments DB error:', e);
    return [];
  }
}
