/**
 * SportsGameOdds (sportsgameodds.com) adapter.
 *
 * Why we use it: their `/v2/events` response includes a rich
 * `odds.<oddID>.byBookmaker` object that maps each bookmaker
 * (fanduel, draftkings, espnbet, bovada, polymarket, sportsbet,
 * williamhill, betway, 888sport, paddypower, livescorebet, ...)
 * to a decimal price AND, where available, a deeplink to the
 * bet slip — perfect for an Oddspedia-style multi-book comparison
 * panel and outright winner markets.
 *
 * Key resolution order:
 *   1. site_settings.sportsgameodds_api_key (admin panel)
 *   2. process.env.SPORTSGAMEODDS_API_KEY
 */
import { getApiKey } from '@/lib/api-keys';

const BASE = 'https://api.sportsgameodds.com/v2';

// Cache wrapper — kept tiny so we don't hammer their amateur tier
// (50k req/hr / 500k/day / 10/min).
type CacheEntry<T> = { value: T; ts: number };
const sgoCache = new Map<string, CacheEntry<unknown>>();
const SGO_CACHE_TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const e = sgoCache.get(key) as CacheEntry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.ts > SGO_CACHE_TTL_MS) {
    sgoCache.delete(key);
    return null;
  }
  return e.value;
}
function setCached<T>(key: string, value: T): void {
  sgoCache.set(key, { value, ts: Date.now() });
}

let backoffUntil = 0;
const BACKOFF_MS = 30 * 60 * 1000;

async function sgoFetch(path: string, params: Record<string, string> = {}): Promise<unknown | null> {
  const apiKey = await getApiKey('sportsgameodds_api_key');
  if (!apiKey) return null;
  if (Date.now() < backoffUntil) return null;

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const cacheKey = url.toString();
  const cached = getCached<unknown>(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      // Their data updates every few seconds for live, but we cache 5m so
      // 60s revalidation here is fine.
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      // Auth or quota failure — back off so we don't burn the budget.
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        backoffUntil = Date.now() + BACKOFF_MS;
        console.warn(`[SGO] HTTP ${res.status} — backing off for 30 min`);
      }
      return null;
    }
    const json = await res.json();
    setCached(cacheKey, json);
    return json;
  } catch (err) {
    console.warn('[SGO] fetch failed:', err);
    return null;
  }
}

// ─── Types (subset of SGO response we use) ─────────────────────────────

export interface SgoBookmakerOffer {
  /** Decimal odds. */
  odds?: number;
  /** Raw American odds, when SGO sends those instead. */
  americanOdds?: number;
  /** The over/under or spread number. */
  line?: number;
  /** Deeplink to the book's bet slip, when the book exposes one. */
  link?: string;
  /** When this offer was last seen. */
  lastUpdatedAt?: string;
  available?: boolean;
}

export interface SgoOdd {
  oddID: string;
  marketName?: string;
  statID?: string;
  sideID?: string; // home, away, draw, over, under, ...
  byBookmaker?: Record<string, SgoBookmakerOffer>;
  bookOddsAvailable?: boolean;
  closeBookOdds?: number;
  closeBookOverUnder?: number;
}

export interface SgoEvent {
  eventID: string;
  leagueID?: string;
  sportID?: string;
  status?: { displayShort?: string; finalized?: boolean };
  teams?: {
    home?: { teamID?: string; names?: { long?: string; short?: string; medium?: string } };
    away?: { teamID?: string; names?: { long?: string; short?: string; medium?: string } };
  };
  odds?: Record<string, SgoOdd>;
  startsAt?: string;
}

// ─── Bookmaker comparison for a single match ───────────────────────────

export interface SgoBookmakerLine {
  bookmaker: string; // canonical book id (fanduel, draftkings, ...)
  display: string;   // pretty name
  home: number;
  draw?: number;
  away: number;
  /** Optional deeplinks per side. */
  links?: { home?: string; draw?: string; away?: string };
}

const BOOKMAKER_DISPLAY_NAMES: Record<string, string> = {
  fanduel: 'FanDuel',
  draftkings: 'DraftKings',
  espnbet: 'ESPN BET',
  bovada: 'Bovada',
  betmgm: 'BetMGM',
  caesars: 'Caesars',
  pointsbet: 'PointsBet',
  unibet: 'Unibet',
  williamhill: 'William Hill',
  bet365: 'bet365',
  betway: 'Betway',
  '888sport': '888sport',
  paddypower: 'Paddy Power',
  livescorebet: 'LiveScore Bet',
  sportsbet: 'Sportsbet',
  polymarket: 'Polymarket',
  pinnacle: 'Pinnacle',
  betfair: 'Betfair',
  ladbrokes: 'Ladbrokes',
  coral: 'Coral',
  skybet: 'Sky Bet',
  betvictor: 'BetVictor',
  bwin: 'bwin',
};

function prettyBookName(id: string): string {
  return BOOKMAKER_DISPLAY_NAMES[id] || id.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normPart(s?: string): string {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[^\w]/g, '');
}

/**
 * Find an SGO event by team names + ISO date string.
 * Uses the search endpoint with team name and filters by date.
 */
async function findSgoEvent(homeTeam: string, awayTeam: string, isoDate: string): Promise<SgoEvent | null> {
  // Strip the time portion — SGO accepts YYYY-MM-DD on the date filter.
  // Defend against non-string inputs so a malformed match object can't take
  // down the whole match-detail response (we just skip enrichment).
  if (!isoDate || typeof isoDate !== 'string' || isoDate.length < 10) return null;
  const day = isoDate.slice(0, 10);
  // Try a dated lookup first; fall back to a broader window if needed.
  const data = await sgoFetch('/events', {
    teamID: '',
    startsAfter: `${day}T00:00:00Z`,
    startsBefore: `${day}T23:59:59Z`,
    limit: '50',
    includeOpposingTeam: 'true',
  }) as { data?: SgoEvent[] } | null;
  if (!data?.data || !Array.isArray(data.data)) return null;

  const wantHome = normPart(homeTeam);
  const wantAway = normPart(awayTeam);

  for (const ev of data.data) {
    const h = normPart(ev.teams?.home?.names?.long || ev.teams?.home?.names?.medium);
    const a = normPart(ev.teams?.away?.names?.long || ev.teams?.away?.names?.medium);
    if (!h || !a) continue;
    // Match either direction (defensive).
    const direct = h.includes(wantHome) || wantHome.includes(h);
    const directAway = a.includes(wantAway) || wantAway.includes(a);
    if (direct && directAway) return ev;
  }
  return null;
}

function americanToDecimal(am: number | undefined): number | null {
  if (am === undefined || am === null || isNaN(am)) return null;
  if (am === 0) return null;
  return am > 0 ? Math.round((am / 100 + 1) * 100) / 100 : Math.round((100 / Math.abs(am) + 1) * 100) / 100;
}

function offerPrice(offer: SgoBookmakerOffer): number | null {
  if (typeof offer.odds === 'number' && offer.odds > 1) return Math.round(offer.odds * 100) / 100;
  const fromAm = americanToDecimal(offer.americanOdds);
  if (fromAm) return fromAm;
  return null;
}

/**
 * Public: return per-bookmaker 1X2 / moneyline prices for a fixture.
 * Returns [] if SGO has nothing or the fixture can't be matched.
 */
export async function getSgoBookmakerLines(
  homeTeam: string,
  awayTeam: string,
  startsAtIso: string,
  hasDraw: boolean,
): Promise<SgoBookmakerLine[]> {
  const ev = await findSgoEvent(homeTeam, awayTeam, startsAtIso);
  if (!ev?.odds) return [];

  // Find the moneyline / 1X2 odds entries. SGO uses statID="points" and
  // sideID="home"/"away"/"draw" for the canonical 3-way market in soccer,
  // and the moneyline (statID="reg") for 2-way US sports.
  const homeOdd = Object.values(ev.odds).find(
    (o) => o.sideID === 'home' && (o.statID === 'points' || o.statID === 'reg' || /moneyline|match/i.test(o.marketName || '')),
  );
  const awayOdd = Object.values(ev.odds).find(
    (o) => o.sideID === 'away' && (o.statID === 'points' || o.statID === 'reg' || /moneyline|match/i.test(o.marketName || '')),
  );
  const drawOdd = hasDraw
    ? Object.values(ev.odds).find(
        (o) => o.sideID === 'draw' && (o.statID === 'points' || o.statID === 'reg' || /moneyline|match/i.test(o.marketName || '')),
      )
    : undefined;

  if (!homeOdd || !awayOdd) return [];

  // Collect every bookmaker that quotes BOTH home and away.
  const bookIds = new Set<string>();
  for (const id of Object.keys(homeOdd.byBookmaker || {})) bookIds.add(id);
  const lines: SgoBookmakerLine[] = [];
  for (const bookId of bookIds) {
    const ho = homeOdd.byBookmaker?.[bookId];
    const ao = awayOdd.byBookmaker?.[bookId];
    const dro = drawOdd?.byBookmaker?.[bookId];
    if (!ho || !ao) continue;
    const hp = offerPrice(ho);
    const ap = offerPrice(ao);
    if (!hp || !ap) continue;
    const dp = dro ? offerPrice(dro) : null;
    lines.push({
      bookmaker: bookId,
      display: prettyBookName(bookId),
      home: hp,
      draw: dp ?? undefined,
      away: ap,
      links: {
        home: ho.link,
        draw: dro?.link,
        away: ao.link,
      },
    });
  }
  // Sort: those that quote a draw first (more useful for soccer), then alpha.
  lines.sort((a, b) => {
    if (hasDraw) {
      const ad = a.draw ? 0 : 1;
      const bd = b.draw ? 0 : 1;
      if (ad !== bd) return ad - bd;
    }
    return a.display.localeCompare(b.display);
  });
  return lines;
}

// ─── Outright winners via SGO ──────────────────────────────────────────

export interface SgoOutright {
  id: string;
  name: string; // market title
  outcomes: Array<{ name: string; price: number; link?: string }>;
}

const SGO_LEAGUE_MAP: Record<number, string[]> = {
  // Football-data competition id → SGO leagueID(s)
  2021: ['EPL'],          // Premier League
  2014: ['LALIGA'],       // La Liga
  2002: ['BUNDESLIGA'],   // Bundesliga
  2019: ['SERIEA'],       // Serie A
  2015: ['LIGUE1'],       // Ligue 1
  2001: ['UCL'],          // UEFA Champions League
  2018: ['EURO'],         // Euros
  2000: ['WORLD_CUP'],    // World Cup
  4328: ['MLS'],          // Major League Soccer
};

export async function getSgoOutrights(leagueId: number): Promise<SgoOutright[]> {
  const sgoLeagues = SGO_LEAGUE_MAP[leagueId];
  if (!sgoLeagues || sgoLeagues.length === 0) return [];

  const results: SgoOutright[] = [];
  for (const lg of sgoLeagues) {
    const data = await sgoFetch('/futures', { leagueID: lg, limit: '20' }) as { data?: Array<{
      futureID?: string;
      marketName?: string;
      odds?: Record<string, SgoOdd>;
    }> } | null;
    if (!data?.data || !Array.isArray(data.data)) continue;

    for (const fut of data.data) {
      if (!fut.odds) continue;
      // For each outcome (sideID like "team:psg"), take the BEST price across books.
      const outcomes: Array<{ name: string; price: number; link?: string }> = [];
      for (const odd of Object.values(fut.odds)) {
        if (!odd.byBookmaker) continue;
        let bestPrice = 0;
        let bestLink: string | undefined;
        for (const offer of Object.values(odd.byBookmaker)) {
          const p = offerPrice(offer);
          if (p && p > bestPrice) {
            bestPrice = p;
            bestLink = offer.link;
          }
        }
        if (bestPrice > 1) {
          // Use marketName "to win" pattern — sideID like "team:NAME" → just use sideID.
          const name = (odd.sideID || '').replace(/^team:/, '').replace(/_/g, ' ');
          if (name) outcomes.push({ name: name.replace(/\b\w/g, (c) => c.toUpperCase()), price: bestPrice, link: bestLink });
        }
      }
      if (outcomes.length === 0) continue;
      outcomes.sort((a, b) => a.price - b.price);
      results.push({
        id: fut.futureID || `${lg}-${fut.marketName}`,
        name: fut.marketName || `${lg} Winner`,
        outcomes,
      });
    }
  }
  return results;
}
