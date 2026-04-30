import { NextResponse } from 'next/server';
import { listPosts } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const posts = await listPosts({ limit: 50 });

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = posts.filter(p => new Date(p.createdAt).getTime() >= since);

  const trending = [...recent]
    .filter(p => p.pick)
    .sort((a, b) => (b.likes + b.commentCount * 2) - (a.likes + a.commentCount * 2))
    .slice(0, 6)
    .map(p => ({
      id: p.id,
      authorName: p.authorName,
      pick: p.pick,
      odds: p.odds,
      matchTitle: p.matchTitle,
      likes: p.likes,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
    }));

  const totalPosts = posts.length;
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.commentCount, 0);
  const activeUsers = new Set(posts.map(p => p.userId)).size;

  return NextResponse.json({
    trending,
    stats: {
      postsToday: recent.length,
      totalPosts,
      totalLikes,
      totalComments,
      activeUsers,
    },
  });
}
