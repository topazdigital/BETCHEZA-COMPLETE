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
 *
 * Caching strategy (two layers):
 *   1. In-memory Map  — fastest; cleared on restart (5-min TTL)
 *   2. File cache     — survives restarts (.local/data/sgo-cache/); 2-hour TTL
 * The file cache is the key protection against wasting daily quota on restarts.
 */
import fs from 'fs';
import path from 'path';
import { getApiKey } from '@/lib/api-keys';

const BASE = 'https://api.sportsgameodds.com/v2';

// ─── In-memory cache ────────────────────────────────────────────────────
type CacheEntry<T> = { value: T; ts: number };
const sgoCache = new Map<string, CacheEntry<unknown>>();
const SGO_MEM_TTL_MS  = 5 * 60 * 1000;   // 5 min — hot data

function getMemCached<T>(key: string): T | null {
  const e = sgoCache.get(key) as CacheEntry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.ts > SGO_MEM_TTL_MS) { sgoCache.delete(key); return null; }
  return e.value;
}
function setMemCached<T>(key: string, value: T): void {
  sgoCache.set(key, { value, ts: Date.now() });
}

// ─── File cache — survives restarts ────────────────────────────────────
const SGO_FILE_CACHE_DIR = path.join(process.cwd(), '.local', 'data', 'sgo-cache');
const SGO_FILE_TTL_MS    = 2 * 60 * 60 * 1000; // 2 hours

/** Stable filename from URL — base64url, max 80 chars. */
function urlToFilename(url: string): string {
  const b64 = Buffer.from(url).toString('base64url');
  return b64.slice(0, 80) + '.json';
}

function getFileCache<T>(url: string): T | null {
  try {
    const fp = path.join(SGO_FILE_CACHE_DIR, urlToFilename(url));
    if (!fs.existsSync(fp)) return null;
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8')) as CacheEntry<T>;
    if (Date.now() - raw.ts > SGO_FILE_TTL_MS) { fs.unlinkSync(fp); return null; }
    return raw.value;
  } catch { return null; }
}

function setFileCache<T>(url: string, value: T): void {
  try {
    fs.mkdirSync(SGO_FILE_CACHE_DIR, { recursive: true });
    const fp = path.join(SGO_FILE_CACHE_DIR, urlToFilename(url));
    fs.writeFileSync(fp, JSON.stringify({ value, ts: Date.now() }));
  } catch { /* ignore write errors */ }
}

// ─── Rate-limit / auth backoff ──────────────────────────────────────────
// Auth failures (401/403) back off for 30 min — key is invalid/suspended.
// Rate-limit hits (429) back off for only 5 min — quota refreshes quickly.
let authBackoffUntil = 0;
let rateLimitBackoffUntil = 0;
const AUTH_BACKOFF_MS = 30 * 60 * 1000;
const RATE_BACKOFF_MS =  5 * 60 * 1000;

async function sgoFetch(path_: string, params: Record<string, string> = {}): Promise<unknown | null> {
  const apiKey = await getApiKey('sportsgameodds_api_key');
  if (!apiKey) return null;

  const url = new URL(`${BASE}${path_}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const urlStr = url.toString();

  // 1. In-memory cache hit
  const memHit = getMemCached<unknown>(urlStr);
  if (memHit !== null) return memHit;

  // 2. File cache hit — warm in-memory too so subsequent calls are fast
  const fileHit = getFileCache<unknown>(urlStr);
  if (fileHit !== null) {
    setMemCached(urlStr, fileHit);
    return fileHit;
  }

  // 3. Backoff guards (only checked when we'd actually hit the network)
  if (Date.now() < authBackoffUntil) return null;
  if (Date.now() < rateLimitBackoffUntil) return null;

  try {
    const res = await fetch(urlStr, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        authBackoffUntil = Date.now() + AUTH_BACKOFF_MS;
        console.warn(`[SGO] HTTP ${res.status} — auth error, backing off 30 min`);
      } else if (res.status === 429) {
        rateLimitBackoffUntil = Date.now() + RATE_BACKOFF_MS;
        console.warn('[SGO] HTTP 429 — rate limited, backing off 5 min');
      }
      return null;
    }
    const json = await res.json();
    setMemCached(urlStr, json);
    setFileCache(urlStr, json);   // persist so restarts reuse this data
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
 *
 * Resolution order:
 *   1. `_bulkBookmakerLines` — already extracted from the 30-min bulk fetch,
 *      no extra API call needed.
 *   2. Per-match SGO `/events` lookup — only when bulk data is absent.
 *
 * Returns [] if SGO has nothing or the fixture can't be matched.
 */
export async function getSgoBookmakerLines(
  homeTeam: string,
  awayTeam: string,
  startsAtIso: string,
  hasDraw: boolean,
): Promise<SgoBookmakerLine[]> {
  // Fast path: use per-bookmaker data already extracted from bulk fetch
  const bulkLines = getBulkBookmakerLines(homeTeam, awayTeam, startsAtIso);
  if (bulkLines && bulkLines.length > 0) return bulkLines;

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

// ─── Bulk match odds for the match list ───────────────────────────────

/**
 * Simple per-match normalization that matches `normalizeTeamName()` in
 * unified-sports-api.ts so index keys are compatible.
 */
function normalizeForIndex(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|cfc|acf|ac|as|ss|bsc|fk|sk|rc|club|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export interface SgoMatchOddsEntry {
  homeNorm: string;
  awayNorm: string;
  /** YYYY-MM-DD */
  dateKey: string;
  home: number;
  draw?: number;
  away: number;
  bookmaker: string;
}

/**
 * Bulk-fetch upcoming events from SGO for the given date window and extract
 * 1X2 / moneyline odds for each fixture.  Uses the best price available
 * across all bookmakers (or `closeBookOdds` when present).
 *
 * Side effect: populates `_bulkBookmakerLines` so that
 * `getSgoBookmakerLines()` can answer comparison-widget requests from this
 * single bulk payload without extra per-match API calls.
 *
 * Called by `buildRealOddsIndex()` in unified-sports-api.ts when The Odds
 * API key is not configured — this is the primary source of match-list odds.
 */

/**
 * In-process store: team-pair key → per-bookmaker lines.
 * Populated as a by-product of `fetchSgoBulkMatchOdds` so the comparison
 * widget gets real bookmaker data without additional SGO requests.
 */
const _bulkBookmakerLines = new Map<string, SgoBookmakerLine[]>();

export function getBulkBookmakerLines(homeTeam: string, awayTeam: string, dateIso: string): SgoBookmakerLine[] | null {
  const dateKey = (dateIso || '').slice(0, 10);
  const hn = normalizeForIndex(homeTeam);
  const an = normalizeForIndex(awayTeam);
  return (
    _bulkBookmakerLines.get(`${hn}_${an}_${dateKey}`) ??
    _bulkBookmakerLines.get(`${an}_${hn}_${dateKey}`) ??
    null
  );
}

export async function fetchSgoBulkMatchOdds(
  startsAfter: string,
  startsBefore: string,
): Promise<SgoMatchOddsEntry[]> {
  const data = await sgoFetch('/events', {
    startsAfter,
    startsBefore,
    limit: '200',
    includeOpposingTeam: 'true',
  }) as { data?: SgoEvent[] } | null;

  if (!data?.data || !Array.isArray(data.data)) return [];

  const result: SgoMatchOddsEntry[] = [];

  for (const ev of data.data) {
    if (!ev.odds || !ev.teams?.home || !ev.teams?.away) continue;
    if (!ev.startsAt) continue;

    const homeName = ev.teams.home.names?.long || ev.teams.home.names?.medium || ev.teams.home.names?.short || '';
    const awayName = ev.teams.away.names?.long || ev.teams.away.names?.medium || ev.teams.away.names?.short || '';
    if (!homeName || !awayName) continue;

    const homeNorm = normalizeForIndex(homeName);
    const awayNorm = normalizeForIndex(awayName);
    if (!homeNorm || !awayNorm) continue;

    const dateKey = ev.startsAt.slice(0, 10);

    // Find the canonical 1X2 / moneyline odds entries
    const oddsValues = Object.values(ev.odds);
    const homeOdd = oddsValues.find(o =>
      o.sideID === 'home' &&
      (o.statID === 'points' || o.statID === 'reg' || /moneyline|match.?winner|1x2/i.test(o.marketName || '')),
    );
    const awayOdd = oddsValues.find(o =>
      o.sideID === 'away' &&
      (o.statID === 'points' || o.statID === 'reg' || /moneyline|match.?winner|1x2/i.test(o.marketName || '')),
    );
    const drawOdd = oddsValues.find(o =>
      o.sideID === 'draw' &&
      (o.statID === 'points' || o.statID === 'reg' || /moneyline|match.?winner|1x2/i.test(o.marketName || '')),
    );

    if (!homeOdd || !awayOdd) continue;

    // Best price across bookmakers, or fall back to closeBookOdds
    const bestPrice = (odd: SgoOdd): number | null => {
      if (typeof odd.closeBookOdds === 'number' && odd.closeBookOdds > 1) {
        return Math.round(odd.closeBookOdds * 100) / 100;
      }
      if (!odd.byBookmaker) return null;
      let best = 0;
      for (const offer of Object.values(odd.byBookmaker)) {
        const p = offerPrice(offer);
        if (p && p > best) best = p;
      }
      return best > 1 ? Math.round(best * 100) / 100 : null;
    };

    const hp = bestPrice(homeOdd);
    const ap = bestPrice(awayOdd);
    const dp = drawOdd ? bestPrice(drawOdd) : null;
    if (!hp || !ap) continue;

    // Pick a display bookmaker name from whatever books quoted the home side
    const topBook = homeOdd.byBookmaker
      ? (Object.keys(homeOdd.byBookmaker)[0] ?? 'SportsGameOdds')
      : 'SportsGameOdds';

    result.push({
      homeNorm,
      awayNorm,
      dateKey,
      home: hp,
      draw: dp ?? undefined,
      away: ap,
      bookmaker: prettyBookName(topBook),
    });

    // ── Side-effect: build per-bookmaker comparison lines from bulk payload ──
    // Collect every bookmaker that has both home and away prices.
    const hasDraw = !!drawOdd;
    const bookIds = new Set<string>(Object.keys(homeOdd.byBookmaker ?? {}));
    const lines: SgoBookmakerLine[] = [];
    for (const bookId of bookIds) {
      const ho = homeOdd.byBookmaker?.[bookId];
      const ao = awayOdd.byBookmaker?.[bookId];
      const dro = drawOdd?.byBookmaker?.[bookId];
      if (!ho || !ao) continue;
      const hpb = offerPrice(ho);
      const apb = offerPrice(ao);
      if (!hpb || !apb) continue;
      const dpb = dro ? offerPrice(dro) : null;
      lines.push({
        bookmaker: bookId,
        display: prettyBookName(bookId),
        home: hpb,
        draw: hasDraw && dpb ? dpb : undefined,
        away: apb,
        links: { home: ho.link, draw: dro?.link, away: ao.link },
      });
    }
    if (lines.length > 0) {
      // Sort: books with draw first (soccer), then alpha
      lines.sort((a, b) => {
        if (hasDraw) {
          const ad = a.draw ? 0 : 1, bd = b.draw ? 0 : 1;
          if (ad !== bd) return ad - bd;
        }
        return a.display.localeCompare(b.display);
      });
      const key1 = `${homeNorm}_${awayNorm}_${dateKey}`;
      const key2 = `${awayNorm}_${homeNorm}_${dateKey}`;
      _bulkBookmakerLines.set(key1, lines);
      _bulkBookmakerLines.set(key2, lines);
    }
  }

  return result;
}

// ─── Outright winners via SGO ──────────────────────────────────────────

export interface SgoOutright {
  id: string;
  name: string; // market title
  outcomes: Array<{ name: string; price: number; link?: string }>;
}

const SGO_LEAGUE_MAP: Record<number, string[]> = {
  // Our internal ESPN leagueId → SGO leagueID(s)
  1:  ['EPL'],          // Premier League
  2:  ['LALIGA'],       // La Liga
  3:  ['BUNDESLIGA'],   // Bundesliga
  4:  ['SERIEA'],       // Serie A
  5:  ['LIGUE1'],       // Ligue 1
  9:  ['UCL'],          // UEFA Champions League
  10: ['UEFAROPA'],     // Europa League
  11: ['MLS'],          // Major League Soccer
  6:  ['EREDIVISIE'],   // Eredivisie
  7:  ['PRIMEIRALIGA'], // Primeira Liga
  12: ['BRASILEIRAO'],  // Brazilian Serie A
  13: ['LIGAPROFESIONAL'], // Argentine Primera
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
