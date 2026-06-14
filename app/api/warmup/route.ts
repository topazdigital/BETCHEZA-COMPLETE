import { NextResponse } from 'next/server';
import { forceRefreshMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/warmup
 *
 * Forces a live ESPN re-fetch so today's matches are in cache before users
 * hit the site. Always fetches fresh data — never returns stale file-cache
 * data from a previous day (which caused "0 matches today" after deploys).
 *
 * Called by deploy.sh immediately after `pm2 reload` finishes, and by the
 * ecosystem post_start hook. Safe to call at any time.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || 'betcheza-cron-2024';
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  const results: Record<string, string> = {};

  // Force a live ESPN re-fetch and wait for it to finish.
  // This ensures today's matches (not yesterday's cached data) are in memory
  // before deploy.sh completes and users start hitting the site.
  try {
    const matches = await forceRefreshMatches();
    results.matches = `${matches.length} matches in ${Date.now() - t0}ms`;
  } catch (e) {
    results.matches = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Pre-warm the home payload cache.
  const homeT = Date.now();
  try {
    const baseUrl =
      process.env.INTERNAL_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
      `http://localhost:${process.env.PORT || 5000}`;
    const homeRes = await fetch(`${baseUrl}/api/home`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(20000),
    });
    results.home = homeRes.ok
      ? `ok (${Date.now() - homeT}ms)`
      : `http ${homeRes.status} (${Date.now() - homeT}ms)`;
  } catch (e) {
    results.home = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    ok: true,
    totalMs: Date.now() - t0,
    warmed: results,
    ts: new Date().toISOString(),
  });
}
