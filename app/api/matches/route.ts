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

// Day buckets relative to user's timezone offset (in minutes from server UTC)
function getDayBucket(kickoff: Date, tzOffsetMin: number): number {
  // tzOffsetMin: e.g. for UTC+3, it's +180
  // Bucket: 0 = today, 1 = tomorrow, 2+ = later, -1 = past
  const now = new Date();
  const localNow = new Date(now.getTime() + tzOffsetMin * 60 * 1000);
  const localKick = new Date(kickoff.getTime() + tzOffsetMin * 60 * 1000);
  const startOfDayUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const todayStart = startOfDayUTC(localNow);
  const kickStart = startOfDayUTC(localKick);
  return Math.round((kickStart - todayStart) / (24 * 60 * 60 * 1000));
}

// Sort: today first → live first within day → sport priority → league priority → time asc
function sortMatches(matches: MatchData[], userCountryCode: string, tzOffsetMin: number): MatchData[] {
  const leaguePriority = COUNTRY_LEAGUES[userCountryCode.toUpperCase()] || EUROPEAN_TOP_5_LEAGUES;

  const liveStatuses = new Set(['live', 'halftime', 'extra_time', 'penalties']);

  return matches.slice().sort((a, b) => {
    const aLive = liveStatuses.has(a.status);
    const bLive = liveStatuses.has(b.status);

    // 1. Live matches always first across all days
    if (aLive !== bLive) return aLive ? -1 : 1;

    // 2. Day bucket - today (0) first, then tomorrow (1), etc.
    const aBucket = getDayBucket(new Date(a.kickoffTime), tzOffsetMin);
    const bBucket = getDayBucket(new Date(b.kickoffTime), tzOffsetMin);
    // Past matches (negative) go to the very end
    const aBucketSort = aBucket < 0 ? 9999 + Math.abs(aBucket) : aBucket;
    const bBucketSort = bBucket < 0 ? 9999 + Math.abs(bBucket) : bBucket;
    if (aBucketSort !== bBucketSort) return aBucketSort - bBucketSort;

    // 3. Sport priority (Football first)
    const sportA = SPORT_PRIORITY[a.sportId] ?? 99;
    const sportB = SPORT_PRIORITY[b.sportId] ?? 99;
    if (sportA !== sportB) return sportA - sportB;

    // 4. League priority (geo-aware)
    const idxA = leaguePriority.indexOf(a.leagueId);
    const idxB = leaguePriority.indexOf(b.leagueId);
    const leagueA = idxA === -1 ? 999 : idxA;
    const leagueB = idxB === -1 ? 999 : idxB;
    if (leagueA !== leagueB) return leagueA - leagueB;

    // 5. Within league: ascending time (earliest upcoming first)
    return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sportId = searchParams.get('sportId');
  const leagueId = searchParams.get('leagueId');
  const status = searchParams.get('status');
  const countryCode = searchParams.get('countryCode') || 'GB';
  const tzOffsetMin = parseInt(searchParams.get('tzOffsetMin') || '0', 10);
  const matchId = searchParams.get('matchId');

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

    // International competition league IDs (matches layout.tsx + sidebar-new.tsx)
  const INTL_LEAGUE_IDS = new Set([9, 10, 26, 102, 24, 29, 30, 31, 104, 111, 109, 80, 25]);
  const category = searchParams.get('category');
  const limit = searchParams.get('limit');

  let apiMatches: UnifiedMatch[] = [];
    if (sportId) {
      apiMatches = await getMatchesBySport(parseInt(sportId));
    } else if (leagueId) {
      apiMatches = await getMatchesByLeague(parseInt(leagueId));
    } else if (status === 'live') {
      apiMatches = await getApiLiveMatches();
    } else if (status === 'upcoming') {
      apiMatches = await getApiUpcomingMatches();
    } else {
      apiMatches = await getAllMatches();
    }

  // Filter by category if specified
  if (category === 'international') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    apiMatches = apiMatches.filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      return INTL_LEAGUE_IDS.has(m.leagueId) && t >= today.getTime() && t <= todayEnd.getTime();
    });
  }

  if (limit) {
    apiMatches = apiMatches.slice(0, parseInt(limit, 10));
  }

    matches = apiMatches.map(convertToMatchData);
    const sources = new Set(apiMatches.map(m => m.source));
    apiSource = Array.from(sources).join('+') || 'espn';

    // Stale-live guard — upstream feeds (ESPN/SportsDB) sometimes leave
    // matches stuck on "live" long after they've ended. Treat any match
    // tagged live whose kickoff was more than the sport's max duration ago
    // as finished, so the Live section never shows zombie fixtures.
    const STALE_LIVE_HOURS: Record<string, number> = {
      soccer: 3.5, football: 3.5, basketball: 3.5,
      americanfootball: 4.5, baseball: 5, hockey: 4, icehockey: 4,
      tennis: 6, cricket: 10, rugby: 3, mma: 4, boxing: 4,
      golf: 12, racing: 6,
    };
    const nowMs = Date.now();
    const isStaleLive = (m: MatchData) => {
      const live = m.status === 'live' || m.status === 'halftime' ||
        m.status === 'extra_time' || m.status === 'penalties';
      if (!live) return false;
      const slug = m.sport.slug;
      const maxHours = STALE_LIVE_HOURS[slug] ?? 4;
      const ageHours = (nowMs - new Date(m.kickoffTime).getTime()) / 3_600_000;
      return ageHours > maxHours;
    };
    // Drop stale-live matches outright — they shouldn't pollute live or
    // upcoming views (they belong on /results once the feed catches up).
    matches = matches.filter(m => !isStaleLive(m));

    // Status filter — IMPORTANT: upcoming list never shows finished
    if (status === 'live') {
      matches = matches.filter(m =>
        m.status === 'live' || m.status === 'halftime' ||
        m.status === 'extra_time' || m.status === 'penalties'
      );
    } else if (status === 'upcoming') {
      // Strictly exclude finished matches
      matches = matches.filter(m =>
        m.status === 'scheduled' || m.status === 'live' ||
        m.status === 'halftime' || m.status === 'extra_time' || m.status === 'penalties'
      );
    } else if (status === 'finished' || status === 'results') {
      matches = matches.filter(m => m.status === 'finished');
    } else if (status === 'today') {
      // Today bucket — same logic used by stats below.
      matches = matches.filter(m => getDayBucket(new Date(m.kickoffTime), tzOffsetMin) === 0);
    } else if (status && status !== 'all') {
      matches = matches.filter(m => m.status === status);
    } else {
      // Default behaviour: keep today's matches even when finished (so the
      // homepage / matches page "Today" tab shows the full daily slate
      // including final scores), but drop finished/cancelled/postponed
      // matches from other days — those belong on /results.
      matches = matches.filter(m => {
        if (m.status === 'cancelled' || m.status === 'postponed') return false;
        if (m.status === 'finished') {
          return getDayBucket(new Date(m.kickoffTime), tzOffsetMin) === 0;
        }
        return true;
      });
    }

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
    // stale-while-revalidate: browser can serve cached response for 60s,
    // then serve stale for up to 5 min while revalidating in background
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
