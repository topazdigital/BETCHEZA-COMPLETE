/**
 * Shared settlement logic for strategy picks.
 * Used by both the settle route and the admin bulk-resettle endpoint.
 */

import type { StrategyPick } from '@/app/api/strategy/predictions/route';

export function normalizeTeam(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Word-level fuzzy team name match.
 * "FC Motagua" matches "Motagua" because "Motagua" appears in both.
 */
export function matchTeamWords(teamA: string, teamB: string): boolean {
  const wordsA = teamA.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const wordsB = teamB.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  return wordsA.some(wa => wordsB.some(wb => wa === wb || wa.includes(wb) || wb.includes(wa)));
}

/**
 * Determine if a strategy pick won or lost based on the final score.
 *
 * Supports:
 *  - Double Chance (1X, X2, 12, "Team or Draw", "Draw or Team")
 *  - 1X2 / Match Result (name, "1","2","X", "Home Win", "Away Win", "Draw")
 *  - Over / Under (any line — e.g. Over 2.5, Under 3.5)
 *  - BTTS (Both Teams to Score — Yes / No)
 *  - Draw No Bet
 *
 * Returns null when the market is unrecognised or data is insufficient.
 */
export function checkPickResult(
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

  // ── Double Chance ──────────────────────────────────────────────────────────
  if (market === 'double chance' || market.includes('double chance')) {

    // 1X — Home or Draw
    const is1X =
      pickRaw === '1x' || pickRaw === 'home or draw' || pickRaw === 'home/draw' ||
      pickRaw === '1x (home or draw)' || pickRaw === 'home or draw (1x)' ||
      (pickRaw.includes('home') && pickRaw.includes('draw') && !pickRaw.includes('away')) ||
      (market.includes('double chance') && pickRaw.includes('1x'));

    // X2 — Away or Draw
    const isX2 =
      pickRaw === 'x2' || pickRaw === 'away or draw' || pickRaw === 'away/draw' ||
      pickRaw === 'x2 (away or draw)' || pickRaw === 'away or draw (x2)' ||
      (pickRaw.includes('away') && pickRaw.includes('draw') && !pickRaw.includes('home')) ||
      (market.includes('double chance') && pickRaw.includes('x2'));

    // 12 — Home or Away (no draw)
    const is12 =
      pickRaw === '12' || pickRaw === 'home or away' || pickRaw === 'home/away' ||
      pickRaw.includes('12 (home or away)') ||
      (pickRaw.includes('home') && pickRaw.includes('away') && !pickRaw.includes('draw'));

    if (is1X) return homeScore >= awayScore ? 'win' : 'loss';
    if (isX2) return awayScore >= homeScore ? 'win' : 'loss';
    if (is12) return homeScore !== awayScore ? 'win' : 'loss';

    // "{Team Name} or Draw" / "Draw or {Team Name}" — team name in the pick instead of home/away
    if (pickRaw.includes('or draw') || pickRaw.includes('draw or')) {
      // Home team in pick → 1X (home or draw)
      if (homeNorm.length > 2 && pickNorm.includes(homeNorm)) {
        return homeScore >= awayScore ? 'win' : 'loss';
      }
      // Away team in pick → X2 (away or draw)
      if (awayNorm.length > 2 && pickNorm.includes(awayNorm)) {
        return awayScore >= homeScore ? 'win' : 'loss';
      }
      // Partial word matching for abbreviated names
      const homeWords = pick.homeTeam.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const awayWords = pick.awayTeam.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const w of homeWords) {
        if (pickRaw.includes(w)) return homeScore >= awayScore ? 'win' : 'loss';
      }
      for (const w of awayWords) {
        if (pickRaw.includes(w)) return awayScore >= homeScore ? 'win' : 'loss';
      }
      // "draw or ..." → X2; "... or draw" → 1X
      if (pickRaw.startsWith('draw or')) return awayScore >= homeScore ? 'win' : 'loss';
      return homeScore >= awayScore ? 'win' : 'loss';
    }

    // Catch-all: team name anywhere in pick
    if (homeNorm.length > 2 && pickNorm.includes(homeNorm)) return homeScore >= awayScore ? 'win' : 'loss';
    if (awayNorm.length > 2 && pickNorm.includes(awayNorm)) return awayScore >= homeScore ? 'win' : 'loss';

    return null;
  }

  // ── Draw No Bet ────────────────────────────────────────────────────────────
  if (pickRaw.includes('draw no bet') || pickRaw.startsWith('dnb') || market.includes('draw no bet')) {
    if (isDraw) return null; // push/void — keep pending
    const isHome = pickRaw.includes('home') || pickNorm.includes(homeNorm);
    const isAway = pickRaw.includes('away') || pickNorm.includes(awayNorm);
    if (isHome) return homeWin ? 'win' : 'loss';
    if (isAway) return awayWin ? 'win' : 'loss';
    return null;
  }

  // ── 1X2 / Match Result ─────────────────────────────────────────────────────
  if (
    market === '1x2' || market === 'match result' || market === 'match winner' ||
    market === 'full time result' || market === 'ft result' ||
    market.includes('match result') || market.includes('1x2') || market === ''
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
    // Team-name word matching
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

  // ── Over / Under ───────────────────────────────────────────────────────────
  if (
    market.includes('over') || market.includes('under') || market.includes('total') ||
    market.includes('o/u') || market === 'over/under' || market === 'total goals'
  ) {
    if (market.includes('corner') || pickRaw.includes('corner')) return null;
    if (market.includes('card') || pickRaw.includes('card')) return null;

    const overMatch  = pickRaw.match(/over\s*([\d.]+)/i);
    const underMatch = pickRaw.match(/under\s*([\d.]+)/i);
    if (overMatch)  return total > parseFloat(overMatch[1])  ? 'win' : 'loss';
    if (underMatch) return total < parseFloat(underMatch[1]) ? 'win' : 'loss';

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

  // ── BTTS ───────────────────────────────────────────────────────────────────
  if (
    market === 'btts' || market === 'both teams to score' ||
    market.includes('btts') || market.includes('both teams to score')
  ) {
    const bothScored = homeScore > 0 && awayScore > 0;
    const isYes =
      pickRaw === 'yes' || pickRaw.includes('- yes') || pickRaw.endsWith(' yes') ||
      pickRaw.includes('btts yes') || pickRaw.includes('both teams to score yes') ||
      (!pickRaw.includes('no') && (pickRaw.includes('both') || pickRaw === 'yes'));
    const isNo =
      pickRaw === 'no' || pickRaw.includes('- no') || pickRaw.endsWith(' no') ||
      pickRaw.includes('btts no') || pickRaw.includes('both teams to score no');

    if (isYes) return bothScored ? 'win' : 'loss';
    if (isNo)  return !bothScored ? 'win' : 'loss';
    return bothScored ? 'win' : 'loss'; // default yes
  }

  return null; // unrecognised market
}

/**
 * Parse a stored "1-2" or "1 - 2" score string into { home, away }.
 */
export function parseStoredScore(score: string | undefined | null): { home: number; away: number } | null {
  if (!score) return null;
  const m = score.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (!m) return null;
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

/**
 * Bulk re-settle all historical strategy picks in the DB.
 *
 * Pass 1 — picks that already have actualScore stored: re-run checkPickResult
 *           to fix any that were settled wrong by old code.
 * Pass 2 — pending picks whose kickoff is in the past: try to settle using
 *           the supplied real-scores map (keyed by normalised "home_away").
 *
 * Only imports DB functions if a DB pool is available.
 * Returns the number of pick-results that were corrected.
 */
export async function resettleStrategyPicksFromResults(
  realScores: Map<string, { homeScore: number; awayScore: number; homeTeam: string; awayTeam: string }>,
  nowMs: number,
): Promise<number> {
  // Lazy-import to avoid circular deps and keep the module tree-shakeable.
  let queryFn: ((sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>) | null = null;
  let executeFn: ((sql: string, params?: unknown[]) => Promise<unknown>) | null = null;
  try {
    const db = await import('@/lib/db');
    queryFn  = db.query  as typeof queryFn;
    executeFn = db.execute as typeof executeFn;
  } catch { return 0; }
  if (!queryFn || !executeFn) return 0;

  interface DbRow { id: number; date: string; picks: string | null }
  interface StrategyPickRow {
    id: string; homeTeam: string; awayTeam: string; league?: string;
    matchTime?: string; pick: string; market: string; odds: number;
    confidence: string; reasoning?: string;
    result?: string | null; actualScore?: string | null;
  }

  let totalFixed = 0;
  const TWO_HOURS = 2 * 3600_000;

  try {
    const res = await queryFn(
      `SELECT id, date, picks FROM daily_strategy WHERE picks IS NOT NULL ORDER BY date DESC LIMIT 90`,
      []
    );
    const rows = res.rows as DbRow[];

    for (const row of rows) {
      let picks: StrategyPickRow[];
      try { picks = JSON.parse(row.picks || '[]'); } catch { continue; }

      let changed = false;
      const updated = picks.map(pick => {
        // ── Pass 1: re-settle from stored actualScore ──────────────────────
        const stored = parseStoredScore(pick.actualScore);
        if (stored) {
          const correct = checkPickResult(pick as Parameters<typeof checkPickResult>[0], stored.home, stored.away);
          if (correct && pick.result !== correct) {
            console.log(
              `[strategy-settle] PASS1 ${row.date} | ${pick.homeTeam} vs ${pick.awayTeam} | ` +
              `"${pick.pick}" | ${pick.actualScore} | ${pick.result ?? 'pending'} → ${correct}`
            );
            changed = true;
            totalFixed++;
            return { ...pick, result: correct };
          }
          return pick; // stored score but result already correct
        }

        // ── Pass 2: settle pending picks using real-scores map ─────────────
        if (pick.result !== 'pending') return pick;
        const kickoff = pick.matchTime ? new Date(pick.matchTime).getTime() : 0;
        if (nowMs - kickoff < TWO_HOURS) return pick;

        const pHomeN = normalizeTeam(pick.homeTeam);
        const pAwayN = normalizeTeam(pick.awayTeam);

        let match: { homeScore: number; awayScore: number } | null = null;
        for (const [, v] of realScores.entries()) {
          const vHomeN = normalizeTeam(v.homeTeam);
          const vAwayN = normalizeTeam(v.awayTeam);
          const homeOk =
            vHomeN === pHomeN || vHomeN.includes(pHomeN) || pHomeN.includes(vHomeN) ||
            matchTeamWords(v.homeTeam, pick.homeTeam);
          const awayOk =
            vAwayN === pAwayN || vAwayN.includes(pAwayN) || pAwayN.includes(vAwayN) ||
            matchTeamWords(v.awayTeam, pick.awayTeam);
          if (homeOk && awayOk) { match = v; break; }
        }
        if (!match) return pick;

        const result = checkPickResult(pick as Parameters<typeof checkPickResult>[0], match.homeScore, match.awayScore);
        if (!result) return pick;

        console.log(
          `[strategy-settle] PASS2 ${row.date} | ${pick.homeTeam} vs ${pick.awayTeam} | ` +
          `"${pick.pick}" | ${match.homeScore}-${match.awayScore} → ${result}`
        );
        changed = true;
        totalFixed++;
        return { ...pick, result, actualScore: `${match.homeScore}-${match.awayScore}` };
      });

      if (changed) {
        const allSettled = updated.every(p => p.result !== 'pending');
        const allWon = updated.filter(p => p.result !== 'pending').every(p => p.result === 'win');
        const dayResult = allSettled ? (allWon ? 'win' : 'loss') : null;
        await executeFn(
          `UPDATE daily_strategy SET picks = ?, result = ?, status = ?, settled_at = NOW() WHERE id = ?`,
          [JSON.stringify(updated), dayResult, allSettled ? 'completed' : 'active', row.id]
        );
      }
    }
  } catch (e) {
    console.warn('[strategy-settle] resettleStrategyPicksFromResults error:', e);
  }

  return totalFixed;
}
