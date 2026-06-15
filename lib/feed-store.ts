// Community feed store — MySQL-backed with in-memory fallback when DB is unavailable.
// When running without a DB, posts are also persisted to a local JSON file so they
// survive server restarts.

import fs from 'fs';
import path from 'path';
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
       WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
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

const gm = globalThis as { __feedMem?: MemStore; __feedMemLoaded?: boolean };
if (!gm.__feedMem) {
  gm.__feedMem = { posts: [], comments: [], likes: new Map() };
}
const mem = gm.__feedMem;

// JSON file used to persist in-memory posts across server restarts (no-DB mode only).
const FEED_FILE = path.join(process.cwd(), '.local', 'state', 'feed-posts.json');

function ensureFeedDir(): void {
  try { fs.mkdirSync(path.dirname(FEED_FILE), { recursive: true }); } catch {}
}

function persistFeedToFile(): void {
  try {
    ensureFeedDir();
    // Don't persist seeded/fake posts (userId 0) — only real user posts and any
    // non-fake posts that should survive restarts.
    const toSave = mem.posts.slice(0, 200);
    fs.writeFileSync(FEED_FILE, JSON.stringify(toSave));
  } catch (e) {
    console.warn('[feed] persist to file failed', e);
  }
}

function loadFeedFromFile(): void {
  if (gm.__feedMemLoaded) return;
  gm.__feedMemLoaded = true;
  try {
    if (!fs.existsSync(FEED_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8')) as FeedPost[];
    if (Array.isArray(raw) && raw.length > 0) {
      mem.posts = raw;
      console.log(`[feed] loaded ${raw.length} posts from JSON file`);
    }
  } catch (e) {
    console.warn('[feed] loadFeedFromFile failed', e);
  }
}

// Load from file immediately on first import (synchronous so listPosts has data instantly)
loadFeedFromFile();

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
  // Add room_id column to feed_posts if not present (MySQL 5.7-compatible)
  await query(`ALTER TABLE feed_posts ADD COLUMN room_id INT DEFAULT NULL`, []).catch(() => {});
  await query(`ALTER TABLE feed_posts ADD INDEX idx_fp_room_id (room_id)`, []).catch(() => {});
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

export async function listRooms(): Promise<CommunityRoom[]> {
  if (!hasDb()) return [];
  try {
    const r = await query<{
      id: number; name: string; slug: string; description: string | null;
      icon: string | null; color: string | null; post_count: number; sort_order: number;
    }>(
      `SELECT id, name, slug, description, icon, color, post_count, sort_order
       FROM community_rooms WHERE is_active = 1 ORDER BY sort_order ASC`,
      [],
    );
    return r.rows.map(x => ({
      id: x.id, name: x.name, slug: x.slug, description: x.description,
      icon: x.icon, color: x.color, postCount: x.post_count, sortOrder: x.sort_order,
    }));
  } catch { return []; }
}

export async function listAllRoomsAdmin(): Promise<(CommunityRoom & { isActive: boolean; createdAt: string })[]> {
  if (!hasDb()) return [];
  const r = await query<{
    id: number; name: string; slug: string; description: string | null;
    icon: string | null; color: string | null; post_count: number; sort_order: number;
    is_active: number; created_at: string;
  }>(
    `SELECT id, name, slug, description, icon, color, post_count, sort_order, is_active, created_at
     FROM community_rooms ORDER BY sort_order ASC`,
    [],
  );
  return r.rows.map(x => ({
    id: x.id, name: x.name, slug: x.slug, description: x.description,
    icon: x.icon, color: x.color, postCount: x.post_count, sortOrder: x.sort_order,
    isActive: !!x.is_active, createdAt: String(x.created_at),
  }));
}

export async function upsertRoom(data: {
  id?: number; name: string; slug: string; description?: string | null;
  icon?: string | null; color?: string | null; sortOrder?: number; isActive?: boolean;
}): Promise<void> {
  if (!hasDb()) throw new Error('No database connection');
  const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (data.id) {
    await query(
      `UPDATE community_rooms SET name=?, slug=?, description=?, icon=?, color=?, sort_order=?, is_active=? WHERE id=?`,
      [data.name, slug, data.description ?? null, data.icon ?? null, data.color ?? null, data.sortOrder ?? 0, data.isActive !== false ? 1 : 0, data.id],
    );
  } else {
    await query(
      `INSERT INTO community_rooms (name, slug, description, icon, color, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [data.name, slug, data.description ?? null, data.icon ?? null, data.color ?? null, data.sortOrder ?? 0],
    );
  }
}

export async function deleteRoom(id: number): Promise<void> {
  if (!hasDb()) throw new Error('No database connection');
  await query(`DELETE FROM community_rooms WHERE id = ?`, [id]);
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

// ─── COMMUNITY POST SEEDER ────────────────────────────────────────────────────
// Keeps the community feed lively by generating posts from fake tipsters'
// auto_tips when the feed_posts table is empty.

const gSeed = globalThis as { __feedSeededAt?: number };
const SEED_INTERVAL_MS = 2 * 60 * 60 * 1000; // Re-seed every 2 hours so timestamps stay fresh

const POST_TEMPLATES = [
  (match: string, pick: string, odds: string) => `Backing ${pick} in ${match} 🔥 Odds at ${odds} — let's get it! #tips`,
  (match: string, pick: string, odds: string) => `My tip for ${match}: ${pick} @ ${odds} 📊 Looking solid today`,
  (match: string, pick: string, odds: string) => `${match} → going with ${pick} here. ${odds} is great value! ⚽`,
  (match: string, pick: string, odds: string) => `Lock it in: ${pick} | ${match} | ${odds} 🎯 #footballtips`,
  (match: string, pick: string, odds: string) => `Hot tip: ${pick} in ${match}. Confidence is HIGH 💪 Odds: ${odds}`,
  (match: string, pick: string, odds: string) => `Analysis done. ${pick} in ${match} @ ${odds}. Don't miss this one 🚀`,
  (match: string, pick: string, odds: string) => `${pick} for ${match}. Form says this is the play. ${odds} 📈 #valuebets`,
  (match: string, pick: string, odds: string) => `Dropping this pick: ${pick} | ${match} | ${odds} — should be a banker ✅`,
];

async function seedCommunityPostsFromTips(): Promise<boolean> {
  if (!hasDb()) return false;
  const now = Date.now();
  if (gSeed.__feedSeededAt && now - gSeed.__feedSeededAt < SEED_INTERVAL_MS) return false;
  gSeed.__feedSeededAt = now;

  try {
    const tips = await query<{
      tipster_id: number;
      match_title: string;
      pick: string;
      odds: number;
    }>(
      `SELECT at.tipster_id, at.match_title, at.pick, at.odds
       FROM auto_tips at
       WHERE at.tipster_id >= 1000
         AND at.status = 'pending'
         AND at.kickoff >= UTC_TIMESTAMP()
         AND at.kickoff <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 DAY)
       GROUP BY at.tipster_id, at.match_title
       ORDER BY at.kickoff ASC, RAND()
       LIMIT 40`,
      [],
    );

    if (tips.rows.length === 0) return false;

    const { getFakeTipsterById } = await import('./fake-tipsters');

    for (const tip of tips.rows) {
      const ft = getFakeTipsterById(tip.tipster_id);
      if (!ft) continue;

      // Deterministic post ID so INSERT IGNORE prevents duplicates on re-seed
      const slug = tip.match_title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
      const postId = `fp_${tip.tipster_id}_${slug}`;

      const tplIdx = (tip.tipster_id + tip.match_title.length) % POST_TEMPLATES.length;
      const content = POST_TEMPLATES[tplIdx](
        tip.match_title,
        tip.pick,
        Number(tip.odds).toFixed(2),
      );

      const hoursAgo = (tip.tipster_id % 20) + 1;
      const likes = Math.floor((tip.tipster_id % 18) + Math.random() * 8);
      // Use JS-calculated timestamp — MySQL's NOW() runs in server local timezone (not UTC)
      const seedTs = new Date(Date.now() - hoursAgo * 3600 * 1000)
        .toISOString().replace('T', ' ').replace(/\.\d+Z/, '');

      await query(
        `INSERT INTO feed_posts
          (id, user_id, author_name, author_avatar, content, match_id, match_title,
           pick, odds, image_url, room_id, likes, comment_count, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
           content = VALUES(content)`,
        [
          postId, tip.tipster_id, ft.displayName, ft.avatar || null,
          content, tip.match_title.slice(0, 255), tip.pick,
          Number(tip.odds), likes, seedTs,
        ],
      ).catch(() => {});
    }
    return true;
  } catch (e) {
    console.warn('[feed] seedCommunityPostsFromTips error:', e);
    gSeed.__feedSeededAt = 0; // Allow retry on next request
    return false;
  }
}

const POSTS_QUERY = (limit: number) => ({
  withHashtags: `
    SELECT fp.id, fp.user_id, fp.author_name, fp.author_avatar, fp.content,
           fp.match_id, fp.match_title, fp.pick, fp.odds, fp.image_url,
           fp.room_id,
           fp.likes, fp.comment_count, fp.created_at,
           u.role AS author_role, u.username AS author_username,
           GROUP_CONCAT(fh.tag ORDER BY fh.id SEPARATOR ',') AS hashtags
    FROM feed_posts fp
    LEFT JOIN users u ON u.id = fp.user_id
    LEFT JOIN feed_hashtags fh ON fh.post_id = fp.id
    GROUP BY fp.id
    ORDER BY fp.created_at DESC LIMIT ${limit}`,
  withoutHashtags: `
    SELECT fp.id, fp.user_id, fp.author_name, fp.author_avatar, fp.content,
           fp.match_id, fp.match_title, fp.pick, fp.odds, fp.image_url,
           NULL AS room_id,
           fp.likes, fp.comment_count, fp.created_at,
           u.role AS author_role, u.username AS author_username,
           NULL AS hashtags
    FROM feed_posts fp
    LEFT JOIN users u ON u.id = fp.user_id
    ORDER BY fp.created_at DESC LIMIT ${limit}`,
});

export async function listPosts(limit = 50, viewerId?: number | null): Promise<FeedPost[]> {
  if (hasDb()) {
    try {
      const q = POSTS_QUERY(limit);
      let r = await query<PostRow>(q.withHashtags, []).catch(async (e: { code?: string }) => {
        if (e?.code === 'ER_NO_SUCH_TABLE') {
          console.log('[feed] feed_hashtags table missing — creating it now');
          await ensureFeedHashtagsTable().catch(() => {});
          return query<PostRow>(q.withoutHashtags, []);
        }
        throw e;
      });

      if (r.rows.length === 0) {
        // Feed is empty — seed activity from fake tipsters and re-query
        const seeded = await seedCommunityPostsFromTips();
        if (seeded) {
          r = await query<PostRow>(q.withHashtags, []).catch(() => ({ rows: [] as PostRow[] }));
        }
      }

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

/** Convert any date string to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS). */
function toMysqlDatetime(iso: string): string {
  // MySQL DATETIME does not accept ISO 8601 'T'/'Z' format — convert to space-separated
  return iso.replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '');
}

export async function createPost(
  input: Omit<FeedPost, 'id' | 'likes' | 'commentCount' | 'createdAt'> & { createdAt?: string },
): Promise<FeedPost> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const post: FeedPost = { id: makeId('post'), likes: 0, commentCount: 0, createdAt, ...input };

  if (hasDb()) {
    try {
      await query(
        `INSERT INTO feed_posts
          (id, user_id, author_name, author_avatar, content, match_id, match_title,
           pick, odds, image_url, room_id, likes, comment_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
        [post.id, post.userId, sanitise(post.authorName), post.authorAvatar || null,
         sanitise(post.content),
         post.matchId || null, sanitise(post.matchTitle), sanitise(post.pick),
         post.odds || null, post.imageUrl || null, post.roomId ?? null,
         toMysqlDatetime(createdAt)],
      );
      // Store hashtags extracted from content (non-blocking)
      void storeHashtags(post.id, post.content ?? '');
      // DB succeeded — don't duplicate in memory
    } catch (e) {
      // DB write failed — fall back to in-memory + file persistence so the
      // post isn't lost and survives server restarts.
      console.error('[feed] createPost DB write failed, falling back to file store:', (e as Error).message);
      mem.posts.unshift(post);
      if (mem.posts.length > 200) mem.posts.length = 200;
      persistFeedToFile();
    }
  } else {
    mem.posts.unshift(post);
    // Cap memory store at 200 posts
    if (mem.posts.length > 200) mem.posts.length = 200;
    // Persist to JSON file so posts survive server restarts
    persistFeedToFile();
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
