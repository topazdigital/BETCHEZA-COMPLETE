// ============================================================
// SofaScore — public JSON API (no key required)
// Covers 2,600+ matches per day across 35+ sports.
// NOTE: api.sofascore.com returns 403 from shared cloud IPs
//       (Replit, Vercel, Railway, etc.) but works fine from
//       a dedicated VPS/DirectAdmin server like betcheza.co.ke.
// ============================================================

import type { UnifiedMatch } from './unified-sports-api';
import { proxyFetch, isProxyConfigured } from './proxy-fetch';

const SS_BASE      = 'https://api.sofascore.com/api/v1';
const CACHE_MS     = 10 * 60 * 1000;  // 10 min for scheduled matches
const LIVE_CACHE_MS = 60 * 1000;       // 1 min for live matches
const DETAIL_CACHE_MS = 90 * 1000;    // 90 sec for event details

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface SportConfig {
  slug: string;
  sportId: number;
  sportKey: string;
  sportName: string;
  icon: string;
}

// ── Sport lists ───────────────────────────────────────────────────────────────

// All sports fetched for scheduled events (today ± window).
// IMPORTANT: sportId values must match lib/sports-data.ts ALL_SPORTS ids so
// that sport-filter counts and sport selector work correctly in the UI.
// The SofaScore API URL uses `slug` (e.g. "counter-strike") not sportId.
const SS_ALL_SPORTS: SportConfig[] = [
  // ── Traditional sports ──────────────────────────────────────────────────────
  { slug: 'football',           sportId: 1,  sportKey: 'soccer',            sportName: 'Football',           icon: '⚽' },
  { slug: 'basketball',         sportId: 2,  sportKey: 'basketball',         sportName: 'Basketball',         icon: '🏀' },
  { slug: 'tennis',             sportId: 3,  sportKey: 'tennis',             sportName: 'Tennis',             icon: '🎾' },
  { slug: 'cricket',            sportId: 4,  sportKey: 'cricket',            sportName: 'Cricket',            icon: '🏏' },
  { slug: 'american-football',  sportId: 5,  sportKey: 'americanfootball',   sportName: 'American Football',  icon: '🏈' },
  { slug: 'baseball',           sportId: 6,  sportKey: 'baseball',           sportName: 'Baseball',           icon: '⚾' },
  { slug: 'ice-hockey',         sportId: 7,  sportKey: 'hockey',             sportName: 'Ice Hockey',         icon: '🏒' },
  { slug: 'rugby',              sportId: 8,  sportKey: 'rugby',              sportName: 'Rugby',              icon: '🏉' },
  { slug: 'rugby-league',       sportId: 8,  sportKey: 'rugbyleague',        sportName: 'Rugby League',       icon: '🏉' },
  { slug: 'volleyball',         sportId: 9,  sportKey: 'volleyball',         sportName: 'Volleyball',         icon: '🏐' },
  { slug: 'handball',           sportId: 10, sportKey: 'handball',           sportName: 'Handball',           icon: '🤾' },
  { slug: 'water-polo',         sportId: 11, sportKey: 'waterpolo',          sportName: 'Water Polo',         icon: '🤽' },
  { slug: 'futsal',             sportId: 13, sportKey: 'futsal',             sportName: 'Futsal',             icon: '⚽' },
  { slug: 'beach-volleyball',   sportId: 14, sportKey: 'beachvolleyball',    sportName: 'Beach Volleyball',   icon: '🏐' },
  { slug: 'aussie-rules',       sportId: 16, sportKey: 'australianfootball', sportName: 'Aussie Rules',       icon: '🏉' },
  { slug: 'golf',               sportId: 17, sportKey: 'golf',               sportName: 'Golf',               icon: '⛳' },
  { slug: 'snooker',            sportId: 18, sportKey: 'snooker',            sportName: 'Snooker',            icon: '🎱' },
  { slug: 'darts',              sportId: 19, sportKey: 'darts',              sportName: 'Darts',              icon: '🎯' },
  { slug: 'table-tennis',       sportId: 20, sportKey: 'tabletennis',        sportName: 'Table Tennis',       icon: '🏓' },
  { slug: 'badminton',          sportId: 21, sportKey: 'badminton',          sportName: 'Badminton',          icon: '🏸' },
  { slug: 'cycling',            sportId: 23, sportKey: 'cycling',            sportName: 'Cycling',            icon: '🚴' },
  { slug: 'boxing',             sportId: 26, sportKey: 'boxing',             sportName: 'Boxing',             icon: '🥊' },
  { slug: 'mma',                sportId: 27, sportKey: 'mma',                sportName: 'MMA',                icon: '🥋' },
  // ── Esports — all titles map to internal id 33 (sports-data.ts) ────────────
  { slug: 'esports',            sportId: 33, sportKey: 'esports',            sportName: 'Esports',            icon: '🎮' },
  { slug: 'counter-strike',     sportId: 33, sportKey: 'esports',            sportName: 'CS2',                icon: '🎮' },
  { slug: 'dota-2',             sportId: 33, sportKey: 'esports',            sportName: 'Dota 2',             icon: '🎮' },
  { slug: 'league-of-legends',  sportId: 33, sportKey: 'esports',            sportName: 'League of Legends',  icon: '🎮' },
  { slug: 'valorant',           sportId: 33, sportKey: 'esports',            sportName: 'Valorant',           icon: '🎮' },
  { slug: 'rocket-league',      sportId: 33, sportKey: 'esports',            sportName: 'Rocket League',      icon: '🚀' },
  { slug: 'rainbow-six',        sportId: 33, sportKey: 'esports',            sportName: 'Rainbow Six Siege',  icon: '🎮' },
  { slug: 'overwatch',          sportId: 33, sportKey: 'esports',            sportName: 'Overwatch 2',        icon: '🎮' },
  { slug: 'king-of-glory',      sportId: 33, sportKey: 'esports',            sportName: 'King of Glory',      icon: '🎮' },
  { slug: 'starcraft-2',        sportId: 33, sportKey: 'esports',            sportName: 'StarCraft 2',        icon: '🎮' },
];

// Sports fetched for live events (exclude very slow/non-realtime ones)
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

// ── SofaScore event detail interfaces ────────────────────────────────────────

interface SSLineupsPlayer {
  player: { id: number; name: string; shortName?: string; position?: string };
  position: string;
  jerseyNumber: string;
  substitute: boolean;
  captain?: boolean;
}

interface SSLineupsResponse {
  home?: {
    formation?: string;
    players?: SSLineupsPlayer[];
    missingPlayers?: Array<{ player: { id: number; name: string }; type: string }>;
  };
  away?: {
    formation?: string;
    players?: SSLineupsPlayer[];
    missingPlayers?: Array<{ player: { id: number; name: string }; type: string }>;
  };
  confirmed?: boolean;
}

interface SSStatItem {
  name: string;
  home: string | number;
  away: string | number;
  homeValue?: number;
  awayValue?: number;
  key?: string;
  compareCode?: number;
}

interface SSStatGroup {
  groupName: string;
  statisticsItems: SSStatItem[];
}

interface SSStatPeriod {
  period: string;
  groups: SSStatGroup[];
}

interface SSStatisticsResponse {
  statistics?: SSStatPeriod[];
}

interface SSIncident {
  time: number;
  addedTime?: number;
  type?: string;
  incidentType: string;
  incidentClass?: string;
  isHome?: boolean;
  homeScore?: number;
  awayScore?: number;
  player?: { id: number; name: string; shortName?: string };
  playerIn?: { id: number; name: string; shortName?: string };
  playerOut?: { id: number; name: string; shortName?: string };
  assist1?: { id: number; name: string; shortName?: string };
  description?: string;
  reason?: string;
  rescinded?: boolean;
}

interface SSIncidentsResponse {
  incidents?: SSIncident[];
}

// ── Caches ────────────────────────────────────────────────────────────────────

const cache       = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const liveCache   = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const detailCache = new Map<number, { data: SSEventDetails; expires: number }>();
const crossRefCache = new Map<string, { id: number | null; expires: number }>();

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
  if (t === 'cancelled')  return 'cancelled';
  if (t === 'postponed') return 'postponed';
  return 'scheduled';
}

function leagueIdFromSSId(id: number): number {
  return 9100 + (id % 900);
}

/**
 * Calculate the current match minute from SofaScore timing data.
 * Football period codes:
 *   6 = 1st half  |  31 = Half time  |  7 = 2nd half
 *  41 = ET 1st    |  42 = ET 2nd     |  50 = Penalties
 * Injury time (stoppage time) is included so "90+3" shows as 93 etc.
 */
function calcMinute(event: SSEvent): number | null {
  const code = event.status?.code ?? 0;
  const t    = event.time;
  if (!t?.currentPeriodStartTimestamp) return null;

  const nowSecs      = Date.now() / 1000;
  const secsInPeriod = Math.max(0, nowSecs - t.currentPeriodStartTimestamp);
  const minsInPeriod = Math.floor(secsInPeriod / 60);

  const inj1 = t.injuryTime1 ?? 5;  // default 5min stoppage if not specified
  const inj2 = t.injuryTime2 ?? 5;

  if (code === 6)  return Math.min(minsInPeriod, 45 + inj1);
  if (code === 31) return 45;
  if (code === 7)  return Math.min(45 + minsInPeriod, 90 + inj2);
  if (code === 41) return Math.min(90 + minsInPeriod, 105 + 5);
  if (code === 42) return Math.min(105 + minsInPeriod, 120 + 5);
  if (code === 50) return 120;
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

// Track 403s to avoid spamming logs — log once per sport slug per process run
const _ss403Logged = new Set<string>();

// Circuit-breaker: after 5 consecutive 403s across any URL, flip the breaker
// and skip ALL SofaScore requests for 60 minutes. This avoids hammering a
// blocked endpoint on every cron tick. The breaker resets if a request succeeds.
let _ssBlockedUntil = 0;
let _ss403Count = 0;
const SS_BLOCK_THRESHOLD = 5;
const SS_BLOCK_TTL_MS = 60 * 60 * 1000; // 1 hour
function ssIsBlocked(): boolean {
  return _ssBlockedUntil > 0 && Date.now() < _ssBlockedUntil;
}

/** Shared fetch helper with browser-like headers. Routes through CF proxy when configured. */
async function ssGet<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const via = isProxyConfigured() ? 'proxy' : 'direct';
  try {
    const res = await proxyFetch(url, {
      timeoutMs,
      headers: {
        'User-Agent':      UA,
        Accept:            'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin:            'https://www.sofascore.com',
        Referer:           'https://www.sofascore.com/',
        'Cache-Control':   'no-cache',
        'sec-fetch-dest':  'empty',
        'sec-fetch-mode':  'cors',
        'sec-fetch-site':  'same-site',
      },
    });
    if (!res.ok) {
      const logKey = url.replace(/\d{4}-\d{2}-\d{2}/, 'DATE').slice(0, 80);
      if (res.status === 403) {
        _ss403Count++;
        if (_ss403Count >= SS_BLOCK_THRESHOLD && !ssIsBlocked()) {
          _ssBlockedUntil = Date.now() + SS_BLOCK_TTL_MS;
          console.warn('[SofaScore] IP blocked — circuit open for 60 min. AllSports will cover live scores.');
        }
        if (!_ss403Logged.has(logKey)) {
          _ss403Logged.add(logKey);
          if (_ss403Count <= SS_BLOCK_THRESHOLD) {
            console.warn(`[SofaScore] 403 Forbidden — IP may be blocked by SofaScore. URL: ${logKey}`);
          }
        }
      } else {
        console.warn(`[SofaScore] HTTP ${res.status} for ${logKey}`);
      }
      return null;
    }
    // Success — reset circuit breaker
    _ss403Count = 0;
    _ssBlockedUntil = 0;
    const logKey = url.replace(/\d{4}-\d{2}-\d{2}/, 'DATE').slice(0, 80);
    _ss403Logged.delete(logKey);
    return (await res.json()) as T;
  } catch (e) {
    const short = url.slice(0, 80);
    console.warn(`[SofaScore] Fetch error for ${short}: ${e instanceof Error ? e.message : String(e)}`);
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
 * Fetch SofaScore events for all 30+ sports, today ± window.
 * Uses p-limit (concurrency 6) so we don't flood SofaScore.
 */
export async function fetchSofaScoreMatches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_SOFASCORE === 'true') return [];
  if (ssIsBlocked()) return [];

  const days = [-1, 0, 1, 2, 3, 4].map(dateStr);
  const tasks: Array<() => Promise<UnifiedMatch[]>> = [];
  for (const sport of SS_ALL_SPORTS) {
    for (const day of days) {
      tasks.push(() => fetchDayForSport(day, sport));
    }
  }

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

// ── Live match fetching ───────────────────────────────────────────────────────

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

export async function fetchSofaScoreLiveMatches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_SOFASCORE === 'true') return [];
  if (ssIsBlocked()) return [];

  const results = await Promise.allSettled(SS_LIVE_SPORTS.map(fetchLiveForSport));
  const out: UnifiedMatch[] = [];
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);

  if (out.length > 0) {
    console.log(`[SofaScore] ${out.length} live events across ${SS_LIVE_SPORTS.length} sports`);
  }
  return out;
}

// ── Single-match live score lookup ────────────────────────────────────────────

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

// ── Event details: lineups, statistics, incidents ────────────────────────────

export interface SSEventDetails {
  lineups: {
    confirmed: boolean;
    home: {
      formation?: string;
      starting: Array<{ id: string; name: string; fullName: string; position?: string; jersey?: string; starter: true; headshot?: string; captain?: boolean }>;
      bench: Array<{ id: string; name: string; fullName: string; position?: string; jersey?: string; starter: false; headshot?: string }>;
    } | null;
    away: {
      formation?: string;
      starting: Array<{ id: string; name: string; fullName: string; position?: string; jersey?: string; starter: true; headshot?: string; captain?: boolean }>;
      bench: Array<{ id: string; name: string; fullName: string; position?: string; jersey?: string; starter: false; headshot?: string }>;
    } | null;
  } | null;
  teamStats: {
    home: { stats: Array<{ name: string; label: string; displayValue: string }> };
    away: { stats: Array<{ name: string; label: string; displayValue: string }> };
  } | null;
  matchEvents: Array<{
    id: string;
    minute: string;
    type: 'goal' | 'own_goal' | 'penalty_goal' | 'yellow_card' | 'red_card' | 'yellow_red_card' | 'substitution' | 'var' | 'other';
    side: 'home' | 'away';
    playerName?: string;
    playerId?: string;
    playerOut?: string;
    playerOutId?: string;
    assistName?: string;
    homeScore?: number;
    awayScore?: number;
  }>;
}

function mapSSPosition(pos?: string): string | undefined {
  if (!pos) return undefined;
  const p = pos.toUpperCase();
  if (p === 'G') return 'GK';
  if (p === 'D') return 'DF';
  if (p === 'M') return 'MF';
  if (p === 'F') return 'FW';
  return pos;
}

function posRank(pos?: string): number {
  if (!pos) return 9;
  const p = (pos || '').toUpperCase();
  if (p === 'G' || p === 'GK') return 0;
  if (p === 'D' || p === 'DF') return 1;
  if (p === 'M' || p === 'MF') return 2;
  if (p === 'F' || p === 'FW') return 3;
  return 5;
}

function mapSSIncidentType(incident: SSIncident): SSEventDetails['matchEvents'][number]['type'] {
  const it = (incident.incidentType || '').toLowerCase();
  const ic = (incident.incidentClass || '').toLowerCase();
  if (it === 'goal') {
    if (ic === 'own-goal' || ic === 'owngoal' || ic.includes('own')) return 'own_goal';
    if (ic === 'penalty' || ic === 'from_penalty' || ic.includes('penalty')) return 'penalty_goal';
    return 'goal';
  }
  if (it === 'card') {
    if (ic === 'red' || ic === 'direct_red') return 'red_card';
    if (ic === 'yellow_red' || ic === 'second_yellow') return 'yellow_red_card';
    return 'yellow_card';
  }
  if (it === 'substitution') return 'substitution';
  if (it === 'var_decision' || it === 'var') return 'var';
  return 'other';
}

/**
 * Fetch full event details (lineups, statistics, incidents) for a SofaScore event.
 * Cached for 90 seconds. Works from VPS; returns empty result on Replit (403).
 */
export async function fetchSofaScoreEventDetails(ssEventId: number): Promise<SSEventDetails> {
  const empty: SSEventDetails = { lineups: null, teamStats: null, matchEvents: [] };
  if (process.env.DISABLE_SOFASCORE === 'true') return empty;

  const cached = detailCache.get(ssEventId);
  if (cached && cached.expires > Date.now()) return cached.data;

  const [lineupsRaw, statsRaw, incidentsRaw] = await Promise.allSettled([
    ssGet<SSLineupsResponse>(`${SS_BASE}/event/${ssEventId}/lineups`, 7000),
    ssGet<SSStatisticsResponse>(`${SS_BASE}/event/${ssEventId}/statistics`, 7000),
    ssGet<SSIncidentsResponse>(`${SS_BASE}/event/${ssEventId}/incidents`, 7000),
  ]);

  // ── Lineups ────────────────────────────────────────────────────────────────
  let lineups: SSEventDetails['lineups'] = null;
  const lineupsData = lineupsRaw.status === 'fulfilled' ? lineupsRaw.value : null;
  if (lineupsData) {
    const mapSide = (side: SSLineupsResponse['home']) => {
      if (!side?.players?.length) return null;
      const all = side.players.map((p, idx) => ({
        id:       String(p.player.id),
        name:     p.player.shortName || p.player.name,
        fullName: p.player.name,
        position: mapSSPosition(p.position || p.player.position),
        jersey:   p.jerseyNumber || undefined,
        starter:  !p.substitute,
        captain:  p.captain,
        headshot: `https://api.sofascore.com/api/v1/player/${p.player.id}/image`,
        _idx:     idx,
      }));

      const startingRaw = all.filter(p => p.starter);
      startingRaw.sort((a, b) => {
        const ra = posRank(a.position);
        const rb = posRank(b.position);
        if (ra !== rb) return ra - rb;
        return a._idx - b._idx;
      });

      const starting = startingRaw.map(({ _idx, ...rest }) => ({ ...rest, starter: true as const }));
      const bench = all
        .filter(p => !p.starter)
        .map(({ _idx, ...rest }) => ({ ...rest, starter: false as const }));

      return { formation: side.formation, starting, bench };
    };

    const home = mapSide(lineupsData.home);
    const away = mapSide(lineupsData.away);
    if (home || away) {
      lineups = { confirmed: lineupsData.confirmed ?? false, home, away };
    }
  }

  // ── Statistics ─────────────────────────────────────────────────────────────
  let teamStats: SSEventDetails['teamStats'] = null;
  const statsData = statsRaw.status === 'fulfilled' ? statsRaw.value : null;
  if (statsData?.statistics?.length) {
    // Prefer the 'ALL' period; fall back to first period
    const period = statsData.statistics.find(p => p.period === 'ALL') ?? statsData.statistics[0];
    const homeStats: SSEventDetails['teamStats']['home']['stats'] = [];
    const awayStats: SSEventDetails['teamStats']['away']['stats'] = [];

    for (const group of (period?.groups || [])) {
      for (const item of (group.statisticsItems || [])) {
        const hVal = item.home !== undefined ? String(item.home) : '';
        const aVal = item.away !== undefined ? String(item.away) : '';
        if (hVal || aVal) {
          homeStats.push({ name: item.name, label: item.name, displayValue: hVal });
          awayStats.push({ name: item.name, label: item.name, displayValue: aVal });
        }
      }
    }

    if (homeStats.length > 0) {
      teamStats = {
        home: { stats: homeStats },
        away: { stats: awayStats },
      };
    }
  }

  // ── Incidents (goals, cards, subs) ─────────────────────────────────────────
  const matchEvents: SSEventDetails['matchEvents'] = [];
  const incData = incidentsRaw.status === 'fulfilled' ? incidentsRaw.value : null;
  if (incData?.incidents?.length) {
    for (let i = 0; i < incData.incidents.length; i++) {
      const inc = incData.incidents[i];
      const type = mapSSIncidentType(inc);
      if (type === 'other' || type === 'var') continue; // skip non-betting events
      if (inc.rescinded) continue;

      const addedStr = inc.addedTime ? `+${inc.addedTime}` : '';
      const minStr   = `${inc.time}${addedStr}'`;
      const side     = inc.isHome ? 'home' : 'away';

      if (type === 'substitution') {
        matchEvents.push({
          id:         `ss-inc-${ssEventId}-${i}`,
          minute:     minStr,
          type:       'substitution',
          side,
          playerName: inc.playerIn?.shortName || inc.playerIn?.name,
          playerId:   inc.playerIn ? String(inc.playerIn.id) : undefined,
          playerOut:  inc.playerOut?.shortName || inc.playerOut?.name,
          playerOutId: inc.playerOut ? String(inc.playerOut.id) : undefined,
          homeScore:  inc.homeScore,
          awayScore:  inc.awayScore,
        });
      } else {
        matchEvents.push({
          id:          `ss-inc-${ssEventId}-${i}`,
          minute:      minStr,
          type,
          side,
          playerName:  inc.player?.shortName || inc.player?.name,
          playerId:    inc.player ? String(inc.player.id) : undefined,
          assistName:  inc.assist1?.shortName || inc.assist1?.name,
          homeScore:   inc.homeScore,
          awayScore:   inc.awayScore,
        });
      }
    }
  }

  const result: SSEventDetails = { lineups, teamStats, matchEvents };
  detailCache.set(ssEventId, { data: result, expires: Date.now() + DETAIL_CACHE_MS });
  return result;
}

/**
 * Given a match's home/away team names, kickoff timestamp (ms), and sport slug,
 * look up the SofaScore numeric event ID by scanning the day's cached schedule.
 * Used to cross-reference ESPN matches with SofaScore for details enrichment.
 * Returns null if no match found or SofaScore is unavailable.
 */
export async function findSofaScoreEventId(
  homeTeam: string,
  awayTeam: string,
  kickoffMs: number,
  sportSlug = 'football',
): Promise<number | null> {
  if (process.env.DISABLE_SOFASCORE === 'true') return null;

  const ckKey = `xref_${sportSlug}_${homeTeam}_${awayTeam}_${Math.floor(kickoffMs / 3_600_000)}`;
  const hit   = crossRefCache.get(ckKey);
  if (hit && hit.expires > Date.now()) return hit.id;

  // Find the sport config
  const sport = SS_ALL_SPORTS.find(s => s.slug === sportSlug || s.sportKey === sportSlug)
    ?? SS_ALL_SPORTS[0];

  // Fetch the correct day
  const kickoffDate = new Date(kickoffMs);
  const ds = `${kickoffDate.getUTCFullYear()}-${String(kickoffDate.getUTCMonth() + 1).padStart(2, '0')}-${String(kickoffDate.getUTCDate()).padStart(2, '0')}`;
  const matches = await fetchDayForSport(ds, sport);

  const norm  = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hNorm = norm(homeTeam);
  const aNorm = norm(awayTeam);

  // Also check day before/after to handle timezone edge cases
  const nearbyDays: string[] = [];
  const d1 = new Date(kickoffMs - 86_400_000);
  const d2 = new Date(kickoffMs + 86_400_000);
  nearbyDays.push(`${d1.getUTCFullYear()}-${String(d1.getUTCMonth() + 1).padStart(2, '0')}-${String(d1.getUTCDate()).padStart(2, '0')}`);
  nearbyDays.push(`${d2.getUTCFullYear()}-${String(d2.getUTCMonth() + 1).padStart(2, '0')}-${String(d2.getUTCDate()).padStart(2, '0')}`);
  const extraDayMatches = (await Promise.allSettled(nearbyDays.map(d => fetchDayForSport(d, sport))))
    .flatMap(r => r.status === 'fulfilled' ? r.value : []);

  const allCandidates = [...matches, ...extraDayMatches];

  const found = allCandidates.find(m => {
    const mh = norm(m.homeTeam.name);
    const ma = norm(m.awayTeam.name);
    // Exact match first
    if (mh === hNorm && ma === aNorm) return true;
    // Partial match (one contains the other)
    return (
      (mh.includes(hNorm) || hNorm.includes(mh)) &&
      (ma.includes(aNorm) || aNorm.includes(ma))
    );
  });

  const id = found ? parseInt(found.id.replace('ss_', ''), 10) : null;
  crossRefCache.set(ckKey, { id, expires: Date.now() + CACHE_MS });
  return Number.isFinite(id) ? id : null;
}

/**
 * Fetch today's + yesterday's scheduled events for ALL sports, bypassing the
 * day cache so we always get current status and final scores.
 *
 * Called from the live-scores cron every 2 minutes so that finished matches
 * (e.g. France 3-0 Iraq) get their real scores patched into the main cache —
 * the live endpoint stops returning a match the moment it finishes, so the
 * only way to pick up final scores is to re-fetch the day schedule.
 */
export async function fetchSofaScoreTodaySchedule(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_SOFASCORE === 'true') return [];
  if (ssIsBlocked()) return [];

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  const now       = new Date();
  const todayStr   = fmt(now);
  const yestStr    = fmt(new Date(now.getTime() - 86_400_000));

  // Invalidate the cached day data for today and yesterday so the next
  // fetchDayForSport() call hits the API and returns current scores.
  for (const sport of SS_ALL_SPORTS) {
    cache.delete(`ss-${sport.slug}-${todayStr}`);
    cache.delete(`ss-${sport.slug}-${yestStr}`);
  }

  // Re-fetch today + yesterday for all sports (concurrency 4 to be polite)
  const tasks: Array<() => Promise<UnifiedMatch[]>> = [];
  for (const sport of SS_ALL_SPORTS) {
    tasks.push(() => fetchDayForSport(todayStr, sport));
    tasks.push(() => fetchDayForSport(yestStr,  sport));
  }

  const { default: pLimit } = await import('p-limit').catch(() => ({ default: null }));
  const limit = pLimit ? pLimit(4) : null;
  const settled = await Promise.allSettled(
    limit ? tasks.map(t => limit(t)) : tasks.map(t => t()),
  );

  const out: UnifiedMatch[] = [];
  for (const r of settled) if (r.status === 'fulfilled') out.push(...r.value);

  const finished = out.filter(m => m.status === 'finished').length;
  const live     = out.filter(m => m.status === 'live' || m.status === 'halftime').length;
  if (out.length > 0) {
    console.log(`[SofaScore] Today schedule refresh: ${out.length} events (${live} live, ${finished} finished)`);
  }
  return out;
}

/** Return the SofaScore CDN logo URL for a team ID (from ss_team_XXXX id format). */
export function getSofaScoreTeamLogo(ssTeamId: string | number): string {
  const numId = typeof ssTeamId === 'string' ? ssTeamId.replace('ss_team_', '') : ssTeamId;
  return `https://api.sofascore.com/api/v1/team/${numId}/image`;
}

/** Return the SofaScore CDN player photo URL for a player ID. */
export function getSofaScorePlayerPhoto(ssPlayerId: string | number): string {
  return `https://api.sofascore.com/api/v1/player/${ssPlayerId}/image`;
}
