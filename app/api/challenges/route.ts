import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getChallenges, createChallenge, seedFakeChallengesIfEmpty, isFakeUserId, type ScoringMethod } from '@/lib/challenges-store';
import { getBalance, debit } from '@/lib/wallet-store';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'all';
  try {
    seedFakeChallengesIfEmpty();
    const challenges = await getChallenges(status as 'all' | 'pending' | 'active' | 'finished' | 'cancelled');
    return NextResponse.json({ challenges });
  } catch {
    return NextResponse.json({ challenges: [] });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as {
      title?: string;
      description?: string;
      sport?: string;
      scoringMethod?: ScoringMethod;
      startDate?: string;
      endDate?: string;
      opponentId?: number | null;
      stakeKes?: number;
      isPublic?: boolean;
      maxTips?: number;
      matchScope?: string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }
    if (body.endDate <= body.startDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const stakeKes = Math.max(0, Math.round(body.stakeKes ?? 0));
    const opponentId = body.opponentId || null;

    // Block: fake tipster cannot challenge real user
    if (opponentId && !isFakeUserId(opponentId) && isFakeUserId(user.id)) {
      return NextResponse.json({ error: 'Fake tipsters cannot challenge real users.' }, { status: 400 });
    }
    if (opponentId && isFakeUserId(opponentId) && !isFakeUserId(user.id)) {
      return NextResponse.json({ error: 'You cannot challenge a fake tipster with a real money stake.' }, { status: 400 });
    }

    // Check + lock challenger wallet funds
    if (stakeKes > 0 && !isFakeUserId(user.id)) {
      const balance = getBalance(user.id);
      if (balance < stakeKes) {
        const topUpNeeded = stakeKes - balance;
        return NextResponse.json({
          error: 'Insufficient wallet balance',
          insufficientBalance: true,
          topUpNeeded,
          walletBalance: balance,
          stakeKes,
        }, { status: 402 });
      }
      const result = debit(user.id, stakeKes, {
        type: 'competition_entry',
        description: `Challenge stake locked: ${body.title?.trim()}`,
        meta: { challengeCreation: true },
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error, insufficientBalance: true, walletBalance: result.balance, stakeKes }, { status: 402 });
      }
    }

    const challenge = await createChallenge({
      title: body.title.trim(),
      description: body.description?.trim(),
      sport: body.sport || 'football',
      scoringMethod: body.scoringMethod || 'win_rate',
      startDate: body.startDate,
      endDate: body.endDate,
      challengerId: user.id,
      opponentId,
      stakeKes,
      isPublic: body.isPublic !== false,
      maxTips: body.maxTips || 10,
      isFakeChallenge: false,
      matchScope: body.matchScope,
    });

    // Notify named opponent
    if (opponentId && !isFakeUserId(opponentId)) {
      try {
        let opponentEmail: string | null = null;
        try {
          const rows = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [opponentId]);
          opponentEmail = rows.rows[0]?.email || null;
        } catch {}
        await dispatchNotification({
          userId: opponentId,
          email: opponentEmail,
          type: 'system',
          title: '⚔️ You\'ve been challenged!',
          content: `${user.displayName || user.username} has challenged you to "${challenge.title}"${stakeKes > 0 ? ` with a KES ${stakeKes.toLocaleString()} stake` : ''}.`,
          link: '/challenges',
        });
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ challenge }, { status: 201 });
  } catch (e) {
    console.error('[challenges POST]', e);
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
  }
}
