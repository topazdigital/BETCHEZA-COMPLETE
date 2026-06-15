import { NextResponse } from 'next/server';
import { getCompetitionsAsync, publicCompetitionSummary, getCachedParticipantCount, cacheParticipantCount } from '@/lib/competitions-store';
import { query } from '@/lib/db';
import { countLeaderboardParticipants } from '@/lib/competition-league-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildTipFilter(comp: ReturnType<typeof publicCompetitionSummary>) {
  const conditions: string[] = ['created_at >= ?', 'created_at <= ?'];
  const params: (string | number)[] = [comp.startDate, comp.endDate];

  const leagueName = (comp as { leagueName?: string | null }).leagueName;
  const sportFocus = comp.sportFocus;
  const matchKickoffFrom = (comp as { matchKickoffFrom?: string | null }).matchKickoffFrom;
  const matchKickoffTo = (comp as { matchKickoffTo?: string | null }).matchKickoffTo;

  if (matchKickoffFrom && matchKickoffTo) {
    conditions.push('kickoff >= ?');
    conditions.push('kickoff <= ?');
    params.push(matchKickoffFrom, matchKickoffTo);
  }

  if (leagueName) {
    conditions.push('league LIKE ?');
    params.push(`%${leagueName}%`);
  } else if (sportFocus && sportFocus !== 'multi-sport') {
    const sportMap: Record<string, string> = {
      football: 'Football', basketball: 'Basketball', tennis: 'Tennis',
      baseball: 'Baseball', 'ice-hockey': 'Hockey', mma: 'MMA',
      cricket: 'Cricket', rugby: 'Rugby', golf: 'Golf',
    };
    const label = sportMap[sportFocus];
    if (label) {
      conditions.push('sport LIKE ?');
      params.push(`%${label}%`);
    }
  }

  return { conditions, params };
}

export async function GET() {
  const all = await getCompetitionsAsync();
  const summaries = all.map(publicCompetitionSummary);

  // Step 1: DB entries count (real sign-ups) + leaderboard count for active competitions
  // Run both in parallel so the first request is fully populated.
  await Promise.all([
    // 1a. Real competition_entries rows
    (async () => {
      try {
        await Promise.all(
          summaries.map(async comp => {
            try {
              const res = await query<{ cnt: number }>(
                `SELECT COUNT(*) AS cnt FROM competition_entries WHERE competition_id = ?`,
                [comp.id],
              );
              const cnt = Number(res.rows[0]?.cnt ?? 0);
              if (cnt > 0) cacheParticipantCount(comp.id, cnt);
            } catch { /* DB unavailable */ }
          })
        );
      } catch { /* ignore */ }
    })(),

    // 1b. Leaderboard participant count for active/upcoming competitions with no cached value yet
    (async () => {
      const uncached = all.filter(
        c => (c.status === 'active' || c.status === 'upcoming') && getCachedParticipantCount(c.id) === null
      );
      await Promise.all(
        uncached.map(async c => {
          try {
            const cnt = await countLeaderboardParticipants({
              startDate: c.startDate,
              endDate: c.endDate,
              leagueId: c.leagueId,
              leagueName: c.leagueName,
              sportFocus: c.sportFocus,
              matchKickoffFrom: c.matchKickoffFrom,
              matchKickoffTo: c.matchKickoffTo,
            });
            if (cnt > 0) cacheParticipantCount(c.id, cnt);
          } catch { /* DB unavailable */ }
        })
      );
    })(),
  ]);

  // Step 2: Build enriched summaries using freshly populated cache
  const enriched = summaries.map(c => {
    const cachedCount = getCachedParticipantCount(c.id);
    const currentParticipants = cachedCount ?? c.currentParticipants;
    return { ...c, currentParticipants };
  });

  return NextResponse.json({
    success: true,
    competitions: enriched,
    stats: {
      active: enriched.filter(c => c.status === 'active' || c.status === 'upcoming').length,
      upcoming: enriched.filter(c => c.status === 'upcoming').length,
      totalParticipants: enriched.reduce((s, c) => s + c.currentParticipants, 0),
      totalPrizePool: enriched.reduce((s, c) => s + c.prizePool, 0),
    },
  });
}
