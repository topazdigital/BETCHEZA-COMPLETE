// ============================================================
// SofaScore — public JSON API (no key required)
// Covers 2,600+ matches per day across all major sports.
// NOTE: api.sofascore.com returns 403 from shared cloud IPs
//       (Replit, Vercel, Railway, etc.) but works fine from
//       a dedicated VPS/DirectAdmin server like betcheza.co.ke.
// ============================================================

import type { UnifiedMatch } from './unified-sports-api';

const SS_BASE = 'https://api.sofascore.com/api/v1';
const CACHE_MS = 10 * 60 * 1000;    // 10 min for scheduled matches
const LIVE_CACHE_MS = 60 * 1000;    // 1 min for live matches

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Sports covered for live match fetching
const SS_LIVE_SPORTS: Array<{
  slug: string; sportId: number; sportKey: string; sportName: string; icon: string;
}> = [
  { slug: 'football',          sportId: 1,  sportKey: 'soccer',          sportName: 'Football',          icon: '⚽' },
  { slug: 'basketball',        sportId: 2,  sportKey: 'basketball',       sportName: 'Basketball',        icon: '🏀' },
  { slug: 'tennis',            sportId: 3,  sportKey: 'tennis',           sportName: 'Tennis',            icon: '🎾' },
  { slug: 'ice-hockey',        sportId: 7,  sportKey: 'hockey',           sportName: 'Ice Hockey',        icon: '🏒' },
  { slug: 'baseball',          sportId: 6,  sportKey: 'baseball',         sportName: 'Baseball',          icon: '⚾' },
  { slug: 'american-football', sportId: 5,  sportKey: 'americanfootball', sportName: 'American Football', icon: '🏈' },
  { slug: 'volleyball',        sportId: 14, sportKey: 'volleyball',       sportName: 'Volleyball',        icon: '🏐' },
  { slug: 'rugby',             sportId: 12, sportKey: 'rugby',            sportName: 'Rugby',             icon: '🏉' },
];

interface SSTeam {
  id: number;
  name: string;
  shortName?: string;
  nameCode?: string;
}

interface SSScore {
  current?: number;
  display?: number;
  period1?: number;
  period2?: number;
}

interface SSTournament {
  id: number;
  name: string;
  slug?: string;
  uniqueTournament?: {
    id: number;
    name: string;
    slug?: string;
    category?: { id: number; name: string; slug?: string; alpha2?: string };
  };
}

interface SSStatus {
  code: number;
  description: string;
  type: string;
}

interface SSTime {
  currentPeriodStartTimestamp?: number;
  injuryTime1?: number;
  injuryTime2?: number;
  played?: number;
}

interface SSEvent {
  id: number;
  slug?: string;
  tournament: SSTournament;
  season?: { id: number; name: string };
  startTimestamp: number;
  status: SSStatus;
  homeTeam: SSTeam;
  awayTeam: SSTeam;
  homeScore?: SSScore;
  awayScore?: SSScore;
  time?: SSTime;
  roundInfo?: { round?: number };
}

const cache     = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const liveCache = new Map<string, { data: UnifiedMatch[]; expires: number }>();

function mapStatus(s: SSStatus): UnifiedMatch['status'] {
  const t    = s?.type || '';
  const code = s?.code ?? 0;
  if (t === 'finished')                          return 'finished';
  if (t === 'inprogress') {
    if (code === 31)                             return 'halftime';
    return 'live';
  }
  if (t === 'notstarted')                        return 'scheduled';
  if (t === 'cancelled' || t === 'postponed')    return 'cancelled';
  return 'scheduled';
}

function leagueIdFromSSId(id: number): number {
  return 9100 + (id % 900);
}

/**
 * Calculate the current match minute from SofaScore timing data.
 * SofaScore provides currentPeriodStartTimestamp (Unix seconds) for the active period.
 *
 * Period codes (football):
 *   6  = 1st half        31 = Half time
 *   7  = 2nd half        41 = ET 1st half
 *   42 = ET 2nd half     50 = Penalties
 */
function calcMinute(event: SSEvent): number | null {
  const code = event.status?.code ?? 0;
  const t    = event.time;
  if (!t?.currentPeriodStartTimestamp) return null;

  const nowSecs        = Date.now() / 1000;
  const secsInPeriod   = Math.max(0, nowSecs - t.currentPeriodStartTimestamp);
  const minsInPeriod   = Math.floor(secsInPeriod / 60);

  if (code === 6)  return Math.min(minsInPeriod, 45);             // 1st half
  if (code === 31) return 45;                                      // Half time
  if (code === 7)  return Math.min(45 + minsInPeriod, 90);        // 2nd half
  if (code === 41) return Math.min(90 + minsInPeriod, 105);       // ET 1st
  if (code === 42) return Math.min(105 + minsInPeriod, 120);      // ET 2nd
  if (code === 50) return 120;                                     // Penalties

  return minsInPeriod > 0 ? minsInPeriod : null;
}

function mapEvent(
  e: SSEvent,
  sportId  = 1,
  sportKey = 'soccer',
  sportName = 'Football',
  sportIcon = '⚽',
): UnifiedMatch | null {
  if (!e.homeTeam?.name || !e.awayTeam?.name) return null;

  const tournament  = e.tournament;
  const unique      = tournament?.uniqueTournament;
  const category    = unique?.category;
  const country     = category?.name || 'International';
  const countryCode = (category?.alpha2 || 'INT').toUpperCase().slice(0, 2);
  const leagueName  = unique?.name || tournament?.name || 'Unknown League';
  const leagueId    = leagueIdFromSSId(unique?.id ?? tournament?.id ?? 0);

  const kickoff  = new Date(e.startTimestamp * 1000);
  const status   = mapStatus(e.status);
  const homeScore = e.homeScore?.current ?? e.homeScore?.display ?? null;
  const awayScore = e.awayScore?.current ?? e.awayScore?.display ?? null;
  const minute    = calcMinute(e);

  return {
    id:         `ss_${e.id}`,
    externalId: String(e.id),
    source:     'sportsdata-io',
    sportId,
    sportKey,
    leagueId,
    leagueKey: `ss_${unique?.id ?? tournament?.id}`,
    homeTeam: {
      id:        `ss_team_${e.homeTeam.id}`,
      name:      e.homeTeam.name,
      shortName: e.homeTeam.shortName || e.homeTeam.nameCode || e.homeTeam.name,
    },
    awayTeam: {
      id:        `ss_team_${e.awayTeam.id}`,
      name:      e.awayTeam.name,
      shortName: e.awayTeam.shortName || e.awayTeam.nameCode || e.awayTeam.name,
    },
    kickoffTime:  kickoff,
    status,
    homeScore:    typeof homeScore === 'number' ? homeScore : null,
    awayScore:    typeof awayScore === 'number' ? awayScore : null,
    matchMinute:  typeof minute === 'number' ? minute : undefined,
    league: {
      id:          leagueId,
      name:        leagueName,
      slug:        leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      country,
      countryCode,
      tier: 2,
    },
    sport: { id: sportId, name: sportName, slug: sportKey, icon: sportIcon },
    tipsCount: 0,
  };
}

/** Shared fetch helper with browser-like headers. Returns null on any error. */
async function ssGet<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      UA,
        Accept:            'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin:            'https://www.sofascore.com',
        Referer:           'https://www.sofascore.com/',
        'Cache-Control':   'no-cache',
      },
      cache:  'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Scheduled matches (football only, by date) ────────────────────────────────

async function fetchDay(dateStr: string): Promise<UnifiedMatch[]> {
  const ck  = `ss-${dateStr}`;
  const hit = cache.get(ck);
  if (hit && hit.expires > Date.now()) return hit.data;

  const data = await ssGet<{ events?: SSEvent[] }>(
    `${SS_BASE}/sport/football/scheduled-events/${dateStr}`,
  );

  const out: UnifiedMatch[] = [];
  if (data?.events) {
    for (const ev of data.events) {
      const u = mapEvent(ev, 1, 'soccer', 'Football', '⚽');
      if (u) out.push(u);
    }
  }

  cache.set(ck, { data: out, expires: Date.now() + CACHE_MS });
  return out;
}

/**
 * Fetch SofaScore football events for today + next 4 days.
 * Also fetches live events from a separate endpoint.
 * Returns empty array silently on any network/auth failure.
 */
export async function fetchSofaScoreMatches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_SOFASCORE === 'true') return [];

  const now = new Date();
  const days: string[] = [];

  for (let i = -1; i <= 4; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    );
  }

  const results = await Promise.allSettled(days.map(fetchDay));
  const out: UnifiedMatch[] = [];
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);
  return out;
}

// ── Live matches (all sports) ─────────────────────────────────────────────────

/**
 * Fetch all currently live events for one sport from SofaScore.
 * Results cached for 1 minute so repeated calls don't flood the API.
 */
async function fetchLiveForSport(sport: typeof SS_LIVE_SPORTS[0]): Promise<UnifiedMatch[]> {
  const ck  = `ss-live-${sport.slug}`;
  const hit = liveCache.get(ck);
  if (hit && hit.expires > Date.now()) return hit.data;

  const data = await ssGet<{ events?: SSEvent[] }>(
    `${SS_BASE}/sport/${sport.slug}/events/live`,
    6000,
  );

  const out: UnifiedMatch[] = [];
  if (data?.events) {
    for (const ev of data.events) {
      const u = mapEvent(ev, sport.sportId, sport.sportKey, sport.sportName, sport.icon);
      if (u) out.push(u);
    }
  }

  liveCache.set(ck, { data: out, expires: Date.now() + LIVE_CACHE_MS });
  return out;
}

/**
 * Fetch all currently live events across all major sports from SofaScore.
 * Returns real scores, match minute, and accurate live/halftime/finished status.
 * Works on a dedicated VPS; returns empty array silently on Replit/Vercel (403).
 */
export async function fetchSofaScoreLiveMatches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_SOFASCORE === 'true') return [];

  const results = await Promise.allSettled(SS_LIVE_SPORTS.map(fetchLiveForSport));
  const out: UnifiedMatch[] = [];
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);

  if (out.length > 0) {
    console.log(`[SofaScore] ${out.length} live events fetched across ${SS_LIVE_SPORTS.length} sports`);
  }
  return out;
}

/**
 * Look up a specific live match on SofaScore by team names.
 * Used in the match-details route when ESPN is unavailable — returns real
 * scores and minute so the page shows actual data, not just a clock guess.
 *
 * Returns null if the match is not currently live on SofaScore, or if
 * SofaScore is unreachable (403 on Replit, timeout on VPS, etc.).
 */
export async function findSofaScoreLiveScore(
  homeTeam: string,
  awayTeam: string,
  sportSlug = 'football',
): Promise<{
  status:    UnifiedMatch['status'];
  homeScore: number;
  awayScore: number;
  minute:    number | null;
} | null> {
  if (process.env.DISABLE_SOFASCORE === 'true') return null;

  // Resolve the sport config; default to football
  const sport =
    SS_LIVE_SPORTS.find(s => s.slug === sportSlug || s.sportKey === sportSlug)
    ?? SS_LIVE_SPORTS[0];

  const live = await fetchLiveForSport(sport);
  if (!live.length) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hNorm = norm(homeTeam);
  const aNorm = norm(awayTeam);

  const found = live.find(m => {
    const mh = norm(m.homeTeam.name);
    const ma = norm(m.awayTeam.name);
    // Exact match first, then substring (handles "Man City" / "Manchester City")
    return (
      (mh === hNorm && ma === aNorm) ||
      ((mh.includes(hNorm) || hNorm.includes(mh)) &&
       (ma.includes(aNorm) || aNorm.includes(ma)))
    );
  });

  if (!found || found.status === 'scheduled') return null;

  return {
    status:    found.status,
    homeScore: found.homeScore ?? 0,
    awayScore: found.awayScore ?? 0,
    minute:    found.matchMinute ?? null,
  };
}
