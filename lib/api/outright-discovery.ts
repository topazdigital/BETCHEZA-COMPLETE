/**
 * Discovers ALL live outright/futures betting markets from SportsGameOdds.
 * Uses SGO's /futures endpoint across 25+ sports — no Odds API quota needed.
 *
 * Cache: 12 hours — outrights change slowly, aggressive caching is fine.
 */

import { ALL_LEAGUES } from '@/lib/sports-data';
import { discoverAllSgoFutures } from '@/lib/api/sportsgameodds';
import { GLOBAL_STATIC_OUTRIGHTS } from '@/lib/api/static-outrights';

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
  outcomes: { name: string; price: number; link?: string }[];
}

let discoveryCache: { data: OutrightDiscovery[]; ts: number } | null = null;
const DISCOVERY_CACHE_MS = 12 * 60 * 60_000;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildMarketDescription(markets: OutrightMarket[]): string {
  const firstMarket = markets[0];
  if (!firstMarket || firstMarket.outcomes.length === 0) return '';
  const top3 = firstMarket.outcomes.slice(0, 3).map(o => `${o.name} (${o.price.toFixed(2)})`).join(', ');
  return `Betting odds: ${top3}`;
}

// Category priority for sorting
const CATEGORY_ORDER = [
  'International', 'Champions League', 'European Cups',
  'League Winners', 'Top Scorers', 'Domestic Cups', 'Specials',
  'NBA', 'NFL', 'MLB', 'NHL', 'US Soccer', 'NCAA',
  'Tennis', 'Golf', 'Motor Racing', 'Cricket', 'Rugby',
  'Boxing/MMA', 'Basketball', 'American Football', 'Baseball',
  'Ice Hockey', 'Australian Rules', 'Snooker', 'Darts',
  'Other Competitions',
];

/** Convert a GlobalStaticDiscovery entry to the OutrightDiscovery shape. */
function staticToDiscovery(item: (typeof GLOBAL_STATIC_OUTRIGHTS)[number]): OutrightDiscovery {
  const leagueInfo = item.leagueId ? ALL_LEAGUES.find(l => l.id === item.leagueId) : undefined;
  const markets: OutrightMarket[] = item.markets;
  return {
    sportKey: item.sportKey,
    slug: slugify(item.sportKey.replace(/_/g, '-')),
    title: item.title,
    description: buildMarketDescription(markets),
    category: item.category,
    leagueId: item.leagueId,
    leagueSlug: leagueInfo?.slug,
    leagueName: leagueInfo?.name,
    markets,
    totalOutcomes: markets.reduce((s, m) => s + m.outcomes.length, 0),
  };
}

export async function discoverAllOutrights(): Promise<OutrightDiscovery[]> {
  if (discoveryCache && Date.now() - discoveryCache.ts < DISCOVERY_CACHE_MS) {
    return discoveryCache.data;
  }

  // Try live SGO futures first — falls back to empty array when plan has no /futures
  const sgoItems = await discoverAllSgoFutures();

  const liveDiscoveries: OutrightDiscovery[] = sgoItems.map(item => {
    const leagueInfo = item.leagueId ? ALL_LEAGUES.find(l => l.id === item.leagueId) : undefined;
    const markets: OutrightMarket[] = item.markets;
    return {
      sportKey: item.sportKey,
      slug: slugify(item.sportKey.replace(/_/g, '-')),
      title: item.title,
      description: buildMarketDescription(markets),
      category: item.category,
      leagueId: item.leagueId,
      leagueSlug: leagueInfo?.slug,
      leagueName: leagueInfo?.name,
      markets,
      totalOutcomes: markets.reduce((s, m) => s + m.outcomes.length, 0),
    };
  });

  // Merge static fallback — add any sportKey not already covered by live data
  const liveSportKeys = new Set(liveDiscoveries.map(d => d.sportKey));
  const staticFallbacks = GLOBAL_STATIC_OUTRIGHTS
    .filter(item => !liveSportKeys.has(item.sportKey))
    .map(staticToDiscovery);

  const discoveries = [...liveDiscoveries, ...staticFallbacks];

  discoveries.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return catDiff || a.title.localeCompare(b.title);
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

export function categorize(key: string, title: string): string {
  const k = key.toLowerCase();
  const t = title.toLowerCase();
  if (/world_cup|copa_america|euros|european_championship|africa_cup|nations_league|gold_cup|concacaf|afc_asian/.test(k)) return 'International';
  if (/champions_league/.test(k)) return 'Champions League';
  if (/europa_league|conference_league/.test(k)) return 'European Cups';
  if (/fa_cup|efl_cup|carabao|copa_del_rey|dfb_pokal|coppa_italia|coupe_de_france/.test(k)) return 'Domestic Cups';
  if (/nba/.test(k)) return 'NBA';
  if (/nfl/.test(k)) return 'NFL';
  if (/mlb/.test(k)) return 'MLB';
  if (/nhl/.test(k)) return 'NHL';
  if (/mls|nwsl|usl/.test(k)) return 'US Soccer';
  if (/ncaa/.test(k)) return 'NCAA';
  if (/tennis|atp|wta|wimbledon|us_open|australian_open|roland_garros/.test(k)) return 'Tennis';
  if (/golf|pga|masters|open_championship/.test(k)) return 'Golf';
  if (/motorsport|f1|formula_1|nascar|indycar/.test(k)) return 'Motor Racing';
  if (/cricket|ipl|ashes|t20/.test(k)) return 'Cricket';
  if (/rugby|six_nations|super_rugby/.test(k)) return 'Rugby';
  if (/boxing|mma|ufc/.test(k)) return 'Boxing/MMA';
  if (/specials|manager|sack|transfer|relegation/.test(k) || /specials|manager|sack|transfer|relegation/.test(t)) return 'Specials';
  if (/top_scorer|golden_boot|top_goal/.test(k)) return 'Top Scorers';
  if (/premier_league|epl|la_liga|bundesliga|serie_a|ligue_1|eredivisie|primeira_liga|championship|winner/.test(k)) return 'League Winners';
  return 'Other Competitions';
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}
