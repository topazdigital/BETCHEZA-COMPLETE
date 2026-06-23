// ============================================================
// SofaScore — public JSON API (no key required)
// Covers 2,600+ matches per day across 35+ sports.
// NOTE: api.sofascore.com returns 403 from shared cloud IPs
//       (Replit, Vercel, Railway, etc.) but works fine from
//       a dedicated VPS/DirectAdmin server like betcheza.co.ke.
// ============================================================

import type { UnifiedMatch } from './unified-sports-api';

const SS_BASE      = 'https://api.sofascore.com/api/v1';
const CACHE_MS     = 10 * 60 * 1000;  // 10 min for scheduled matches
const LIVE_CACHE_MS = 60 * 1000;       // 1 min for live matches

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface SportConfig {
  slug: string;
  sportId: number;
  sportKey: string;
  sportName: string;
  icon: string;
}

// All sports fetched for scheduled events (today ± window)
const SS_ALL_SPORTS: SportConfig[] = [
  { slug: 'football',           sportId: 1,  sportKey: 'soccer',           sportName: 'Football',           icon: '⚽' },
  { slug: 'basketball',         sportId: 2,  sportKey: 'basketball',        sportName: 'Basketball',         icon: '🏀' },
  { slug: 'tennis',             sportId: 3,  sportKey: 'tennis',            sportName: 'Tennis',             icon: '🎾' },
  { slug: 'ice-hockey',         sportId: 7,  sportKey: 'hockey',            sportName: 'Ice Hockey',         icon: '🏒' },
  { slug: 'baseball',           sportId: 6,  sportKey: 'baseball',          sportName: 'Baseball',           icon: '⚾' },
  { slug: 'american-football',  sportId: 5,  sportKey: 'americanfootball',  sportName: 'American Football',  icon: '🏈' },
  { slug: 'volleyball',         sportId: 14, sportKey: 'volleyball',        sportName: 'Volleyball',         icon: '🏐' },
  { slug: 'rugby',              sportId: 12, sportKey: 'rugby',             sportName: 'Rugby',              icon: '🏉' },
  { slug: 'cricket',            sportId: 8,  sportKey: 'cricket',           sportName: 'Cricket',            icon: '🏏' },
  { slug: 'handball',           sportId: 24, sportKey: 'handball',          sportName: 'Handball',           icon: '🤾' },
  { slug: 'mma',                sportId: 36, sportKey: 'mma',               sportName: 'MMA',                icon: '🥊' },
  { slug: 'badminton',          sportId: 31, sportKey: 'badminton',         sportName: 'Badminton',          icon: '🏸' },
  { slug: 'table-tennis',       sportId: 23, sportKey: 'tabletennis',       sportName: 'Table Tennis',       icon: '🏓' },
  { slug: 'snooker',            sportId: 19, sportKey: 'snooker',           sportName: 'Snooker',            icon: '🎱' },
  { slug: 'darts',              sportId: 25, sportKey: 'darts',             sportName: 'Darts',              icon: '🎯' },
  { slug: 'futsal',             sportId: 40, sportKey: 'futsal',            sportName: 'Futsal',             icon: '⚽' },
  { slug: 'beach-volleyball',   sportId: 34, sportKey: 'beachvolleyball',   sportName: 'Beach Volleyball',   icon: '🏐' },
  { slug: 'water-polo',         sportId: 14, sportKey: 'waterpolo',         sportName: 'Water Polo',         icon: '🤽' },
  { slug: 'golf',               sportId: 9,  sportKey: 'golf',              sportName: 'Golf',               icon: '⛳' },
  { slug: 'cycling',            sportId: 17, sportKey: 'cycling',           sportName: 'Cycling',            icon: '🚴' },
];

// Sports fetched for live events — all from SS_ALL_SPORTS except slow/rare ones
// (Golf, Cycling rarely have meaningful real-time live scores)
const SS_LIVE_SPORTS: SportConfig[] = SS_ALL_SPORTS.filter(
  s => !['golf', 'cycling'].includes(s.slug)
);

// ── SofaScore type interfaces ─────────────────────────────────────────────────

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

// ── Caches ────────────────────────────────────────────────────────────────────

const cache      = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const liveCache  = new Map<string, { data: UnifiedMatch[]; expires: number }>();

// ── Status & minute helpers ───────────────────────────────────────────────────

function mapStatus(s: SSStatus): UnifiedMatch['status'] {
  const t    = s?.type  || '';
  const code = s?.code  ?? 0;
  if (t === 'finished')                        return 'finished';
  if (t === 'inprogress') {
    if (code === 31)                           return 'halftime';
    return 'live';
  }
  if (t === 'notstarted')                      return 'scheduled';
  if (t === 'cancelled' || t === 'postponed')  return 'cancelled';
  return 'scheduled';
}

function leagueIdFromSSId(id: number): number {
  return 9100 + (id % 900);
}

/**
 * Calculate the current match minute from SofaScore timing data.
 * SofaScore provides currentPeriodStartTimestamp (Unix seconds) for the active period.
 *
 * Football period codes:
 *   6 = 1st half  |  31 = Half time  |  7 = 2nd half
 *  41 = ET 1st    |  42 = ET 2nd     |  50 = Penalties
 */
function calcMinute(event: SSEvent): number | null {
  const code = event.status?.code ?? 0;
  const t    = event.time;
  if (!t?.currentPeriodStartTimestamp) return null;

  const nowSecs      = Date.now() / 1000;
  const secsInPeriod = Math.max(0, nowSecs - t.currentPeriodStartTimestamp);
  const minsInPeriod = Math.floor(secsInPeriod / 60);

  if (code === 6)  return Math.min(minsInPeriod, 45);         // 1st half
  if (code === 31) return 45;                                  // Half time
  if (code === 7)  return Math.min(45 + minsInPeriod, 90);    // 2nd half
  if (code === 41) return Math.min(90 + minsInPeriod, 105);   // ET 1st
  if (code === 42) return Math.min(105 + minsInPeriod, 120);  // ET 2nd
  if (code === 50) return 120;                                 // Penalties
  return minsInPeriod > 0 ? minsInPeriod : null;
}

function mapEvent(e: SSEvent, sport: SportConfig): UnifiedMatch | null {
  if (!e.homeTeam?.name || !e.awayTeam?.name) return null;

  const tournament  = e.tournament;
  const unique      = tournament?.uniqueTournament;
  const category    = unique?.category;
  const country     = category?.name || 'International';
  const countryCode = (category?.alpha2 || 'INT').toUpperCase().slice(0, 2);
  const leagueName  = unique?.name || tournament?.name || 'Unknown League';
  const leagueId    = leagueIdFromSSId(unique?.id ?? tournament?.id ?? 0);

  const kickoff   = new Date(e.startTimestamp * 1000);
  const status    = mapStatus(e.status);
  const homeScore = e.homeScore?.current ?? e.homeScore?.display ?? null;
  const awayScore = e.awayScore?.current ?? e.awayScore?.display ?? null;
  const minute    = calcMinute(e);

  return {
    id:          `ss_${e.id}`,
    externalId:  String(e.id),
    source:      'sportsdata-io',
    sportId:     sport.sportId,
    sportKey:    sport.sportKey,
    leagueId,
    leagueKey:   `ss_${unique?.id ?? tournament?.id}`,
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
    homeScore:   typeof homeScore === 'number' ? homeScore : null,
    awayScore:   typeof awayScore === 'number' ? awayScore : null,
    matchMinute: typeof minute    === 'number' ? minute    : undefined,
    league: {
      id:          leagueId,
      name:        leagueName,
      slug:        leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      country,
      countryCode,
      tier: 2,
    },
    sport: {
      id:   sport.sportId,
      name: sport.sportName,
      slug: sport.sportKey,
      icon: sport.icon,
    },
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

// ── Scheduled match fetching (all sports, by date) ────────────────────────────

async function fetchDayForSport(dateStr: string, sport: SportConfig): Promise<UnifiedMatch[]> {
  const ck  = `ss-${sport.slug}-${dateStr}`;
  const hit = cache.get(ck);
  if (hit && hit.expires > Date.now()) return hit.data;

  const data = await ssGet<{ events?: SSEvent[] }>(
    `${SS_BASE}/sport/${sport.slug}/scheduled-events/${dateStr}`,
  );

  const out: UnifiedMatch[] = [];
  if (data?.events) {
    for (const ev of data.events) {
      const u = mapEvent(ev, sport);
      if (u) out.push(u);
    }
  }

  cache.set(ck, { data: out, expires: Date.now() + CACHE_MS });
  return out;
}

function dateStr(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Fetch SofaScore events for all 20 sports, today ± window.
 * Uses p-limit (concurrency 6) so we don't flood SofaScore.
 * Results are cached 10 minutes per sport-day pair.
 * Works on VPS; returns empty array silently on Replit/Vercel (403).
 */
export async function fetchSofaScoreMatches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_SOFASCORE === 'true') return [];

  // Fetch yesterday + today + next 4 days for each sport
  const days = [-1, 0, 1, 2, 3, 4].map(dateStr);
  const tasks: Array<() => Promise<UnifiedMatch[]>> = [];
  for (const sport of SS_ALL_SPORTS) {
    for (const day of days) {
      tasks.push(() => fetchDayForSport(day, sport));
    }
  }

  // Run with concurrency limit to avoid flooding SofaScore
  const { default: pLimit } = await import('p-limit').catch(() => ({ default: null }));
  const limit = pLimit ? pLimit(6) : null;

  const settled = await Promise.allSettled(
    limit ? tasks.map(t => limit(t)) : tasks.map(t => t())
  );

  const out: UnifiedMatch[] = [];
  for (const r of settled) if (r.status === 'fulfilled') out.push(...r.value);

  if (out.length > 0) {
    console.log(`[SofaScore] ${out.length} scheduled events across ${SS_ALL_SPORTS.length} sports`);
  }
  return out;
}

// ── Live match fetching (all sports) ─────────────────────────────────────────

/** Fetch all currently live events for one sport. Cached for 1 minute. */
async function fetchLiveForSport(sport: SportConfig): Promise<UnifiedMatch[]> {
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
      const u = mapEvent(ev, sport);
      if (u) out.push(u);
    }
  }

  liveCache.set(ck, { data: out, expires: Date.now() + LIVE_CACHE_MS });
  return out;
}

/**
 * Fetch all currently live events across all major sports from SofaScore.
 * Returns real scores, exact match minute, and accurate status.
 * Works on a dedicated VPS; returns empty array silently on Replit/Vercel (403).
 */
export async function fetchSofaScoreLiveMatches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_SOFASCORE === 'true') return [];

  const results = await Promise.allSettled(SS_LIVE_SPORTS.map(fetchLiveForSport));
  const out: UnifiedMatch[] = [];
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);

  if (out.length > 0) {
    console.log(`[SofaScore] ${out.length} live events across ${SS_LIVE_SPORTS.length} sports`);
  }
  return out;
}

// ── Single-match live score lookup (used by details route) ────────────────────

/**
 * Look up a specific live match on SofaScore by team names.
 * Used in the match-details route when ESPN is unavailable — returns real
 * scores and minute so the page shows actual data, not a clock guess.
 *
 * Returns null if the match is not currently live on SofaScore, or if
 * SofaScore is unreachable (403 on Replit, timeout, etc.).
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

  const sport =
    SS_LIVE_SPORTS.find(s => s.slug === sportSlug || s.sportKey === sportSlug)
    ?? SS_LIVE_SPORTS[0];

  const live = await fetchLiveForSport(sport);
  if (!live.length) return null;

  const norm  = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hNorm = norm(homeTeam);
  const aNorm = norm(awayTeam);

  const found = live.find(m => {
    const mh = norm(m.homeTeam.name);
    const ma = norm(m.awayTeam.name);
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
