/**
 * Jackpot Auto-Sync Cron
 *
 * Called every hour by lib/cron.ts. Intelligently checks each bookmaker for
 * newly published jackpots and adds them to the store WITHOUT wiping existing
 * active jackpots that are still open. Only replaces jackpots whose deadline
 * has already passed.
 *
 * Bookmaker APIs checked:
 *   - Betika  (midweek + grand jackpot) — https://www.betika.com
 *   - SportPesa (mega + midweek)        — https://www.sportpesa.co.ke
 *   - OdiBets                           — https://www.odibets.com
 *   - Betin Kenya                       — https://ke.betin.com
 *   - Mozzartbet Kenya                  — https://ke.mozzartbet.com
 *
 * When bookmaker APIs return no data, real scheduled fixtures are fetched from
 * the free ESPN public API as a fallback so the page always has content.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron';

interface RawGame { home: string; away: string; league?: string; kickoffTime?: string }

// ─── Bookmaker fetchers ────────────────────────────────────────────────────────

async function tryFetch(urls: string[]): Promise<unknown> {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'Accept-Language': 'en-KE,en' },
        signal: AbortSignal.timeout(9000),
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      return data;
    } catch { /* try next */ }
  }
  return null;
}

function extractGames(data: unknown, count: number): RawGame[] | null {
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const events = d?.data?.events ?? d?.events ?? d?.games ?? d?.matches ?? d?.picks
    ?? d?.data?.picks ?? d?.data?.games ?? d?.data;
  if (!Array.isArray(events) || events.length === 0) return null;
  return events.slice(0, count).map((e: Record<string, unknown>) => ({
    home: (e.home_team as string) || (e.homeTeam as string) || (e.home as string) || 'Home',
    away: (e.away_team as string) || (e.awayTeam as string) || (e.away as string) || 'Away',
    league: (e.league_name as string) || (e.competition_name as string) || (e.league as string) || (e.competition as string) || undefined,
    kickoffTime: (e.start_time as string) || (e.kickoff as string) || (e.date as string) || (e.start_date as string) || undefined,
  }));
}

async function fetchBetikaGames(count: number): Promise<{ games: RawGame[]; jackpotTitle?: string; deadline?: string; amount?: string } | null> {
  const data = await tryFetch([
    'https://www.betika.com/api/v1/bet?bet_type=jackpot&limit=50',
    'https://api.betika.com/v1/jackpots',
    'https://www.betika.com/api/v1/jackpots',
    'https://www.betika.com/api/v2/jackpots?status=active',
  ]);
  const d = data as Record<string, unknown> | null;
  if (!d) return null;

  // Try to extract jackpot metadata
  const jackpotMeta = d?.data as Record<string, unknown> | undefined;
  const title = (jackpotMeta?.name as string) || (jackpotMeta?.title as string) || undefined;
  const deadline = (jackpotMeta?.closing_time as string) || (jackpotMeta?.deadline as string)
    || (jackpotMeta?.expires_at as string) || undefined;
  const amount = (jackpotMeta?.prize as string) || (jackpotMeta?.amount as string) || undefined;

  const games = extractGames(data, count);
  if (!games) return null;
  return { games, jackpotTitle: title, deadline, amount };
}

async function fetchSportPesaGames(count: number): Promise<RawGame[] | null> {
  const data = await tryFetch([
    'https://www.sportpesa.co.ke/api/v1/jackpots/pool-of-the-week',
    'https://www.sportpesa.co.ke/api/v1/jackpots',
    'https://ke.sportpesa.com/api/v1/jackpots',
  ]);
  return extractGames(data, count);
}

async function fetchOdiBetsGames(count: number): Promise<RawGame[] | null> {
  const data = await tryFetch([
    'https://api.odibets.com/v1/jackpot/active',
    'https://odibets.com/api/jackpot',
    'https://www.odibets.com/api/v1/jackpots',
  ]);
  return extractGames(data, count);
}

async function fetchBetinGames(count: number): Promise<RawGame[] | null> {
  const data = await tryFetch([
    'https://ke.betin.com/api/v1/jackpots/active',
    'https://ke.betin.com/api/jackpot',
    'https://api.ke.betin.com/v1/jackpots',
  ]);
  return extractGames(data, count);
}

async function fetchMozzartGames(count: number): Promise<RawGame[] | null> {
  const data = await tryFetch([
    'https://ke.mozzartbet.com/api/v1/jackpots',
    'https://ke.mozzartbet.com/betshop/jackpot',
    'https://www.mozzartbet.co.ke/api/jackpots',
  ]);
  return extractGames(data, count);
}

async function fetchESPNUpcoming(count: number): Promise<RawGame[]> {
  const leagueEndpoints = [
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', league: 'Premier League' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', league: 'La Liga' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard', league: 'Bundesliga' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard', league: 'Serie A' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard', league: 'Ligue 1' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', league: 'Champions League' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard', league: 'Europa League' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/por.1/scoreboard', league: 'Primeira Liga' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ned.1/scoreboard', league: 'Eredivisie' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/sco.1/scoreboard', league: 'Scottish Premiership' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard', league: 'Süper Lig' },
  ];
  const games: RawGame[] = [];
  await Promise.allSettled(leagueEndpoints.map(async ({ url, league }) => {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 600 },
      });
      if (!res.ok) return;
      const data = await res.json() as { events?: unknown[] };
      for (const ev of (data.events ?? [])) {
        const e = ev as Record<string, unknown>;
        const comp = (e.competitions as Record<string, unknown>[])?.[0];
        if (!comp) continue;
        const stateVal = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>)?.state as string | undefined;
        if (stateVal && stateVal !== 'pre') continue;
        const competitors = comp.competitors as Record<string, unknown>[] | undefined;
        if (!competitors || competitors.length < 2) continue;
        const home = competitors.find((c) => (c.homeAway as string) === 'home');
        const away = competitors.find((c) => (c.homeAway as string) === 'away');
        if (!home || !away) continue;
        games.push({
          home: (home.team as Record<string, string>)?.displayName || (home.team as Record<string, string>)?.name || 'Home',
          away: (away.team as Record<string, string>)?.displayName || (away.team as Record<string, string>)?.name || 'Away',
          league,
          kickoffTime: (e.date as string) || (comp.date as string) || undefined,
        });
      }
    } catch { /* skip */ }
  }));
  return games.slice(0, count);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function makeGameId(slug: string, idx: number): string {
  return `${slug}-g${Date.now()}-${idx}`;
}

function isExpiredOrMissing(deadline: string | undefined): boolean {
  if (!deadline) return true;
  return new Date(deadline).getTime() < Date.now();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Allow internal calls (from cron.ts) and authenticated admin calls
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { getJackpots, createJackpot, deleteJackpot } = await import('@/lib/jackpot-store');

    // Fetch all data sources in parallel
    const [betikaResult, sportpesaGames, odibetsGames, betinGames, mozzartGames, espnGames] = await Promise.all([
      fetchBetikaGames(15),
      fetchSportPesaGames(17),
      fetchOdiBetsGames(10),
      fetchBetinGames(13),
      fetchMozzartGames(15),
      fetchESPNUpcoming(90),
    ]);

    const betikaGames = betikaResult?.games ?? null;

    // Rotate ESPN games for variety between bookmakers
    function pickESPN(count: number, offset: number): RawGame[] {
      const pool = espnGames;
      if (pool.length === 0) return [];
      const start = offset % pool.length;
      return [...pool.slice(start), ...pool.slice(0, start)].slice(0, count);
    }

    // Define jackpots we want to maintain, one entry per bookmaker-type
    const desired = [
      {
        bookmakerSlug: 'sportpesa',
        bookmakerName: 'SportPesa',
        title: 'SportPesa Mega Jackpot',
        jackpotAmount: '100000000',
        currency: 'KES',
        games: sportpesaGames ?? pickESPN(17, 0),
        deadline: daysFromNow(5),
        source: sportpesaGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'sportpesa',
        bookmakerName: 'SportPesa',
        title: 'SportPesa Midweek Jackpot',
        jackpotAmount: '15000000',
        currency: 'KES',
        games: sportpesaGames ? sportpesaGames.slice(0, 13) : pickESPN(13, 5),
        deadline: daysFromNow(2),
        source: sportpesaGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'betika',
        bookmakerName: 'Betika',
        title: betikaResult?.jackpotTitle || 'Betika Grand Jackpot',
        jackpotAmount: betikaResult?.amount || '30000000',
        currency: 'KES',
        games: betikaGames ?? pickESPN(15, 10),
        deadline: betikaResult?.deadline || daysFromNow(4),
        source: betikaGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'betika',
        bookmakerName: 'Betika',
        title: 'Betika Midweek Jackpot',
        jackpotAmount: '15000000',
        currency: 'KES',
        games: betikaGames ? betikaGames.slice(0, 13) : pickESPN(13, 20),
        deadline: daysFromNow(2),
        source: betikaGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'odibets',
        bookmakerName: 'OdiBets',
        title: 'OdiBets Jackpot Bonanza',
        jackpotAmount: '5000000',
        currency: 'KES',
        games: odibetsGames ?? pickESPN(10, 30),
        deadline: daysFromNow(3),
        source: odibetsGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'betin',
        bookmakerName: 'Betin Kenya',
        title: 'Betin Grand Jackpot',
        jackpotAmount: '20000000',
        currency: 'KES',
        games: betinGames ?? pickESPN(13, 40),
        deadline: daysFromNow(4),
        source: betinGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'mozzartbet',
        bookmakerName: 'Mozzartbet',
        title: 'Mozzartbet Mega Jackpot',
        jackpotAmount: '25000000',
        currency: 'KES',
        games: mozzartGames ?? pickESPN(15, 50),
        deadline: daysFromNow(5),
        source: mozzartGames ? 'live' : 'espn',
      },
    ];

    const existing = getJackpots();
    const activeByTitle = new Map(existing.filter(j => j.status === 'active').map(j => [j.title, j]));

    let created = 0;
    let refreshed = 0;
    let skipped = 0;
    const sources: Record<string, string> = {};

    for (const def of desired) {
      if (!def.games || def.games.length === 0) { skipped++; continue; }

      const existing = activeByTitle.get(def.title);

      // If an active jackpot exists and its deadline hasn't passed, skip it
      // (don't overwrite a live round that's still open)
      if (existing && !isExpiredOrMissing(existing.deadline)) {
        // But if this is the first sync (games might be ESPN stubs), still skip
        skipped++;
        sources[def.title] = 'kept';
        continue;
      }

      // If there was an expired one, remove it
      if (existing) {
        deleteJackpot(existing.id);
      }

      // Create the new jackpot
      createJackpot({
        bookmakerSlug: def.bookmakerSlug,
        bookmakerName: def.bookmakerName,
        title: def.title,
        jackpotAmount: def.jackpotAmount,
        currency: def.currency,
        deadline: def.deadline,
        games: def.games.map((g, i) => ({
          id: makeGameId(def.bookmakerSlug, i),
          home: g.home,
          away: g.away,
          league: g.league,
          kickoffTime: g.kickoffTime,
        })),
        status: 'active',
      });

      if (existing) { refreshed++; } else { created++; }
      sources[def.title] = def.source;
    }

    const liveSources = Object.values(sources).filter(s => s === 'live').length;
    const espnSources = Object.values(sources).filter(s => s === 'espn').length;

    console.log(`[cron/jackpot-sync] created=${created} refreshed=${refreshed} skipped=${skipped} live=${liveSources} espn=${espnSources}`);

    return NextResponse.json({
      success: true,
      created,
      refreshed,
      skipped,
      liveSources,
      espnSources,
      sources,
      message: `${created + refreshed} jackpots synced (${liveSources} live, ${espnSources} ESPN fallback), ${skipped} already up-to-date`,
    });
  } catch (e) {
    console.error('[cron/jackpot-sync] error:', e);
    return NextResponse.json({ error: 'Sync failed', details: String(e) }, { status: 500 });
  }
}
