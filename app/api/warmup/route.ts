import { NextResponse } from 'next/server';
import { forceRefreshMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/warmup
 *
 * Triggers a background ESPN cache refresh so today's matches load quickly
 * for users. Returns immediately without waiting for ESPN to complete —
 * previously this blocked for minutes when ESPN rate-limited the server IP,
 * causing deploy.sh health checks to fail and leaving the site with a 503.
 *
 * The actual data refresh continues in the background; subsequent requests
 * will serve fresh data once it's ready (stale-while-revalidate pattern).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || 'betcheza-cron-2024';
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();

  // Fire-and-forget: trigger the ESPN refresh in the background.
  // Do NOT await it — if ESPN is slow or rate-limiting this server's IP,
  // waiting here causes Apache to 503 and the deploy to fail entirely.
  // The 30-second cap in forceRefreshMatches() ensures it eventually resolves.
  forceRefreshMatches().catch(() => { /* errors logged inside */ });

  // Pre-warm the home payload cache (with a short timeout so we don't block).
  const homeT = Date.now();
  let homeResult = 'skipped';
  try {
    const baseUrl =
      process.env.INTERNAL_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
      `http://localhost:${process.env.PORT || 5000}`;
    const homeRes = await fetch(`${baseUrl}/api/home`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000),
    });
    homeResult = homeRes.ok
      ? `ok (${Date.now() - homeT}ms)`
      : `http ${homeRes.status} (${Date.now() - homeT}ms)`;
  } catch {
    homeResult = `timeout/error (${Date.now() - homeT}ms) — matches refreshing in background`;
  }

  return NextResponse.json({
    ok: true,
    totalMs: Date.now() - t0,
    warmed: {
      matches: 'refreshing in background',
      home: homeResult,
    },
    ts: new Date().toISOString(),
  });
}
