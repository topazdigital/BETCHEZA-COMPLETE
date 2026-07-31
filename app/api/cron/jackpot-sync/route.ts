/**
 * Jackpot Auto-Sync Cron
 *
 * Called every hour by lib/cron.ts. Fetches REAL jackpot fixtures from:
 *  1. Bookmaker JSON APIs (direct)
 *  2. Kenyan prediction aggregator sites (HTML scraping)
 *
 * IMPORTANT: We NEVER create jackpots from ESPN/cache data. If no real
 * jackpot fixtures are found for a bookmaker, we skip that bookmaker
 * entirely and show nothing rather than fake data.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

interface RawGame { home: string; away: string; league?: string; kickoffTime?: string }

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-KE,en;q=0.9',
  'Cache-Control': 'no-cache',
};

const MOBILE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-KE,en;q=0.9',
  'Cache-Control': 'no-cache',
};

async function tryHtmlFetch(urls: string[]): Promise<{ html: string; url: string } | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 0 },
      });
      if (!res.ok) { console.log(`[jackpot-sync] HTML ${res.status} from ${url}`); continue; }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('html') && !ct.includes('text')) continue;
      const html = await res.text();
      if (html.length < 500) continue; // Cloudflare challenge page
      return { html, url };
    } catch (e) {
      console.log(`[jackpot-sync] HTML fetch failed ${url}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return null;
}

async function tryJsonFetch(urls: string[], extraHeaders?: Record<string, string>): Promise<unknown> {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { ...MOBILE_HEADERS, Referer: new URL(url).origin + '/', ...extraHeaders },
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

// ─── HTML match parsers ───────────────────────────────────────────────────────

/** Parse "Team A vs Team B" patterns from raw HTML */
function parseMatchesFromHtml(html: string, maxCount: number): RawGame[] {
  const games: RawGame[] = [];
  const seen = new Set<string>();

  // Strip script/style blocks to avoid false positives
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '');

  // Pattern 1: "Team A vs Team B" (most common on Kenyan prediction sites)
  const vsPattern = /\b([A-Z][A-Za-z0-9\s'.\-&]{2,35}?)\s+(?:vs?\.?)\s+([A-Z][A-Za-z0-9\s'.\-&]{2,35}?)\b/g;
  let m: RegExpExecArray | null;

  while ((m = vsPattern.exec(cleaned)) !== null && games.length < maxCount) {
    const home = m[1].trim().replace(/\s+/g, ' ');
    const away = m[2].trim().replace(/\s+/g, ' ');
    if (!isValidTeamName(home) || !isValidTeamName(away)) continue;
    const key = `${home.toLowerCase()}|${away.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    games.push({ home, away });
  }

  // Pattern 2: dash-separated "Team A - Team B"
  if (games.length < 4) {
    const dashPat = /\b([A-Z][A-Za-z0-9\s'.\-&]{2,30}?)\s+-\s+([A-Z][A-Za-z0-9\s'.\-&]{2,30}?)\b/g;
    while ((m = dashPat.exec(cleaned)) !== null && games.length < maxCount) {
      const home = m[1].trim();
      const away = m[2].trim();
      if (!isValidTeamName(home) || !isValidTeamName(away)) continue;
      const key = `${home.toLowerCase()}|${away.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      games.push({ home, away });
    }
  }

  return games.slice(0, maxCount);
}

const BAD_WORDS = new Set([
  'click', 'here', 'more', 'tips', 'odds', 'pick', 'win', 'free',
  'jackpot', 'mega', 'midweek', 'grand', 'bonus', 'offer', 'prediction',
  'analysis', 'today', 'week', 'read', 'view', 'share', 'sports', 'bet',
  'sport', 'pesa', 'betika', 'odibets', 'next', 'prev', 'home', 'away',
  'login', 'sign', 'page', 'load', 'please', 'wait',
]);

function isValidTeamName(name: string): boolean {
  if (name.length < 3 || name.length > 40) return false;
  if (/^\d+$/.test(name)) return false;
  if (/^[^A-Za-z]/.test(name)) return false; // must start with a letter
  const lower = name.toLowerCase().trim();
  if (BAD_WORDS.has(lower)) return false;
  // Reject strings that look like sentences or URLs
  if ((name.match(/ /g) || []).length > 5) return false;
  return true;
}

// ─── HTML scraper sources ─────────────────────────────────────────────────────

async function fetchSportPesaMegaFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    // Kenyan aggregator sites — most reliable
    'https://megajackpotpredictions.co.ke/sportpesa-mega-jackpot-prediction/',
    'https://www.megajackpotpredictions.co.ke/sportpesa-mega-jackpot/',
    'https://jackpot.ke/sportpesa-mega-jackpot/',
    'https://www.jackpotpredictions.co.ke/sportpesa-mega-jackpot/',
    'https://betipster.co.ke/sportpesa-mega-jackpot-predictions/',
    'https://www.betipster.co.ke/sportpesa-mega-jackpot/',
    'https://venas.co.ke/sportpesa-mega-jackpot-predictions/',
    'https://venas.co.ke/sportpesa-mega-jackpot/',
    'https://www.multigoal.co.ke/sportpesa-mega-jackpot/',
    'https://www.multigoal.co.ke/sportpesa-mega-jackpot-predictions/',
    // High-traffic Kenyan prediction sites
    'https://www.bettingpesa.com/sportpesa-mega-jackpot/',
    'https://www.bettingpesa.com/sportpesa-mega-jackpot-prediction/',
    'https://jackpotmania.co.ke/sportpesa-mega-jackpot/',
    'https://jackpotmania.co.ke/sportpesa-mega-jackpot-prediction/',
    'https://www.kenyatips.com/sportpesa-mega-jackpot/',
    'https://www.kenyatips.com/sportpesa-mega-jackpot-predictions/',
    'https://tips254.com/sportpesa-mega-jackpot/',
    'https://www.betwinner360.com/sportpesa-mega-jackpot/',
    'https://footytips.co.ke/sportpesa-mega-jackpot/',
    'https://kenyabetting.co.ke/sportpesa-mega-jackpot/',
    'https://www.sportpesatips.co.ke/',
    'https://www.jackpotke.com/sportpesa-mega-jackpot/',
    // International sites covering Kenyan jackpots
    'https://www.ghanasoccernet.com/sportpesa-mega-jackpot-predictions',
    'https://www.sportpesapredictions.com/mega-jackpot/',
    'https://www.sportpesapredictions.co.ke/',
    // Additional Kenyan sources
    'https://www.kenyapredictions.co.ke/sportpesa-mega-jackpot/',
    'https://www.footballpredictions.co.ke/sportpesa-mega-jackpot/',
    'https://www.tipspesa.co.ke/sportpesa-mega-jackpot/',
    'https://www.betspredict.co.ke/sportpesa-mega-jackpot/',
    'https://www.soccerpredictions.co.ke/sportpesa-mega-jackpot/',
    'https://www.betanalyst.co.ke/sportpesa-mega-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] SportPesa Mega: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchSportPesaMidweekFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/sportpesa-midweek-jackpot-prediction/',
    'https://www.megajackpotpredictions.co.ke/sportpesa-midweek-jackpot/',
    'https://jackpot.ke/sportpesa-midweek-jackpot/',
    'https://www.jackpotpredictions.co.ke/sportpesa-midweek-jackpot/',
    'https://betipster.co.ke/sportpesa-midweek-jackpot-predictions/',
    'https://venas.co.ke/sportpesa-midweek-jackpot-predictions/',
    'https://www.multigoal.co.ke/sportpesa-midweek-jackpot/',
    'https://www.bettingpesa.com/sportpesa-midweek-jackpot/',
    'https://jackpotmania.co.ke/sportpesa-midweek-jackpot/',
    'https://www.kenyatips.com/sportpesa-midweek-jackpot/',
    'https://tips254.com/sportpesa-midweek-jackpot/',
    'https://www.betwinner360.com/sportpesa-midweek-jackpot/',
    'https://footytips.co.ke/sportpesa-midweek-jackpot/',
    'https://kenyabetting.co.ke/sportpesa-midweek-jackpot/',
    'https://www.jackpotke.com/sportpesa-midweek-jackpot/',
    'https://www.kenyapredictions.co.ke/sportpesa-midweek-jackpot/',
    'https://www.tipspesa.co.ke/sportpesa-midweek-jackpot/',
    'https://www.betanalyst.co.ke/sportpesa-midweek-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] SportPesa Midweek: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchBetikaGrandFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/betika-grand-jackpot-prediction/',
    'https://www.megajackpotpredictions.co.ke/betika-jackpot-prediction/',
    'https://jackpot.ke/betika-jackpot/',
    'https://www.jackpotpredictions.co.ke/betika-jackpot/',
    'https://betipster.co.ke/betika-grand-jackpot-predictions/',
    'https://venas.co.ke/betika-jackpot-predictions/',
    'https://www.multigoal.co.ke/betika-jackpot/',
    'https://www.bettingpesa.com/betika-grand-jackpot/',
    'https://www.bettingpesa.com/betika-jackpot-prediction/',
    'https://jackpotmania.co.ke/betika-grand-jackpot/',
    'https://jackpotmania.co.ke/betika-jackpot/',
    'https://www.kenyatips.com/betika-grand-jackpot/',
    'https://tips254.com/betika-grand-jackpot/',
    'https://www.betwinner360.com/betika-grand-jackpot/',
    'https://footytips.co.ke/betika-grand-jackpot/',
    'https://kenyabetting.co.ke/betika-jackpot/',
    'https://www.jackpotke.com/betika-jackpot/',
    'https://www.kenyapredictions.co.ke/betika-grand-jackpot/',
    'https://www.footballpredictions.co.ke/betika-grand-jackpot/',
    'https://www.tipspesa.co.ke/betika-grand-jackpot/',
    'https://www.betspredict.co.ke/betika-jackpot/',
    'https://www.betanalyst.co.ke/betika-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Betika Grand: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchBetikaMidweekFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/betika-midweek-jackpot-prediction/',
    'https://www.megajackpotpredictions.co.ke/betika-midweek-jackpot/',
    'https://jackpot.ke/betika-midweek-jackpot/',
    'https://www.jackpotpredictions.co.ke/betika-midweek-jackpot/',
    'https://betipster.co.ke/betika-midweek-jackpot-predictions/',
    'https://venas.co.ke/betika-midweek-jackpot/',
    'https://www.bettingpesa.com/betika-midweek-jackpot/',
    'https://jackpotmania.co.ke/betika-midweek-jackpot/',
    'https://www.kenyatips.com/betika-midweek-jackpot/',
    'https://tips254.com/betika-midweek-jackpot/',
    'https://www.betwinner360.com/betika-midweek-jackpot/',
    'https://footytips.co.ke/betika-midweek-jackpot/',
    'https://kenyabetting.co.ke/betika-midweek-jackpot/',
    'https://www.jackpotke.com/betika-midweek-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Betika Midweek: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchBetikaDailyFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/betika-daily-jackpot/',
    'https://megajackpotpredictions.co.ke/betika-laki-tatu/',
    'https://www.megajackpotpredictions.co.ke/betika-daily-jackpot-prediction/',
    'https://jackpot.ke/betika-daily-jackpot/',
    'https://www.jackpotpredictions.co.ke/betika-daily-jackpot/',
    'https://betipster.co.ke/betika-daily-jackpot-predictions/',
    'https://venas.co.ke/betika-daily-jackpot/',
    'https://www.bettingpesa.com/betika-daily-jackpot/',
    'https://www.bettingpesa.com/betika-laki-tatu/',
    'https://jackpotmania.co.ke/betika-daily-jackpot/',
    'https://jackpotmania.co.ke/betika-laki-tatu/',
    'https://www.kenyatips.com/betika-daily-jackpot/',
    'https://tips254.com/betika-daily-jackpot/',
    'https://footytips.co.ke/betika-daily-jackpot/',
    'https://kenyabetting.co.ke/betika-daily-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 3) {
    console.log(`[jackpot-sync] Betika Daily: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchOdiBetsFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/odibets-jackpot-prediction/',
    'https://jackpot.ke/odibets-jackpot/',
    'https://betipster.co.ke/odibets-jackpot-predictions/',
    'https://venas.co.ke/odibets-jackpot-predictions/',
    'https://www.multigoal.co.ke/odibets-jackpot/',
    'https://www.jackpotpredictions.co.ke/odibets-jackpot/',
    'https://www.bettingpesa.com/odibets-jackpot/',
    'https://www.bettingpesa.com/odibets-jackpot-bonanza/',
    'https://jackpotmania.co.ke/odibets-jackpot/',
    'https://jackpotmania.co.ke/odibets-jackpot-bonanza/',
    'https://www.kenyatips.com/odibets-jackpot/',
    'https://tips254.com/odibets-jackpot/',
    'https://www.betwinner360.com/odibets-jackpot/',
    'https://footytips.co.ke/odibets-jackpot/',
    'https://kenyabetting.co.ke/odibets-jackpot/',
    'https://www.jackpotke.com/odibets-jackpot/',
    'https://www.kenyapredictions.co.ke/odibets-jackpot/',
    'https://www.tipspesa.co.ke/odibets-jackpot/',
    'https://www.betanalyst.co.ke/odibets-jackpot/',
    'https://www.footballpredictions.co.ke/odibets-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] OdiBets: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchBetinFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/betin-jackpot-prediction/',
    'https://jackpot.ke/betin-jackpot/',
    'https://betipster.co.ke/betin-jackpot-predictions/',
    'https://venas.co.ke/betin-jackpot/',
    'https://www.jackpotpredictions.co.ke/betin-jackpot/',
    'https://www.bettingpesa.com/betin-jackpot/',
    'https://jackpotmania.co.ke/betin-jackpot/',
    'https://www.kenyatips.com/betin-jackpot/',
    'https://tips254.com/betin-jackpot/',
    'https://www.betwinner360.com/betin-jackpot/',
    'https://footytips.co.ke/betin-jackpot/',
    'https://kenyabetting.co.ke/betin-jackpot/',
    'https://www.jackpotke.com/betin-jackpot/',
    'https://www.kenyapredictions.co.ke/betin-jackpot/',
    'https://www.tipspesa.co.ke/betin-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Betin: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchMozzartMegaFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/mozzartbet-jackpot-prediction/',
    'https://jackpot.ke/mozzartbet-jackpot/',
    'https://betipster.co.ke/mozzartbet-jackpot-predictions/',
    'https://venas.co.ke/mozzartbet-jackpot/',
    'https://www.jackpotpredictions.co.ke/mozzartbet-jackpot/',
    'https://www.bettingpesa.com/mozzartbet-jackpot/',
    'https://www.bettingpesa.com/mozzartbet-mega-jackpot/',
    'https://jackpotmania.co.ke/mozzartbet-jackpot/',
    'https://jackpotmania.co.ke/mozzartbet-mega-jackpot/',
    'https://www.kenyatips.com/mozzartbet-jackpot/',
    'https://tips254.com/mozzartbet-jackpot/',
    'https://www.betwinner360.com/mozzartbet-jackpot/',
    'https://footytips.co.ke/mozzartbet-jackpot/',
    'https://kenyabetting.co.ke/mozzartbet-jackpot/',
    'https://www.jackpotke.com/mozzartbet-jackpot/',
    'https://www.kenyapredictions.co.ke/mozzartbet-jackpot/',
    'https://www.tipspesa.co.ke/mozzartbet-jackpot/',
    'https://www.betanalyst.co.ke/mozzartbet-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Mozzartbet Mega: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchMozzartMidweekFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/mozzartbet-midweek-jackpot/',
    'https://jackpot.ke/mozzartbet-midweek-jackpot/',
    'https://betipster.co.ke/mozzartbet-midweek-jackpot-predictions/',
    'https://venas.co.ke/mozzartbet-midweek-jackpot/',
    'https://www.jackpotpredictions.co.ke/mozzartbet-midweek-jackpot/',
    'https://www.bettingpesa.com/mozzartbet-midweek-jackpot/',
    'https://jackpotmania.co.ke/mozzartbet-midweek-jackpot/',
    'https://www.kenyatips.com/mozzartbet-midweek-jackpot/',
    'https://tips254.com/mozzartbet-midweek-jackpot/',
    'https://footytips.co.ke/mozzartbet-midweek-jackpot/',
    'https://kenyabetting.co.ke/mozzartbet-midweek-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Mozzartbet Midweek: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchBahatibetFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/bahatibet-jackpot/',
    'https://megajackpotpredictions.co.ke/bahatibet-daily-jackpot/',
    'https://jackpot.ke/bahatibet-jackpot/',
    'https://www.jackpotpredictions.co.ke/bahatibet-jackpot/',
    'https://betipster.co.ke/bahatibet-jackpot-predictions/',
    'https://venas.co.ke/bahatibet-jackpot/',
    'https://www.bettingpesa.com/bahatibet-jackpot/',
    'https://jackpotmania.co.ke/bahatibet-jackpot/',
    'https://www.kenyatips.com/bahatibet-jackpot/',
    'https://tips254.com/bahatibet-jackpot/',
    'https://footytips.co.ke/bahatibet-jackpot/',
    'https://kenyabetting.co.ke/bahatibet-jackpot/',
    'https://www.kenyapredictions.co.ke/bahatibet-jackpot/',
    'https://www.tipspesa.co.ke/bahatibet-jackpot/',
    'https://www.betwinner360.com/bahatibet-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Bahatibet: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchBetlionFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/betlion-jackpot/',
    'https://megajackpotpredictions.co.ke/betlion-super-jackpot/',
    'https://jackpot.ke/betlion-jackpot/',
    'https://www.jackpotpredictions.co.ke/betlion-jackpot/',
    'https://betipster.co.ke/betlion-jackpot-predictions/',
    'https://venas.co.ke/betlion-jackpot/',
    'https://www.bettingpesa.com/betlion-jackpot/',
    'https://jackpotmania.co.ke/betlion-jackpot/',
    'https://www.kenyatips.com/betlion-jackpot/',
    'https://tips254.com/betlion-jackpot/',
    'https://footytips.co.ke/betlion-jackpot/',
    'https://kenyabetting.co.ke/betlion-jackpot/',
    'https://www.kenyapredictions.co.ke/betlion-jackpot/',
    'https://www.tipspesa.co.ke/betlion-jackpot/',
    'https://www.betwinner360.com/betlion-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Betlion: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchSportybetFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/sportybet-jackpot/',
    'https://megajackpotpredictions.co.ke/sportybet-daily-jackpot/',
    'https://jackpot.ke/sportybet-jackpot/',
    'https://www.jackpotpredictions.co.ke/sportybet-jackpot/',
    'https://betipster.co.ke/sportybet-jackpot-predictions/',
    'https://venas.co.ke/sportybet-jackpot/',
    'https://www.bettingpesa.com/sportybet-jackpot/',
    'https://jackpotmania.co.ke/sportybet-jackpot/',
    'https://www.kenyatips.com/sportybet-jackpot/',
    'https://tips254.com/sportybet-jackpot/',
    'https://footytips.co.ke/sportybet-jackpot/',
    'https://kenyabetting.co.ke/sportybet-jackpot/',
    'https://www.kenyapredictions.co.ke/sportybet-jackpot/',
    'https://www.tipspesa.co.ke/sportybet-jackpot/',
    'https://www.betwinner360.com/sportybet-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Sportybet: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchMSportFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/msport-jackpot/',
    'https://jackpot.ke/msport-jackpot/',
    'https://www.jackpotpredictions.co.ke/msport-jackpot/',
    'https://betipster.co.ke/msport-jackpot-predictions/',
    'https://venas.co.ke/msport-jackpot/',
    'https://www.bettingpesa.com/msport-jackpot/',
    'https://jackpotmania.co.ke/msport-jackpot/',
    'https://www.kenyatips.com/msport-jackpot/',
    'https://tips254.com/msport-jackpot/',
    'https://footytips.co.ke/msport-jackpot/',
    'https://kenyabetting.co.ke/msport-jackpot/',
    'https://www.kenyapredictions.co.ke/msport-jackpot/',
    'https://www.tipspesa.co.ke/msport-jackpot/',
    'https://www.betwinner360.com/msport-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] MSport: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchBangbetFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/bangbet-jackpot/',
    'https://jackpot.ke/bangbet-jackpot/',
    'https://www.jackpotpredictions.co.ke/bangbet-jackpot/',
    'https://betipster.co.ke/bangbet-jackpot-predictions/',
    'https://venas.co.ke/bangbet-jackpot/',
    'https://www.bettingpesa.com/bangbet-jackpot/',
    'https://jackpotmania.co.ke/bangbet-jackpot/',
    'https://www.kenyatips.com/bangbet-jackpot/',
    'https://tips254.com/bangbet-jackpot/',
    'https://footytips.co.ke/bangbet-jackpot/',
    'https://kenyabetting.co.ke/bangbet-jackpot/',
    'https://www.kenyapredictions.co.ke/bangbet-jackpot/',
    'https://www.tipspesa.co.ke/bangbet-jackpot/',
    'https://www.betwinner360.com/bangbet-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Bangbet: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

async function fetchShabikyFromWeb(count: number): Promise<RawGame[] | null> {
  const result = await tryHtmlFetch([
    'https://megajackpotpredictions.co.ke/shabiki-jackpot/',
    'https://megajackpotpredictions.co.ke/shabiki-pool-jackpot/',
    'https://jackpot.ke/shabiki-jackpot/',
    'https://www.jackpotpredictions.co.ke/shabiki-jackpot/',
    'https://betipster.co.ke/shabiki-jackpot-predictions/',
    'https://venas.co.ke/shabiki-jackpot/',
    'https://www.bettingpesa.com/shabiki-jackpot/',
    'https://jackpotmania.co.ke/shabiki-jackpot/',
    'https://www.kenyatips.com/shabiki-jackpot/',
    'https://tips254.com/shabiki-jackpot/',
    'https://footytips.co.ke/shabiki-jackpot/',
    'https://kenyabetting.co.ke/shabiki-jackpot/',
    'https://www.kenyapredictions.co.ke/shabiki-jackpot/',
    'https://www.tipspesa.co.ke/shabiki-jackpot/',
    'https://www.betwinner360.com/shabiki-jackpot/',
  ]);
  if (!result) return null;
  const games = parseMatchesFromHtml(result.html, count);
  if (games.length >= 5) {
    console.log(`[jackpot-sync] Shabiki: ${games.length} real games from ${result.url}`);
    return games;
  }
  return null;
}

// ─── JSON API extractors ───────────────────────────────────────────────────────

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
        league: (e.league_name as string) || (e.competition_name as string) || (e.league as string) || undefined,
        kickoffTime: (e.start_time as string) || (e.kickoff as string) || (e.date as string) || (e.start_date as string) || undefined,
      }));
    }
  }
  return null;
}

// ─── Bookmaker fetchers ────────────────────────────────────────────────────────

interface BookmakerResult {
  games: RawGame[] | null;
  jackpotTitle?: string;
  deadline?: string;
  amount?: string;
}

async function fetchBetikaGrandGames(count: number): Promise<BookmakerResult> {
  const data = await tryJsonFetch([
    'https://www.betika.com/api/v1/bet?bet_type=jackpot&per_page=50&page=1',
    'https://www.betika.com/api/v1/jackpots/active',
    'https://api.betika.com/v1/jackpots/active',
    'https://api.betika.com/v1/bet?bet_type=JACKPOT',
    'https://www.betika.com/api/v2/jackpots',
  ], { 'X-Requested-With': 'XMLHttpRequest', 'Origin': 'https://www.betika.com' });

  const d = data as Record<string, unknown> | null;
  const meta = d?.data as Record<string, unknown> | undefined;
  const apiGames = extractGames(data, count);
  if (apiGames && apiGames.length >= 5) {
    return {
      games: apiGames,
      jackpotTitle: (meta?.name as string) || (meta?.title as string) || 'Betika Grand Jackpot',
      deadline: (meta?.closing_time as string) || (meta?.deadline as string) || undefined,
      amount: (meta?.prize as string) || (meta?.amount as string) || undefined,
    };
  }

  console.log('[jackpot-sync] Betika Grand API unavailable, trying HTML scrapers');
  const webGames = await fetchBetikaGrandFromWeb(count);
  return { games: webGames };
}

async function fetchBetikaMidweekGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://www.betika.com/api/v1/bet?bet_type=midweek_jackpot&per_page=30&page=1',
    'https://www.betika.com/api/v1/jackpots/midweek',
    'https://api.betika.com/v1/jackpots/midweek',
    'https://www.betika.com/api/v2/jackpots?type=midweek',
  ], { 'X-Requested-With': 'XMLHttpRequest', 'Origin': 'https://www.betika.com' });

  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) {
    console.log(`[jackpot-sync] Betika Midweek: ${fromApi.length} games from API`);
    return fromApi;
  }

  console.log('[jackpot-sync] Betika Midweek API unavailable, trying HTML scrapers');
  return fetchBetikaMidweekFromWeb(count);
}

async function fetchBetikaDailyGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://www.betika.com/api/v1/bet?bet_type=daily_jackpot&per_page=10&page=1',
    'https://www.betika.com/api/v1/jackpots/daily',
    'https://api.betika.com/v1/jackpots/daily',
    'https://www.betika.com/api/v2/jackpots?type=daily',
  ], { 'X-Requested-With': 'XMLHttpRequest', 'Origin': 'https://www.betika.com' });

  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 3) {
    console.log(`[jackpot-sync] Betika Daily: ${fromApi.length} games from API`);
    return fromApi;
  }

  console.log('[jackpot-sync] Betika Daily API unavailable, trying HTML scrapers');
  return fetchBetikaDailyFromWeb(count);
}

/** SportPesa Mega and Midweek are scraped separately to get the right fixture lists */
async function fetchSportPesaMegaGames(count: number): Promise<RawGame[] | null> {
  // Try JSON API first (usually blocked by Cloudflare but worth trying)
  const data = await tryJsonFetch([
    'https://ke.sportpesa.com/api/v2/jackpots',
    'https://ke.sportpesa.com/api/v1/jackpots/mega',
    'https://www.sportpesa.co.ke/api/v1/jackpots',
    'https://ke.sportpesa.com/api/v1/jackpots',
    'https://api.sportpesa.co.ke/v1/jackpots',
  ], { 'Cache-Control': 'no-cache' });

  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) {
    console.log(`[jackpot-sync] SportPesa Mega: ${fromApi.length} games from API`);
    return fromApi;
  }

  // Try prediction aggregator HTML scraping (real fixtures, published by third-party sites)
  console.log('[jackpot-sync] SportPesa API unavailable, trying HTML scrapers');
  const fromWeb = await fetchSportPesaMegaFromWeb(count);
  if (fromWeb && fromWeb.length >= 5) return fromWeb;

  // No real data available — return null, do NOT use ESPN cache
  console.log('[jackpot-sync] SportPesa Mega: no real data available — skipping');
  return null;
}

async function fetchSportPesaMidweekGames(count: number): Promise<RawGame[] | null> {
  // Try JSON API first
  const data = await tryJsonFetch([
    'https://ke.sportpesa.com/api/v2/jackpots?type=midweek',
    'https://ke.sportpesa.com/api/v1/jackpots/midweek',
    'https://www.sportpesa.co.ke/api/v1/jackpots/midweek',
  ], { 'Cache-Control': 'no-cache' });

  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) {
    console.log(`[jackpot-sync] SportPesa Midweek: ${fromApi.length} games from API`);
    return fromApi;
  }

  console.log('[jackpot-sync] SportPesa Midweek API unavailable, trying HTML scrapers');
  const fromWeb = await fetchSportPesaMidweekFromWeb(count);
  if (fromWeb && fromWeb.length >= 5) return fromWeb;

  // If midweek-specific scrape fails, try using first 13 from Mega (they sometimes share games)
  // Only if Mega already found real data
  console.log('[jackpot-sync] SportPesa Midweek: no real data available — skipping');
  return null;
}

async function fetchOdiBetsGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://api.odibets.com/v1/jackpot/active',
    'https://www.odibets.com/api/v1/jackpots',
    'https://odibets.com/api/jackpot',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchOdiBetsFromWeb(count);
}

async function fetchBetinGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://ke.betin.com/api/v1/jackpots/active',
    'https://api.ke.betin.com/v1/jackpots',
    'https://ke.betin.com/api/jackpot',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchBetinFromWeb(count);
}

async function fetchMozzartMegaGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://ke.mozzartbet.com/api/v1/jackpots',
    'https://ke.mozzartbet.com/api/v1/jackpots/mega',
    'https://www.mozzartbet.co.ke/api/jackpots',
    'https://ke.mozzartbet.com/betshop/jackpot',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchMozzartMegaFromWeb(count);
}

async function fetchMozzartMidweekGamesFunc(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://ke.mozzartbet.com/api/v1/jackpots/midweek',
    'https://ke.mozzartbet.com/api/v2/jackpots?type=midweek',
    'https://www.mozzartbet.co.ke/api/jackpots/midweek',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchMozzartMidweekFromWeb(count);
}

async function fetchBahatibetGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://bahatibet.co.ke/api/v1/jackpots',
    'https://api.bahatibet.co.ke/v1/jackpots/active',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchBahatibetFromWeb(count);
}

async function fetchBetlionGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://betlion.co.ke/api/v1/jackpots',
    'https://api.betlion.co.ke/v1/jackpots/active',
    'https://www.betlion.co.ke/api/jackpot',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchBetlionFromWeb(count);
}

async function fetchSportybetGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://www.sportybet.com/api/ke/factsCenter/queryFootballMatchesByTournamentId',
    'https://www.sportybet.com/api/ke/jackpot',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchSportybetFromWeb(count);
}

async function fetchMSportGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://www.msport.co.ke/api/v1/jackpots',
    'https://api.msport.co.ke/v1/jackpots/active',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchMSportFromWeb(count);
}

async function fetchBangbetGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://www.bangbet.co.ke/api/v1/jackpots',
    'https://api.bangbet.co.ke/v1/jackpots/active',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchBangbetFromWeb(count);
}

async function fetchShabikyGames(count: number): Promise<RawGame[] | null> {
  const data = await tryJsonFetch([
    'https://www.shabiki.com/api/v1/jackpots',
    'https://api.shabiki.com/v1/jackpots/active',
    'https://www.shabiki.com/api/jackpot',
  ]);
  const fromApi = extractGames(data, count);
  if (fromApi && fromApi.length >= 5) return fromApi;

  return fetchShabikyFromWeb(count);
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

// ─── AI Predict ────────────────────────────────────────────────────────────────

async function autoPredict(jackpotIds: string[]): Promise<number> {
  if (jackpotIds.length === 0) return 0;
  let predicted = 0;
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

// ─── Push notifications ────────────────────────────────────────────────────────

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

    // Fetch all bookmaker sources in parallel — each jackpot type has its own dedicated scraper
    const [
      betikaGrandResult,
      betikaMidweekGames,
      betikaDailyGames,
      spMegaGames,
      spMidweekGames,
      odibetsGames,
      betinGames,
      mozzartMegaGames,
      mozzartMidweekGames,
      bahatibetGames,
      betlionGames,
      sportybetGames,
      msportGames,
      bangbetGames,
      shabikyGames,
    ] = await Promise.all([
      fetchBetikaGrandGames(17),
      fetchBetikaMidweekGames(13),
      fetchBetikaDailyGames(5),
      fetchSportPesaMegaGames(17),
      fetchSportPesaMidweekGames(13),
      fetchOdiBetsGames(10),
      fetchBetinGames(13),
      fetchMozzartMegaGames(13),
      fetchMozzartMidweekGamesFunc(10),
      fetchBahatibetGames(10),
      fetchBetlionGames(13),
      fetchSportybetGames(10),
      fetchMSportGames(10),
      fetchBangbetGames(10),
      fetchShabikyGames(13),
    ]);

    const betikaGrandGames = betikaGrandResult.games;

    // Log which sources returned real data
    const liveSources: string[] = [];
    if (spMegaGames)       liveSources.push('SportPesa Mega');
    if (spMidweekGames)    liveSources.push('SportPesa Midweek');
    if (betikaGrandGames)  liveSources.push('Betika Grand');
    if (betikaMidweekGames) liveSources.push('Betika Midweek');
    if (betikaDailyGames)  liveSources.push('Betika Daily');
    if (odibetsGames)      liveSources.push('OdiBets');
    if (betinGames)        liveSources.push('Betin');
    if (mozzartMegaGames)  liveSources.push('Mozzartbet Mega');
    if (mozzartMidweekGames) liveSources.push('Mozzartbet Midweek');
    if (bahatibetGames)    liveSources.push('Bahatibet');
    if (betlionGames)      liveSources.push('Betlion');
    if (sportybetGames)    liveSources.push('Sportybet');
    if (msportGames)       liveSources.push('MSport');
    if (bangbetGames)      liveSources.push('Bangbet');
    if (shabikyGames)      liveSources.push('Shabiki');
    console.log(`[jackpot-sync] real data found: ${liveSources.join(', ') || 'none — no jackpots created'}`);

    const desired = [
      {
        bookmakerSlug: 'sportpesa', bookmakerName: 'SportPesa',
        title: 'SportPesa Mega Jackpot', jackpotAmount: '100000000', currency: 'KES',
        games: spMegaGames, deadline: daysFromNow(5),
      },
      {
        bookmakerSlug: 'sportpesa', bookmakerName: 'SportPesa',
        title: 'SportPesa Midweek Jackpot', jackpotAmount: '15000000', currency: 'KES',
        games: spMidweekGames, deadline: daysFromNow(2),
      },
      {
        bookmakerSlug: 'betika', bookmakerName: 'Betika',
        title: betikaGrandResult.jackpotTitle || 'Betika Grand Jackpot',
        jackpotAmount: betikaGrandResult.amount || '30000000', currency: 'KES',
        games: betikaGrandGames, deadline: betikaGrandResult.deadline || daysFromNow(4),
      },
      {
        bookmakerSlug: 'betika', bookmakerName: 'Betika',
        title: 'Betika Midweek Jackpot', jackpotAmount: '15000000', currency: 'KES',
        games: betikaMidweekGames, deadline: daysFromNow(2),
      },
      {
        bookmakerSlug: 'betika', bookmakerName: 'Betika',
        title: 'Betika Daily Jackpot', jackpotAmount: '1000000', currency: 'KES',
        games: betikaDailyGames, deadline: daysFromNow(1), minGames: 3,
      },
      {
        bookmakerSlug: 'odibets', bookmakerName: 'OdiBets',
        title: 'OdiBets Jackpot Bonanza', jackpotAmount: '5000000', currency: 'KES',
        games: odibetsGames, deadline: daysFromNow(3),
      },
      {
        bookmakerSlug: 'betin', bookmakerName: 'Betin Kenya',
        title: 'Betin Grand Jackpot', jackpotAmount: '20000000', currency: 'KES',
        games: betinGames, deadline: daysFromNow(4),
      },
      {
        bookmakerSlug: 'mozzartbet', bookmakerName: 'Mozzartbet',
        title: 'Mozzartbet Mega Jackpot', jackpotAmount: '25000000', currency: 'KES',
        games: mozzartMegaGames, deadline: daysFromNow(5),
      },
      {
        bookmakerSlug: 'mozzartbet', bookmakerName: 'Mozzartbet',
        title: 'Mozzartbet Midweek Jackpot', jackpotAmount: '5000000', currency: 'KES',
        games: mozzartMidweekGames, deadline: daysFromNow(2),
      },
      {
        bookmakerSlug: 'bahatibet', bookmakerName: 'Bahatibet',
        title: 'Bahatibet Daily Jackpot', jackpotAmount: '1000000', currency: 'KES',
        games: bahatibetGames, deadline: daysFromNow(1), minGames: 5,
      },
      {
        bookmakerSlug: 'betlion', bookmakerName: 'Betlion',
        title: 'Betlion Super Jackpot', jackpotAmount: '5000000', currency: 'KES',
        games: betlionGames, deadline: daysFromNow(4),
      },
      {
        bookmakerSlug: 'sportybet', bookmakerName: 'Sportybet',
        title: 'Sportybet Daily Jackpot', jackpotAmount: '1000000', currency: 'KES',
        games: sportybetGames, deadline: daysFromNow(1),
      },
      {
        bookmakerSlug: 'msport', bookmakerName: 'MSport',
        title: 'MSport Jackpot', jackpotAmount: '2000000', currency: 'KES',
        games: msportGames, deadline: daysFromNow(3),
      },
      {
        bookmakerSlug: 'bangbet', bookmakerName: 'Bangbet',
        title: 'Bangbet Jackpot', jackpotAmount: '1000000', currency: 'KES',
        games: bangbetGames, deadline: daysFromNow(3),
      },
      {
        bookmakerSlug: 'shabiki', bookmakerName: 'Shabiki',
        title: 'Shabiki Pool Jackpot', jackpotAmount: '5000000', currency: 'KES',
        games: shabikyGames, deadline: daysFromNow(4),
      },
    ];

    // Remove any stale jackpots that may contain fake data (detected by ESPN league names)
    const existing = getJackpots();
    for (const j of existing) {
      if (j.status === 'active') {
        const wcCount = j.games.filter(g => g.league?.includes('World Cup') || g.league?.includes('FIFA')).length;
        if (wcCount >= 3) {
          console.log(`[jackpot-sync] Removing stale fake-data jackpot: ${j.title}`);
          deleteJackpot(j.id);
        }
      }
    }

    const activeByTitle = new Map(getJackpots().filter(j => j.status === 'active').map(j => [j.title, j]));

    let created = 0;
    let refreshed = 0;
    let skipped = 0;
    let noData = 0;
    const newJackpotIds: string[] = [];
    const newBookmakerNames: string[] = [];

    for (const def of desired) {
      // CRITICAL: skip if no real data — never create fake jackpots
      const minRequired = (def as { minGames?: number }).minGames ?? 5;
      if (!def.games || def.games.length < minRequired) {
        noData++;
        continue;
      }

      const existingJp = activeByTitle.get(def.title);
      if (existingJp && !isExpiredOrMissing(existingJp.deadline)) {
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

    const predicted = await autoPredict(newJackpotIds);

    if (created + refreshed > 0) {
      const uniqueBookmakers = [...new Set(newBookmakerNames)];
      void notifyJackpotSubscribers(created + refreshed, uniqueBookmakers);
    }

    console.log(`[jackpot-sync] created=${created} refreshed=${refreshed} skipped=${skipped} noRealData=${noData} predicted=${predicted}`);

    return NextResponse.json({
      success: true, created, refreshed, skipped, noData, predicted,
      liveSources,
      message: `${created + refreshed} jackpots synced from real sources. ${noData} skipped (no real data). ${predicted} AI-predicted.`,
    });
  } catch (e) {
    console.error('[cron/jackpot-sync] error:', e);
    return NextResponse.json({ error: 'Sync failed', details: String(e) }, { status: 500 });
  }
}
