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

export const TSDB_LEAGUES: TSDBLeagueConfig[] = [
  // ─── East / Southern African football ───
  { tsdbId: '4504', leagueId: 5001, leagueName: 'Kenyan Premier League', sportId: 1, sportType: 'soccer', country: 'Kenya', countryCode: 'KE', tier: 2 },
  { tsdbId: '4621', leagueId: 5002, leagueName: 'Tanzanian Premier League', sportId: 1, sportType: 'soccer', country: 'Tanzania', countryCode: 'TZ', tier: 3 },
  { tsdbId: '4422', leagueId: 5003, leagueName: 'Ugandan Premier League', sportId: 1, sportType: 'soccer', country: 'Uganda', countryCode: 'UG', tier: 3 },
  { tsdbId: '4623', leagueId: 5004, leagueName: 'Rwandan Premier League', sportId: 1, sportType: 'soccer', country: 'Rwanda', countryCode: 'RW', tier: 3 },
  { tsdbId: '4486', leagueId: 5020, leagueName: 'South African Premier Division', sportId: 1, sportType: 'soccer', country: 'South Africa', countryCode: 'ZA', tier: 2 },
  { tsdbId: '4488', leagueId: 5021, leagueName: 'Egyptian Premier League', sportId: 1, sportType: 'soccer', country: 'Egypt', countryCode: 'EG', tier: 2 },
  { tsdbId: '4567', leagueId: 5022, leagueName: 'Moroccan Botola Pro', sportId: 1, sportType: 'soccer', country: 'Morocco', countryCode: 'MA', tier: 2 },
  { tsdbId: '4583', leagueId: 5023, leagueName: 'Algerian Ligue 1', sportId: 1, sportType: 'soccer', country: 'Algeria', countryCode: 'DZ', tier: 3 },
  { tsdbId: '4489', leagueId: 5024, leagueName: 'Tunisian Ligue 1', sportId: 1, sportType: 'soccer', country: 'Tunisia', countryCode: 'TN', tier: 3 },
  { tsdbId: '4585', leagueId: 5025, leagueName: 'Nigerian Professional League', sportId: 1, sportType: 'soccer', country: 'Nigeria', countryCode: 'NG', tier: 2 },
  { tsdbId: '4587', leagueId: 5026, leagueName: 'Ghanaian Premier League', sportId: 1, sportType: 'soccer', country: 'Ghana', countryCode: 'GH', tier: 3 },
  // ─── European small / under-covered ───
  { tsdbId: '4423', leagueId: 5005, leagueName: 'Cypriot First Division', sportId: 1, sportType: 'soccer', country: 'Cyprus', countryCode: 'CY', tier: 3 },
  { tsdbId: '4521', leagueId: 5006, leagueName: 'Maltese Premier League', sportId: 1, sportType: 'soccer', country: 'Malta', countryCode: 'MT', tier: 4 },
  { tsdbId: '4549', leagueId: 5007, leagueName: 'Albanian Superliga', sportId: 1, sportType: 'soccer', country: 'Albania', countryCode: 'AL', tier: 3 },
  { tsdbId: '4485', leagueId: 5008, leagueName: 'Latvian Virsliga', sportId: 1, sportType: 'soccer', country: 'Latvia', countryCode: 'LV', tier: 3 },
  { tsdbId: '4424', leagueId: 5009, leagueName: 'Estonian Meistriliiga', sportId: 1, sportType: 'soccer', country: 'Estonia', countryCode: 'EE', tier: 3 },
  { tsdbId: '4524', leagueId: 5010, leagueName: 'Lithuanian A Lyga', sportId: 1, sportType: 'soccer', country: 'Lithuania', countryCode: 'LT', tier: 4 },
  { tsdbId: '4486', leagueId: 5011, leagueName: 'Romanian Liga I', sportId: 1, sportType: 'soccer', country: 'Romania', countryCode: 'RO', tier: 3 },
  { tsdbId: '4509', leagueId: 5012, leagueName: 'Bulgarian First League', sportId: 1, sportType: 'soccer', country: 'Bulgaria', countryCode: 'BG', tier: 3 },
  { tsdbId: '4419', leagueId: 5013, leagueName: 'Czech First League', sportId: 1, sportType: 'soccer', country: 'Czechia', countryCode: 'CZ', tier: 3 },
  { tsdbId: '4525', leagueId: 5014, leagueName: 'Slovak Super Liga', sportId: 1, sportType: 'soccer', country: 'Slovakia', countryCode: 'SK', tier: 4 },
  { tsdbId: '4490', leagueId: 5015, leagueName: 'Croatian HNL', sportId: 1, sportType: 'soccer', country: 'Croatia', countryCode: 'HR', tier: 3 },
  { tsdbId: '4496', leagueId: 5016, leagueName: 'Serbian SuperLiga', sportId: 1, sportType: 'soccer', country: 'Serbia', countryCode: 'RS', tier: 3 },
  { tsdbId: '4669', leagueId: 5017, leagueName: 'Hungarian NB I', sportId: 1, sportType: 'soccer', country: 'Hungary', countryCode: 'HU', tier: 3 },
  { tsdbId: '4498', leagueId: 5018, leagueName: 'Polish Ekstraklasa', sportId: 1, sportType: 'soccer', country: 'Poland', countryCode: 'PL', tier: 3 },
  // ─── Americas (extra coverage) ───
  { tsdbId: '4346', leagueId: 5030, leagueName: 'Chilean Primera División', sportId: 1, sportType: 'soccer', country: 'Chile', countryCode: 'CL', tier: 3 },
  { tsdbId: '4347', leagueId: 5031, leagueName: 'Colombian Categoría Primera A', sportId: 1, sportType: 'soccer', country: 'Colombia', countryCode: 'CO', tier: 3 },
  { tsdbId: '4348', leagueId: 5032, leagueName: 'Peruvian Liga 1', sportId: 1, sportType: 'soccer', country: 'Peru', countryCode: 'PE', tier: 4 },
  { tsdbId: '4349', leagueId: 5033, leagueName: 'Uruguayan Primera División', sportId: 1, sportType: 'soccer', country: 'Uruguay', countryCode: 'UY', tier: 3 },
  { tsdbId: '4350', leagueId: 5034, leagueName: 'Ecuadorian Serie A', sportId: 1, sportType: 'soccer', country: 'Ecuador', countryCode: 'EC', tier: 4 },
  { tsdbId: '4351', leagueId: 5035, leagueName: 'Paraguayan Primera División', sportId: 1, sportType: 'soccer', country: 'Paraguay', countryCode: 'PY', tier: 4 },
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
