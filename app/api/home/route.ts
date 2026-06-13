import { NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import {
  getTopTipsterThisWeek,
  computeRealTipsterStats,
  computeRealRoi,
  computeRealStreak,
} from '@/lib/auto-tips-store';
import { getFakeTipsters, getFakeTipsterById } from '@/lib/fake-tipsters';
import { tipsterHref } from '@/lib/utils/slug';
import { getFeaturedConfig } from '@/lib/featured-store';
import { getUpcomingMatches, getMatchById } from '@/lib/api/unified-sports-api';
import { query } from '@/lib/db';
import type { UnifiedMatch } from '@/lib/api/unified-sports-api';

export const runtime = 'nodejs';

// ─── In-process stale-while-revalidate cache (30 s TTL) ───────────────────────
const HOME_CACHE_TTL = 30_000;
let _homeCache: { data: unknown; ts: number } | null = null;
let _homeRefreshing = false;

interface DbTipsterRow {
  user_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  win_rate: number | null;
  roi: number | null;
  total_tips: number | null;
  won_tips: number | null;
  lost_tips: number | null;
  streak: number | null;
  is_pro: number | null;
  is_verified: number | null;
  followers_count: number | null;
}

async function getTopDbTipsters(limit = 4) {
  try {
    const result = await query<DbTipsterRow>(
      `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url, u.bio,
              u.country_code, u.is_verified,
              t.win_rate, t.roi, t.total_tips, t.won_tips, t.lost_tips,
              t.streak, t.is_pro, t.followers_count
         FROM users u
         LEFT JOIN tipster_profiles t ON t.user_id = u.id
         WHERE u.role = 'tipster'
           AND COALESCE(t.total_tips, 0) > 0
         ORDER BY t.win_rate DESC, t.roi DESC
         LIMIT ?`,
      [limit]
    );
    if (result.rows.length > 0) {
      return result.rows.map(row => ({
        id: row.user_id,
        username: row.username,
        displayName: row.display_name || row.username,
        avatar: row.avatar_url,
        winRate: Number(row.win_rate ?? 0),
        streak: Number(row.streak ?? 0),
        roi: Number(row.roi ?? 0),
        totalTips: Number(row.total_tips ?? 0),
      }));
    }
  } catch { /* fall through to fake tipsters */ }

  // Fall back to fake tipsters (seeded in DB as is_fake=1) sorted by winRate
  return getFakeTipsters()
    .slice()
    .sort((a, b) => b.winRate - a.winRate || b.roi - a.roi)
    .slice(0, limit)
    .map(t => ({
      id: t.id,
      username: t.username,
      displayName: t.displayName,
      avatar: t.avatar ?? null,
      winRate: t.winRate,
      streak: t.streak,
      roi: t.roi,
      totalTips: t.totalTips,
    }));
}

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

  // Use real DB tipsters
  const topTipsters = await getTopDbTipsters(4);

  // Tipster of the week — use real performance data
  let tipsterOfWeek: Record<string, unknown> | null = null;
  const best = getTopTipsterThisWeek();
  if (best) {
    // Try to get DB user first, fall back to fake tipster profile for display
    let tipsterInfo: { username: string; displayName: string; avatar: string | null; bio: string | null; isPro: boolean; verified: boolean; countryCode: string | null } | null = null;
    try {
      const dbRows = await query<{ username: string; display_name: string | null; avatar_url: string | null; bio: string | null; is_verified: number | null; country_code: string | null }>(
        'SELECT username, display_name, avatar_url, bio, is_verified, country_code FROM users WHERE id = ? LIMIT 1',
        [best.tipsterId]
      );
      const dbRow = dbRows.rows[0];
      if (dbRow) {
        tipsterInfo = {
          username: dbRow.username,
          displayName: dbRow.display_name || dbRow.username,
          avatar: dbRow.avatar_url,
          bio: dbRow.bio,
          isPro: false,
          verified: !!dbRow.is_verified,
          countryCode: dbRow.country_code,
        };
      }
    } catch { /* ignore */ }

    if (!tipsterInfo) {
      const fake = getFakeTipsterById(best.tipsterId);
      if (fake) {
        tipsterInfo = {
          username: fake.username,
          displayName: fake.displayName,
          avatar: fake.avatar ?? null,
          bio: fake.bio,
          isPro: fake.isPro,
          verified: fake.isVerified,
          countryCode: fake.countryCode,
        };
      }
    }

    if (tipsterInfo) {
      const allTime = computeRealTipsterStats(best.tipsterId);
      tipsterOfWeek = {
        tipster: {
          id: best.tipsterId,
          username: tipsterInfo.username,
          displayName: tipsterInfo.displayName,
          avatar: tipsterInfo.avatar,
          bio: tipsterInfo.bio,
          winRate: best.winRate,
          roi: best.roi,
          streak: computeRealStreak(best.tipsterId),
          wonTips: best.won,
          lostTips: best.lost,
          totalTips: best.total,
          allTimeWinRate: allTime.winRate,
          allTimeRoi: computeRealRoi(best.tipsterId),
          allTimeWon: allTime.won,
          allTimeLost: allTime.lost,
          isPro: tipsterInfo.isPro,
          verified: tipsterInfo.verified,
          countryCode: tipsterInfo.countryCode,
          href: tipsterHref(tipsterInfo.username, tipsterInfo.username),
        },
        weeklyWon: best.won,
        weeklyLost: best.lost,
        weeklyTotal: best.total,
        weeklyWinRate: best.winRate,
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

// ─── Featured helpers ─────────────────────────────────────────────────────────
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
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const data = await getCachedHomePayload();
  const res = NextResponse.json(data);
  res.headers.set('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');
  return res;
}
