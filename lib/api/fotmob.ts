// ============================================
// FotMob — public JSON endpoints (no key required)
// Covers: deep football coverage worldwide — uses /api/matches?date=YYYYMMDD
// to pull every match scheduled for a given day.
// We use this as the broadest depth source: leagues ESPN/football-data don't
// cover (e.g. lower divisions, women's, smaller national leagues) all show up.
// ============================================

import type { UnifiedMatch } from './unified-sports-api';

const FM_BASE = 'https://www.fotmob.com/api';
// Browser-like User-Agent — FotMob's edge sometimes 403s default Node UA.
const UA = 'Mozilla/5.0 (compatible; BetcheraBot/1.0; +https://betcheza.co.ke)';

interface FMTeam {
  id?: number;
  name: string;
  shortName?: string;
  logo?: string;
  score?: number | null;
}

interface FMMatch {
  id?: number;
  pageUrl?: string;
  status?: { utcTime?: string; started?: boolean; finished?: boolean; cancelled?: boolean; ongoing?: boolean; liveTime?: { short?: string; long?: string } };
  home?: FMTeam;
  away?: FMTeam;
  time?: string;
  timeTS?: number;
}

interface FMLeagueGroup {
  primaryId?: number;
  ccode?: string;
  internalRank?: number;
  name?: string;
  matches?: FMMatch[];
}

interface FMMatchesResponse {
  leagues?: FMLeagueGroup[];
}

const cache = new Map<string, { data: UnifiedMatch[]; expires: number }>();
const CACHE_MS = 10 * 60 * 1000;

// Map common ISO country codes → display names. FotMob already returns ccode
// for most, so this is just a polish layer.
const COUNTRY_NAMES: Record<string, string> = {
  ENG: 'England', ESP: 'Spain', ITA: 'Italy', GER: 'Germany', FRA: 'France',
  POR: 'Portugal', NED: 'Netherlands', BEL: 'Belgium', SCO: 'Scotland',
  TUR: 'Turkey', GRE: 'Greece', RUS: 'Russia', UKR: 'Ukraine', POL: 'Poland',
  CRO: 'Croatia', SRB: 'Serbia', AUT: 'Austria', SUI: 'Switzerland',
  USA: 'United States', MEX: 'Mexico', BRA: 'Brazil', ARG: 'Argentina',
  COL: 'Colombia', CHI: 'Chile', URU: 'Uruguay', ECU: 'Ecuador', PAR: 'Paraguay',
  JPN: 'Japan', KOR: 'South Korea', CHN: 'China', AUS: 'Australia',
  KEN: 'Kenya', TAN: 'Tanzania', UGA: 'Uganda', RSA: 'South Africa',
  EGY: 'Egypt', MAR: 'Morocco', NGA: 'Nigeria', GHA: 'Ghana', SEN: 'Senegal',
  INT: 'International',
};

function mapMatchStatus(m: FMMatch): UnifiedMatch['status'] {
  const s = m.status;
  if (!s) return 'scheduled';
  if (s.cancelled) return 'cancelled';
  if (s.finished) return 'finished';
  const live = s.liveTime?.short || s.liveTime?.long || '';
  if (/^HT$/i.test(live)) return 'halftime';
  if (s.ongoing || s.started) return 'live';
  return 'scheduled';
}

function parseMinute(m: FMMatch): number | undefined {
  const txt = m.status?.liveTime?.short || m.status?.liveTime?.long || '';
  const mm = txt.match(/(\d+)/);
  return mm ? parseInt(mm[1], 10) : undefined;
}

function parseKickoff(m: FMMatch): Date {
  if (m.status?.utcTime) {
    const d = new Date(m.status.utcTime);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (m.timeTS) {
    const d = new Date(m.timeTS);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function mapEvent(m: FMMatch, league: FMLeagueGroup): UnifiedMatch | null {
  if (!m.home?.name || !m.away?.name) return null;
  const status = mapMatchStatus(m);
  const ccode = (league.ccode || 'INT').toUpperCase();
  const country = COUNTRY_NAMES[ccode] || league.ccode || 'International';
  // Internal league id range: 8000-8999 for FotMob.
  const leagueIdInternal = league.primaryId ? 8000 + (league.primaryId % 1000) : 8999;
  const leagueName = league.name || 'Unknown League';
  return {
    id: `fm_${m.id ?? `${m.home.name}-${m.away.name}-${parseKickoff(m).getTime()}`}`,
    externalId: m.id ? String(m.id) : undefined,
    source: 'sportsdata-io',
    sportId: 1,
    sportKey: 'soccer',
    leagueId: leagueIdInternal,
    leagueKey: `fm_${league.primaryId ?? 'misc'}`,
    homeTeam: {
      id: m.home.id ? `fm_team_${m.home.id}` : `fm_team_${m.home.name}`,
      name: m.home.name,
      shortName: m.home.shortName || m.home.name,
      logo: m.home.logo || undefined,
    },
    awayTeam: {
      id: m.away.id ? `fm_team_${m.away.id}` : `fm_team_${m.away.name}`,
      name: m.away.name,
      shortName: m.away.shortName || m.away.name,
      logo: m.away.logo || undefined,
    },
    kickoffTime: parseKickoff(m),
    status,
    homeScore: typeof m.home.score === 'number' ? m.home.score : null,
    awayScore: typeof m.away.score === 'number' ? m.away.score : null,
    minute: parseMinute(m),
    league: {
      id: leagueIdInternal,
      name: leagueName,
      slug: leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      country,
      countryCode: ccode.length === 2 ? ccode : ccode.slice(0, 2),
      tier: league.internalRank && league.internalRank <= 5 ? 1 : 3,
    },
    sport: { id: 1, name: 'Football', slug: 'soccer', icon: '⚽' },
    tipsCount: 0,
  };
}

async function fetchDay(dateStr: string): Promise<UnifiedMatch[]> {
  const ck = `fm-${dateStr}`;
  const cached = cache.get(ck);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = `${FM_BASE}/matches?date=${dateStr}`;
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      next: { revalidate: 600 },
    });
    if (!r.ok) {
      cache.set(ck, { data: [], expires: Date.now() + CACHE_MS });
      return [];
    }
    const data = (await r.json()) as FMMatchesResponse;
    const out: UnifiedMatch[] = [];
    for (const lg of data.leagues || []) {
      // Cap matches per league so a 500-game day doesn't blow up the page.
      // Raised from 80 → 250 so deeper leagues (CONMEBOL qualifiers, women's
      // friendlies, regional cups) all surface on the public matches page.
      const matches = lg.matches || [];
      for (let i = 0; i < Math.min(matches.length, 250); i++) {
        const u = mapEvent(matches[i], lg);
        if (u) out.push(u);
      }
    }
    cache.set(ck, { data: out, expires: Date.now() + CACHE_MS });
    return out;
  } catch {
    cache.set(ck, { data: [], expires: Date.now() + CACHE_MS });
    return [];
  }
}

/**
 * Fetch matches from FotMob for today + the next 2 days. Returns an empty
 * array on any failure so the caller can compose with .catch().
 */
export async function fetchFotMobMatches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_FOTMOB === 'true') return [];
  const days: string[] = [];
  const now = new Date();
  // Cover yesterday → +9 days so we always have today regardless of the
  // user's timezone offset, plus the next ~9 days of upcoming fixtures.
  for (let i = -1; i < 10; i++) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() + i);
    days.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
  }
  const results = await Promise.allSettled(days.map(fetchDay));
  const out: UnifiedMatch[] = [];
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);
  return out;
}
