// Community feed store: posts + comments + likes.
// Uses PostgreSQL when DATABASE_URL is set, otherwise falls back to in-memory
// global state (consistent with the rest of the codebase).

import { query } from './db';
import { dispatchNotification, dispatchToMany } from './notification-dispatcher';
import { listFollowersOfTipster } from './follows-store';
import { getFakeTipsters } from './fake-tipsters';

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
  liked?: boolean;
  commentCount: number;
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
  comments: Map<string, FeedComment[]>; // postId -> comments
  likes: Map<string, Set<number>>; // postId -> userIds
}

const g = globalThis as { __feedStore?: Stores };
g.__feedStore = g.__feedStore || {
  posts: new Map(),
  comments: new Map(),
  likes: new Map(),
};
const s = g.__feedStore;

const hasDb = () => !!process.env.DATABASE_URL;

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── POSTS ───────────────────────────────────────
export async function listPosts(opts: { limit?: number; viewerId?: number | null } = {}): Promise<FeedPost[]> {
  const { limit = 50, viewerId = null } = opts;
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
          id: x.id,
          userId: x.user_id,
          authorName: x.author_name,
          authorAvatar: x.author_avatar,
          content: x.content,
          matchId: x.match_id,
          matchTitle: x.match_title,
          pick: x.pick,
          odds: x.odds,
          imageUrl: x.image_url,
          likes: x.likes || 0,
          commentCount: x.comment_count || 0,
          liked: likedSet.has(x.id),
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch (e) {
      console.warn('[feed] db read failed, falling back to memory', e);
    }
  }
  const arr = Array.from(s.posts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  return arr.map(p => ({
    ...p,
    liked: viewerId ? !!s.likes.get(p.id)?.has(viewerId) : false,
  }));
}

export async function createPost(input: Omit<FeedPost, 'id' | 'likes' | 'commentCount' | 'createdAt'>): Promise<FeedPost> {
  const post: FeedPost = {
    id: makeId('post'),
    likes: 0,
    commentCount: 0,
    createdAt: new Date().toISOString(),
    ...input,
  };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO feed_posts
          (id, user_id, author_name, author_avatar, content, match_id, match_title,
           pick, odds, image_url, likes, comment_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW())`,
        [post.id, post.userId, post.authorName, post.authorAvatar || null, post.content,
         post.matchId || null, post.matchTitle || null, post.pick || null, post.odds || null,
         post.imageUrl || null],
      );
    } catch (e) {
      console.warn('[feed] db insert failed', e);
    }
  }
  s.posts.set(post.id, post);
  s.comments.set(post.id, []);
  s.likes.set(post.id, new Set());
  // Fan-out: notify everyone who follows this author (best-effort).
  try {
    const followers = await listFollowersOfTipster(post.userId);
    if (followers.length > 0) {
      void dispatchToMany(followers, {
        type: 'tipster_post',
        title: `${post.authorName} posted`,
        content: post.content.length > 140 ? `${post.content.slice(0, 140)}…` : post.content,
        link: `/feed#${post.id}`,
      });
    }
  } catch (e) { console.warn('[feed] post fan-out failed', e); }
  return post;
}

// ─── LIKES ───────────────────────────────────────
export async function toggleLike(postId: string, userId: number, likerName?: string): Promise<{ liked: boolean; likes: number }> {
  let liked = false;
  let likes = 0;
  if (hasDb()) {
    try {
      const existing = await query<{ id: number }>(
        `SELECT id FROM feed_post_likes WHERE post_id = ? AND user_id = ? LIMIT 1`,
        [postId, userId],
      );
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
    } catch (e) {
      console.warn('[feed] db toggleLike failed', e);
    }
  }
  // Memory fallback / mirror
  let set = s.likes.get(postId);
  if (!set) { set = new Set(); s.likes.set(postId, set); }
  if (set.has(userId)) {
    set.delete(userId);
    liked = false;
  } else {
    set.add(userId);
    liked = true;
  }
  const post = s.posts.get(postId);
  if (post) {
    post.likes = set.size;
    likes = post.likes;
  }
  // Notify post author when someone likes (and it's not their own).
  if (liked && post && post.userId !== userId) {
    void dispatchNotification({
      userId: post.userId,
      type: 'post_like',
      title: `${likerName || 'Someone'} liked your post`,
      content: post.content.length > 100 ? `${post.content.slice(0, 100)}…` : post.content,
      link: `/feed#${post.id}`,
    }).catch(e => console.warn('[feed] like notify failed', e));
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
          FROM feed_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT ?`,
        [postId, limit]);
      if (r.rows.length > 0) {
        return r.rows.map(x => ({
          id: x.id,
          postId: x.post_id,
          userId: x.user_id,
          authorName: x.author_name,
          authorAvatar: x.author_avatar,
          content: x.content,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch (e) {
      console.warn('[feed] db comments failed', e);
    }
  }
  return (s.comments.get(postId) || []).slice(0, limit);
}

export async function createComment(input: Omit<FeedComment, 'id' | 'createdAt'>): Promise<FeedComment> {
  const c: FeedComment = {
    id: makeId('cmt'),
    createdAt: new Date().toISOString(),
    ...input,
  };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO feed_comments (id, post_id, user_id, author_name, author_avatar, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [c.id, c.postId, c.userId, c.authorName, c.authorAvatar || null, c.content],
      );
      await query(`UPDATE feed_posts SET comment_count = comment_count + 1 WHERE id = ?`, [c.postId]);
    } catch (e) {
      console.warn('[feed] db insert comment failed', e);
    }
  }
  const arr = s.comments.get(c.postId) || [];
  arr.push(c);
  s.comments.set(c.postId, arr);
  const post = s.posts.get(c.postId);
  if (post) post.commentCount = arr.length;
  // Notify post author (if it's not their own comment).
  if (post && post.userId !== c.userId) {
    void dispatchNotification({
      userId: post.userId,
      type: 'post_comment',
      title: `${c.authorName} commented on your post`,
      content: c.content.length > 140 ? `${c.content.slice(0, 140)}…` : c.content,
      link: `/feed#${post.id}`,
    }).catch(e => console.warn('[feed] comment notify failed', e));
  }
  // Notify previous commenters (thread participants), excluding the new commenter & post author (already notified).
  const earlier = arr.slice(0, -1);
  const participants = new Set<number>();
  for (const x of earlier) {
    if (x.userId !== c.userId && (!post || x.userId !== post.userId)) participants.add(x.userId);
  }
  if (participants.size > 0) {
    void dispatchToMany(Array.from(participants), {
      type: 'comment_reply',
      title: `${c.authorName} replied in a thread you're in`,
      content: c.content.length > 140 ? `${c.content.slice(0, 140)}…` : c.content,
      link: `/feed#${c.postId}`,
    });
  }
  return c;
}

// Aggregate every comment across every post (admin moderation view).
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
          id: x.id,
          postId: x.post_id,
          userId: x.user_id,
          authorName: x.author_name,
          authorAvatar: x.author_avatar,
          content: x.content,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
          postTitle: x.post_match_title,
          postAuthor: x.post_author_name,
        }));
      }
    } catch (e) {
      console.warn('[feed] db listAllComments failed', e);
    }
  }
  const all: Array<FeedComment & { postTitle?: string | null; postAuthor?: string | null }> = [];
  for (const [postId, comments] of s.comments.entries()) {
    const post = s.posts.get(postId);
    for (const c of comments) {
      all.push({ ...c, postTitle: post?.matchTitle ?? null, postAuthor: post?.authorName ?? null });
    }
  }
  return all
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function deleteComment(commentId: string): Promise<boolean> {
  if (hasDb()) {
    try {
      const row = await query<{ post_id: string }>(`SELECT post_id FROM feed_comments WHERE id = ?`, [commentId]);
      const postId = row.rows[0]?.post_id;
      await query(`DELETE FROM feed_comments WHERE id = ?`, [commentId]);
      if (postId) {
        await query(`UPDATE feed_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?`, [postId]);
      }
    } catch (e) {
      console.warn('[feed] db deleteComment failed', e);
    }
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

// ─── SEEDING (memory only, when DB is empty) ─────
//
// We seed the community feed with posts authored by the fake-tipster
// catalogue so the feed never feels empty. Each post is deterministic
// (seeded by tipster id) so reloads don't shuffle content.

// Post templates are wired to REAL upcoming matches at seed time. The
// `{home}`, `{away}`, `{league}` placeholders are filled per-match, and
// each post stores the actual matchId so the feed deep-links straight
// to /matches/[slug] in the UI.
const POST_TEMPLATES: Array<{ content: (m: { home: string; away: string; league: string }) => string; pickFor: (m: { home: string; away: string }) => string | null; odds: number | null }> = [
  { content: m => `🔥 Loading up on ${m.home} to dominate ${m.away}. Press has been ruthless — expect 2+ goals.`, pickFor: m => `${m.home} -1.0`, odds: 1.95 },
  { content: m => `${m.home} look untouchable at home. ML + BTTS combo is the move for ${m.home} vs ${m.away}.`, pickFor: m => `${m.home} ML + BTTS`, odds: 2.85 },
  { content: m => `Over 2.5 in ${m.league} matches like ${m.home}-${m.away} has been a printer. Riding it.`, pickFor: () => 'Over 2.5', odds: 1.75 },
  { content: m => `${m.home} attacking xG is off the charts. Fading them vs ${m.away} is brave.`, pickFor: m => `${m.home} -1.5`, odds: 2.10 },
  { content: m => `${m.home} vs ${m.away} — backing both teams to score. Defenses leak in this ${m.league} fixture.`, pickFor: () => 'BTTS Yes', odds: 1.72 },
  { content: m => `Asian handicap value on ${m.away} +1 in ${m.league}. Closing-line value > vibes.`, pickFor: m => `${m.away} +1 AH`, odds: 1.95 },
  { content: m => `${m.home} home record is elite this season. Tail them vs ${m.away} on the moneyline.`, pickFor: m => `${m.home} ML`, odds: 1.90 },
  { content: m => `Form check on ${m.home}-${m.away}: under 2.5 has hit 6 of last 8. Locking it in.`, pickFor: () => 'Under 2.5', odds: 1.85 },
  { content: m => `Corners model loves ${m.home} vs ${m.away}. Over 9.5 is the play in ${m.league} tempo games.`, pickFor: () => 'Over 9.5 corners', odds: 1.85 },
  { content: m => `${m.away} away pressure leaks goals. Backing ${m.home} clean sheet here — value at the price.`, pickFor: m => `${m.home} clean sheet`, odds: 2.40 },
  { content: m => `Big call: ${m.away} pull off the upset at ${m.home}. The line is too generous.`, pickFor: m => `${m.away} ML`, odds: 3.20 },
  { content: m => `${m.league} tip: ${m.home} -1 first half. They start fast and ${m.away} concede early.`, pickFor: m => `${m.home} -1 1H`, odds: 2.50 },
  { content: m => `Tracking my staking plan — patience pays. Today’s lean is ${m.home} vs ${m.away}.`, pickFor: () => null, odds: null },
  { content: m => `Reminder: discipline > picks. Bankroll-first on ${m.home}-${m.away}. 1u stake.`, pickFor: () => null, odds: null },
  { content: m => `Combo idea: ${m.home} or draw double-chance + over 1.5. Safer angle in ${m.league}.`, pickFor: m => `${m.home} or draw + Over 1.5`, odds: 1.65 },
];

// Internal: synchronous fast path that fires the async fill in the background
// the first time a request hits the empty store. Subsequent requests see
// posts already populated.
let seeding = false;
export function seedDemoPostsIfEmpty(): void {
  if (s.posts.size > 0 || seeding) return;
  seeding = true;
  // Fire & forget — the next refresh will see the posts.
  (async () => {
    try {
      await seedDemoPostsFromRealMatches();
    } catch (e) {
      console.warn('[feed-store] seed failed', e);
    } finally {
      seeding = false;
    }
  })();
}

// Async seeding wired to REAL upcoming matches. Each fake-tipster authors
// one post tied to a different real match so the post deep-links to the
// actual match page via its matchId.
export async function seedDemoPostsFromRealMatches(): Promise<void> {
  if (s.posts.size > 0) return;
  const fakes = getFakeTipsters();
  if (fakes.length === 0) return;
  const { getUpcomingMatches } = await import('./api/unified-sports-api');
  let upcoming: Array<{ id: string; homeTeam: { name: string }; awayTeam: { name: string }; league?: { name?: string }; sport?: { name?: string } }> = [];
  try {
    upcoming = (await getUpcomingMatches()) as never;
  } catch (e) {
    console.warn('[feed-store] could not fetch upcoming matches', e);
    return;
  }
  if (!upcoming || upcoming.length === 0) return;
  // Pick the first 24 fake tipsters as authors and assign each a distinct match.
  const authors = fakes.slice(0, 24);
  const now = Date.now();
  authors.forEach((t, i) => {
    const match = upcoming[i % upcoming.length];
    if (!match) return;
    const ctx = {
      home: match.homeTeam.name,
      away: match.awayTeam.name,
      league: match.league?.name || match.sport?.name || 'the league',
    };
    const tpl = POST_TEMPLATES[i % POST_TEMPLATES.length];
    const id = makeId('post');
    const likes = Math.max(3, Math.min(120, Math.round(t.followersCount / 25 + (i * 3))));
    s.posts.set(id, {
      id,
      userId: t.id,
      authorName: t.displayName,
      authorAvatar: t.avatar,
      content: tpl.content(ctx),
      pick: tpl.pickFor(ctx),
      odds: tpl.odds,
      matchId: match.id,
      matchTitle: `${ctx.home} vs ${ctx.away}`,
      imageUrl: null,
      likes,
      commentCount: 0,
      createdAt: new Date(now - (i * 105 + 17) * 60 * 1000).toISOString(),
    });
    s.comments.set(id, []);
    s.likes.set(id, new Set());
  });
}
