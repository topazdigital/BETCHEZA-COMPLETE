/**
 * Strategy Pick Auto-Settlement
 *
 * Checks finished matches against strategy picks and marks them win/loss.
 * Settlement logic lives in lib/strategy-settle.ts (shared with admin resettle).
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { checkPickResult, normalizeTeam, matchTeamWords } from '@/lib/strategy-settle';
import type { WeeklyStrategy, StrategyPick } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RowResult {
  id: number;
  date: string;
  picks: string | null;
  result: string | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { date, dayId, homeScore, awayScore, homeTeam, awayTeam, force } = body as {
    date?: string;
    dayId?: string;
    homeScore?: number;
    awayScore?: number;
    homeTeam?: string;
    awayTeam?: string;
    force?: boolean;
  };

  if (!date || homeScore === undefined || awayScore === undefined || !homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: 'Required: date, homeTeam, awayTeam, homeScore, awayScore' },
      { status: 400 }
    );
  }

  const forceSettle = !!force;
  const updatedDays: string[] = [];
  const homeNorm = normalizeTeam(homeTeam);
  const awayNorm = normalizeTeam(awayTeam);
  const scoreStr = `${homeScore}-${awayScore}`;

  // ── DB settlement ──────────────────────────────────────────────────────────
  try {
    const rows = await query<RowResult>(
      `SELECT id, date, picks, result FROM daily_strategy WHERE date = ? AND picks IS NOT NULL LIMIT 1`,
      [date]
    );

    if (rows.rows.length > 0) {
      const row = rows.rows[0];
      const picks: StrategyPick[] = JSON.parse(row.picks || '[]');
      let changed = false;

      const updated = picks.map(pick => {
        if (pick.result !== 'pending' && !forceSettle) return pick;

        const pHome = normalizeTeam(pick.homeTeam);
        const pAway = normalizeTeam(pick.awayTeam);
        const homeMatch =
          pHome === homeNorm || homeNorm.includes(pHome) || pHome.includes(homeNorm) ||
          matchTeamWords(pick.homeTeam, homeTeam);
        const awayMatch =
          pAway === awayNorm || awayNorm.includes(pAway) || pAway.includes(awayNorm) ||
          matchTeamWords(pick.awayTeam, awayTeam);

        if (!homeMatch || !awayMatch) return pick;

        const result = checkPickResult(pick, homeScore, awayScore);
        if (!result) return pick;

        const wasWrong = forceSettle && pick.result && pick.result !== result;
        console.log(
          `[strategy/settle] ${pick.homeTeam} vs ${pick.awayTeam} | ${pick.market} | "${pick.pick}" | ` +
          `${homeScore}-${awayScore} → ${result}${wasWrong ? ` (corrected from ${pick.result})` : ''}`
        );
        changed = true;
        return { ...pick, result, actualScore: scoreStr };
      });

      if (changed) {
        const allSettled = updated.every(p => p.result !== 'pending');
        const settled = updated.filter(p => p.result !== 'pending');
        const allWon = settled.length > 0 && settled.every(p => p.result === 'win');
        const dayResult = allSettled ? (allWon ? 'win' : 'loss') : null;

        await execute(
          `UPDATE daily_strategy SET picks = ?, result = ?, status = ?, settled_at = NOW() WHERE id = ?`,
          [JSON.stringify(updated), dayResult, allSettled ? 'completed' : 'active', row.id]
        );
        updatedDays.push(date);
      }
    }
  } catch (e) {
    console.warn('[strategy/settle] DB error, trying file store:', e);
  }

  // ── File-store settlement (up to 4 recent weeks) ───────────────────────────
  const today = new Date();
  for (let w = 0; w < 4; w++) {
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = (day === 0 ? -6 : 1 - day) - w * 7;
    monday.setDate(monday.getDate() + diff);
    const weekId = monday.toISOString().slice(0, 10);
    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (!stored) continue;

    let weekChanged = false;
    for (const dayEntry of stored.days) {
      if (dayEntry.date !== date) continue;

      const updated = dayEntry.picks.map((pick: StrategyPick) => {
        if (pick.result !== 'pending' && !forceSettle) return pick;

        const pHome = normalizeTeam(pick.homeTeam);
        const pAway = normalizeTeam(pick.awayTeam);
        const homeMatch =
          pHome === homeNorm || homeNorm.includes(pHome) || pHome.includes(homeNorm) ||
          matchTeamWords(pick.homeTeam, homeTeam);
        const awayMatch =
          pAway === awayNorm || awayNorm.includes(pAway) || pAway.includes(awayNorm) ||
          matchTeamWords(pick.awayTeam, awayTeam);

        if (!homeMatch || !awayMatch) return pick;

        const result = checkPickResult(pick, homeScore, awayScore);
        if (!result) return pick;

        weekChanged = true;
        return { ...pick, result, actualScore: scoreStr };
      });

      dayEntry.picks = updated;
      const allSettled = updated.every((p: StrategyPick) => p.result !== 'pending');
      if (allSettled) {
        const allWon = updated.every((p: StrategyPick) => p.result === 'win');
        dayEntry.result = allWon ? 'win' : 'loss';
        dayEntry.status = 'completed';
      }
    }
    if (weekChanged) fileStoreSet(`strategy-week-${weekId}`, stored);
  }

  return NextResponse.json({ success: true, updatedDays, dayId });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  try {
    const rows = await query<RowResult>(
      `SELECT id, date, picks, result FROM daily_strategy WHERE date = ? LIMIT 1`,
      [date]
    );
    if (rows.rows.length > 0) {
      const row = rows.rows[0];
      const picks: StrategyPick[] = JSON.parse(row.picks || '[]');
      return NextResponse.json({ date, picks, dayResult: row.result, fromDb: true });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ date, picks: [], dayResult: null, fromDb: false });
}
