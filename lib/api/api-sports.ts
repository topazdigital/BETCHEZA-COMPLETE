// ============================================
// api-sports.io — free tier: 100 req/day
// Covers: football, basketball, tennis, baseball, hockey, rugby, volleyball, handball, cricket
// All routed through the CF Worker (bypass IP blocks).
// API key: set API_SPORTS_KEY in Replit Secrets / .env.local
// Docs: https://www.api-sports.io/documentation/football/v3
// ============================================

import type { UnifiedMatch } from './unified-sports-api';
import { proxyFetch } from './proxy-fetch';

const AS_KEY_HEADER = 'x-apisports-key';

// Cache per endpoint (1-hour TTL to stay within 100 req/day free limit)
const cache = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const CACHE_MS = 60 * 60 * 1000; // 1 hour

// Mutex — only one fetch per sport at a time
const inFlight = new Map<string, Promise<UnifiedMatch[]>>();

interface ASFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue?: { name?: string };
  };
  league: { id: number; name: string; country: string; logo?: string; season: number; round?: string };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
  score?: { halftime?: { home: number | null; away: number | null } };
}

interface ASGame {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  timezone: string;
  status: { short: string; timer?: { mm: string } | null };
  league: { id: number; name: string; country: { name: string; code?: string }; logo?: string };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  scores?: {
    home?: { total: number | null };
    away?: { total: number | null };
  };
  points?: { home: number | null; away: number | null };
}

interface ASResponse<T> {
  response: T[];
  errors?: Record<string, string>;
  results?: number;
}

function mapFixtureStatus(short: string): UnifiedMatch['status'] {
  switch (short) {
    case '1H': case '2H': case 'ET': case 'BT': case 'P': return 'live';
    case 'HT': return 'halftime';
    case 'FT': case 'AET': case 'PEN': return 'finished';
    case 'PST': case 'SUSP': return 'postponed';
    case 'CANC': case 'ABD': case 'WO': return 'cancelled';
    default: return 'scheduled';
  }
}

function mapGameStatus(short: string): UnifiedMatch['status'] {
  switch (short) {
    case 'LIVE': case 'Q1': case 'Q2': case 'Q3': case 'Q4': case 'OT': case 'BT':
    case '1H': case '2H': case 'ET': case 'P': case 'IN_PLAY': return 'live';
    case 'HT': case 'HALF': return 'halftime';
    case 'FT': case 'AOT': case 'AET': case 'PEN': case 'POST': return 'finished';
    case 'CANC': case 'ABD': case 'WO': return 'cancelled';
    case 'SUSP': case 'PST': return 'postponed';
    default: return 'scheduled';
  }
}

// ── Football ──────────────────────────────────────────────────────────────────
async function fetchFootball(apiKey: string, date: string): Promise<UnifiedMatch[]> {
  const cacheKey = `as-football-${date}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=UTC`;
  try {
    const r = await proxyFetch(url, {
      headers: { [AS_KEY_HEADER]: apiKey, Accept: 'application/json' },
      timeoutMs: 12_000,
    });
    if (!r.ok) {
      console.warn(`[api-sports/football] HTTP ${r.status} for ${date}`);
      cache.set(cacheKey, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }
    const json = (await r.json()) as ASResponse<ASFixture>;
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.warn(`[api-sports/football] API error:`, JSON.stringify(json.errors));
      cache.set(cacheKey, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }
    const out: UnifiedMatch[] = [];
    for (const item of json.response || []) {
      const { fixture, league, teams, goals } = item;
      const status = mapFixtureStatus(fixture.status.short);
      const match: UnifiedMatch = {
        id: `as_fb_${fixture.id}`,
        externalId: String(fixture.id),
        source: 'api-sports',
        sportId: 1,
        sportKey: 'soccer',
        leagueId: 8000 + (league.id % 10000),
        leagueKey: `as_fb_${league.id}`,
        homeTeam: {
          id: `as_fb_team_${teams.home.id}`,
          name: teams.home.name,
          shortName: teams.home.name,
          logo: teams.home.logo || undefined,
        },
        awayTeam: {
          id: `as_fb_team_${teams.away.id}`,
          name: teams.away.name,
          shortName: teams.away.name,
          logo: teams.away.logo || undefined,
        },
        kickoffTime: new Date(fixture.date),
        status,
        homeScore: goals.home,
        awayScore: goals.away,
        minute: fixture.status.elapsed || undefined,
        league: {
          id: 8000 + (league.id % 10000),
          name: league.name,
          slug: league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          country: league.country,
          countryCode: league.country.slice(0, 2).toUpperCase(),
          tier: 1,
        },
        sport: { id: 1, name: 'Football', slug: 'soccer', icon: '⚽' },
        tipsCount: 0,
      };
      out.push(match);
    }
    console.log(`[api-sports/football] ${out.length} matches for ${date}`);
    cache.set(cacheKey, { data: out, expires: Date.now() + CACHE_MS });
    return out;
  } catch (err) {
    console.warn(`[api-sports/football] fetch error: ${err instanceof Error ? err.message : err}`);
    cache.set(cacheKey, { data: [], expires: Date.now() + CACHE_MS });
    return [];
  }
}

// ── Generic game-based sport (basketball, baseball, hockey, etc.) ─────────────
interface SportConfig {
  apiSubdomain: string;
  sportId: number;
  sportKey: string;
  sportName: string;
  icon: string;
  leagueIdBase: number;
  prefix: string;
}

const GAME_SPORTS: SportConfig[] = [
  { apiSubdomain: 'basketball', sportId: 2,  sportKey: 'basketball',  sportName: 'Basketball',      icon: '🏀', leagueIdBase: 9000,  prefix: 'as_bb' },
  { apiSubdomain: 'baseball',   sportId: 6,  sportKey: 'baseball',    sportName: 'Baseball',         icon: '⚾', leagueIdBase: 10000, prefix: 'as_bas' },
  { apiSubdomain: 'hockey',     sportId: 7,  sportKey: 'hockey',      sportName: 'Ice Hockey',       icon: '🏒', leagueIdBase: 11000, prefix: 'as_hk' },
  { apiSubdomain: 'volleyball', sportId: 14, sportKey: 'volleyball',  sportName: 'Volleyball',       icon: '🏐', leagueIdBase: 12000, prefix: 'as_vb' },
  { apiSubdomain: 'handball',   sportId: 24, sportKey: 'handball',    sportName: 'Handball',         icon: '🤾', leagueIdBase: 13000, prefix: 'as_hb' },
];

async function fetchGameSport(apiKey: string, cfg: SportConfig, date: string): Promise<UnifiedMatch[]> {
  const cacheKey = `as-${cfg.apiSubdomain}-${date}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = `https://v3.${cfg.apiSubdomain}.api-sports.io/games?date=${date}&timezone=UTC`;
  try {
    const r = await proxyFetch(url, {
      headers: { [AS_KEY_HEADER]: apiKey, Accept: 'application/json' },
      timeoutMs: 10_000,
    });
    if (!r.ok) {
      console.warn(`[api-sports/${cfg.apiSubdomain}] HTTP ${r.status} for ${date}`);
      cache.set(cacheKey, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }
    const json = (await r.json()) as ASResponse<ASGame>;
    if (json.errors && Object.keys(json.errors).length > 0) {
      cache.set(cacheKey, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }
    const out: UnifiedMatch[] = [];
    for (const item of json.response || []) {
      const status = mapGameStatus(item.status.short);
      const homeScore = item.scores?.home?.total ?? item.points?.home ?? null;
      const awayScore = item.scores?.away?.total ?? item.points?.away ?? null;
      const kickoffTime = item.timestamp
        ? new Date(item.timestamp * 1000)
        : new Date(`${item.date}T${item.time || '00:00'}:00Z`);
      const country = typeof item.league.country === 'string'
        ? item.league.country
        : item.league.country?.name || '';
      const countryCode = typeof item.league.country === 'string'
        ? item.league.country.slice(0, 2).toUpperCase()
        : item.league.country?.code || '';
      const match: UnifiedMatch = {
        id: `${cfg.prefix}_${item.id}`,
        externalId: String(item.id),
        source: 'api-sports',
        sportId: cfg.sportId,
        sportKey: cfg.sportKey,
        leagueId: cfg.leagueIdBase + (item.league.id % 1000),
        leagueKey: `${cfg.prefix}_${item.league.id}`,
        homeTeam: {
          id: `${cfg.prefix}_team_${item.teams.home.id}`,
          name: item.teams.home.name,
          shortName: item.teams.home.name,
          logo: item.teams.home.logo || undefined,
        },
        awayTeam: {
          id: `${cfg.prefix}_team_${item.teams.away.id}`,
          name: item.teams.away.name,
          shortName: item.teams.away.name,
          logo: item.teams.away.logo || undefined,
        },
        kickoffTime,
        status,
        homeScore,
        awayScore,
        league: {
          id: cfg.leagueIdBase + (item.league.id % 1000),
          name: item.league.name,
          slug: item.league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          country,
          countryCode,
          tier: 1,
        },
        sport: { id: cfg.sportId, name: cfg.sportName, slug: cfg.sportKey, icon: cfg.icon },
        tipsCount: 0,
      };
      out.push(match);
    }
    console.log(`[api-sports/${cfg.apiSubdomain}] ${out.length} matches for ${date}`);
    cache.set(cacheKey, { data: out, expires: Date.now() + CACHE_MS });
    return out;
  } catch (err) {
    console.warn(`[api-sports/${cfg.apiSubdomain}] fetch error: ${err instanceof Error ? err.message : err}`);
    cache.set(cacheKey, { data: [], expires: Date.now() + CACHE_MS });
    return [];
  }
}

// ── Tennis ────────────────────────────────────────────────────────────────────
interface ASTennisTournament {
  id: number; name: string; country?: { name?: string; code?: string };
  category?: { id: number; name: string };
}
interface ASTennisGame {
  id: number;
  date: string;
  time: string;
  timestamp?: number;
  status: { short: string };
  tournament: ASTennisTournament;
  players?: {
    home: { id: number; name: string; photo?: string };
    away: { id: number; name: string; photo?: string };
  };
  scores?: {
    home?: { sets?: number };
    away?: { sets?: number };
  };
}

async function fetchTennis(apiKey: string, date: string): Promise<UnifiedMatch[]> {
  const cacheKey = `as-tennis-${date}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = `https://v3.tennis.api-sports.io/games?date=${date}`;
  try {
    const r = await proxyFetch(url, {
      headers: { [AS_KEY_HEADER]: apiKey, Accept: 'application/json' },
      timeoutMs: 10_000,
    });
    if (!r.ok) {
      console.warn(`[api-sports/tennis] HTTP ${r.status} for ${date}`);
      cache.set(cacheKey, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }
    const json = (await r.json()) as ASResponse<ASTennisGame>;
    const out: UnifiedMatch[] = [];
    for (const item of json.response || []) {
      if (!item.players?.home || !item.players?.away) continue;
      const status = mapGameStatus(item.status.short);
      const kickoffTime = item.timestamp
        ? new Date(item.timestamp * 1000)
        : new Date(`${item.date}T${item.time || '00:00'}:00Z`);
      const country = item.tournament.country?.name || '';
      const match: UnifiedMatch = {
        id: `as_tn_${item.id}`,
        externalId: String(item.id),
        source: 'api-sports',
        sportId: 3,
        sportKey: 'tennis',
        leagueId: 14000 + (item.tournament.id % 1000),
        leagueKey: `as_tn_${item.tournament.id}`,
        homeTeam: {
          id: `as_tn_player_${item.players.home.id}`,
          name: item.players.home.name,
          shortName: item.players.home.name.split(' ').pop() || item.players.home.name,
          logo: item.players.home.photo || undefined,
        },
        awayTeam: {
          id: `as_tn_player_${item.players.away.id}`,
          name: item.players.away.name,
          shortName: item.players.away.name.split(' ').pop() || item.players.away.name,
          logo: item.players.away.photo || undefined,
        },
        kickoffTime,
        status,
        homeScore: item.scores?.home?.sets ?? null,
        awayScore: item.scores?.away?.sets ?? null,
        league: {
          id: 14000 + (item.tournament.id % 1000),
          name: item.tournament.name,
          slug: item.tournament.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          country,
          countryCode: item.tournament.country?.code || country.slice(0, 2).toUpperCase(),
          tier: 1,
        },
        sport: { id: 3, name: 'Tennis', slug: 'tennis', icon: '🎾' },
        tipsCount: 0,
      };
      out.push(match);
    }
    console.log(`[api-sports/tennis] ${out.length} matches for ${date}`);
    cache.set(cacheKey, { data: out, expires: Date.now() + CACHE_MS });
    return out;
  } catch (err) {
    console.warn(`[api-sports/tennis] fetch error: ${err instanceof Error ? err.message : err}`);
    cache.set(cacheKey, { data: [], expires: Date.now() + CACHE_MS });
    return [];
  }
}

/**
 * Fetch all sports from api-sports.io for today + tomorrow.
 * Uses 1-hour cache + per-sport mutex to stay within 100 req/day free limit.
 * Enable by setting API_SPORTS_KEY in env/secrets.
 */
export async function fetchApiSportsMatches(): Promise<UnifiedMatch[]> {
  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) return [];

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  const dates = [today, tomorrow];

  // Fetch football + game sports + tennis for today and tomorrow in parallel
  // but deduplicated via inFlight mutex so concurrent callers share one request
  const tasks: Promise<UnifiedMatch[]>[] = [];

  for (const date of dates) {
    // Football
    const fbKey = `football-${date}`;
    if (!inFlight.has(fbKey)) {
      const p = fetchFootball(apiKey, date).finally(() => inFlight.delete(fbKey));
      inFlight.set(fbKey, p);
    }
    tasks.push(inFlight.get(fbKey)!);

    // Tennis
    const tnKey = `tennis-${date}`;
    if (!inFlight.has(tnKey)) {
      const p = fetchTennis(apiKey, date).finally(() => inFlight.delete(tnKey));
      inFlight.set(tnKey, p);
    }
    tasks.push(inFlight.get(tnKey)!);

    // Game sports (basketball, baseball, hockey, volleyball, handball)
    for (const cfg of GAME_SPORTS) {
      const gKey = `${cfg.apiSubdomain}-${date}`;
      if (!inFlight.has(gKey)) {
        const p = fetchGameSport(apiKey, cfg, date).finally(() => inFlight.delete(gKey));
        inFlight.set(gKey, p);
      }
      tasks.push(inFlight.get(gKey)!);
    }
  }

  const results = await Promise.allSettled(tasks);
  const all: UnifiedMatch[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  return all;
}
