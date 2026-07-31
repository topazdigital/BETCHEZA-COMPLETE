import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { voteCommunity, getCommunityVotes } from '@/lib/challenges-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const challengeId = Number(params.id);
  if (!challengeId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const user = await getCurrentUser();
  const result = await getCommunityVotes(challengeId, user?.id);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const challengeId = Number(params.id);
  if (!challengeId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json() as { side?: string };
  const side = body.side;
  if (side !== 'challenger' && side !== 'opponent') {
    return NextResponse.json({ error: 'side must be challenger or opponent' }, { status: 400 });
  }

  const result = await voteCommunity(challengeId, user.id, side);
  return NextResponse.json(result);
}
