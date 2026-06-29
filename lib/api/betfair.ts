// ============================================================
// Betfair Exchange — free developer API
// Provides live in-play (and pre-match) exchange odds.
// Exchange odds are often better than bookmaker odds (no margin).
//
// Setup (one-time):
//   1. Create a free account at betfair.com
//   2. Visit developer.betfair.com → API Access → Create application
//   3. Get your App Key (non-interactive / delayed-data key is free)
//   4. Set Replit secrets:
//        BETFAIR_APP_KEY   — your application key
//        BETFAIR_USERNAME  — your Betfair email/username
//        BETFAIR_PASSWORD  — your Betfair password
//
// Authentication: session token from password login; valid 20h; auto-refreshed.
// ============================================================

import { directFetch } from './proxy-fetch';

// Betfair's own API servers are accessible directly (legitimate JSON API).
// The CF Worker proxy only supports GET requests; Betfair uses POST.
// So we always use directFetch here.

const BF_API_BASE  = 'https://api.betfair.com/exchange/betting/rest/v1.0';
const BF_LOGIN_URL = 'https://identitysso.betfair.com/api/login';

// Betfair event type IDs
const SPORT_EVENT_TYPE: Record<string, string> = {
  football:          '1',
  soccer:            '1',
  tennis:            '2',
  cricket:           '4',
  rugby:             '5',
  'rugby-union':     '5',
  rugbyunion:        '5',
  'rugby-league':    '1477',
  rugbyleague:       '1477',
  basketball:        '7',
  baseball:          '11',
  'ice-hockey':      '7524',
  icehockey:         '7524',
  hockey:            '7524',
  darts:             '3503',
  volleyball:        '998917',
  snooker:           '6422',
  mma:               '26420387',
  boxing:            '6',
  cycling:           '11',
  golf:              '3',
};

interface BetfairSession {
  token:   string;
  expires: number;
}

interface BetfairMarketCatalogue {
  marketId:   string;
  marketName: string;
  event?:     { id: string; name: string; countryCode?: string; openDate: string };
  totalMatched?: number;
}

interface BetfairRunner {
  selectionId:       number;
  runnerName?:       string;
  lastPriceTraded?:  number;
  ex?: {
    availableToBack?: Array<{ price: number; size: number }>;
    availableToLay?:  Array<{ price: number; size: number }>;
  };
}

interface BetfairMarketBook {
  marketId:  string;
  status:    string;
  inplay:    boolean;
  runners:   BetfairRunner[];
}

// ── Session token management ─────────────────────────────────────────────────

let _session: BetfairSession | null = null;
let _loginInFlight: Promise<string | null> | null = null;

async function getSessionToken(): Promise<string | null> {
  const appKey  = process.env.BETFAIR_APP_KEY;
  const user    = process.env.BETFAIR_USERNAME;
  const pass    = process.env.BETFAIR_PASSWORD;
  if (!appKey || !user || !pass) return null;

  // Use cached token if still valid (with 10-min buffer)
  if (_session && _session.expires > Date.now() + 10 * 60_000) return _session.token;

  // Deduplicate concurrent login requests
  if (_loginInFlight) return _loginInFlight;
  _loginInFlight = (async (): Promise<string | null> => {
    try {
      const body = new URLSearchParams({ username: user, password: pass }).toString();
      const res = await directFetch(BF_LOGIN_URL, {
        method: 'POST',
        headers: {
          'X-Application':  appKey,
          'Content-Type':   'application/x-www-form-urlencoded',
          Accept:           'application/json',
        },
        body,
        timeoutMs: 10_000,
      });
      if (!res.ok) {
        console.warn('[Betfair] login failed HTTP', res.status);
        return null;
      }
      const data = (await res.json()) as { token?: string; status?: string; error?: string };
      if (data.status !== 'SUCCESS' || !data.token) {
        console.warn('[Betfair] login error:', data.error ?? data.status);
        return null;
      }
      // Token valid for 20h; cache for 19h
      _session = { token: data.token, expires: Date.now() + 19 * 3_600_000 };
      return _session.token;
    } catch (e) {
      console.warn('[Betfair] login exception:', (e as Error).message);
      return null;
    } finally {
      _loginInFlight = null;
    }
  })();
  return _loginInFlight;
}

// ── API call helper ──────────────────────────────────────────────────────────

async function bfPost<T>(endpoint: string, body: unknown): Promise<T | null> {
  const appKey = process.env.BETFAIR_APP_KEY;
  if (!appKey) return null;
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const res = await directFetch(`${BF_API_BASE}/${endpoint}/`, {
      method: 'POST',
      headers: {
        'X-Application':    appKey,
        'X-Authentication': token,
        'Content-Type':     'application/json',
        Accept:             'application/json',
      },
      body: JSON.stringify(body),
      timeoutMs: 10_000,
    });

    if (res.status === 401 || res.status === 403) {
      _session = null; // force re-login next time
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Market catalogue cache ───────────────────────────────────────────────────
// Key: `${eventTypeId}_${dayString}` — cached 5 minutes
const catalogueCache = new Map<string, { data: BetfairMarketCatalogue[]; expires: number }>();

async function getMarketsForSportDay(
  eventTypeId: string,
  fromISO: string,
  toISO: string,
  inPlay: boolean,
): Promise<BetfairMarketCatalogue[]> {
  const day = fromISO.slice(0, 10);
  const cacheKey = `${eventTypeId}_${day}_${inPlay ? 'live' : 'pre'}`;
  const hit = catalogueCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data;

  const result = await bfPost<BetfairMarketCatalogue[]>('listMarketCatalogue', {
    filter: {
      eventTypeIds: [eventTypeId],
      marketStartTime: { from: fromISO, to: toISO },
      ...(inPlay ? { inPlayOnly: true } : {}),
    },
    marketProjection: ['EVENT', 'MARKET_START_TIME'],
    sort: 'FIRST_TO_START',
    maxResults: 200,
  });

  const data = result ?? [];
  catalogueCache.set(cacheKey, { data, expires: Date.now() + 5 * 60_000 });
  return data;
}

// ── Book price fetching ──────────────────────────────────────────────────────

async function getMarketBook(marketId: string): Promise<BetfairMarketBook | null> {
  const result = await bfPost<BetfairMarketBook[]>('listMarketBook', {
    marketIds: [marketId],
    priceProjection: {
      priceData:  ['EX_BEST_OFFERS'],
      exBestOffersOverrides: { bestPricesDepth: 1 },
      rollup:     'LIMIT',
      rollupLimit: 2,
    },
    orderProjection:  'EXECUTABLE',
    matchProjection:  'NO_ROLLUP',
  });
  return result?.[0] ?? null;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface BetfairOdds {
  bookmaker: string;
  home:  number;
  draw?: number;
  away:  number;
  source: 'betfair';
  inPlay: boolean;
}

/**
 * Look up Betfair Exchange best back prices for a match.
 * Tries in-play first (for live matches) then pre-match.
 * Returns null when Betfair credentials are not configured or the match isn't found.
 */
export async function getBetfairOdds(
  homeTeam: string,
  awayTeam: string,
  sportSlug: string,
  kickoffMs: number,
  isLive: boolean,
): Promise<BetfairOdds | null> {
  const appKey = process.env.BETFAIR_APP_KEY;
  if (!appKey) return null;

  const eventTypeId = SPORT_EVENT_TYPE[sportSlug.toLowerCase().replace(/[-\s]/g, '')] ?? SPORT_EVENT_TYPE[sportSlug];
  if (!eventTypeId) return null;

  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hNorm = norm(homeTeam);
  const aNorm = norm(awayTeam);

  // Build date window: 2h before kickoff → 3h after (covers live + upcoming)
  const windowStart = new Date(kickoffMs - 2 * 3_600_000).toISOString();
  const windowEnd   = new Date(kickoffMs + 3 * 3_600_000).toISOString();

  // Fetch markets — try in-play first for live matches
  const markets = await getMarketsForSportDay(eventTypeId, windowStart, windowEnd, isLive);

  // Find the market whose event name matches both team names
  const found = markets.find(m => {
    const evName = norm(m.event?.name ?? m.marketName ?? '');
    const hasHome = evName.includes(hNorm) || hNorm.split('').every(c => evName.includes(c));
    const hasAway = evName.includes(aNorm) || aNorm.split('').every(c => evName.includes(c));
    // Simple: both team name fragments present in event name
    const homeWords = homeTeam.toLowerCase().split(/\s+/);
    const awayWords = awayTeam.toLowerCase().split(/\s+/);
    const evLower = (m.event?.name ?? m.marketName ?? '').toLowerCase();
    const homeMatch = homeWords.some(w => w.length > 2 && evLower.includes(w));
    const awayMatch = awayWords.some(w => w.length > 2 && evLower.includes(w));
    return (homeMatch && awayMatch) || (hasHome && hasAway);
  });

  if (!found) return null;

  // Get real-time prices
  const book = await getMarketBook(found.marketId);
  if (!book?.runners?.length) return null;

  // Runners: [0]=home, [1]=draw (if exists), [2]=away  OR  [0]=home, [1]=away
  const runners = book.runners;
  const bestBack = (r: BetfairRunner): number => r.ex?.availableToBack?.[0]?.price ?? 0;

  let home = 0, draw: number | undefined, away = 0;

  if (runners.length === 3) {
    // 3-way market (football)
    home = bestBack(runners[0]);
    draw = bestBack(runners[1]);
    away = bestBack(runners[2]);
  } else if (runners.length >= 2) {
    // 2-way market (tennis, basketball, etc.)
    home = bestBack(runners[0]);
    away = bestBack(runners[1]);
  }

  if (!home || !away || home < 1.01 || away < 1.01) return null;

  return {
    bookmaker: 'betfair',
    home:  Math.round(home * 100) / 100,
    draw:  draw && draw > 1 ? Math.round(draw * 100) / 100 : undefined,
    away:  Math.round(away * 100) / 100,
    source: 'betfair',
    inPlay: book.inplay,
  };
}

/** Returns true when Betfair credentials are fully configured. */
export function isBetfairConfigured(): boolean {
  return Boolean(
    process.env.BETFAIR_APP_KEY &&
    process.env.BETFAIR_USERNAME &&
    process.env.BETFAIR_PASSWORD,
  );
}
