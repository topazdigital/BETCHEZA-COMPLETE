import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getCurrentUser } from '@/lib/auth';

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

function getDayOfWeek(weekStart: string, date: Date): number {
  const start = new Date(weekStart);
  const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(6, diff));
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

function loadCurrentWeek(): WeeklyStrategy {
  const weekId = getWeekId(new Date());
  const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
  if (stored && stored.weekId === weekId) return stored;
  return buildEmptyWeek(weekId);
}

function loadPastWeeks(): WeeklyStrategy[] {
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
  const current = loadCurrentWeek();
  const past = loadPastWeeks();
  return NextResponse.json({ current, past });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const weekId = getWeekId(new Date());
  const current = loadCurrentWeek();

  if (body.picks && typeof body.day === 'number') {
    const dayIdx = body.day - 1;
    if (dayIdx >= 0 && dayIdx < current.days.length) {
      current.days[dayIdx].picks = body.picks;
      const combined = body.picks.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
      current.days[dayIdx].combinedOdds = parseFloat(combined.toFixed(2));
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
    }
    fileStoreSet(`strategy-week-${weekId}`, current);
    return NextResponse.json({ success: true, week: current });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
