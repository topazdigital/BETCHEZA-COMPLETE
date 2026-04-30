import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listPosts, createPost, seedDemoPostsIfEmpty } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  seedDemoPostsIfEmpty();
  const user = await getCurrentUser();
  const limit = Number(req.nextUrl.searchParams.get('limit') || 50);
  const posts = await listPosts({ limit, viewerId: user?.userId ?? null });
  return NextResponse.json({ success: true, posts });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Sign in to post.' }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const content = String(body.content || '').trim();
  if (!content) return NextResponse.json({ success: false, error: 'Post content required.' }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ success: false, error: 'Post too long.' }, { status: 400 });
  const post = await createPost({
    userId: user.userId,
    authorName: (user as unknown as { username?: string; email?: string }).username
      || (user as unknown as { username?: string; email?: string }).email
      || `user_${user.userId}`,
    authorAvatar: null,
    content,
    matchId: typeof body.matchId === 'string' ? body.matchId : null,
    matchTitle: typeof body.matchTitle === 'string' ? body.matchTitle : null,
    pick: typeof body.pick === 'string' ? body.pick : null,
    odds: typeof body.odds === 'number' ? body.odds : null,
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
  });
  return NextResponse.json({ success: true, post });
}
