import { NextRequest, NextResponse } from 'next/server';
import { getChallenges, settleChallenge } from '@/lib/challenges-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cron endpoint — auto-settles challenges past their endDate.
// Called by the cron scheduler or via GET /api/challenges/settle.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const active = await getChallenges('active');
    const now = new Date();
    const toSettle = active.filter(c => new Date(c.endDate) < now);

    let settled = 0;
    let draws = 0;

    for (const ch of toSettle) {
      // Determine winner by scoring method
      const p1 = ch.challenger;
      const p2 = ch.opponent;

      if (!p1 || !p2) {
        // No opponent — refund challenger (cancel)
        await settleChallenge(ch.id, null);
        draws++;
        continue;
      }

      let winnerId: number | null = null;

      if (ch.scoringMethod === 'win_rate') {
        const r1 = p1.tips > 0 ? p1.won / p1.tips : 0;
        const r2 = p2.tips > 0 ? p2.won / p2.tips : 0;
        if (Math.abs(r1 - r2) < 0.01) winnerId = null; // draw
        else winnerId = r1 > r2 ? p1.userId : p2.userId;
      } else if (ch.scoringMethod === 'roi') {
        if (Math.abs(p1.roi - p2.roi) < 0.5) winnerId = null;
        else winnerId = p1.roi > p2.roi ? p1.userId : p2.userId;
      } else if (ch.scoringMethod === 'streak') {
        if (p1.streak === p2.streak) winnerId = null;
        else winnerId = p1.streak > p2.streak ? p1.userId : p2.userId;
      }

      const result = await settleChallenge(ch.id, winnerId);
      if (result.ok) {
        settled++;
        if (result.isDraw) draws++;
      }
    }

    return NextResponse.json({ ok: true, checked: toSettle.length, settled, draws });
  } catch (e) {
    console.error('[challenges/settle]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
