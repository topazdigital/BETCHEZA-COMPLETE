// Community feed store — MySQL-backed with in-memory fallback.
// All SQL uses ? placeholders (MySQL style).

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

interface Stores {
  posts: Map<string, FeedPost>;
  comments: Map<string, FeedComment[]>;
  likes: Map<string, Set<number>>;
}

const g = globalThis as { __feedStore?: Stores };
g.__feedStore = g.__feedStore || { posts: new Map(), comments: new Map(), likes: new Map() };
const s = g.__feedStore;

const hasDb = () => !!(process.env.DATABASE_URL || process.env.MYSQL_URL);

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
export async function listComments(postId: string, limit = 100): Promise<FeedComment[]> {
  if (hasDb()) {
    try {
      const r = await query<{
        id: string; post_id: string; user_id: number; author_name: string;
        author_avatar: string | null; content: string; created_at: string;
      }>(`SELECT id, post_id, user_id, author_name, author_avatar, content, created_at
          FROM feed_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT ?`, [postId, limit]);
      if (r.rows.length > 0) {
        return r.rows.map(x => ({
          id: x.id, postId: x.post_id, userId: x.user_id, authorName: x.author_name,
          authorAvatar: x.author_avatar, content: x.content,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch (e) { console.warn('[feed] db comments failed', e); }
  }
  return (s.comments.get(postId) || []).slice(0, limit);
}

export async function createComment(input: Omit<FeedComment, 'id' | 'createdAt'>): Promise<FeedComment> {
  const c: FeedComment = { id: makeId('cmt'), createdAt: new Date().toISOString(), ...input };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO feed_comments (id, post_id, user_id, author_name, author_avatar, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [c.id, c.postId, c.userId, c.authorName, c.authorAvatar || null, c.content],
      );
      await query(`UPDATE feed_posts SET comment_count = comment_count + 1 WHERE id = ?`, [c.postId]);
    } catch (e) { console.warn('[feed] db insert comment failed', e); }
  }
  const arr = s.comments.get(c.postId) || [];
  arr.push(c);
  s.comments.set(c.postId, arr);
  const post = s.posts.get(c.postId);
  if (post) post.commentCount = arr.length;
  if (post && post.userId !== c.userId) {
    void dispatchNotification({ userId: post.userId, type: 'post_comment', title: `${c.authorName} commented on your post`, content: c.content.length > 140 ? `${c.content.slice(0, 140)}…` : c.content, link: `/feed#${post.id}` }).catch(e => console.warn('[feed] comment notify failed', e));
  }
  const earlier = arr.slice(0, -1);
  const participants = new Set<number>();
  for (const x of earlier) {
    if (x.userId !== c.userId && (!post || x.userId !== post.userId)) participants.add(x.userId);
  }
  if (participants.size > 0) {
    void dispatchToMany(Array.from(participants), { type: 'comment_reply', title: `${c.authorName} replied in a thread you're in`, content: c.content.length > 140 ? `${c.content.slice(0, 140)}…` : c.content, link: `/feed#${c.postId}` });
  }
  return c;
}

export async function listAllComments(limit = 200): Promise<Array<FeedComment & { postTitle?: string | null; postAuthor?: string | null }>> {
  if (hasDb()) {
    try {
      const r = await query<{
        id: string; post_id: string; user_id: number; author_name: string;
        author_avatar: string | null; content: string; created_at: string;
        post_match_title: string | null; post_author_name: string | null;
      }>(`SELECT c.id, c.post_id, c.user_id, c.author_name, c.author_avatar, c.content, c.created_at,
                 p.match_title AS post_match_title, p.author_name AS post_author_name
            FROM feed_comments c
            LEFT JOIN feed_posts p ON p.id = c.post_id
           ORDER BY c.created_at DESC LIMIT ?`, [limit]);
      if (r.rows.length > 0) {
        return r.rows.map(x => ({
          id: x.id, postId: x.post_id, userId: x.user_id, authorName: x.author_name,
          authorAvatar: x.author_avatar, content: x.content,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
          postTitle: x.post_match_title, postAuthor: x.post_author_name,
        }));
      }
    } catch (e) { console.warn('[feed] db listAllComments failed', e); }
  }
  const all: Array<FeedComment & { postTitle?: string | null; postAuthor?: string | null }> = [];
  for (const [postId, comments] of s.comments.entries()) {
    const post = s.posts.get(postId);
    for (const c of comments) all.push({ ...c, postTitle: post?.matchTitle ?? null, postAuthor: post?.authorName ?? null });
  }
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
}

export async function deleteComment(commentId: string): Promise<boolean> {
  if (hasDb()) {
    try {
      const row = await query<{ post_id: string }>(`SELECT post_id FROM feed_comments WHERE id = ?`, [commentId]);
      const postId = row.rows[0]?.post_id;
      await query(`DELETE FROM feed_comments WHERE id = ?`, [commentId]);
      if (postId) await query(`UPDATE feed_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?`, [postId]);
    } catch (e) { console.warn('[feed] db deleteComment failed', e); }
  }
  let removed = false;
  for (const [postId, list] of s.comments.entries()) {
    const idx = list.findIndex(c => c.id === commentId);
    if (idx >= 0) {
      list.splice(idx, 1);
      removed = true;
      const post = s.posts.get(postId);
      if (post) post.commentCount = list.length;
      break;
    }
  }
  return removed;
}
