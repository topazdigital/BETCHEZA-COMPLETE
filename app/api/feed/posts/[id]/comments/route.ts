import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listComments, createComment } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comments = await listComments(id);
  return NextResponse.json({ success: true, comments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in to comment.' }, { status: 401 });
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const content = String(body.content || '').trim();
  if (!content) return NextResponse.json({ success: false, error: 'Comment cannot be empty.' }, { status: 400 });
  if (content.length > 1000) return NextResponse.json({ success: false, error: 'Comment too long.' }, { status: 400 });
  const c = await createComment({
    postId: id,
    userId: user.userId,
    authorName: (user as unknown as { username?: string; email?: string }).username
      || (user as unknown as { username?: string; email?: string }).email
      || `user_${user.userId}`,
    authorAvatar: null,
    content,
  });
  return NextResponse.json({ success: true, comment: c });
}
