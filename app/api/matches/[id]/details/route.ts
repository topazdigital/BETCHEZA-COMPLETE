import { NextRequest, NextResponse } from 'next/server';
import {
  getMatchById,
  getAllMatches,
  fetchESPNSummary,
  getEspnLeagueConfigForId,
  getEspnEventIdFromMatchId,
  extractEspnOdds,
  deriveSoccerMarkets,
  getOddsIndexMarketsForMatch,
  getOddsApiEventEntry,
  fetchAllMarketsForEvent,
  type ESPNSummaryResponse,
  type UnifiedMatch,
} from '@/lib/api/unified-sports-api';
import { fetchCamel1Matches } from '@/lib/api/camel1';
import { slugToMatchId } from '@/lib/utils/match-url';
import { upsertNewsArticles } from '@/lib/news-article-index';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

// ─── In-process response cache ────────────────────────────────────────────────
// Avoids redundant ESPN + SGO fan-out on every poll cycle.
// Live matches: 30s TTL.  Near-kickoff window (±3h): 30s TTL.  All others: 90s TTL.
const DETAILS_CACHE_TTL_LIVE = 30_000;
const DETAILS_CACHE_TTL_NEAR_KICKOFF = 30_000; // within ±3h of kickoff
const DETAILS_CACHE_TTL_STATIC = 90_000;
const H2H_CACHE_TTL = 30 * 60_000; // 30 min — historical fixtures never change

type DetailsCache = { data: unknown; ts: number };
type H2HCache = { data: ReturnType<typeof buildH2HFallback> extends Promise<infer T> ? T : never; ts: number };

const g = globalThis as {
  __detailsCache?: Map<string, DetailsCache>;
  __h2hCache?: Map<string, H2HCache>;
};
if (!g.__detailsCache) g.__detailsCache = new Map();
if (!g.__h2hCache) g.__h2hCache = new Map();

interface RouteContext {
  params: Promise<{ id: string }>;
}

function americanToDecimal(american: number | string | undefined): number | undefined {
  if (american === undefined || american === null || american === '') return undefined;
  const n = typeof american === 'string' ? parseFloat(String(american).replace(/[^\d.\-+]/g, '')) : american;
  if (!Number.isFinite(n) || n === 0) return undefined;
  const decimal = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  return Math.round(decimal * 100) / 100;
}

function buildBookmakerOdds(summary: ESPNSummaryResponse, hasDraw: boolean) {
  const sources = [
    ...(summary.pickcenter || []),
    ...(summary.odds || []),
  ];
  const seen = new Set<string>();
  const list: Array<{
    bookmaker: string;
    home: number;
    draw?: number;
    away: number;
    spread?: { value: number; homePrice: number; awayPrice: number };
    total?: { value: number; overPrice: number; underPrice: number };
  }> = [];

  for (const o of sources) {
    const name = o.provider?.displayName || o.provider?.name;
    if (!name || seen.has(name)) continue;
    const home = americanToDecimal(o.homeTeamOdds?.moneyLine);
    const away = americanToDecimal(o.awayTeamOdds?.moneyLine);
    const draw = hasDraw ? americanToDecimal(o.drawOdds?.moneyLine) : undefined;
    if (!home || !away) continue;

    let spread: { value: number; homePrice: number; awayPrice: number } | undefined;
    if (o.spread !== undefined && o.homeTeamOdds?.spreadOdds !== undefined) {
      const homeSpread = americanToDecimal(o.homeTeamOdds.spreadOdds);
      const awaySpread = americanToDecimal(o.awayTeamOdds?.spreadOdds);
      if (homeSpread && awaySpread) spread = { value: o.spread, homePrice: homeSpread, awayPrice: awaySpread };
    }

    let total: { value: number; overPrice: number; underPrice: number } | undefined;
    if (o.overUnder !== undefined) {
      const overPrice = americanToDecimal(o.total?.over?.close?.odds || o.overOdds);
      const underPrice = americanToDecimal(o.total?.under?.close?.odds || o.underOdds);
      if (overPrice && underPrice) total = { value: o.overUnder, overPrice, underPrice };
    }

    seen.add(name);
    list.push({ bookmaker: name, home, draw, away, spread, total });
  }
  return list;
}

type RosterEntry = NonNullable<ESPNSummaryResponse['rosters']>[number];

// Position priority for sorting starters back-to-front:
// 0 = goalkeeper, 1 = defender, 2 = midfielder, 3 = forward.
function positionRank(pos?: string): number {
  if (!pos) return 9;
  const p = pos.toUpperCase();
  if (p === 'G' || p === 'GK' || p === 'GOALKEEPER' || p.startsWith('GK')) return 0;
  if (
    p === 'D' || p === 'DF' || p.startsWith('CB') || p.startsWith('LB') ||
    p.startsWith('RB') || p.startsWith('LWB') || p.startsWith('RWB') ||
    p.startsWith('SW') || p.includes('DEFEND') || p.includes('BACK')
  ) return 1;
  if (
    p === 'M' || p === 'MF' || p.startsWith('CM') || p.startsWith('DM') ||
    p.startsWith('CDM') || p.startsWith('CAM') || p.startsWith('AM') ||
    p.startsWith('LM') || p.startsWith('RM') || p.includes('MID')
  ) return 2;
  if (
    p === 'F' || p === 'FW' || p === 'ST' || p === 'CF' || p.startsWith('LW') ||
    p.startsWith('RW') || p.startsWith('SS') || p.includes('FORWARD') ||
    p.includes('STRIK') || p.includes('WING')
  ) return 3;
  return 5;
}

function mapRoster(r: RosterEntry | undefined) {
  if (!r) return null;
  const players = (r.roster || []).map(p => {
    // ESPN sometimes omits athlete.id in soccer rosters even though every
    // headshot URL embeds the athlete id like
    //   https://a.espncdn.com/i/headshots/soccer/players/full/123456.png
    // So we always derive a stable id by inspecting both fields and fall
    // back to the headshot regex — that gives us a clickable profile in
    // basically every case.
    const rawId = (p.athlete as { id?: string | number })?.id;
    let id = rawId !== undefined && rawId !== null && String(rawId).length > 0
      ? String(rawId)
      : undefined;
    // ESPN's summary endpoint returns headshot as either a plain URL string
    // or an object `{ href: '...' }`. Normalise to a string URL so the UI
    // never tries to render `[object Object]` as an image src.
    const rawHeadshot = (p.athlete as { headshot?: string | { href?: string } })?.headshot;
    let headshotUrl: string | undefined;
    if (typeof rawHeadshot === 'string') {
      headshotUrl = rawHeadshot;
    } else if (rawHeadshot && typeof rawHeadshot === 'object') {
      headshotUrl = rawHeadshot.href;
    }
    // Derive a stable player id from the headshot URL when ESPN omits it.
    if (!id && headshotUrl) {
      const m = headshotUrl.match(/players\/full\/(\d+)\.(?:png|jpg)/i);
      if (m) id = m[1];
    }
    // Final fallback: ESPN exposes a stable headshot CDN by athlete id —
    // build it for soccer when we have an id but no explicit headshot.
    if (!headshotUrl && id) {
      headshotUrl = `https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`;
    }
    return {
      id,
      name: p.athlete?.shortName || p.athlete?.displayName || 'Unknown',
      fullName: p.athlete?.displayName,
      position: p.position?.abbreviation || p.position?.name,
      jersey: p.jersey,
      starter: !!p.starter,
      headshot: headshotUrl,
    };
  });
  // Sort starters back→front so the goalkeeper is first, then defenders,
  // then midfielders, then forwards. This matches how the FormationPitch
  // component slices players into [GK, defence, midfield, attack] columns.
  const starting = players
    .filter(p => p.starter)
    .map((p, idx) => ({ ...p, _idx: idx }))
    .sort((a, b) => {
      const ra = positionRank(a.position);
      const rb = positionRank(b.position);
      if (ra !== rb) return ra - rb;
      return a._idx - b._idx;
    })
    .map(({ _idx, ...rest }) => rest);
  return {
    teamId: r.team?.id,
    teamName: r.team?.displayName,
    teamLogo: r.team?.logo,
    formation: r.formation,
    coach: r.coach?.[0] ? (r.coach[0].displayName || `${r.coach[0].firstName || ''} ${r.coach[0].lastName || ''}`.trim()) : undefined,
    starting,
    bench: players.filter(p => !p.starter),
  };
}

function buildLineups(summary: ESPNSummaryResponse) {
  if (!summary.rosters || summary.rosters.length === 0) return null;
  const home = summary.rosters.find(r => r.homeAway === 'home');
  const away = summary.rosters.find(r => r.homeAway === 'away');
  if (!home && !away) return null;
  return {
    home: mapRoster(home),
    away: mapRoster(away),
  };
}

// Fallback H2H builder — when ESPN's summary endpoint doesn't include
// `headToHeadGames` we fetch each team's recent league schedule (current,
// previous and previous-previous seasons) and find the games where both
// teams played each other. Works for any league/cup ESPN covers, including
// the small ones that previously showed "no previous records".
async function buildH2HFallback(
  sport: string,
  league: string,
  homeTeamId: string,
  awayTeamId: string,
  homeTeamName: string,
  awayTeamName: string,
): Promise<Array<{
  matchId?: string
  date: string
  league?: string
  home: { name: string; logo?: string; score?: number }
  away: { name: string; logo?: string; score?: number }
}> | null> {
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
  const year = new Date().getUTCFullYear();
  const seasons = [year, year - 1, year - 2];

  type SchedEvent = {
    id?: string;
    date?: string;
    name?: string;
    competitions?: Array<{
      competitors?: Array<{
        homeAway?: string;
        team?: { id?: string; displayName?: string; logo?: string };
        score?: string | number | { value?: number };
      }>;
    }>;
    league?: { abbreviation?: string };
  };

  const fetchTeamSched = async (teamId: string, season: number) => {
    try {
      const r = await fetch(
        `${ESPN}/${sport}/${league}/teams/${teamId}/schedule?season=${season}`,
        { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } },
      );
      if (!r.ok) return [] as SchedEvent[];
      const j = (await r.json()) as { events?: SchedEvent[] };
      return j.events || [];
    } catch {
      return [];
    }
  };

  // Pull both teams' schedules across 3 seasons in parallel.
  const allEvents = (
    await Promise.all([
      ...seasons.map(s => fetchTeamSched(homeTeamId, s)),
      ...seasons.map(s => fetchTeamSched(awayTeamId, s)),
    ])
  ).flat();

  // Deduplicate by event id and keep only direct meetings.
  const seen = new Set<string>();
  const games: Array<{
    matchId?: string
    date: string
    league?: string
    home: { name: string; logo?: string; score?: number }
    away: { name: string; logo?: string; score?: number }
  }> = [];

  // The internal match ID format is `espn_{leagueSlug}_{eventId}` where
  // leagueSlug strips dots from the ESPN league key (e.g. eng.1 → eng1).
  // Building it here lets the H2H rows link straight into our own match
  // detail page for any previous meeting.
  const leagueSlug = league.replace(/[^a-z0-9]/gi, '');

  for (const ev of allEvents) {
    if (!ev?.id || seen.has(ev.id)) continue;
    const competitors = ev.competitions?.[0]?.competitors || [];
    if (competitors.length < 2) continue;
    const ids = competitors.map(c => c.team?.id);
    if (!ids.includes(homeTeamId) || !ids.includes(awayTeamId)) continue;
    seen.add(ev.id);

    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
    const parseScore = (s: string | number | { value?: number } | undefined): number | undefined => {
      if (s === undefined || s === null) return undefined;
      if (typeof s === 'object') return typeof s.value === 'number' ? s.value : undefined;
      const n = typeof s === 'number' ? s : parseInt(String(s), 10);
      return Number.isFinite(n) ? n : undefined;
    };

    games.push({
      matchId: leagueSlug ? `espn_${leagueSlug}_${ev.id}` : undefined,
      date: ev.date || '',
      league: ev.league?.abbreviation,
      home: {
        name: home.team?.displayName || homeTeamName,
        logo: home.team?.logo,
        score: parseScore(home.score),
      },
      away: {
        name: away.team?.displayName || awayTeamName,
        logo: away.team?.logo,
        score: parseScore(away.score),
      },
    });
  }

  // Newest first
  games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return games.length > 0 ? games.slice(0, 10) : null;
}

function buildH2H(summary: ESPNSummaryResponse) {
  if (!summary.headToHeadGames || summary.headToHeadGames.length === 0) return null;
  const seen = new Set<string>();
  const games: Array<{
    date: string;
    league?: string;
    home: { name: string; logo?: string; score?: number };
    away: { name: string; logo?: string; score?: number };
  }> = [];
  for (const teamGroup of summary.headToHeadGames) {
    for (const g of (teamGroup.games || [])) {
      const home = g.homeTeam;
      const away = g.awayTeam;
      if (!home || !away) continue;
      const key = `${g.gameDate}_${home.displayName}_${away.displayName}_${home.score}_${away.score}`;
      if (seen.has(key)) continue;
      seen.add(key);
      games.push({
        date: g.gameDate || '',
        league: g.league?.abbreviation,
        home: {
          name: home.displayName,
          logo: home.logo,
          score: home.score !== undefined ? parseInt(String(home.score), 10) : undefined,
        },
        away: {
          name: away.displayName,
          logo: away.logo,
          score: away.score !== undefined ? parseInt(String(away.score), 10) : undefined,
        },
      });
    }
  }
  games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return games.slice(0, 10);
}

function buildStandings(summary: ESPNSummaryResponse, sport: string = 'soccer') {
  if (!summary.standings?.groups || summary.standings.groups.length === 0) return null;
  const groups = summary.standings.groups.map(g => ({
    header: g.header,
    rows: (g.standings?.entries || []).map((e: unknown) => {
      const ent = e as {
        team?: unknown;
        id?: string;
        logo?: string;
        logos?: Array<{ href?: string; rel?: string[] }>;
        stats?: Array<{ name?: string; abbreviation?: string; value?: number; displayValue?: string }>;
      };
      const teamObj = typeof ent.team === 'object' && ent.team !== null
        ? ent.team as {
            id?: string;
            displayName?: string;
            logo?: string;
            logos?: Array<{ href?: string; rel?: string[] }>;
            abbreviation?: string;
          }
        : null;
      const teamName = teamObj?.displayName || (typeof ent.team === 'string' ? ent.team : '');
      const teamId = teamObj?.id || ent.id;
      // ESPN sometimes nests the logo URL under team.logos[]; pick the first
      // default/full logo so the standings table shows real crests instead of
      // coloured fallback circles.
      const pickLogo = (arr?: Array<{ href?: string; rel?: string[] }>): string | undefined => {
        if (!arr || arr.length === 0) return undefined;
        return (
          arr.find(l => l.rel?.includes('default'))?.href ||
          arr.find(l => l.rel?.includes('full'))?.href ||
          arr[0]?.href
        );
      };
      // Sport-specific logo path on the ESPN CDN. Falling back to the soccer
      // path for non-soccer sports produced 404s and broken crests in the
      // standings table; map each ESPN sport key to its real logo directory.
      const logoSportPath: Record<string, string> = {
        soccer: 'soccer',
        basketball: 'nba',
        baseball: 'mlb',
        football: 'nfl',
        hockey: 'nhl',
        cricket: 'cricket',
      };
      const sportLogoDir = logoSportPath[sport] || sport || 'soccer';
      const teamLogo =
        teamObj?.logo ||
        ent.logo ||
        pickLogo(teamObj?.logos) ||
        pickLogo(ent.logos) ||
        (teamId ? `https://a.espncdn.com/i/teamlogos/${sportLogoDir}/500/${teamId}.png` : undefined);
      const stat = (key: string) => ent.stats?.find(s => s.name === key || s.abbreviation === key);
      return {
        teamId,
        teamName,
        teamLogo,
        played: stat('gamesPlayed')?.value ?? stat('GP')?.value ?? 0,
        won: stat('wins')?.value ?? stat('W')?.value ?? 0,
        drawn: stat('ties')?.value ?? stat('D')?.value ?? 0,
        lost: stat('losses')?.value ?? stat('L')?.value ?? 0,
        goalsFor: stat('pointsFor')?.value ?? stat('GF')?.value,
        goalsAgainst: stat('pointsAgainst')?.value ?? stat('GA')?.value,
        goalDifference: stat('pointDifferential')?.value ?? stat('GD')?.value,
        points: stat('points')?.value ?? stat('PTS')?.value ?? 0,
        position: stat('rank')?.value,
      };
    }),
  }));
  return groups.filter(g => g.rows.length > 0);
}

/**
 * Extracts side-by-side team statistics from ESPN's `boxscore.teams[].statistics`.
 * Returns a normalized array of `{ name, displayValue, abbreviation }` per team
 * so the frontend can render comparison bars (possession, shots, etc.).
 */
function buildTeamStats(summary: ESPNSummaryResponse) {
  const teams = summary.boxscore?.teams;
  if (!teams || teams.length === 0) return null;
  const home = teams.find(t => t.homeAway === 'home') || teams[0];
  const away = teams.find(t => t.homeAway === 'away') || teams[1];
  if (!home?.statistics?.length && !away?.statistics?.length) return null;

  const norm = (t: typeof teams[number] | undefined) =>
    (t?.statistics || [])
      .filter(s => (s.displayValue ?? '').toString().trim().length > 0)
      .map(s => ({
        name: s.name || s.label || s.abbreviation || '',
        label: s.label || s.name || s.abbreviation || '',
        abbreviation: s.abbreviation,
        displayValue: s.displayValue || (s.value !== undefined ? String(s.value) : ''),
      }));

  return {
    home: { team: home?.team, stats: norm(home) },
    away: { team: away?.team, stats: norm(away) },
  };
}

function buildHeader(summary: ESPNSummaryResponse) {
  const competition = summary.header?.competitions?.[0];
  if (!competition) return null;
  const home = competition.competitors?.find(c => c.homeAway === 'home');
  const away = competition.competitors?.find(c => c.homeAway === 'away');
  return {
    home: home ? {
      id: home.team?.id,
      name: home.team?.displayName,
      logo: home.team?.logo,
      score: home.score,
      record: home.record?.find(r => r.type === 'total')?.summary,
      form: home.form,
    } : null,
    away: away ? {
      id: away.team?.id,
      name: away.team?.displayName,
      logo: away.team?.logo,
      score: away.score,
      record: away.record?.find(r => r.type === 'total')?.summary,
      form: away.form,
    } : null,
  };
}

// ─── Sport-specific period / set / round / inning breakdown ──────────────────
// ESPN exposes `linescores[].value` per competitor for every game segment.
// Different sports have different segment counts and labels — basketball has
// quarters (Q1..Q4 + OT), football has innings (T1..T9), hockey has periods
// (P1..P3 + OT/SO), tennis has sets (S1..S5), MMA has rounds (R1..R5), etc.
// We compute readable labels here so the UI can render a single grid widget
// for any sport without conditional logic.
// ESPN can use either `value` (number) or `displayValue` (string) on linescores.
type LineScores = Array<{ value?: number; displayValue?: string }> | undefined;

interface SportSegmentBreakdown {
  variant: 'quarters' | 'periods' | 'innings' | 'sets' | 'rounds' | 'generic';
  labels: string[];
  home: number[];
  away: number[];
  totals?: { home: number; away: number };
}

function pickSegmentVariant(sportType: string): SportSegmentBreakdown['variant'] {
  switch (sportType) {
    case 'basketball':
    case 'american-football':
    case 'football': // ESPN sometimes labels American football "football"
      return 'quarters';
    case 'hockey':
    case 'ice-hockey':
      return 'periods';
    case 'baseball':
    case 'cricket':
      return 'innings';
    case 'tennis':
    case 'volleyball':
    case 'table-tennis':
      return 'sets';
    case 'mma':
    case 'boxing':
      return 'rounds';
    default:
      return 'generic';
  }
}

function makeSegmentLabels(variant: SportSegmentBreakdown['variant'], n: number, sportType: string): string[] {
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    switch (variant) {
      case 'quarters': {
        // Basketball normally has 4 quarters then OT; American football is also 4 + OT.
        if (i < 4) labels.push(`Q${i + 1}`);
        else labels.push(n - i === 1 ? 'OT' : `OT${i - 3}`);
        break;
      }
      case 'periods': {
        if (i < 3) labels.push(`P${i + 1}`);
        else labels.push(i === 3 ? 'OT' : 'SO');
        break;
      }
      case 'innings': {
        // Baseball regulation = 9 innings; cricket usually 2.
        const max = sportType === 'cricket' ? 2 : 9;
        if (i < max) labels.push(`${i + 1}`);
        else labels.push(`${i + 1}`);
        break;
      }
      case 'sets':
        labels.push(`S${i + 1}`);
        break;
      case 'rounds':
        labels.push(`R${i + 1}`);
        break;
      default:
        labels.push(`${i + 1}`);
    }
  }
  return labels;
}

function buildSegmentBreakdown(summary: ESPNSummaryResponse, sportType: string): SportSegmentBreakdown | null {
  const competition = summary.header?.competitions?.[0];
  if (!competition) return null;
  const home = competition.competitors?.find(c => c.homeAway === 'home');
  const away = competition.competitors?.find(c => c.homeAway === 'away');
  const homeLs: LineScores = home?.linescores;
  const awayLs: LineScores = away?.linescores;
  if (!homeLs?.length && !awayLs?.length) return null;

  const len = Math.max(homeLs?.length || 0, awayLs?.length || 0);
  const variant = pickSegmentVariant(sportType);
  const labels = makeSegmentLabels(variant, len, sportType);
  const readVal = (ls: LineScores, i: number): number => {
    const slot = ls?.[i];
    if (!slot) return 0;
    if (typeof slot.value === 'number') return slot.value;
    if (slot.displayValue !== undefined) {
      const n = Number(String(slot.displayValue).replace(/[^\d-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };
  const homeArr = Array.from({ length: len }, (_, i) => readVal(homeLs, i));
  const awayArr = Array.from({ length: len }, (_, i) => readVal(awayLs, i));

  const homeTotal = home?.score ? Number(home.score) : homeArr.reduce((a, b) => a + b, 0);
  const awayTotal = away?.score ? Number(away.score) : awayArr.reduce((a, b) => a + b, 0);

  return {
    variant,
    labels,
    home: homeArr,
    away: awayArr,
    totals: { home: homeTotal, away: awayTotal },
  };
}

function buildNews(summary: ESPNSummaryResponse) {
  // ESPN may return articles in summary.news.articles OR as individual
  // article/headlines fields (structure changed in mid-2025). Check both.
  type AnyArticle = {
    id?: string | number;
    headline?: string;
    description?: string;
    published?: string;
    images?: Array<{ url?: string }>;
    links?: { web?: { href?: string } };
    type?: string;
  };

  const raw = summary as unknown as Record<string, unknown>;

  // Primary: summary.news.articles
  let articles: AnyArticle[] = (summary.news?.articles as AnyArticle[] | undefined) || [];

  // Fallback 1: summary.headlines (some ESPN endpoints use this)
  if (articles.length === 0 && Array.isArray(raw.headlines)) {
    articles = (raw.headlines as AnyArticle[]).filter(a => a.headline);
  }

  // Fallback 2: summary.article (single article object)
  if (articles.length === 0 && raw.article && typeof raw.article === 'object') {
    const art = raw.article as AnyArticle;
    if (art.headline) articles = [art];
  }

  if (articles.length === 0) return [];

  return articles.slice(0, 8).map((a, idx) => {
    const articleId = String(a.id || idx);
    return {
      id: articleId,
      headline: a.headline,
      description: a.description,
      published: a.published,
      image: a.images?.[0]?.url,
      link: a.links?.web?.href,
      source: 'ESPN',
    };
  });
}

function buildLeaders(summary: ESPNSummaryResponse) {
  if (!summary.leaders) return [];
  return summary.leaders.flatMap(team =>
    (team.leaders || []).flatMap(category =>
      (category.leaders || []).slice(0, 1).map(l => {
        // ESPN leader rows sometimes ship `athlete.id` and sometimes only the
        // headshot URL — extract a numeric id from the headshot pattern
        // (`/players/full/<id>.png`) so the UI can deep-link to the player
        // profile in every case.
        const rawHs = l.athlete?.headshot as unknown;
        const headshotUrl = typeof rawHs === "string"
          ? rawHs
          : (rawHs as { href?: string } | null | undefined)?.href;
        const explicitId = (l.athlete as { id?: string | number } | undefined)?.id;
        let athleteId = explicitId !== undefined && explicitId !== null && String(explicitId).length > 0
          ? String(explicitId)
          : undefined;
        if (!athleteId && headshotUrl) {
          const m = headshotUrl.match(/players\/full\/(\d+)\.(?:png|jpg)/i);
          if (m) athleteId = m[1];
        }
        return {
          team: team.team?.displayName,
          teamId: team.team?.id,
          category: category.displayName || category.name,
          athlete: l.athlete?.displayName || l.athlete?.shortName,
          athleteId,
          headshot: headshotUrl,
          value: l.displayValue,
        };
      })
    )
  );
}

export type MatchEventType = 'goal' | 'own_goal' | 'penalty_goal' | 'yellow_card' | 'red_card' | 'yellow_red_card' | 'substitution' | 'var' | 'other';

export interface MatchEvent {
  id: string;
  minute: string;
  type: MatchEventType;
  side: 'home' | 'away';
  playerName?: string;
  playerId?: string;
  playerOut?: string;
  playerOutId?: string;
  assistName?: string;
  assistId?: string;
  homeScore?: number;
  awayScore?: number;
  description?: string;
  period?: number;
}

function parseClockMinute(clock?: { displayValue?: string; value?: number }): string {
  if (!clock) return '';
  if (clock.displayValue) {
    const parts = clock.displayValue.split(':');
    const mins = parseInt(parts[0] || '0', 10);
    return `${mins}'`;
  }
  if (clock.value !== undefined) {
    const mins = Math.floor(clock.value / 60);
    return `${mins}'`;
  }
  return '';
}

function detectEventType(typeText: string): MatchEventType {
  const t = (typeText || '').toLowerCase();
  if (t.includes('own goal') || t.includes('own-goal')) return 'own_goal';
  if (t.includes('penalty') && (t.includes('goal') || t.includes('score'))) return 'penalty_goal';
  if (t.includes('goal') || t.includes('score') || t.includes('touchdown') || t.includes('basket')) return 'goal';
  if (t.includes('red card') || t.includes('red-card') || t.includes('ejection') || t.includes('sent off')) return 'red_card';
  if (t.includes('yellow red') || t.includes('second yellow')) return 'yellow_red_card';
  if (t.includes('yellow card') || t.includes('yellow-card') || t.includes('caution') || t.includes('booking')) return 'yellow_card';
  if (t.includes('substitut') || t.includes('sub ') || t.includes('subs ')) return 'substitution';
  if (t.includes('var') || t.includes('review')) return 'var';
  return 'other';
}

function buildMatchEvents(summary: ESPNSummaryResponse, homeTeamId?: string, awayTeamId?: string): MatchEvent[] {
  const events: MatchEvent[] = [];
  const seen = new Set<string>();

  const getTeamSide = (teamId?: string): 'home' | 'away' => {
    if (!teamId) return 'home';
    if (homeTeamId && teamId === homeTeamId) return 'home';
    if (awayTeamId && teamId === awayTeamId) return 'away';
    return 'home';
  };

  // Process scoring plays first (goals)
  if (summary.scoringPlays) {
    for (const play of summary.scoringPlays) {
      const id = play.id || `sp-${events.length}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const typeText = play.type?.text || play.type?.abbreviation || '';
      const eventType = detectEventType(typeText);
      const scorer = play.participants?.find(p => p.type?.name === 'scorer' || p.type?.name === 'athlete');
      const assister = play.participants?.find(p => p.type?.name === 'assister' || p.type?.name === 'assist');
      const side = getTeamSide(play.team?.id);
      const minute = parseClockMinute(play.clock);

      events.push({
        id,
        minute: minute || `${play.period?.number || 1}P`,
        type: eventType === 'other' ? 'goal' : eventType,
        side,
        playerName: scorer?.athlete?.displayName || scorer?.athlete?.shortName,
        playerId: scorer?.athlete?.id,
        assistName: assister?.athlete?.displayName || assister?.athlete?.shortName,
        assistId: assister?.athlete?.id,
        homeScore: play.homeScore,
        awayScore: play.awayScore,
        description: play.text,
        period: play.period?.number,
      });
    }
  }

  // Process all plays for cards and substitutions
  if (summary.plays) {
    for (const play of summary.plays) {
      const id = play.id || `p-${events.length}`;
      if (seen.has(id)) continue;

      const typeText = play.type?.text || play.type?.abbreviation || '';
      const eventType = detectEventType(typeText);

      if (eventType === 'other' || eventType === 'goal' || eventType === 'penalty_goal' || eventType === 'own_goal') continue;

      seen.add(id);
      const side = getTeamSide(play.team?.id);
      const minute = parseClockMinute(play.clock);

      if (eventType === 'substitution') {
        const playerIn = play.participants?.[0];
        const playerOut = play.participants?.[1];
        events.push({
          id,
          minute: minute || `${play.period?.number || 1}P`,
          type: 'substitution',
          side,
          playerName: playerIn?.athlete?.displayName || playerIn?.athlete?.shortName,
          playerId: playerIn?.athlete?.id,
          playerOut: playerOut?.athlete?.displayName || playerOut?.athlete?.shortName,
          playerOutId: playerOut?.athlete?.id,
          homeScore: play.homeScore,
          awayScore: play.awayScore,
          period: play.period?.number,
        });
      } else {
        const player = play.participants?.[0];
        events.push({
          id,
          minute: minute || `${play.period?.number || 1}P`,
          type: eventType,
          side,
          playerName: player?.athlete?.displayName || player?.athlete?.shortName,
          playerId: player?.athlete?.id,
          homeScore: play.homeScore,
          awayScore: play.awayScore,
          period: play.period?.number,
        });
      }
    }
  }

  // Sort by minute numerically
  events.sort((a, b) => {
    const mA = parseInt(a.minute) || 0;
    const mB = parseInt(b.minute) || 0;
    return mA - mB;
  });

  return events;
}

function generateComputedOdds(homeTeamName: string, awayTeamName: string, sportType = 'soccer') {
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };
  const matchHash = hashCode(homeTeamName + awayTeamName);
  const seed = (matchHash % 1000) / 1000;
  const noDrawSports = ['basketball', 'baseball', 'mma', 'tennis', 'golf', 'racing'];
  const homeAdv = sportType === 'basketball' ? 0.55 : sportType === 'soccer' ? 0.45 : 0.52;
  let homeProb = homeAdv + (seed - 0.5) * 0.3;
  const hasDraw = !noDrawSports.includes(sportType);
  let drawProb: number | undefined;
  let awayProb: number;
  if (hasDraw) {
    drawProb = 0.25 + (seed * 0.1);
    homeProb = Math.max(0.2, Math.min(0.55, homeProb));
    awayProb = 1 - homeProb - drawProb;
  } else {
    awayProb = 1 - homeProb;
  }
  const margin = 1.06;
  return {
    home: Math.round(Math.max(1.15, Math.min((margin / homeProb), 6.0)) * 100) / 100,
    draw: drawProb ? Math.round(Math.max(2.8, Math.min((margin / drawProb), 5.5)) * 100) / 100 : undefined,
    away: Math.round(Math.max(1.15, Math.min((margin / awayProb), 8.0)) * 100) / 100,
    bookmaker: 'Estimated',
    isComputed: true,
  };
}

/**
 * Extract team-name tokens from a human-readable URL slug so we can do a
 * fuzzy cache scan before the expensive ESPN league-probe lookup.
 * "palestino-vs-audax-italiano-401850594" → ["palestino", "audax italiano"]
 */
function extractTeamHintsFromSlug(slug: string): [string, string] | null {
  const m = decodeURIComponent(slug).match(/^([a-z0-9-]+)-vs-([a-z0-9-]+?)(?:-\d{4,})?$/i);
  if (!m) return null;
  return [m[1].replace(/-/g, ' '), m[2].replace(/-/g, ' ')];
}

function teamNameMatches(teamName: string, hint: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const t = norm(teamName);
  const h = norm(hint);
  const hWords = h.split(' ').filter(w => w.length >= 3);
  return hWords.length > 0 && hWords.every(w => t.includes(w));
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: rawId } = await context.params;
  // Resolve clean URL slugs (e.g. "ita1-737421") to full ESPN IDs ("espn_ita.1_737421")
  const id = slugToMatchId(decodeURIComponent(rawId));
  try {
    let match: UnifiedMatch | null = null;

    // Extract team name hints once — used both for cache scan and to validate
    // ESPN league-probe results (prevents wrong-league collisions in tryLeagues).
    const teamHints: [string, string] | null = (id.startsWith('espn_eventid_') && decodeURIComponent(rawId).includes('-vs-'))
      ? extractTeamHintsFromSlug(rawId)
      : null;

    // Fast path for human-readable slugs: scan the live match cache by team
    // names BEFORE doing the expensive ESPN league-probe. This prevents the
    // wrong-league bug where an old Champions League event with the same
    // numeric ID beats the actual current match in the race.
    if (teamHints) {
      try {
        const allMatches = await getAllMatches();
        const byTeam = allMatches.find(m =>
          teamNameMatches(m.homeTeam.name, teamHints[0]) &&
          teamNameMatches(m.awayTeam.name, teamHints[1])
        );
        if (byTeam) match = byTeam;
      } catch { /* fall through to getMatchById */ }
    }

    if (!match) match = await getMatchById(id, teamHints ?? undefined);

    // Final fallback: scan camel1 directly by team name.
    // This catches non-ESPN matches (e.g. small WTA tournaments, camel1-only events)
    // that are not in the rolling getAllMatches() window or ESPN's API.
    if (!match && decodeURIComponent(rawId).includes('-vs-')) {
      const hints = extractTeamHintsFromSlug(rawId);
      if (hints) {
        try {
          const camel1Matches = await fetchCamel1Matches();
          const byTeam = camel1Matches.find(m =>
            teamNameMatches(m.homeTeam.name, hints[0]) &&
            teamNameMatches(m.awayTeam.name, hints[1])
          );
          if (byTeam) match = byTeam;
        } catch { /* camel1 unavailable — fall through to retry */ }
      }
    }

    // ── Cold-cache retry ──────────────────────────────────────────────────────
    // If still not found, the match cache may still be warming (cold server
    // start / first request for this sport). Wait 2 s and try once more before
    // giving up. This eliminates the "Match not found → refresh → works" race.
    if (!match) {
      await new Promise(r => setTimeout(r, 2000));

      // Retry team-name fast-path first (cheapest)
      if (teamHints) {
        try {
          const allMatches = await getAllMatches();
          const byTeam = allMatches.find(m =>
            teamNameMatches(m.homeTeam.name, teamHints[0]) &&
            teamNameMatches(m.awayTeam.name, teamHints[1])
          );
          if (byTeam) match = byTeam;
        } catch { /* fall through */ }
      }

      // Full retry via getMatchById (cache likely warm now) — pass name hints
      // so tryLeagues rejects wrong-league collisions (e.g. Serie A hijacking
      // a Club Friendly event ID that happens to match numerically).
      if (!match) match = await getMatchById(id, teamHints ?? undefined);
    }

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Use the real ESPN match ID (not the slug-derived ID) for subsequent lookups
    const resolvedId = match.id || id;
    const cfg = getEspnLeagueConfigForId(resolvedId);
    const eventId = getEspnEventIdFromMatchId(resolvedId);

    const isLive = match.status === 'live' || match.status === 'in_progress';
    const cacheKey = resolvedId;
    const now = Date.now();

    // Near-kickoff window: 1 hour before to 4 hours after kickoff.
    // Use a short 30s TTL so the page picks up live → finished transitions quickly.
    const kickoffMsForTTL = new Date(
      match.kickoffTime instanceof Date
        ? match.kickoffTime
        : match.kickoffTime as unknown as string
    ).getTime();
    const isNearKickoff = !isNaN(kickoffMsForTTL)
      && now > kickoffMsForTTL - 3_600_000
      && now < kickoffMsForTTL + 4 * 3_600_000;
    const cacheTTL = isLive ? DETAILS_CACHE_TTL_LIVE
      : isNearKickoff ? DETAILS_CACHE_TTL_NEAR_KICKOFF
      : DETAILS_CACHE_TTL_STATIC;

    // ── Detect stale-scheduled: past-kickoff matches cached as "scheduled" ───
    // If the match kickoff was >2 hours ago but status is still "scheduled",
    // skip the cache entirely so we always re-fetch fresh status from ESPN.
    const kickoffMsEarly = new Date(
      match.kickoffTime instanceof Date
        ? match.kickoffTime
        : match.kickoffTime as unknown as string
    ).getTime();
    const isStaleScheduled = match.status === 'scheduled' && kickoffMsEarly < now - 2 * 3_600_000;

    // ── Serve from in-process cache when fresh ────────────────────────────────
    const cached = g.__detailsCache!.get(cacheKey);
    if (!isStaleScheduled && cached && now - cached.ts < cacheTTL) {
      return NextResponse.json(cached.data);
    }
    // Bust the stale-scheduled cache entry so subsequent requests get fresh data too.
    if (isStaleScheduled) g.__detailsCache!.delete(cacheKey);

    // ── Fan-out: ESPN summary + SGO bookmaker lines in parallel ───────────────
    const summaryPromise: Promise<ESPNSummaryResponse | null> = cfg && eventId
      ? fetchESPNSummary(cfg.sport, cfg.league, eventId)
      : Promise.resolve(null);

    const isoKickoff = match.kickoffTime instanceof Date
      ? match.kickoffTime.toISOString()
      : new Date(match.kickoffTime as unknown as string).toISOString();

    const noDrawSports = ['basketball', 'baseball', 'mma', 'tennis', 'golf', 'racing'];
    const hasDraw = !noDrawSports.includes(cfg?.sportType || 'soccer');

    // Sport tag for collision-proof team URLs — ESPN reuses numeric IDs across sports.
    // Maps ESPN league slug → short tag that the team-page route understands.
    // IMPORTANT: every non-soccer sport MUST have a unique tag so the team page
    // can disambiguate ESPN IDs that are reused across sports/leagues (e.g. ID 263
    // is both Dallas Baptist Patriots in college-baseball AND Las Vegas 51s in MLB).
    const LEAGUE_TO_SPORT_TAG: Record<string, string> = {
      // Basketball
      nba: 'nba', wnba: 'wnba', 'mens-college-basketball': 'ncaab',
      'womens-college-basketball': 'ncaaw',
      // Baseball — MUST distinguish MLB from college/minor leagues
      mlb: 'mlb', 'college-baseball': 'cbb', 'milb': 'milb',
      // Football
      nfl: 'nfl', 'college-football': 'ncaaf',
      // Hockey
      nhl: 'nhl', 'college-hockey': 'ncaah',
      // Other sports
      rugbyunion: 'rugby', rugbyleague: 'rugby',
      ufc: 'mma', boxing: 'boxing',
      atp: 'tennis', wta: 'tennis',
      cricket: 'cricket', pga: 'golf',
      lpga: 'golf', 'kbo-league': 'kbo', 'npb': 'npb',
    };
    // For any non-soccer sport not in the map above, fall back to
    // `sport-league` compound so it's always unique across sports/leagues.
    // If cfg is null (league not recognised, e.g. WTA tournament sub-key),
    // derive the tag from match.sport.slug so tennis/basketball/etc. players
    // still get collision-proof URLs even when the league config is missing.
    const SPORT_SLUG_TO_TAG: Record<string, string> = {
      tennis: 'tennis', basketball: 'basketball', baseball: 'baseball',
      'american-football': 'nfl', 'ice-hockey': 'nhl',
      rugby: 'rugby', cricket: 'cricket', golf: 'golf',
      mma: 'mma', boxing: 'boxing', volleyball: 'volleyball',
    };
    const teamSportTag: string | null = (() => {
      if (cfg?.sportType && cfg.sportType !== 'soccer') {
        if (cfg.league && LEAGUE_TO_SPORT_TAG[cfg.league]) return LEAGUE_TO_SPORT_TAG[cfg.league];
        if (cfg.league) return `${cfg.sportType}-${cfg.league.replace(/[^a-z0-9]/gi, '')}`;
        return cfg.sportType;
      }
      // cfg is null or soccer — fall back to the match's sport slug
      const sportSlug = match.sport?.slug;
      if (!sportSlug || sportSlug === 'soccer' || sportSlug === 'football') return null;
      return SPORT_SLUG_TO_TAG[sportSlug] ?? sportSlug;
    })();

    const sgoPromise: Promise<Array<{
      bookmaker: string; display: string;
      home: number; draw?: number; away: number;
      links?: { home?: string; draw?: string; away?: string };
    }>> = import('@/lib/api/sportsgameodds')
      .then(m => m.getSgoBookmakerLines(match.homeTeam.name, match.awayTeam.name, isoKickoff, hasDraw))
      .catch(() => []);

    // ── SofaScore event details (lineups / statistics / incidents) ─────────────
    // For SofaScore-sourced matches (id starts with ss_) we can fetch rich
    // event data directly. For ESPN matches this path is skipped here and only
    // activated later as a fallback when ESPN summary is null.
    const ssEventId: number | null = match.id.startsWith('ss_')
      ? (parseInt(match.id.replace('ss_', ''), 10) || null)
      : null;

    type SSDetails = import('@/lib/api/sofascore').SSEventDetails | null;
    const ssDetailsPromise: Promise<SSDetails> = ssEventId
      ? import('@/lib/api/sofascore')
          .then(mod => mod.fetchSofaScoreEventDetails(ssEventId))
          .catch(() => null)
      : Promise.resolve(null);

    const FANOUT_TIMEOUT_MS = 8_000;
    const fanoutTimeout = new Promise<[null, [], SSDetails]>(resolve =>
      setTimeout(() => resolve([null, [], null]), FANOUT_TIMEOUT_MS)
    );
    const [summary, sgoRaw, ssDetails] = await Promise.race([
      Promise.all([summaryPromise, sgoPromise, ssDetailsPromise]),
      fanoutTimeout,
    ]);

    // ── Stale-scheduled override ──────────────────────────────────────────────
    // If the cached match says "scheduled" but kickoff has already passed,
    // derive the real status (live, halftime, or finished) from the ESPN
    // summary. This fixes the common case where the match cache hasn't been
    // updated yet from 'scheduled' → 'live' / 'finished'.
    let resolvedStatus = match.status;
    let resolvedHomeScore = match.homeScore;
    let resolvedAwayScore = match.awayScore;
    let resolvedMinute = match.minute;
    const kickoffMs = new Date(match.kickoffTime instanceof Date ? match.kickoffTime : match.kickoffTime as unknown as string).getTime();
    const TWO_HOURS_MS = 2 * 3_600_000;
    if (match.status === 'scheduled' && kickoffMs < now) {
      const espnComp = summary?.header?.competitions?.[0];
      const espnStatus = (espnComp as { status?: { type?: { completed?: boolean; state?: string; name?: string; detail?: string } } } | undefined)?.status;
      const stateRaw = espnStatus?.type?.state?.toLowerCase() || '';
      const nameRaw = (espnStatus?.type?.name || '').toLowerCase();
      const detailRaw = (espnStatus?.type?.detail || '').toLowerCase();

      if (espnStatus?.type?.completed || stateRaw === 'post') {
        resolvedStatus = 'finished';
        const hc = espnComp?.competitors?.find((c: { homeAway?: string }) => c.homeAway === 'home') as { score?: string } | undefined;
        const ac = espnComp?.competitors?.find((c: { homeAway?: string }) => c.homeAway === 'away') as { score?: string } | undefined;
        if (hc?.score !== undefined) resolvedHomeScore = parseInt(hc.score, 10) || 0;
        if (ac?.score !== undefined) resolvedAwayScore = parseInt(ac.score, 10) || 0;
        g.__detailsCache!.delete(cacheKey);
        console.info(`[match details] Stale-scheduled override: ${resolvedId} → finished ${resolvedHomeScore}-${resolvedAwayScore}`);
      } else if (stateRaw === 'in' || nameRaw.includes('in_progress') || nameRaw.includes('halftime') || detailRaw.includes('halftime') || detailRaw.includes('half time')) {
        // Match is in progress or at halftime — update live status and scores from ESPN
        resolvedStatus = (nameRaw.includes('halftime') || detailRaw.includes('halftime') || detailRaw.includes('half time')) ? 'halftime' : 'live';
        const hc = espnComp?.competitors?.find((c: { homeAway?: string }) => c.homeAway === 'home') as { score?: string } | undefined;
        const ac = espnComp?.competitors?.find((c: { homeAway?: string }) => c.homeAway === 'away') as { score?: string } | undefined;
        if (hc?.score !== undefined) resolvedHomeScore = parseInt(hc.score, 10) || 0;
        if (ac?.score !== undefined) resolvedAwayScore = parseInt(ac.score, 10) || 0;
        // Extract current match minute from ESPN clock if available
        const espnClock = (espnComp as { status?: { displayClock?: string; clock?: number } } | undefined)?.status;
        if (espnClock?.displayClock) {
          const clockParts = espnClock.displayClock.split(':');
          const mins = parseInt(clockParts[0] || '0', 10);
          if (!isNaN(mins)) resolvedMinute = mins;
        }
        // Don't cache live matches — always serve fresh on next request
        g.__detailsCache!.delete(cacheKey);
        console.info(`[match details] Stale-scheduled override: ${resolvedId} → ${resolvedStatus} ${resolvedHomeScore}-${resolvedAwayScore} min=${resolvedMinute}`);
      } else if (kickoffMs < now - TWO_HOURS_MS && !espnStatus && summary) {
        // Summary exists but no recognizable status — assume finished for past matches
        resolvedStatus = 'finished';
      } else if (!summary) {
        // ESPN summary unavailable (timeout / circuit open).
        // Step 1: Try SofaScore for a real score — works from VPS even when ESPN is down.
        const elapsedMin = (now - kickoffMs) / 60_000;
        if (elapsedMin >= 1) {
          const sportSlug = match.sport?.slug === 'soccer' ? 'football' : (match.sport?.slug ?? 'football');
          const ssScore = await import('@/lib/api/sofascore')
            .then(mod => mod.findSofaScoreLiveScore(match.homeTeam.name, match.awayTeam.name, sportSlug))
            .catch(() => null);

          if (ssScore && ssScore.status !== 'scheduled') {
            // SofaScore has real live data — use it
            resolvedStatus    = ssScore.status;
            resolvedHomeScore = ssScore.homeScore;
            resolvedAwayScore = ssScore.awayScore;
            if (ssScore.minute !== null) resolvedMinute = ssScore.minute;
            g.__detailsCache!.delete(cacheKey);
            console.info(
              `[match details] SofaScore fallback: ${resolvedId} → ${resolvedStatus} ` +
              `${ssScore.homeScore}-${ssScore.awayScore} min=${ssScore.minute}`
            );
          } else if (elapsedMin <= 130) {
            // Step 2: SofaScore had no data — infer status from the clock
            resolvedStatus = elapsedMin > 45 && elapsedMin < 55 ? 'halftime' : 'live';
            g.__detailsCache!.delete(cacheKey);
            console.info(
              `[match details] Time-based inference: ${resolvedId} elapsed=${Math.round(elapsedMin)}min → ${resolvedStatus}`
            );
          } else {
            // Step 3: Past 130 min with no data — almost certainly finished
            resolvedStatus = 'finished';
            g.__detailsCache!.delete(cacheKey);
          }
        }
      }
    }
    // Also treat ESPN "post" status that slipped through normalization
    const FINISHED_STATUSES = new Set(['finished', 'ft', 'full-time', 'aet', 'pen', 'post', 'walkover', 'awarded', 'final']);
    if (!FINISHED_STATUSES.has(resolvedStatus) && kickoffMs < now - 3 * 3_600_000) {
      // 3+ hours past kickoff and not recognized as finished — mark finished defensively
      const period = match.period || '';
      if (/\b(ft|final|full.?time|end|game.?over|finished|over|result)\b/i.test(period)) {
        resolvedStatus = 'finished';
      }
    }

    // For any finished match where the cached score is null/null or 0-0, try
    // to recover the real final score from two sources:
    //  1. ESPN summary (already fetched in parallel above) — fastest path.
    //  2. SofaScore today/yesterday schedule — fallback when ESPN is circuit-broken.
    const hasRealScore = () =>
      (resolvedHomeScore !== null && resolvedHomeScore !== undefined && resolvedHomeScore > 0) ||
      (resolvedAwayScore !== null && resolvedAwayScore !== undefined && resolvedAwayScore > 0);

    if (FINISHED_STATUSES.has(resolvedStatus) && !hasRealScore()) {
      // ── Path 1: ESPN summary score ─────────────────────────────────────────
      if (summary) {
        const espnCompForScore = summary?.header?.competitions?.[0];
        const hcScore = espnCompForScore?.competitors?.find((c: { homeAway?: string }) => c.homeAway === 'home') as { score?: string } | undefined;
        const acScore = espnCompForScore?.competitors?.find((c: { homeAway?: string }) => c.homeAway === 'away') as { score?: string } | undefined;
        if (hcScore?.score !== undefined && acScore?.score !== undefined) {
          const hs = parseInt(hcScore.score, 10);
          const as_ = parseInt(acScore.score, 10);
          if (!isNaN(hs) && !isNaN(as_)) {
            resolvedHomeScore = hs;
            resolvedAwayScore = as_;
            console.info(`[match details] Final score (ESPN summary): ${resolvedId} → ${hs}-${as_}`);
          }
        }
      }

      // ── Path 2: SofaScore today/yesterday schedule (ESPN circuit-broken) ───
      // Only try for recent matches (within the last 2 days) to avoid wasting
      // SofaScore quota on old fixtures we'll never find there.
      if (!hasRealScore() && kickoffMs > Date.now() - 2 * 86_400_000) {
        try {
          const ssMod = await import('@/lib/api/sofascore');
          const sportSsSlug = match.sport?.slug === 'soccer' ? 'football' : (match.sport?.slug ?? 'football');
          const todayMatches = await ssMod.fetchSofaScoreTodaySchedule();
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
          const hNorm = norm(match.homeTeam.name);
          const aNorm = norm(match.awayTeam.name);
          // Team name matching is unique enough across sports — no need to
          // filter by sport slug (ESPN global slugs differ from SofaScore's).
          const ssMatch = todayMatches.find(m => {
            const mh = norm(m.homeTeam.name);
            const ma = norm(m.awayTeam.name);
            return (mh === hNorm || mh.includes(hNorm) || hNorm.includes(mh)) &&
                   (ma === aNorm || ma.includes(aNorm) || aNorm.includes(ma));
          });
          if (ssMatch && FINISHED_STATUSES.has(ssMatch.status) &&
              (ssMatch.homeScore !== null || ssMatch.awayScore !== null)) {
            resolvedHomeScore = ssMatch.homeScore ?? 0;
            resolvedAwayScore = ssMatch.awayScore ?? 0;
            console.info(`[match details] Final score (SofaScore fallback): ${resolvedId} → ${resolvedHomeScore}-${resolvedAwayScore}`);
          }
        } catch (e) {
          console.warn('[match details] SofaScore score fallback failed:', e);
        }
      }
    }

    // sportType must be declared BEFORE extractEspnOdds (which uses it below)
    const sportType = cfg?.sportType || 'soccer';

    const summaryOddsList = [...(summary?.pickcenter || []), ...(summary?.odds || [])];
    const { odds: summaryOdds, markets: summaryMarkets } = extractEspnOdds(summaryOddsList, hasDraw, sportType, match.homeTeam.name, match.awayTeam.name);
    const realOdds = summaryOdds || match.odds;

    // Only use real odds — never fall back to computed/estimated odds
    const finalOdds = realOdds || null;
    const isSoccer = sportType === 'soccer';

    // For soccer: derive additional markets (BTTS, correct score, etc.) from
    // the real 1X2 odds using a statistical model — this is the established
    // feature and the odds are clearly model-derived.
    // For all other sports: NEVER derive fake computed odds. Only show what
    // ESPN pickcenter returns as real bookmaker data (moneyline, spread, total).
    let derivedMarkets: ReturnType<typeof deriveSoccerMarkets> = [];
    if (isSoccer && finalOdds?.home && finalOdds?.draw !== undefined && finalOdds?.away) {
      derivedMarkets = deriveSoccerMarkets(
        finalOdds.home,
        finalOdds.draw,
        finalOdds.away,
        match.homeTeam.name,
        match.awayTeam.name,
      );
    }

    // Merge strategy:
    // 1. ESPN pickcenter markets (h2h, asian_handicap, totals) — real provider odds → always kept.
    // 2. Derived soccer markets supplement when ESPN doesn't cover a market key.
    // 3. Non-soccer: only real ESPN markets shown; empty list if none available.
    const espnMarketKeys = new Set((summaryMarkets || []).map((m: { key: string }) => m.key));
    const supplementary = derivedMarkets.filter(m => !espnMarketKeys.has(m.key));
    const baseMarkets = summaryMarkets && summaryMarkets.length > 0
      ? [...summaryMarkets, ...supplementary]
      : (isSoccer && finalOdds ? derivedMarkets : []);

    // Inject additional Asian Handicap lines from the real-odds index (TheOddsAPI
    // bookmakers aggregated in the bulk fetch). Only add lines not already present.
    const indexMarkets = getOddsIndexMarketsForMatch(match.homeTeam.name, match.awayTeam.name);
    const ahIndexLines = indexMarkets.filter(m => m.key === 'asian_handicap' || m.key.startsWith('asian_handicap_alt'));
    const presentAhKeys = new Set(baseMarkets.map(m => m.key));
    const newAhLines: typeof baseMarkets = [];
    for (const ahMkt of ahIndexLines) {
      const lineValue = ahMkt.outcomes[0]?.point;
      const alreadyPresent = baseMarkets.some(m =>
        (m.key === 'asian_handicap' || m.key.startsWith('asian_handicap_alt')) &&
        m.outcomes[0]?.point === lineValue
      );
      if (!alreadyPresent) newAhLines.push(ahMkt);
    }
    let altIdx = [...presentAhKeys].filter(k => k.startsWith('asian_handicap')).length;
    const renumbered = newAhLines.map(m => ({
      ...m,
      key: altIdx === 0 ? 'asian_handicap' : `asian_handicap_alt_${altIdx++}`,
    }));
    const ahInsertIdx = baseMarkets.findIndex(m => m.key === 'asian_handicap' || m.key.startsWith('asian_handicap_alt'));
    const ahEndIdx = ahInsertIdx >= 0
      ? baseMarkets.reduce((last, m, i) => (m.key === 'asian_handicap' || m.key.startsWith('asian_handicap_alt')) ? i + 1 : last, ahInsertIdx + 1)
      : baseMarkets.length;

    // Fetch all real DraftKings markets for this specific event via The Odds API
    // per-event endpoint. Covers BTTS, Double Chance, DNB, 1st Half, alternate lines,
    // player props (goalscorers / NBA/NFL props) — every market type The Odds API
    // offers for this sport. Results cached per event for 1 hour to preserve quota.
    const eventEntry = getOddsApiEventEntry(match.homeTeam.name, match.awayTeam.name);
    const realEventMarkets = eventEntry
      ? await fetchAllMarketsForEvent(eventEntry.sportKey, eventEntry.eventId)
      : [];

    let finalMarkets: typeof baseMarkets;
    if (realEventMarkets.length > 0) {
      // Real per-event markets are highest quality — override any ESPN/derived market
      // with the same key, and supplement with ESPN markets not covered by real data.
      const realKeys = new Set(realEventMarkets.map(m => m.key));
      finalMarkets = [
        ...realEventMarkets,
        ...baseMarkets.filter(m => !realKeys.has(m.key)),
      ];
    } else {
      // No per-event real markets available (event not in The Odds API index yet, or
      // quota exhausted). Fall back to ESPN pickcenter + derived markets + extra AH lines.
      // Only strip markets that are provably jitter/model-only (never real bookmaker data).
      const FAKE_PREFIXES = ['corners_', 'corners_total_', 'cards_total_', 'race_corners'];
      const FAKE_EXACT = new Set(['red_card', 'penalty_awarded', 'booking_points']);
      const isFake = (key: string) =>
        FAKE_EXACT.has(key) || FAKE_PREFIXES.some(p => key.startsWith(p));
      finalMarkets = [
        ...baseMarkets.slice(0, ahEndIdx),
        ...renumbered,
        ...baseMarkets.slice(ahEndIdx),
      ].filter(m => !isFake(m.key));
    }

    const bookmakerOdds = summary ? buildBookmakerOdds(summary, hasDraw) : [];

    // Merge SGO bookmaker lines (already fetched in parallel above).
    try {
      const { buildAffiliateLink } = await import('@/lib/bookmakers-store');
      const seen = new Set(bookmakerOdds.map(o => o.bookmaker.toLowerCase()));
      for (const sl of sgoRaw) {
        if (seen.has(sl.display.toLowerCase())) continue;
        const affHome = buildAffiliateLink(sl.bookmaker, sl.links?.home) || sl.links?.home;
        const affDraw = buildAffiliateLink(sl.bookmaker, sl.links?.draw) || sl.links?.draw;
        const affAway = buildAffiliateLink(sl.bookmaker, sl.links?.away) || sl.links?.away;
        bookmakerOdds.push({
          bookmaker: sl.display,
          home: sl.home,
          draw: sl.draw,
          away: sl.away,
          links: {
            home: affHome || undefined,
            draw: affDraw || undefined,
            away: affAway || undefined,
          },
        } as typeof bookmakerOdds[number] & { links?: { home?: string; draw?: string; away?: string } });
        seen.add(sl.display.toLowerCase());
      }
    } catch (err) {
      console.warn('[match details] SGO merge failed:', err);
    }

    // ── Pinnacle odds (public guest API, no key) ──────────────────────────────
    try {
      const { getPinnacleOdds } = await import('@/lib/api/pinnacle');
      const seenBooks = new Set(bookmakerOdds.map(o => o.bookmaker.toLowerCase()));
      if (!seenBooks.has('pinnacle')) {
        const pinnOdds = await Promise.race([
          getPinnacleOdds(match.homeTeam.name, match.awayTeam.name, sportType, kickoffMs),
          new Promise<null>(r => setTimeout(() => r(null), 4_000)),
        ]);
        if (pinnOdds && pinnOdds.home > 1.01 && pinnOdds.away > 1.01) {
          (bookmakerOdds as Array<Record<string, unknown>>).push({
            bookmaker: 'Pinnacle',
            home:  pinnOdds.home,
            draw:  pinnOdds.draw,
            away:  pinnOdds.away,
            spread: pinnOdds.homeSpreadLine !== undefined
              ? { home: pinnOdds.homeSpread, line: pinnOdds.homeSpreadLine, away: pinnOdds.awaySpread }
              : undefined,
            total: pinnOdds.totalLine !== undefined
              ? { over: pinnOdds.totalOver, under: pinnOdds.totalUnder, line: pinnOdds.totalLine }
              : undefined,
          });
        }
      }
    } catch (err) {
      console.warn('[match details] Pinnacle merge failed:', err);
    }

    // ── SofaScore cross-reference for ESPN matches when summary is null ────────
    // If this is an ESPN match and we got no summary (ESPN timeout/circuit open),
    // try to find and fetch SofaScore event details as a full fallback.
    let ssDetailsFallback: import('@/lib/api/sofascore').SSEventDetails | null = ssDetails;
    if (!ssEventId && !summary) {
      try {
        const ssMod = await import('@/lib/api/sofascore');
        const sportSsSlug = match.sport?.slug === 'soccer' ? 'football' : (match.sport?.slug ?? 'football');
        const foundId = await Promise.race([
          ssMod.findSofaScoreEventId(match.homeTeam.name, match.awayTeam.name, kickoffMs, sportSsSlug),
          new Promise<null>(r => setTimeout(() => r(null), 3_000)),
        ]);
        if (foundId) {
          ssDetailsFallback = await ssMod.fetchSofaScoreEventDetails(foundId);
        }
      } catch {
        // Silently ignore — SofaScore is unavailable (403 on shared IPs)
      }
    }

    let lineups = summary ? buildLineups(summary) : null;
    // Merge SofaScore lineups when ESPN has none
    if (!lineups && ssDetailsFallback?.lineups) {
      lineups = ssDetailsFallback.lineups as typeof lineups;
    }

    let h2h = summary ? buildH2H(summary) : null;

    // Fallback: when ESPN's summary doesn't include H2H (common for smaller
    // leagues, cup ties or international fixtures), pull each team's recent
    // fixtures and look for direct meetings. Cache heavily — history never changes.
    if ((!h2h || h2h.length === 0) && cfg && summary) {
      const homeTeamId = summary.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.id;
      const awayTeamId = summary.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.id;
      if (homeTeamId && awayTeamId) {
        const h2hKey = `${cfg.sport}:${cfg.league}:${homeTeamId}:${awayTeamId}`;
        const cachedH2H = g.__h2hCache!.get(h2hKey);
        if (cachedH2H && now - cachedH2H.ts < H2H_CACHE_TTL) {
          h2h = cachedH2H.data;
        } else {
          h2h = await Promise.race([
            buildH2HFallback(
              cfg.sport, cfg.league,
              homeTeamId, awayTeamId,
              match.homeTeam.name, match.awayTeam.name,
            ),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 4_000)),
          ]);
          g.__h2hCache!.set(h2hKey, { data: h2h as H2HCache['data'], ts: now });
        }
      }
    }

    const standings = summary ? buildStandings(summary, cfg?.sport || 'soccer') : null;
    const news = summary ? buildNews(summary) : [];
    if (news.length > 0) {
      void upsertNewsArticles(news.map(article => ({
        id: String(article.id || ''),
        headline: article.headline || '',
        description: article.description || '',
        image: article.image || '',
        published: article.published || '',
        sourceUrl: article.link || '',
        source: article.source || 'ESPN',
      })));
    }
    const leaders = summary ? buildLeaders(summary) : [];
    const header = summary ? buildHeader(summary) : null;
    let teamStats = summary ? buildTeamStats(summary) : null;
    // Fallback to SofaScore statistics when ESPN has none
    if (!teamStats && ssDetailsFallback?.teamStats) {
      teamStats = ssDetailsFallback.teamStats as typeof teamStats;
    }

    // Extract home/away team IDs from header competitors for event attribution
    const competition = summary?.header?.competitions?.[0];
    const homeComp = competition?.competitors?.find(c => c.homeAway === 'home');
    const awayComp = competition?.competitors?.find(c => c.homeAway === 'away');
    let matchEvents = summary ? buildMatchEvents(summary, homeComp?.team?.id, awayComp?.team?.id) : [];
    // Fallback to SofaScore incidents (goals, cards, subs) when ESPN has none
    if (matchEvents.length === 0 && ssDetailsFallback?.matchEvents?.length) {
      matchEvents = ssDetailsFallback.matchEvents as typeof matchEvents;
    }
    const segmentBreakdown = summary ? buildSegmentBreakdown(summary, cfg?.sportType || 'soccer') : null;

    // Extract leg/round info from ESPN competition notes (e.g. "2nd Leg", "Leg 2 of 2", "Agg: 2-1")
    const compNotes = (competition as { notes?: Array<{ type?: string; headline?: string }> } | undefined)?.notes || [];
    const legNote = compNotes.find(n => /leg|round|tie|agg/i.test(n.headline || '') || /leg|round/i.test(n.type || ''));
    const legInfo: string | null = legNote?.headline || null;

    // Extract round name (Final, Semi-Final, Quarter-Final, Playoff, etc.) from notes / season slug
    const seasonSlug = (competition as { season?: { slug?: string } } | undefined)?.season?.slug || '';
    const ROUND_PATTERNS: Array<[RegExp, string]> = [
      [/\bfinal\b(?!.*\bsemi|\bquarter)/i, 'Final'],
      [/\bsemi.final\b|\bsemifinals?\b|\bsemifinale\b/i, 'Semi-Final'],
      [/\bquarter.final\b|\bquarterfinals?\b/i, 'Quarter-Final'],
      [/\bround.of.16\b|\blast.16\b/i, 'Round of 16'],
      [/\bround.of.32\b/i, 'Round of 32'],
      [/\bthird.place\b|\b3rd.place\b/i, 'Third Place'],
      [/\bpromotion.playoff\b/i, 'Promotion Playoff'],
      [/\brelegation.playoff\b/i, 'Relegation Playoff'],
      [/\bplayoff\b|\bplay.off\b/i, 'Playoff'],
    ];
    function detectRound(text: string): string | null {
      const t = text.toLowerCase();
      for (const [re, label] of ROUND_PATTERNS) { if (re.test(t)) return label; }
      return null;
    }
    const roundName: string | null =
      detectRound(seasonSlug) ||
      compNotes.reduce<string | null>((acc, n) => acc || detectRound(n.headline || ''), null);
    const aggRaw = legInfo || compNotes.map(n => n.headline || '').join(' ');
    const aggMatch = aggRaw.match(/agg(?:regate)?[:\s]+(\d+)[–\-](\d+)/i);
    const aggregateScore = aggMatch ? { home: parseInt(aggMatch[1]), away: parseInt(aggMatch[2]) } : null;

    const venue =
      summary?.gameInfo?.venue?.fullName ||
      match.venue ||
      undefined;
    const venueCity = summary?.gameInfo?.venue?.address?.city;
    const venueCountry = summary?.gameInfo?.venue?.address?.country;
    const attendance = summary?.gameInfo?.attendance;
    const broadcasts = (summary?.broadcasts || [])
      .map(b => b.media?.shortName)
      .filter((x): x is string => !!x);

    const payload = {
      match: {
        id: match.id,
        sportId: match.sportId,
        leagueId: match.leagueId,
        homeTeam: {
          ...match.homeTeam,
          form: header?.home?.form,
          record: header?.home?.record,
          // espnId used to build team profile URL
          espnTeamId: match.homeTeam.id,
          leagueSlug: cfg?.league?.replace(/[^a-z0-9]/gi, '') || '',
          // sport tag prevents cross-sport ESPN ID collisions in team URLs
          sportTag: teamSportTag,
        },
        awayTeam: {
          ...match.awayTeam,
          form: header?.away?.form,
          record: header?.away?.record,
          espnTeamId: match.awayTeam.id,
          leagueSlug: cfg?.league?.replace(/[^a-z0-9]/gi, '') || '',
          sportTag: teamSportTag,
        },
        kickoffTime: new Date(match.kickoffTime instanceof Date ? match.kickoffTime : match.kickoffTime as unknown as string).toISOString(),
        status: resolvedStatus,
        homeScore: resolvedHomeScore,
        awayScore: resolvedAwayScore,
        minute: resolvedMinute,
        period: match.period,
        league: match.league,
        sport: match.sport,
        odds: finalOdds,
        oddsIsComputed: !realOdds,
        markets: finalMarkets,
        venue,
        venueCity,
        venueCountry,
        attendance,
        broadcasts,
        source: match.source,
        legInfo,
        roundName,
        aggregateScore,
      },
      bookmakerOdds,
      lineups,
      h2h,
      standings,
      news,
      leaders,
      matchEvents,
      segmentBreakdown,
      teamStats,
      hasRealOdds: !!realOdds,
      hasLineups: !!lineups,
      hasStandings: !!standings,
      hasH2H: !!h2h && h2h.length > 0,
      hasEvents: matchEvents.length > 0,
      hasTeamStats: !!(teamStats && (teamStats.home.stats.length > 0 || teamStats.away.stats.length > 0)),
      timestamp: new Date().toISOString(),
    };

    // Store in cache (skip for live matches only if they have active minute ticking)
    g.__detailsCache!.set(cacheKey, { data: payload, ts: now });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[Match details] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch match details' }, { status: 500 });
  }
}
