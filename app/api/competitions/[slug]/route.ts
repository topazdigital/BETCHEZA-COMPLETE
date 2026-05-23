import { NextRequest, NextResponse } from 'next/server';
import { getCompetitionBySlugAsync, getCompetitionByIdAsync } from '@/lib/competitions-store';
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
    ? (await getCompetitionByIdAsync(idNum) ?? await getCompetitionBySlugAsync(slug))
    : await getCompetitionBySlugAsync(slug);

  if (!comp) {
    return NextResponse.json({ success: false, error: 'Competition not found' }, { status: 404 });
  }

  const now = new Date();
  const started = new Date(comp.startDate) <= now;
  const endDate = started ? comp.endDate : comp.startDate;

  const leaderboard = started
    ? await computeLeaderboard({
        startDate: comp.startDate,
        endDate,
        leagueId: comp.leagueId,
        leagueName: comp.leagueName,
        sportFocus: comp.sportFocus,
        matchKickoffFrom: comp.matchKickoffFrom,
        matchKickoffTo: comp.matchKickoffTo,
        minTips: 1,
        limit: 200,
      })
    : [];

  const ranked = leaderboard.map((r, i) => ({
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
    lost: r.lost,
    pending: r.pending,
    avgOdds: r.avgOdds,
    points: r.points,
    streak: 0,
    isVerified: false,
    isFake: r.isFake,
  }));

  const actualParticipants = ranked.length;

  const scopeLabel = comp.leagueName
    ? `Only ${comp.leagueName} tips count`
    : comp.sportFocus && comp.sportFocus !== 'multi-sport'
      ? `Only ${comp.sportFocus} tips count`
      : 'All sports and leagues count';

  return NextResponse.json({
    success: true,
    competition: {
      ...comp,
      participants: ranked,
      currentParticipants: actualParticipants,
    },
    scoring: {
      formula: 'wins × 10 + avg-win-odds bonus − losses × 5',
      scope: scopeLabel,
      minimumTips: 1,
    },
    isRealData: actualParticipants > 0,
  });
}
