/**
 * TheOddsAPI — per-match h2h (moneyline) odds for ALL sports.
 *
 * Key design choices:
 * 1. Fetch /v4/sports once per day (1 request) to get all available
 *    tournament-specific sport keys (e.g. tennis_atp_wimbledon, not tennis_atp).
 * 2. Match the in-app sport slug + league name to the correct sport key.
 * 3. Cache the full event list per sport key for 15 min — all matches in the
 *    same tournament share one API request, preserving the 500/month quota.
 *
 * Sport key resolution:
 *   app sport slug → TheOddsAPI category prefix (tennis_atp, tennis_wta,
 *   basketball_nba, etc.) → discover matching live keys from /sports list.
 */

import fs from 'fs';
import path from 'path';
import { getApiKey } from '@/lib/api-keys';

export interface OddsApiBookmakerLine {
  bookmaker: string;
  display: string;
  home: number;
  draw?: number;
  away: number;
}

// ─── Cache dirs ───────────────────────────────────────────────────────────────
const CACHE_DIR        = path.join(process.cwd(), '.local', 'data', 'theodds-match-cache');
const SPORTS_CACHE_DIR = path.join(process.cwd(), '.local', 'data', 'theodds-sports-cache');

// ─── TTLs ─────────────────────────────────────────────────────────────────────
const SPORTS_LIST_TTL_MS = 24 * 60 * 60 * 1000; // 24 h — sport keys rarely change
const EVENTS_MEM_TTL_MS  = 15 * 60 * 1000;       // 15 min in-memory
const EVENTS_FILE_TTL_MS = 30 * 60 * 1000;       // 30 min file

// ─── Quota guard ──────────────────────────────────────────────────────────────
let quotaExhausted    = false;
let quotaExhaustedAt  = 0;
const QUOTA_BACKOFF_MS = 24 * 60 * 60 * 1000;

// ─── Memory caches ───────────────────────────────────────────────────────────
const eventsMemCache = new Map<string, { ts: number; events: OddsApiEvent[] }>();

// ─── TheOddsAPI response shapes ──────────────────────────────────────────────
interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

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
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

// ─── Sport slug → TheOddsAPI key prefixes ────────────────────────────────────
// TheOddsAPI uses tournament-specific keys (tennis_atp_wimbledon etc.).
// These prefixes are used to filter the live /sports list to find matching keys.
const SLUG_TO_PREFIXES: Record<string, string[]> = {
  tennis:               ['tennis_atp', 'tennis_wta'],
  basketball:           ['basketball_nba', 'basketball_nbl', 'basketball_euroleague', 'basketball_wnba', 'basketball_ncaab'],
  'ice-hockey':         ['icehockey_nhl', 'icehockey_sweden', 'icehockey_switzerland', 'icehockey_ahl'],
  hockey:               ['icehockey_nhl'],
  'american-football':  ['americanfootball_nfl', 'americanfootball_ncaaf'],
  baseball:             ['baseball_mlb'],
  cricket:              ['cricket_test', 'cricket_odi', 'cricket_ipl', 'cricket_caribbean'],
  rugby:                ['rugbyleague_nrl', 'rugbyleague_super', 'rugbyunion'],
  'rugby-league':       ['rugbyleague_nrl', 'rugbyleague_super'],
  'rugby-union':        ['rugbyunion'],
  mma:                  ['mma_mixed', 'mma_ufc', 'mma_bellator'],
  boxing:               ['boxing'],
  golf:                 ['golf_pga', 'golf_masters', 'golf_us_open', 'golf_the_open'],
  football:             ['soccer_epl', 'soccer_spain_la_liga', 'soccer_germany_bundesliga',
                         'soccer_italy_serie_a', 'soccer_france_ligue_one', 'soccer_uefa',
                         'soccer_usa_mls', 'soccer_fifa_world_cup', 'soccer_conmebol'],
  soccer:               ['soccer_epl', 'soccer_spain_la_liga', 'soccer_fifa_world_cup', 'soccer_conmebol'],
};

// ─── Display name map ─────────────────────────────────────────────────────────
const BK_DISPLAY: Record<string, string> = {
  pinnacle: 'Pinnacle', bet365: 'bet365', betfair_ex_eu: 'Betfair',
  betfair_ex_uk: 'Betfair', unibet_eu: 'Unibet', unibet_uk: 'Unibet', unibet: 'Unibet',
  '888sport': '888sport', williamhill: 'William Hill', ladbrokes_uk: 'Ladbrokes',
  bwin: 'bwin', coral: 'Coral', boylesports: 'BoyleSports',
  draftkings: 'DraftKings', fanduel: 'FanDuel', betmgm: 'BetMGM',
  pointsbetus: 'PointsBet', sportybet: 'SportyBet', betway: 'Betway',
  onexbet: '1xBet', '1xbet': '1xBet', marathonbet: 'Marathon', nordicbet: 'NordicBet',
  coolbet: 'Coolbet', mybookieag: 'MyBookie', betonlineag: 'BetOnline.ag', bovada: 'Bovada',
};
function prettyName(key: string): string {
  return BK_DISPLAY[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── File helpers ─────────────────────────────────────────────────────────────
function readJson<T>(dir: string, name: string, ttlMs: number): T | null {
  try {
    const fp = path.join(dir, `${name.replace(/[^a-z0-9]/g, '_')}.json`);
    if (!fs.existsSync(fp)) return null;
    const { ts, data } = JSON.parse(fs.readFileSync(fp, 'utf8')) as { ts: number; data: T };
    if (Date.now() - ts > ttlMs) { fs.unlinkSync(fp); return null; }
    return data;
  } catch { return null; }
}

function writeJson<T>(dir: string, name: string, data: T): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${name.replace(/[^a-z0-9]/g, '_')}.json`),
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch { /* ignore */ }
}

// ─── Fetch available sport keys (cached 24 h) ─────────────────────────────────
let sportsList: OddsApiSport[] | null = null;
let sportsListTs = 0;

async function getAvailableSports(apiKey: string): Promise<OddsApiSport[]> {
  // 1. In-memory cache
  if (sportsList && Date.now() - sportsListTs < SPORTS_LIST_TTL_MS) return sportsList;

  // 2. File cache
  const fileCached = readJson<OddsApiSport[]>(SPORTS_CACHE_DIR, 'sports_list', SPORTS_LIST_TTL_MS);
  if (fileCached) {
    sportsList = fileCached;
    sportsListTs = Date.now();
    return fileCached;
  }

  // 3. Quota guard
  if (quotaExhausted && Date.now() - quotaExhaustedAt < QUOTA_BACKOFF_MS) return [];

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`,
      { next: { revalidate: 0 } },
    );

    const remaining = parseInt(res.headers.get('x-requests-remaining') ?? '999', 10);
    if (remaining <= 0) {
      quotaExhausted = true;
      quotaExhaustedAt = Date.now();
      console.warn('[TheOddsAPI Match] Quota at 0 — pausing until tomorrow');
    }

    if (!res.ok) return [];

    const data = await res.json() as OddsApiSport[];
    const active = Array.isArray(data) ? data.filter(s => s.active && !s.has_outrights) : [];

    sportsList = active;
    sportsListTs = Date.now();
    writeJson(SPORTS_CACHE_DIR, 'sports_list', active);
    return active;
  } catch (err) {
    console.error('[TheOddsAPI Match] /sports error:', err);
    return [];
  }
}

// ─── Find sport keys matching a slug + optional league hint ───────────────────
async function findSportKeys(
  apiKey: string,
  sportSlug: string,
  leagueName: string,
): Promise<string[]> {
  const prefixes = SLUG_TO_PREFIXES[sportSlug] ?? SLUG_TO_PREFIXES[sportSlug.replace(/-/g, '')] ?? [];
  if (prefixes.length === 0) return [];

  const available = await getAvailableSports(apiKey);
  if (available.length === 0) {
    // Quota exhausted or no network — use prefixes as fallback keys
    return prefixes.slice(0, 3);
  }

  // Filter available keys by prefix
  const matching = available.filter(s =>
    prefixes.some(p => s.key.startsWith(p))
  );

  if (matching.length === 0) return [];

  // If we have a league name, prefer keys that fuzzy-match it
  if (leagueName) {
    const ln = leagueName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const ranked = matching.sort((a, b) => {
      const ak = a.key.replace(/[^a-z0-9]/g, '');
      const bk = b.key.replace(/[^a-z0-9]/g, '');
      // Score: how many characters of ln appear in the key
      const scoreA = [...ln].filter(c => ak.includes(c)).length;
      const scoreB = [...ln].filter(c => bk.includes(c)).length;
      return scoreB - scoreA;
    });
    return ranked.map(s => s.key);
  }

  return matching.map(s => s.key);
}

// ─── Fetch events for one sport key ──────────────────────────────────────────
async function fetchSportEvents(sportKey: string, apiKey: string): Promise<OddsApiEvent[]> {
  // 1. Memory cache
  const mem = eventsMemCache.get(sportKey);
  if (mem && Date.now() - mem.ts < EVENTS_MEM_TTL_MS) return mem.events;

  // 2. File cache
  const file = readJson<OddsApiEvent[]>(CACHE_DIR, sportKey, EVENTS_FILE_TTL_MS);
  if (file !== null) {
    eventsMemCache.set(sportKey, { ts: Date.now(), events: file });
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

    const remaining = parseInt(res.headers.get('x-requests-remaining') ?? '999', 10);
    if (remaining <= 0) {
      quotaExhausted = true;
      quotaExhaustedAt = Date.now();
      console.warn(`[TheOddsAPI Match] Quota exhausted after fetching ${sportKey}`);
    }

    if (!res.ok) {
      if (res.status === 404 || res.status === 422) {
        eventsMemCache.set(sportKey, { ts: Date.now(), events: [] });
        writeJson(CACHE_DIR, sportKey, []);
      }
      return [];
    }

    const events = await res.json() as OddsApiEvent[];
    const valid = Array.isArray(events) ? events : [];
    eventsMemCache.set(sportKey, { ts: Date.now(), events: valid });
    writeJson(CACHE_DIR, sportKey, valid);
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
    .replace(/\b(fc|cf|sc|afc|cfc|fk|sk|rc|ac|as|ss|bsc|if|bk|gfc|utd|united|city|town|athletic|club|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function teamMatch(apiName: string, appName: string): boolean {
  const na = norm(apiName);
  const nb = norm(appName);
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  if (na.length >= 5 && nb.length >= 5 && na.slice(0, 5) === nb.slice(0, 5)) return true;
  return false;
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function getTheOddsApiMatchLines(
  homeTeam: string,
  awayTeam: string,
  kickoffIso: string,
  sportSlug: string,
  hasDraw: boolean,
  leagueName?: string,
): Promise<OddsApiBookmakerLine[]> {
  const apiKey = await getApiKey('the_odds_api_key');
  if (!apiKey || apiKey === 'your_api_key_here') return [];

  if (quotaExhausted && Date.now() - quotaExhaustedAt < QUOTA_BACKOFF_MS) return [];

  const sportKeys = await findSportKeys(apiKey, sportSlug, leagueName ?? '');
  if (sportKeys.length === 0) return [];

  const kickoffMs = new Date(kickoffIso).getTime();

  for (const sk of sportKeys) {
    const events = await fetchSportEvents(sk, apiKey);

    const match = events.find(ev => {
      const homeOk = teamMatch(ev.home_team, homeTeam) || teamMatch(ev.away_team, homeTeam);
      const awayOk = teamMatch(ev.home_team, awayTeam) || teamMatch(ev.away_team, awayTeam);
      if (!homeOk || !awayOk) return false;
      // Allow ±4 hour kickoff tolerance
      const diff = Math.abs(new Date(ev.commence_time).getTime() - kickoffMs);
      return diff < 4 * 60 * 60 * 1000;
    });

    if (!match) continue;

    const apiHomeIsHome = teamMatch(match.home_team, homeTeam);
    const lines: OddsApiBookmakerLine[] = [];

    for (const bk of match.bookmakers) {
      const h2h = bk.markets.find(m => m.key === 'h2h');
      if (!h2h) continue;

      const homeOutcome = h2h.outcomes.find(o =>
        apiHomeIsHome ? o.name === match.home_team : o.name === match.away_team
      ) ?? h2h.outcomes.find(o => teamMatch(o.name, homeTeam));

      const awayOutcome = h2h.outcomes.find(o =>
        apiHomeIsHome ? o.name === match.away_team : o.name === match.home_team
      ) ?? h2h.outcomes.find(o => teamMatch(o.name, awayTeam));

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

/** Pre-warm the sports list cache — called at startup to use 1 quota request
 *  and avoid wasting it on the first user request. */
export async function warmTheOddsApiSportsCache(): Promise<void> {
  const apiKey = await getApiKey('the_odds_api_key');
  if (!apiKey || apiKey === 'your_api_key_here') return;
  await getAvailableSports(apiKey);
}
