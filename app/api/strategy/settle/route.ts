/**
 * Strategy Pick Auto-Settlement
 *
 * Checks finished matches against strategy picks and marks them win/loss.
 * Call from admin panel or on a schedule after match end times.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import type { WeeklyStrategy, StrategyPick } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function checkPickResult(
  pick: StrategyPick,
  homeScore: number,
  awayScore: number,
): 'win' | 'loss' | null {
  const market = (pick.market || '').toLowerCase();
  const pickValue = (pick.pick || '').toLowerCase();
  const homeNorm = normalizeTeam(pick.homeTeam);
  const awayNorm = normalizeTeam(pick.awayTeam);
  const pickNorm = normalizeTeam(pickValue);

  if (market === '1x2') {
    if (homeScore > awayScore) {
      return pickNorm === homeNorm || pickValue.includes('home') || pickNorm === 'homewin' ? 'win' : 'loss';
    } else if (awayScore > homeScore) {
      return pickNorm === awayNorm || pickValue.includes('away') || pickNorm === 'awaywin' ? 'win' : 'loss';
    } else {
      return pickValue.toLowerCase().includes('draw') || pickNorm === 'draw' || pickNorm === 'x' ? 'win' : 'loss';
    }
  }

  if (market === 'double chance') {
    // X2 = Away or Draw: wins when away wins OR draw
    const isX2 = pickValue.includes('x2') || (pickValue.includes('away') && (pickValue.includes('draw') || pickValue.includes('or')));
    // 1X = Home or Draw: wins when home wins OR draw
    const is1X = pickValue.includes('1x') || (pickValue.includes('home') && (pickValue.includes('draw') || pickValue.includes('or')));
    if (isX2) return awayScore >= homeScore ? 'win' : 'loss';
    if (is1X) return homeScore >= awayScore ? 'win' : 'loss';

    // Handle "{Team Name} or Draw" / "Draw or {Team Name}" format where team name
    // replaces "home"/"away" — e.g. "FC Motagua or Draw"
    if (pickValue.includes('or draw') || pickValue.includes('draw or')) {
      const homeNormCheck = normalizeTeam(pick.homeTeam);
      const awayNormCheck = normalizeTeam(pick.awayTeam);
      // If home team name appears in the normalised pick → 1X (home or draw)
      if (homeNormCheck && homeNormCheck.length > 2 && pickNorm.includes(homeNormCheck)) {
        return homeScore >= awayScore ? 'win' : 'loss';
      }
      // If away team name appears in the normalised pick → X2 (away or draw)
      if (awayNormCheck && awayNormCheck.length > 2 && pickNorm.includes(awayNormCheck)) {
        return awayScore >= homeScore ? 'win' : 'loss';
      }
      // Unknown team — a draw should always win a "? or Draw" pick
      return homeScore >= awayScore ? 'win' : 'loss';
    }

    // 12 = Home or Away: wins when either team wins (no draw)
    return homeScore !== awayScore ? 'win' : 'loss';
  }

  if (market.includes('over') || market.includes('under') || market.includes('total') || market.includes('o/u') || market.includes('ou') || market === 'over/under' || market === 'total goals') {
    const totalGoals = homeScore + awayScore;
    const overMatch = pickValue.match(/over\s*([\d.]+)/i);
    const underMatch = pickValue.match(/under\s*([\d.]+)/i);
    // Corners market — requires corner data; without it keep pending (return null)
    if (market.includes('corner') || pickValue.includes('corner')) return null;
    if (overMatch) return totalGoals > parseFloat(overMatch[1]) ? 'win' : 'loss';
    if (underMatch) return totalGoals < parseFloat(underMatch[1]) ? 'win' : 'loss';
    if (pickValue.includes('over 2.5')) return totalGoals > 2.5 ? 'win' : 'loss';
    if (pickValue.includes('under 2.5')) return totalGoals < 2.5 ? 'win' : 'loss';
  }

  if (market === 'btts' || market === 'both teams to score') {
    const btts = homeScore > 0 && awayScore > 0;
    return pickValue.toLowerCase() === 'yes' ? (btts ? 'win' : 'loss') : (!btts ? 'win' : 'loss');
  }

  return null;
}

interface RowResult {
  id: number;
  date: string;
  picks: string | null;
  result: string | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { date, dayId, homeScore, awayScore, homeTeam, awayTeam } = body as {
    date?: string;
    dayId?: string;
    homeScore?: number;
    awayScore?: number;
    homeTeam?: string;
    awayTeam?: string;
  };

  if (!date || homeScore === undefined || awayScore === undefined || !homeTeam || !awayTeam) {
    return NextResponse.json({ error: 'Required: date, homeTeam, awayTeam, homeScore, awayScore' }, { status: 400 });
  }

  const updatedDays: string[] = [];

  try {
    const rows = await query<RowResult>(
      `SELECT id, date, picks, result FROM daily_strategy WHERE date = ? AND picks IS NOT NULL LIMIT 1`,
      [date]
    );

    if (rows.rows.length > 0) {
      const row = rows.rows[0];
      const picks: StrategyPick[] = JSON.parse(row.picks || '[]');
      let changed = false;

      const homeNorm = normalizeTeam(homeTeam);
      const awayNorm = normalizeTeam(awayTeam);

      const updated = picks.map(pick => {
        if (pick.result !== 'pending') return pick;
        const pHome = normalizeTeam(pick.homeTeam);
        const pAway = normalizeTeam(pick.awayTeam);
        const matchFound = (pHome === homeNorm || homeNorm.includes(pHome) || pHome.includes(homeNorm)) &&
                           (pAway === awayNorm || awayNorm.includes(pAway) || pAway.includes(awayNorm));
        if (!matchFound) return pick;

        const result = checkPickResult(pick, homeScore, awayScore);
        if (!result) return pick;
        changed = true;
        return { ...pick, result, actualScore: `${homeScore}-${awayScore}` };
      });

      if (changed) {
        const allSettled = updated.every(p => p.result !== 'pending');
        const allWon = updated.filter(p => p.result !== 'pending').every(p => p.result === 'win');
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

  const today = new Date();
  for (let w = 0; w < 4; w++) {
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = (day === 0 ? -6 : 1 - day) - w * 7;
    monday.setDate(monday.getDate() + diff);
    const weekId = monday.toISOString().slice(0, 10);
    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (!stored) continue;

    const homeNorm = normalizeTeam(homeTeam);
    const awayNorm = normalizeTeam(awayTeam);

    let weekChanged = false;
    for (const day of stored.days) {
      if (day.date !== date) continue;
      const updated = day.picks.map(pick => {
        if (pick.result !== 'pending') return pick;
        const pHome = normalizeTeam(pick.homeTeam);
        const pAway = normalizeTeam(pick.awayTeam);
        const matchFound = (pHome === homeNorm || homeNorm.includes(pHome) || pHome.includes(homeNorm)) &&
                           (pAway === awayNorm || awayNorm.includes(pAway) || pAway.includes(awayNorm));
        if (!matchFound) return pick;
        const result = checkPickResult(pick, homeScore, awayScore);
        if (!result) return pick;
        weekChanged = true;
        return { ...pick, result, actualScore: `${homeScore}-${awayScore}` };
      });
      day.picks = updated;
      if (updated.every(p => p.result !== 'pending')) {
        const allWon = updated.every(p => p.result === 'win');
        day.result = allWon ? 'win' : 'loss';
        day.status = 'completed';
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
