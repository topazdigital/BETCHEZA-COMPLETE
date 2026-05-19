import { NextResponse } from 'next/server';
import {
  listAllAutoTips,
  settleTipWithResult,
  settleTipsByTeamNames,
  settleStaleAutoTips,
} from '@/lib/auto-tips-store';
import { getMatchById, getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

const SETTLE_SECRET = process.env.CRON_SECRET || 'betcheza-cron';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret && secret !== SETTLE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = Date.now();
  const TWO_HOURS = 2 * 3600_000;

  // Collect unique matchIds from:
  //  - pending tips whose kickoff is >2h ago
  //  - probabilistically-settled tips (settledByProb=true) that need real score override
  const allTips = listAllAutoTips(2000);
  const matchIds = new Set<string>();
  for (const tip of allTips) {
    const isProbSettled = tip.status !== 'pending' && tip.settledByProb === true;
    if (tip.status !== 'pending' && !isProbSettled) continue;
    if (!tip.kickoff) continue;
    const t = new Date(tip.kickoff).getTime();
    if (!Number.isFinite(t)) continue;
    if (now - t < TWO_HOURS) continue;
    matchIds.add(tip.matchId);
  }

  let settled = 0;
  let fetched = 0;
  let failed = 0;

  // Fetch real scores for each match in parallel (batched)
  const ids = Array.from(matchIds);

  // Process in batches of 5 to avoid hammering the API
  for (let i = 0; i < ids.length; i += 5) {
    const batch = ids.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(async (matchId) => {
      try {
        const match = await getMatchById(matchId);
        if (!match) return null;
        if (match.status !== 'finished') return null;
        const homeScore = typeof match.homeScore === 'number' ? match.homeScore : null;
        const awayScore = typeof match.awayScore === 'number' ? match.awayScore : null;
        if (homeScore === null || awayScore === null) return null;
        const homeTeam = match.homeTeam?.name || '';
        const awayTeam = match.awayTeam?.name || '';
        const matchData = {
          htHomeScore: match.htHomeScore ?? null,
          htAwayScore: match.htAwayScore ?? null,
          corners: match.sportSpecificData?.corners,
          yellowCards: match.sportSpecificData?.yellowCards,
          redCards: match.sportSpecificData?.redCards,
        };
        return { matchId, homeScore, awayScore, homeTeam, awayTeam, matchData };
      } catch {
        return null;
      }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        fetched++;
        const { matchId, homeScore, awayScore, homeTeam, awayTeam, matchData } = r.value;
        // Settle by matchId first (exact), then by team name (fuzzy fallback)
        settleTipWithResult(matchId, homeScore, awayScore, matchData);
        if (homeTeam && awayTeam) {
          settleTipsByTeamNames(homeTeam, awayTeam, homeScore, awayScore, matchData);
        }
        settled++;
      } else {
        failed++;
      }
    }

    // Small delay between batches to be a polite API client
    if (i + 5 < ids.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Secondary pass: scan the full match cache (API + DB) by team name to catch
  // tips whose matchId lookup failed (e.g., old match evicted from ESPN cache).
  // This corrects already-probabilistically-settled tips too.
  try {
    const allCachedMatches = await getAllMatches();
    const finishedMatches = allCachedMatches.filter(
      m => m.status === 'finished' &&
           typeof m.homeScore === 'number' &&
           typeof m.awayScore === 'number'
    );
    for (const m of finishedMatches) {
      if (!m.homeTeam?.name || !m.awayTeam?.name) continue;
      settleTipsByTeamNames(m.homeTeam.name, m.awayTeam.name, m.homeScore as number, m.awayScore as number);
    }
  } catch { /* non-fatal */ }

  // For any remaining pending tips that still couldn't be settled with real data,
  // fall back to probabilistic settlement so nothing stays pending forever
  settleStaleAutoTips(now);

  console.log(`[settle-tips] matches checked: ${ids.length}, real scores fetched: ${fetched}, settled: ${settled}, api failures: ${failed}`);

  return NextResponse.json({
    ok: true,
    matchesChecked: ids.length,
    realScoresFetched: fetched,
    settled,
    apiFailed: failed,
    ts: new Date().toISOString(),
  });
}
