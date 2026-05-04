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

    // Fetch all bookmaker sources in parallel — no ESPN fallback
    const [betikaResult, sportpesaGames, odibetsGames, betinGames, mozzartGames] = await Promise.all([
      fetchBetikaGames(15),
      fetchSportPesaGames(17),
      fetchOdiBetsGames(10),
      fetchBetinGames(13),
      fetchMozzartGames(15),
    ]);

    const betikaGames = betikaResult.games;

    // Log which sources returned live data
    const liveSources: string[] = [];
    if (betikaGames) liveSources.push('Betika');
    if (sportpesaGames) liveSources.push('SportPesa');
    if (odibetsGames) liveSources.push('OdiBets');
    if (betinGames) liveSources.push('Betin');
    if (mozzartGames) liveSources.push('Mozzartbet');
    console.log(`[jackpot-sync] live sources: ${liveSources.join(', ') || 'none'}`);

    const desired = [
      {
        bookmakerSlug: 'sportpesa', bookmakerName: 'SportPesa',
        title: 'SportPesa Mega Jackpot', jackpotAmount: '100000000', currency: 'KES',
        games: sportpesaGames, deadline: daysFromNow(5), source: 'live',
      },
      {
        bookmakerSlug: 'sportpesa', bookmakerName: 'SportPesa',
        title: 'SportPesa Midweek Jackpot', jackpotAmount: '15000000', currency: 'KES',
        games: sportpesaGames ? sportpesaGames.slice(0, 13) : null, deadline: daysFromNow(2), source: 'live',
      },
      {
        bookmakerSlug: 'betika', bookmakerName: 'Betika',
        title: betikaResult.jackpotTitle || 'Betika Grand Jackpot', jackpotAmount: betikaResult.amount || '30000000', currency: 'KES',
        games: betikaGames, deadline: betikaResult.deadline || daysFromNow(4), source: 'live',
      },
      {
        bookmakerSlug: 'betika', bookmakerName: 'Betika',
        title: 'Betika Midweek Jackpot', jackpotAmount: '15000000', currency: 'KES',
        games: betikaGames ? betikaGames.slice(0, 13) : null, deadline: daysFromNow(2), source: 'live',
      },
      {
        bookmakerSlug: 'odibets', bookmakerName: 'OdiBets',
        title: 'OdiBets Jackpot Bonanza', jackpotAmount: '5000000', currency: 'KES',
        games: odibetsGames, deadline: daysFromNow(3), source: 'live',
      },
      {
        bookmakerSlug: 'betin', bookmakerName: 'Betin Kenya',
        title: 'Betin Grand Jackpot', jackpotAmount: '20000000', currency: 'KES',
        games: betinGames, deadline: daysFromNow(4), source: 'live',
      },
      {
        bookmakerSlug: 'mozzartbet', bookmakerName: 'Mozzartbet',
        title: 'Mozzartbet Mega Jackpot', jackpotAmount: '25000000', currency: 'KES',
        games: mozzartGames, deadline: daysFromNow(5), source: 'live',
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

    const liveCount = desired.filter(d => d.games && d.games.length > 0).length;

    console.log(`[jackpot-sync] created=${created} refreshed=${refreshed} skipped=${skipped} predicted=${predicted} live=${liveCount}`);

    return NextResponse.json({
      success: true, created, refreshed, skipped, predicted,
      liveCount,
      message: `${created + refreshed} jackpots synced, ${predicted} AI-predicted, ${skipped} already up-to-date`,
    });
  } catch (e) {
    console.error('[cron/jackpot-sync] error:', e);
    return NextResponse.json({ error: 'Sync failed', details: String(e) }, { status: 500 });
  }
}
