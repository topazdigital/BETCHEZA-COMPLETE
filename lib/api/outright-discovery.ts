/**
 * Outright market discovery — powered by TheOddsAPI.
 *
 * Primary source: TheOddsAPI /v4/sports/{sport}/odds?markets=outrights
 * Cache: 48hr file-based per sport key (preserves the 500 req/month free quota).
 *
 * NO static fallback data — all odds are live from real bookmakers.
 * When API quota is exhausted or unavailable, returns empty results.
 */

import {
  fetchAllOutrightOdds,
  OUTRIGHT_SPORT_CONFIGS,
  slugify,
  isQuotaExhausted,
  type OutrightDiscovery,
  type OutrightMarket,
} from '@/lib/api/the-odds-api-outrights';

export type { OutrightDiscovery, OutrightMarket };

const CATEGORY_ORDER = [
  'International',
  'Champions League',
  'European Cups',
  'League Winners',
  'Top Scorers',
  'Domestic Cups',
  'Specials',
  'NBA',
  'NFL',
  'MLB',
  'NHL',
  'US Soccer',
  'NCAA',
  'Tennis',
  'Golf',
  'Motor Racing',
  'Cricket',
  'Rugby',
  'Boxing/MMA',
  'Basketball',
  'American Football',
  'Baseball',
  'Ice Hockey',
  'Australian Rules',
  'Snooker',
  'Darts',
  'Other Competitions',
];

let discoveryCache: { data: OutrightDiscovery[]; ts: number } | null = null;
const DISCOVERY_CACHE_MS = 30 * 60 * 1000;

export async function discoverAllOutrights(): Promise<OutrightDiscovery[]> {
  if (discoveryCache && Date.now() - discoveryCache.ts < DISCOVERY_CACHE_MS) {
    return discoveryCache.data;
  }

  const discoveries = await fetchAllOutrightOdds();

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

/** All possible slugs (for SEO prerendering — returns configured list even before first fetch) */
export function getAllOutrightSlugs(): string[] {
  return OUTRIGHT_SPORT_CONFIGS.map(c => slugify(c.key));
}

export function isOutrightsQuotaExhausted(): boolean {
  return isQuotaExhausted();
}

/** Returns the static config metadata for a slug — works even when quota is exhausted and no live data is cached */
export function getOutrightConfigBySlug(slug: string): { title: string; category: string; leagueId: number } | null {
  const config = OUTRIGHT_SPORT_CONFIGS.find(c => slugify(c.key) === slug);
  if (!config) return null;
  return { title: config.title, category: config.category, leagueId: config.leagueId };
}
