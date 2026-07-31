import { NextResponse } from 'next/server';
import { listPosts } from '@/lib/feed-store';
import { getFakeTipsters } from '@/lib/fake-tipsters';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 2 * 60_000;
const g = globalThis as { __trendingCache?: { data: unknown; ts: number } };

function resolveRealOdds(
  pick: string,
  matchOdds: { home?: number | null; draw?: number | null; away?: number | null },
): number | null {
  const p = pick.toLowerCase().trim();
  if (p.includes('home win') || p === 'home' || p === '1' || p === '1x2 home') return matchOdds.home ?? null;
  if (p.includes('away win') || p === 'away' || p === '2' || p === '1x2 away') return matchOdds.away ?? null;
  if (p.includes('draw') || p === 'x') return matchOdds.draw ?? null;
  return null;
}

export async function GET() {
  const now = Date.now();
  if (g.__trendingCache && now - g.__trendingCache.ts < CACHE_TTL) {
    return NextResponse.json(g.__trendingCache.data);
  }

  const posts = await listPosts(500);

  const since = now - 24 * 60 * 60 * 1000;
  const recent = posts.filter(p => new Date(p.createdAt).getTime() >= since);

  // Build a real-odds lookup from cached matches (fast — uses internal cache)
  const oddsLookup = new Map<string, { home?: number | null; draw?: number | null; away?: number | null }>();
  try {
    const allMatches = await Promise.race([
      getAllMatches(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ]);
    for (const m of allMatches) {
      if (m.id && m.odds) oddsLookup.set(m.id, m.odds as { home?: number; draw?: number; away?: number });
    }
  } catch { /* skip odds enrichment on timeout — user-submitted odds will be used */ }

  const trending = [...recent]
    .filter(p => p.pick && p.odds && Number(p.odds) > 1)
    .sort((a, b) => (b.likes + b.commentCount * 2) - (a.likes + a.commentCount * 2))
    .slice(0, 6)
    .map(p => {
      let finalOdds: number | string | null = p.odds;
      // Prefer real bookmaker odds over user-submitted odds
      if (p.matchId && p.pick && oddsLookup.has(p.matchId)) {
        const real = resolveRealOdds(p.pick, oddsLookup.get(p.matchId)!);
        if (real && real > 1) finalOdds = real;
      }
      return {
        id: p.id,
        authorName: p.authorName,
        authorUsername: p.authorUsername,
        pick: p.pick,
        odds: finalOdds,
        matchTitle: p.matchTitle,
        matchId: p.matchId ?? null,
        likes: p.likes,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
      };
    });

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
