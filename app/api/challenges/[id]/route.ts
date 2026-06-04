import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getChallengeById, acceptChallenge, cancelChallenge, settleChallenge, isFakeUserId } from '@/lib/challenges-store';
import type { PickSelection } from '@/lib/challenge-picks';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { query } from '@/lib/db';

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

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    picks?: PickSelection[];  // multi-pick
    pick?: string;            // legacy single pick
    homeScore?: number;
    awayScore?: number;
  };
  const challengeId = Number(id);

  // ── ACCEPT ────────────────────────────────────────────────────────────────
  if (body.action === 'accept') {
    const picks: PickSelection[] = body.picks?.length
      ? body.picks
      : body.pick?.trim()
        ? [{ pick: body.pick.trim(), odds: 2.00, group: 'Match Result' }]
        : [];

    if (!picks.length) {
      return NextResponse.json({ error: 'You must select at least one prediction to accept' }, { status: 400 });
    }

    const ch = await getChallengeById(challengeId);
    if (!ch) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

    if (isFakeUserId(ch.challengerId) && !isFakeUserId(user.id)) {
      return NextResponse.json({ error: 'Cannot accept a fake tipster challenge with real stakes' }, { status: 400 });
    }

    const result = await acceptChallenge(challengeId, user.id, picks);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    if (!isFakeUserId(ch.challengerId)) {
      try {
        const { rows } = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [ch.challengerId]);
        const pickDesc = picks.map(p => p.pick).join(' + ');
        await dispatchNotification({
          userId: ch.challengerId, email: rows[0]?.email || null, type: 'system',
          title: '⚔️ Challenge accepted!',
          content: `${user.displayName || user.username} accepted your challenge on ${ch.matchHomeTeam} vs ${ch.matchAwayTeam} with picks: "${pickDesc}"${ch.stakeKes > 0 ? ` · KES ${ch.stakeKes.toLocaleString()} locked in!` : '.'}`,
          link: '/challenges',
        });
      } catch { /* non-fatal */ }
    }

    const updated = await getChallengeById(challengeId);
    return NextResponse.json({ challenge: updated });
  }

  // ── CANCEL ────────────────────────────────────────────────────────────────
  if (body.action === 'cancel') {
    const ch = await getChallengeById(challengeId);
    if (!ch) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (ch.challengerId !== user.id) return NextResponse.json({ error: 'Only the creator can cancel this challenge' }, { status: 403 });

    const ok = await cancelChallenge(challengeId, user.id);
    if (!ok) return NextResponse.json({ error: 'Cannot cancel this challenge' }, { status: 400 });

    if (ch.challengedId && !isFakeUserId(ch.challengedId)) {
      try {
        const { rows } = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [ch.challengedId]);
        await dispatchNotification({
          userId: ch.challengedId, email: rows[0]?.email || null, type: 'system',
          title: '❌ Challenge cancelled',
          content: `The challenge on ${ch.matchHomeTeam} vs ${ch.matchAwayTeam} was cancelled by the creator. Your stake has been refunded.`,
          link: '/challenges',
        });
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ ok: true });
  }

  // ── SETTLE (admin manual) ─────────────────────────────────────────────────
  if (body.action === 'settle') {
    if (!user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const ch = await getChallengeById(challengeId);
    if (!ch) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

    const homeScore = Number(body.homeScore ?? 0);
    const awayScore = Number(body.awayScore ?? 0);
    const res = await settleChallenge(challengeId, homeScore, awayScore);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

    const winner = res.winnerId;
    const payout = Math.round(ch.stakeKes * 2 * 0.9);
    for (const uid of [ch.challengerId, ch.challengedId].filter(Boolean) as number[]) {
      if (isFakeUserId(uid)) continue;
      try {
        const { rows } = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [uid]);
        const isWinner = winner === uid;
        const isDraw = res.draw;
        await dispatchNotification({
          userId: uid, email: rows[0]?.email || null, type: 'system',
          title: isDraw ? '🤝 Challenge draw — refunded' : isWinner ? '🏆 You won the challenge!' : '❌ Challenge lost',
          content: isDraw
            ? `The challenge on ${ch.matchHomeTeam} vs ${ch.matchAwayTeam} ended tied on points. Your KES ${ch.stakeKes.toLocaleString()} has been refunded.`
            : isWinner
            ? `You won the challenge on ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}! KES ${payout.toLocaleString()} credited to your wallet.`
            : `You lost the challenge on ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}.`,
          link: '/challenges',
        });
      } catch { /* non-fatal */ }
    }

    const updated = await getChallengeById(challengeId);
    return NextResponse.json({ challenge: updated, winnerId: res.winnerId, draw: res.draw });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
