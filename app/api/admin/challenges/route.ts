import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getChallenges, getChallengeById, settleChallenge, cancelChallenge } from '@/lib/challenges-store';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface ChallengeRules {
  platformFeePct: number;
  drawPolicy: 'full_refund' | 'half_fee';
  minStakeKes: number;
  maxStakeKes: number;
  allowFreeChallenge: boolean;
  autoSettleEnabled: boolean;
  rulesText: string;
}

const DEFAULT_RULES: ChallengeRules = {
  platformFeePct: 10,
  drawPolicy: 'full_refund',
  minStakeKes: 0,
  maxStakeKes: 50000,
  allowFreeChallenge: true,
  autoSettleEnabled: true,
  rulesText: `Challenge Rules:\n• Both tipsters post predictions within the challenge window.\n• Platform takes ${10}% from the winner's pot when there is a clear winner.\n• On a draw, both parties receive a full refund — no fee charged.\n• If a challenge is cancelled before the opponent accepts, the challenger is fully refunded.\n• Fake tipster accounts cannot challenge real users.\n• Disputes are reviewed by admin within 48 hours.`,
};

export function getChallengeRules(): ChallengeRules {
  return fileStoreGet<ChallengeRules>('challenge-rules', DEFAULT_RULES);
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action');

  if (action === 'rules') {
    return NextResponse.json({ rules: getChallengeRules() });
  }

  // Default: list all challenges with stats
  const [all, active, pending, settled] = await Promise.all([
    getChallenges('all'),
    getChallenges('active'),
    getChallenges('pending'),
    getChallenges('settled'),
  ]);

  const totalStaked = all
    .filter(c => !c.isFake && c.stakeKes > 0 && c.escrowStatus !== 'refunded')
    .reduce((sum, c) => sum + c.stakeKes * 2, 0);

  const totalFeesCollected = settled
    .filter(c => !c.isFake && c.stakeKes > 0 && !c.drawRefunded)
    .reduce((sum, c) => sum + Math.round(c.stakeKes * 2 * (c.platformFeePct / 100)), 0);

  return NextResponse.json({
    challenges: all,
    stats: {
      total: all.length,
      active: active.length,
      pending: pending.length,
      settled: settled.length,
      totalStakedKes: totalStaked,
      totalFeesCollectedKes: totalFeesCollected,
    },
    rules: getChallengeRules(),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    challengeId?: number;
    winnerId?: number | null;
    rules?: Partial<ChallengeRules>;
  };

  if (body.action === 'settle' && body.challengeId !== undefined) {
    const result = await settleChallenge(body.challengeId, body.winnerId ?? null);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const updated = await getChallengeById(body.challengeId);
    return NextResponse.json({ challenge: updated, isDraw: result.isDraw });
  }

  if (body.action === 'cancel' && body.challengeId !== undefined) {
    const ch = await getChallengeById(body.challengeId);
    if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const ok = await cancelChallenge(body.challengeId, ch.challengerId);
    if (!ok) return NextResponse.json({ error: 'Cannot cancel' }, { status: 400 });
    const updated = await getChallengeById(body.challengeId);
    return NextResponse.json({ challenge: updated });
  }

  if (body.action === 'save_rules' && body.rules) {
    const current = getChallengeRules();
    const updated: ChallengeRules = { ...current, ...body.rules };
    fileStoreSet('challenge-rules', updated);
    return NextResponse.json({ rules: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
