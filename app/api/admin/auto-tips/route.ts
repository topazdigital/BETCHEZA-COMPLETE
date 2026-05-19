import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listAllAutoTips, getAutoTipsStats, settleByKnownResults, addKnownResult, settleTipWithResult, settleTipsByTeamNames } from '@/lib/auto-tips-store';
import { listActivity } from '@/lib/auto-tip-activity';
import { getFakeTipsters } from '@/lib/fake-tipsters';
import { getMatchById, getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const tipsters = getFakeTipsters().map((t) => ({
    id: t.id,
    displayName: t.displayName,
    username: t.username,
    avatar: t.avatar ?? null,
    winRate: t.winRate,
    isPro: !!t.isPro,
    specialties: t.specialties,
  }));
  return NextResponse.json({
    stats: getAutoTipsStats(),
    recent: listAllAutoTips(50),
    activity: listActivity(100),
    tipsters,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeScore?: number;
    awayScore?: number;
  };

  if (body.action === 'settle-known') {
    // Re-settle all probabilistically-settled tips using known results list
    const fixed = settleByKnownResults();
    return NextResponse.json({ success: true, fixed, message: `Re-settled ${fixed} match(es) using known results` });
  }

  if (body.action === 'add-result' && body.homeTeam && body.awayTeam && typeof body.homeScore === 'number' && typeof body.awayScore === 'number') {
    // Add a specific match result and re-settle ALL matching tips (including previously wrongly settled)
    const fixed = addKnownResult(body.homeTeam, body.awayTeam, body.homeScore, body.awayScore);
    return NextResponse.json({ success: true, fixed, message: `Fixed ${fixed} tip(s) for ${body.homeTeam} vs ${body.awayTeam} (${body.homeScore}-${body.awayScore})` });
  }

  if (body.action === 'bulk-resettle') {
    // Fetch real scores from the API and re-settle ALL stored tips using correct outcomes.
    // This fixes any previously wrong won/lost verdicts across all markets.
    const before = getAutoTipsStats();
    let matchesProcessed = 0;
    let errors = 0;

    try {
      // Get all unique matchIds from stored tips
      const allTips = listAllAutoTips(5000);
      const matchIds = [...new Set(allTips.map(t => t.matchId))];

      // Fetch real scores in batches of 5
      for (let i = 0; i < matchIds.length; i += 5) {
        const batch = matchIds.slice(i, i + 5);
        const results = await Promise.allSettled(batch.map(async (matchId) => {
          try {
            const match = await getMatchById(matchId);
            if (!match || match.status !== 'finished') return null;
            const homeScore = typeof match.homeScore === 'number' ? match.homeScore : null;
            const awayScore = typeof match.awayScore === 'number' ? match.awayScore : null;
            if (homeScore === null || awayScore === null) return null;
            return {
              matchId,
              homeScore,
              awayScore,
              homeTeam: match.homeTeam?.name || '',
              awayTeam: match.awayTeam?.name || '',
              matchData: {
                htHomeScore: match.htHomeScore ?? null,
                htAwayScore: match.htAwayScore ?? null,
                corners: match.sportSpecificData?.corners,
                yellowCards: match.sportSpecificData?.yellowCards,
                redCards: match.sportSpecificData?.redCards,
              },
            };
          } catch { return null; }
        }));

        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            const { matchId, homeScore, awayScore, homeTeam, awayTeam, matchData } = r.value;
            settleTipWithResult(matchId, homeScore, awayScore, matchData);
            if (homeTeam && awayTeam) {
              settleTipsByTeamNames(homeTeam, awayTeam, homeScore, awayScore, matchData);
            }
            matchesProcessed++;
          } else {
            errors++;
          }
        }
        if (i + 5 < matchIds.length) await new Promise(r => setTimeout(r, 150));
      }

      // Also scan the full match cache by team names to catch any matchId mismatches
      try {
        const allCached = await getAllMatches();
        for (const m of allCached) {
          if (m.status !== 'finished') continue;
          if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') continue;
          if (!m.homeTeam?.name || !m.awayTeam?.name) continue;
          settleTipsByTeamNames(m.homeTeam.name, m.awayTeam.name, m.homeScore, m.awayScore);
        }
      } catch { /* non-fatal */ }
    } catch (e) {
      errors++;
    }

    const after = getAutoTipsStats();
    const corrected = Math.abs((after.won - before.won)) + Math.abs((after.lost - before.lost));
    return NextResponse.json({
      success: true,
      matchesProcessed,
      errors,
      corrected,
      before,
      after,
      message: `Bulk re-settlement complete: ${matchesProcessed} matches processed, ${corrected} tip outcome(s) corrected.`,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
