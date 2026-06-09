/**
 * TheOddsAPI outright/futures market fetcher.
 *
 * Free tier: 500 requests / month
 * Strategy: 48hr file-based cache per sport key.
 * With 16 sport keys × ~15 refreshes/month = ~240 req/month — well within free tier.
 *
 * Uses a hardcoded sport-key list (no /sports discovery call) to preserve quota.
 * When quota is exhausted: returns cached data (up to 48 hrs old) or empty array.
 */

import fs from 'fs';
import path from 'path';
import { getApiKey } from '@/lib/api-keys';

export interface OutrightMarket {
  eventId: string;
  marketName: string;
  outcomes: { name: string; price: number; link?: string }[];
}

export interface OutrightDiscovery {
  sportKey: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  leagueId?: number;
  leagueSlug?: string;
  leagueName?: string;
  markets: OutrightMarket[];
  totalOutcomes: number;
  updatedAt?: string;
}

interface SportConfig {
  key: string;
  title: string;
  category: string;
  leagueId?: number;
}

interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

const CACHE_DIR = path.join(process.cwd(), '.local', 'data', 'outrights-cache');
const FILE_CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const MEM_CACHE_TTL_MS = 30 * 60 * 1000;

let quotaExhausted = false;
let quotaExhaustedAt = 0;
const QUOTA_MONTHLY_MS = 30 * 24 * 60 * 60 * 1000;

const memCache = new Map<string, { ts: number; data: OutrightDiscovery | null }>();

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const OUTRIGHT_SPORT_CONFIGS: SportConfig[] = [
  { key: 'soccer_epl_winner',                         title: 'Premier League Winner',      category: 'League Winners',   leagueId: 1   },
  { key: 'soccer_epl_top_scorer',                     title: 'Premier League Top Scorer',  category: 'Top Scorers',      leagueId: 1   },
  { key: 'soccer_spain_la_liga_winner',               title: 'La Liga Winner',             category: 'League Winners',   leagueId: 2   },
  { key: 'soccer_germany_bundesliga_winner',          title: 'Bundesliga Winner',          category: 'League Winners',   leagueId: 3   },
  { key: 'soccer_italy_serie_a_winner',               title: 'Serie A Winner',             category: 'League Winners',   leagueId: 4   },
  { key: 'soccer_france_ligue_one_winner',            title: 'Ligue 1 Winner',             category: 'League Winners',   leagueId: 5   },
  { key: 'soccer_uefa_champs_league_winner',          title: 'Champions League Winner',    category: 'Champions League', leagueId: 9   },
  { key: 'soccer_uefa_europa_league_winner',          title: 'Europa League Winner',       category: 'European Cups',    leagueId: 10  },
  { key: 'soccer_uefa_europa_conference_league_winner',title:'Conference League Winner',   category: 'European Cups',    leagueId: 26  },
  { key: 'soccer_fifa_world_cup_winner',              title: 'FIFA World Cup 2026 Winner', category: 'International',    leagueId: 29  },
  { key: 'soccer_fa_cup_winner',                      title: 'FA Cup Winner',              category: 'Domestic Cups',    leagueId: 44  },
  { key: 'soccer_efl_champ_winner',                   title: 'Championship Winner',        category: 'League Winners',   leagueId: 41  },
  { key: 'basketball_nba_championship_winner',        title: 'NBA Championship Winner',    category: 'NBA',              leagueId: 101 },
  { key: 'americanfootball_nfl_super_bowl_winner',    title: 'NFL Super Bowl Winner',      category: 'NFL',              leagueId: 401 },
  { key: 'baseball_mlb_world_series_winner',          title: 'MLB World Series Winner',    category: 'MLB',              leagueId: 501 },
  { key: 'icehockey_nhl_championship_winner',         title: 'NHL Stanley Cup Winner',     category: 'NHL',              leagueId: 601 },
];

function cacheFilePath(sportKey: string): string {
  const safe = sportKey.replace(/[^a-z0-9]/g, '_');
  return path.join(CACHE_DIR, `${safe}.json`);
}

interface CacheFile {
  ts: number;
  data: OutrightDiscovery | null;
  empty?: boolean;
}

function readFileCache(sportKey: string): OutrightDiscovery | null | undefined {
  try {
    const fp = cacheFilePath(sportKey);
    if (!fs.existsSync(fp)) return undefined;
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8')) as CacheFile;
    if (Date.now() - raw.ts > FILE_CACHE_TTL_MS) {
      fs.unlinkSync(fp);
      return undefined;
    }
    return raw.data;
  } catch {
    return undefined;
  }
}

function writeFileCache(sportKey: string, data: OutrightDiscovery | null): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFilePath(sportKey), JSON.stringify({ ts: Date.now(), data }));
  } catch { /* ignore write errors */ }
}

function buildDescription(outcomes: { name: string; price: number }[]): string {
  const top3 = outcomes.slice(0, 3).map(o => `${o.name} (${o.price.toFixed(2)})`).join(', ');
  return top3 ? `Betting odds: ${top3}` : '';
}

async function fetchSportOutrights(config: SportConfig): Promise<OutrightDiscovery | null> {
  const memHit = memCache.get(config.key);
  if (memHit && Date.now() - memHit.ts < MEM_CACHE_TTL_MS) return memHit.data;

  const fileCached = readFileCache(config.key);
  if (fileCached !== undefined) {
    memCache.set(config.key, { ts: Date.now(), data: fileCached });
    return fileCached;
  }

  if (quotaExhausted && Date.now() - quotaExhaustedAt < QUOTA_MONTHLY_MS) {
    memCache.set(config.key, { ts: Date.now(), data: null });
    return null;
  }

  const apiKey = await getApiKey('the_odds_api_key');
  if (!apiKey || apiKey === 'your_api_key_here') {
    memCache.set(config.key, { ts: Date.now(), data: null });
    return null;
  }

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${config.key}/odds`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('markets', 'outrights');
  url.searchParams.set('regions', 'uk,eu,us');
  url.searchParams.set('oddsFormat', 'decimal');

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });

    if (!res.ok) {
      if (res.status === 401 || res.status === 422) {
        try {
          const body = await res.json() as { error_code?: string };
          if (body?.error_code === 'OUT_OF_USAGE_CREDITS') {
            quotaExhausted = true;
            quotaExhaustedAt = Date.now();
            console.warn('[TheOddsAPI Outrights] Monthly quota exhausted — using cached data until next billing cycle');
          } else if (body?.error_code === 'INVALID_MARKET_COMBO') {
            writeFileCache(config.key, null);
            memCache.set(config.key, { ts: Date.now(), data: null });
            return null;
          }
        } catch { /* ignore parse error */ }
        return null;
      }
      if (res.status === 429) {
        console.warn('[TheOddsAPI Outrights] Rate limited');
        return null;
      }
      return null;
    }

    const events = await res.json() as TheOddsApiEvent[];
    if (!Array.isArray(events) || events.length === 0) {
      writeFileCache(config.key, null);
      memCache.set(config.key, { ts: Date.now(), data: null });
      return null;
    }

    const markets: OutrightMarket[] = [];
    for (const ev of events) {
      if (!ev.bookmakers?.length) continue;

      const tally = new Map<string, number[]>();
      for (const bm of ev.bookmakers) {
        for (const mkt of bm.markets) {
          if (mkt.key !== 'outrights') continue;
          for (const o of mkt.outcomes) {
            if (!tally.has(o.name)) tally.set(o.name, []);
            tally.get(o.name)!.push(o.price);
          }
        }
      }
      if (tally.size === 0) continue;

      const outcomes = Array.from(tally.entries())
        .map(([name, prices]) => ({ name, price: Math.round(Math.max(...prices) * 100) / 100 }))
        .filter(o => o.price > 1)
        .sort((a, b) => a.price - b.price);

      if (outcomes.length === 0) continue;

      markets.push({
        eventId: ev.id,
        marketName: ev.sport_title || config.title,
        outcomes,
      });
    }

    if (markets.length === 0) {
      writeFileCache(config.key, null);
      memCache.set(config.key, { ts: Date.now(), data: null });
      return null;
    }

    const discovery: OutrightDiscovery = {
      sportKey: config.key,
      slug: slugify(config.key),
      title: config.title,
      description: buildDescription(markets[0].outcomes),
      category: config.category,
      leagueId: config.leagueId,
      markets,
      totalOutcomes: markets.reduce((s, m) => s + m.outcomes.length, 0),
      updatedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    };

    writeFileCache(config.key, discovery);
    memCache.set(config.key, { ts: Date.now(), data: discovery });
    return discovery;
  } catch (err) {
    console.warn('[TheOddsAPI Outrights] fetch error for', config.key, err);
    return null;
  }
}

export async function fetchAllOutrightOdds(): Promise<OutrightDiscovery[]> {
  const BATCH = 5;
  const results: OutrightDiscovery[] = [];

  for (let i = 0; i < OUTRIGHT_SPORT_CONFIGS.length; i += BATCH) {
    const chunk = OUTRIGHT_SPORT_CONFIGS.slice(i, i + BATCH);
    const settled = await Promise.allSettled(chunk.map(fetchSportOutrights));
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }

  return results;
}

export function isQuotaExhausted(): boolean {
  return quotaExhausted && Date.now() - quotaExhaustedAt < QUOTA_MONTHLY_MS;
}

export function resetQuotaBackoff(): void {
  quotaExhausted = false;
  quotaExhaustedAt = 0;
}

export function clearOutrightCache(): void {
  memCache.clear();
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const f of files) {
        if (f.endsWith('.json')) fs.unlinkSync(path.join(CACHE_DIR, f));
      }
    }
  } catch { /* ignore */ }
}
