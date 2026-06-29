// ============================================================
// Pinnacle — public guest API (no key required)
// Used by odds comparison sites. Returns Pinnacle's own lines
// for football, basketball, tennis, esports, and more.
// Returns empty silently on failure (rate limits, timeouts).
// ============================================================

const PINNACLE_BASE = 'https://guest.api.arcadia.pinnacle.com/0.1';
const CACHE_MS      = 5 * 60 * 1000;   // 5 min per sport
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Pinnacle sport IDs — verified against the guest API
const SPORT_ID_MAP: Record<string, number> = {
  soccer:           29,
  football:         29,
  basketball:       4,
  baseball:         3,
  americanfootball: 15,
  hockey:           19,
  icehockey:        19,
  tennis:           33,
  tabletennis:      35,
  badminton:        31,
  volleyball:       23,
  mma:              23,
  boxing:           10,
  esports:          12,
  darts:            28,
  rugby:            16,
  rugbyleague:      16,
  snooker:          18,
  // Cricket is NOT on Pinnacle — skip to avoid wrong sport fetch
};

interface PinnacleMatchup {
  id: number;
  parentId?: number;
  key?: string;
  status: 'open' | 'offline' | string;
  startTime: string;
  special?: unknown;
  period?: number;
  type: 'matchup' | string;
  home?: string;
  away?: string;
  draw?: string;
  units?: string;
  league?: { id: number; name: string; sport?: { id: number; name: string } };
  participants?: Array<{
    alignment: 'home' | 'away' | 'draw';
    id: number;
    name: string;
    rotation?: number;
  }>;
  units_raw?: string;
  matchupId?: number;
}

interface PinnaclePrice {
  participantId?: number;
  designation?: string;   // 'home' | 'away' | 'draw'
  price: number;          // American / Moneyline format
  points?: number;        // spread / total line
}

interface PinnacleMarketMatchup {
  matchupId: number;
  type: 'moneyline' | 'spread' | 'total' | string;
  period: number;
  prices: PinnaclePrice[];
}

// In-memory cache for matchups per sport
const matchupCache = new Map<number, { data: PinnacleMatchup[]; expires: number }>();
const marketCache  = new Map<number, { data: PinnacleMarketMatchup[]; expires: number }>();

async function pinnGet<T>(path: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(`${PINNACLE_BASE}${path}`, {
      headers: {
        'User-Agent':      UA,
        Accept:            'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin:            'https://www.pinnacle.com',
        Referer:           'https://www.pinnacle.com/',
        'X-Api-Key':       'CmX2KcMrXuFmNg6YFbmTxE0y9CIrOi0R',  // public key used by the website
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache:  'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** American moneyline → decimal odds */
function mlToDecimal(ml: number): number {
  if (!ml || ml === 0) return 0;
  const dec = ml > 0 ? (ml / 100) + 1 : (100 / Math.abs(ml)) + 1;
  return Math.round(dec * 100) / 100;
}

/** Fetch all open matchups for a given Pinnacle sport ID (full card). Cached 5 min. */
async function fetchMatchupsForSport(sportId: number): Promise<PinnacleMatchup[]> {
  const hit = matchupCache.get(sportId);
  if (hit && hit.expires > Date.now()) return hit.data;

  const data = await pinnGet<PinnacleMatchup[]>(`/matchups?sportId=${sportId}&brandId=0&isLive=false`, 8000);
  const out  = (Array.isArray(data) ? data : []).filter(m => m.type === 'matchup' && m.status === 'open');

  matchupCache.set(sportId, { data: out, expires: Date.now() + CACHE_MS });
  return out;
}

/** Fetch moneyline markets for a specific matchup. Cached 5 min. */
async function fetchMarketsForMatchup(matchupId: number): Promise<PinnacleMarketMatchup[]> {
  const hit = marketCache.get(matchupId);
  if (hit && hit.expires > Date.now()) return hit.data;

  const data = await pinnGet<PinnacleMarketMatchup[]>(`/matchups/${matchupId}/markets/related/straight`, 6000);
  const out  = Array.isArray(data) ? data : [];

  marketCache.set(matchupId, { data: out, expires: Date.now() + CACHE_MS });
  return out;
}

export interface PinnacleBookmakerOdds {
  bookmaker: string;
  home:  number;
  draw?: number;
  away:  number;
  homeSpread?: number;
  homeSpreadLine?: number;
  awaySpread?: number;
  awaySpreadLine?: number;
  totalOver?: number;
  totalUnder?: number;
  totalLine?: number;
  source: 'pinnacle';
}

/**
 * Look up Pinnacle odds for a match by team names and sport.
 * Returns null if Pinnacle doesn't have the match or the API is unavailable.
 * Uses cached data — the underlying sportfetch is shared across concurrent calls.
 */
export async function getPinnacleOdds(
  homeTeam: string,
  awayTeam: string,
  sportSlug: string,
  kickoffMs?: number,
): Promise<PinnacleBookmakerOdds | null> {
  const sportId = SPORT_ID_MAP[sportSlug.toLowerCase().replace(/[-\s]/g, '')] ?? 29;

  let matchups: PinnacleMatchup[];
  try {
    matchups = await fetchMatchupsForSport(sportId);
  } catch {
    return null;
  }

  if (!matchups.length) return null;

  const norm  = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hNorm = norm(homeTeam);
  const aNorm = norm(awayTeam);

  // Try to find by team names in participants
  const found = matchups.find(m => {
    const parts = m.participants || [];
    const homePart = parts.find(p => p.alignment === 'home');
    const awayPart = parts.find(p => p.alignment === 'away');
    if (!homePart || !awayPart) return false;
    const mh = norm(homePart.name);
    const ma = norm(awayPart.name);
    // Exact or partial match
    return (
      (mh === hNorm || hNorm.includes(mh) || mh.includes(hNorm)) &&
      (ma === aNorm || aNorm.includes(ma) || ma.includes(aNorm))
    );
  });

  if (!found) return null;

  // Validate kickoff time (within ±6h) if provided
  if (kickoffMs && found.startTime) {
    const pinnMs = new Date(found.startTime).getTime();
    if (Math.abs(pinnMs - kickoffMs) > 6 * 3_600_000) return null;
  }

  // Fetch markets for this matchup
  let markets: PinnacleMarketMatchup[];
  try {
    markets = await fetchMarketsForMatchup(found.id);
  } catch {
    return null;
  }

  // Find regulation (period=0) moneyline
  const ml = markets.find(m => m.type === 'moneyline' && m.period === 0);
  if (!ml?.prices?.length) return null;

  const homePrice = ml.prices.find(p => p.designation === 'home' || p.designation === '1');
  const awayPrice = ml.prices.find(p => p.designation === 'away' || p.designation === '2');
  const drawPrice = ml.prices.find(p => p.designation === 'draw' || p.designation === 'X');

  if (!homePrice || !awayPrice) return null;

  const result: PinnacleBookmakerOdds = {
    bookmaker: 'Pinnacle',
    home:  mlToDecimal(homePrice.price),
    away:  mlToDecimal(awayPrice.price),
    draw:  drawPrice ? mlToDecimal(drawPrice.price) : undefined,
    source: 'pinnacle',
  };

  // Add spread if available
  const spread = markets.find(m => m.type === 'spread' && m.period === 0);
  if (spread?.prices?.length) {
    const hs = spread.prices.find(p => p.designation === 'home' || p.designation === '1');
    const as_ = spread.prices.find(p => p.designation === 'away' || p.designation === '2');
    if (hs) { result.homeSpread = mlToDecimal(hs.price); result.homeSpreadLine = hs.points; }
    if (as_) { result.awaySpread = mlToDecimal(as_.price); result.awaySpreadLine = as_.points; }
  }

  // Add totals if available
  const total = markets.find(m => m.type === 'total' && m.period === 0);
  if (total?.prices?.length) {
    const over  = total.prices.find(p => p.designation === 'over'  || p.designation === 'O');
    const under = total.prices.find(p => p.designation === 'under' || p.designation === 'U');
    if (over)  { result.totalOver  = mlToDecimal(over.price);  result.totalLine = over.points; }
    if (under) { result.totalUnder = mlToDecimal(under.price); result.totalLine = under.points ?? result.totalLine; }
  }

  // Sanity check: all main odds must be valid
  if (!result.home || !result.away || result.home < 1.01 || result.away < 1.01) return null;

  return result;
}

/**
 * Fetch Pinnacle odds for multiple sports simultaneously (background warm-up).
 * Call during startup to pre-warm the cache for faster first-request response.
 */
export async function warmPinnacleCache(): Promise<void> {
  const sportsToWarm = [29, 4, 3, 15, 19, 33]; // Soccer, Basketball, Baseball, NFL, Hockey, Tennis
  await Promise.allSettled(sportsToWarm.map(id => fetchMatchupsForSport(id)));
}
