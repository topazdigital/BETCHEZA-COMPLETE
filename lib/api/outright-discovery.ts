/**
 * Outright market discovery — multi-source.
 *
 * Primary:   TheOddsAPI /v4/sports/{sport}/odds?markets=outrights  (500 req/month free tier)
 * Fallback:  SportsGameOdds /futures endpoint — used automatically when TheOddsAPI
 *            quota is exhausted.  No extra quota needed — SGO key is already in use
 *            for live match odds.
 *
 * Cache: 48hr file-based per sport key for TheOddsAPI (preserves quota).
 *        SGO results are cached in-memory by sportsgameodds.ts (5-min TTL).
 *
 * When both sources are unavailable, returns empty results.
 */

import {
  fetchAllOutrightOdds,
  OUTRIGHT_SPORT_CONFIGS,
  slugify,
  isQuotaExhausted,
  type OutrightDiscovery,
  type OutrightMarket,
} from '@/lib/api/the-odds-api-outrights';
import {
  discoverAllSgoFutures,
  type SgoDiscoveryItem,
} from '@/lib/api/sportsgameodds';

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

let discoveryCache: { data: OutrightDiscovery[]; ts: number; source: string } | null = null;
const DISCOVERY_CACHE_MS = 30 * 60 * 1000;

/** Convert SGO discovery items to the OutrightDiscovery shape used by the rest of the app. */
function sgoToOutrightDiscovery(items: SgoDiscoveryItem[]): OutrightDiscovery[] {
  return items.map(item => ({
    sportKey: item.sportKey,
    slug: slugify(item.sportKey),
    title: item.title,
    description: `${item.title} outright winner odds from live bookmakers.`,
    category: item.category,
    leagueId: item.leagueId,
    markets: item.markets,
    totalOutcomes: item.markets.reduce((acc, m) => acc + m.outcomes.length, 0),
    updatedAt: new Date().toISOString(),
  }));
}

function sortDiscoveries(discoveries: OutrightDiscovery[]): OutrightDiscovery[] {
  return [...discoveries].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return catDiff || a.title.localeCompare(b.title);
  });
}

export async function discoverAllOutrights(): Promise<OutrightDiscovery[]> {
  if (discoveryCache && Date.now() - discoveryCache.ts < DISCOVERY_CACHE_MS) {
    return discoveryCache.data;
  }

  // ── Primary: TheOddsAPI ───────────────────────────────────────────────────
  const primaryData = await fetchAllOutrightOdds();

  if (primaryData.length > 0) {
    const sorted = sortDiscoveries(primaryData);
    discoveryCache = { data: sorted, ts: Date.now(), source: 'theoddsapi' };
    return sorted;
  }

  // ── Fallback: SportsGameOdds futures ─────────────────────────────────────
  // TheOddsAPI returned nothing (quota exhausted or key missing).
  // SGO's /futures endpoint covers the same major markets without additional cost.
  console.log('[outright-discovery] TheOddsAPI empty — falling back to SportsGameOdds futures');
  const sgoItems = await discoverAllSgoFutures();

  if (sgoItems.length > 0) {
    const converted = sgoToOutrightDiscovery(sgoItems);
    const sorted = sortDiscoveries(converted);
    discoveryCache = { data: sorted, ts: Date.now(), source: 'sgo' };
    return sorted;
  }

  // Both sources empty — return empty and let the page show the "check back" message.
  discoveryCache = { data: [], ts: Date.now(), source: 'none' };
  return [];
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
