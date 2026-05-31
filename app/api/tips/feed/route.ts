import { NextRequest, NextResponse } from 'next/server';
import {
  listAllAutoTips,
  seedTipsForMatch,
  computeRealTipsterStats,
  getAutoTipsStats,
} from '@/lib/auto-tips-store';
import { getFakeTipsterById, getFakeTipsters } from '@/lib/fake-tipsters';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getDayBucket(kickoff: string | undefined): 'today' | 'tomorrow' | 'upcoming' {
  if (!kickoff) return 'today';
  const k = new Date(kickoff);
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
  if (k <= todayEnd) return 'today';
  if (k <= tomorrowEnd) return 'tomorrow';
  return 'upcoming';
}

/** Seed tips for live/upcoming matches when the in-memory store is cold. */
async function ensureSeedIfEmpty(): Promise<void> {
  const stats = getAutoTipsStats();
  if (stats.total > 0) return; // already warm — nothing to do

  try {
    const matches = await getAllMatches();
    const now = Date.now();
    // Seed upcoming + live matches for the next 3 days
    const relevant = matches.filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      const isLive = ['live', 'halftime'].includes(m.status);
      const isSoon = m.status === 'scheduled' && t > now - 3 * 60 * 60 * 1000 && t < now + 3 * 24 * 60 * 60 * 1000;
      return isLive || isSoon;
    }).slice(0, 80); // cap at 80 matches to avoid slow boot

    for (const m of relevant) {
      const markets = (m.markets as Array<{ key?: string; name: string; selections: Array<{ label: string; odds: number }> }> | undefined)
        ?.filter(mk => mk.selections.length > 0) ?? [];

      seedTipsForMatch({
        matchId: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.league.name,
        sport: m.sport.name,
        kickoff: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : String(m.kickoffTime),
        leagueTier: m.league.tier ?? 3,
        popularity: (m.league.tier ?? 3) <= 2 ? 1.2 : 0.8,
        markets,
      });
    }
  } catch (e) {
    console.warn('[tips/feed] ensureSeedIfEmpty failed:', e);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const day = (searchParams.get('day') || 'today') as 'today' | 'tomorrow' | 'upcoming';
  const sport = (searchParams.get('sport') || '').toLowerCase();
  const minOdds = parseFloat(searchParams.get('minOdds') || '1');
  const maxOdds = parseFloat(searchParams.get('maxOdds') || '99');

  // Boot the store if it's cold (first request after restart)
  await ensureSeedIfEmpty();

  const allTips = listAllAutoTips(3000);

  const today_count = allTips.filter(t => getDayBucket(t.kickoff) === 'today').length;
  const tomorrow_count = allTips.filter(t => getDayBucket(t.kickoff) === 'tomorrow').length;
  const upcoming_count = allTips.filter(t => getDayBucket(t.kickoff) === 'upcoming').length;

  let filtered = allTips.filter(t => getDayBucket(t.kickoff) === day);
  if (sport) filtered = filtered.filter(t => t.sport?.toLowerCase() === sport);
  filtered = filtered.filter(t => t.odds >= minOdds && (maxOdds >= 99 || t.odds <= maxOdds));
  filtered.sort((a, b) => b.confidence - a.confidence);

  const tips = filtered.slice(0, 100).map(tip => {
    const tipster = getFakeTipsterById(tip.tipsterId);
    if (!tipster) return null;
    const realStats = computeRealTipsterStats(tip.tipsterId);
    return {
      id: tip.id,
      matchId: tip.matchId,
      homeTeam: tip.homeTeam,
      awayTeam: tip.awayTeam,
      league: tip.league ?? '',
      sport: tip.sport ?? 'Football',
      kickoff: tip.kickoff ?? null,
      prediction: tip.prediction,
      market: tip.market,
      odds: tip.odds,
      confidence: tip.confidence,
      status: tip.status,
      likes: tip.likes,
      comments: tip.comments,
      analysis: tip.analysis,
      isPremium: tip.isPremium,
      createdAt: tip.createdAt,
      tipster: {
        id: tipster.id,
        displayName: tipster.displayName,
        username: tipster.username,
        avatar: tipster.avatar,
        countryCode: tipster.countryCode,
        winRate: realStats?.winRate ?? tipster.winRate,
        roi: realStats?.roi ?? tipster.roi,
        totalTips: realStats?.total ?? tipster.totalTips,
        profit: realStats
          ? (realStats.won * 0.9 - realStats.lost).toFixed(1)
          : (tipster.roi * 10).toFixed(1),
        isPro: tipster.isPro,
        isVerified: tipster.isVerified,
      },
    };
  }).filter(Boolean);

  const bestTip = tips.find(t => t!.status === 'pending') ?? tips[0] ?? null;

  const topTipsters = getFakeTipsters()
    .map(t => {
      const s = computeRealTipsterStats(t.id);
      return {
        id: t.id,
        displayName: t.displayName,
        username: t.username,
        avatar: t.avatar,
        countryCode: t.countryCode,
        winRate: s?.winRate ?? t.winRate,
        totalTips: s?.total ?? t.totalTips,
        roi: s?.roi ?? t.roi,
        profit: s
          ? ((s.won * 0.9 - s.lost) * 10).toFixed(0)
          : (t.roi * 100).toFixed(0),
        isPro: t.isPro,
        isVerified: t.isVerified,
      };
    })
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5)
    .map((t, i) => ({ ...t, rank: i + 1 }));

  const sports = Array.from(new Set(allTips.map(t => t.sport).filter(Boolean))) as string[];

  return NextResponse.json({
    tips,
    bestTip,
    topTipsters,
    sports,
    counts: { today: today_count, tomorrow: tomorrow_count, upcoming: upcoming_count },
  });
}
