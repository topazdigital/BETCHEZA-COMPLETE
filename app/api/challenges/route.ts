import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getChallenges, createChallenge, acceptChallenge, seedFakeChallengesFromMatches,
  settlePendingChallenges, isFakeUserId, type MatchSnapshot,
} from '@/lib/challenges-store';
import type { PickSelection } from '@/lib/challenge-picks';
import { pickOptionsForSport } from '@/lib/challenge-picks';
import { getFakeTipsters } from '@/lib/fake-tipsters';
import { getBalance, debit } from '@/lib/wallet-store';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { query } from '@/lib/db';
import { getAllMatches } from '@/lib/api/unified-sports-api';

// ─── Fake tipster pick generation ─────────────────────────────────────────────
// Deterministic RNG seeded from opponent ID + match ID so same pair always
// gets the same picks (stable across page reloads).
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function generateFakePicks(opponentId: number, matchId: string, sport: string): PickSelection[] {
  const seed = (opponentId * 31337) ^ hashStr(matchId);
  const rand = rng(seed);
  const options = pickOptionsForSport(sport);
  // Shuffle options and take 1-3 picks (weighted: 50% chance 2 picks, 30% 1 pick, 20% 3 picks)
  const shuffled = [...options].sort(() => rand() - 0.5);
  const r = rand();
  const count = r < 0.30 ? 1 : r < 0.80 ? 2 : 3;
  // Avoid picking from the same group twice
  const picked: PickSelection[] = [];
  const usedGroups = new Set<string>();
  for (const opt of shuffled) {
    if (picked.length >= count) break;
    if (usedGroups.has(opt.group)) continue;
    picked.push({ pick: opt.value, odds: opt.defaultOdds, group: opt.group });
    usedGroups.add(opt.group);
  }
  return picked.length ? picked : [{ pick: shuffled[0].value, odds: shuffled[0].defaultOdds, group: shuffled[0].group }];
}

export const dynamic = 'force-dynamic';

// ─── Background: auto-accept any pending challenges where challengedId is a fake tipster ──
// Handles challenges that were created before the auto-accept logic was added.
let _lastAutoAcceptAt = 0;
function autoAcceptFakePendingInBackground() {
  const now = Date.now();
  if (now - _lastAutoAcceptAt < 5 * 60 * 1000) return;
  _lastAutoAcceptAt = now;
  (async () => {
    try {
      const pending = await getChallenges('pending');
      for (const c of pending) {
        if (!c.challengedId || !isFakeUserId(c.challengedId)) continue;
        if (c.challengedPick) continue; // already has picks
        const sport = c.matchSport || 'football';
        const fakePicks = generateFakePicks(c.challengedId, c.matchId, sport);
        await acceptChallenge(c.id, c.challengedId, fakePicks);
      }
    } catch { /* non-fatal */ }
  })();
}

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
  autoAcceptFakePendingInBackground();
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

    // Auto-accept immediately if opponent is a fake tipster — they never manually accept
    // so we generate deterministic picks for them right away so the Open slot fills in.
    if (opponentId && isFakeUserId(opponentId)) {
      try {
        const sport = body.matchSnapshot.sport || 'football';
        const fakePicks = generateFakePicks(opponentId, body.matchId.trim(), sport);
        await acceptChallenge(challenge.id, opponentId, fakePicks);
      } catch { /* non-fatal */ }
    }

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
