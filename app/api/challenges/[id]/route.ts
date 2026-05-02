import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getChallengeById, acceptChallenge, cancelChallenge } from '@/lib/challenges-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = await getChallengeById(Number(id));
  if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ challenge });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string };
  const challengeId = Number(id);

  if (body.action === 'accept') {
    const ok = await acceptChallenge(challengeId, user.id);
    if (!ok) return NextResponse.json({ error: 'Cannot accept this challenge' }, { status: 400 });
    const updated = await getChallengeById(challengeId);
    return NextResponse.json({ challenge: updated });
  }

  if (body.action === 'cancel') {
    const ok = await cancelChallenge(challengeId, user.id);
    if (!ok) return NextResponse.json({ error: 'Cannot cancel this challenge' }, { status: 400 });
    const updated = await getChallengeById(challengeId);
    return NextResponse.json({ challenge: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
