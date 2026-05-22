import { NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { getFakeTipsters, getFakeTipsterById } from '@/lib/fake-tipsters';
import {
  getTopTipsterThisWeek,
  computeRealTipsterStats,
  computeRealRoi,
  computeRealStreak,
} from '@/lib/auto-tips-store';
import { tipsterHref } from '@/lib/utils/slug';
import { getFeaturedConfig } from '@/lib/featured-store';
import { getUpcomingMatches, getMatchById } from '@/lib/api/unified-sports-api';
import type { UnifiedMatch } from '@/lib/api/unified-sports-api';

export const runtime = 'nodejs';

// ─── In-process stale-while-revalidate cache (30 s TTL) ───────────────────────
const HOME_CACHE_TTL = 30_000;
let _homeCache: { data: unknown; ts: number } | null = null;
let _homeRefreshing = false;

async function buildHomePayload(): Promise<unknown> {
  const [allMatches, featuredConfig] = await Promise.all([
    getAllMatches().catch(() => [] as UnifiedMatch[]),
    getFeaturedConfig().catch(() => null),
  ]);

  const LIVE_STATUSES_SET = new Set(['live', 'halftime', 'extra_time', 'penalties']);
  const liveMatchList = allMatches.filter(m => LIVE_STATUSES_SET.has(m.status as string));
  const liveCount = liveMatchList.length;
  const todayStr = new Date().toDateString();
  const todayCount = allMatches.filter(m => {
    try { return new Date(m.kickoffTime as string | Date).toDateString() === todayStr; } catch { return false; }
  }).length;

  const matchesPayload = {
    matches: allMatches,
    stats: { total: allMatches.length, live: liveCount, today: todayCount, upcoming: allMatches.filter(m => m.status === 'scheduled').length },
    timestamp: new Date().toISOString(),
  };

  const liveMatchesPayload = {
    matches: liveMatchList.slice(0, 20),
    stats: { total: liveCount, live: liveCount, today: todayCount, upcoming: 0 },
    timestamp: new Date().toISOString(),
  };

  const fakes = getFakeTipsters();
  const topTipsters = fakes
    .slice()
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 4)
    .map(t => ({
      id: t.id, username: t.username, displayName: t.displayName,
      winRate: t.winRate, streak: t.streak, roi: t.roi,
      totalTips: t.totalTips, avatar: t.avatar ?? null,
    }));

  let tipsterOfWeek: Record<string, unknown> | null = null;
  const best = getTopTipsterThisWeek();
  if (!best) {
    const top = fakes.slice().sort((a, b) => b.winRate - a.winRate)[0];
    if (top) {
      tipsterOfWeek = {
        tipster: {
          id: top.id, username: top.username, displayName: top.displayName,
          avatar: top.avatar ?? null, bio: top.bio, winRate: top.winRate,
          roi: top.roi, streak: top.streak, wonTips: top.wonTips,
          lostTips: top.lostTips, totalTips: top.totalTips,
          isPro: top.isPro, verified: top.isVerified, countryCode: top.countryCode,
          href: tipsterHref(top.username, top.username),
        },
        weeklyWon: top.wonTips, weeklyLost: top.lostTips,
        weeklyTotal: top.totalTips, weeklyWinRate: top.winRate,
        isWeekly: false, performanceVerified: false,
      };
    }
  } else {
    const fake = getFakeTipsterById(best.tipsterId);
    if (fake) {
      const allTime = computeRealTipsterStats(best.tipsterId);
      tipsterOfWeek = {
        tipster: {
          id: fake.id, username: fake.username, displayName: fake.displayName,
          avatar: fake.avatar ?? null, bio: fake.bio,
          winRate: best.winRate, roi: best.roi,
          streak: computeRealStreak(best.tipsterId),
          wonTips: best.won, lostTips: best.lost, totalTips: best.total,
          allTimeWinRate: allTime.winRate, allTimeRoi: computeRealRoi(best.tipsterId),
          allTimeWon: allTime.won, allTimeLost: allTime.lost,
          isPro: fake.isPro, verified: fake.isVerified,
          countryCode: fake.countryCode,
          href: tipsterHref(fake.username, fake.username),
        },
        weeklyWon: best.won, weeklyLost: best.lost,
        weeklyTotal: best.total, weeklyWinRate: best.winRate,
        isWeekly: best.isWeekly,
        performanceVerified: allTime.won + allTime.lost >= 10,
      };
    }
  }

  let featuredPayload: { enabled: boolean; items: ReturnType<typeof toFeaturedItem>[] } = { enabled: false, items: [] };
  if (featuredConfig?.enabled) {
    const hidden = new Set<string>(featuredConfig.hiddenMatchIds || []);
    const pinnedItems: ReturnType<typeof toFeaturedItem>[] = [];
    const seen = new Set<string>();
    for (const id of (featuredConfig.pinnedMatchIds || [])) {
      if (!id || seen.has(id) || hidden.has(id)) continue;
      try {
        const m = await getMatchById(id);
        if (m) { pinnedItems.push(toFeaturedItem(m, true)); seen.add(id); }
      } catch {}
    }
    const AUTO_LIMIT = Math.max(0, (featuredConfig.autoCount ?? 3) - pinnedItems.length);
    const autoItems: ReturnType<typeof toFeaturedItem>[] = [];
    if (AUTO_LIMIT > 0) {
      const upcoming = (await getUpcomingMatches(featuredConfig.autoSportId || undefined).catch(() => [])) as UnifiedMatch[];
      for (const m of upcoming) {
        if (autoItems.length >= AUTO_LIMIT) break;
        if (seen.has(m.id) || hidden.has(m.id)) continue;
        autoItems.push(toFeaturedItem(m, false));
        seen.add(m.id);
      }
    }
    featuredPayload = { enabled: true, items: [...pinnedItems, ...autoItems] };
  }

  return { matches: matchesPayload, liveMatches: liveMatchesPayload, topTipsters: { tipsters: topTipsters }, tipsterOfWeek, featured: featuredPayload };
}

async function getCachedHomePayload(): Promise<unknown> {
  const now = Date.now();
  if (_homeCache && now - _homeCache.ts < HOME_CACHE_TTL) return _homeCache.data;
  if (_homeCache && !_homeRefreshing) {
    _homeRefreshing = true;
    buildHomePayload()
      .then(data => { _homeCache = { data, ts: Date.now() }; })
      .catch(() => {})
      .finally(() => { _homeRefreshing = false; });
    return _homeCache.data;
  }
  const data = await buildHomePayload();
  _homeCache = { data, ts: Date.now() };
  return data;
}


// ─── Featured helpers (mirrors /api/featured logic) ───────────────────────────
const TIPSTERS = [
  { id: '1', displayName: 'KingOfTips',   rank: 1, isPremium: true,  verified: true,  followers: 1523, roi: 12.4, winRate: 68.4 },
  { id: '2', displayName: 'AcePredicts',  rank: 2, isPremium: true,  verified: true,  followers: 982,  roi: 15.8, winRate: 72.1 },
  { id: '3', displayName: 'LuckyStriker', rank: 3, isPremium: false, verified: false, followers: 678,  roi: 9.2,  winRate: 60.7 },
  { id: '4', displayName: 'EuroExpert',   rank: 4, isPremium: true,  verified: true,  followers: 534,  roi: 7.5,  winRate: 58.3 },
  { id: '5', displayName: 'GoalMachine',  rank: 8, isPremium: false, verified: false, followers: 312,  roi: 5.3,  winRate: 58.2 },
  { id: '6', displayName: 'BetWizard',    rank: 6, isPremium: true,  verified: true,  followers: 1102, roi: 18.1, winRate: 69.7 },
];
const PREDICTIONS = [
  { prediction: 'Home Win',            market: 'Match Result (1X2)' },
  { prediction: 'Away Win',            market: 'Match Result (1X2)' },
  { prediction: 'Draw',                market: 'Match Result (1X2)' },
  { prediction: 'Both Teams to Score', market: 'BTTS' },
  { prediction: 'Over 2.5 Goals',      market: 'Over/Under 2.5' },
  { prediction: 'Under 2.5 Goals',     market: 'Over/Under 2.5' },
  { prediction: 'Home or Draw (1X)',   market: 'Double Chance' },
  { prediction: 'Away or Draw (X2)',   market: 'Double Chance' },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
function bestTipFor(matchId: string) {
  const seed = hashCode(matchId);
  let best: { tipster: typeof TIPSTERS[0]; prediction: string; market: string; odds: number; confidence: number } | null = null;
  for (let i = 0; i < 4; i++) {
    const tipster = TIPSTERS[Math.floor(seededRandom(seed + i * 37) * TIPSTERS.length)];
    const { prediction, market } = PREDICTIONS[Math.floor(seededRandom(seed + i * 53) * PREDICTIONS.length)];
    const odds = Math.round((1.4 + seededRandom(seed + i * 17) * 2.8) * 100) / 100;
    const confidence = 55 + Math.floor(seededRandom(seed + i * 43) * 40);
    if (!best || confidence > best.confidence) best = { tipster, prediction, market, odds, confidence };
  }
  return best!;
}
function toFeaturedItem(match: UnifiedMatch, pinned: boolean) {
  return {
    matchId: match.id,
    pinned,
    match: {
      id: match.id,
      homeTeam: { name: match.homeTeam.name, shortName: match.homeTeam.shortName, logo: match.homeTeam.logo },
      awayTeam: { name: match.awayTeam.name, shortName: match.awayTeam.shortName, logo: match.awayTeam.logo },
      kickoffTime: typeof match.kickoffTime === 'string' ? match.kickoffTime : new Date(match.kickoffTime).toISOString(),
      status: String(match.status),
      league: { name: match.league.name, country: match.league.country },
      sport: { name: match.sport.name, slug: match.sport.slug },
    },
    tip: bestTipFor(match.id),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const data = await getCachedHomePayload();
  const res = NextResponse.json(data);
  res.headers.set('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');
  return res;
}
