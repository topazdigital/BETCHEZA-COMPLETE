/**
 * SharpAPI (sharpapi.io) adapter.
 *
 * Provides real-time odds from DraftKings & FanDuel (free tier).
 * Used as a supplementary odds source when The Odds API or SportsGameOdds
 * don't have coverage for a match.
 *
 * Free-tier limits:
 *   - 12 req/min
 *   - 2 sportsbooks (DraftKings + FanDuel)
 *   - 60 s data delay
 *   - Markets: moneylines & spreads
 *
 * Auth: X-API-Key header  OR  Authorization: Bearer <key>
 * Base URL: https://api.sharpapi.io/api/v1
 */

import { getApiKey } from '@/lib/api-keys';
import type { MatchOdds, Market, Outcome } from './unified-sports-api';

const BASE = 'https://api.sharpapi.io/api/v1';

// ── Cache ────────────────────────────────────────────────────────────────────
// 30-min TTL. Free tier has 60s data delay anyway, and longer TTL prevents
// the "restart storm" pattern: PM2 restart → cache cleared → 10+ API calls
// before cache warms → rate limit hit → 429s logged every restart.
const CACHE_TTL_MS = 30 * 60 * 1000;

// ── Circuit breaker ───────────────────────────────────────────────────────────
// If SharpAPI returns HTTP 400 (bad request / wrong endpoint params) we back
// off for 2 hours — 400 means the API is misconfigured, not a transient error.
// If it returns 429 (rate limit) we back off for 10 minutes.
let _backoffUntil = 0;
let _backoffReason = '';

function isCircuitOpen(): boolean {
  if (_backoffUntil && Date.now() < _backoffUntil) return true;
  _backoffUntil = 0;
  return false;
}

function tripCircuit(reason: '400' | '429') {
  const ms = reason === '400' ? 2 * 60 * 60 * 1000 : 10 * 60 * 1000;
  _backoffUntil = Date.now() + ms;
  _backoffReason = reason;
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const e = cache.get(key) as CacheEntry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return e.data;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

// ── Types (SharpAPI response shape) ─────────────────────────────────────────
interface SharpBookmaker {
  key: string;
  title?: string;
  markets: SharpMarket[];
}

interface SharpMarket {
  key: string;
  outcomes: SharpOutcome[];
}

interface SharpOutcome {
  name: string;
  price: number;
  point?: number;
}

interface SharpEvent {
  event_id?: string;
  id?: string;
  sport?: string;
  sport_key?: string;
  league?: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers?: SharpBookmaker[];
}

interface SharpOddsResponse {
  data?: SharpEvent[];
  events?: SharpEvent[];
}

// ── Sport key mappings ───────────────────────────────────────────────────────
// Maps SharpAPI sport slugs to the same values used by the rest of the app.
// Free tier covers US sports primarily.
const SHARP_SPORTS = [
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'basketball_nba',
  'basketball_ncaab',
  'baseball_mlb',
  'icehockey_nhl',
  'soccer_epl',
  'soccer_usa_mls',
  'mma_mixed_martial_arts',
];

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
      tripCircuit('400');
      return null;
    }
    if (res.status === 429) {
      console.warn('[SharpAPI] Rate limit hit — backing off 10 min');
      tripCircuit('429');
      return null;
    }
    if (res.status === 400) {
      console.warn(`[SharpAPI] HTTP 400 — bad request params, disabling for 2h`);
      tripCircuit('400');
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

// ── Odds aggregation helpers ─────────────────────────────────────────────────

function aggregateSharpOdds(ev: SharpEvent): { odds: MatchOdds | null; markets: Market[] } {
  if (!ev.bookmakers?.length) return { odds: null, markets: [] };

  let bestHomeOdds = 0;
  let bestDrawOdds = 0;
  let bestAwayOdds = 0;
  let bestBookmaker = '';
  const marketMap = new Map<string, Market>();

  for (const bm of ev.bookmakers) {
    for (const mkt of bm.markets) {
      if (mkt.key === 'h2h') {
        const homeO = mkt.outcomes.find(o => o.name === ev.home_team || o.name === 'Home');
        const awayO = mkt.outcomes.find(o => o.name === ev.away_team || o.name === 'Away');
        const drawO = mkt.outcomes.find(o => o.name === 'Draw');

        const h = homeO?.price || 0;
        const a = awayO?.price || 0;

        if (h > bestHomeOdds && a > 0) {
          bestHomeOdds = h;
          bestAwayOdds = a;
          bestDrawOdds = drawO?.price || 0;
          bestBookmaker = bm.title || bm.key;
        }
      }

      // Collect all markets
      const existing = marketMap.get(mkt.key);
      if (!existing) {
        const outcomes: Outcome[] = mkt.outcomes.map(o => ({
          name: o.name,
          price: o.price,
          ...(o.point !== undefined ? { point: o.point } : {}),
        }));
        marketMap.set(mkt.key, {
          key: mkt.key,
          name: marketKeyLabel(mkt.key),
          outcomes,
        });
      } else {
        // Merge best prices
        for (const o of mkt.outcomes) {
          const ex = existing.outcomes.find(x => x.name === o.name);
          if (!ex) {
            existing.outcomes.push({ name: o.name, price: o.price, ...(o.point !== undefined ? { point: o.point } : {}) });
          } else if (o.price > ex.price) {
            ex.price = o.price;
          }
        }
      }
    }
  }

  if (bestHomeOdds === 0 || bestAwayOdds === 0) return { odds: null, markets: [] };

  const odds: MatchOdds = {
    home: bestHomeOdds,
    away: bestAwayOdds,
    ...(bestDrawOdds > 0 ? { draw: bestDrawOdds } : {}),
    bookmaker: bestBookmaker,
    lastUpdate: new Date(),
  };

  return { odds, markets: Array.from(marketMap.values()) };
}

function marketKeyLabel(key: string): string {
  const map: Record<string, string> = {
    h2h: 'Match Winner',
    spreads: 'Point Spread',
    totals: 'Over/Under',
    outrights: 'Outright Winner',
  };
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

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch current odds from SharpAPI for all configured sports and return
 * an index keyed by `${homeNorm}_${awayNorm}_${dateKey}` — the same format
 * used by `buildRealOddsIndex` in unified-sports-api.ts.
 */
export async function buildSharpApiOddsIndex(): Promise<Map<string, { odds: MatchOdds; markets: Market[] }>> {
  const apiKey = await getApiKey('sharp_api_key');
  if (!apiKey) return new Map();

  const cacheKey = 'sharpapi-odds-index';
  const cached = getCached<Map<string, { odds: MatchOdds; markets: Market[] }>>(cacheKey);
  if (cached) return cached;

  // Free tier: fetch odds for all sports in one call if supported, otherwise
  // fetch per-sport (rate-limited to avoid hitting 12 req/min cap).
  const index = new Map<string, { odds: MatchOdds; markets: Market[] }>();

  // Try fetching all sports at once (most efficient on free tier)
  const res = await sharpFetch<SharpOddsResponse>('odds', {
    oddsFormat: 'decimal',
    markets: 'h2h,spreads',
  });

  const events: SharpEvent[] = res?.data || res?.events || [];

  // Only attempt per-sport fallback if:
  //  a) we got a valid response but 0 events (not a 400/429)
  //  b) the circuit is still closed (no 400/429 tripped it)
  if (events.length === 0 && !isCircuitOpen()) {
    for (const sport of SHARP_SPORTS) {
      if (isCircuitOpen()) break;
      const sportRes = await sharpFetch<SharpOddsResponse>('odds', {
        sport,
        oddsFormat: 'decimal',
        markets: 'h2h,spreads',
      });
      const sportEvents: SharpEvent[] = sportRes?.data || sportRes?.events || [];
      events.push(...sportEvents);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  for (const ev of events) {
    const { odds, markets } = aggregateSharpOdds(ev);
    if (!odds) continue;

    const home = normalizeTeam(ev.home_team);
    const away = normalizeTeam(ev.away_team);
    const dateKey = new Date(ev.commence_time).toISOString().split('T')[0];

    index.set(`${home}_${away}_${dateKey}`, { odds, markets });
    index.set(`${away}_${home}_${dateKey}`, { odds, markets });
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

  const res = await sharpFetch<SharpOddsResponse>('odds', {
    sport: sportKey,
    oddsFormat: 'decimal',
    markets: 'outrights',
  });

  const events: SharpEvent[] = res?.data || res?.events || [];
  const outrights: SharpOutright[] = [];

  for (const ev of events) {
    for (const bm of ev.bookmakers || []) {
      for (const mkt of bm.markets) {
        if (mkt.key !== 'outrights') continue;
        for (const o of mkt.outcomes) {
          outrights.push({
            team: o.name,
            price: o.price,
            bookmaker: bm.title || bm.key,
          });
        }
      }
    }
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

/** Raw SharpAPI event cache — kept separate so it can be shared by both the index and per-match lookup. */
let rawEventsCache: { data: SharpEvent[]; ts: number } | null = null;

async function getRawEvents(): Promise<SharpEvent[]> {
  if (rawEventsCache && Date.now() - rawEventsCache.ts < CACHE_TTL_MS) {
    return rawEventsCache.data;
  }

  const apiKey = await getApiKey('sharp_api_key');
  if (!apiKey) return [];

  const res = await sharpFetch<SharpOddsResponse>('odds', {
    oddsFormat: 'decimal',
    markets: 'h2h',
  });

  const events: SharpEvent[] = res?.data || res?.events || [];
  if (events.length > 0) rawEventsCache = { data: events, ts: Date.now() };
  return events;
}

/** Fuzzy team-name equality — strips non-alphanumeric and compares 5-char prefix. */
function teamMatch(a: string, b: string): boolean {
  const an = normalizeTeam(a);
  const bn = normalizeTeam(b);
  if (an === bn) return true;
  const minLen = Math.min(an.length, bn.length);
  return minLen >= 4 && an.slice(0, minLen) === bn.slice(0, minLen);
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
): Promise<SharpBookmakerLine[]> {
  const events = await getRawEvents();
  if (!events.length) return [];

  const dateKey = kickoffIso.split('T')[0];

  const ev = events.find(e => {
    const d = new Date(e.commence_time).toISOString().split('T')[0];
    return (
      d === dateKey &&
      teamMatch(e.home_team, homeTeam) &&
      teamMatch(e.away_team, awayTeam)
    );
  });

  if (!ev?.bookmakers?.length) return [];

  const lines: SharpBookmakerLine[] = [];
  for (const bm of ev.bookmakers) {
    const h2h = bm.markets.find(m => m.key === 'h2h');
    if (!h2h) continue;

    const homeO = h2h.outcomes.find(o => o.name === ev.home_team || o.name === 'Home');
    const awayO = h2h.outcomes.find(o => o.name === ev.away_team || o.name === 'Away');
    const drawO = h2h.outcomes.find(o => o.name === 'Draw');

    if (!homeO || !awayO) continue;

    const bookId = bm.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    lines.push({
      bookmaker: bookId,
      display: bm.title || prettyBmName(bm.key),
      home: homeO.price,
      away: awayO.price,
      ...(hasDraw && drawO ? { draw: drawO.price } : {}),
    });
  }

  return lines;
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

  const res = await fetch(`${BASE}/odds?oddsFormat=decimal&markets=h2h`, {
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(8_000),
  });

  if (res.status === 401) return { ok: false, message: 'Invalid API key' };
  if (res.status === 429) return { ok: false, message: 'Rate limit exceeded' };
  if (!res.ok) return { ok: false, message: `API error: HTTP ${res.status}` };

  const data = await res.json() as SharpOddsResponse;
  const count = (data?.data || data?.events || []).length;
  return {
    ok: true,
    message: 'Key valid, API responding',
    detail: `${count} events returned`,
  };
}
