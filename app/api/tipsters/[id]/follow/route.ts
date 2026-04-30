import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { followTipster, unfollowTipster, isFollowingTipster } from '@/lib/follows-store';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { getFakeTipsterByUsername, getFakeTipsterBySlug } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';

// Accepts either a numeric tipster id, an exact username, or a slugified display name.
function resolveTipsterId(raw: string): number | null {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const t = getFakeTipsterByUsername(raw) || getFakeTipsterBySlug(raw);
  return t?.id ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ following: false, authenticated: false });
  const { id } = await params;
  const tipsterId = resolveTipsterId(id);
  if (tipsterId == null) return NextResponse.json({ error: 'Invalid tipster id' }, { status: 400 });
  const following = await isFollowingTipster(user.userId, tipsterId);
  return NextResponse.json({ following, authenticated: true });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to follow tipsters' }, { status: 401 });
  const { id } = await params;
  const tipsterId = resolveTipsterId(id);
  if (tipsterId == null) return NextResponse.json({ error: 'Invalid tipster id' }, { status: 400 });
  await followTipster(user.userId, tipsterId);
  // Notify the tipster that someone followed them.
  const followerName = (user as unknown as { username?: string; email?: string }).username
    || (user as unknown as { username?: string; email?: string }).email
    || `user_${user.userId}`;
  void dispatchNotification({
    userId: tipsterId,
    type: 'follow_new',
    title: 'New follower',
    content: `${followerName} just started following you`,
    link: `/users/${user.userId}`,
  }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const tipsterId = resolveTipsterId(id);
  if (tipsterId == null) return NextResponse.json({ error: 'Invalid tipster id' }, { status: 400 });
  await unfollowTipster(user.userId, tipsterId);
  return NextResponse.json({ success: true });
}
