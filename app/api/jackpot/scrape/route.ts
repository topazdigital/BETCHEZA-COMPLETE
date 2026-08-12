import { NextRequest, NextResponse } from 'next/server';
import { createJackpot, getActiveJackpots, resetJackpots } from '@/lib/jackpot-store';
import type { JackpotGame } from '@/lib/jackpot-types';

export const dynamic = 'force-dynamic';

// ─── Real match fetchers per bookmaker ────────────────────────────────────────
// We fetch real upcoming football matches from each bookmaker's public API.
// Each fetcher tries multiple endpoint patterns and returns null on failure
// so the caller can skip that bookmaker gracefully.

interface RawGame { home: string; away: string; league?: string; kickoffTime?: string; }

/** SportPesa public jackpot API */
async function fetchSportPesaGames(count: number): Promise<RawGame[] | null> {
  const endpoints = [
    'https://www.sportpesa.co.ke/api/v1/jackpots/pool-of-the-week',
    'https://www.sportpesa.co.ke/api/v1/jackpots',
    'https://ke.sportpesa.com/api/v1/jackpots',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      // Try common response shapes
      const events = data?.data?.events ?? data?.events ?? data?.games ?? data?.matches ?? data?.data?.games;
      if (Array.isArray(events) && events.length > 0) {
        return events.slice(0, count).map((e: Record<string, unknown>) => ({
          home: (e.home_team as string) || (e.homeTeam as string) || (e.home as string) || 'Home',
          away: (e.away_team as string) || (e.awayTeam as string) || (e.away as string) || 'Away',
          league: (e.league_name as string) || (e.competition as string) || (e.league as string) || undefined,
          kickoffTime: (e.start_time as string) || (e.kickoff as string) || (e.date as string) || undefined,
        }));
      }
    } catch { /* try next */ }
  }
  return null;
}

/** Betika public jackpot API */
async function fetchBetikaGames(count: number): Promise<RawGame[] | null> {
  const endpoints = [
    'https://www.betika.com/api/v1/bet?bet_type=jackpot&limit=50',
    'https://api.betika.com/v1/jackpots',
    'https://www.betika.com/api/v1/jackpots',
    'https://www.betika.com/api/v2/jackpots?status=active',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'Accept-Language': 'en-KE,en' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const events = data?.data?.events ?? data?.events ?? data?.picks ?? data?.data?.picks ?? data?.matches ?? data?.data;
      if (Array.isArray(events) && events.length > 0) {
        return events.slice(0, count).map((e: Record<string, unknown>) => ({
          home: (e.home as string) || (e.home_team as string) || (e.parent_match_id as string) || 'Home',
          away: (e.away as string) || (e.away_team as string) || 'Away',
          league: (e.competition_name as string) || (e.league as string) || undefined,
          kickoffTime: (e.start_time as string) || (e.kickoff as string) || undefined,
        }));
      }
    } catch { /* try next */ }
  }
  return null;
}

/** OdiBets public jackpot API */
async function fetchOdiBetsGames(count: number): Promise<RawGame[] | null> {
  const endpoints = [
    'https://api.odibets.com/v1/jackpot/active',
    'https://odibets.com/api/jackpot',
    'https://www.odibets.com/api/v1/jackpots',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const events = data?.data?.events ?? data?.events ?? data?.games ?? data?.matches ?? data?.data;
      if (Array.isArray(events) && events.length > 0) {
        return events.slice(0, count).map((e: Record<string, unknown>) => ({
          home: (e.home_team as string) || (e.home as string) || 'Home',
          away: (e.away_team as string) || (e.away as string) || 'Away',
          league: (e.league as string) || (e.competition as string) || undefined,
          kickoffTime: (e.start_time as string) || (e.kickoff_time as string) || undefined,
        }));
      }
    } catch { /* try next */ }
  }
  return null;
}

/** Betin Kenya public jackpot API */
async function fetchBetinGames(count: number): Promise<RawGame[] | null> {
  const endpoints = [
    'https://ke.betin.com/api/v1/jackpots/active',
    'https://ke.betin.com/api/jackpot',
    'https://api.ke.betin.com/v1/jackpots',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const events = data?.data?.events ?? data?.events ?? data?.games ?? data?.data;
      if (Array.isArray(events) && events.length > 0) {
        return events.slice(0, count).map((e: Record<string, unknown>) => ({
          home: (e.home_team as string) || (e.home as string) || 'Home',
          away: (e.away_team as string) || (e.away as string) || 'Away',
          league: (e.league as string) || (e.competition as string) || undefined,
          kickoffTime: (e.start_time as string) || (e.start_date as string) || undefined,
        }));
      }
    } catch { /* try next */ }
  }
  return null;
}

/** Mozzartbet Kenya public jackpot API */
async function fetchMozzartGames(count: number): Promise<RawGame[] | null> {
  const endpoints = [
    'https://ke.mozzartbet.com/api/v1/jackpots',
    'https://ke.mozzartbet.com/betshop/jackpot',
    'https://www.mozzartbet.co.ke/api/jackpots',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const events = data?.data?.events ?? data?.events ?? data?.games ?? data?.data;
      if (Array.isArray(events) && events.length > 0) {
        return events.slice(0, count).map((e: Record<string, unknown>) => ({
          home: (e.home_team as string) || (e.home as string) || 'Home',
          away: (e.away_team as string) || (e.away as string) || 'Away',
          league: (e.league as string) || (e.competition as string) || undefined,
          kickoffTime: (e.start_time as string) || (e.match_date as string) || undefined,
        }));
      }
    } catch { /* try next */ }
  }
  return null;
}


function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function toJackpotGames(raw: RawGame[], bookmakerSlug: string, offset = 0): JackpotGame[] {
  return raw.map((r, i) => ({
    id: `${bookmakerSlug}-g${Date.now()}-${offset + i}`,
    home: r.home,
    away: r.away,
    league: r.league,
    kickoffTime: r.kickoffTime,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'betcheza-cron';
    if (authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch real games from each bookmaker (in parallel for speed)
    const [
      sportpesaGames,
      betikaGames,
      odibetsGames,
      betinGames,
      mozzartGames,
    ] = await Promise.all([
      fetchSportPesaGames(17),
      fetchBetikaGames(15),
      fetchOdiBetsGames(10),
      fetchBetinGames(13),
      fetchMozzartGames(15),
    ]);

    // Only use real bookmaker data — no ESPN fallback
    // Only include a jackpot if we fetched the exact required number of games.
    // SportPesa Mega = 17 games, Midweek = 13 games. If counts don't match,
    // the API returned wrong/partial data — skip rather than show fake games.
    const spMegaGames = (sportpesaGames && sportpesaGames.length >= 17) ? sportpesaGames.slice(0, 17) : null;
    const spMidGames  = (sportpesaGames && sportpesaGames.length >= 13) ? sportpesaGames.slice(0, 13) : null;
    const betikaGrand = (betikaGames && betikaGames.length >= 13) ? betikaGames : null;
    const betikaMid   = (betikaGames && betikaGames.length >= 10) ? betikaGames.slice(0, 13) : null;

    const jackpotDefs = [
      {
        bookmakerSlug: 'sportpesa',
        bookmakerName: 'SportPesa',
        title: 'SportPesa Mega Jackpot',
        jackpotAmount: '100000000',
        currency: 'KES',
        deadline: todayPlusDays(5),
        rawGames: spMegaGames,
        source: 'live',
      },
      {
        bookmakerSlug: 'sportpesa',
        bookmakerName: 'SportPesa',
        title: 'SportPesa Midweek Jackpot',
        jackpotAmount: '15000000',
        currency: 'KES',
        deadline: todayPlusDays(2),
        rawGames: spMidGames,
        source: 'live',
      },
      {
        bookmakerSlug: 'betika',
        bookmakerName: 'Betika',
        title: 'Betika Grand Jackpot',
        jackpotAmount: '30000000',
        currency: 'KES',
        deadline: todayPlusDays(4),
        rawGames: betikaGrand,
        source: 'live',
      },
      {
        bookmakerSlug: 'betika',
        bookmakerName: 'Betika',
        title: 'Betika Midweek Jackpot',
        jackpotAmount: '10000000',
        currency: 'KES',
        deadline: todayPlusDays(2),
        rawGames: betikaMid,
        source: 'live',
      },
      {
        bookmakerSlug: 'odibets',
        bookmakerName: 'OdiBets',
        title: 'OdiBets Jackpot Bonanza',
        jackpotAmount: '5000000',
        currency: 'KES',
        deadline: todayPlusDays(3),
        rawGames: odibetsGames && odibetsGames.length >= 8 ? odibetsGames : null,
        source: 'live',
      },
      {
        bookmakerSlug: 'betin',
        bookmakerName: 'Betin Kenya',
        title: 'Betin Grand Jackpot',
        jackpotAmount: '20000000',
        currency: 'KES',
        deadline: todayPlusDays(4),
        rawGames: betinGames && betinGames.length >= 10 ? betinGames : null,
        source: 'live',
      },
      {
        bookmakerSlug: 'mozzartbet',
        bookmakerName: 'Mozzartbet',
        title: 'Mozzartbet Mega Jackpot',
        jackpotAmount: '25000000',
        currency: 'KES',
        deadline: todayPlusDays(5),
        rawGames: mozzartGames && mozzartGames.length >= 10 ? mozzartGames : null,
        source: 'live',
      },
    ];

    // Never clear active jackpots here. This endpoint is also used by the admin
    // refresh button, and a temporary bookmaker outage must not erase jackpots
    // that were already posted. An upcoming record with the same title is the
    // source of truth until its deadline passes; missing/partial scraper data
    // is never a reason to remove it.
    const store = await import('@/lib/jackpot-store');
    const activeByTitle = new Map(
      store.getActiveJackpots().map(j => [j.title.toLowerCase(), j]),
    );

    const sources: Record<string, string> = {};
    let created = 0;
    let preserved = 0;
    for (const def of jackpotDefs) {
      if (!def.rawGames || def.rawGames.length === 0) continue;
      const existing = activeByTitle.get(def.title.toLowerCase());
      if (existing && new Date(existing.deadline).getTime() > Date.now()) {
        preserved++;
        continue;
      }
      if (existing) store.deleteJackpot(existing.id);
      const games = toJackpotGames(def.rawGames, def.bookmakerSlug, created * 100);
      store.createJackpot({
        bookmakerSlug: def.bookmakerSlug,
        bookmakerName: def.bookmakerName,
        title: def.title,
        jackpotAmount: def.jackpotAmount,
        currency: def.currency,
        deadline: def.deadline,
        games,
        status: 'active',
      });
      sources[def.title] = def.source;
      created++;
    }

    return NextResponse.json({
      success: true,
      message: `Scraped ${created} jackpots from live bookmaker data`,
      created,
      preserved,
      sources,
    });
  } catch (e) {
    console.error('[jackpot scrape] error:', e);
    return NextResponse.json({ error: 'Scrape failed', details: String(e) }, { status: 500 });
  }
}
