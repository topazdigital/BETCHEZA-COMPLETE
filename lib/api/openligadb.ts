// ============================================
// OpenLigaDB — free, no key required
// Covers: German football (Bundesliga, 2.Bundesliga, 3.Liga, DFB-Pokal),
//         plus a handful of European national-team competitions.
// API docs: https://www.openligadb.de/
// We use it as a depth source on top of ESPN — German lower divisions
// (3.Liga, Regional Cups) aren't well covered by ESPN.
// ============================================

import type { UnifiedMatch } from './unified-sports-api';

const OLDB_BASE = 'https://api.openligadb.de';

interface OLDBTeam {
  teamId: number;
  teamName: string;
  shortName?: string;
  teamIconUrl?: string;
}

interface OLDBMatchResult {
  resultName?: string;
  pointsTeam1?: number;
  pointsTeam2?: number;
  resultOrderID?: number;
  resultTypeID?: number;
}

interface OLDBMatch {
  matchID: number;
  matchDateTime: string;
  matchDateTimeUTC?: string;
  timeZoneID?: string;
  leagueId: number;
  leagueName: string;
  leagueSeason: number;
  leagueShortcut?: string;
  matchIsFinished: boolean;
  team1: OLDBTeam;
  team2: OLDBTeam;
  matchResults?: OLDBMatchResult[];
  location?: { locationCity?: string; locationStadium?: string } | null;
  group?: { groupName?: string };
}

interface OLDBLeague {
  shortcut: string;
  /** internal numeric id used to dedupe & route */
  leagueId: number;
  leagueName: string;
  season: number;
  /** which Bundesliga/3.Liga season tier */
  tier: number;
}

const OLDB_LEAGUES: OLDBLeague[] = [
  { shortcut: 'bl1', leagueId: 6001, leagueName: 'Bundesliga', season: new Date().getFullYear(), tier: 1 },
  { shortcut: 'bl2', leagueId: 6002, leagueName: '2. Bundesliga', season: new Date().getFullYear(), tier: 2 },
  { shortcut: 'bl3', leagueId: 6003, leagueName: '3. Liga', season: new Date().getFullYear(), tier: 3 },
  { shortcut: 'dfb', leagueId: 6004, leagueName: 'DFB-Pokal', season: new Date().getFullYear(), tier: 1 },
];

const cache = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const CACHE_MS = 15 * 60 * 1000;

function pickFinalScore(results: OLDBMatchResult[] | undefined): { home: number | null; away: number | null } {
  if (!results || results.length === 0) return { home: null, away: null };
  // resultTypeID === 2 is the final result; fall back to highest resultOrderID.
  const final = results.find((r) => r.resultTypeID === 2)
    ?? [...results].sort((a, b) => (b.resultOrderID ?? 0) - (a.resultOrderID ?? 0))[0];
  return {
    home: typeof final?.pointsTeam1 === 'number' ? final.pointsTeam1 : null,
    away: typeof final?.pointsTeam2 === 'number' ? final.pointsTeam2 : null,
  };
}

function mapMatch(ev: OLDBMatch, league: OLDBLeague): UnifiedMatch | null {
  if (!ev.team1?.teamName || !ev.team2?.teamName) return null;
  const ko = new Date(ev.matchDateTimeUTC || ev.matchDateTime);
  const score = pickFinalScore(ev.matchResults);
  const status: UnifiedMatch['status'] = ev.matchIsFinished
    ? 'finished'
    : ko.getTime() <= Date.now() && ko.getTime() >= Date.now() - 2 * 60 * 60 * 1000
      ? 'live'
      : 'scheduled';

  return {
    id: `oldb_${ev.matchID}`,
    externalId: String(ev.matchID),
    source: 'sportsdata-io',
    sportId: 1,
    sportKey: 'soccer',
    leagueId: league.leagueId,
    leagueKey: `oldb_${league.shortcut}`,
    homeTeam: {
      id: `oldb_team_${ev.team1.teamId}`,
      name: ev.team1.teamName,
      shortName: ev.team1.shortName || ev.team1.teamName,
      logo: ev.team1.teamIconUrl || undefined,
    },
    awayTeam: {
      id: `oldb_team_${ev.team2.teamId}`,
      name: ev.team2.teamName,
      shortName: ev.team2.shortName || ev.team2.teamName,
      logo: ev.team2.teamIconUrl || undefined,
    },
    kickoffTime: ko,
    status,
    homeScore: score.home,
    awayScore: score.away,
    league: {
      id: league.leagueId,
      name: league.leagueName,
      slug: league.leagueName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, ''),
      country: 'Germany',
      countryCode: 'DE',
      tier: league.tier,
    },
    sport: { id: 1, name: 'Football', slug: 'soccer', icon: '⚽' },
    tipsCount: 0,
    venue: ev.location?.locationStadium || undefined,
  };
}

async function fetchLeague(league: OLDBLeague): Promise<UnifiedMatch[]> {
  const ck = `oldb-${league.shortcut}-${league.season}`;
  const cached = cache.get(ck);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = `${OLDB_BASE}/getmatchdata/${league.shortcut}/${league.season}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 900 } });
    if (!r.ok) {
      cache.set(ck, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }
    const events = (await r.json()) as OLDBMatch[];
    const matches: UnifiedMatch[] = [];
    for (const ev of events) {
      const m = mapMatch(ev, league);
      if (m) matches.push(m);
    }
    cache.set(ck, { data: matches, expires: Date.now() + CACHE_MS });
    return matches;
  } catch {
    cache.set(ck, { data: [], expires: Date.now() + CACHE_MS });
    return [];
  }
}

/**
 * Fetch matches from all configured OpenLigaDB leagues. Empty array on
 * any failure so the caller can chain .catch() trivially.
 */
export async function fetchOpenLigaDBMatches(): Promise<UnifiedMatch[]> {
  const results = await Promise.allSettled(OLDB_LEAGUES.map(fetchLeague));
  const out: UnifiedMatch[] = [];
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);
  return out;
}
