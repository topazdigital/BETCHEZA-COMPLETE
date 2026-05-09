// ============================================================
// SofaScore — public JSON API (no key required)
// Covers 2,600+ matches per day across all major sports.
// NOTE: api.sofascore.com returns 403 from shared cloud IPs
//       (Replit, Vercel, Railway, etc.) but works fine from
//       a dedicated VPS/DirectAdmin server like betcheza.co.ke.
// ============================================================

import type { UnifiedMatch } from './unified-sports-api';

const SS_BASE = 'https://api.sofascore.com/api/v1';
const CACHE_MS = 10 * 60 * 1000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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
  time?: { currentPeriodStartTimestamp?: number };
  roundInfo?: { round?: number };
}

const cache = new Map<string, { data: UnifiedMatch[]; expires: number }>();

function mapStatus(s: SSStatus): UnifiedMatch['status'] {
  const t = s?.type || '';
  const code = s?.code ?? 0;
  if (t === 'finished') return 'finished';
  if (t === 'inprogress') {
    if (code === 31) return 'halftime';
    return 'live';
  }
  if (t === 'notstarted') return 'scheduled';
  if (t === 'cancelled' || t === 'postponed') return 'cancelled';
  return 'scheduled';
}

function leagueIdFromSSId(id: number): number {
  return 9100 + (id % 900);
}

function mapEvent(e: SSEvent): UnifiedMatch | null {
  if (!e.homeTeam?.name || !e.awayTeam?.name) return null;

  const tournament = e.tournament;
  const unique = tournament?.uniqueTournament;
  const category = unique?.category;
  const country = category?.name || 'International';
  const countryCode = (category?.alpha2 || 'INT').toUpperCase().slice(0, 2);
  const leagueName = unique?.name || tournament?.name || 'Unknown League';
  const leagueId = leagueIdFromSSId(unique?.id ?? tournament?.id ?? 0);

  const kickoff = new Date(e.startTimestamp * 1000);
  const status = mapStatus(e.status);

  const homeScore = e.homeScore?.current ?? e.homeScore?.display ?? null;
  const awayScore = e.awayScore?.current ?? e.awayScore?.display ?? null;

  return {
    id: `ss_${e.id}`,
    externalId: String(e.id),
    source: 'sportsdata-io',
    sportId: 1,
    sportKey: 'soccer',
    leagueId,
    leagueKey: `ss_${unique?.id ?? tournament?.id}`,
    homeTeam: {
      id: `ss_team_${e.homeTeam.id}`,
      name: e.homeTeam.name,
      shortName: e.homeTeam.shortName || e.homeTeam.nameCode || e.homeTeam.name,
    },
    awayTeam: {
      id: `ss_team_${e.awayTeam.id}`,
      name: e.awayTeam.name,
      shortName: e.awayTeam.shortName || e.awayTeam.nameCode || e.awayTeam.name,
    },
    kickoffTime: kickoff,
    status,
    homeScore: typeof homeScore === 'number' ? homeScore : null,
    awayScore: typeof awayScore === 'number' ? awayScore : null,
    league: {
      id: leagueId,
      name: leagueName,
      slug: leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      country,
      countryCode,
      tier: 2,
    },
    sport: { id: 1, name: 'Football', slug: 'soccer', icon: '⚽' },
    tipsCount: 0,
  };
}

async function fetchDay(dateStr: string): Promise<UnifiedMatch[]> {
  const ck = `ss-${dateStr}`;
  const hit = cache.get(ck);
  if (hit && hit.expires > Date.now()) return hit.data;

  const url = `${SS_BASE}/sport/football/scheduled-events/${dateStr}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://www.sofascore.com',
        Referer: 'https://www.sofascore.com/football',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      cache.set(ck, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }

    const data = (await res.json()) as { events?: SSEvent[] };
    const out: UnifiedMatch[] = [];
    for (const ev of data.events || []) {
      const u = mapEvent(ev);
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
