import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { followPlayer, unfollowPlayer, isFollowingPlayer } from '@/lib/follows-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ following: false });
  const following = await isFollowingPlayer(user.id, id);
  return NextResponse.json({ following });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await _req.json().catch(() => ({})) as {
    playerName?: string;
    playerHeadshot?: string;
    teamId?: string;
    teamName?: string;
    teamLogo?: string;
    sportSlug?: string;
  };
  const entry = await followPlayer(user.id, {
    playerId: id,
    playerName: body.playerName || 'Unknown',
    playerHeadshot: body.playerHeadshot,
    teamId: body.teamId,
    teamName: body.teamName,
    teamLogo: body.teamLogo,
    sportSlug: body.sportSlug,
  });
  return NextResponse.json({ following: true, entry });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await unfollowPlayer(user.id, id);
  return NextResponse.json({ following: false });
}
