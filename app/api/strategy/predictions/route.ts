import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getCurrentUser } from '@/lib/auth';
import { query, execute } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface StrategyPick {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchTime: string;
  pick: string;
  market: string;
  odds: number;
  confidence: 'Low' | 'Medium' | 'High';
  reasoning: string;
  result?: 'win' | 'loss' | 'pending';
  actualScore?: string;
}

export interface DayPrediction {
  day: number;
  date: string;
  stake: number;
  save: number;
  targetWin: number;
  picks: StrategyPick[];
  combinedOdds: number;
  status: 'upcoming' | 'active' | 'completed';
  result?: 'win' | 'loss';
  actualReturn?: number;
}

export interface WeeklyStrategy {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  days: DayPrediction[];
  generatedAt: string;
  totalSavings: number;
  totalWinnings: number;
  weeklyProfit: number;
}

const WEEK_PLAN: Array<{ stake: number; save: number; targetWin: number }> = [
  { stake: 1000,  save: 0,      targetWin: 3000  },
  { stake: 1500,  save: 1500,   targetWin: 4500  },
  { stake: 2500,  save: 2000,   targetWin: 7500  },
  { stake: 5000,  save: 2500,   targetWin: 15000 },
  { stake: 10000, save: 5000,   targetWin: 30000 },
  { stake: 15000, save: 15000,  targetWin: 45000 },
  { stake: 20000, save: 25000,  targetWin: 60000 },
];

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

interface DbRow {
  date: string;
  week_id: string;
  day_number: number;
  stake: number;
  save_amount: number;
  target_win: number;
  combined_odds: number | string;
  status: 'upcoming' | 'active' | 'completed';
  result: 'win' | 'loss' | null;
  actual_return: number | null;
  picks: string | null;
}

async function loadFromDb(weekId: string): Promise<DayPrediction[] | null> {
  try {
    const weekStart = new Date(weekId);
    const weekEnd = new Date(weekId);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr = weekEnd.toISOString().slice(0, 10);

    const result = await query<DbRow>(
      'SELECT * FROM daily_strategy WHERE date >= ? AND date <= ? ORDER BY date ASC',
      [startStr, endStr]
    );
    if (!result.rows.length) return null;

    const days: DayPrediction[] = result.rows.map((row) => ({
      day: row.day_number,
      date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
      stake: row.stake,
      save: row.save_amount,
      targetWin: row.target_win,
      picks: row.picks ? JSON.parse(row.picks) as StrategyPick[] : [],
      combinedOdds: parseFloat(String(row.combined_odds)) || 0,
      status: row.status,
      result: row.result || undefined,
      actualReturn: row.actual_return || undefined,
    }));

    return days;
  } catch {
    return null;
  }
}

async function loadPastWeeksFromDb(): Promise<WeeklyStrategy[]> {
  const weeks: WeeklyStrategy[] = [];
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const result = await query<DbRow>(
      'SELECT * FROM daily_strategy WHERE date >= ? AND date < ? ORDER BY date DESC',
      [cutoff, getWeekId(new Date())]
    );

    const byWeek = new Map<string, DbRow[]>();
    for (const row of result.rows) {
      const wid = row.week_id;
      if (!byWeek.has(wid)) byWeek.set(wid, []);
      byWeek.get(wid)!.push(row);
    }

    for (const [wid, rows] of byWeek) {
      const weekStart = new Date(wid);
      const weekEnd = new Date(wid);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const days: DayPrediction[] = rows.map((row) => ({
        day: row.day_number,
        date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
        stake: row.stake,
        save: row.save_amount,
        targetWin: row.target_win,
        picks: row.picks ? JSON.parse(row.picks) as StrategyPick[] : [],
        combinedOdds: parseFloat(String(row.combined_odds)) || 0,
        status: row.status,
        result: row.result || undefined,
        actualReturn: row.actual_return || undefined,
      }));
      weeks.push({
        weekId: wid,
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        days,
        generatedAt: new Date().toISOString(),
        totalSavings: 0,
        totalWinnings: 0,
        weeklyProfit: 0,
      });
    }
  } catch { }
  return weeks;
}

function buildEmptyWeek(weekId: string): WeeklyStrategy {
  const weekStart = new Date(weekId);
  const weekEnd = new Date(weekId);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const days: DayPrediction[] = WEEK_PLAN.map((plan, i) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const today = new Date();
    const status: DayPrediction['status'] =
      dayDate.toDateString() === today.toDateString()
        ? 'active'
        : dayDate < today
        ? 'completed'
        : 'upcoming';

    return {
      day: i + 1,
      date: dayDate.toISOString().slice(0, 10),
      stake: plan.stake,
      save: plan.save,
      targetWin: plan.targetWin,
      picks: [],
      combinedOdds: 0,
      status,
    };
  });

  return {
    weekId,
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    days,
    generatedAt: new Date().toISOString(),
    totalSavings: 49000,
    totalWinnings: 60000,
    weeklyProfit: 108000,
  };
}

async function loadCurrentWeek(): Promise<WeeklyStrategy> {
  const weekId = getWeekId(new Date());

  // Try DB first
  const dbDays = await loadFromDb(weekId);
  if (dbDays && dbDays.length > 0) {
    const weekStart = new Date(weekId);
    const weekEnd = new Date(weekId);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const empty = buildEmptyWeek(weekId);
    // Merge: fill DB rows into the full 7-day skeleton
    const merged = empty.days.map((d) => {
      const fromDb = dbDays.find((r) => r.date === d.date);
      return fromDb ?? d;
    });
    return { ...empty, days: merged };
  }

  // File store fallback
  const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
  if (stored && stored.weekId === weekId) return stored;
  return buildEmptyWeek(weekId);
}

async function loadPastWeeks(): Promise<WeeklyStrategy[]> {
  // Try DB first
  const dbWeeks = await loadPastWeeksFromDb();
  if (dbWeeks.length > 0) return dbWeeks;

  // File store fallback
  const weeks: WeeklyStrategy[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const weekId = getWeekId(d);
    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) weeks.push(stored);
  }
  return weeks;
}

export async function GET() {
  const current = await loadCurrentWeek();
  const past = await loadPastWeeks();
  return NextResponse.json({ current, past });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const weekId = getWeekId(new Date());
  const current = await loadCurrentWeek();

  if (body.picks && typeof body.day === 'number') {
    const dayIdx = body.day - 1;
    if (dayIdx >= 0 && dayIdx < current.days.length) {
      current.days[dayIdx].picks = body.picks;
      const combined = body.picks.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
      current.days[dayIdx].combinedOdds = parseFloat(combined.toFixed(2));

      const dayData = current.days[dayIdx];
      try {
        await execute(
          `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), generated_at = NOW(), posted_at = NOW(), status = 'active'`,
          [dayData.date, weekId, dayData.day, dayData.stake, dayData.save, dayData.targetWin, dayData.combinedOdds, JSON.stringify(body.picks)]
        );
      } catch { }
    }
    fileStoreSet(`strategy-week-${weekId}`, current);
    return NextResponse.json({ success: true, week: current });
  }

  if (body.result && typeof body.day === 'number') {
    const dayIdx = body.day - 1;
    if (dayIdx >= 0 && dayIdx < current.days.length) {
      current.days[dayIdx].result = body.result;
      current.days[dayIdx].actualReturn = body.actualReturn;
      if (body.picksResults) {
        current.days[dayIdx].picks = current.days[dayIdx].picks.map((p, i) => ({
          ...p,
          result: body.picksResults[i] || p.result,
          actualScore: body.actualScores?.[i] || p.actualScore,
        }));
      }

      const dayData = current.days[dayIdx];
      try {
        await execute(
          `UPDATE daily_strategy SET result = ?, actual_return = ?, picks = ?, status = 'completed', settled_at = NOW()
           WHERE date = ?`,
          [body.result, body.actualReturn || null, JSON.stringify(dayData.picks), dayData.date]
        );
      } catch { }
    }
    fileStoreSet(`strategy-week-${weekId}`, current);
    return NextResponse.json({ success: true, week: current });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
