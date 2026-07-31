import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listFollowedTeams, listFollowedTipsters } from '@/lib/follows-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ teams: [], tipsters: [], authenticated: false });
  const [teams, tipsters] = await Promise.all([
    listFollowedTeams(user.userId),
    listFollowedTipsters(user.userId),
  ]);
  return NextResponse.json({ teams, tipsters, authenticated: true });
}
