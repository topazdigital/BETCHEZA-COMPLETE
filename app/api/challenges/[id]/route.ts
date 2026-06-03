import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getChallengeById, acceptChallenge, cancelChallenge, settleChallenge, isFakeUserId } from '@/lib/challenges-store';
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

  const body = await req.json().catch(() => ({})) as { action?: string; winnerId?: number | null };
  const challengeId = Number(id);

  if (body.action === 'accept') {
    // Fake tipsters cannot accept real challenges
    if (isFakeUserId(user.id)) {
      return NextResponse.json({ error: 'Cannot accept as a fake tipster' }, { status: 400 });
    }

    const ch = await getChallengeById(challengeId);
    if (!ch) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

    // Block fake vs real
    if (isFakeUserId(ch.challengerId) && !isFakeUserId(user.id)) {
      return NextResponse.json({ error: 'Cannot challenge a fake tipster with real money' }, { status: 400 });
    }

    const result = await acceptChallenge(challengeId, user.id);
    if (!result.ok) return NextResponse.json({ error: result.error || 'Cannot accept this challenge' }, { status: 400 });

    const updated = await getChallengeById(challengeId);

    // Notify challenger
    if (ch.challengerId && !isFakeUserId(ch.challengerId)) {
      try {
        let challengerEmail: string | null = null;
        try {
          const rows = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [ch.challengerId]);
          challengerEmail = rows.rows[0]?.email || null;
        } catch {}
        await dispatchNotification({
          userId: ch.challengerId,
          email: challengerEmail,
          type: 'system',
          title: '⚔️ Challenge accepted!',
          content: `${user.displayName || user.username} has accepted your challenge "${ch.title}"${ch.stakeKes > 0 ? ` — KES ${ch.stakeKes.toLocaleString()} is locked in. Battle begins!` : '!'}`,
          link: '/challenges',
        });
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ challenge: updated });
  }

  if (body.action === 'cancel') {
    const ch = await getChallengeById(challengeId);
    if (!ch) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (ch.challengerId !== user.id) return NextResponse.json({ error: 'Only the challenger can cancel' }, { status: 403 });

    const ok = await cancelChallenge(challengeId, user.id);
    if (!ok) return NextResponse.json({ error: 'Cannot cancel this challenge' }, { status: 400 });

    // Notify opponent if they had accepted
    if (ch.opponentId && !isFakeUserId(ch.opponentId)) {
      try {
        let opponentEmail: string | null = null;
        try {
          const rows = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [ch.opponentId]);
          opponentEmail = rows.rows[0]?.email || null;
        } catch {}
        await dispatchNotification({
          userId: ch.opponentId,
          email: opponentEmail,
          type: 'system',
          title: 'Challenge cancelled',
          content: `The challenge "${ch.title}" was cancelled by the creator.${ch.stakeKes > 0 ? ' Your stake has been refunded.' : ''}`,
          link: '/challenges',
        });
      } catch { /* non-fatal */ }
    }

    const updated = await getChallengeById(challengeId);
    return NextResponse.json({ challenge: updated });
  }

  if (body.action === 'settle') {
    // Only admin can manually settle
    if (!user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const result = await settleChallenge(challengeId, body.winnerId ?? null);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const updated = await getChallengeById(challengeId);

    // Notify both participants
    const ch = updated;
    if (ch) {
      const notifyUsers = [
        { id: ch.challengerId, name: ch.challenger?.displayName },
        ch.opponentId ? { id: ch.opponentId, name: ch.opponent?.displayName } : null,
      ].filter(Boolean) as { id: number; name: string | undefined }[];

      for (const u of notifyUsers) {
        if (isFakeUserId(u.id)) continue;
        const isWinner = body.winnerId === u.id;
        const isDraw = result.isDraw;
        try {
          await dispatchNotification({
            userId: u.id,
            type: 'system',
            title: isDraw ? '🤝 Challenge ended in a draw!' : isWinner ? '🏆 You won the challenge!' : '❌ Challenge result',
            content: isDraw
              ? `"${ch.title}" ended in a draw. Your KES ${ch.stakeKes.toLocaleString()} stake has been refunded.`
              : isWinner
              ? `You won "${ch.title}"! KES ${Math.round(ch.stakeKes * 2 * 0.9).toLocaleString()} has been credited to your wallet.`
              : `You lost "${ch.title}". Better luck next time!`,
            link: '/challenges',
          });
        } catch { /* non-fatal */ }
      }
    }

    return NextResponse.json({ challenge: updated, isDraw: result.isDraw });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
