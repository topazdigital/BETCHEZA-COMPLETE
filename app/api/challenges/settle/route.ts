// Cron endpoint: auto-settle challenges whose match has finished.
// GET /api/challenges/settle?secret=CRON_SECRET  — cron trigger
// POST /api/challenges/settle  — admin manual trigger

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { settlePendingChallenges, settleChallenge, isFakeUserId } from '@/lib/challenges-store';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    const user = await getCurrentUser();
    if (!user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await settlePendingChallenges();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[challenges/settle GET]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as {
    challengeId?: number;
    homeScore?: number;
    awayScore?: number;
  };

  if (body.challengeId !== undefined && body.homeScore !== undefined && body.awayScore !== undefined) {
    const res = await settleChallenge(body.challengeId, body.homeScore, body.awayScore);
    if (res.ok) {
      // Notify participants
      try {
        const { getChallengeById } = await import('@/lib/challenges-store');
        const ch = await getChallengeById(body.challengeId);
        if (ch) {
          for (const uid of [ch.challengerId, ch.challengedId].filter(Boolean) as number[]) {
            if (isFakeUserId(uid)) continue;
            try {
              const { rows } = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [uid]);
              const isWinner = res.winnerId === uid;
              await dispatchNotification({
                userId: uid, email: rows[0]?.email || null, type: 'system',
                title: res.draw ? '🤝 Challenge draw — refunded' : isWinner ? '🏆 Challenge won!' : '❌ Challenge result',
                content: res.draw
                  ? `${ch.matchHomeTeam} vs ${ch.matchAwayTeam} ended in a draw. Your stake was refunded.`
                  : isWinner
                  ? `You won the challenge on ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}! KES ${Math.round(ch.stakeKes * 2 * 0.9).toLocaleString()} paid out.`
                  : `You lost the challenge on ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}.`,
                link: '/challenges',
              });
            } catch { /* non-fatal */ }
          }
        }
      } catch { /* non-fatal */ }
    }
    return NextResponse.json(res);
  }

  // Batch settle all active
  const result = await settlePendingChallenges();
  return NextResponse.json({ ok: true, ...result });
}
