/**
 * Strategy Pick Auto-Settlement
 *
 * Checks finished matches against strategy picks and marks them win/loss.
 * Uses comprehensive market-aware logic — same ruleset as auto-tips-store.ts
 * determineTipOutcome to ensure consistency across the platform.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import type { WeeklyStrategy, StrategyPick } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeTeam(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Determine if a strategy pick won or lost.
 *
 * Supports:
 *  - Double Chance (1X, X2, 12, "Team or Draw", "Draw or Team")
 *  - 1X2 / Match Result (by name, "Home Win", "Away Win", "Draw", "1","2","X")
 *  - Over/Under (any line: 0.5, 1.5, 2.5, 3.5, 4.5 …)
 *  - BTTS (Both Teams to Score Yes/No)
 *  - Draw No Bet
 *
 * Returns null when the market is unrecognised or data is insufficient.
 */
function checkPickResult(
  pick: StrategyPick,
  homeScore: number,
  awayScore: number,
): 'win' | 'loss' | null {
  const market  = (pick.market || '').toLowerCase().trim();
  const pickRaw = (pick.pick  || '').toLowerCase().trim();

  const homeNorm = normalizeTeam(pick.homeTeam);
  const awayNorm = normalizeTeam(pick.awayTeam);
  const pickNorm = normalizeTeam(pickRaw);

  const total   = homeScore + awayScore;
  const homeWin = homeScore > awayScore;
  const awayWin = awayScore > homeScore;
  const isDraw  = homeScore === awayScore;

  // ── Double Chance ────────────────────────────────────────────────────────
  if (market === 'double chance' || market.includes('double chance')) {

    // 1X — Home or Draw
    const is1X =
      pickRaw === '1x' ||
      pickRaw === 'home or draw' ||
      pickRaw === 'home/draw' ||
      pickRaw === '1x (home or draw)' ||
      pickRaw === 'home or draw (1x)' ||
      (pickRaw.includes('home') && pickRaw.includes('draw') && !pickRaw.includes('away')) ||
      (market.includes('double chance') && pickRaw.includes('1x'));

    // X2 — Away or Draw
    const isX2 =
      pickRaw === 'x2' ||
      pickRaw === 'away or draw' ||
      pickRaw === 'away/draw' ||
      pickRaw === 'x2 (away or draw)' ||
      pickRaw === 'away or draw (x2)' ||
      (pickRaw.includes('away') && pickRaw.includes('draw') && !pickRaw.includes('home')) ||
      (market.includes('double chance') && pickRaw.includes('x2'));

    // 12 — Home or Away (no draw)
    const is12 =
      pickRaw === '12' ||
      pickRaw === 'home or away' ||
      pickRaw === 'home/away' ||
      pickRaw.includes('12 (home or away)') ||
      (pickRaw.includes('home') && pickRaw.includes('away') && !pickRaw.includes('draw'));

    if (is1X) return homeScore >= awayScore ? 'win' : 'loss';
    if (isX2) return awayScore >= homeScore ? 'win' : 'loss';
    if (is12) return homeScore !== awayScore ? 'win' : 'loss';

    // "{Team Name} or Draw" / "Draw or {Team Name}" — team name instead of home/away
    if (pickRaw.includes('or draw') || pickRaw.includes('draw or')) {
      // If the home team name is in the pick → 1X (home or draw)
      if (homeNorm.length > 2 && pickNorm.includes(homeNorm)) {
        return homeScore >= awayScore ? 'win' : 'loss';
      }
      // If the away team name is in the pick → X2 (away or draw)
      if (awayNorm.length > 2 && pickNorm.includes(awayNorm)) {
        return awayScore >= homeScore ? 'win' : 'loss';
      }
      // Try partial word matching for abbreviated team names
      const homeWords = pick.homeTeam.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const awayWords = pick.awayTeam.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const w of homeWords) {
        if (pickRaw.includes(w)) return homeScore >= awayScore ? 'win' : 'loss';
      }
      for (const w of awayWords) {
        if (pickRaw.includes(w)) return awayScore >= homeScore ? 'win' : 'loss';
      }
      // "draw or ..." pattern — treat as X2 (the non-home side)
      if (pickRaw.startsWith('draw or')) return awayScore >= homeScore ? 'win' : 'loss';
      // "... or draw" pattern — treat as 1X (the home/favoured side)
      return homeScore >= awayScore ? 'win' : 'loss';
    }

    // Catch-all using team name matching anywhere in pick
    if (homeNorm.length > 2 && pickNorm.includes(homeNorm)) return homeScore >= awayScore ? 'win' : 'loss';
    if (awayNorm.length > 2 && pickNorm.includes(awayNorm)) return awayScore >= homeScore ? 'win' : 'loss';

    return null;
  }

  // ── Draw No Bet ──────────────────────────────────────────────────────────
  if (pickRaw.includes('draw no bet') || pickRaw.startsWith('dnb') || market.includes('draw no bet')) {
    if (isDraw) return null; // push/void on draw — keep pending
    const isHome = pickRaw.includes('home') || pickNorm.includes(homeNorm);
    const isAway = pickRaw.includes('away') || pickNorm.includes(awayNorm);
    if (isHome) return homeWin ? 'win' : 'loss';
    if (isAway) return awayWin ? 'win' : 'loss';
    return null;
  }

  // ── 1X2 / Match Result ───────────────────────────────────────────────────
  if (
    market === '1x2' || market === 'match result' || market === 'match winner' ||
    market === 'full time result' || market === 'ft result' ||
    market === '1x2' || market.includes('match result') || market.includes('1x2') || market === ''
  ) {
    // Home win
    if (
      pickRaw === '1' || pickRaw === 'home' || pickRaw === 'home win' ||
      pickRaw === 'home team win' || pickRaw === 'home team to win' ||
      (homeNorm.length > 2 && pickNorm === homeNorm) ||
      (homeNorm.length > 2 && pickNorm.includes(homeNorm) && !pickRaw.includes('draw') && !pickRaw.includes('away'))
    ) {
      return homeWin ? 'win' : 'loss';
    }
    // Away win
    if (
      pickRaw === '2' || pickRaw === 'away' || pickRaw === 'away win' ||
      pickRaw === 'away team win' || pickRaw === 'away team to win' ||
      (awayNorm.length > 2 && pickNorm === awayNorm) ||
      (awayNorm.length > 2 && pickNorm.includes(awayNorm) && !pickRaw.includes('draw') && !pickRaw.includes('home'))
    ) {
      return awayWin ? 'win' : 'loss';
    }
    // Draw
    if (
      pickRaw === 'draw' || pickRaw === 'x' || pickRaw === 'the draw' ||
      pickRaw === 'draw (x)' || pickRaw === 'match draw' || pickRaw === 'full time draw'
    ) {
      return isDraw ? 'win' : 'loss';
    }
    // Team-name based pick (e.g. "Universidad Católica" → home win)
    const homeWords = pick.homeTeam.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const awayWords = pick.awayTeam.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const w of homeWords) {
      if (pickRaw.includes(w) && !pickRaw.includes('draw') && !pickRaw.includes('away')) {
        return homeWin ? 'win' : 'loss';
      }
    }
    for (const w of awayWords) {
      if (pickRaw.includes(w) && !pickRaw.includes('draw') && !pickRaw.includes('home')) {
        return awayWin ? 'win' : 'loss';
      }
    }
    return null;
  }

  // ── Over / Under ─────────────────────────────────────────────────────────
  if (
    market.includes('over') || market.includes('under') || market.includes('total') ||
    market.includes('o/u') || market === 'over/under' || market === 'total goals'
  ) {
    // Never settle corners/cards — needs extra data we don't have here
    if (market.includes('corner') || pickRaw.includes('corner')) return null;
    if (market.includes('card') || pickRaw.includes('card')) return null;

    // Extract the line (e.g. "Over 2.5 Goals" → 2.5)
    const overMatch  = pickRaw.match(/over\s*([\d.]+)/i);
    const underMatch = pickRaw.match(/under\s*([\d.]+)/i);

    if (overMatch) {
      const line = parseFloat(overMatch[1]);
      return total > line ? 'win' : 'loss';
    }
    if (underMatch) {
      const line = parseFloat(underMatch[1]);
      return total < line ? 'win' : 'loss';
    }

    // Fallback keywords
    if (pickRaw.includes('over 0.5'))  return total > 0.5  ? 'win' : 'loss';
    if (pickRaw.includes('under 0.5')) return total < 0.5  ? 'win' : 'loss';
    if (pickRaw.includes('over 1.5'))  return total > 1.5  ? 'win' : 'loss';
    if (pickRaw.includes('under 1.5')) return total < 1.5  ? 'win' : 'loss';
    if (pickRaw.includes('over 2.5'))  return total > 2.5  ? 'win' : 'loss';
    if (pickRaw.includes('under 2.5')) return total < 2.5  ? 'win' : 'loss';
    if (pickRaw.includes('over 3.5'))  return total > 3.5  ? 'win' : 'loss';
    if (pickRaw.includes('under 3.5')) return total < 3.5  ? 'win' : 'loss';
    if (pickRaw.includes('over 4.5'))  return total > 4.5  ? 'win' : 'loss';
    if (pickRaw.includes('under 4.5')) return total < 4.5  ? 'win' : 'loss';

    return null;
  }

  // ── BTTS ─────────────────────────────────────────────────────────────────
  if (
    market === 'btts' || market === 'both teams to score' ||
    market.includes('btts') || market.includes('both teams to score')
  ) {
    const bothScored = homeScore > 0 && awayScore > 0;
    const isYes = pickRaw === 'yes' || pickRaw.includes('- yes') || pickRaw.endsWith(' yes') ||
                  pickRaw.includes('btts yes') || pickRaw.includes('both teams to score yes') ||
                  (!pickRaw.includes('no') && (pickRaw.includes('both') || pickRaw === 'yes'));
    const isNo  = pickRaw === 'no' || pickRaw.includes('- no') || pickRaw.endsWith(' no') ||
                  pickRaw.includes('btts no') || pickRaw.includes('both teams to score no');

    if (isYes) return bothScored ? 'win' : 'loss';
    if (isNo)  return !bothScored ? 'win' : 'loss';
    return bothScored ? 'win' : 'loss'; // default yes interpretation
  }

  // Unrecognised market — keep pending
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
  const homeNorm = normalizeTeam(homeTeam);
  const awayNorm = normalizeTeam(awayTeam);

  // ── DB settlement ─────────────────────────────────────────────────────────
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
        if (pick.result !== 'pending') return pick;

        const pHome = normalizeTeam(pick.homeTeam);
        const pAway = normalizeTeam(pick.awayTeam);

        // Fuzzy team name matching (handles abbreviations and partial names)
        const homeMatch =
          pHome === homeNorm ||
          homeNorm.includes(pHome) || pHome.includes(homeNorm) ||
          matchTeamWords(pick.homeTeam, homeTeam);
        const awayMatch =
          pAway === awayNorm ||
          awayNorm.includes(pAway) || pAway.includes(awayNorm) ||
          matchTeamWords(pick.awayTeam, awayTeam);

        if (!homeMatch || !awayMatch) return pick;

        const result = checkPickResult(pick, homeScore, awayScore);
        if (!result) return pick; // market needs special data — keep pending

        changed = true;
        console.log(`[strategy/settle] ${pick.homeTeam} vs ${pick.awayTeam} | ${pick.market} | ${pick.pick} | score=${homeScore}-${awayScore} → ${result}`);
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

  // ── File-store settlement (up to 4 recent weeks) ─────────────────────────
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
        if (pick.result !== 'pending') return pick;

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
        return { ...pick, result, actualScore: `${homeScore}-${awayScore}` };
      });

      dayEntry.picks = updated;
      if (updated.every((p: StrategyPick) => p.result !== 'pending')) {
        const allWon = updated.every((p: StrategyPick) => p.result === 'win');
        dayEntry.result = allWon ? 'win' : 'loss';
        dayEntry.status = 'completed';
      }
    }
    if (weekChanged) fileStoreSet(`strategy-week-${weekId}`, stored);
  }

  return NextResponse.json({ success: true, updatedDays, dayId });
}

/**
 * Word-level fuzzy match for team names.
 * e.g. "FC Motagua" matches "Motagua" because "Motagua" is a word in both.
 */
function matchTeamWords(teamA: string, teamB: string): boolean {
  const wordsA = teamA.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const wordsB = teamB.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  return wordsA.some(wa => wordsB.some(wb => wa === wb || wa.includes(wb) || wb.includes(wa)));
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
