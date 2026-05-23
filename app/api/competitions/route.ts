import { NextResponse } from 'next/server';
import { getCompetitionsAsync, publicCompetitionSummary } from '@/lib/competitions-store';
import { query } from '@/lib/db';

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

  const countMap = new Map<number, number>();

  try {
    await Promise.all(
      summaries
        .filter(c => c.status !== 'completed')
        .map(async comp => {
          try {
            const { conditions, params } = buildTipFilter(comp);
            const res = await query<{ cnt: number }>(
              `SELECT COUNT(DISTINCT tipster_id) AS cnt FROM auto_tips WHERE ${conditions.join(' AND ')}`,
              params,
            );
            const cnt = Number(res.rows[0]?.cnt ?? 0);
            countMap.set(comp.id, cnt);
          } catch { /* DB unavailable */ }
        })
    );
  } catch { /* ignore batch-level errors */ }

  const enriched = summaries.map(c => ({
    ...c,
    currentParticipants: countMap.has(c.id) ? countMap.get(c.id)! : c.currentParticipants,
  }));

  return NextResponse.json({
    success: true,
    competitions: enriched,
    stats: {
      active: enriched.filter(c => c.status === 'active').length,
      upcoming: enriched.filter(c => c.status === 'upcoming').length,
      totalParticipants: enriched.reduce((s, c) => s + c.currentParticipants, 0),
      totalPrizePool: enriched.reduce((s, c) => s + c.prizePool, 0),
    },
  });
}
