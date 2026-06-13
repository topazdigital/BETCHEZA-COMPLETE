import { NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/warmup
 *
 * Pre-warms all in-process caches so the first real user request is served
 * from memory rather than triggering a cold ESPN/DB fetch.
 *
 * Called by deploy.sh immediately after `pm2 reload` finishes, and by the
 * ecosystem post-start hook. Safe to call at any time — if caches are already
 * warm this returns instantly.
 *
 * Returns a JSON summary of what was warmed and how long it took.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || 'betcheza-cron-2024';
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  const results: Record<string, string> = {};

  // 1. Matches cache — the heaviest thing to warm; also warms leagues, teams, etc.
  try {
    const matches = await getAllMatches();
    results.matches = `${matches.length} matches in ${Date.now() - t0}ms`;
  } catch (e) {
    results.matches = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2. Home payload cache — fires & forgets the home route so it's ready.
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
