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

  // ── Query ALL tipsters (real + fake) from auto_tips for this competition
  // Fake tipsters (id >= 1000) post real predictions to auto_tips just like
  // real users — they get scored against the same filter (league/sport/dates)
  const now = new Date();
  const started = new Date(comp.startDate) <= now;
  const endDate = started ? comp.endDate : comp.startDate; // cap to now if not started

  const leaderboard = started
    ? await computeLeaderboard({
        startDate: comp.startDate,
        endDate,
        leagueId: comp.leagueId,
        leagueName: comp.leagueName,
        sportFocus: comp.sportFocus,
        minTips: 1, // include everyone with at least 1 tip
        limit: 200,
      })
    : [];

  // Convert to the participant shape the frontend expects
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

  // Actual participant count = distinct tipsters who posted qualifying tips
  const actualParticipants = ranked.length;

  // Scoring scope label
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
