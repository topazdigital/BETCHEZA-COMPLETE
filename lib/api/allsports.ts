/**
 * AllSports API — free tier: 200 req/day
 * Covers: football (incl. live scores), basketball, tennis, cricket,
 *         baseball, hockey, rugby, volleyball, handball, American football
 * API key: ALLSPORTS_API_KEY in Replit Secrets
 * Docs: https://allsportsapi.com/
 *
 * Strategy:
 *  - Fetch fixtures for today ±2 days per sport (one req each)
 *  - Fetch football livescore separately (1 req, refresh on live-scores cron)
 *  - 30-min file cache per endpoint to stay well within 200 req/day
 *  - All requests direct (no CF Worker needed — allsportsapi.com is not blocked)
 */

import fs from 'fs';
import path from 'path';
import type { UnifiedMatch, Market } from './unified-sports-api';

const BASE = 'https://apiv2.allsportsapi.com';
const CACHE_DIR = path.join(process.cwd(), '.local', 'data', 'allsports-cache');
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const LIVE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min for live scores

// ── in-memory cache ──────────────────────────────────────────────────────
const memCache = new Map<string, { data: unknown; ts: number }>();

function getKey(): string {
  return process.env.ALLSPORTS_API_KEY ?? '';
}

function memGet<T>(key: string, ttl = CACHE_TTL_MS): T | null {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > ttl) { memCache.delete(key); return null; }
  return e.data as T;
}
function memSet(key: string, data: unknown): void {
  memCache.set(key, { data, ts: Date.now() });
}

// ── file cache ───────────────────────────────────────────────────────────
function fileGet<T>(cacheKey: string, ttl = CACHE_TTL_MS): T | null {
  try {
    const fp = path.join(CACHE_DIR, cacheKey.replace(/[^a-z0-9_-]/gi, '_') + '.json');
    if (!fs.existsSync(fp)) return null;
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8')) as { data: T; ts: number };
    if (Date.now() - raw.ts > ttl) { fs.unlinkSync(fp); return null; }
    return raw.data;
  } catch { return null; }
}
function fileSet(cacheKey: string, data: unknown): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const fp = path.join(CACHE_DIR, cacheKey.replace(/[^a-z0-9_-]/gi, '_') + '.json');
    fs.writeFileSync(fp, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

// ── per-sport in-flight mutex ────────────────────────────────────────────
const inFlight = new Map<string, Promise<unknown>>();

async function cachedFetch<T>(url: string, cacheKey: string, ttl = CACHE_TTL_MS): Promise<T | null> {
  const mem = memGet<T>(cacheKey, ttl);
  if (mem) return mem;
  const file = fileGet<T>(cacheKey, ttl);
  if (file) { memSet(cacheKey, file); return file; }

  // Deduplicate concurrent requests
  if (inFlight.has(cacheKey)) return (await inFlight.get(cacheKey)) as T | null;

  const p = (async () => {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) { console.warn(`[AllSports] HTTP ${res.status} for ${cacheKey}`); return null; }
      const json = await res.json() as { success: number; result?: T };
      if (!json.success || !json.result) return null;
      memSet(cacheKey, json.result);
      fileSet(cacheKey, json.result);
      return json.result as T;
    } catch (e) {
      console.warn(`[AllSports] fetch error for ${cacheKey}:`, (e as Error).message);
      return null;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, p);
  return (await p) as T | null;
}

// ── date helpers ─────────────────────────────────────────────────────────
function yyyymmdd(d: Date): string {
  return d.toISOString().split('T')[0];
}
function today(): string { return yyyymmdd(new Date()); }
function daysFromNow(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n); return yyyymmdd(d);
}

// ── status mapping ───────────────────────────────────────────────────────
function mapFootballStatus(status: string, live: string): UnifiedMatch['status'] {
  if (live === '1') {
    const min = parseInt(status, 10);
    if (!isNaN(min)) return 'live';
    if (status === 'Half Time') return 'halftime';
    if (status === 'Extra Time') return 'live';
    if (status === 'Penalty In Progress') return 'live';
    return 'live';
  }
  if (status === 'Finished' || status === 'After Extra Time' || status === 'After Penalties') return 'finished';
  if (status === 'Postponed') return 'postponed';
  if (status === 'Cancelled') return 'cancelled';
  if (status === 'Suspended') return 'postponed';
  return 'scheduled';
}

function mapGenericStatus(status: string, live: string): UnifiedMatch['status'] {
  if (live === '1') return 'live';
  if (status === 'Finished' || status === 'FT') return 'finished';
  if (status === 'Postponed' || status === 'Cancelled') return 'postponed';
  return 'scheduled';
}

// ── score parser ─────────────────────────────────────────────────────────
function parseScore(score: string): { home: number; away: number } | null {
  if (!score || score === '-' || score === ' - ') return null;
  const m = score.match(/^(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return { home: parseInt(m[1]), away: parseInt(m[2]) };
}

// ─────────────────────────────────────────────────────────────────────────
// Football
// ─────────────────────────────────────────────────────────────────────────
interface ASFootballEvent {
  event_key: number;
  event_date: string;
  event_time: string;
  event_home_team: string;
  home_team_key: number;
  event_away_team: string;
  away_team_key: number;
  event_halftime_result: string;
  event_final_result: string;
  event_ft_result: string;
  event_status: string;
  event_live: string;
  country_name: string;
  league_name: string;
  league_key: number;
  league_round?: string;
  league_season: string;
  event_stadium?: string;
  home_team_logo?: string;
  away_team_logo?: string;
  league_logo?: string;
  country_logo?: string;
  goalscorers?: Array<{ time: string; home_scorer?: string; away_scorer?: string; score: string; info?: string }>;
}

function footballEventToMatch(e: ASFootballEvent): UnifiedMatch {
  const kickoff = new Date(`${e.event_date}T${e.event_time || '00:00'}:00`);
  const status = mapFootballStatus(e.event_status, e.event_live);
  const scoreStr = e.event_final_result || e.event_ft_result;
  const score = parseScore(scoreStr);
  const htScore = parseScore(e.event_halftime_result);
  const minute = (e.event_live === '1' && /^\d+$/.test(e.event_status))
    ? parseInt(e.event_status, 10) : undefined;

  const goals = (e.goalscorers || []).map(g => ({
    minute: parseInt(g.time) || 0,
    team: g.home_scorer ? 'home' as const : 'away' as const,
    playerName: g.home_scorer || g.away_scorer || '',
    isOwnGoal: g.info === 'own goal',
    isPenalty: g.info === 'penalty',
  }));

  return {
    id: `as_fb_${e.event_key}`,
    externalId: String(e.event_key),
    homeTeam: { id: String(e.home_team_key), name: e.event_home_team, logo: e.home_team_logo },
    awayTeam: { id: String(e.away_team_key), name: e.event_away_team, logo: e.away_team_logo },
    kickoffTime: kickoff.toISOString(),
    status,
    score: score ? { home: score.home, away: score.away } : undefined,
    halfTimeScore: htScore ? { home: htScore.home, away: htScore.away } : undefined,
    minute,
    league: {
      id: `as_fb_league_${e.league_key}`,
      name: e.league_name,
      country: e.country_name,
      countryCode: '',
      logo: e.league_logo,
      slug: `as-fb-${e.league_key}`,
    },
    venue: e.event_stadium ? { name: e.event_stadium } : undefined,
    sport: { id: 'football', name: 'Football', slug: 'football' },
    source: 'fallback' as const,
    goals: goals.length ? goals : undefined,
    odds: undefined,
    markets: [],
  };
}

export async function fetchAllSportsFootball(): Promise<UnifiedMatch[]> {
  const key = getKey();
  if (!key) return [];
  const from = daysFromNow(-1);
  const to = daysFromNow(3);
  const url = `${BASE}/football/?met=Fixtures&APIkey=${key}&from=${from}&to=${to}`;
  const data = await cachedFetch<ASFootballEvent[]>(url, `fb_fixtures_${from}_${to}`);
  if (!data) return [];
  return data.map(footballEventToMatch);
}

export async function fetchAllSportsLiveFootball(): Promise<UnifiedMatch[]> {
  const key = getKey();
  if (!key) return [];
  const url = `${BASE}/football/?met=Livescore&APIkey=${key}`;
  const data = await cachedFetch<ASFootballEvent[]>(url, 'fb_live', LIVE_CACHE_TTL_MS);
  if (!data) return [];
  return data.map(footballEventToMatch);
}

// ─────────────────────────────────────────────────────────────────────────
// Basketball
// ─────────────────────────────────────────────────────────────────────────
interface ASBasketballEvent {
  event_key: number;
  event_date: string;
  event_time: string;
  event_home_team: string;
  home_team_key: number;
  event_away_team: string;
  away_team_key: number;
  event_final_result: string;
  event_status: string;
  event_live: string;
  country_name: string;
  league_name: string;
  league_key: number;
  league_season: string;
  home_team_logo?: string;
  away_team_logo?: string;
  league_logo?: string;
}

function basketballEventToMatch(e: ASBasketballEvent): UnifiedMatch {
  const kickoff = new Date(`${e.event_date}T${e.event_time || '00:00'}:00`);
  const status = mapGenericStatus(e.event_status, e.event_live);
  const score = parseScore(e.event_final_result);
  return {
    id: `as_bb_${e.event_key}`,
    externalId: String(e.event_key),
    homeTeam: { id: String(e.home_team_key), name: e.event_home_team, logo: e.home_team_logo },
    awayTeam: { id: String(e.away_team_key), name: e.event_away_team, logo: e.away_team_logo },
    kickoffTime: kickoff.toISOString(),
    status,
    score: score ? { home: score.home, away: score.away } : undefined,
    league: {
      id: `as_bb_league_${e.league_key}`,
      name: e.league_name,
      country: e.country_name,
      countryCode: '',
      logo: e.league_logo,
      slug: `as-bb-${e.league_key}`,
    },
    sport: { id: 'basketball', name: 'Basketball', slug: 'basketball' },
    source: 'fallback' as const,
    odds: undefined,
    markets: [],
  };
}

export async function fetchAllSportsBasketball(): Promise<UnifiedMatch[]> {
  const key = getKey();
  if (!key) return [];
  const from = daysFromNow(-1);
  const to = daysFromNow(3);
  const url = `${BASE}/basketball/?met=Fixtures&APIkey=${key}&from=${from}&to=${to}`;
  const data = await cachedFetch<ASBasketballEvent[]>(url, `bb_fixtures_${from}_${to}`);
  if (!data) return [];
  return data.map(basketballEventToMatch);
}

// ─────────────────────────────────────────────────────────────────────────
// Tennis
// ─────────────────────────────────────────────────────────────────────────
interface ASTennisEvent {
  event_key: number;
  event_date: string;
  event_time: string;
  event_first_player: string;
  first_player_key: number;
  event_second_player: string;
  second_player_key: number;
  event_final_result: string;
  event_game_result: string;
  event_status: string;
  event_live: string;
  event_winner?: string;
  country_name: string;
  league_name: string;
  league_key: number;
  league_round?: string;
  league_season: string;
  event_first_player_logo?: string;
  event_second_player_logo?: string;
}

function tennisEventToMatch(e: ASTennisEvent): UnifiedMatch {
  const kickoff = new Date(`${e.event_date}T${e.event_time || '00:00'}:00`);
  const status = mapGenericStatus(e.event_status, e.event_live);
  // Tennis score = sets won e.g. "2 - 1"
  const score = parseScore(e.event_final_result);
  return {
    id: `as_tn_${e.event_key}`,
    externalId: String(e.event_key),
    homeTeam: { id: String(e.first_player_key), name: e.event_first_player, logo: e.event_first_player_logo },
    awayTeam: { id: String(e.second_player_key), name: e.event_second_player, logo: e.event_second_player_logo },
    kickoffTime: kickoff.toISOString(),
    status,
    score: score ? { home: score.home, away: score.away } : undefined,
    league: {
      id: `as_tn_league_${e.league_key}`,
      name: `${e.country_name} - ${e.league_name}`,
      country: e.country_name,
      countryCode: '',
      slug: `as-tn-${e.league_key}`,
    },
    sport: { id: 'tennis', name: 'Tennis', slug: 'tennis' },
    source: 'fallback' as const,
    odds: undefined,
    markets: [],
  };
}

export async function fetchAllSportsTennis(): Promise<UnifiedMatch[]> {
  const key = getKey();
  if (!key) return [];
  const from = daysFromNow(-1);
  const to = daysFromNow(3);
  const url = `${BASE}/tennis/?met=Fixtures&APIkey=${key}&from=${from}&to=${to}`;
  const data = await cachedFetch<ASTennisEvent[]>(url, `tn_fixtures_${from}_${to}`);
  if (!data) return [];
  return data.map(tennisEventToMatch);
}

// ─────────────────────────────────────────────────────────────────────────
// Cricket
// ─────────────────────────────────────────────────────────────────────────
interface ASCricketEvent {
  event_key: number;
  event_date_start: string;
  event_date_stop: string;
  event_time: string;
  event_home_team: string;
  home_team_key: number;
  event_away_team: string;
  away_team_key: number;
  event_home_final_result: string;
  event_away_final_result: string;
  event_status: string;
  event_live: string;
  country_name: string;
  league_name: string;
  league_key: number;
  league_season: string;
  home_team_logo?: string;
  away_team_logo?: string;
}

function cricketEventToMatch(e: ASCricketEvent): UnifiedMatch {
  const kickoff = new Date(`${e.event_date_start}T${e.event_time || '00:00'}:00`);
  const status = mapGenericStatus(e.event_status, e.event_live);
  const homeScore = e.event_home_final_result ? parseInt(e.event_home_final_result) : undefined;
  const awayScore = e.event_away_final_result ? parseInt(e.event_away_final_result) : undefined;
  return {
    id: `as_cr_${e.event_key}`,
    externalId: String(e.event_key),
    homeTeam: { id: String(e.home_team_key), name: e.event_home_team, logo: e.home_team_logo },
    awayTeam: { id: String(e.away_team_key), name: e.event_away_team, logo: e.away_team_logo },
    kickoffTime: kickoff.toISOString(),
    status,
    score: (homeScore !== undefined && awayScore !== undefined) ? { home: homeScore, away: awayScore } : undefined,
    league: {
      id: `as_cr_league_${e.league_key}`,
      name: e.league_name,
      country: e.country_name,
      countryCode: '',
      slug: `as-cr-${e.league_key}`,
    },
    sport: { id: 'cricket', name: 'Cricket', slug: 'cricket' },
    source: 'fallback' as const,
    odds: undefined,
    markets: [],
  };
}

export async function fetchAllSportsCricket(): Promise<UnifiedMatch[]> {
  const key = getKey();
  if (!key) return [];
  const from = daysFromNow(-1);
  const to = daysFromNow(3);
  const url = `${BASE}/cricket/?met=Fixtures&APIkey=${key}&from=${from}&to=${to}`;
  const data = await cachedFetch<ASCricketEvent[]>(url, `cr_fixtures_${from}_${to}`);
  if (!data) return [];
  return data.map(cricketEventToMatch);
}

// ─────────────────────────────────────────────────────────────────────────
// Rugby
// ─────────────────────────────────────────────────────────────────────────
interface ASRugbyEvent {
  event_key: number;
  event_date: string;
  event_time: string;
  event_home_team: string;
  home_team_key: number;
  event_away_team: string;
  away_team_key: number;
  event_final_result: string;
  event_status: string;
  event_live: string;
  country_name: string;
  league_name: string;
  league_key: number;
  league_season: string;
  home_team_logo?: string;
  away_team_logo?: string;
}

function rugbyEventToMatch(e: ASRugbyEvent): UnifiedMatch {
  const kickoff = new Date(`${e.event_date}T${e.event_time || '00:00'}:00`);
  const status = mapGenericStatus(e.event_status, e.event_live);
  const score = parseScore(e.event_final_result);
  return {
    id: `as_rg_${e.event_key}`,
    externalId: String(e.event_key),
    homeTeam: { id: String(e.home_team_key), name: e.event_home_team, logo: e.home_team_logo },
    awayTeam: { id: String(e.away_team_key), name: e.event_away_team, logo: e.away_team_logo },
    kickoffTime: kickoff.toISOString(),
    status,
    score: score ? { home: score.home, away: score.away } : undefined,
    league: {
      id: `as_rg_league_${e.league_key}`,
      name: e.league_name,
      country: e.country_name,
      countryCode: '',
      slug: `as-rg-${e.league_key}`,
    },
    sport: { id: 'rugby', name: 'Rugby', slug: 'rugby' },
    source: 'fallback' as const,
    odds: undefined,
    markets: [],
  };
}

// Rugby endpoint not available on allsportsapi.com free tier
export async function fetchAllSportsRugby(): Promise<UnifiedMatch[]> {
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// American Football
// ─────────────────────────────────────────────────────────────────────────
interface ASAmFootEvent {
  event_key: number;
  event_date: string;
  event_time: string;
  event_home_team: string;
  home_team_key: number;
  event_away_team: string;
  away_team_key: number;
  event_final_result: string;
  event_status: string;
  event_live: string;
  country_name: string;
  league_name: string;
  league_key: number;
  league_season: string;
  home_team_logo?: string;
  away_team_logo?: string;
}

function amFootEventToMatch(e: ASAmFootEvent): UnifiedMatch {
  const kickoff = new Date(`${e.event_date}T${e.event_time || '00:00'}:00`);
  const status = mapGenericStatus(e.event_status, e.event_live);
  const score = parseScore(e.event_final_result);
  return {
    id: `as_af_${e.event_key}`,
    externalId: String(e.event_key),
    homeTeam: { id: String(e.home_team_key), name: e.event_home_team, logo: e.home_team_logo },
    awayTeam: { id: String(e.away_team_key), name: e.event_away_team, logo: e.away_team_logo },
    kickoffTime: kickoff.toISOString(),
    status,
    score: score ? { home: score.home, away: score.away } : undefined,
    league: {
      id: `as_af_league_${e.league_key}`,
      name: e.league_name,
      country: e.country_name,
      countryCode: '',
      slug: `as-af-${e.league_key}`,
    },
    sport: { id: 'american-football', name: 'American Football', slug: 'american-football' },
    source: 'fallback' as const,
    odds: undefined,
    markets: [],
  };
}

// American Football endpoint not available on allsportsapi.com free tier
export async function fetchAllSportsAmericanFootball(): Promise<UnifiedMatch[]> {
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Main export — fetch all sports in parallel
// ─────────────────────────────────────────────────────────────────────────
export async function fetchAllSportsMatches(): Promise<UnifiedMatch[]> {
  const key = getKey();
  if (!key) {
    console.warn('[AllSports] No ALLSPORTS_API_KEY set — skipping');
    return [];
  }

  const [football, basketball, tennis, cricket, rugby, amfoot] = await Promise.all([
    fetchAllSportsFootball().catch(() => [] as UnifiedMatch[]),
    fetchAllSportsBasketball().catch(() => [] as UnifiedMatch[]),
    fetchAllSportsTennis().catch(() => [] as UnifiedMatch[]),
    fetchAllSportsCricket().catch(() => [] as UnifiedMatch[]),
    fetchAllSportsRugby().catch(() => [] as UnifiedMatch[]),
    fetchAllSportsAmericanFootball().catch(() => [] as UnifiedMatch[]),
  ]);

  const total = football.length + basketball.length + tennis.length + cricket.length + rugby.length + amfoot.length;
  console.log(`[AllSports] fetched: football=${football.length} basketball=${basketball.length} tennis=${tennis.length} cricket=${cricket.length} rugby=${rugby.length} amfoot=${amfoot.length} total=${total}`);

  return [...football, ...basketball, ...tennis, ...cricket, ...rugby, ...amfoot];
}
