import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { listPosts, createPost } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const limit = Number(req.nextUrl.searchParams.get('limit') || 50);
  const posts = await listPosts(limit, user?.userId ?? null);
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

  // Look up the user's display name and avatar from their profile
  let authorName = (user as unknown as { username?: string; email?: string }).username
    || (user as unknown as { username?: string; email?: string }).email
    || `user_${user.userId}`;
  let authorAvatar: string | null = null;
  try {
    const r = await query<{ display_name: string | null; avatar_url: string | null }>(
      `SELECT up.display_name, up.avatar_url
       FROM user_profiles up WHERE up.user_id = ? LIMIT 1`,
      [user.userId]
    );
    if (r.rows[0]) {
      if (r.rows[0].display_name) authorName = r.rows[0].display_name;
      if (r.rows[0].avatar_url) authorAvatar = r.rows[0].avatar_url;
    }
  } catch {}

  const post = await createPost({
    userId: user.userId,
    authorName,
    authorAvatar,
    content,
    matchId: typeof body.matchId === 'string' ? body.matchId : null,
    matchTitle: typeof body.matchTitle === 'string' ? body.matchTitle : null,
    pick: typeof body.pick === 'string' ? body.pick : null,
    odds: typeof body.odds === 'number' ? body.odds : null,
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
  });
  return NextResponse.json({ success: true, post });
}
