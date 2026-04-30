import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { followTeam, unfollowTeam, isFollowingTeam } from '@/lib/follows-store';
import { extractNumericTeamId } from '@/lib/utils/slug';

export const dynamic = 'force-dynamic';

// Normalise any incoming team id shape (legacy `espn_xxx_id`, slug-id,
// or bare numeric) to the bare ESPN team id used as the canonical storage
// key. This ensures the same team is followed/unfollowed/listed
// consistently no matter which URL form the user came from.
function normaliseTeamKey(raw: string): string {
  return extractNumericTeamId(raw) || raw;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ following: false, authenticated: false });
  const { id } = await params;
  const following = await isFollowingTeam(user.userId, normaliseTeamKey(id));
  return NextResponse.json({ following, authenticated: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to follow teams' }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const entry = await followTeam(user.userId, {
    teamId: normaliseTeamKey(id),
    teamName: body.teamName || 'Unknown team',
    teamLogo: body.teamLogo || null,
    leagueId: body.leagueId ?? null,
    leagueSlug: body.leagueSlug || null,
    leagueName: body.leagueName || null,
    sportSlug: body.sportSlug || null,
    countryCode: body.countryCode || null,
  });
  return NextResponse.json({ success: true, follow: entry });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  await unfollowTeam(user.userId, normaliseTeamKey(id));
  return NextResponse.json({ success: true });
}
