import { NextResponse } from 'next/server';
import { listPosts } from '@/lib/feed-store';
import { getFakeTipsters } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 2 * 60_000;
const g = globalThis as { __trendingCache?: { data: unknown; ts: number } };

export async function GET() {
  const now = Date.now();
  if (g.__trendingCache && now - g.__trendingCache.ts < CACHE_TTL) {
    return NextResponse.json(g.__trendingCache.data);
  }

  const posts = await listPosts(500);

  const since = now - 24 * 60 * 60 * 1000;
  const recent = posts.filter(p => new Date(p.createdAt).getTime() >= since);

  const trending = [...recent]
    .filter(p => p.pick && p.odds && Number(p.odds) > 1)
    .sort((a, b) => (b.likes + b.commentCount * 2) - (a.likes + a.commentCount * 2))
    .slice(0, 6)
    .map(p => ({
      id: p.id,
      authorName: p.authorName,
      authorUsername: p.authorUsername,
      pick: p.pick,
      odds: p.odds,
      matchTitle: p.matchTitle,
      matchId: p.matchId ?? null,
      likes: p.likes,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
    }));

  const totalPosts = posts.length;
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.commentCount, 0);
  const realActiveUsers = new Set(posts.map(p => p.userId)).size;

  const fakeTipsters = getFakeTipsters();

  const timeBucket = Math.floor(now / (3 * 60_000));
  const onlineTipsterList = fakeTipsters.filter((t, i) => {
    const slot = (i + timeBucket) % 7;
    return t.isOnline || slot === 0;
  });

  const recentlyActiveReal = new Set(
    posts
      .filter(p => now - new Date(p.createdAt).getTime() < 60 * 60_000)
      .map(p => p.userId),
  ).size;

  const onlineTipsters = onlineTipsterList.length + recentlyActiveReal;
  const onlineAvatars = onlineTipsterList.slice(0, 5).map(t => ({
    id: t.id,
    name: t.displayName,
    avatar: t.avatar,
    username: t.username,
  }));

  const payload = {
    trending,
    stats: {
      postsToday: recent.length,
      totalPosts,
      totalLikes,
      totalComments,
      activeUsers: realActiveUsers,
      onlineTipsters,
      onlineAvatars,
    },
  };

  g.__trendingCache = { data: payload, ts: now };
  return NextResponse.json(payload);
}
