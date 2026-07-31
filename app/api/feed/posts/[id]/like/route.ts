import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { toggleLike } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in to like posts.' }, { status: 401 });
  const { id } = await params;
  const liker = (user as unknown as { username?: string; email?: string }).username
    || (user as unknown as { username?: string; email?: string }).email
    || `user_${user.userId}`;
  const r = await toggleLike(id, user.userId, liker);
  return NextResponse.json({ success: true, ...r });
}
