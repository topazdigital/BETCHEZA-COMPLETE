import { NextRequest, NextResponse } from 'next/server';
import { getCompetitionBySlug, getCompetitionById } from '@/lib/competitions-store';
import { computeLeaderboard } from '@/lib/competition-league-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const idNum = Number(slug);
  const comp = (Number.isFinite(idNum) && idNum > 0)
    ? getCompetitionById(idNum) ?? getCompetitionBySlug(slug)
    : getCompetitionBySlug(slug);

  if (!comp) {
    return NextResponse.json({ success: false, error: 'Competition not found' }, { status: 404 });
  }

  // ── Real leaderboard from auto_tips ──────────────────────────────
  // Only query real data if the competition has started
  const now = new Date();
  const started = new Date(comp.startDate) <= now;

  let realLeaderboard: Awaited<ReturnType<typeof computeLeaderboard>> = [];

  if (started) {
    realLeaderboard = await computeLeaderboard({
      startDate: comp.startDate,
      endDate: comp.endDate,
      leagueId: comp.leagueId,
      leagueName: comp.leagueName,
      sportFocus: comp.sportFocus,
      minTips: 3,
      limit: 100,
    });
  }

  // ── Merge real leaderboard with fake tipster seed ─────────────────
  // Real users always shown first; fake tipsters fill remaining slots
  // so leaderboard is never empty.
  const realUserIds = new Set(realLeaderboard.map(r => r.userId));
  const fakeParticipants = comp.participants.filter(p => p.tipsterId >= 1000 && !realUserIds.has(p.tipsterId));

  // Convert real leaderboard entries to the participant shape
  const realEntries = realLeaderboard.map((r, i) => ({
    rank: i + 1,
    tipsterId: r.userId,
    username: r.username,
    displayName: r.displayName || r.username,
    avatar: r.avatar,
    countryCode: null,
    winRate: r.winRate,
    roi: r.roi,
    tips: r.totalTips,
    won: r.won,
    points: r.points,
    streak: 0,
    isVerified: false,
    // Extra scoring fields for display
    lost: r.lost,
    pending: r.pending,
    avgOdds: r.avgOdds,
    isReal: true,
  }));

  // Trim fake participants to fill up to 50 total visible entries
  const maxFake = Math.max(0, 50 - realEntries.length);
  const trimmedFake = fakeParticipants.slice(0, maxFake).map((p, i) => ({
    ...p,
    rank: realEntries.length + i + 1,
    lost: p.tips - p.won,
    pending: 0,
    avgOdds: 1.85,
    isReal: false,
  }));

  const mergedLeaderboard = [...realEntries, ...trimmedFake];

  // ── Scoring explanation based on competition type ─────────────────
  const scopeLabel = comp.leagueName
    ? `Only ${comp.leagueName} tips count`
    : comp.sportFocus && comp.sportFocus !== 'multi-sport'
      ? `Only ${comp.sportFocus} tips count`
      : 'All sports and leagues count';

  return NextResponse.json({
    success: true,
    competition: {
      ...comp,
      participants: mergedLeaderboard,
      currentParticipants: realEntries.length + trimmedFake.length,
    },
    scoring: {
      formula: 'wins × 10 + avg-win-odds bonus − losses × 5',
      scope: scopeLabel,
      minimumTips: 3,
    },
    isRealData: realEntries.length > 0,
  });
}
