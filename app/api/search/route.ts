import { NextRequest, NextResponse } from 'next/server';
import { ALL_LEAGUES, ALL_SPORTS } from '@/lib/sports-data';
import { getAllMatches, type UnifiedMatch } from '@/lib/api/unified-sports-api';
import { query } from '@/lib/db';
import { teamHref } from '@/lib/utils/slug';
import { matchIdToSlug } from '@/lib/utils/match-url';
import { SENIOR_FOOTBALL_TEAMS, type CatalogTeam } from '@/lib/data/team-catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let _matchCache: { data: UnifiedMatch[]; ts: number } | null = null;
const MATCH_CACHE_TTL = 30_000;

async function getCachedMatches(): Promise<UnifiedMatch[]> {
  const now = Date.now();
  if (_matchCache && now - _matchCache.ts < MATCH_CACHE_TTL) return _matchCache.data;
  const matches = await getAllMatches();
  _matchCache = { data: matches, ts: now };
  return matches;
}

type SearchHit =
  | { type: 'league'; id: string; title: string; subtitle: string; href: string; logoUrl?: string; sportSlug?: string }
  | { type: 'team'; id: string; title: string; subtitle: string; href: string; logoUrl?: string; sportSlug?: string }
  | { type: 'match'; id: string; title: string; subtitle: string; href: string; status: string; kickoffIso?: string }
  | { type: 'tipster'; id: string; title: string; subtitle: string; href: string; avatar?: string | null; verified?: boolean };

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function normTeamName(s: string): string {
  return norm(s)
    .replace(/\b(fc|afc|cf|sc|fk|bk|ac|sk|sv|tsv|vfb|vfl|sk|us|as|cd|ud)\b/g, '')
    .replace(/\b(the|club|football|futbol|soccer)\b/g, '')
    .replace(/[^a-z0-9]+/g, '').trim();
}

const TEAM_ALIASES: Record<string, string[]> = {
  'paris saint-germain': ['psg'], 'paris saint germain': ['psg'],
  'manchester united': ['mufc', 'man u', 'man utd', 'united'],
  'manchester city': ['mcfc', 'man city', 'city'],
  'tottenham hotspur': ['spurs', 'thfc'], 'tottenham': ['spurs', 'thfc'],
  'arsenal': ['afc', 'gunners'], 'chelsea': ['cfc', 'blues'],
  'liverpool': ['lfc', 'reds'], 'newcastle united': ['nufc', 'magpies'],
  'real madrid': ['rma', 'madrid'], 'atletico madrid': ['atleti', 'atm'],
  'fc barcelona': ['barca', 'fcb'], 'barcelona': ['barca', 'fcb'],
  'bayern munich': ['bayern', 'fcb', 'bmu'], 'borussia dortmund': ['bvb', 'dortmund'],
  'juventus': ['juve'], 'internazionale': ['inter'], 'inter milan': ['inter'],
  'ac milan': ['milan'], 'olympique de marseille': ['om', 'marseille'],
  'olympique lyonnais': ['ol', 'lyon'], 'ajax amsterdam': ['ajax'],
  'leeds united': ['leeds', 'lufc'], 'aston villa': ['villa', 'avfc'],
  'west ham united': ['west ham', 'whufc'], 'wolverhampton wanderers': ['wolves', 'wwfc'],
  'nottingham forest': ['forest', 'nffc'], 'leicester city': ['leicester', 'lcfc'],
  'everton': ['efc', 'toffees'], 'crystal palace': ['palace', 'cpfc'],
};

const ALIAS_LOOKUP: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) {
    for (const a of aliases) {
      const key = norm(a);
      if (!m.has(key)) m.set(key, new Set());
      m.get(key)!.add(norm(canonical));
    }
  }
  return m;
})();

const TEAM_NOISE_PATTERNS = [/\bu-?(15|16|17|18|19|20|21|23)\b/i, /\b(reserves?|reserve|ii|iii)\s*$/i, /\byouth\b/i];
function isNoisyTeamName(name: string): boolean { return TEAM_NOISE_PATTERNS.some(rx => rx.test(name)); }

const WOMEN_TEAM_RX = /\b(women|wfc|fem(en[ií]?)?|ladies?|lfc|ddl)\b/i;
function isWomenTeamName(name: string): boolean { return WOMEN_TEAM_RX.test(name); }

const WOMEN_LEAGUE_NAME_RX = /\b(women|wsl|nwsl|fem(en[ií]?)?|ladies?|w-league|wcl)\b/i;
const WOMEN_LEAGUE_ID_RX = /(\.w\.|wchampions|wnba|nwsl|w-league)/i;
function isWomenCompetition(leagueName: string, leagueId: string): boolean {
  return WOMEN_LEAGUE_NAME_RX.test(leagueName || '') || WOMEN_LEAGUE_ID_RX.test(leagueId || '');
}

const YOUTH_LEAGUE_RX = /\b(u-?(15|16|17|18|19|20|21|23)|youth|reserves?|primavera|junior)\b/i;
function detectYouthSuffix(leagueName: string, leagueId: string): string | null {
  const text = `${leagueName} ${leagueId}`;
  const m = text.match(/\bu-?(15|16|17|18|19|20|21|23)\b/i);
  if (m) return `U${m[1]}`;
  if (/\b(youth|primavera|junior)\b/i.test(text)) return 'Youth';
  if (/\breserves?\b/i.test(text)) return 'Reserves';
  return null;
}

function scoreMatch(q: string, candidate: string): number {
  const c = norm(candidate);
  let best = -1;
  if (c === q) best = 100;
  else if (c.startsWith(q)) best = 80;
  else if (c.split(/\s+/).some(w => w.startsWith(q))) best = 60;
  else if (c.includes(q)) best = 30;
  const canonicals = ALIAS_LOOKUP.get(q);
  if (canonicals && canonicals.has(c)) best = Math.max(best, 95);
  const candAliases = TEAM_ALIASES[c];
  if (candAliases) {
    for (const a of candAliases) {
      const an = norm(a);
      if (an === q) { best = Math.max(best, 95); break; }
      if (an.startsWith(q)) { best = Math.max(best, 70); }
    }
  }
  return best;
}

interface DbTipsterRow {
  user_id: number; username: string; display_name: string | null;
  avatar_url: string | null; followers_count: number | null;
  is_verified: number | null; is_pro: number | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQ = (searchParams.get('q') || '').trim();
  const limitPerKind = Math.min(15, Math.max(1, parseInt(searchParams.get('limit') || '5', 10) || 5));

  if (rawQ.length < 2) {
    return NextResponse.json({ q: rawQ, hits: [] satisfies SearchHit[] });
  }

  const WOMEN_SUFFIX_RE = /\s+(women|wfc|fem(en[ií]?)?|ladies?|lfc|ddl)\s*$/i;
  const q = norm(rawQ.replace(WOMEN_SUFFIX_RE, '').trim() || rawQ);

  // ── 1. Leagues ────────────────────────────────────────────────────────
  const leagueHits: SearchHit[] = ALL_LEAGUES
    .map(l => ({ league: l, score: scoreMatch(q, l.name) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.league.tier - b.league.tier)
    .slice(0, limitPerKind)
    .map(({ league }) => {
      const sport = ALL_SPORTS.find(s => s.id === league.sportId);
      return { type: 'league' as const, id: `league-${league.slug}`, title: league.name, subtitle: `${sport?.name ?? 'Sport'} • ${league.country}`, href: `/leagues/${league.slug}`, sportSlug: sport?.slug };
    });

  // ── 2. Matches + teams ────────────────────────────────────────────────
  const matchHits: SearchHit[] = [];
  type TeamEntry = { hit: SearchHit; score: number; isWomen: boolean };
  const teamMap = new Map<string, TeamEntry>();

  const scoreCatalogTeam = (team: CatalogTeam): number => {
    let best = scoreMatch(q, team.name);
    for (const a of team.aliases || []) { const s = scoreMatch(q, a); if (s > best) best = s; }
    return best;
  };

  for (const team of SENIOR_FOOTBALL_TEAMS) {
    const score = scoreCatalogTeam(team);
    if (score <= 0) continue;
    const baseKey = normTeamName(team.name);
    if (!baseKey) continue;
    const dedupeKey = `${baseKey}::s`;
    teamMap.set(dedupeKey, {
      score, isWomen: false,
      hit: { type: 'team', id: team.id, title: team.name, subtitle: `${team.league} • ${team.country}`, href: teamHref(team.name, team.id), logoUrl: team.logo, sportSlug: 'football' },
    });
  }

  const isPreferredSubtitle = (countryName: string) => {
    const c = (countryName || '').toLowerCase();
    return c.length > 0 && !['world','europe','international','south america','north america','asia','africa'].includes(c);
  };

  try {
    const allMatches = await getCachedMatches();
    for (const m of allMatches) {
      const homeS = scoreMatch(q, m.homeTeam.name);
      const awayS = scoreMatch(q, m.awayTeam.name);
      const matchScore = Math.max(homeS, awayS);

      const leagueIsWomen = isWomenCompetition(m.league.name, String(m.league.id || ''));
      const youthSuffix = detectYouthSuffix(m.league.name, String(m.league.id || ''));
      for (const t of [m.homeTeam, m.awayTeam]) {
        const teamIsWomen = leagueIsWomen || isWomenTeamName(t.name);
        let displayName = t.name;
        if (teamIsWomen && !isWomenTeamName(t.name)) displayName = `${t.name} Women`;
        else if (youthSuffix && !new RegExp(`\\b${youthSuffix}\\b`, 'i').test(t.name)) displayName = `${t.name} ${youthSuffix}`;
        if (!teamIsWomen && !youthSuffix && isNoisyTeamName(t.name)) continue;
        const ts = scoreMatch(q, t.name);
        if (ts <= 0) continue;
        const baseKey = normTeamName(t.name);
        if (!baseKey) continue;
        const tier = teamIsWomen ? 'w' : youthSuffix ? `y${youthSuffix.toLowerCase()}` : 's';
        const dedupeKey = `${baseKey}::${tier}`;
        const isWomen = teamIsWomen;
        const existing = teamMap.get(dedupeKey);
        const candidate: TeamEntry = {
          score: ts, isWomen,
          hit: { type: 'team', id: t.id, title: displayName, subtitle: `${m.league.name} • ${m.league.country}`, href: teamHref(displayName, t.id), logoUrl: t.logo, sportSlug: m.sport?.slug },
        };
        if (!existing) { teamMap.set(dedupeKey, candidate); continue; }
        if (!existing.isWomen && existing.hit.id && !existing.hit.id.startsWith('fd_team_') && !isWomen) continue;
        const existingIsFd = existing.hit.id.startsWith('fd_team_');
        const candidateIsFd = t.id.startsWith('fd_team_');
        if (existingIsFd && !candidateIsFd) { teamMap.set(dedupeKey, candidate); continue; }
        if (!existingIsFd && candidateIsFd) continue;
        const existingCountry = (existing.hit.subtitle.split('•')[1] || '').trim();
        const candidateCountry = (m.league.country || '').trim();
        if (!isPreferredSubtitle(existingCountry) && isPreferredSubtitle(candidateCountry)) teamMap.set(dedupeKey, candidate);
      }

      if (matchScore > 0) {
        const HIDDEN_STATUSES: UnifiedMatch['status'][] = ['finished', 'cancelled', 'postponed'];
        if (HIDDEN_STATUSES.includes(m.status)) continue;
        matchHits.push({ type: 'match', id: m.id, title: `${m.homeTeam.name} vs ${m.awayTeam.name}`, subtitle: `${m.league.name}${m.status === 'live' ? ' • LIVE' : ''}`, href: `/matches/${matchIdToSlug(m.id)}`, status: m.status, kickoffIso: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : new Date(m.kickoffTime).toISOString() });
      }
    }
  } catch (err) {
    console.error('[search] match feed failed:', (err as Error).message);
  }

  matchHits.sort((a, b) => {
    if (a.type !== 'match' || b.type !== 'match') return 0;
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (b.status === 'live' && a.status !== 'live') return 1;
    return (a.kickoffIso || '').localeCompare(b.kickoffIso || '');
  });

  const teamLimit = Math.max(limitPerKind, 8);
  const teamHits: SearchHit[] = Array.from(teamMap.values())
    .sort((a, b) => { if (a.isWomen !== b.isWomen) return a.isWomen ? 1 : -1; return b.score - a.score; })
    .slice(0, teamLimit).map(e => e.hit);
  const trimmedMatches = matchHits.slice(0, limitPerKind);

  // ── 3. Tipsters ───────────────────────────────────────────────────────
  let tipsterHits: SearchHit[] = [];
  try {
    const list = await query<DbTipsterRow>(
      `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url, u.is_verified, t.followers_count, t.is_pro
         FROM users u
         LEFT JOIN tipster_profiles t ON t.user_id = u.id
         WHERE u.role IN ('tipster','admin') AND (u.username LIKE ? OR u.display_name LIKE ?)
         ORDER BY t.followers_count DESC LIMIT ?`,
      [`%${rawQ}%`, `%${rawQ}%`, limitPerKind],
    );
    const rows = (list as unknown as { rows?: DbTipsterRow[] }).rows ?? (list as unknown as DbTipsterRow[]);
    tipsterHits = (rows || []).map(r => ({
      type: 'tipster' as const, id: String(r.user_id),
      title: r.display_name || r.username, subtitle: `@${r.username}${r.is_pro ? ' • PRO' : ''}`,
      href: `/tipsters/${r.username}`, avatar: r.avatar_url, verified: !!r.is_verified,
    }));
  } catch { tipsterHits = []; }

  return NextResponse.json({ q: rawQ, hits: [...trimmedMatches, ...leagueHits, ...teamHits, ...tipsterHits] });
}
