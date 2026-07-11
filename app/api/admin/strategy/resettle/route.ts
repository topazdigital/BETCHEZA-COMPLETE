/**
 * Admin: Bulk re-settle ALL historical strategy picks.
 *
 * Two-pass approach:
 *  Pass 1 — For every pick that already has actualScore stored ("1-2" format),
 *            re-run checkPickResult with the correct logic. This instantly
 *            corrects picks that were settled wrong by old code.
 *  Pass 2 — For pending picks whose kickoff is in the past, fetch real scores
 *            from the sports API and settle them.
 *
 * Returns a detailed report of corrections made.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getMatchById, getAllMatches } from '@/lib/api/unified-sports-api';
import { checkPickResult, parseStoredScore, normalizeTeam, matchTeamWords } from '@/lib/strategy-settle';
import { sendStrategyResultPush } from '@/lib/strategy-push';
import type { WeeklyStrategy, StrategyPick } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DbRow {
  id: number;
  date: string;
  day_number: number;
  picks: string | null;
  result: string | null;
  status: string;
}

interface PickCorrection {
  date: string;
  match: string;
  pick: string;
  score: string;
  was: string;
  now: string;
}

function finalizeDay(picks: StrategyPick[]): { result: 'win' | 'loss' | null; status: string } {
  const allSettled = picks.every(p => p.result !== 'pending');
  if (!allSettled) return { result: null, status: 'active' };
  // Void picks (no match data found) are neutral — don't count as losses.
  // A day with 2 wins + 1 void should still be recorded as "win".
  const nonVoid = picks.filter(p => p.result !== 'void');
  const allWon = nonVoid.length > 0 && nonVoid.every(p => p.result === 'win');
  return { result: allWon ? 'win' : 'loss', status: 'completed' };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // If dryRun=true, report what would change without saving
  const dryRun = body.dryRun === true;

  const corrections: PickCorrection[] = [];
  let pass1Fixed = 0;
  let pass2Fixed = 0;
  let daysUpdated = 0;

  // ── PASS 1: Re-settle picks with stored actualScore ───────────────────────
  // These need no API calls — we already have the score. We just re-run the
  // settlement logic which was fixed since the picks were originally settled.
  try {
    const rows = await query<DbRow>(
      `SELECT id, date, day_number, picks, result, status FROM daily_strategy WHERE picks IS NOT NULL ORDER BY date DESC LIMIT 90`,
      []
    );

    for (const row of rows.rows) {
      let picks: StrategyPick[];
      try { picks = JSON.parse(row.picks || '[]'); } catch { continue; }

      let dayChanged = false;

      const updated = picks.map(pick => {
        // Re-settle any pick that has a stored score (pending OR previously settled)
        const stored = parseStoredScore(pick.actualScore);
        if (!stored) return pick; // no stored score — handle in pass 2

        const correct = checkPickResult(pick, stored.home, stored.away);
        if (!correct) return pick; // unrecognisable market — leave alone

        // Already correct — no change needed
        if (pick.result === correct) return pick;

        const was = pick.result ?? 'pending';
        corrections.push({
          date: row.date,
          match: `${pick.homeTeam} vs ${pick.awayTeam}`,
          pick: `${pick.pick} (${pick.market})`,
          score: pick.actualScore!,
          was,
          now: correct,
        });
        dayChanged = true;
        pass1Fixed++;
        console.log(
          `[strategy/resettle] PASS1 ${row.date} | ${pick.homeTeam} vs ${pick.awayTeam} | ` +
          `"${pick.pick}" | ${pick.actualScore} | ${was} → ${correct}`
        );
        return { ...pick, result: correct };
      });

      if (dayChanged && !dryRun) {
        const wasUnsettled = row.status !== 'completed';
        const { result, status } = finalizeDay(updated);
        await execute(
          `UPDATE daily_strategy SET picks = ?, result = ?, status = ?, settled_at = NOW() WHERE id = ?`,
          [JSON.stringify(updated), result, status, row.id]
        );
        daysUpdated++;
        if (result && wasUnsettled) {
          sendStrategyResultPush(row.date, row.day_number || 0, result, updated).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('[strategy/resettle] Pass 1 DB error:', e);
  }

  // ── PASS 2: Settle pending picks using sports API real scores ─────────────
  // Only runs for picks WITHOUT a stored actualScore and past kickoff time.
  const TWO_HOURS = 2 * 3600_000;
  const now = Date.now();

  try {
    // Build a real-results map from the full match cache (one API call for all)
    const allMatches = await getAllMatches();
    const realScoreMap = new Map<string, { homeScore: number; awayScore: number; homeTeam: string; awayTeam: string }>();

    for (const m of allMatches) {
      if (m.status !== 'finished') continue;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') continue;
      const key = `${normalizeTeam(m.homeTeam?.name || '')}_${normalizeTeam(m.awayTeam?.name || '')}`;
      realScoreMap.set(key, {
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homeTeam: m.homeTeam?.name || '',
        awayTeam: m.awayTeam?.name || '',
      });
    }

    const rows = await query<DbRow>(
      `SELECT id, date, day_number, picks, result, status FROM daily_strategy WHERE picks IS NOT NULL ORDER BY date DESC LIMIT 90`,
      []
    );

    for (const row of rows.rows) {
      let picks: StrategyPick[];
      try { picks = JSON.parse(row.picks || '[]'); } catch { continue; }

      // Process this day if it has any pending picks OR settled picks whose
      // actualScore might differ from the API's final score (early-settlement bug).
      const hasWorkToDo = picks.some(p =>
        (p.result === 'pending' && !p.actualScore) ||
        (p.result && p.result !== 'pending' && p.actualScore)
      );
      if (!hasWorkToDo) continue;

      let dayChanged = false;

      const updated = await Promise.all(picks.map(async pick => {
        // For already-settled picks: check whether the API has a different final
        // score (happens when early settlement captured an intermediate score).
        if (pick.result !== 'pending') {
          if (!pick.actualScore) return pick; // no stored score — leave alone

          const pHomeN = normalizeTeam(pick.homeTeam);
          const pAwayN = normalizeTeam(pick.awayTeam);
          let apiMatch: { homeScore: number; awayScore: number } | null = null;
          for (const [, v] of realScoreMap.entries()) {
            const vHomeN = normalizeTeam(v.homeTeam);
            const vAwayN = normalizeTeam(v.awayTeam);
            const homeOk = vHomeN === pHomeN || vHomeN.includes(pHomeN) || pHomeN.includes(vHomeN) || matchTeamWords(v.homeTeam, pick.homeTeam);
            const awayOk = vAwayN === pAwayN || vAwayN.includes(pAwayN) || pAwayN.includes(vAwayN) || matchTeamWords(v.awayTeam, pick.awayTeam);
            if (homeOk && awayOk) { apiMatch = v; break; }
          }
          if (!apiMatch) return pick; // match not in API cache — can't verify

          const apiScoreStr = `${apiMatch.homeScore}-${apiMatch.awayScore}`;
          if (apiScoreStr === pick.actualScore) return pick; // scores agree — fine

          // API shows a different final score than what was stored — re-evaluate
          const correct = checkPickResult(pick, apiMatch.homeScore, apiMatch.awayScore);
          if (!correct || correct === pick.result) return { ...pick, actualScore: apiScoreStr }; // same result, just update score

          corrections.push({
            date: row.date,
            match: `${pick.homeTeam} vs ${pick.awayTeam}`,
            pick: `${pick.pick} (${pick.market})`,
            score: apiScoreStr,
            was: pick.result,
            now: correct,
          });
          dayChanged = true;
          pass2Fixed++;
          console.log(
            `[strategy/resettle] PASS2-CORRECT ${row.date} | ${pick.homeTeam} vs ${pick.awayTeam} | ` +
            `"${pick.pick}" | stored ${pick.actualScore} → API ${apiScoreStr} → ${correct}`
          );
          return { ...pick, result: correct, actualScore: apiScoreStr };
        }

        if (pick.actualScore) return pick; // has score — handled in pass 1

        // Only try to settle if kickoff was > 2 hours ago
        const kickoff = pick.matchTime ? new Date(pick.matchTime).getTime() : 0;
        if (now - kickoff < TWO_HOURS) return pick;

        // Try fuzzy match against real-score map
        const pHomeN = normalizeTeam(pick.homeTeam);
        const pAwayN = normalizeTeam(pick.awayTeam);

        let match: { homeScore: number; awayScore: number } | null = null;

        for (const [, v] of realScoreMap.entries()) {
          const vHomeN = normalizeTeam(v.homeTeam);
          const vAwayN = normalizeTeam(v.awayTeam);
          const homeOk =
            vHomeN === pHomeN || vHomeN.includes(pHomeN) || pHomeN.includes(vHomeN) ||
            matchTeamWords(v.homeTeam, pick.homeTeam);
          const awayOk =
            vAwayN === pAwayN || vAwayN.includes(pAwayN) || pAwayN.includes(vAwayN) ||
            matchTeamWords(v.awayTeam, pick.awayTeam);
          if (homeOk && awayOk) {
            match = v;
            break;
          }
        }

        if (!match) return pick; // not in cache — skip

        const result = checkPickResult(pick, match.homeScore, match.awayScore);
        if (!result) return pick;

        const scoreStr = `${match.homeScore}-${match.awayScore}`;
        corrections.push({
          date: row.date,
          match: `${pick.homeTeam} vs ${pick.awayTeam}`,
          pick: `${pick.pick} (${pick.market})`,
          score: scoreStr,
          was: 'pending',
          now: result,
        });
        dayChanged = true;
        pass2Fixed++;
        console.log(
          `[strategy/resettle] PASS2 ${row.date} | ${pick.homeTeam} vs ${pick.awayTeam} | ` +
          `"${pick.pick}" | ${scoreStr} → ${result}`
        );
        return { ...pick, result, actualScore: scoreStr };
      }));

      if (dayChanged && !dryRun) {
        const wasUnsettled = row.status !== 'completed';
        const { result, status } = finalizeDay(updated);
        await execute(
          `UPDATE daily_strategy SET picks = ?, result = ?, status = ?, settled_at = NOW() WHERE id = ?`,
          [JSON.stringify(updated), result, status, row.id]
        );
        daysUpdated++;
        if (result && wasUnsettled) {
          sendStrategyResultPush(row.date, row.day_number || 0, result, updated).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('[strategy/resettle] Pass 2 error:', e);
  }

  // ── Also fix the file store (recent weeks) ────────────────────────────────
  if (!dryRun) {
    for (let w = 0; w < 4; w++) {
      const monday = new Date();
      const day = monday.getDay();
      const diff = (day === 0 ? -6 : 1 - day) - w * 7;
      monday.setDate(monday.getDate() + diff);
      const weekId = monday.toISOString().slice(0, 10);
      const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
      if (!stored) continue;

      let weekChanged = false;
      for (const dayEntry of stored.days) {
        for (const correction of corrections) {
          if (correction.date !== dayEntry.date) continue;
          dayEntry.picks = dayEntry.picks.map((pick: StrategyPick) => {
            const matchLabel = `${pick.homeTeam} vs ${pick.awayTeam}`;
            const corrMatch = corrections.find(c =>
              c.date === dayEntry.date &&
              c.match === matchLabel &&
              c.pick.startsWith(pick.pick)
            );
            if (!corrMatch) return pick;
            weekChanged = true;
            return { ...pick, result: corrMatch.now as 'win' | 'loss', actualScore: corrMatch.score };
          });
          const { result, status } = finalizeDay(dayEntry.picks);
          dayEntry.result = result ?? undefined;
          dayEntry.status = status as 'upcoming' | 'active' | 'completed';
        }
      }
      if (weekChanged) fileStoreSet(`strategy-week-${weekId}`, stored);
    }
  }

  const totalFixed = pass1Fixed + pass2Fixed;
  console.log(`[strategy/resettle] Done — pass1=${pass1Fixed} pass2=${pass2Fixed} daysUpdated=${daysUpdated} dryRun=${dryRun}`);

  return NextResponse.json({
    success: true,
    dryRun,
    summary: {
      correctedFromStoredScore: pass1Fixed,
      settledFromSportsAPI:    pass2Fixed,
      totalFixed,
      daysUpdated,
    },
    corrections,
  });
}

// GET — dry-run preview without saving
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Reuse POST logic as dry-run
  return POST(new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ dryRun: true }),
  }));
}
