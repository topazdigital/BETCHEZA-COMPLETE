// ============================================
// TheSportsDB integration — free, no key required for public endpoints (key "3")
// Used to pull matches from leagues that ESPN does NOT cover (Kenya, Tanzania,
// Uganda, Cyprus, Iceland reserves, NWSL, Liga MX 2, etc.)
// API docs: https://www.thesportsdb.com/free_sports_api
// ============================================

import type { UnifiedMatch } from './unified-sports-api';

const TSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

interface TSDBEvent {
  idEvent: string;
  idLeague: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strEvent?: string;
  strLeague?: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  strStatus?: string;
  strProgress?: string;
  strVenue?: string;
  strSport?: string;
  strSeason?: string;
  intRound?: string;
}

interface TSDBEventsResponse {
  events?: TSDBEvent[] | null;
}

// Map of TheSportsDB league id → our internal league/sport metadata.
// Kept SMALL on purpose: we only pull what ESPN doesn't cover, so we don't
// flood the page with duplicates. Each league represents real fixtures the
// users requested.
export interface TSDBLeagueConfig {
  tsdbId: string;
  leagueId: number;        // our internal league id (use a > 5000 range to avoid clashes)
  leagueName: string;
  sportId: number;
  sportType: 'soccer' | 'basketball';
  country: string;
  countryCode: string;
  tier: number;
}

// ALL TheSportsDB free-tier (key "3") league IDs have been disabled.
// Testing on 2026-05-25 confirmed every single ID returns incorrect fixtures —
// e.g. tsdbId '4621' (Tanzania) returned Austrian Bundesliga matches,
//      tsdbId '4346' (Chile) returned MLS matches,
//      tsdbId '4424' (Estonia) returned MLB games.
// The free API appears to serve random/mismatched data for all league IDs.
// Re-enable entries here only after verifying each ID returns the correct league.
export const TSDB_LEAGUES: TSDBLeagueConfig[] = [
  // (empty — all entries disabled until TSDB free API returns correct fixtures)
];

// Simple in-memory cache (15 min)
const cache = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const CACHE_MS = 15 * 60 * 1000;

function parseStatus(raw?: string, progress?: string): UnifiedMatch['status'] {
  const s = (raw || '').toUpperCase();
  if (s === 'MATCH FINISHED' || s === 'FT' || s === 'FINISHED' || s === 'AFTER OT' || s === 'AET' || s === 'AFTER PEN') return 'finished';
  if (s === 'POSTPONED' || s === 'POSTP.') return 'postponed';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'cancelled';
  if (s === 'HT' || s === 'HALFTIME' || s === 'HALF TIME') return 'halftime';
  if (s === 'NS' || s === 'NOT STARTED' || s === '') return 'scheduled';
  if (progress && progress.match(/\d+'?/)) return 'live';
  if (s === '1H' || s === '2H' || s === 'LIVE' || s === 'IN PROGRESS') return 'live';
  return 'scheduled';
}

function parseMinute(raw?: string, progress?: string): number | undefined {
  const src = (progress || raw || '').toString();
  const m = src.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}

function buildKickoff(ev: TSDBEvent): Date {
  if (ev.strTimestamp) {
    const d = new Date(ev.strTimestamp);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (ev.dateEvent) {
    const t = ev.strTime || '00:00:00';
    const d = new Date(`${ev.dateEvent}T${t}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function mapEvent(ev: TSDBEvent, league: TSDBLeagueConfig): UnifiedMatch | null {
  if (!ev.strHomeTeam || !ev.strAwayTeam) return null;

  // Sanity-check: if TSDB returns a strLeague that clearly belongs to a
  // different competition (e.g. returning "Austrian Bundesliga" for a Tanzania
  // league ID), drop the fixture rather than showing it with the wrong flag.
  // We do a very loose check — just verify the API-returned league name shares
  // at least one significant keyword with our configured league name.
  if (ev.strLeague) {
    const returned = ev.strLeague.toLowerCase();
    const expected = league.leagueName.toLowerCase();
    // Build a set of keywords from the expected name (ignore short words)
    const keywords = expected.split(/\s+/).filter(w => w.length >= 4);
    const anyMatch = keywords.some(kw => returned.includes(kw));
    if (!anyMatch && keywords.length > 0) {
      return null; // TSDB returned a completely different league — skip
    }
  }

  const status = parseStatus(ev.strStatus, ev.strProgress);
  const homeScore = ev.intHomeScore !== null && ev.intHomeScore !== undefined && ev.intHomeScore !== ''
    ? parseInt(ev.intHomeScore, 10)
    : null;
  const awayScore = ev.intAwayScore !== null && ev.intAwayScore !== undefined && ev.intAwayScore !== ''
    ? parseInt(ev.intAwayScore, 10)
    : null;

  return {
    id: `tsdb_${ev.idEvent}`,
    externalId: ev.idEvent,
    source: 'sportsdata-io', // reuse existing union member; treated as third-party
    sportId: league.sportId,
    sportKey: league.sportType,
    leagueId: league.leagueId,
    leagueKey: `tsdb_${league.tsdbId}`,
    homeTeam: {
      id: ev.idHomeTeam || `tsdb_${ev.strHomeTeam}`,
      name: ev.strHomeTeam,
      shortName: ev.strHomeTeam,
      logo: ev.strHomeTeamBadge || undefined,
    },
    awayTeam: {
      id: ev.idAwayTeam || `tsdb_${ev.strAwayTeam}`,
      name: ev.strAwayTeam,
      shortName: ev.strAwayTeam,
      logo: ev.strAwayTeamBadge || undefined,
    },
    kickoffTime: buildKickoff(ev),
    status,
    homeScore: Number.isFinite(homeScore as number) ? (homeScore as number) : null,
    awayScore: Number.isFinite(awayScore as number) ? (awayScore as number) : null,
    minute: parseMinute(ev.strStatus, ev.strProgress),
    league: {
      id: league.leagueId,
      name: league.leagueName,
      slug: league.leagueName.toLowerCase().replace(/\s+/g, '-'),
      country: league.country,
      countryCode: league.countryCode,
      tier: league.tier,
    },
    sport: {
      id: league.sportId,
      name: league.sportType === 'soccer' ? 'Football' : 'Basketball',
      slug: league.sportType === 'soccer' ? 'soccer' : 'basketball',
      icon: league.sportType === 'soccer' ? '⚽' : '🏀',
    },
    tipsCount: 0,
    venue: ev.strVenue || undefined,
  };
}

async function fetchLeagueRoundOrSeason(league: TSDBLeagueConfig): Promise<UnifiedMatch[]> {
  const ck = `tsdb-${league.tsdbId}`;
  const cached = cache.get(ck);
  if (cached && cached.expires > Date.now()) return cached.data;

  // Strategy: pull next 15 fixtures (free endpoint) + last 15 fixtures so we
  // also catch in-progress / just-finished games for "today".
  const urls = [
    `${TSDB_BASE}/eventsnextleague.php?id=${league.tsdbId}`,
    `${TSDB_BASE}/eventspastleague.php?id=${league.tsdbId}`,
  ];

  const results = await Promise.allSettled(
    urls.map(async u => {
      try {
        const r = await fetch(u, {
          headers: { Accept: 'application/json' },
          next: { revalidate: 900 },
        });
        if (!r.ok) return null;
        return (await r.json()) as TSDBEventsResponse;
      } catch {
        return null;
      }
    }),
  );

  const matches: UnifiedMatch[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value?.events) continue;
    for (const ev of r.value.events) {
      const m = mapEvent(ev, league);
      if (!m) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      matches.push(m);
    }
  }

  cache.set(ck, { data: matches, expires: Date.now() + CACHE_MS });
  return matches;
}

/**
 * Fetch matches from all configured TheSportsDB leagues. Returns an empty
 * array on failure (network / rate limit) so it can degrade gracefully.
 */
export async function fetchTSDBMatches(): Promise<UnifiedMatch[]> {
  const all = await Promise.allSettled(TSDB_LEAGUES.map(fetchLeagueRoundOrSeason));
  const out: UnifiedMatch[] = [];
  for (const r of all) {
    if (r.status === 'fulfilled') out.push(...r.value);
  }
  return out;
}
