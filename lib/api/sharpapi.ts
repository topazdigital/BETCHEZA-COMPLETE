/**
 * SharpAPI (sharpapi.io) adapter.
 *
 * Provides real-time odds from DraftKings & FanDuel (free tier).
 * Used as a supplementary odds source when The Odds API or SportsGameOdds
 * don't have coverage for a match.
 *
 * Market availability and bookmaker coverage depend on the account's plan
 * and the event. The event-odds endpoint returns all rows available to it.
 *
 * Auth: X-API-Key header  OR  Authorization: Bearer <key>
 * Base URL: https://api.sharpapi.io/api/v1
 */

import { getApiKey } from '@/lib/api-keys';
import type { MatchOdds, Market } from './unified-sports-api';

const BASE = 'https://api.sharpapi.io/api/v1';

// ── Cache ────────────────────────────────────────────────────────────────────
// 30-min TTL. Free tier has 60s data delay anyway, and longer TTL prevents
// the "restart storm" pattern: PM2 restart → cache cleared → 10+ API calls
// before cache warms → rate limit hit → 429s logged every restart.
const CACHE_TTL_MS = 30 * 60 * 1000;

// ── Circuit breaker ───────────────────────────────────────────────────────────
// Authentication failures affect every endpoint; rate limits are temporary.
// A 400 is request-specific, so it must not disable unrelated valid endpoints.
let _backoffUntil = 0;

function isCircuitOpen(): boolean {
  if (_backoffUntil && Date.now() < _backoffUntil) return true;
  _backoffUntil = 0;
  return false;
}

function tripCircuit(reason: 'auth' | '429') {
  const ms = reason === 'auth' ? 2 * 60 * 60 * 1000 : 10 * 60 * 1000;
  _backoffUntil = Date.now() + ms;
}

interface CacheEntry<T> {
  data: T;
  ts: number;
  ttlMs?: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const e = cache.get(key) as CacheEntry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.ts > (e.ttlMs ?? CACHE_TTL_MS)) { cache.delete(key); return null; }
  return e.data;
}

function setCached<T>(key: string, data: T, ttlMs?: number): void {
  cache.set(key, { data, ts: Date.now(), ttlMs });
}

/** Current SharpAPI event and flat odds response fields. */
interface SharpApiEvent {
  id: string;
  sport?: string;
  league?: string;
  home_team: string;
  away_team: string;
  start_time?: string;
  status?: string;
  markets?: string[];
  market_count?: number;
}

interface SharpApiOddsRow {
  id?: string;
  event_id?: string;
  sport?: string;
  league?: string;
  home_team: string;
  away_team: string;
  market_type: string;
  market_label?: string;
  sportsbook: string;
  selection: string;
  selection_type?: string;
  odds_decimal?: number | string | null;
  odds_american?: number | string | null;
  line?: number | string | null;
  player_name?: string | null;
  event_start_time?: string;
}

interface SharpApiCollection<T> {
  data?: T[];
  pagination?: { count?: number; total?: number; next_cursor?: string | null };
}

// ── Internal fetch ───────────────────────────────────────────────────────────
async function sharpFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  if (isCircuitOpen()) return null;

  const apiKey = await getApiKey('sharp_api_key');
  if (!apiKey) return null;

  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 0 },
    } as RequestInit);

    if (res.status === 401) {
      console.warn('[SharpAPI] Invalid API key — disabling for 2h');
      tripCircuit('auth');
      return null;
    }
    if (res.status === 429) {
      console.warn('[SharpAPI] Rate limit hit — backing off 10 min');
      tripCircuit('429');
      return null;
    }
    if (res.status === 400) {
      console.warn(`[SharpAPI] HTTP 400 for ${path}; request rejected`);
      return null;
    }
    if (!res.ok) {
      console.warn(`[SharpAPI] HTTP ${res.status} for ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn('[SharpAPI] Fetch error:', e);
    return null;
  }
}

function marketKeyLabel(key: string): string {
  const map: Record<string, string> = {
    h2h: 'Match Winner',
    spreads: 'Point Spread',
    totals: 'Over/Under',
    outrights: 'Outright Winner',
    btts: 'Both Teams to Score',
    double_chance: 'Double Chance',
    draw_no_bet: 'Draw No Bet',
    correct_score: 'Correct Score',
    ht_result: 'Half-Time Result',
    ht_ft: 'Half-Time / Full-Time',
    asian_handicap: 'Asian Handicap',
  };
  const lineMarket = key.match(/^(totals|corners)_((?:m)?\d+(?:_\d+)?)$/);
  if (lineMarket) {
    const line = lineMarket[2].replace(/^m/, '-').replace('_', '.');
    return lineMarket[1] === 'corners' ? `Total Corners O/U ${line}` : `Over/Under ${line}`;
  }
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Keep in sync with TEAM_NAME_ALIASES in unified-sports-api.ts and sportsgameodds.ts
const TEAM_NAME_ALIASES: Record<string, string> = {
  hearts: 'heartofmidlothian',
  hibs: 'hibernian',
  wolves: 'wolverhampton',
  spurs: 'tottenham',
  tottenhamspur: 'tottenham',
  tottenhamhotspur: 'tottenham',
  manunited: 'manchesterunited',
  manutd: 'manchesterunited',
  manchesterutd: 'manchesterunited',
  mancity: 'manchestercity',
  westbrom: 'westbromwichalbion',
  westbromwich: 'westbromwichalbion',
  atletico: 'atleticomadrid',
  atleticomadrid: 'atleticomadrid',
  atleticdemadrid: 'atleticomadrid',
  dortmund: 'borussiadortmund',
  internacionalrs: 'internacional',
  athleticclub: 'athleticbilbao',
};

function normalizeTeam(name: string): string {
  const stripped = name
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|cfc|acf|ac|as|ss|bsc|fk|sk|rc|club|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return TEAM_NAME_ALIASES[stripped] ?? stripped;
}

function sharpSportSlug(sportSlug: string): string | undefined {
  const sport = sportSlug.toLowerCase().replace(/_/g, '-');
  const known: Record<string, string> = {
    football: 'soccer',
    soccer: 'soccer',
    basketball: 'basketball',
    baseball: 'baseball',
    tennis: 'tennis',
    cricket: 'cricket',
    'american-football': 'football',
    americanfootball: 'football',
    'ice-hockey': 'hockey',
    hockey: 'hockey',
    rugby: 'rugby_union',
    'rugby-league': 'rugby_league',
    volleyball: 'volleyball',
    'table-tennis': 'table_tennis',
    mma: 'mma',
    boxing: 'boxing',
    golf: 'golf',
    darts: 'darts',
    snooker: 'snooker',
    esports: 'esports',
  };
  return known[sport];
}

function decimalOdds(row: SharpApiOddsRow): number | null {
  const decimal = Number(row.odds_decimal);
  if (Number.isFinite(decimal) && decimal > 1) return decimal;

  const american = Number(row.odds_american);
  if (!Number.isFinite(american) || american === 0) return null;
  const converted = american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
  return Number.isFinite(converted) && converted > 1 ? converted : null;
}

function lineValue(row: SharpApiOddsRow): number | undefined {
  if (row.line === undefined || row.line === null || row.line === '') return undefined;
  const value = Number(row.line);
  return Number.isFinite(value) ? value : undefined;
}

function lineToken(value: number): string {
  const abs = Math.abs(value).toString().replace('.', '_');
  return `${value < 0 ? 'm' : ''}${abs}`;
}

function sharpMarketKey(row: SharpApiOddsRow, sportSlug: string): string {
  const raw = row.market_type.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
  const line = lineValue(row);
  const isSoccer = ['soccer', 'football'].includes(sportSlug.toLowerCase());

  if (['h2h', 'moneyline', 'match_winner', 'three_way_moneyline', 'three_way_result'].includes(raw)) return 'h2h';
  if (raw.includes('btts') || raw.includes('both_teams_to_score')) return 'btts';
  if (raw.includes('double_chance')) return 'double_chance';
  if (raw.includes('draw_no_bet')) return 'draw_no_bet';
  if (raw.includes('correct_score')) return 'correct_score';
  if (raw.includes('half_time_full_time') || raw.includes('halftime_fulltime')) return 'ht_ft';
  if (raw.includes('half_time_result') || raw.includes('halftime_result')) return 'ht_result';
  if (raw.includes('first_team_to_score')) return 'first_team_to_score';
  if (raw.includes('odd_even')) return 'odd_even_goals';
  if (raw.includes('clean_sheet')) return raw.includes('away') ? 'clean_sheet_away' : 'clean_sheet_home';
  if (raw.includes('corner') && line !== undefined) return `corners_${lineToken(line)}`;
  if (raw.includes('asian_handicap')) return 'asian_handicap';
  if (raw.includes('spread') || raw.includes('handicap')) return isSoccer ? 'asian_handicap' : 'spreads';
  if (raw.includes('total') || raw.includes('over_under')) {
    return line === undefined ? 'totals' : `totals_${lineToken(line)}`;
  }

  const base = raw || 'other';
  return line === undefined ? base : `${base}_${lineToken(line)}`;
}

function sharpMarketLabel(key: string, row: SharpApiOddsRow): string {
  const explicit = row.market_label?.trim();
  const line = lineValue(row);
  if (explicit) {
    if (line !== undefined && (key.startsWith('totals_') || key.startsWith('corners_')) &&
        !explicit.includes(String(line))) return `${explicit} ${line}`;
    return explicit;
  }
  if (key.startsWith('totals_') && line !== undefined) return `Over/Under ${line}`;
  if (key.startsWith('corners_') && line !== undefined) return `Total Corners O/U ${line}`;
  return marketKeyLabel(key);
}

function sharpOutcomeName(row: SharpApiOddsRow, homeTeam: string, awayTeam: string, key: string): string {
  const selectionType = (row.selection_type || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const rawSelection = row.selection?.trim() || '';
  const selectionToken = rawSelection.toLowerCase();
  let name = rawSelection;

  if (['home', 'home_team', 'team_1', 'participant_1'].includes(selectionType) ||
      ['home', 'home_team', '1'].includes(selectionToken)) name = homeTeam;
  else if (['away', 'away_team', 'team_2', 'participant_2'].includes(selectionType) ||
      ['away', 'away_team', '2'].includes(selectionToken)) name = awayTeam;
  else if (['draw', 'tie'].includes(selectionType) || ['draw', 'tie', 'x'].includes(selectionToken)) name = 'Draw';
  else if (['over', 'under', 'yes', 'no'].includes(selectionType)) {
    name = selectionType[0].toUpperCase() + selectionType.slice(1);
  } else if (!name && ['home', 'away', 'draw', 'over', 'under', 'yes', 'no'].includes(selectionType)) {
    name = selectionType[0].toUpperCase() + selectionType.slice(1);
  }

  if (!name) return '';
  const line = lineValue(row);
  if (line !== undefined && (key === 'asian_handicap' || key === 'spreads')) {
    const signedLine = `${line > 0 ? '+' : ''}${line}`;
    if (!name.endsWith(signedLine)) name = `${name} ${signedLine}`;
  }
  if (row.player_name && /^player_/.test(row.market_type) &&
      !name.toLowerCase().includes(row.player_name.toLowerCase())) {
    name = `${row.player_name} — ${name}`;
  }
  return name;
}

function sharpRowsToMarkets(
  rows: SharpApiOddsRow[],
  homeTeam: string,
  awayTeam: string,
  sportSlug: string,
): Market[] {
  const markets = new Map<string, Market>();
  for (const row of rows) {
    if (!row?.market_type || !row?.selection) continue;
    const price = decimalOdds(row);
    if (!price) continue;

    const key = sharpMarketKey(row, sportSlug);
    const name = sharpOutcomeName(row, homeTeam, awayTeam, key);
    if (!name) continue;
    const point = lineValue(row);
    let market = markets.get(key);
    if (!market) {
      market = { key, name: sharpMarketLabel(key, row), outcomes: [] };
      markets.set(key, market);
    }

    const existing = market.outcomes.find(outcome =>
      outcome.name.toLowerCase() === name.toLowerCase() && outcome.point === point,
    );
    if (!existing) {
      market.outcomes.push({ name, price, ...(point !== undefined ? { point } : {}) });
    } else if (price > existing.price) {
      existing.price = price;
    }
  }
  return Array.from(markets.values()).filter(market => market.outcomes.length > 0);
}

async function fetchSharpApiEventRowsForMatch(
  homeTeam: string,
  awayTeam: string,
  kickoffIso: string,
  sportSlug = 'soccer',
): Promise<SharpApiOddsRow[]> {
  const kickoffMs = new Date(kickoffIso).getTime();
  if (!Number.isFinite(kickoffMs)) return [];

  const apiSport = sharpSportSlug(sportSlug);
  const dateKey = new Date(kickoffMs).toISOString().slice(0, 10);
  const cacheKey = `sharpapi-event-rows:${normalizeTeam(homeTeam)}:${normalizeTeam(awayTeam)}:${dateKey}:${apiSport || 'all'}`;
  const cached = getCached<SharpApiOddsRow[]>(cacheKey);
  if (cached) return cached;
  if (!(await getApiKey('sharp_api_key'))) return [];

  const matchingEvents = async (query: string): Promise<SharpApiEvent[]> => {
    const params: Record<string, string> = { q: query, limit: '200' };
    if (apiSport) params.sport = apiSport;
    const result = await sharpFetch<SharpApiCollection<SharpApiEvent>>('events', params);
    return Array.isArray(result?.data) ? result.data : [];
  };

  let event: SharpApiEvent | undefined;
  for (const query of [homeTeam, awayTeam]) {
    const candidates = await matchingEvents(query);
    event = candidates
      .filter(candidate =>
        candidate.id &&
        candidate.home_team &&
        candidate.away_team &&
        teamMatch(candidate.home_team, homeTeam) &&
        teamMatch(candidate.away_team, awayTeam) &&
        candidate.start_time &&
        Number.isFinite(new Date(candidate.start_time).getTime()) &&
        Math.abs(new Date(candidate.start_time).getTime() - kickoffMs) <= 48 * 60 * 60 * 1000,
      )
      .sort((a, b) =>
        Math.abs(new Date(a.start_time!).getTime() - kickoffMs) -
        Math.abs(new Date(b.start_time!).getTime() - kickoffMs),
      )[0];
    if (event) break;
  }

  if (!event?.id) {
    setCached(cacheKey, [], 5 * 60 * 1000);
    return [];
  }

  const response = await sharpFetch<SharpApiCollection<SharpApiOddsRow>>(
    `events/${encodeURIComponent(event.id)}/odds`,
  );
  const rows = Array.isArray(response?.data) ? response.data : [];
  const matchingRows = rows.filter(row =>
    row.home_team && row.away_team &&
    (!row.event_id || row.event_id === event!.id) &&
    teamMatch(row.home_team, homeTeam) &&
    teamMatch(row.away_team, awayTeam),
  );
  setCached(cacheKey, matchingRows, matchingRows.length ? CACHE_TTL_MS : 5 * 60 * 1000);
  return matchingRows;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch every bookmaker-backed market SharpAPI exposes for one event.
 * SharpAPI's current event-odds endpoint returns flat selection rows; do not
 * substitute or derive prices when the provider has no rows for the event.
 */
export async function getSharpApiRealMarkets(
  homeTeam: string,
  awayTeam: string,
  kickoffIso: string,
  sportSlug = 'soccer',
): Promise<Market[]> {
  const rows = await fetchSharpApiEventRowsForMatch(homeTeam, awayTeam, kickoffIso, sportSlug);
  return sharpRowsToMarkets(rows, homeTeam, awayTeam, sportSlug);
}

/**
 * Fetch current main-market odds from SharpAPI and return
 * an index keyed by `${homeNorm}_${awayNorm}_${dateKey}` — the same format
 * used by `buildRealOddsIndex` in unified-sports-api.ts.
 */
export async function buildSharpApiOddsIndex(): Promise<Map<string, { odds: MatchOdds; markets: Market[] }>> {
  const apiKey = await getApiKey('sharp_api_key');
  if (!apiKey) return new Map();

  const cacheKey = 'sharpapi-odds-index';
  const cached = getCached<Map<string, { odds: MatchOdds; markets: Market[] }>>(cacheKey);
  if (cached) return cached;

  const index = new Map<string, { odds: MatchOdds; markets: Market[] }>();
  const res = await sharpFetch<SharpApiCollection<SharpApiOddsRow>>('odds', {
    market: 'main,spread,total',
    limit: '200',
  });

  const byEvent = new Map<string, SharpApiOddsRow[]>();
  for (const row of res?.data || []) {
    if (!row.event_id || !row.home_team || !row.away_team || !row.event_start_time) continue;
    const rows = byEvent.get(row.event_id) || [];
    rows.push(row);
    byEvent.set(row.event_id, rows);
  }

  for (const rows of byEvent.values()) {
    const first = rows[0];
    const markets = sharpRowsToMarkets(rows, first.home_team, first.away_team, first.sport || 'soccer');
    const h2h = markets.find(market => market.key === 'h2h');
    if (!h2h) continue;
    const home = h2h.outcomes.find(outcome => normalizeTeam(outcome.name) === normalizeTeam(first.home_team));
    const away = h2h.outcomes.find(outcome => normalizeTeam(outcome.name) === normalizeTeam(first.away_team));
    const draw = h2h.outcomes.find(outcome => outcome.name.toLowerCase() === 'draw');
    if (!home || !away) continue;

    const eventStartMs = new Date(first.event_start_time!).getTime();
    if (!Number.isFinite(eventStartMs)) continue;
    const dateKey = new Date(eventStartMs).toISOString().slice(0, 10);
    const entry = {
      odds: {
        home: home.price,
        away: away.price,
        ...(draw ? { draw: draw.price } : {}),
        bookmaker: 'SharpAPI best available',
        lastUpdate: new Date(),
      },
      markets,
    };
    const homeKey = normalizeTeam(first.home_team);
    const awayKey = normalizeTeam(first.away_team);
    index.set(`${homeKey}_${awayKey}_${dateKey}`, entry);
    index.set(`${awayKey}_${homeKey}_${dateKey}`, entry);
  }

  if (index.size > 0) {
    setCached(cacheKey, index);
    console.log(`[SharpAPI] Loaded odds for ${index.size / 2} matches`);
  }

  return index;
}

/**
 * Fetch outrights (futures/winner markets) from SharpAPI for a given sport key.
 * Returns an array of outright entries compatible with the Outright type.
 */
export interface SharpOutright {
  team: string;
  price: number;
  bookmaker: string;
}

export async function getSharpApiOutrights(sportKey: string): Promise<SharpOutright[]> {
  const apiKey = await getApiKey('sharp_api_key');
  if (!apiKey) return [];

  const cacheKey = `sharpapi-outrights-${sportKey}`;
  const cached = getCached<SharpOutright[]>(cacheKey);
  if (cached) return cached;

  const res = await sharpFetch<SharpApiCollection<SharpApiOddsRow>>('odds', {
    sport: sharpSportSlug(sportKey) || sportKey,
    include_futures: 'true',
    limit: '200',
  });

  const outrights: SharpOutright[] = [];
  for (const row of res?.data || []) {
    if (!/future|outright|championship|tournament_winner|season_winner/i.test(row.market_type)) continue;
    const price = decimalOdds(row);
    const team = row.selection?.trim();
    if (!team || !price) continue;
    outrights.push({
      team,
      price,
      bookmaker: prettyBmName(row.sportsbook || 'SharpAPI'),
    });
  }

  // Dedupe: keep best price per team
  const best = new Map<string, SharpOutright>();
  for (const o of outrights) {
    const existing = best.get(o.team);
    if (!existing || o.price > existing.price) best.set(o.team, o);
  }

  const result = Array.from(best.values()).sort((a, b) => a.price - b.price);
  if (result.length > 0) setCached(cacheKey, result);
  return result;
}

// ── Per-match bookmaker lines ─────────────────────────────────────────────────

/** Exact normalized team equality avoids attaching odds to a similarly named club. */
function teamMatch(a: string, b: string): boolean {
  const an = normalizeTeam(a);
  const bn = normalizeTeam(b);
  return an.length > 0 && an === bn;
}

export interface SharpBookmakerLine {
  bookmaker: string;
  display: string;
  home: number;
  draw?: number;
  away: number;
}

/**
 * Return per-bookmaker h2h lines from SharpAPI for a specific match.
 * Used as a tertiary fallback in the bookmaker-odds endpoint when both
 * SportsGameOdds and ESPN-embedded odds are empty.
 *
 * Free tier provides DraftKings + FanDuel lines with ~60 s delay.
 */
export async function getSharpApiBookmakerLines(
  homeTeam: string,
  awayTeam: string,
  kickoffIso: string,
  hasDraw: boolean,
  sportSlug = 'soccer',
): Promise<SharpBookmakerLine[]> {
  const rows = await fetchSharpApiEventRowsForMatch(homeTeam, awayTeam, kickoffIso, sportSlug);
  const books = new Map<string, { home?: number; draw?: number; away?: number }>();

  for (const row of rows) {
    if (sharpMarketKey(row, sportSlug) !== 'h2h') continue;
    const price = decimalOdds(row);
    if (!price) continue;

    const book = row.sportsbook?.trim();
    if (!book) continue;
    const selectionType = (row.selection_type || '').toLowerCase();
    const selection = row.selection?.trim() || '';
    const line = books.get(book) || {};
    if (['home', 'home_team', 'team_1', 'participant_1'].includes(selectionType) ||
        ['home', 'home_team', '1'].includes(selection.toLowerCase()) ||
        teamMatch(selection, homeTeam)) {
      if (!line.home || price > line.home) line.home = price;
    }
    else if (['away', 'away_team', 'team_2', 'participant_2'].includes(selectionType) ||
        ['away', 'away_team', '2'].includes(selection.toLowerCase()) ||
        teamMatch(selection, awayTeam)) {
      if (!line.away || price > line.away) line.away = price;
    }
    else if (['draw', 'tie'].includes(selectionType) || ['draw', 'tie', 'x'].includes(selection.toLowerCase())) {
      if (!line.draw || price > line.draw) line.draw = price;
    }
    books.set(book, line);
  }

  return Array.from(books.entries())
    .filter(([, line]) => line.home && line.away)
    .map(([book, line]) => ({
      bookmaker: book.toLowerCase().replace(/[^a-z0-9]/g, ''),
      display: prettyBmName(book),
      home: line.home!,
      away: line.away!,
      ...(hasDraw && line.draw ? { draw: line.draw } : {}),
    }));
}

function prettyBmName(key: string): string {
  const map: Record<string, string> = {
    draftkings: 'DraftKings',
    fanduel: 'FanDuel',
    betmgm: 'BetMGM',
    espnbet: 'ESPN BET',
    caesars: 'Caesars',
  };
  return map[key.toLowerCase()] || key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Test the API key and return basic status information.
 */
export async function testSharpApiKey(): Promise<{ ok: boolean; message: string; detail?: string }> {
  const apiKey = await getApiKey('sharp_api_key');
  if (!apiKey) return { ok: false, message: 'API key not configured' };

  try {
    const res = await fetch(`${BASE}/odds?limit=1`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });

    if (res.status === 401) return { ok: false, message: 'Invalid API key' };
    if (res.status === 403) return { ok: false, message: 'API plan does not allow this endpoint' };
    if (res.status === 429) return { ok: false, message: 'Rate limit exceeded' };
    if (!res.ok) return { ok: false, message: `API error: HTTP ${res.status}` };

    const data = await res.json() as SharpApiCollection<SharpApiOddsRow>;
    _backoffUntil = 0;
    return {
      ok: true,
      message: 'Key valid, API responding',
      detail: `${Array.isArray(data?.data) ? data.data.length : 0} odds rows returned`,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'SharpAPI request timed out'
      : 'Could not reach SharpAPI';
    return { ok: false, message };
  }
}
