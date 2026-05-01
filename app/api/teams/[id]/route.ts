import { NextRequest, NextResponse } from 'next/server';
import { getEspnLeagueConfigForId } from '@/lib/api/unified-sports-api';
import { ALL_LEAGUES } from '@/lib/sports-data';
import { listFollowersOfTeam } from '@/lib/follows-store';
import { extractNumericTeamId } from '@/lib/utils/slug';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

// Soccer country-prefix → top-flight league code. ESPN team slugs follow the
// `<country>.<abbrev>` convention (e.g. `fra.psg`, `eng.man_city`,
// `esp.real_madrid`), so once we read the slug from any team-detail
// payload we can deterministically map to the team's domestic league —
// which is the league we want as the canonical home page (PSG → Ligue 1,
// not UEFA Champions League).
const SOCCER_COUNTRY_TO_LEAGUE: Record<string, string> = {
  eng: 'eng.1', esp: 'esp.1', ita: 'ita.1', ger: 'ger.1', fra: 'fra.1',
  ned: 'ned.1', por: 'por.1', sco: 'sco.1', tur: 'tur.1', bel: 'bel.1',
  usa: 'usa.1', mex: 'mex.1',
  bra: 'bra.1', arg: 'arg.1', col: 'col.1', chi: 'chi.1',
  sau: 'sau.1', aus: 'aus.1', jpn: 'jpn.1', kor: 'kor.1',
  rus: 'rus.1', ukr: 'ukr.1', gre: 'gre.1', den: 'den.1', swe: 'swe.1',
  nor: 'nor.1', sui: 'sui.1', aut: 'aut.1', cze: 'cze.1', pol: 'pol.1',
  rou: 'rou.1', irl: 'irl.1', wal: 'wal.1', nir: 'nir.1',
  uae: 'uae.1', qat: 'qat.1', irn: 'irn.1', isr: 'isr.1',
  egy: 'egy.1', mar: 'mar.1', tun: 'tun.1', alg: 'alg.1', rsa: 'rsa.1',
  ken: 'ken.1', nga: 'nga.1', gha: 'gha.1', uga: 'uga.1', tan: 'tan.1', eth: 'eth.1',
  per: 'per.1', uru: 'uru.1', ven: 'ven.1', ecu: 'ecu.1', par: 'par.1',
  bol: 'bol.1', cri: 'crc.1', hon: 'hon.1', gua: 'gua.1', sal: 'slv.1',
  ind: 'ind.1', chn: 'chn.1', tha: 'tha.1', mly: 'mas.1', sgp: 'sgp.1',
};

// Soccer fallback domestic-league probe order (only used when the slug
// trick fails). Domestic before continental keeps PSG → Ligue 1.
// Women's leagues live alongside men's — without them, sides like Arsenal
// Women / Lyon Féminin / OL Féminin / NWSL clubs return "no upcoming matches"
// because we never even try fetching their schedule from the right league.
const TEAM_RESOLVER_CANDIDATES: Array<[string, string]> = [
  ['soccer', 'eng.1'], ['soccer', 'esp.1'], ['soccer', 'ita.1'], ['soccer', 'ger.1'], ['soccer', 'fra.1'],
  ['soccer', 'eng.2'], ['soccer', 'esp.2'], ['soccer', 'ita.2'], ['soccer', 'ger.2'], ['soccer', 'fra.2'],
  ['soccer', 'ned.1'], ['soccer', 'por.1'], ['soccer', 'sco.1'], ['soccer', 'tur.1'], ['soccer', 'bel.1'],
  ['soccer', 'usa.1'], ['soccer', 'usa.2'], ['soccer', 'mex.1'],
  ['soccer', 'bra.1'], ['soccer', 'arg.1'], ['soccer', 'col.1'], ['soccer', 'chi.1'],
  ['soccer', 'sau.1'], ['soccer', 'aus.1'], ['soccer', 'jpn.1'], ['soccer', 'kor.1'],
  // Women's top flights (matches `eng.w.1`, `usa.nwsl`, etc).
  ['soccer', 'eng.w.1'], ['soccer', 'esp.w.1'], ['soccer', 'ger.w.1'], ['soccer', 'fra.w.1'],
  ['soccer', 'ita.w.1'], ['soccer', 'usa.nwsl'], ['soccer', 'aus.w-league'],
  ['soccer', 'swe.w.1'], ['soccer', 'mex.w.1'],
  ['soccer', 'uefa.champions'], ['soccer', 'uefa.europa'], ['soccer', 'uefa.europa.conf'],
  ['soccer', 'uefa.nations'], ['soccer', 'uefa.euro'], ['soccer', 'uefa.wchampions'],
  ['soccer', 'concacaf.champions'], ['soccer', 'concacaf.gold'],
  ['soccer', 'conmebol.libertadores'], ['soccer', 'conmebol.sudamericana'], ['soccer', 'conmebol.america'],
  ['soccer', 'ken.1'], ['soccer', 'nga.1'], ['soccer', 'gha.1'], ['soccer', 'egy.1'], ['soccer', 'rsa.1'],
  ['soccer', 'caf.champions'], ['soccer', 'caf.cup_of_nations'],
  ['soccer', 'afc.champions'], ['soccer', 'afc.asian'],
  ['soccer', 'fifa.world'], ['soccer', 'fifa.wwc'], ['soccer', 'fifa.cwc'],
  ['basketball', 'nba'], ['basketball', 'wnba'], ['basketball', 'mens-college-basketball'],
  ['football', 'nfl'], ['football', 'college-football'],
  ['baseball', 'mlb'], ['hockey', 'nhl'],
];

// In-memory cache: <espnTeamId> → resolved {sport, league}. ESPN team ids are
// globally unique within a sport, so we cache permanently per worker.
const teamLeagueCache = new Map<string, { sport: string; league: string } | null>();

interface TeamProbeData {
  team?: {
    id?: string;
    slug?: string;
    leagueAbbrev?: string;
    defaultLeague?: { slug?: string; id?: string };
  };
}

async function probeTeam(sport: string, league: string, teamId: string): Promise<TeamProbeData | null> {
  const url = `${ESPN_BASE}/${sport}/${league}/teams/${teamId}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 86400 } });
    if (!r.ok) return null;
    const data = (await r.json()) as TeamProbeData;
    return data?.team?.id ? data : null;
  } catch {
    return null;
  }
}

// Confirm a team actually plays in a given league by hitting the league
// scoreboard and looking for the team id in any event. We use this when
// the team payload itself doesn't tell us the league (e.g. women's clubs
// whose slugs don't follow the `<country>.<abbr>` convention).
async function probeTeamInScoreboard(sport: string, league: string, teamId: string): Promise<boolean> {
  const url = `${ESPN_BASE}/${sport}/${league}/scoreboard?limit=300`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } });
    if (!r.ok) return false;
    const data = (await r.json()) as { events?: Array<{ competitions?: Array<{ competitors?: Array<{ team?: { id?: string } }> }> }> };
    for (const ev of data.events || []) {
      for (const comp of ev.competitions || []) {
        for (const c of comp.competitors || []) {
          if (c.team?.id === teamId) return true;
        }
      }
    }
  } catch { /* fall through */ }
  return false;
}

// Read the soccer team's `<country>.<abbrev>` slug and map it to the
// top-flight domestic league. Returns null when the slug doesn't follow
// that convention or the country isn't in the table.
function leagueFromSlug(slug?: string): string | null {
  if (!slug) return null;
  const dot = slug.indexOf('.');
  if (dot <= 0) return null;
  const country = slug.slice(0, dot).toLowerCase();
  return SOCCER_COUNTRY_TO_LEAGUE[country] ?? null;
}

async function resolveTeamSportLeague(
  espnTeamId: string,
  hint?: { sport: string; league: string },
): Promise<{ sport: string; league: string } | null> {
  const cached = teamLeagueCache.get(espnTeamId);
  if (cached !== undefined) return cached;

  // Strategy 1 (fast & accurate for soccer): fetch the team payload using
  // the hint (or any soccer league). ESPN IDs are globally unique per sport,
  // so ANY league context returns the correct team data.
  // We check `defaultLeague.slug` first — ESPN always sets this to the
  // team's actual domestic league (e.g. "nor.1" for Viking FK), making it
  // the most reliable source regardless of which league path we used.
  const probeSport = hint?.sport || 'soccer';
  const probeLeague = hint?.league || 'eng.1';
  const probed = await probeTeam(probeSport, probeLeague, espnTeamId);
  if (probed && probeSport === 'soccer') {
    // Prefer ESPN's own defaultLeague field — it's always the team's
    // real domestic league, avoiding slug-parsing edge cases (e.g. slugs
    // like "team.viking_fk" that don't follow the "nor.viking" convention).
    const defaultLeagueSlug = probed.team?.defaultLeague?.slug?.toLowerCase().trim() || probed.team?.leagueAbbrev?.toLowerCase().trim();
    if (defaultLeagueSlug && defaultLeagueSlug !== 'eng.1') {
      // Validate it's a known soccer league by checking the slug resolves
      const choice = { sport: 'soccer', league: defaultLeagueSlug };
      teamLeagueCache.set(espnTeamId, choice);
      return choice;
    }
    if (defaultLeagueSlug === 'eng.1') {
      // Could be a real English team OR a fallback. Check slug to confirm.
      const slug = probed.team?.slug || '';
      const domestic = leagueFromSlug(slug);
      if (domestic) {
        const choice = { sport: 'soccer', league: domestic };
        teamLeagueCache.set(espnTeamId, choice);
        return choice;
      }
      // No slug country prefix — trust defaultLeague
      const choice = { sport: 'soccer', league: 'eng.1' };
      teamLeagueCache.set(espnTeamId, choice);
      return choice;
    }
    // Fallback to slug-based resolution for teams that don't have defaultLeague
    const slug = probed.team?.slug || '';
    const domestic = leagueFromSlug(slug);
    if (domestic) {
      const choice = { sport: 'soccer', league: domestic };
      teamLeagueCache.set(espnTeamId, choice);
      return choice;
    }
    // Women's clubs use slugs like `arsenal_women` / `chelsea_w` which
    // have no country prefix. Confirm membership by probing each women's
    // league's scoreboard until we find a match referencing this team.
    if (/(_women$|_w$|women)/i.test(slug)) {
      const womensLeagues = ['eng.w.1', 'esp.w.1', 'ger.w.1', 'fra.w.1', 'ita.w.1', 'usa.nwsl', 'aus.w-league', 'swe.w.1', 'mex.w.1'];
      for (const wl of womensLeagues) {
        const found = await probeTeamInScoreboard('soccer', wl, espnTeamId);
        if (found) {
          const choice = { sport: 'soccer', league: wl };
          teamLeagueCache.set(espnTeamId, choice);
          return choice;
        }
      }
      // Last-resort: assume WSL when slug contains "women" but no match
      // surfaced (off-season, no recent fixtures cached).
      const choice = { sport: 'soccer', league: 'eng.w.1' };
      teamLeagueCache.set(espnTeamId, choice);
      return choice;
    }
  }
  if (probed && hint) {
    teamLeagueCache.set(espnTeamId, hint);
    return hint;
  }

  // Strategy 2 (fallback): probe candidates in priority order. Used when
  // the slug doesn't match our country table (rare leagues), or when the
  // hint sport isn't soccer.
  const BATCH = 8;
  for (let i = 0; i < TEAM_RESOLVER_CANDIDATES.length; i += BATCH) {
    const batch = TEAM_RESOLVER_CANDIDATES.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async ([sport, league]) => {
        const data = await probeTeam(sport, league, espnTeamId);
        if (!data) return null;
        if (sport === 'soccer') {
          const domestic = leagueFromSlug(data.team?.slug);
          if (domestic) return { sport: 'soccer', league: domestic };
        }
        return { sport, league };
      }),
    );
    const hit = results.find((r): r is { sport: string; league: string } => !!r);
    if (hit) {
      teamLeagueCache.set(espnTeamId, hit);
      return hit;
    }
  }

  teamLeagueCache.set(espnTeamId, null);
  return null;
}

function parseTeamId(teamId: string): { sport: string; league: string; espnTeamId: string; leagueId?: number } | null {
  // Legacy shape: espn_<league>_<id>
  const espn = teamId.match(/^espn_([a-z0-9.]+)_(\d+)$/i);
  if (espn) {
    const leagueSlug = espn[1];
    const espnTeamId = espn[2];
    const fake = `espn_${leagueSlug}_999999`;
    const cfg = getEspnLeagueConfigForId(fake);
    if (cfg) return { sport: cfg.sport, league: cfg.league, espnTeamId, leagueId: cfg.leagueId };
  }
  // New canonical shape: <slug>-<id> OR bare <id>.
  const numeric = extractNumericTeamId(teamId);
  if (numeric) {
    // Sport/league are unknown at parse time — caller must resolve.
    return { sport: '', league: '', espnTeamId: numeric };
  }
  return null;
}

// football-data.org team IDs come through match feeds as `fd_team_<id>`
// (see lib/api/football-data-org.ts). They aren't ESPN ids, so we resolve
// them to an ESPN team by fetching the FD team's name/short name and
// searching ESPN's site search. Result is cached so we only pay this once.
const fdTeamCache = new Map<string, { espnId: string; name: string; slug: string } | null>();
async function resolveFdTeamId(fdId: string): Promise<{ espnId: string; name: string; slug: string } | null> {
  const cached = fdTeamCache.get(fdId);
  if (cached !== undefined) return cached;

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    fdTeamCache.set(fdId, null);
    return null;
  }
  // Step 1: get team name from football-data.org
  let teamName: string | null = null;
  let shortName: string | null = null;
  try {
    const r = await fetch(`https://api.football-data.org/v4/teams/${fdId}`, {
      headers: { 'X-Auth-Token': apiKey, Accept: 'application/json' },
      next: { revalidate: 86400 },
    });
    if (r.ok) {
      const data = (await r.json()) as { name?: string; shortName?: string };
      teamName = data.name || null;
      shortName = data.shortName || null;
    }
  } catch { /* fall through */ }

  if (!teamName) {
    fdTeamCache.set(fdId, null);
    return null;
  }

  // Step 2: search ESPN for that name. ESPN has a sport-search endpoint
  // that returns matching teams — we pick the top "team" hit.
  type EspnSearchResult = {
    results?: Array<{
      type?: string;
      contents?: Array<{ type?: string; uid?: string; id?: string; displayName?: string }>;
    }>;
  };
  const candidates = [teamName, shortName].filter((s): s is string => !!s);
  for (const name of candidates) {
    try {
      const url = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=10&type=team`;
      const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 86400 } });
      if (!r.ok) continue;
      const data = (await r.json()) as EspnSearchResult;
      for (const cat of data.results || []) {
        for (const c of cat.contents || []) {
          if (c.type !== 'team') continue;
          // ESPN search puts a GUID in `id`. The numeric team id we
          // actually need is encoded in `uid` as "s:<sportId>~t:<teamId>".
          const uidMatch = c.uid?.match(/t:(\d+)/);
          const numericId = uidMatch?.[1];
          if (!numericId) continue;
          const slug = (c.displayName || teamName)
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]+/g, ' ')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
          const result = { espnId: numericId, name: c.displayName || teamName, slug };
          fdTeamCache.set(fdId, result);
          return result;
        }
      }
    } catch { /* try next name variant */ }
  }

  fdTeamCache.set(fdId, null);
  return null;
}

async function fetchTeamInfo(sport: string, league: string, teamId: string) {
  const url = `${ESPN_BASE}/${sport}/${league}/teams/${teamId}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchTeamSchedule(sport: string, league: string, teamId: string) {
  // ESPN's /schedule returns the team's season-to-date games, but for many
  // sports (especially soccer) it omits future fixtures. To surface
  // *upcoming* matches we ALSO probe the league scoreboard across the next
  // 35 days in 7-day windows and keep events involving this team.
  const year = new Date().getUTCFullYear();
  const today = new Date();
  const fmt = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const dateWindows: string[] = [];
  for (let offset = 0; offset < 35; offset += 7) {
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() + offset);
    const end = new Date(today);
    end.setUTCDate(today.getUTCDate() + offset + 7);
    dateWindows.push(`${fmt(start)}-${fmt(end)}`);
  }

  // For soccer, also probe major continental cups so a club's UCL/UEL/Copa
  // Libertadores/Copa Sudamericana/etc. fixtures surface alongside its
  // domestic-league schedule. ESPN scoreboard endpoints return ALL events
  // for that league in the date window, and we filter to ones involving
  // this team further down.
  const SOCCER_CONTINENTAL_LEAGUES = [
    'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'uefa.super_cup',
    'uefa.nations', 'uefa.euro', 'uefa.euroq',
    'fifa.world', 'fifa.cwc', 'fifa.worldq.uefa', 'fifa.worldq.conmebol',
    'fifa.worldq.concacaf', 'fifa.worldq.afc', 'fifa.worldq.caf',
    'conmebol.libertadores', 'conmebol.sudamericana', 'conmebol.america',
    'concacaf.champions', 'concacaf.gold', 'concacaf.nations.league',
    'caf.champions', 'caf.confed', 'caf.cup_of_nations',
    'afc.champions', 'afc.asian',
    // Domestic cups for the most-watched leagues — adds FA Cup, Copa del Rey,
    // Coupe de France, Coppa Italia, DFB Pokal goals when applicable.
    'eng.fa', 'eng.league_cup', 'esp.copa_del_rey', 'fra.coupe_de_france',
    'ita.coppa_italia', 'ger.dfb_pokal',
  ];
  // Women's continental + women's-specific cups. Probed when the team
  // resolved to a women's domestic league so we surface UWCL fixtures
  // and women's international cups for clubs like Arsenal Women.
  const SOCCER_WOMENS_LEAGUES = [
    'uefa.wchampions', 'fifa.wwc', 'concacaf.wchampions', 'eng.w.fa',
  ];
  const isWomens = /\.w\./.test(league) || league === 'usa.nwsl' || league.startsWith('aus.w');
  const continentalLeagues = sport === 'soccer'
    ? [...SOCCER_CONTINENTAL_LEAGUES, ...(isWomens ? SOCCER_WOMENS_LEAGUES : [])].filter(l => l !== league)
    : [];

  const candidates = [
    `${ESPN_BASE}/${sport}/${league}/teams/${teamId}/schedule`,
    `${ESPN_BASE}/${sport}/${league}/teams/${teamId}/schedule?season=${year}`,
    `${ESPN_BASE}/${sport}/${league}/teams/${teamId}/schedule?season=${year + 1}`,
    `${ESPN_BASE}/${sport}/${league}/teams/${teamId}/schedule?season=${year - 1}`,
    ...dateWindows.map(w => `${ESPN_BASE}/${sport}/${league}/scoreboard?dates=${w}`),
    // Also probe continental/cup competitions across the same date windows.
    ...continentalLeagues.flatMap(l =>
      dateWindows.map(w => `${ESPN_BASE}/${sport}/${l}/scoreboard?dates=${w}`)
    ),
  ];
  type ScheduleResp = { events?: Array<{ id?: string; competitions?: Array<{ competitors?: Array<{ team?: { id?: string } }> }> }> } & Record<string, unknown>;
  // Extract the league key from the URL so we can tag each event with the
  // competition it actually came from. Without this, a UCL fixture would
  // get linked as `espn_<domesticLeague>_<eventId>` and 404 on click.
  const leagueFromUrl = (url: string): string => {
    // Both .../{sport}/{league}/teams/... and .../{sport}/{league}/scoreboard...
    const m = url.match(new RegExp(`/${sport}/([^/]+)/`));
    return m?.[1] || league;
  };
  const results = await Promise.all(
    candidates.map(async (url) => {
      try {
        const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
        if (!r.ok) return { url, data: null as ScheduleResp | null };
        return { url, data: (await r.json()) as ScheduleResp };
      } catch { return { url, data: null }; }
    })
  );
  const merged: { events: unknown[] } & Record<string, unknown> = { events: [] };
  const seen = new Set<string>();
  for (const { url, data } of results) {
    if (!data) continue;
    const isScoreboard = url.includes('/scoreboard');
    const sourceLeague = leagueFromUrl(url);
    for (const ev of (data.events || [])) {
      if (!ev?.id || seen.has(ev.id)) continue;
      // Scoreboard endpoints return ALL league events for that date window —
      // only keep ones involving the requested team.
      if (isScoreboard) {
        const competitors = ev.competitions?.[0]?.competitors || [];
        const involves = competitors.some(c => c?.team?.id === teamId);
        if (!involves) continue;
      }
      seen.add(ev.id);
      // Stamp the source league onto the event so the caller can build the
      // correct internal match link (`espn_<sourceLeague>_<eventId>`).
      (ev as { _sourceLeague?: string })._sourceLeague = sourceLeague;
      merged.events.push(ev);
    }
  }
  return merged.events.length > 0 ? merged : null;
}

async function fetchTeamCoach(sport: string, league: string, teamId: string): Promise<string | undefined> {
  // ESPN coaches endpoint isn't always available, but worth trying for soccer/NFL/NBA.
  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/teams/${teamId}/coaches?lang=en`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 86400 } });
    if (!r.ok) return undefined;
    type CoachIndex = { items?: Array<{ $ref?: string }> };
    const data = (await r.json()) as CoachIndex;
    const ref = data.items?.[0]?.$ref;
    if (!ref) return undefined;
    const sub = await fetch(ref, { headers: { Accept: 'application/json' }, next: { revalidate: 86400 } });
    if (!sub.ok) return undefined;
    type CoachDetail = { firstName?: string; lastName?: string; displayName?: string };
    const c = (await sub.json()) as CoachDetail;
    return c.displayName || [c.firstName, c.lastName].filter(Boolean).join(' ') || undefined;
  } catch { return undefined; }
}

async function fetchTeamRoster(sport: string, league: string, teamId: string) {
  const url = `${ESPN_BASE}/${sport}/${league}/teams/${teamId}/roster`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 600 } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchTeamInjuries(sport: string, league: string, teamId: string) {
  const url = `${ESPN_BASE}/${sport}/${league}/teams/${teamId}/injuries`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 600 } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function mapStatus(state: string, completed: boolean): string {
  if (state === 'in') return 'live';
  if (completed || state === 'post') return 'finished';
  return 'scheduled';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Resolve `fd_team_<id>` (football-data.org) URLs to a real ESPN id so
  // the team page works when a user landed here from a football-data
  // sourced match. We just swap the id and let the rest of the resolver
  // run normally — the response includes `team.canonicalId` and the page
  // does a router.replace to the SEO URL.
  let workingId = id;
  const fdMatch = id.match(/^fd_team_(\d+)$/i);
  if (fdMatch) {
    const resolved = await resolveFdTeamId(fdMatch[1]);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Could not match this football-data team to an ESPN team' },
        { status: 404 },
      );
    }
    workingId = `${resolved.slug}-${resolved.espnId}`;
  }

  const parsed = parseTeamId(workingId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid team ID format' }, { status: 400 });
  }

  // For the new canonical shape (`<slug>-<id>`), parsed.sport/league are
  // empty and we must probe ESPN to figure out the team's primary league.
  // For the legacy shape we still probe to find a *better* (more domestic)
  // league when the URL came in via a continental cup. The result is cached
  // in-process so subsequent hits don't pay the resolver tax.
  const hint = parsed.sport && parsed.league
    ? { sport: parsed.sport, league: parsed.league }
    : undefined;
  const resolved = await resolveTeamSportLeague(parsed.espnTeamId, hint);
  if (!resolved) {
    return NextResponse.json({ error: 'Team not found in any known league' }, { status: 404 });
  }
  const { sport, league } = resolved;
  const { espnTeamId } = parsed;

  // Re-derive leagueId/leagueRow from the *resolved* league (not the URL hint),
  // so PSG always shows "Ligue 1" even when reached via a UCL link.
  const fakeId = `espn_${league}_999999`;
  const resolvedCfg = getEspnLeagueConfigForId(fakeId);
  const resolvedLeagueId = resolvedCfg?.leagueId ?? parsed.leagueId;

  const [teamData, scheduleData, rosterData, injuriesData, coachName, followers] = await Promise.all([
    fetchTeamInfo(sport, league, espnTeamId),
    fetchTeamSchedule(sport, league, espnTeamId),
    fetchTeamRoster(sport, league, espnTeamId),
    fetchTeamInjuries(sport, league, espnTeamId),
    fetchTeamCoach(sport, league, espnTeamId),
    listFollowersOfTeam(espnTeamId).catch(() => [] as number[]),
  ]);

  if (!teamData?.team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const t = teamData.team;

  // League / country lookup using the *resolved* league id (not the URL hint).
  const leagueRow = ALL_LEAGUES.find(l => l.id === resolvedLeagueId);

  // Find the official website link if ESPN exposed one.
  type RawLink = { rel?: string[]; href?: string; text?: string };
  const links = (t.links || []) as RawLink[];
  const officialSite =
    links.find(l => l.rel?.includes('teamsite') || l.rel?.includes('externalLink'))?.href ||
    links.find(l => /official/i.test(l.text || ''))?.href;
  const espnLink = links.find(l => l.rel?.includes('clubhouse'))?.href;

  // ESPN's `standingSummary` is usually a string like "1st in English Premier League"
  // OR just "11th" depending on the endpoint. We split it so the UI can render
  // the position and the actual competition it refers to clearly. When ESPN
  // returns just a bare position with no league name, we fall back to the
  // league derived from the URL (which is the competition the team was
  // queried under — e.g. Champions League if you opened the team via the CL
  // page). This fixes the "PSG showing 11th in EPL" mislabel by NEVER assuming
  // the position belongs to the team's domestic league.
  const rawStanding = (t.standingSummary || '').trim();
  let standingPosition: string | undefined;
  let standingCompetition: string | undefined;
  if (rawStanding) {
    const m = rawStanding.match(/^(.+?)\s+in\s+(.+)$/i);
    if (m) {
      standingPosition = m[1].trim();
      standingCompetition = m[2].trim();
    } else {
      standingPosition = rawStanding;
      standingCompetition = leagueRow?.name;
    }
  }

  // Canonical SEO id = `<slug>-<espnTeamId>`. Used by callers to redirect
  // legacy URLs (e.g. `espn_uefa.champions_160`) to the canonical page.
  const teamName = t.displayName || t.name || '';
  const slugify = (s: string) => s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const nameSlug = slugify(teamName);
  const canonicalId = nameSlug ? `${nameSlug}-${t.id}` : String(t.id);

  const team = {
    id: t.id,
    canonicalId,
    canonicalHref: `/teams/${canonicalId}`,
    name: t.displayName || t.name,
    shortName: t.abbreviation,
    nickname: t.nickname || t.shortDisplayName,
    logo: t.logos?.[0]?.href,
    color: t.color ? `#${t.color}` : undefined,
    alternateColor: t.alternateColor ? `#${t.alternateColor}` : undefined,
    location: t.location,
    venue: t.franchise?.venue?.fullName || t.venue?.fullName,
    venueCity: t.franchise?.venue?.address?.city || t.venue?.address?.city,
    founded: t.franchise?.yearFounded,
    manager: coachName,
    league: leagueRow?.name,
    leagueSlug: leagueRow?.slug,
    country: leagueRow?.country,
    countryCode: leagueRow?.countryCode,
    website: officialSite,
    description: [
      rawStanding,
      t.location && t.franchise?.venue?.fullName
        ? `Plays home matches at ${t.franchise.venue.fullName} in ${t.franchise.venue.address?.city || t.location}.`
        : null,
    ].filter(Boolean).join(' ') || undefined,
    record: t.record?.items?.find((r: { type?: string }) => r.type === 'total')?.summary,
    standing: {
      position: standingPosition,
      competition: standingCompetition,
      raw: rawStanding || undefined,
    },
    links: {
      espn: espnLink,
      official: officialSite,
    },
  };

  // ESPN's team /schedule endpoint nests status, score, and logo deeply,
  // and the score field is an object `{ value, displayValue }` — not a string.
  // We normalise everything here so the team page always sees rich, real data.
  type CompTeam = { id: string; displayName?: string; abbreviation?: string; logo?: string; logos?: Array<{ href?: string; rel?: string[] }> };
  type CompScore = string | number | { value?: number; displayValue?: string };
  type Competitor = {
    homeAway: string;
    team?: CompTeam;
    score?: CompScore;
    winner?: boolean;
    records?: Array<{ type?: string; summary?: string }>;
  };
  type RawEvent = {
    id: string;
    date: string;
    name?: string;
    shortName?: string;
    status?: { type?: { state?: string; completed?: boolean } };
    season?: { type?: number; year?: number; slug?: string };
    league?: { abbreviation?: string; name?: string };
    competitions?: Array<{
      status?: { type?: { state?: string; completed?: boolean } };
      competitors?: Competitor[];
      odds?: Array<{
        details?: string;
        moneyline?: { home?: { close?: { odds?: string } }; away?: { close?: { odds?: string } }; draw?: { close?: { odds?: string } } };
        homeTeamOdds?: { moneyLine?: number };
        awayTeamOdds?: { moneyLine?: number };
        drawOdds?: { moneyLine?: number };
        provider?: { displayName?: string };
      }>;
      venue?: { fullName?: string };
    }>;
    _sourceLeague?: string;
  };

  // Pretty competition labels for the most common ESPN league keys. Used to
  // tag each fixture on the team page so a Champions League match shows
  // "UCL" / "Champions League" instead of being lumped under Ligue 1.
  const COMP_LABEL: Record<string, { short: string; full: string }> = {
    'uefa.champions': { short: 'UCL', full: 'Champions League' },
    'uefa.europa': { short: 'UEL', full: 'Europa League' },
    'uefa.europa.conf': { short: 'UECL', full: 'Conference League' },
    'uefa.super_cup': { short: 'Super Cup', full: 'UEFA Super Cup' },
    'uefa.nations': { short: 'UNL', full: 'Nations League' },
    'uefa.euro': { short: 'EURO', full: 'UEFA Euro' },
    'uefa.euroq': { short: 'EURO Q', full: 'Euro Qualifiers' },
    'fifa.world': { short: 'WC', full: 'FIFA World Cup' },
    'fifa.cwc': { short: 'CWC', full: 'Club World Cup' },
    'conmebol.libertadores': { short: 'Libertadores', full: 'Copa Libertadores' },
    'conmebol.sudamericana': { short: 'Sudamericana', full: 'Copa Sudamericana' },
    'concacaf.champions': { short: 'CCL', full: 'CONCACAF Champions Cup' },
    'caf.champions': { short: 'CAF CL', full: 'CAF Champions League' },
    'afc.champions': { short: 'ACL', full: 'AFC Champions League' },
    'eng.fa': { short: 'FA Cup', full: 'FA Cup' },
    'eng.league_cup': { short: 'EFL Cup', full: 'EFL Cup' },
    'esp.copa_del_rey': { short: 'Copa', full: 'Copa del Rey' },
    'fra.coupe_de_france': { short: 'Coupe', full: 'Coupe de France' },
    'ita.coppa_italia': { short: 'Coppa', full: 'Coppa Italia' },
    'ger.dfb_pokal': { short: 'Pokal', full: 'DFB-Pokal' },
  };

  const readScore = (s: CompScore | undefined): number | null => {
    if (s === undefined || s === null) return null;
    if (typeof s === 'number') return s;
    if (typeof s === 'string') {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof s.value === 'number') return s.value;
    if (s.displayValue) {
      const n = parseInt(s.displayValue, 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const pickLogo = (t?: CompTeam): string | undefined => {
    if (!t) return undefined;
    if (t.logo) return t.logo;
    return t.logos?.find(l => l.rel?.includes('default') || l.rel?.includes('full'))?.href || t.logos?.[0]?.href;
  };

  const events = (scheduleData?.events || []).map((ev: RawEvent) => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    const away = comp?.competitors?.find(c => c.homeAway === 'away');
    // Status lives on `competitions[0].status` (rich) but ESPN may also leave
    // a partial copy on the event itself. Try competition first.
    const statusType = comp?.status?.type || ev.status?.type;
    const statusState = statusType?.state || 'pre';
    const statusCompleted = !!statusType?.completed;
    const isHome = home?.team?.id === espnTeamId;
    const opponent = isHome ? away : home;
    const teamComp = isHome ? home : away;
    const opponentComp = isHome ? away : home;

    // Extract odds
    const rawOdds = comp?.odds?.[0];
    let odds: { home?: number; draw?: number; away?: number } | undefined;
    if (rawOdds) {
      const parseAmerican = (v?: string | number) => {
        if (v === undefined || v === null || v === '') return undefined;
        const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.\-+]/g, '')) : v;
        if (!isFinite(n) || n === 0) return undefined;
        const d = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
        return Math.round(d * 100) / 100;
      };
      const h = parseAmerican(rawOdds.moneyline?.home?.close?.odds ?? rawOdds.homeTeamOdds?.moneyLine);
      const a = parseAmerican(rawOdds.moneyline?.away?.close?.odds ?? rawOdds.awayTeamOdds?.moneyLine);
      const d = parseAmerican(rawOdds.moneyline?.draw?.close?.odds ?? rawOdds.drawOdds?.moneyLine);
      if (h && a) odds = { home: h, away: a, draw: d };
    }

    const teamScore = readScore(teamComp?.score);
    const oppScore = readScore(opponentComp?.score);
    const status = mapStatus(statusState, statusCompleted);

    const sourceLeague = ev._sourceLeague || parsed.league || league;
    const competition = COMP_LABEL[sourceLeague];
    return {
      id: `espn_${sourceLeague.replace(/[^a-z0-9]/gi, '')}_${ev.id}`,
      espnEventId: ev.id,
      competition: competition?.short,
      competitionFull: competition?.full,
      sourceLeague,
      date: ev.date,
      name: ev.shortName || ev.name,
      status,
      isHome,
      opponent: opponent?.team ? {
        id: opponent.team.id,
        name: opponent.team.displayName,
        shortName: opponent.team.abbreviation,
        logo: pickLogo(opponent.team),
      } : null,
      score: teamScore !== null && oppScore !== null ? {
        team: teamScore,
        opponent: oppScore,
      } : null,
      result: statusCompleted
        ? (teamComp?.winner === true ? 'W' : opponentComp?.winner === true ? 'L' : 'D')
        : null,
      venue: comp?.venue?.fullName,
      odds: isHome ? odds : odds ? { home: odds.away, draw: odds.draw, away: odds.home } : undefined,
    };
  });

  // Sort by date so "past" is most-recent-first and "upcoming" is soonest-first.
  type EventOut = (typeof events)[number];
  const byDateAsc = (a: EventOut, b: EventOut) => new Date(a.date).getTime() - new Date(b.date).getTime();
  const byDateDesc = (a: EventOut, b: EventOut) => new Date(b.date).getTime() - new Date(a.date).getTime();
  const past = events
    .filter((e: EventOut) => e.status === 'finished')
    .sort(byDateDesc)
    .slice(0, 12);
  const upcoming = events
    .filter((e: EventOut) => e.status === 'scheduled' || e.status === 'live')
    .sort(byDateAsc)
    .slice(0, 12);

  // ----- Roster (multiple ESPN response shapes: athletes:[…] or athletes:[{position, items:[…]}]) -----
  type RawAthlete = {
    id?: string;
    fullName?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    jersey?: string;
    age?: number;
    height?: number;
    weight?: number;
    headshot?: { href?: string } | string;
    position?: { abbreviation?: string; name?: string; displayName?: string };
    status?: { name?: string; type?: string };
    flag?: { href?: string; alt?: string };
    citizenship?: string;
  };
  const rawAthletes: RawAthlete[] = [];
  const rosterAthletes = rosterData?.athletes;
  if (Array.isArray(rosterAthletes)) {
    for (const group of rosterAthletes) {
      if (group?.items && Array.isArray(group.items)) {
        for (const a of group.items) rawAthletes.push(a);
      } else if (group?.id || group?.fullName || group?.displayName) {
        rawAthletes.push(group);
      }
    }
  }
  const roster = rawAthletes.map(a => {
    const headshotUrl = typeof a.headshot === 'string' ? a.headshot : a.headshot?.href;
    return {
      id: a.id,
      name: a.fullName || a.displayName || `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim(),
      jersey: a.jersey,
      position: a.position?.abbreviation || a.position?.displayName || a.position?.name,
      age: a.age,
      height: a.height,
      weight: a.weight,
      headshot: headshotUrl,
      country: a.citizenship,
      flag: a.flag?.href,
      status: a.status?.name || a.status?.type,
    };
  });

  // ----- Injuries -----
  type RawInjury = {
    athlete?: { id?: string; displayName?: string; headshot?: { href?: string } | string; position?: { abbreviation?: string } };
    type?: { description?: string; abbreviation?: string };
    status?: string;
    details?: { type?: string; location?: string; detail?: string; returnDate?: string };
    date?: string;
    longComment?: string;
    shortComment?: string;
  };
  const rawInjuries: RawInjury[] = [];
  const injuryGroups = injuriesData?.injuries;
  if (Array.isArray(injuryGroups)) {
    for (const g of injuryGroups) {
      if (Array.isArray(g?.injuries)) for (const i of g.injuries) rawInjuries.push(i);
      else if (g?.athlete) rawInjuries.push(g);
    }
  }
  const injuries = rawInjuries.map(i => {
    const head = typeof i.athlete?.headshot === 'string' ? i.athlete.headshot : i.athlete?.headshot?.href;
    return {
      playerId: i.athlete?.id,
      playerName: i.athlete?.displayName,
      headshot: head,
      position: i.athlete?.position?.abbreviation,
      status: i.status,
      type: i.type?.description || i.details?.type,
      location: i.details?.location,
      detail: i.details?.detail || i.shortComment,
      returnDate: i.details?.returnDate,
      reportedAt: i.date,
    };
  });

  return NextResponse.json({
    team,
    past,
    upcoming,
    roster,
    injuries,
    followersCount: followers.length,
    league: { sport, league },
    timestamp: new Date().toISOString(),
  });
}
