// ============================================
// football-data.org — free tier, ~10 req/min
// Covers: top European leagues (PL, La Liga, Serie A, Bundesliga, Ligue 1,
// Eredivisie, Primeira Liga), Champions League, Europa League, World Cup,
// Euro, Copa America, plus FA Cup / Copa Libertadores.
// API docs: https://www.football-data.org/documentation/api
// Requires FOOTBALL_DATA_API_KEY.
// ============================================

import type { UnifiedMatch } from './unified-sports-api';

const FD_BASE = 'https://api.football-data.org/v4';

interface FDTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

interface FDScoreSide {
  home: number | null;
  away: number | null;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED' | 'AWARDED';
  matchday?: number;
  competition: { id: number; name: string; code?: string; type?: string; emblem?: string };
  area?: { name?: string; code?: string };
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score?: { fullTime?: FDScoreSide; halfTime?: FDScoreSide; winner?: string | null };
  minute?: number | null;
  injuryTime?: number | null;
}

interface FDMatchesResponse {
  matches?: FDMatch[];
}

interface FDLeague {
  /** football-data.org competition code, e.g. "PL", "PD", "BL1" */
  code: string;
  /** internal numeric id used to dedupe & route */
  leagueId: number;
  leagueName: string;
  country: string;
  countryCode: string;
  tier: number;
}

const FD_LEAGUES: FDLeague[] = [
  { code: 'PL', leagueId: 7001, leagueName: 'Premier League', country: 'England', countryCode: 'GB', tier: 1 },
  { code: 'PD', leagueId: 7002, leagueName: 'La Liga', country: 'Spain', countryCode: 'ES', tier: 1 },
  { code: 'SA', leagueId: 7003, leagueName: 'Serie A', country: 'Italy', countryCode: 'IT', tier: 1 },
  { code: 'BL1', leagueId: 7004, leagueName: 'Bundesliga', country: 'Germany', countryCode: 'DE', tier: 1 },
  { code: 'FL1', leagueId: 7005, leagueName: 'Ligue 1', country: 'France', countryCode: 'FR', tier: 1 },
  { code: 'DED', leagueId: 7006, leagueName: 'Eredivisie', country: 'Netherlands', countryCode: 'NL', tier: 1 },
  { code: 'PPL', leagueId: 7007, leagueName: 'Primeira Liga', country: 'Portugal', countryCode: 'PT', tier: 1 },
  { code: 'CL', leagueId: 7008, leagueName: 'UEFA Champions League', country: 'Europe', countryCode: 'EU', tier: 1 },
  { code: 'ELC', leagueId: 7009, leagueName: 'Championship', country: 'England', countryCode: 'GB', tier: 2 },
  { code: 'BSA', leagueId: 7010, leagueName: 'Brasileirão', country: 'Brazil', countryCode: 'BR', tier: 1 },
];

const cache = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const CACHE_MS = 15 * 60 * 1000;

function mapStatus(s: FDMatch['status']): UnifiedMatch['status'] {
  switch (s) {
    case 'IN_PLAY': return 'live';
    case 'PAUSED': return 'halftime';
    case 'FINISHED': return 'finished';
    case 'POSTPONED':
    case 'SUSPENDED': return 'postponed';
    case 'CANCELLED': return 'cancelled';
    default: return 'scheduled';
  }
}

function mapMatch(m: FDMatch, league: FDLeague): UnifiedMatch | null {
  if (!m.homeTeam?.name || !m.awayTeam?.name) return null;
  const status = mapStatus(m.status);
  return {
    id: `fd_${m.id}`,
    externalId: String(m.id),
    source: 'sportsdata-io',
    sportId: 1,
    sportKey: 'soccer',
    leagueId: league.leagueId,
    leagueKey: `fd_${league.code}`,
    homeTeam: {
      id: `fd_team_${m.homeTeam.id}`,
      name: m.homeTeam.name,
      shortName: m.homeTeam.shortName || m.homeTeam.tla || m.homeTeam.name,
      logo: m.homeTeam.crest || undefined,
    },
    awayTeam: {
      id: `fd_team_${m.awayTeam.id}`,
      name: m.awayTeam.name,
      shortName: m.awayTeam.shortName || m.awayTeam.tla || m.awayTeam.name,
      logo: m.awayTeam.crest || undefined,
    },
    kickoffTime: new Date(m.utcDate),
    status,
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    minute: m.minute ?? undefined,
    league: {
      id: league.leagueId,
      name: league.leagueName,
      slug: league.leagueName.toLowerCase().replace(/\s+/g, '-'),
      country: league.country,
      countryCode: league.countryCode,
      tier: league.tier,
    },
    sport: { id: 1, name: 'Football', slug: 'soccer', icon: '⚽' },
    tipsCount: 0,
  };
}

async function fetchLeagueMatches(league: FDLeague, apiKey: string): Promise<UnifiedMatch[]> {
  const ck = `fd-${league.code}`;
  const cached = cache.get(ck);
  if (cached && cached.expires > Date.now()) return cached.data;

  // Pull a 14-day window centred on today — enough to cover live, today's
  // and the next gameweek without burning through the rate limit.
  const dateFrom = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `${FD_BASE}/competitions/${league.code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  try {
    const r = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey, Accept: 'application/json' },
      next: { revalidate: 900 },
    });
    if (!r.ok) {
      cache.set(ck, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }
    const data = (await r.json()) as FDMatchesResponse;
    const out: UnifiedMatch[] = [];
    for (const m of data.matches || []) {
      const u = mapMatch(m, league);
      if (u) out.push(u);
    }
    cache.set(ck, { data: out, expires: Date.now() + CACHE_MS });
    return out;
  } catch {
    cache.set(ck, { data: [], expires: Date.now() + CACHE_MS });
    return [];
  }
}

/**
 * Fetch matches from football-data.org. Returns an empty array if the API
 * key is missing OR every league fails (free tier rate-limit kicks in fast).
 */
export async function fetchFootballDataOrgMatches(): Promise<UnifiedMatch[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return [];
  // Stagger requests slightly to stay under the 10/min free-tier limit.
  const out: UnifiedMatch[] = [];
  for (let i = 0; i < FD_LEAGUES.length; i++) {
    const league = FD_LEAGUES[i];
    const matches = await fetchLeagueMatches(league, apiKey);
    out.push(...matches);
    if (i < FD_LEAGUES.length - 1) await new Promise((r) => setTimeout(r, 80));
  }
  return out;
}
