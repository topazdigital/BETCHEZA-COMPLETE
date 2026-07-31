import { NextRequest, NextResponse } from 'next/server';
import { getCompetitionBySlugAsync, getCompetitionByIdAsync, cacheParticipantCount } from '@/lib/competitions-store';
import { computeLeaderboard } from '@/lib/competition-league-utils';
import { query } from '@/lib/db';

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

  // Load real users who have explicitly joined this competition.
  // Fake tipsters (id >= 1000) auto-appear based on their tips alone — no join required.
  // Real users must have BOTH joined the competition AND posted qualifying tips.
  let joinedUserIds: number[] = [];
  try {
    const res = await query<{ user_id: number }>(
      'SELECT user_id FROM competition_entries WHERE competition_id = ?',
      [comp.id],
    );
    joinedUserIds = res.rows.map(r => Number(r.user_id));
  } catch {
    joinedUserIds = [];
  }

  // Extract minimum tips requirement from competition rule config
  const minTipsRule = (comp.ruleConfig ?? []).find(r => r.type === 'min_tips');
  const minTipsRequired = minTipsRule ? Number(minTipsRule.value ?? 1) : 1;

  const leaderboard = started
    ? await computeLeaderboard({
        startDate: comp.startDate,
        endDate,
        leagueId: comp.leagueId,
        leagueName: comp.leagueName,
        sportFocus: comp.sportFocus,
        matchKickoffFrom: comp.matchKickoffFrom,
        matchKickoffTo: comp.matchKickoffTo,
        // Always show anyone with ≥1 tip in the live rankings; the prize
        // eligibility threshold (minTipsRequired) is reported separately so
        // the frontend can flag who is/isn't yet prize-eligible.
        minTips: 1,
        limit: 200,
        // Pass joined real-user IDs — fakes always included inside computeLeaderboard
        allowedUserIds: joinedUserIds,
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
    prizeEligible: r.totalTips >= minTipsRequired,
  }));

  const actualParticipants = ranked.length;
  // Write real count to cache so the competitions list page shows the correct number
  cacheParticipantCount(comp.id, actualParticipants);

  // Derive a human-readable scope label based on competition configuration
  let scopeLabel: string;
  if (comp.matchKickoffFrom && comp.matchKickoffTo) {
    const from = new Date(comp.matchKickoffFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const to = new Date(comp.matchKickoffTo).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    scopeLabel = `Gameweek/Round — matches kicking off ${from}–${to}`;
  } else if (comp.leagueName) {
    const typeLabel = comp.type === 'weekly' ? 'Weekly' : comp.type === 'monthly' ? 'Monthly' : 'Full season';
    scopeLabel = `${typeLabel} — ${comp.leagueName} tips only`;
  } else if (comp.sportFocus && comp.sportFocus !== 'multi-sport') {
    scopeLabel = `${comp.sportFocus} tips count`;
  } else {
    scopeLabel = 'All sports and leagues count';
  }

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
      minimumTips: minTipsRequired,
    },
    isRealData: actualParticipants > 0,
  });
}
