import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

function toEATDate(d: Date): Date {
  return new Date(d.getTime() + EAT_OFFSET_MS);
}

function getWeekId(date: Date): string {
  const eat = toEATDate(date);
  const monday = new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate()));
  const day = monday.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

const WEEK_PLAN = [
  { stake: 1000,  save: 0,      targetWin: 3000  },
  { stake: 1500,  save: 1500,   targetWin: 4500  },
  { stake: 2500,  save: 2000,   targetWin: 7500  },
  { stake: 5000,  save: 2500,   targetWin: 15000 },
  { stake: 10000, save: 5000,   targetWin: 30000 },
  { stake: 15000, save: 15000,  targetWin: 45000 },
  { stake: 20000, save: 25000,  targetWin: 60000 },
];

// Manual full-win weeks override (matches instrumentation/predictions logic)
const MANUAL_WIN_WEEKS: Record<string, 'all'> = {
  '2025-05-12': 'all',
};

function buildManualAllWinsWeek(weekId: string): { weekId: string; weekProfit: number; weekStart: string; wins: number; losses: number } {
  const profit = WEEK_PLAN.reduce((sum, p) => sum + (p.targetWin - p.stake), 0);
  return {
    weekId,
    weekStart: weekId,
    weekProfit: profit,
    wins: 7,
    losses: 0,
  };
}

export async function GET() {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoff = ninetyDaysAgo.toISOString().slice(0, 10);
    const currentWeekId = getWeekId(new Date());

    const result = await query<{
      date: string; week_id: string; day_number: number; stake: number;
      target_win: number; status: string; result: 'win' | 'loss' | null; actual_return: number | null;
    }>(
      `SELECT date, week_id, day_number, stake, target_win, status, result, actual_return
       FROM daily_strategy
       WHERE date >= ? AND date < ?
       ORDER BY date ASC`,
      [cutoff, currentWeekId]
    );

    // Normalise week_id to Monday
    function normalizeWeekId(wid: string): string {
      const d = new Date(wid);
      const day = d.getUTCDay();
      if (day === 1) return wid;
      const diff = day === 0 ? 1 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().slice(0, 10);
    }

    const byWeek = new Map<string, typeof result.rows>();
    for (const row of result.rows) {
      const wid = normalizeWeekId(row.week_id);
      if (!byWeek.has(wid)) byWeek.set(wid, []);
      byWeek.get(wid)!.push(row);
    }

    // Collect per-week summaries, sorted by weekStart ascending
    const weekSummaries: { weekId: string; weekStart: string; weekProfit: number; wins: number; losses: number }[] = [];

    for (const [wid, rows] of byWeek) {
      if (MANUAL_WIN_WEEKS[wid] === 'all') {
        weekSummaries.push(buildManualAllWinsWeek(wid));
        continue;
      }
      // Dedup by date
      const uniqueByDate = new Map<string, typeof rows[0]>();
      for (const row of rows) {
        const ds = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10);
        const existing = uniqueByDate.get(ds);
        if (!existing || (!existing.result && row.result)) uniqueByDate.set(ds, row);
      }

      let weekProfit = 0;
      let wins = 0;
      let losses = 0;
      for (const row of uniqueByDate.values()) {
        if (row.result === 'win') {
          weekProfit += row.target_win - row.stake;
          wins++;
        } else if (row.result === 'loss') {
          weekProfit -= row.stake;
          losses++;
        }
      }

      // Only include weeks that have at least one settled day
      if (wins + losses > 0) {
        weekSummaries.push({ weekId: wid, weekStart: wid, weekProfit, wins, losses });
      }
    }

    weekSummaries.sort((a, b) => (a.weekStart > b.weekStart ? 1 : -1));

    // Build cumulative P&L points for chart
    let cumulative = 0;
    const chartPoints = weekSummaries.map(w => {
      cumulative += w.weekProfit;
      return {
        weekId: w.weekId,
        weekStart: w.weekStart,
        weekLabel: new Date(w.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        weekProfit: w.weekProfit,
        cumulativePnL: cumulative,
        wins: w.wins,
        losses: w.losses,
      };
    });

    const totalPnL = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].cumulativePnL : 0;
    const totalWins = weekSummaries.reduce((s, w) => s + w.wins, 0);
    const totalLosses = weekSummaries.reduce((s, w) => s + w.losses, 0);
    const bestWeekProfit = weekSummaries.length > 0 ? Math.max(...weekSummaries.map(w => w.weekProfit)) : 0;

    return NextResponse.json({
      chartPoints,
      totalPnL,
      totalWins,
      totalLosses,
      bestWeekProfit,
      weeksTracked: weekSummaries.length,
    });
  } catch (e) {
    console.error('[strategy/history]', e);
    // Return empty data on error instead of 500
    return NextResponse.json({
      chartPoints: [],
      totalPnL: 0,
      totalWins: 0,
      totalLosses: 0,
      bestWeekProfit: 0,
      weeksTracked: 0,
    });
  }
}
