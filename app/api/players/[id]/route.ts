import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ESPNAthlete {
  id?: string | number;
  uid?: string;
  guid?: string;
  type?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  displayName?: string;
  shortName?: string;
  weight?: number;
  displayWeight?: string;
  height?: number;
  displayHeight?: string;
  age?: number;
  dateOfBirth?: string;
  birthPlace?: { city?: string; country?: string };
  citizenship?: string;
  jersey?: string;
  position?: { id?: string; name?: string; displayName?: string; abbreviation?: string };
  team?: { id?: string; displayName?: string; logos?: Array<{ href?: string }> };
  headshot?: { href?: string; alt?: string };
  status?: { name?: string };
  experience?: { years?: number };
  flag?: { href?: string; alt?: string };
}

interface ESPNAthleteResponse {
  athlete?: ESPNAthlete;
  statistics?: { splits?: { categories?: Array<{ name?: string; displayName?: string; stats?: Array<{ name?: string; displayName?: string; displayValue?: string; value?: number }> }> } };
  // Some endpoints wrap in a different shape — keep both.
}

// Broad soccer league probe: ESPN doesn't expose a single global "soccer
// athlete" endpoint, so when the cheap probes fail we fan out across every
// soccer league we surface anywhere in the app. This kept top-scorer clicks
// returning 404s for World Cup / Saudi / Brazilian / Dutch / Portuguese
// players because those leagues weren't in the original short list.
const SPORT_PATHS = [
  // Top tier soccer leagues + UEFA + CONMEBOL + global tournaments.
  'soccer/eng.1', 'soccer/esp.1', 'soccer/ita.1', 'soccer/ger.1', 'soccer/fra.1',
  'soccer/eng.2', 'soccer/esp.2', 'soccer/ita.2', 'soccer/ger.2', 'soccer/fra.2',
  'soccer/ned.1', 'soccer/por.1', 'soccer/sco.1', 'soccer/tur.1', 'soccer/bel.1',
  'soccer/aut.1', 'soccer/sui.1', 'soccer/gre.1', 'soccer/rus.1', 'soccer/ukr.1',
  'soccer/usa.1', 'soccer/usa.2', 'soccer/mex.1', 'soccer/mex.2', 'soccer/can.1',
  'soccer/bra.1', 'soccer/arg.1', 'soccer/col.1', 'soccer/chi.1', 'soccer/uru.1',
  'soccer/ksa.1', 'soccer/aus.1', 'soccer/jpn.1', 'soccer/kor.1', 'soccer/chn.1',
  'soccer/uefa.champions', 'soccer/uefa.europa', 'soccer/uefa.europa.conf',
  'soccer/uefa.nations', 'soccer/uefa.euro',
  'soccer/conmebol.libertadores', 'soccer/conmebol.sudamericana', 'soccer/conmebol.america',
  'soccer/concacaf.champions', 'soccer/concacaf.gold',
  'soccer/caf.champions', 'soccer/caf.cup_of_nations',
  'soccer/afc.champions', 'soccer/afc.asian',
  'soccer/fifa.world', 'soccer/fifa.wwc', 'soccer/fifa.world.u20', 'soccer/fifa.world.u17',
  'soccer/fifa.cwc', 'soccer/fifa.intercontinental',
  // Other team sports.
  'basketball/nba', 'basketball/wnba', 'basketball/mens-college-basketball',
  'basketball/euroleague', 'basketball/fiba.world',
  'football/nfl', 'football/college-football',
  'baseball/mlb', 'hockey/nhl',
  'mma/ufc', 'tennis/atp', 'tennis/wta',
  'cricket/ipl', 'cricket/odi.world', 'rugby/rwc',
];

async function fetchAthlete(sportPath: string, id: string): Promise<ESPNAthlete | null> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/athletes/${id}`;
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as ESPNAthleteResponse;
    return data.athlete ?? null;
  } catch {
    return null;
  }
}

// Fallback: ESPN's "core" athlete endpoint that doesn't require a league
// in the path — works for many soccer/basketball athletes that aren't on
// any league roster right now (transfers, retired, U-team callups, etc).
async function fetchCoreAthlete(sport: string, id: string): Promise<ESPNAthlete | null> {
  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/athletes/${id}?lang=en`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
    if (!r.ok) return null;
    type CoreAthlete = ESPNAthlete & { headshot?: { href?: string } | string };
    const data = (await r.json()) as CoreAthlete;
    if (!data?.id) return null;
    if (typeof data.headshot === 'string') {
      data.headshot = { href: data.headshot };
    }
    return data as ESPNAthlete;
  } catch {
    return null;
  }
}

async function fetchAthleteStats(sportPath: string, id: string) {
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/${sportPath}/athletes/${id}/stats`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Recent match log — ESPN exposes this via the /gamelog endpoint and it
// powers the "Recent matches" section on the player profile.
interface AthleteGameLogEvent {
  date?: string;
  opponent?: { displayName?: string; abbreviation?: string; logo?: string };
  homeAwaySymbol?: string;
  team?: { displayName?: string; logo?: string };
  result?: string;
  score?: string;
  stats?: Array<{ name?: string; displayName?: string; value?: number; displayValue?: string }>;
}
interface AthleteGameLogResponse {
  events?: Record<string, AthleteGameLogEvent>;
  seasonTypes?: Array<{
    categories?: Array<{ events?: Array<{ eventId?: string; stats?: string[] }>; type?: string }>;
  }>;
  labels?: string[];
  names?: string[];
}

async function fetchAthleteGameLog(sportPath: string, id: string): Promise<AthleteGameLogResponse | null> {
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/${sportPath}/athletes/${id}/gamelog`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return (await r.json()) as AthleteGameLogResponse;
  } catch {
    return null;
  }
}

interface NormalisedGameLogRow {
  date?: string;
  opponent?: { name?: string; abbr?: string; logo?: string };
  homeAway?: 'home' | 'away';
  result?: string;
  score?: string;
  stats: Record<string, string>;
  competition?: string;
  competitionShort?: string;
}

// Map ESPN sport paths to human-readable competition names.
const COMPETITION_LABELS: Record<string, { name: string; short: string }> = {
  'soccer/eng.1': { name: 'Premier League', short: 'PL' },
  'soccer/esp.1': { name: 'La Liga', short: 'LaLiga' },
  'soccer/ita.1': { name: 'Serie A', short: 'SA' },
  'soccer/ger.1': { name: 'Bundesliga', short: 'BL' },
  'soccer/fra.1': { name: 'Ligue 1', short: 'L1' },
  'soccer/ned.1': { name: 'Eredivisie', short: 'ERE' },
  'soccer/por.1': { name: 'Primeira Liga', short: 'PPL' },
  'soccer/sco.1': { name: 'Scottish Prem', short: 'SP' },
  'soccer/tur.1': { name: 'Süper Lig', short: 'SL' },
  'soccer/ksa.1': { name: 'Saudi Pro', short: 'SPL' },
  'soccer/bra.1': { name: 'Brasileirão', short: 'BRA' },
  'soccer/arg.1': { name: 'Liga Pro', short: 'ARG' },
  'soccer/mex.1': { name: 'Liga MX', short: 'MX' },
  'soccer/usa.1': { name: 'MLS', short: 'MLS' },
  'soccer/uefa.champions': { name: 'Champions League', short: 'UCL' },
  'soccer/uefa.europa': { name: 'Europa League', short: 'UEL' },
  'soccer/uefa.europa.conf': { name: 'Conference League', short: 'UECL' },
  'soccer/uefa.nations': { name: 'Nations League', short: 'UNL' },
  'soccer/uefa.euro': { name: 'Euro', short: 'EURO' },
  'soccer/fifa.world': { name: 'World Cup', short: 'WC' },
  'soccer/conmebol.libertadores': { name: 'Copa Libertadores', short: 'LIBERT' },
  'basketball/nba': { name: 'NBA', short: 'NBA' },
  'basketball/euroleague': { name: 'EuroLeague', short: 'EL' },
  'football/nfl': { name: 'NFL', short: 'NFL' },
  'baseball/mlb': { name: 'MLB', short: 'MLB' },
  'hockey/nhl': { name: 'NHL', short: 'NHL' },
  'tennis/atp': { name: 'ATP Tour', short: 'ATP' },
  'tennis/wta': { name: 'WTA Tour', short: 'WTA' },
  'cricket/ipl': { name: 'IPL', short: 'IPL' },
  'mma/ufc': { name: 'UFC', short: 'UFC' },
};

// For top European league players, also fetch these competition gamelogs.
function getSiblingCompetitions(sportPath: string): string[] {
  const top5 = ['soccer/eng.1', 'soccer/esp.1', 'soccer/ita.1', 'soccer/ger.1', 'soccer/fra.1'];
  if (top5.includes(sportPath)) {
    return ['soccer/uefa.champions', 'soccer/uefa.europa', 'soccer/uefa.europa.conf'];
  }
  if (['soccer/ned.1', 'soccer/por.1', 'soccer/sco.1', 'soccer/tur.1'].includes(sportPath)) {
    return ['soccer/uefa.europa', 'soccer/uefa.europa.conf'];
  }
  return [];
}

function deriveFallbackLabel(path: string): { name: string; short: string } | undefined {
  const sport = path.split('/')[0];
  const league = path.split('/')[1];
  const sportNames: Record<string, string> = {
    soccer: 'Football', basketball: 'Basketball', football: 'Am. Football',
    baseball: 'Baseball', hockey: 'Ice Hockey', tennis: 'Tennis',
    cricket: 'Cricket', rugby: 'Rugby', mma: 'MMA',
  };
  if (!sportNames[sport]) return undefined;
  return { name: sportNames[sport], short: (league || sport).toUpperCase().slice(0, 4) };
}

function normaliseGameLog(raw: AthleteGameLogResponse | null, competitionPath?: string): NormalisedGameLogRow[] {
  if (!raw?.events || !raw.seasonTypes) return [];
  const labels = raw.labels || raw.names || [];
  const compInfo = competitionPath
    ? (COMPETITION_LABELS[competitionPath] ?? deriveFallbackLabel(competitionPath))
    : undefined;
  const out: NormalisedGameLogRow[] = [];
  for (const seasonType of raw.seasonTypes) {
    for (const cat of seasonType.categories || []) {
      for (const ev of cat.events || []) {
        const eventInfo = raw.events[ev.eventId || ''];
        if (!eventInfo) continue;
        const stats: Record<string, string> = {};
        (ev.stats || []).forEach((val, idx) => {
          const lbl = labels[idx];
          if (lbl && val !== undefined && val !== null && val !== '0' && val !== '0.0' && val !== '') stats[lbl] = String(val);
        });
        out.push({
          date: eventInfo.date,
          opponent: eventInfo.opponent ? {
            name: eventInfo.opponent.displayName,
            abbr: eventInfo.opponent.abbreviation,
            logo: eventInfo.opponent.logo,
          } : undefined,
          homeAway: eventInfo.homeAwaySymbol === '@' ? 'away' : 'home',
          result: eventInfo.result,
          score: eventInfo.score,
          stats,
          competition: compInfo?.name,
          competitionShort: compInfo?.short,
        });
      }
    }
  }
  return out;
}

// Strip a trailing `-12345` or leading `12345-` numeric ESPN id from a slug.
function extractNumericId(raw: string): string {
  // Pure numeric ids stay as-is.
  if (/^\d+$/.test(raw)) return raw;
  // Slug shapes we accept: kylian-mbappe-323850 OR 323850-kylian-mbappe.
  const tail = raw.match(/-(\d{3,})$/);
  if (tail) return tail[1];
  const head = raw.match(/^(\d{3,})-/);
  if (head) return head[1];
  return raw;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  if (!rawId || !/^[a-zA-Z0-9_-]+$/.test(rawId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const id = extractNumericId(rawId);

  // Probe sports endpoints in small batches — first hit wins.
  // Batching prevents 72+ simultaneous outbound requests that cause 503/timeout.
  const BATCH = 8;
  let found: { sportPath: string; athlete: ESPNAthlete } | undefined;
  for (let i = 0; i < SPORT_PATHS.length && !found; i += BATCH) {
    const batch = SPORT_PATHS.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (p) => {
        const a = await fetchAthlete(p, id);
        return a ? { sportPath: p, athlete: a } : null;
      }),
    );
    found = results.find((x): x is { sportPath: string; athlete: ESPNAthlete } => !!x) ?? undefined;
  }

  // Fallback: try the league-agnostic "core" endpoint per sport.
  if (!found) {
    const coreSports = ['soccer', 'basketball', 'football', 'baseball', 'hockey', 'mma', 'tennis', 'cricket', 'rugby'];
    const coreProbe = await Promise.all(
      coreSports.map(async (sport) => {
        const a = await fetchCoreAthlete(sport, id);
        return a ? { sportPath: sport, athlete: a } : null;
      }),
    );
    found = coreProbe.find((x): x is { sportPath: string; athlete: ESPNAthlete } => !!x) ?? undefined;
  }

  if (!found) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Fetch stats + primary gamelog + sibling competition gamelogs in parallel.
  const siblingPaths = getSiblingCompetitions(found.sportPath);
  const [stats, gamelogRaw, ...siblingGamelogsRaw] = await Promise.all([
    fetchAthleteStats(found.sportPath, id).catch(() => null),
    fetchAthleteGameLog(found.sportPath, id).catch(() => null),
    ...siblingPaths.map(p => fetchAthleteGameLog(p, id).catch(() => null)),
  ]);

  // Normalise primary gamelog + all sibling competition gamelogs, then merge by date.
  const primaryRows = normaliseGameLog(gamelogRaw, found.sportPath);
  const siblingRows = siblingPaths.flatMap((p, i) => normaliseGameLog(siblingGamelogsRaw[i], p));
  // Merge, deduplicate by date+opponent, sort newest first.
  const allRows = [...primaryRows, ...siblingRows];
  const seen = new Set<string>();
  const recentMatches = allRows
    .filter(r => {
      const key = `${r.date ?? ''}|${r.opponent?.name ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.date ?? '') > (a.date ?? '') ? 1 : -1)
    .slice(0, 30);

  const a = found.athlete;
  const sportRoot = found.sportPath.split('/')[0];
  const headshot = a.headshot?.href
    || `https://a.espncdn.com/i/headshots/${sportRoot}/players/full/${id}.png`;

  return NextResponse.json({
    recentMatches,
    id: String(a.id ?? id),
    name: a.displayName || a.fullName || `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim(),
    firstName: a.firstName,
    lastName: a.lastName,
    shortName: a.shortName,
    position: a.position?.displayName || a.position?.name || a.position?.abbreviation,
    jersey: a.jersey,
    team: a.team
      ? {
          id: a.team.id,
          name: a.team.displayName,
          logo: a.team.logos?.[0]?.href,
        }
      : null,
    height: a.displayHeight,
    weight: a.displayWeight,
    age: a.age,
    dateOfBirth: a.dateOfBirth,
    birthPlace: a.birthPlace,
    nationality: a.citizenship,
    flag: a.flag?.href,
    experienceYears: a.experience?.years,
    status: a.status?.name,
    headshot,
    sportPath: found.sportPath,
    stats: stats || null,
  });
}
