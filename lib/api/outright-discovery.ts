/**
 * Discovers ALL live outright/futures betting markets from The Odds API.
 * Covers: league winners, top scorers, relegation, manager specials,
 * transfer specials, and any other active soccer outright market.
 * 
 * Cache: 12 hours — outrights change slowly, aggressive caching is needed
 * to stay within the 500 req/month free-tier quota on The Odds API.
 */

import { fetchTheOddsAPI, LEAGUE_TO_ODDS_KEYS } from '@/lib/api/unified-sports-api';
import { ALL_LEAGUES } from '@/lib/sports-data';

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
}

export interface OutrightMarket {
  eventId: string;
  marketName: string;
  outcomes: { name: string; price: number }[];
}

type TheOddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  bookmakers?: Array<{
    markets?: Array<{
      key: string;
      outcomes?: Array<{ name: string; price: number }>;
    }>;
  }>;
};

type SportEntry = {
  key: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
  group: string;
};

let discoveryCache: { data: OutrightDiscovery[]; ts: number } | null = null;
const DISCOVERY_CACHE_MS = 12 * 60 * 60_000;

const reverseLeagueMap = new Map<string, number>();
for (const [leagueIdStr, keys] of Object.entries(LEAGUE_TO_ODDS_KEYS)) {
  for (const key of keys as string[]) {
    reverseLeagueMap.set(key, parseInt(leagueIdStr));
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function categorize(key: string, title: string): string {
  const k = key.toLowerCase();
  const t = title.toLowerCase();
  if (/world_cup|copa_america|euros|european_championship|africa_cup|nations_league/.test(k)) return 'International';
  if (/champions_league/.test(k)) return 'Champions League';
  if (/europa_league|conference_league/.test(k)) return 'European Cups';
  if (/fa_cup|efl_cup|copa_del_rey|dfb_pokal|coppa_italia|coupe/.test(k)) return 'Domestic Cups';
  if (/nba|nfl|mlb|nhl|mls|ncaa/.test(k)) return 'North America';
  if (/tennis|golf|motorsport|f1|cricket|rugby|boxing/.test(k)) return 'Other Sports';
  if (/specials|manager|sack|next_boss|transfer|relegation/.test(k)) return 'Specials';
  if (/top_scorer|golden_boot/.test(k)) return 'Top Scorers';
  if (/winner/.test(k)) return 'League Winners';
  if (/epl|premier_league/.test(k)) return 'Premier League';
  if (/la_liga/.test(k)) return 'La Liga';
  if (/bundesliga/.test(k)) return 'Bundesliga';
  if (/serie_a/.test(k)) return 'Serie A';
  if (/ligue/.test(k)) return 'Ligue 1';
  if (/championship/.test(k) && /efl/.test(k)) return 'Championship';
  if (t.includes('specials') || t.includes('manager') || t.includes('transfer')) return 'Specials';
  return 'Other Competitions';
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function buildMarketDescription(markets: OutrightMarket[]): string {
  const firstMarket = markets[0];
  if (!firstMarket || firstMarket.outcomes.length === 0) return '';
  const top3 = firstMarket.outcomes.slice(0, 3).map(o => `${o.name} (${o.price.toFixed(2)})`).join(', ');
  return `Betting odds: ${top3}`;
}

function processEvents(data: TheOddsApiEvent[], sportTitle: string): OutrightMarket[] {
  const markets: OutrightMarket[] = [];

  for (const ev of data) {
    if (!ev.bookmakers || ev.bookmakers.length === 0) continue;

    const tally = new Map<string, number[]>();
    for (const bm of ev.bookmakers) {
      for (const market of (bm.markets || [])) {
        if (market.key !== 'outrights') continue;
        for (const o of (market.outcomes || [])) {
          if (!tally.has(o.name)) tally.set(o.name, []);
          tally.get(o.name)!.push(o.price);
        }
      }
    }

    if (tally.size === 0) continue;

    const outcomes = Array.from(tally.entries())
      .map(([name, prices]) => ({ name, price: Math.round(Math.max(...prices) * 100) / 100 }))
      .sort((a, b) => a.price - b.price);

    markets.push({
      eventId: ev.id,
      marketName: sportTitle,
      outcomes,
    });
  }

  return markets;
}

export async function discoverAllOutrights(): Promise<OutrightDiscovery[]> {
  if (discoveryCache && Date.now() - discoveryCache.ts < DISCOVERY_CACHE_MS) {
    return discoveryCache.data;
  }

  const sportsList = await fetchTheOddsAPI('sports', { all: 'true' }) as SportEntry[] | null;
  if (!Array.isArray(sportsList)) return discoveryCache?.data ?? [];

  const activeSports = sportsList.filter(s => s.active && s.has_outrights);

  const results = await Promise.allSettled(
    activeSports.slice(0, 30).map(async (sport) => {
      const data = await fetchTheOddsAPI(`sports/${sport.key}/odds`, {
        regions: 'uk,eu',
        markets: 'outrights',
        oddsFormat: 'decimal',
        dateFormat: 'iso',
      }) as TheOddsApiEvent[] | null;
      return { sport, data };
    })
  );

  const discoveries: OutrightDiscovery[] = [];

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value.data) continue;
    const { sport, data } = r.value;
    if (!Array.isArray(data) || data.length === 0) continue;

    const markets = processEvents(data, sport.title);
    if (markets.length === 0) continue;

    const sportKey = sport.key;
    const leagueId = reverseLeagueMap.get(sportKey);
    const leagueInfo = leagueId ? ALL_LEAGUES.find(l => l.id === leagueId) : undefined;

    discoveries.push({
      sportKey,
      slug: sportKey.replace(/_/g, '-'),
      title: sport.title,
      description: buildMarketDescription(markets),
      category: categorize(sportKey, sport.title),
      leagueId,
      leagueSlug: leagueInfo?.slug,
      leagueName: leagueInfo?.name,
      markets,
      totalOutcomes: markets.reduce((sum, m) => sum + m.outcomes.length, 0),
    });
  }

  discoveries.sort((a, b) => {
    const ORDER = ['International', 'Champions League', 'European Cups', 'League Winners', 'Top Scorers', 'Domestic Cups', 'Specials', 'Other Competitions'];
    return (ORDER.indexOf(a.category) - ORDER.indexOf(b.category)) || a.title.localeCompare(b.title);
  });

  discoveryCache = { data: discoveries, ts: Date.now() };
  return discoveries;
}

export async function getOutrightBySlug(slug: string): Promise<OutrightDiscovery | null> {
  const all = await discoverAllOutrights();
  return all.find(d => d.slug === slug) ?? null;
}

export function buildOutrightPageSlug(name: string): string {
  return slugify(name);
}

export { titleCase, categorize };
