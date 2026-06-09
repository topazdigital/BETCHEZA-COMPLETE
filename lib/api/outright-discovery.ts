/**
 * Discovers ALL live outright/futures betting markets from The Odds API.
 * Covers: league winners, top scorers, relegation, manager specials,
 * transfer specials, and any other active outright market across all sports.
 * 
 * Cache: 12 hours — outrights change slowly, aggressive caching is needed
 * to stay within the 500 req/month free-tier quota on The Odds API.
 */

import { fetchTheOddsAPI, LEAGUE_TO_ODDS_KEYS } from '@/lib/api/unified-sports-api';
import { ALL_LEAGUES } from '@/lib/sports-data';
import { getStaticOutrights } from '@/lib/api/static-outrights';

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
  // International tournaments
  if (/world_cup|copa_america|euros|european_championship|africa_cup|nations_league|gold_cup|concacaf|afc_asian/.test(k)) return 'International';
  // UEFA club competitions
  if (/champions_league/.test(k)) return 'Champions League';
  if (/europa_league|conference_league/.test(k)) return 'European Cups';
  // Domestic cups
  if (/fa_cup|efl_cup|carabao|copa_del_rey|dfb_pokal|coppa_italia|coupe_de_france|coupe_france|taça|taca|supercopa|community_shield/.test(k)) return 'Domestic Cups';
  // North American sports
  if (/nba/.test(k)) return 'NBA';
  if (/nfl/.test(k)) return 'NFL';
  if (/mlb/.test(k)) return 'MLB';
  if (/nhl/.test(k)) return 'NHL';
  if (/mls|nwsl|usl/.test(k)) return 'US Soccer';
  if (/ncaa/.test(k)) return 'NCAA';
  // Other sports
  if (/tennis|atp|wta|wimbledon|us_open|australian_open|roland_garros|french_open/.test(k)) return 'Tennis';
  if (/golf|pga|masters|open_championship|ryder_cup/.test(k)) return 'Golf';
  if (/motorsport|f1|formula_1|formula1|nascar|indycar/.test(k)) return 'Motor Racing';
  if (/cricket|ipl|ashes|test_match|t20|one_day/.test(k)) return 'Cricket';
  if (/rugby|six_nations|super_rugby|premiership_rugby/.test(k)) return 'Rugby';
  if (/boxing|mma|ufc/.test(k)) return 'Boxing/MMA';
  if (/basketball/.test(k) && !/nba/.test(k)) return 'Basketball';
  if (/american_football/.test(k) && !/nfl/.test(k)) return 'American Football';
  if (/baseball/.test(k) && !/mlb/.test(k)) return 'Baseball';
  if (/ice_hockey/.test(k) && !/nhl/.test(k)) return 'Ice Hockey';
  if (/aussie_rules|afl/.test(k)) return 'Australian Rules';
  if (/snooker/.test(k)) return 'Snooker';
  if (/darts/.test(k)) return 'Darts';
  // Specials
  if (/specials|manager|sack|next_boss|transfer|relegation/.test(k)) return 'Specials';
  if (/specials|manager|sack|transfer|relegation/.test(t)) return 'Specials';
  // Top Scorers
  if (/top_scorer|golden_boot|top_goal/.test(k)) return 'Top Scorers';
  // League Winners by league
  if (/premier_league|epl/.test(k)) return 'League Winners';
  if (/la_liga/.test(k)) return 'League Winners';
  if (/bundesliga/.test(k)) return 'League Winners';
  if (/serie_a/.test(k)) return 'League Winners';
  if (/ligue_1|ligue1/.test(k)) return 'League Winners';
  if (/eredivisie/.test(k)) return 'League Winners';
  if (/primeira_liga|portuguese/.test(k)) return 'League Winners';
  if (/championship|efl_champ/.test(k)) return 'League Winners';
  if (/scottish|spfl|premiership/.test(k) && /scot/.test(k)) return 'League Winners';
  if (/turkish|super_lig/.test(k)) return 'League Winners';
  if (/argentina|primera_division/.test(k)) return 'League Winners';
  if (/brazil|brasileirao|campeonato_brasileiro/.test(k)) return 'League Winners';
  if (/mexico|liga_mx/.test(k)) return 'League Winners';
  if (/winner/.test(k)) return 'League Winners';
  // Fallback
  if (t.includes('specials') || t.includes('manager') || t.includes('transfer')) return 'Specials';
  if (t.includes('basketball')) return 'Basketball';
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

export async function discoverAllOutrights(): Promise<OutrightDiscovery[]> {
  if (discoveryCache && Date.now() - discoveryCache.ts < DISCOVERY_CACHE_MS) {
    return discoveryCache.data;
  }

  // ── Static fallback data — always shown when live API has no data ──────────
  // Maps league IDs to their static market configs
  const STATIC_LEAGUE_META: Array<{
    leagueId: number; sportKey: string; title: string; category: string;
  }> = [
    { leagueId: 1,   sportKey: 'soccer_epl',               title: 'Premier League',        category: 'League Winners' },
    { leagueId: 2,   sportKey: 'soccer_spain_la_liga',     title: 'La Liga',               category: 'League Winners' },
    { leagueId: 3,   sportKey: 'soccer_germany_bundesliga',title: 'Bundesliga',             category: 'League Winners' },
    { leagueId: 4,   sportKey: 'soccer_italy_serie_a',     title: 'Serie A',               category: 'League Winners' },
    { leagueId: 5,   sportKey: 'soccer_france_ligue_one',  title: 'Ligue 1',              category: 'League Winners' },
    { leagueId: 6,   sportKey: 'soccer_netherlands_eredivisie', title: 'Eredivisie',       category: 'League Winners' },
    { leagueId: 7,   sportKey: 'soccer_portugal_primeira_liga', title: 'Primeira Liga',    category: 'League Winners' },
    { leagueId: 9,   sportKey: 'soccer_uefa_champs_league',title: 'Champions League',      category: 'Champions League' },
    { leagueId: 10,  sportKey: 'soccer_uefa_europa_league',title: 'Europa League',         category: 'European Cups' },
    { leagueId: 101, sportKey: 'basketball_nba',           title: 'NBA',                   category: 'NBA' },
    { leagueId: 401, sportKey: 'americanfootball_nfl',     title: 'NFL',                   category: 'NFL' },
    { leagueId: 501, sportKey: 'baseball_mlb',             title: 'MLB',                   category: 'MLB' },
    { leagueId: 601, sportKey: 'icehockey_nhl',            title: 'NHL',                   category: 'NHL' },
    { leagueId: 2701,sportKey: 'mma_mixed_martial_arts',   title: 'MMA / UFC',             category: 'Boxing/MMA' },
  ];

  function buildStaticDiscovery(meta: typeof STATIC_LEAGUE_META[number]): OutrightDiscovery | null {
    const staticMarkets = getStaticOutrights(meta.leagueId);
    if (staticMarkets.length === 0) return null;
    const leagueInfo = ALL_LEAGUES.find(l => l.id === meta.leagueId);
    const markets: OutrightMarket[] = staticMarkets.map(sm => ({
      eventId: sm.id,
      marketName: sm.name,
      outcomes: sm.outcomes,
    }));
    return {
      sportKey: meta.sportKey,
      slug: meta.sportKey.replace(/_/g, '-'),
      title: meta.title,
      description: buildMarketDescription(markets),
      category: meta.category,
      leagueId: meta.leagueId,
      leagueSlug: leagueInfo?.slug,
      leagueName: leagueInfo?.name,
      markets,
      totalOutcomes: markets.reduce((s, m) => s + m.outcomes.length, 0),
    };
  }

  // ── Attempt live fetch ────────────────────────────────────────────────────
  const sportsList = await fetchTheOddsAPI('sports', { all: 'true' }) as SportEntry[] | null;

  const discoveries: OutrightDiscovery[] = [];
  const liveSlugsSeen = new Set<string>();

  if (Array.isArray(sportsList)) {
    const activeSports = sportsList.filter(s => s.active && s.has_outrights);

    const BATCH = 8;
    const allResults: Array<{ sport: SportEntry; data: TheOddsApiEvent[] | null }> = [];

    for (let i = 0; i < activeSports.length; i += BATCH) {
      const chunk = activeSports.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        chunk.map(async (sport) => {
          const data = await fetchTheOddsAPI(`sports/${sport.key}/odds`, {
            regions: 'uk,eu,us',
            markets: 'outrights',
            oddsFormat: 'decimal',
            dateFormat: 'iso',
          }) as TheOddsApiEvent[] | null;
          return { sport, data };
        })
      );
      for (const r of settled) {
        if (r.status === 'fulfilled') allResults.push(r.value);
      }
    }

    for (const { sport, data } of allResults) {
      if (!data || !Array.isArray(data) || data.length === 0) continue;
      const markets = processEvents(data, sport.title);
      if (markets.length === 0) continue;
      const sportKey = sport.key;
      const slug = sportKey.replace(/_/g, '-');
      const leagueId = reverseLeagueMap.get(sportKey);
      const leagueInfo = leagueId ? ALL_LEAGUES.find(l => l.id === leagueId) : undefined;
      liveSlugsSeen.add(slug);
      discoveries.push({
        sportKey,
        slug,
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
  }

  // ── Merge static fallback for leagues not already covered live ────────────
  for (const meta of STATIC_LEAGUE_META) {
    const slug = meta.sportKey.replace(/_/g, '-');
    if (liveSlugsSeen.has(slug)) continue; // already have live data
    const d = buildStaticDiscovery(meta);
    if (d) discoveries.push(d);
  }

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

export { titleCase, categorize };
