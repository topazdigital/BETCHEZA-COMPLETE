import { NextRequest, NextResponse } from 'next/server';
import { ALL_LEAGUES, ALL_SPORTS } from '@/lib/sports-data';
import { getAllMatches, type UnifiedMatch } from '@/lib/api/unified-sports-api';
import { query } from '@/lib/db';
import { teamHref } from '@/lib/utils/slug';
import { matchIdToSlug } from '@/lib/utils/match-url';
import { SENIOR_FOOTBALL_TEAMS, type CatalogTeam } from '@/lib/data/team-catalog';

// Unified search endpoint backing the header typeahead.
// Returns up to ~15 hits per category for: leagues, matches, teams, tipsters.
// Designed to stay snappy (<200ms warm) — leagues/sports are searched
// in-memory; matches reuse the cached unified feed; tipsters fall back to []
// when the DB is unreachable so the UI doesn't break in local/dev.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Module-level match cache: keeps the feed hot for 30s so repeated search
// keystrokes don't each pay the full getAllMatches() round-trip cost.
let _matchCache: { data: UnifiedMatch[]; ts: number } | null = null;
const MATCH_CACHE_TTL = 30_000; // 30 seconds

async function getCachedMatches(): Promise<UnifiedMatch[]> {
  const now = Date.now();
  if (_matchCache && now - _matchCache.ts < MATCH_CACHE_TTL) {
    return _matchCache.data;
  }
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

// Stronger normaliser used only for de-duplicating teams that ESPN and
// football-data.org list under slightly different names. Strips club
// suffixes (FC, AFC, CF, SC, FK, BK, AC, etc.) and leading articles so
// "Arsenal", "Arsenal FC" and "AFC Arsenal" all collapse to one entry.
function normTeamName(s: string): string {
  return norm(s)
    .replace(/\b(fc|afc|cf|sc|fk|bk|ac|sk|sv|tsv|vfb|vfl|sk|us|as|cd|ud)\b/g, '')
    .replace(/\b(the|club|football|futbol|soccer)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

// Common abbreviations / nicknames so users can type "PSG", "MUFC", "Spurs"
// and still get the right team. Keys must already be normalised (lowercase,
// accents stripped). Multiple aliases for the same team are fine.
const TEAM_ALIASES: Record<string, string[]> = {
  'paris saint-germain': ['psg'],
  'paris saint germain': ['psg'],
  'manchester united': ['mufc', 'man u', 'man utd', 'united'],
  'manchester city': ['mcfc', 'man city', 'city'],
  'tottenham hotspur': ['spurs', 'thfc'],
  'tottenham': ['spurs', 'thfc'],
  'arsenal': ['afc', 'gunners'],
  'chelsea': ['cfc', 'blues'],
  'liverpool': ['lfc', 'reds'],
  'newcastle united': ['nufc', 'magpies'],
  'real madrid': ['rma', 'madrid'],
  'atletico madrid': ['atleti', 'atm'],
  'fc barcelona': ['barca', 'fcb'],
  'barcelona': ['barca', 'fcb'],
  'bayern munich': ['bayern', 'fcb', 'bmu'],
  'borussia dortmund': ['bvb', 'dortmund'],
  'juventus': ['juve'],
  'internazionale': ['inter'],
  'inter milan': ['inter'],
  'ac milan': ['milan'],
  'olympique de marseille': ['om', 'marseille'],
  'olympique lyonnais': ['ol', 'lyon'],
  'ajax amsterdam': ['ajax'],
  'paris fc': ['pfc'],
};

// Build an `alias → canonical-name` reverse lookup once at module load.
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

// Squads we never want clogging the team typeahead — youth and reserve
// sides only. Women's teams are FIRST-CLASS and surface alongside the men's
// senior team (Arsenal, Arsenal Women both appear). The duplicate clutter we
// still strip is U-teams (U17/U19/U21/U23), reserves (II, III, B) and
// generic youth labels.
const TEAM_NOISE_PATTERNS = [
  /\bu-?(15|16|17|18|19|20|21|23)\b/i,
  /\b(reserves?|reserve|ii|iii)\s*$/i,
  /\byouth\b/i,
];

function isNoisyTeamName(name: string): boolean {
  return TEAM_NOISE_PATTERNS.some(rx => rx.test(name));
}

// Detect women's-team variants ("Arsenal Women", "Chelsea FC Women",
// "Barcelona Femení", "Olympique Lyonnais Féminin"). We still surface
// them in search but rank them BELOW the senior side when both match.
const WOMEN_TEAM_RX = /\b(women|wfc|fem(en[ií]?)?|ladies?|lfc|ddl)\b/i;
function isWomenTeamName(name: string): boolean {
  return WOMEN_TEAM_RX.test(name);
}

// Detect women's competitions from the league name or id. ESPN's WSL/UWCL
// feeds list teams under the bare club name (e.g. "Arsenal"), so without a
// league-context check the women's side gets de-duplicated against the men's
// senior catalog entry and never appears in search.
const WOMEN_LEAGUE_NAME_RX = /\b(women|wsl|nwsl|fem(en[ií]?)?|ladies?|w-league|wcl)\b/i;
const WOMEN_LEAGUE_ID_RX = /(\.w\.|wchampions|wnba|nwsl|w-league)/i;
function isWomenCompetition(leagueName: string, leagueId: string): boolean {
  return WOMEN_LEAGUE_NAME_RX.test(leagueName || '') || WOMEN_LEAGUE_ID_RX.test(leagueId || '');
}

// Detect youth/reserve competitions (U19 UEFA Youth League, Premier League 2,
// reserve leagues, etc) so we can show those teams as "Arsenal U19" /
// "Arsenal Reserves" alongside the senior side instead of dropping them.
const YOUTH_LEAGUE_RX = /\b(u-?(15|16|17|18|19|20|21|23)|youth|reserves?|primavera|junior)\b/i;
function detectYouthSuffix(leagueName: string, leagueId: string): string | null {
  const text = `${leagueName} ${leagueId}`;
  const m = text.match(/\bu-?(15|16|17|18|19|20|21|23)\b/i);
  if (m) return `U${m[1]}`;
  if (/\b(youth|primavera|junior)\b/i.test(text)) return 'Youth';
  if (/\breserves?\b/i.test(text)) return 'Reserves';
  return null;
}

// Tiny scorer so "man u" beats "Manchester City" for matches starting with the query.
// Also checks aliases — typing "PSG" should score Paris Saint-Germain as if
// the user typed the canonical name directly.
function scoreMatch(q: string, candidate: string): number {
  const c = norm(candidate);
  // Direct text matches first.
  let best = -1;
  if (c === q) best = 100;
  else if (c.startsWith(q)) best = 80;
  else if (c.split(/\s+/).some(w => w.startsWith(q))) best = 60;
  else if (c.includes(q)) best = 30;

  // Alias matches — if any of the candidate's aliases equals or starts with
  // the query, treat that as a strong hit too.
  const canonicals = ALIAS_LOOKUP.get(q);
  if (canonicals && canonicals.has(c)) best = Math.max(best, 95);

  // Reverse: if the candidate has aliases that include the query, score it.
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
  user_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number | null;
  is_verified: number | null;
  is_pro: number | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQ = (searchParams.get('q') || '').trim();
  const limitPerKind = Math.min(15, Math.max(1, parseInt(searchParams.get('limit') || '5', 10) || 5));

  if (rawQ.length < 2) {
    return NextResponse.json({ q: rawQ, hits: [] satisfies SearchHit[] });
  }

  // Strip optional women's-team qualifiers ("arsenal women", "chelsea wfc",
  // "barcelona femeni") so the search still finds the senior club entry.
  // ESPN labels most women's sides with the bare club name, so without this
  // normaliser typing "arsenal women" returned zero hits even though the
  // women's UCL fixtures were sitting in the feed under "Arsenal".
  const WOMEN_SUFFIX_RE = /\s+(women|wfc|fem(en[ií]?)?|ladies?|lfc|ddl)\s*$/i;
  const q = norm(rawQ.replace(WOMEN_SUFFIX_RE, '').trim() || rawQ);

  // ── 1. Leagues (in-memory, cheap) ────────────────────────────────────
  const leagueHits: SearchHit[] = ALL_LEAGUES
    .map(l => ({ league: l, score: scoreMatch(q, l.name) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.league.tier - b.league.tier)
    .slice(0, limitPerKind)
    .map(({ league }) => {
      const sport = ALL_SPORTS.find(s => s.id === league.sportId);
      return {
        type: 'league',
        id: `league-${league.slug}`,
        title: league.name,
        subtitle: `${sport?.name ?? 'Sport'} • ${league.country}`,
        href: `/leagues/${league.slug}`,
        sportSlug: sport?.slug,
      };
    });

  // ── 2. Matches + teams (from unified feed; cached upstream) ──────────
  // We run team derivation off the same fetch so we only hit ESPN once.
  const matchHits: SearchHit[] = [];
  // Each team-map entry tracks its raw text-match score AND whether the
  // entry is a senior side (so women's variants can be surfaced too but
  // ranked below the senior club when a query matches both — i.e. typing
  // "Arsenal" returns Arsenal first, "Arsenal Women" second instead of
  // only the women's side).
  type TeamEntry = { hit: SearchHit; score: number; isWomen: boolean };
  // Dedupe by *normalized team name* — ESPN often lists the same club
  // under multiple feeds with different IDs (e.g. PSG appears once under
  // Ligue 1 with id 160 and again under a friendly/cup feed with id 19258),
  // and we don't want both to surface in search.
  const teamMap = new Map<string, TeamEntry>();

  // Score helper that also considers a team's aliases — typing "PSG" should
  // hit Paris Saint-Germain, "Spurs" should hit Tottenham, etc.
  const scoreCatalogTeam = (team: CatalogTeam): number => {
    let best = scoreMatch(q, team.name);
    for (const a of team.aliases || []) {
      const s = scoreMatch(q, a);
      if (s > best) best = s;
    }
    return best;
  };

  // Seed the team map with the senior-club catalog so well-known clubs
  // (Arsenal, Chelsea, Liverpool, Real Madrid, Bayern, …) ALWAYS show up
  // even when they aren't playing today. Without this, only teams in the
  // current fixture feed surface — which is why "Arsenal" returned only
  // "Arsenal Women" on midweeks the senior side wasn't in the feed.
  for (const team of SENIOR_FOOTBALL_TEAMS) {
    const score = scoreCatalogTeam(team);
    if (score <= 0) continue;
    const baseKey = normTeamName(team.name);
    if (!baseKey) continue;
    // Catalog seeds are always senior-tier — they share the `::s` namespace
    // with senior team hits derived from the live feed.
    const dedupeKey = `${baseKey}::s`;
    teamMap.set(dedupeKey, {
      score,
      isWomen: false,
      hit: {
        type: 'team',
        id: team.id,
        title: team.name,
        subtitle: `${team.league} • ${team.country}`,
        href: teamHref(team.name, team.id),
        logoUrl: team.logo,
        sportSlug: 'football',
      },
    });
  }
  // Prefer entries whose league country is a real country (not "World" /
  // "Europe" / "International") and whose sport is football — that keeps
  // PSG → Ligue 1 · France instead of PSG → Champions League · Europe.
  const isPreferredSubtitle = (countryName: string) => {
    const c = (countryName || '').toLowerCase();
    return c.length > 0 && c !== 'world' && c !== 'europe' && c !== 'international' && c !== 'south america' && c !== 'north america' && c !== 'asia' && c !== 'africa';
  };
  try {
    const allMatches = await getCachedMatches();
    for (const m of allMatches) {
      const homeS = scoreMatch(q, m.homeTeam.name);
      const awayS = scoreMatch(q, m.awayTeam.name);
      const matchScore = Math.max(homeS, awayS);

      // Team hits — dedupe by normalized team name + competition tier
      // (senior / women / U19 / reserves). ESPN's WSL feed lists teams
      // under bare club names ("Arsenal"), so without a tier-aware key the
      // women's side gets dropped in favour of the men's catalog entry.
      // We DO surface women's, U-team and reserve sides as separate hits
      // (e.g. "Arsenal", "Arsenal Women", "Arsenal U21") instead of just
      // hiding them.
      const leagueIsWomen = isWomenCompetition(m.league.name, String(m.league.id || ''));
      const youthSuffix = detectYouthSuffix(m.league.name, String(m.league.id || ''));
      for (const t of [m.homeTeam, m.awayTeam]) {
        const teamIsWomen = leagueIsWomen || isWomenTeamName(t.name);
        // Build the display name: ensure women's variants always show
        // "Women" so the user can tell them apart from the senior side.
        let displayName = t.name;
        if (teamIsWomen && !isWomenTeamName(t.name)) {
          displayName = `${t.name} Women`;
        } else if (youthSuffix && !new RegExp(`\\b${youthSuffix}\\b`, 'i').test(t.name)) {
          displayName = `${t.name} ${youthSuffix}`;
        }
        // Skip pure noise (e.g. "Arsenal Reserves II" from a noisy feed)
        // BUT only if not part of a women's/youth competition — we want
        // women's and U-teams to surface, just labelled clearly.
        if (!teamIsWomen && !youthSuffix && isNoisyTeamName(t.name)) continue;
        const ts = scoreMatch(q, t.name);
        if (ts <= 0) continue;
        // Tier-aware dedupe key. Senior, women, and youth all collapse
        // to one entry per tier, but tiers don't collide.
        const baseKey = normTeamName(t.name);
        if (!baseKey) continue;
        const tier = teamIsWomen ? 'w' : youthSuffix ? `y${youthSuffix.toLowerCase()}` : 's';
        const dedupeKey = `${baseKey}::${tier}`;
        const isWomen = teamIsWomen;
        const existing = teamMap.get(dedupeKey);
        const candidate: TeamEntry = {
          score: ts,
          isWomen,
          hit: {
            type: 'team',
            id: t.id,
            title: displayName,
            subtitle: `${m.league.name} • ${m.league.country}`,
            href: teamHref(displayName, t.id),
            logoUrl: t.logo,
            sportSlug: m.sport?.slug,
          },
        };
        if (!existing) {
          teamMap.set(dedupeKey, candidate);
          continue;
        }
        // Never let a feed entry overwrite a catalog (senior) entry.
        if (!existing.isWomen && existing.hit.id && !existing.hit.id.startsWith('fd_team_') && !isWomen) {
          // Catalog entry already there — keep it. Skip overwrite from feed.
          continue;
        }
        // Prefer ESPN-sourced ids (numeric or `espn_…`) over football-data
        // (`fd_team_…`) — ESPN ids power our team page, FD ids 404.
        const existingIsFd = existing.hit.id.startsWith('fd_team_');
        const candidateIsFd = t.id.startsWith('fd_team_');
        if (existingIsFd && !candidateIsFd) {
          teamMap.set(dedupeKey, candidate);
          continue;
        }
        if (!existingIsFd && candidateIsFd) continue;
        // Same-source tie-break: prefer the entry whose subtitle uses a
        // real country over generic continental/international labels.
        const existingCountry = (existing.hit.subtitle.split('•')[1] || '').trim();
        const candidateCountry = (m.league.country || '').trim();
        if (!isPreferredSubtitle(existingCountry) && isPreferredSubtitle(candidateCountry)) {
          teamMap.set(dedupeKey, candidate);
        }
      }

      if (matchScore > 0) {
        // Hide finished/cancelled/postponed games from search results — users
        // searching for a fixture want the upcoming or live one, not a stale
        // result from last week.
        const HIDDEN_STATUSES: UnifiedMatch['status'][] = ['finished', 'cancelled', 'postponed'];
        if (HIDDEN_STATUSES.includes(m.status)) continue;

        matchHits.push({
          type: 'match',
          id: m.id,
          title: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
          subtitle: `${m.league.name}${m.status === 'live' ? ' • LIVE' : ''}`,
          href: `/matches/${matchIdToSlug(m.id)}`,
          status: m.status,
          kickoffIso: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : new Date(m.kickoffTime).toISOString(),
        });
      }
    }
  } catch (err) {
    // Swallow — search should degrade, not crash.
    console.error('[search] match feed failed:', (err as Error).message);
  }

  matchHits.sort((a, b) => {
    // Live first, then soonest kickoff.
    if (a.type !== 'match' || b.type !== 'match') return 0;
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (b.status === 'live' && a.status !== 'live') return 1;
    return (a.kickoffIso || '').localeCompare(b.kickoffIso || '');
  });

  // Senior teams first, then women's variants, both sorted by raw score.
  // This guarantees that searching "Arsenal" puts Arsenal (id 359) above
  // Arsenal Women (id 19256) instead of the other way round. We also raise
  // the team cap a bit so women's + youth tiers can sit alongside the
  // senior team without one bumping the other off the dropdown.
  const teamLimit = Math.max(limitPerKind, 8);
  const teamHits: SearchHit[] = Array.from(teamMap.values())
    .sort((a, b) => {
      if (a.isWomen !== b.isWomen) return a.isWomen ? 1 : -1;
      return b.score - a.score;
    })
    .slice(0, teamLimit)
    .map(e => e.hit);
  const trimmedMatches = matchHits.slice(0, limitPerKind);

  // ── 3. Tipsters (DB; gracefully empty if no DB) ──────────────────────
  let tipsterHits: SearchHit[] = [];
  try {
    const list = await query<DbTipsterRow>(
      `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url, u.is_verified,
              t.followers_count, t.is_pro
         FROM users u
         LEFT JOIN tipster_profiles t ON t.user_id = u.id
         WHERE u.role IN ('tipster','admin')
           AND (u.username ILIKE $1 OR u.display_name ILIKE $2)
         ORDER BY t.followers_count DESC
         LIMIT $3`,
      [`%${rawQ}%`, `%${rawQ}%`, limitPerKind],
    );
    const rows = (list as unknown as { rows?: DbTipsterRow[] }).rows ?? (list as unknown as DbTipsterRow[]);
    tipsterHits = (rows || []).map(r => ({
      type: 'tipster' as const,
      id: String(r.user_id),
      title: r.display_name || r.username,
      subtitle: `@${r.username}${r.is_pro ? ' • PRO' : ''}`,
      href: `/tipsters/${r.username}`,
      avatar: r.avatar_url,
      verified: !!r.is_verified,
    }));
  } catch {
    tipsterHits = [];
  }

  const hits: SearchHit[] = [
    ...trimmedMatches,
    ...leagueHits,
    ...teamHits,
    ...tipsterHits,
  ];

  return NextResponse.json({ q: rawQ, hits });
}
