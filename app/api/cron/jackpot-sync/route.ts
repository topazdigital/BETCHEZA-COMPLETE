/**
 * Jackpot Auto-Sync Cron
 *
 * Called every hour by lib/cron.ts. Checks each bookmaker for newly published
 * jackpots, creates them, and immediately runs AI predictions + sends push
 * notifications to subscribed users.
 *
 * Smart: only replaces jackpots whose deadline has passed. Open rounds kept.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron';

interface RawGame { home: string; away: string; league?: string; kickoffTime?: string }

// ─── Bookmaker fetchers ────────────────────────────────────────────────────────

async function tryJsonFetch(urls: string[], extraHeaders?: Record<string, string>): Promise<unknown> {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 Chrome/112 Mobile Safari/537.36',
          Accept: 'application/json',
          'Accept-Language': 'en-KE,en;q=0.9',
          Referer: new URL(url).origin + '/',
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(9000),
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) continue;
      return await res.json();
    } catch { /* try next */ }
  }
  return null;
}

function extractGames(data: unknown, count: number): RawGame[] | null {
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const dd = (d?.data ?? {}) as Record<string, unknown>;
  const dj = (d?.jackpot ?? {}) as Record<string, unknown>;
  const candidates = [
    dd?.events, d?.events, d?.games, d?.matches,
    d?.picks, dd?.picks, dd?.games, dd?.matches,
    d?.data, dj?.events, d?.results,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      return (c as Record<string, unknown>[]).slice(0, count).map((e, idx) => ({
        home: (e.home_team as string) || (e.homeTeam as string) || (e.home as string) || (e.team1 as string) || `Home ${idx+1}`,
        away: (e.away_team as string) || (e.awayTeam as string) || (e.away as string) || (e.team2 as string) || `Away ${idx+1}`,
        league: (e.league_name as string) || (e.competition_name as string) || (e.league as string) || (e.competition as string) || (e.category as string) || undefined,
        kickoffTime: (e.start_time as string) || (e.kickoff as string) || (e.date as string) || (e.start_date as string) || (e.match_time as string) || undefined,
      }));
    }
  }
  return null;
}

interface BookmakerResult {
  games: RawGame[] | null;
  jackpotTitle?: string;
  deadline?: string;
  amount?: string;
}

async function fetchBetikaGames(count: number): Promise<BookmakerResult> {
  // Betika's website is JS-rendered (Angular SPA). Try their internal API endpoints
  // with various authentication/header patterns.
  const data = await tryJsonFetch([
    'https://www.betika.com/api/v1/bet?bet_type=jackpot&per_page=50&page=1',
    'https://www.betika.com/api/v1/jackpots/active',
    'https://api.betika.com/v1/jackpots/active',
    'https://api.betika.com/v1/bet?bet_type=JACKPOT',
    'https://www.betika.com/api/v2/jackpots',
  ], { 'X-Requested-With': 'XMLHttpRequest', 'Origin': 'https://www.betika.com' });

  const d = data as Record<string, unknown> | null;
  const meta = d?.data as Record<string, unknown> | undefined;
  return {
    games: extractGames(data, count),
    jackpotTitle: (meta?.name as string) || (meta?.title as string) || undefined,
    deadline: (meta?.closing_time as string) || (meta?.deadline as string) || (meta?.expires_at as string) || undefined,
    amount: (meta?.prize as string) || (meta?.amount as string) || undefined,
  };
}

async function fetchSportPesaGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://www.sportpesa.co.ke/api/v1/jackpots',
    'https://www.sportpesa.co.ke/api/v1/jackpots/pool-of-the-week',
    'https://ke.sportpesa.com/api/v1/jackpots',
    'https://api.sportpesa.co.ke/v1/jackpots',
  ]);
  return extractGames(data, count);
}

async function fetchOdiBetsGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://api.odibets.com/v1/jackpot/active',
    'https://www.odibets.com/api/v1/jackpots',
    'https://odibets.com/api/jackpot',
  ]);
  return extractGames(data, count);
}

async function fetchBetinGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://ke.betin.com/api/v1/jackpots/active',
    'https://api.ke.betin.com/v1/jackpots',
    'https://ke.betin.com/api/jackpot',
  ]);
  return extractGames(data, count);
}

async function fetchMozzartGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://ke.mozzartbet.com/api/v1/jackpots',
    'https://www.mozzartbet.co.ke/api/jackpots',
    'https://ke.mozzartbet.com/betshop/jackpot',
  ]);
  return extractGames(data, count);
}

// ─── ESPN real match fetcher (fallback) ───────────────────────────────────────

async function fetchESPNUpcoming(count: number): Promise<RawGame[]> {
  const endpoints = [
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
    { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/mex.1/scoreboard', league: 'Liga MX' },
  ];
  const games: RawGame[] = [];
  await Promise.allSettled(endpoints.map(async ({ url, league }) => {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000), next: { revalidate: 300 } });
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

function isExpiredOrMissing(deadline: string | undefined): boolean {
  if (!deadline) return true;
  return new Date(deadline).getTime() < Date.now();
}

// ─── AI Predict a batch of jackpots ──────────────────────────────────────────

async function autoPredict(jackpotIds: string[]): Promise<number> {
  if (jackpotIds.length === 0) return 0;
  let predicted = 0;
  // Always use localhost — we're always running server-side alongside Next.js
  const port = process.env.PORT || '5000';
  const base = `http://localhost:${port}`;
  for (const id of jackpotIds) {
    try {
      const r = await fetch(`${base}/api/jackpot/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jackpotId: id }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) predicted++;
    } catch (e) {
      console.warn('[jackpot-sync] predict failed for', id, e instanceof Error ? e.message : e);
    }
  }
  return predicted;
}

// ─── Push notification to jackpot topic subscribers ──────────────────────────

async function notifyJackpotSubscribers(newCount: number, bookmakerNames: string[]): Promise<void> {
  if (newCount === 0) return;
  try {
    const { listTopicSubscriptions, sendPushToSubscription } = await import('@/lib/push-sender');
    const subs = await listTopicSubscriptions('jackpots');
    if (subs.length === 0) return;

    const title = `🎯 ${newCount} New Jackpot${newCount > 1 ? 's' : ''} Published!`;
    const body = `${bookmakerNames.join(', ')} jackpot${newCount > 1 ? 's are' : ' is'} now open. Get your free AI picks now!`;

    await Promise.allSettled(subs.map(sub =>
      sendPushToSubscription(sub, { title, body, url: '/jackpots', tag: 'new-jackpot', icon: '/icon-192.png' })
    ));
    console.log(`[jackpot-sync] sent push to ${subs.length} jackpot subscribers`);
  } catch (e) {
    console.warn('[jackpot-sync] push notify failed:', e instanceof Error ? e.message : e);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { getJackpots, createJackpot, deleteJackpot } = await import('@/lib/jackpot-store');

    // Fetch all sources in parallel
    const [betikaResult, sportpesaGames, odibetsGames, betinGames, mozzartGames, espnGames] = await Promise.all([
      fetchBetikaGames(15),
      fetchSportPesaGames(17),
      fetchOdiBetsGames(10),
      fetchBetinGames(13),
      fetchMozzartGames(15),
      fetchESPNUpcoming(90),
    ]);

    const betikaGames = betikaResult.games;

    // Log which sources returned live data
    const liveSources: string[] = [];
    if (betikaGames) liveSources.push('Betika');
    if (sportpesaGames) liveSources.push('SportPesa');
    if (odibetsGames) liveSources.push('OdiBets');
    if (betinGames) liveSources.push('Betin');
    if (mozzartGames) liveSources.push('Mozzartbet');
    if (espnGames.length > 0) liveSources.push(`ESPN(${espnGames.length})`);
    console.log(`[jackpot-sync] live sources: ${liveSources.join(', ') || 'none'}`);

    function pickESPN(count: number, offset: number): RawGame[] {
      const pool = espnGames;
      if (pool.length === 0) return [];
      const start = offset % pool.length;
      return [...pool.slice(start), ...pool.slice(0, start)].slice(0, count);
    }

    const desired = [
      {
        bookmakerSlug: 'sportpesa', bookmakerName: 'SportPesa',
        title: 'SportPesa Mega Jackpot', jackpotAmount: '100000000', currency: 'KES',
        games: sportpesaGames ?? pickESPN(17, 0), deadline: daysFromNow(5), source: sportpesaGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'sportpesa', bookmakerName: 'SportPesa',
        title: 'SportPesa Midweek Jackpot', jackpotAmount: '15000000', currency: 'KES',
        games: sportpesaGames ? sportpesaGames.slice(0, 13) : pickESPN(13, 5), deadline: daysFromNow(2), source: sportpesaGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'betika', bookmakerName: 'Betika',
        title: betikaResult.jackpotTitle || 'Betika Grand Jackpot', jackpotAmount: betikaResult.amount || '30000000', currency: 'KES',
        games: betikaGames ?? pickESPN(15, 10), deadline: betikaResult.deadline || daysFromNow(4), source: betikaGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'betika', bookmakerName: 'Betika',
        title: 'Betika Midweek Jackpot', jackpotAmount: '15000000', currency: 'KES',
        games: betikaGames ? betikaGames.slice(0, 13) : pickESPN(13, 20), deadline: daysFromNow(2), source: betikaGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'odibets', bookmakerName: 'OdiBets',
        title: 'OdiBets Jackpot Bonanza', jackpotAmount: '5000000', currency: 'KES',
        games: odibetsGames ?? pickESPN(10, 30), deadline: daysFromNow(3), source: odibetsGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'betin', bookmakerName: 'Betin Kenya',
        title: 'Betin Grand Jackpot', jackpotAmount: '20000000', currency: 'KES',
        games: betinGames ?? pickESPN(13, 40), deadline: daysFromNow(4), source: betinGames ? 'live' : 'espn',
      },
      {
        bookmakerSlug: 'mozzartbet', bookmakerName: 'Mozzartbet',
        title: 'Mozzartbet Mega Jackpot', jackpotAmount: '25000000', currency: 'KES',
        games: mozzartGames ?? pickESPN(15, 50), deadline: daysFromNow(5), source: mozzartGames ? 'live' : 'espn',
      },
    ];

    const existing = getJackpots();
    const activeByTitle = new Map(existing.filter(j => j.status === 'active').map(j => [j.title, j]));

    let created = 0;
    let refreshed = 0;
    let skipped = 0;
    const newJackpotIds: string[] = [];
    const newBookmakerNames: string[] = [];

    for (const def of desired) {
      if (!def.games || def.games.length === 0) { skipped++; continue; }

      const existingJp = activeByTitle.get(def.title);
      if (existingJp && !isExpiredOrMissing(existingJp.deadline)) {
        // Still open — only predict if not predicted yet
        if (!existingJp.games.some(g => g.aiPrediction)) {
          newJackpotIds.push(existingJp.id);
        }
        skipped++;
        continue;
      }

      if (existingJp) deleteJackpot(existingJp.id);

      const newJp = createJackpot({
        bookmakerSlug: def.bookmakerSlug,
        bookmakerName: def.bookmakerName,
        title: def.title,
        jackpotAmount: def.jackpotAmount,
        currency: def.currency,
        deadline: def.deadline,
        games: def.games.map((g, i) => ({
          id: `${def.bookmakerSlug}-g${Date.now()}-${i}`,
          home: g.home, away: g.away, league: g.league, kickoffTime: g.kickoffTime,
        })),
        status: 'active',
      });

      newJackpotIds.push(newJp.id);
      newBookmakerNames.push(def.bookmakerName);
      if (existingJp) { refreshed++; } else { created++; }
    }

    // Auto-predict ALL newly created/refreshed jackpots immediately
    const predicted = await autoPredict(newJackpotIds);

    // Send push notifications for truly new jackpots (not just re-predicted existing ones)
    if (created + refreshed > 0) {
      const uniqueBookmakers = [...new Set(newBookmakerNames)];
      void notifyJackpotSubscribers(created + refreshed, uniqueBookmakers);
    }

    const liveCount = desired.filter(d => d.source === 'live' && d.games && d.games.length > 0).length;
    const espnCount = desired.filter(d => d.source === 'espn' && d.games && d.games.length > 0).length;

    console.log(`[jackpot-sync] created=${created} refreshed=${refreshed} skipped=${skipped} predicted=${predicted} live=${liveCount} espn=${espnCount}`);

    return NextResponse.json({
      success: true, created, refreshed, skipped, predicted,
      liveCount, espnCount,
      message: `${created + refreshed} jackpots synced, ${predicted} AI-predicted, ${skipped} already up-to-date`,
    });
  } catch (e) {
    console.error('[cron/jackpot-sync] error:', e);
    return NextResponse.json({ error: 'Sync failed', details: String(e) }, { status: 500 });
  }
}
