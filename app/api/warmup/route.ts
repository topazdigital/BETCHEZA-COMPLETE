import { NextResponse } from 'next/server';
import { forceRefreshMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/warmup
 *
 * Refreshes the match cache after a deploy. The refresh function has internal
 * time caps, so awaiting it here gives deploy.sh an honest match count without
 * allowing a slow ESPN request to hold Apache open indefinitely.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || 'betcheza-cron-2024';
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  let refreshedMatches = 0;
  let refreshResult: 'completed' | 'timed-out' | 'failed' = 'completed';
  try {
    const refreshed = await forceRefreshMatches();
    refreshedMatches = refreshed.length;
    // A sparse response is not a successful warmup. This prevents deploy.sh
    // from treating the old five-match fallback as a healthy cache.
    if (refreshedMatches < 50) refreshResult = 'timed-out';
  } catch {
    refreshResult = 'failed';
  }

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
    homeResult = `timeout/error (${Date.now() - homeT}ms)`;
  }

  return NextResponse.json({
    ok: true,
    totalMs: Date.now() - t0,
    warmed: {
        matches: refreshedMatches,
        refresh: refreshResult,
      home: homeResult,
    },
    ts: new Date().toISOString(),
  });
}
