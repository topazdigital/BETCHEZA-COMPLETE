import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listComments, addComment } from '@/lib/tip-engagement-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comments = await listComments(id);
  return NextResponse.json({ ok: true, comments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to comment.' }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const content = String(body.content || '').trim();
  if (!content) return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 });
  if (content.length > 1000) return NextResponse.json({ error: 'Comment too long (max 1000 chars).' }, { status: 400 });
  const u = user as unknown as { username?: string; email?: string };
  const authorName = u.username || (u.email ? u.email.split('@')[0] : `user_${user.userId}`);
  const comment = await addComment({ tipId: id, userId: user.userId, authorName, content });
  return NextResponse.json({ ok: true, comment });
}
