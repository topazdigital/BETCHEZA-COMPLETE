import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  addCompetition,
  updateCompetition,
  deleteCompetition,
  getCompetitionsAsync,
  getCompetitionByIdAsync,
  type NewCompetitionInput,
} from '@/lib/competitions-store';
import {
  validateCompetitionLeague,
  findLeagueRoundEndDate,
  migrateCompetitionsTable,
  computeLeaderboard,
} from '@/lib/competition-league-utils';
import { credit } from '@/lib/wallet-store';
import { execute } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let _migrated = false;
async function ensureMigrated() {
  if (_migrated) return;
  _migrated = true;
  await migrateCompetitionsTable();
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();
  const competitions = await getCompetitionsAsync();
  return NextResponse.json({ competitions });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();

  let body: Partial<NewCompetitionInput> & { roundBased?: boolean } = {};
  try { body = await req.json(); } catch {}

  if (!body.name || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: 'name, startDate, and endDate are required.' },
      { status: 400 },
    );
  }

  const name = String(body.name).trim();
  const validation = validateCompetitionLeague(name);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: validation.warning,
        hint: 'Use a recognised league name (e.g. "Premier League Weekly") or a generic name (e.g. "Weekly Tipster Challenge").',
        leagueList: 'See /api/admin/competitions/validate-league for all valid leagues.',
      },
      { status: 400 },
    );
  }

  const detected = validation.detected;
  const sportFocus = String(body.sportFocus || validation.sportFocus || 'multi-sport');

  let endDate = String(body.endDate);
  let roundBased = false;

  if (detected && body.type === 'weekly') {
    const roundEnd = await findLeagueRoundEndDate(
      detected.leagueName,
      String(body.startDate),
      endDate,
    );
    if (roundEnd) {
      endDate = roundEnd;
      roundBased = true;
    }
  }

  const defaultRules = detected
    ? [
        `Only ${detected.leagueName} matches count for scoring.`,
        'Minimum 3 tips required to appear on the leaderboard.',
        'Score = (wins × 10) + average win odds bonus − (losses × 5).',
        'Competition ends after the last match of the round.',
      ]
    : [
        'All sports and leagues are accepted.',
        'Minimum 3 tips required to appear on the leaderboard.',
        'Score = (wins × 10) + average win odds bonus − (losses × 5).',
        'Tie-breaker: win rate then ROI.',
      ];

  const comp = await addCompetition({
    name,
    description: String(body.description || ''),
    type: (body.type as NewCompetitionInput['type']) || 'weekly',
    status: body.status,
    startDate: String(body.startDate),
    endDate,
    prizePool: Number(body.prizePool || 0),
    currency: body.currency || 'KES',
    entryFee: Number(body.entryFee || 0),
    maxParticipants: Number(body.maxParticipants || 100),
    prizes: body.prizes,
    rules: (body.rules && body.rules.length > 0) ? body.rules : defaultRules,
    ruleConfig: Array.isArray(body.ruleConfig) ? body.ruleConfig : undefined,
    sportFocus,
    leagueId: detected?.leagueId ?? null,
    leagueName: detected?.leagueName ?? null,
    roundBased,
    matchKickoffFrom: body.matchKickoffFrom ? String(body.matchKickoffFrom) : null,
    matchKickoffTo: body.matchKickoffTo ? String(body.matchKickoffTo) : null,
  });

  return NextResponse.json({
    success: true,
    competition: comp,
    detectedLeague: detected ? { leagueId: detected.leagueId, leagueName: detected.leagueName } : null,
    roundBased,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();

  let body: { id?: number } & Partial<NewCompetitionInput> = {};
  try { body = await req.json(); } catch {}
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const compId = Number(body.id);

  // Snapshot the old status before update so we can detect a transition to completed
  const before = await getCompetitionByIdAsync(compId);
  const wasCompleted = before?.status === 'completed';

  let updated;
  try {
    updated = await updateCompetition(compId, body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${msg}` }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: 'Competition not found.' }, { status: 404 });
  }

  // Auto-distribute prizes when admin marks a competition as completed for the first time
  if (body.status === 'completed' && !wasCompleted && before) {
    try {
      await autoDistributePrizes(before.id, before, updated.prizes, updated.currency || 'KES');
    } catch (e) {
      console.error('[competitions] auto prize distribution failed:', e);
    }
  }

  return NextResponse.json({ success: true, competition: updated });
}

async function autoDistributePrizes(
  competitionId: number,
  comp: Awaited<ReturnType<typeof getCompetitionByIdAsync>>,
  prizes: Array<{ place: string; amount: number }>,
  currency: string,
) {
  if (!comp) return;

  // Compute the real leaderboard from actual tips
  const leaderboard = await computeLeaderboard({
    startDate: comp.startDate,
    endDate: comp.endDate,
    leagueId: comp.leagueId,
    leagueName: comp.leagueName,
    sportFocus: comp.sportFocus,
    matchKickoffFrom: comp.matchKickoffFrom,
    matchKickoffTo: comp.matchKickoffTo,
    minTips: 1,
    limit: 20,
    allowedUserIds: null,
  });

  if (leaderboard.length === 0) return;

  // Map prizes to ranked tipsters — parse prize tiers like "4-10th"
  let cursor = 0;
  for (const prize of prizes) {
    if (!prize.amount || prize.amount <= 0) continue;
    const m = prize.place.match(/(\d+)(?:[-–](\d+))?/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : start;
      for (let r = start; r <= end; r++) {
        const winner = leaderboard[r - 1];
        if (!winner) break;
        // Only credit real tipsters (fake tipsters have id >= 1000)
        if (winner.isFake || winner.userId >= 1000) continue;
        try {
          credit(winner.userId, prize.amount, {
            type: 'prize_payout',
            currency,
            method: 'system',
            reference: `comp-${competitionId}-rank-${r}`,
            description: `Prize — ${comp.name} (${prize.place})`,
            meta: { competitionId, competitionName: comp.name, place: prize.place, rank: r },
          });
          console.log(`[competitions] credited ${currency} ${prize.amount} to user ${winner.userId} (rank ${r}) for ${comp.name}`);
        } catch (e) {
          console.error(`[competitions] failed to credit user ${winner.userId}:`, e);
        }
      }
      cursor = end;
    } else {
      // No numeric range — assign to next slot
      const winner = leaderboard[cursor++];
      if (!winner) continue;
      if (winner.isFake || winner.userId >= 1000) continue;
      try {
        credit(winner.userId, prize.amount, {
          type: 'prize_payout',
          currency,
          method: 'system',
          reference: `comp-${competitionId}-rank-${cursor}`,
          description: `Prize — ${comp.name} (${prize.place})`,
          meta: { competitionId, competitionName: comp.name, place: prize.place, rank: cursor },
        });
      } catch { /* non-critical */ }
    }
  }

  // Store winner data in DB for the winner graphic on the frontend
  try {
    const top3 = leaderboard.slice(0, 3).map((w, i) => ({
      rank: i + 1,
      userId: w.userId,
      username: w.username,
      displayName: w.displayName || w.username,
      avatar: w.avatar || null,
      points: w.points,
      winRate: w.winRate,
      roi: w.roi,
      prize: prizes[i]?.amount ?? 0,
      isFake: w.isFake,
    }));
    await execute(
      `UPDATE competitions SET rule_config = JSON_MERGE_PATCH(COALESCE(rule_config, '{}'), ?) WHERE id = ?`,
      [JSON.stringify({ _winners: top3, _settledAt: new Date().toISOString() }), competitionId]
    ).catch(() => {
      // Fallback if JSON_MERGE_PATCH not supported
      execute(
        `UPDATE competitions SET kicked_users = ? WHERE id = ?`,
        [JSON.stringify({ _winners: top3 }), competitionId]
      ).catch(() => {});
    });
  } catch { /* non-critical */ }
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();

  const id = Number(req.nextUrl.searchParams.get('id') || 0);
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const ok = await deleteCompetition(id);
  if (!ok) {
    return NextResponse.json({ error: 'Competition not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
