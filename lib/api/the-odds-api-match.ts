/**
 * TheOddsAPI — per-match h2h (moneyline) odds for ALL sports.
 *
 * Strategy: fetch the full event list for a sport group in one call,
 * cache it for 15 min.  Multiple matches for the same sport share one
 * API request, keeping monthly quota (~500 free calls) affordable.
 *
 * Sport-slug → TheOddsAPI sport keys mapping covers tennis, basketball,
 * cricket, ice hockey, NFL/MLB/NHL, MMA, rugby, and all major soccer
 * leagues.  Soccer is kept as a secondary source (SGO/ESPN handle it
 * better), while tennis & basketball are primary targets here since no
 * other free source covers them.
 *
 * Key used: `the_odds_api_key` from site settings → THE_ODDS_API_KEY env.
 */

import fs from 'fs';
import path from 'path';
import { getApiKey } from '@/lib/api-keys';

export interface OddsApiBookmakerLine {
  bookmaker: string;   // canonical key, e.g. 'pinnacle'
  display: string;     // pretty name, e.g. 'Pinnacle'
  home: number;
  draw?: number;
  away: number;
}

// ─── Cache ──────────────────────────────────────────────────────────────────
const MEM_TTL_MS  = 15 * 60 * 1000;  // 15 min in-memory
const FILE_TTL_MS = 30 * 60 * 1000;  // 30 min file

const CACHE_DIR = path.join(process.cwd(), '.local', 'data', 'theodds-match-cache');
const memCache  = new Map<string, { ts: number; events: OddsApiEvent[] }>();

// ─── Rate / quota guards ─────────────────────────────────────────────────────
let quotaExhausted = false;
let quotaExhaustedAt = 0;
const QUOTA_BACKOFF_MS = 24 * 60 * 60 * 1000; // back off 24 h on quota exhaustion

// ─── TheOddsAPI response shape ───────────────────────────────────────────────
interface OddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string; // 'h2h'
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

// ─── Sport slug → TheOddsAPI sport keys (ordered: most likely first) ─────────
const SPORT_KEY_MAP: Record<string, string[]> = {
  // Tennis — ATP + WTA cover virtually all matches
  tennis:               ['tennis_atp', 'tennis_wta'],
  'table-tennis':       ['table_tennis'],

  // Basketball
  basketball:           ['basketball_nba', 'basketball_euroleague', 'basketball_nbl',
                         'basketball_wnba', 'basketball_ncaab'],
  'basketball':         ['basketball_nba', 'basketball_euroleague'],

  // Ice Hockey
  'ice-hockey':         ['icehockey_nhl', 'icehockey_sweden_hockey_league',
                         'icehockey_switzerland_nla'],
  hockey:               ['icehockey_nhl'],

  // American Football
  'american-football':  ['americanfootball_nfl', 'americanfootball_ncaaf'],

  // Baseball
  baseball:             ['baseball_mlb'],

  // Cricket
  cricket:              ['cricket_test_match', 'cricket_odi', 'cricket_ipl',
                         'cricket_caribbean_premier_league'],

  // Rugby
  rugby:                ['rugbyleague_nrl', 'rugbyleague_super_league',
                         'rugbyunion_premiership', 'rugbyunion_united_rugby_championship',
                         'rugbyunion_epcr_challenge_cup'],
  'rugby-league':       ['rugbyleague_nrl', 'rugbyleague_super_league'],
  'rugby-union':        ['rugbyunion_premiership', 'rugbyunion_united_rugby_championship'],

  // MMA / Boxing
  mma:                  ['mma_mixed_martial_arts'],
  boxing:               ['boxing_boxing'],

  // Golf
  golf:                 ['golf_pga_tour', 'golf_masters_tournament_winner'],

  // Soccer / Football — secondary (SGO + ESPN handle it; TheOddsAPI covers gaps)
  football:             ['soccer_fifa_world_cup', 'soccer_uefa_champs_league',
                         'soccer_epl', 'soccer_spain_la_liga', 'soccer_germany_bundesliga',
                         'soccer_italy_serie_a', 'soccer_france_ligue_one',
                         'soccer_usa_mls', 'soccer_uefa_europa_league'],
  soccer:               ['soccer_fifa_world_cup', 'soccer_epl'],
};

// Bookmaker key → pretty display name
const BK_DISPLAY: Record<string, string> = {
  pinnacle:          'Pinnacle',
  bet365:            'bet365',
  betfair_ex_eu:     'Betfair',
  betfair_ex_uk:     'Betfair',
  unibet_eu:         'Unibet',
  unibet_uk:         'Unibet',
  unibet:            'Unibet',
  '888sport':        '888sport',
  williamhill:       'William Hill',
  ladbrokes_uk:      'Ladbrokes',
  bwin:              'bwin',
  coral:             'Coral',
  boylesports:       'BoyleSports',
  draftkings:        'DraftKings',
  fanduel:           'FanDuel',
  betmgm:            'BetMGM',
  pointsbetus:       'PointsBet',
  barstool:          'Barstool',
  bovada:            'Bovada',
  mybookieag:        'MyBookie',
  lowvig:            'LowVig.ag',
  betonlineag:       'BetOnline.ag',
  sportybet:         'SportyBet',
  betway:            'Betway',
  onexbet:           '1xBet',
  '1xbet':           '1xBet',
  marathonbet:       'Marathon',
  nordicbet:         'NordicBet',
  coolbet:           'Coolbet',
};

function prettyName(key: string): string {
  return BK_DISPLAY[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── File cache helpers ───────────────────────────────────────────────────────
function filePath(sportKey: string): string {
  const safe = sportKey.replace(/[^a-z0-9]/g, '_');
  return path.join(CACHE_DIR, `${safe}.json`);
}

function readFile(sportKey: string): OddsApiEvent[] | null {
  try {
    const fp = filePath(sportKey);
    if (!fs.existsSync(fp)) return null;
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8')) as { ts: number; events: OddsApiEvent[] };
    if (Date.now() - raw.ts > FILE_TTL_MS) { fs.unlinkSync(fp); return null; }
    return raw.events;
  } catch { return null; }
}

function writeFile(sportKey: string, events: OddsApiEvent[]): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(filePath(sportKey), JSON.stringify({ ts: Date.now(), events }));
  } catch { /* ignore */ }
}

// ─── Fetch events for one sport key ──────────────────────────────────────────
async function fetchSportEvents(sportKey: string, apiKey: string): Promise<OddsApiEvent[]> {
  // 1. Memory cache
  const mem = memCache.get(sportKey);
  if (mem && Date.now() - mem.ts < MEM_TTL_MS) return mem.events;

  // 2. File cache
  const file = readFile(sportKey);
  if (file !== null) {
    memCache.set(sportKey, { ts: Date.now(), events: file });
    return file;
  }

  // 3. Quota guard
  if (quotaExhausted && Date.now() - quotaExhaustedAt < QUOTA_BACKOFF_MS) return [];

  try {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('markets', 'h2h');
    url.searchParams.set('regions', 'uk,eu,us');
    url.searchParams.set('oddsFormat', 'decimal');
    url.searchParams.set('dateFormat', 'iso');

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });

    if (!res.ok) {
      if (res.status === 401 || res.status === 422) {
        try {
          const body = await res.json() as { error_code?: string };
          if (body?.error_code === 'OUT_OF_USAGE_CREDITS') {
            quotaExhausted = true;
            quotaExhaustedAt = Date.now();
            console.warn('[TheOddsAPI Match] Monthly quota exhausted');
            return [];
          }
        } catch { /* ignore */ }
      }
      if (res.status === 404) {
        // Sport key not valid — cache empty result so we don't retry
        memCache.set(sportKey, { ts: Date.now(), events: [] });
        writeFile(sportKey, []);
        return [];
      }
      return [];
    }

    const remaining = res.headers.get('x-requests-remaining');
    if (remaining !== null && parseInt(remaining, 10) < 10) {
      quotaExhausted = true;
      quotaExhaustedAt = Date.now();
      console.warn(`[TheOddsAPI Match] Only ${remaining} requests remaining — pausing`);
    }

    const events = await res.json() as OddsApiEvent[];
    const valid = Array.isArray(events) ? events : [];

    memCache.set(sportKey, { ts: Date.now(), events: valid });
    writeFile(sportKey, valid);
    return valid;
  } catch (err) {
    console.error(`[TheOddsAPI Match] fetch error for ${sportKey}:`, err);
    return [];
  }
}

// ─── Team name normalizer ─────────────────────────────────────────────────────
function norm(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|cfc|fk|sk|rc|ac|as|ss|bsc|if|bk|gfc|utd|united|city|town|athletic|cf|club|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function teamMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (na.length >= 3 && nb.includes(na)) return true;
  if (nb.length >= 3 && na.includes(nb)) return true;
  // Allow first 5-char prefix match for long names
  if (na.length >= 5 && nb.length >= 5 && na.slice(0, 5) === nb.slice(0, 5)) return true;
  return false;
}

// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Return per-bookmaker h2h lines for a match, fetching from TheOddsAPI.
 * Returns [] if no API key is configured or no matching event is found.
 */
export async function getTheOddsApiMatchLines(
  homeTeam: string,
  awayTeam: string,
  kickoffIso: string,
  sportSlug: string,
  hasDraw: boolean,
): Promise<OddsApiBookmakerLine[]> {
  const apiKey = await getApiKey('the_odds_api_key');
  if (!apiKey || apiKey === 'your_api_key_here') return [];

  const sportKeys = SPORT_KEY_MAP[sportSlug] ?? SPORT_KEY_MAP[sportSlug.replace(/-/g, '')] ?? [];
  if (sportKeys.length === 0) return [];

  // Try each sport key until we find a matching event
  for (const sk of sportKeys) {
    const events = await fetchSportEvents(sk, apiKey);

    // Find the event that matches home + away team names
    const kickoffMs = new Date(kickoffIso).getTime();
    const match = events.find(ev => {
      // Team name match
      const homeOk = teamMatch(ev.home_team, homeTeam) || teamMatch(ev.away_team, homeTeam);
      const awayOk = teamMatch(ev.home_team, awayTeam) || teamMatch(ev.away_team, awayTeam);
      if (!homeOk || !awayOk) return false;
      // Allow ±3 hours kickoff tolerance (clock drift / timezone issues)
      const diff = Math.abs(new Date(ev.commence_time).getTime() - kickoffMs);
      return diff < 3 * 60 * 60 * 1000;
    });

    if (!match) continue;

    // Determine which team is home vs away in TheOddsAPI response
    const apiHomeIsHome = teamMatch(match.home_team, homeTeam);

    const lines: OddsApiBookmakerLine[] = [];
    for (const bk of match.bookmakers) {
      const h2h = bk.markets.find(m => m.key === 'h2h');
      if (!h2h) continue;

      // Outcomes: [home, away] or [home, draw, away] for soccer
      // TheOddsAPI outcome names match team names exactly
      const homeOutcome = h2h.outcomes.find(o =>
        teamMatch(o.name, homeTeam) || (apiHomeIsHome && o.name === match.home_team)
      );
      const awayOutcome = h2h.outcomes.find(o =>
        teamMatch(o.name, awayTeam) || (!apiHomeIsHome && o.name === match.home_team)
      );
      const drawOutcome = hasDraw
        ? h2h.outcomes.find(o => o.name.toLowerCase() === 'draw')
        : undefined;

      if (!homeOutcome || !awayOutcome) continue;
      if (homeOutcome.price <= 1 || awayOutcome.price <= 1) continue;

      lines.push({
        bookmaker: bk.key,
        display:   prettyName(bk.key),
        home:      Math.round(homeOutcome.price * 100) / 100,
        draw:      drawOutcome && drawOutcome.price > 1
                     ? Math.round(drawOutcome.price * 100) / 100
                     : undefined,
        away:      Math.round(awayOutcome.price * 100) / 100,
      });
    }

    if (lines.length > 0) {
      // Sort: Pinnacle first (sharp money reference), then alphabetical
      lines.sort((a, b) => {
        if (a.bookmaker === 'pinnacle') return -1;
        if (b.bookmaker === 'pinnacle') return 1;
        if (a.bookmaker === 'bet365') return -1;
        if (b.bookmaker === 'bet365') return 1;
        return a.display.localeCompare(b.display);
      });
      return lines;
    }
  }

  return [];
}
