import { NextRequest, NextResponse } from 'next/server';
import {
  getAllMatches,
  getMatchesBySport,
  getMatchesByLeague,
  getLiveMatches as getApiLiveMatches,
  getUpcomingMatches as getApiUpcomingMatches,
  getMatchById,
  generateRealisticOdds,
  type UnifiedMatch,
} from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// Sport priority - Football always first
const SPORT_PRIORITY: Record<number, number> = {
  1: 0,   // Football (soccer)
  2: 1,   // Basketball
  3: 2,   // Tennis
  4: 3,   // Cricket
  5: 4,   // American Football
  6: 5,   // Baseball
  7: 6,   // Ice Hockey
  8: 7,   // Rugby
  17: 8,  // Golf
  27: 9,  // MMA
  26: 10, // Boxing
  29: 11, // Formula 1
  31: 12, // NASCAR
  32: 13, // IndyCar
  33: 14, // Esports
};

const EUROPEAN_TOP_5_LEAGUES = [1, 2, 3, 4, 5];

// Country -> league priority order (geo aware)
const COUNTRY_LEAGUES: Record<string, number[]> = {
  // Africa
  'KE': [24, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'NG': [24, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'GH': [24, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'EG': [24, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'ZA': [24, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'TZ': [24, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'UG': [24, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  // Europe
  'GB': [1, 8, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'ES': [2, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'DE': [3, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'IT': [4, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'FR': [5, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'NL': [6, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'PT': [7, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'BE': [16, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'TR': [15, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  // Americas
  'US': [11, 401, 101, 501, 601, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'BR': [12, 25, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'AR': [13, 25, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'MX': [27, 11, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  // Asia / Oceania
  'JP': [18, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'AU': [20, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'IN': [301, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'SA': [14, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'CN': [28, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
};

export interface MatchData {
  id: string;
  sportId: number;
  leagueId: number;
  homeTeam: { id: number | string; name: string; shortName: string; logo?: string; form?: string; record?: string };
  awayTeam: { id: number | string; name: string; shortName: string; logo?: string; form?: string; record?: string };
  kickoffTime: string;
  status: 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled' | 'extra_time' | 'penalties';
  homeScore: number | null;
  awayScore: number | null;
  minute?: number;
  period?: string;
  league: {
    id: number;
    name: string;
    slug: string;
    country: string;
    countryCode: string;
    tier: number;
    logo?: string;
  };
  sport: { id: number; name: string; slug: string; icon: string };
  odds?: { home: number; draw?: number; away: number; bookmaker?: string };
  markets?: MarketOdds[];
  tipsCount: number;
  source?: string;
  venue?: string;
}

export interface MarketOdds {
  key: string;
  name: string;
  outcomes: Array<{ name: string; price: number; point?: number }>;
}

function convertToMatchData(match: UnifiedMatch): MatchData {
  return {
    id: match.id,
    sportId: match.sportId,
    leagueId: match.leagueId,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      shortName: match.homeTeam.shortName,
      logo: match.homeTeam.logo,
      form: match.homeTeam.form,
      record: match.homeTeam.record,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      shortName: match.awayTeam.shortName,
      logo: match.awayTeam.logo,
      form: match.awayTeam.form,
      record: match.awayTeam.record,
    },
    kickoffTime: new Date(match.kickoffTime).toISOString(),
    status: match.status as MatchData['status'],
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    minute: match.minute,
    period: match.period,
    league: match.league,
    sport: match.sport,
    odds: (() => {
      if (match.odds) {
        return { home: match.odds.home, draw: match.odds.draw, away: match.odds.away, bookmaker: match.odds.bookmaker };
      }
      // Always generate computed odds so match cards always show them
      const sportSlug = match.sport.slug
      const sportType: Parameters<typeof generateRealisticOdds>[2] =
        (sportSlug === 'soccer' || sportSlug === 'football') ? 'soccer'
        : sportSlug === 'basketball' ? 'basketball'
        : sportSlug === 'americanfootball' ? 'football'
        : sportSlug === 'baseball' ? 'baseball'
        : (sportSlug === 'hockey' || sportSlug === 'icehockey') ? 'hockey'
        : sportSlug === 'mma' ? 'mma'
        : sportSlug === 'tennis' ? 'tennis'
        : sportSlug === 'cricket' ? 'cricket'
        : sportSlug === 'rugby' ? 'rugby'
        : sportSlug === 'golf' ? 'golf'
        : sportSlug === 'racing' ? 'racing'
        : 'soccer';
      const computed = generateRealisticOdds(match.homeTeam.name, match.awayTeam.name, sportType);
      return { home: computed.home, draw: computed.draw, away: computed.away, bookmaker: 'Computed' };
    })(),
    markets: match.markets,
    tipsCount: match.tipsCount,
    source: match.source,
    venue: match.venue,
  };
}

// Day bucket for a kickoff timestamp (ms) relative to the user's timezone.
// Returns 0=today, 1=tomorrow, 2+=future, negative=past.
// Uses only arithmetic — no Date object construction — for maximum speed.
function getDayBucketMs(kickoffMs: number, tzOffsetMs: number, nowMs: number): number {
  const DAY = 86_400_000;
  const localNow  = nowMs     + tzOffsetMs;
  const localKick = kickoffMs + tzOffsetMs;
  const todayStart = localNow  - (localNow  % DAY);
  const kickStart  = localKick - (localKick % DAY);
  return Math.round((kickStart - todayStart) / DAY);
}

// Legacy overload used by status-filter helper below.
function getDayBucket(kickoff: Date, tzOffsetMin: number): number {
  return getDayBucketMs(kickoff.getTime(), tzOffsetMin * 60_000, Date.now());
}

// Sort: today first → live first → sport priority → league priority → time asc.
// Sort keys are pre-computed once (O(n)) to avoid repeated Date work inside
// the O(n log n) comparator.
function sortMatches(matches: MatchData[], userCountryCode: string, tzOffsetMin: number): MatchData[] {
  const leaguePriority = COUNTRY_LEAGUES[userCountryCode.toUpperCase()] || EUROPEAN_TOP_5_LEAGUES;
  const liveStatuses   = new Set(['live', 'halftime', 'extra_time', 'penalties']);
  const tzOffsetMs     = tzOffsetMin * 60_000;
  const nowMs          = Date.now();

  type Tagged = {
    m: MatchData;
    isLive: boolean;
    bucket: number;
    sportP: number;
    leagueP: number;
    kickMs: number;
  };

  const tagged: Tagged[] = matches.map(m => {
    const kickMs  = new Date(m.kickoffTime).getTime();
    const raw     = getDayBucketMs(kickMs, tzOffsetMs, nowMs);
    const bucket  = raw < 0 ? 9999 + Math.abs(raw) : raw;
    const idxL    = leaguePriority.indexOf(m.leagueId);
    return {
      m,
      isLive:  liveStatuses.has(m.status),
      bucket,
      sportP:  SPORT_PRIORITY[m.sportId] ?? 99,
      leagueP: idxL === -1 ? 999 : idxL,
      kickMs,
    };
  });

  tagged.sort((a, b) => {
    if (a.isLive !== b.isLive)      return a.isLive ? -1 : 1;
    if (a.bucket  !== b.bucket)     return a.bucket  - b.bucket;
    if (a.sportP  !== b.sportP)     return a.sportP  - b.sportP;
    if (a.leagueP !== b.leagueP)    return a.leagueP - b.leagueP;
    return a.kickMs - b.kickMs;
  });

  return tagged.map(t => t.m);
}

// ── Stale-live detection constants (used in route cache + per-request) ────────
const STALE_LIVE_HOURS: Record<string, number> = {
  soccer: 3.5, football: 3.5, basketball: 3.5,
  americanfootball: 4.5, baseball: 5, hockey: 4, icehockey: 4,
  tennis: 6, cricket: 10, rugby: 3, mma: 4, boxing: 4,
  golf: 12, racing: 6,
};

function isStaleLive(m: MatchData): boolean {
  const live = m.status === 'live' || m.status === 'halftime' ||
    m.status === 'extra_time' || m.status === 'penalties';
  if (!live) return false;
  const slug = m.sport.slug;
  const maxHours = STALE_LIVE_HOURS[slug] ?? 4;
  const ageHours = (Date.now() - new Date(m.kickoffTime).getTime()) / 3_600_000;
  return ageHours > maxHours;
}

// ── Route-level in-process cache ──────────────────────────────────────────────
// Caches the processed MatchData[] (post getAllMatches + convertToMatchData +
// stale-live filter) so per-request work is only geo-sort + status filter
// (<2 ms). Promise dedup prevents stampedes when the cache is cold.
//
// TTL: 90 s — comfortably within the 3-min getAllMatches() in-process TTL,
// so background refreshes from the lower layer stay ahead of this window.
const ROUTE_CACHE_TTL = 90_000;

interface RouteCacheEntry {
  data: MatchData[];
  source: string;
  ts: number;
}

let g_routeCache: RouteCacheEntry | null = null;
let g_routePromise: Promise<RouteCacheEntry> | null = null;

async function getProcessedMatches(): Promise<RouteCacheEntry> {
  // Serve from in-process cache if fresh
  if (g_routeCache && Date.now() - g_routeCache.ts < ROUTE_CACHE_TTL) {
    return g_routeCache;
  }

  // Deduplicate concurrent requests — all share the same promise
  if (g_routePromise) return g_routePromise;

  g_routePromise = (async (): Promise<RouteCacheEntry> => {
    const apiMatches = await getAllMatches();
    const sources = new Set(apiMatches.map(m => m.source));
    const source = Array.from(sources).join('+') || 'espn';

    let matches = apiMatches.map(convertToMatchData);
    matches = matches.filter(m => !isStaleLive(m));

    const entry: RouteCacheEntry = { data: matches, source, ts: Date.now() };
    g_routeCache = entry;
    return entry;
  })().finally(() => {
    g_routePromise = null;
  });

  return g_routePromise;
}

// International competition league IDs
const INTL_LEAGUE_IDS = new Set([9, 10, 26, 102, 24, 29, 30, 31, 104, 111, 109, 80, 25]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sportId = searchParams.get('sportId');
  const leagueId = searchParams.get('leagueId');
  const status = searchParams.get('status');
  const countryCode = searchParams.get('countryCode') || 'GB';
  const tzOffsetMin = parseInt(searchParams.get('tzOffsetMin') || '0', 10);
  const matchId = searchParams.get('matchId');
  const category = searchParams.get('category');
  const limit = searchParams.get('limit');

  try {
    let matches: MatchData[] = [];
    let apiSource = 'espn';

    if (matchId) {
      const match = await getMatchById(matchId);
      if (match) {
        return NextResponse.json({
          match: convertToMatchData(match),
          source: match.source,
        });
      }
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (sportId) {
      // Sport-specific: go direct (cached per-sport in unified-sports-api)
      const apiMatches = await getMatchesBySport(parseInt(sportId));
      matches = apiMatches.map(convertToMatchData).filter(m => !isStaleLive(m));
      const sources = new Set(apiMatches.map(m => m.source));
      apiSource = Array.from(sources).join('+') || 'espn';
    } else if (leagueId) {
      // League-specific: go direct
      const apiMatches = await getMatchesByLeague(parseInt(leagueId));
      matches = apiMatches.map(convertToMatchData).filter(m => !isStaleLive(m));
      const sources = new Set(apiMatches.map(m => m.source));
      apiSource = Array.from(sources).join('+') || 'espn';
    } else if (status === 'live') {
      // Live: lightweight filter on top of getProcessedMatches() (fast path)
      const cached = await getProcessedMatches();
      apiSource = cached.source;
      matches = cached.data.filter(m =>
        m.status === 'live' || m.status === 'halftime' ||
        m.status === 'extra_time' || m.status === 'penalties'
      );
    } else {
      // ALL other cases (including status=upcoming, status=finished, status=today,
      // category=international, etc.) — serve from the route-level cache.
      const cached = await getProcessedMatches();
      apiSource = cached.source;
      matches = cached.data;
    }

    // Category filter
    if (category === 'international') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      matches = matches.filter(m => {
        const t = new Date(m.kickoffTime).getTime();
        return INTL_LEAGUE_IDS.has(m.leagueId) && t >= today.getTime() && t <= todayEnd.getTime();
      });
    }

    // Limit (applied before status filter so we don't over-trim)
    if (limit && !status) {
      matches = matches.slice(0, parseInt(limit, 10));
    }

    // Status filter
    if (status === 'upcoming') {
      matches = matches.filter(m =>
        m.status === 'scheduled' || m.status === 'live' ||
        m.status === 'halftime' || m.status === 'extra_time' || m.status === 'penalties'
      );
    } else if (status === 'finished' || status === 'results') {
      matches = matches.filter(m => m.status === 'finished');
    } else if (status === 'today') {
      matches = matches.filter(m => getDayBucket(new Date(m.kickoffTime), tzOffsetMin) === 0);
    } else if (status && status !== 'all' && status !== 'live') {
      matches = matches.filter(m => m.status === status);
    } else if (!status || status === 'all') {
      // Default: keep today's matches even if finished; drop finished from other days
      matches = matches.filter(m => {
        if (m.status === 'cancelled' || m.status === 'postponed') return false;
        if (m.status === 'finished') {
          return getDayBucket(new Date(m.kickoffTime), tzOffsetMin) === 0;
        }
        return true;
      });
    }

    // Post-status limit (for ?status=live&limit=20 style requests)
    if (limit && status) {
      matches = matches.slice(0, parseInt(limit, 10));
    }

    // Geo sort
    matches = sortMatches(matches, countryCode, tzOffsetMin);

    const stats = {
      total: matches.length,
      live: matches.filter(m =>
        m.status === 'live' || m.status === 'halftime' ||
        m.status === 'extra_time' || m.status === 'penalties'
      ).length,
      today: matches.filter(m => getDayBucket(new Date(m.kickoffTime), tzOffsetMin) === 0).length,
      upcoming: matches.filter(m => m.status === 'scheduled').length,
      finished: 0,
    };

    const res = NextResponse.json({
      matches,
      stats,
      source: apiSource,
      timestamp: new Date().toISOString(),
    });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch (error) {
    console.error('[Matches API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}
