import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getChallenges, createChallenge, seedFakeChallengesFromMatches,
  settlePendingChallenges, isFakeUserId, type MatchSnapshot,
} from '@/lib/challenges-store';
import type { PickSelection } from '@/lib/challenge-picks';
import { getBalance, debit } from '@/lib/wallet-store';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { query } from '@/lib/db';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

// ─── Background seed throttle (re-seed every 10 min so fresh matches always appear) ──
let _lastSeedAt = 0;
function seedInBackground() {
  const now = Date.now();
  if (now - _lastSeedAt < 10 * 60 * 1000) return;
  _lastSeedAt = now;
  (async () => {
    try {
      const all = await getAllMatches();
      // Seed for upcoming AND live matches so challenges always have fresh battles
      const seedable = all
        .filter(m => {
          const s = (m.status || '').toLowerCase();
          return (
            s === 'scheduled' || s === 'upcoming' || s === '' ||
            s === 'live' || s === '1h' || s === '2h' || s === 'ht' ||
            s === 'inprogress' || s === 'halftime'
          );
        })
        .slice(0, 8)
        .map(m => {
          const leagueName = typeof m.league === 'string' ? m.league : (m.league as { name?: string })?.name || '';
          const sportObj = typeof m.sport === 'object' ? m.sport as { name?: string; slug?: string } : null;
          const sportSlug = sportObj?.slug || String(m.sport || 'football').toLowerCase();
          return {
            id: m.id,
            homeTeam: m.homeTeam?.name || 'Home',
            awayTeam: m.awayTeam?.name || 'Away',
            homeLogo: m.homeTeam?.logo || null,
            awayLogo: m.awayTeam?.logo || null,
            league: leagueName,
            sport: sportSlug,
            kickoff: m.kickoffTime || m.date || null,
            status: m.status || 'scheduled',
            homeScore: m.homeScore ?? null,
            awayScore: m.awayScore ?? null,
          } as MatchSnapshot;
        });
      await seedFakeChallengesFromMatches(seedable);
    } catch { /* non-fatal */ }
  })();
}

// ─── Background settlement throttle (auto-settle every 2 min) ────────────────
let _lastSettleAt = 0;
let _settleRunning = false;
function settleInBackground() {
  const now = Date.now();
  if (_settleRunning || now - _lastSettleAt < 2 * 60 * 1000) return;
  _settleRunning = true;
  _lastSettleAt = now;
  (async () => {
    try {
      const result = await settlePendingChallenges();
      if (result.settled > 0 || result.cancelled > 0) {
        console.log(`[challenges] Auto-settled ${result.settled}, auto-cancelled ${result.cancelled} challenge(s)`);
        // Reset seed throttle so new fake challenges can be seeded for fresh matches
        _lastSeedAt = 0;
      }
    } catch { /* non-fatal */ } finally {
      _settleRunning = false;
    }
  })();
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'all';
  // Auto-settle finished challenges before returning, then seed fresh ones
  settleInBackground();
  seedInBackground();
  try {
    const challenges = await getChallenges(status as 'all' | 'pending' | 'active' | 'settled' | 'cancelled');
    return NextResponse.json({ challenges });
  } catch (e) {
    console.error('[challenges GET]', e);
    return NextResponse.json({ challenges: [] });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as {
      matchId?: string;
      matchSnapshot?: MatchSnapshot;
      picks?: PickSelection[];
      challengerPick?: string;  // legacy single-pick fallback
      opponentId?: number | null;
      stakeKes?: number;
      isPublic?: boolean;
    };

    if (!body.matchId?.trim()) {
      return NextResponse.json({ error: 'Please select a match for this challenge' }, { status: 400 });
    }
    if (!body.matchSnapshot?.homeTeam) {
      return NextResponse.json({ error: 'Match details are required' }, { status: 400 });
    }

    const picks: PickSelection[] = body.picks?.length
      ? body.picks
      : body.challengerPick
        ? [{ pick: body.challengerPick, odds: 2.00, group: 'Match Result' }]
        : [];

    if (!picks.length) {
      return NextResponse.json({ error: 'Please select at least one prediction' }, { status: 400 });
    }

    const stakeKes = Math.max(0, Math.round(body.stakeKes ?? 0));
    const opponentId = body.opponentId || null;

    if (opponentId !== null) {
      if (!isFakeUserId(opponentId) && isFakeUserId(user.id)) {
        return NextResponse.json({ error: 'Fake tipsters cannot challenge real users.' }, { status: 400 });
      }
    }

    if (stakeKes > 0 && !isFakeUserId(user.id)) {
      const balance = getBalance(user.id);
      if (balance < stakeKes) {
        return NextResponse.json({
          error: 'Insufficient wallet balance',
          insufficientBalance: true,
          topUpNeeded: stakeKes - balance,
          walletBalance: balance,
          stakeKes,
        }, { status: 402 });
      }
      const debitResult = debit(user.id, stakeKes, {
        type: 'competition_entry',
        description: `Challenge stake: ${body.matchSnapshot.homeTeam} vs ${body.matchSnapshot.awayTeam}`,
        meta: { matchId: body.matchId, picks: picks.map(p => p.pick).join(', ') },
      });
      if (!debitResult.ok) {
        return NextResponse.json({ error: debitResult.error, insufficientBalance: true, walletBalance: debitResult.balance, stakeKes }, { status: 402 });
      }
    }

    const challenge = await createChallenge({
      matchId: body.matchId.trim(),
      matchSnapshot: body.matchSnapshot,
      challengerId: user.id,
      challengerPicks: picks,
      challengedId: opponentId,
      stakeKes,
      isPublic: body.isPublic !== false,
      isFake: false,
    });

    if (opponentId && !isFakeUserId(opponentId)) {
      try {
        const { rows } = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [opponentId]);
        const pickDesc = picks.map(p => p.pick).join(' + ');
        await dispatchNotification({
          userId: opponentId, email: rows[0]?.email || null, type: 'system',
          title: '⚔️ You\'ve been challenged!',
          content: `${user.displayName || user.username} challenged you on ${body.matchSnapshot.homeTeam} vs ${body.matchSnapshot.awayTeam} — picking "${pickDesc}"${stakeKes > 0 ? ` · KES ${stakeKes.toLocaleString()} stake` : ''}.`,
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
