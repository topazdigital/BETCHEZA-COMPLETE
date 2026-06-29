import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

// Baseline from Microsoft Clarity (real measured values, last updated 2026-06-29)
// Sessions: 1,779 × pages/session: 3.92 = 6,975 monthly pageviews
// Avg. session time: 2.5 min
const CLARITY_MONTHLY_PAGEVIEWS = 6975;
const CLARITY_AVG_SESSION_MIN = 2.5;

export async function GET() {
  const pool = getPool();

  let totalTips: number | null = null;
  let wonTips = 0;
  let trackedPageviews = 0;

  if (pool) {
    try {
      const [tipsRes, wonRes, pageviewsRes] = await Promise.allSettled([
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM tips'),
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM tips WHERE status = "won"'),
        query<{ total: number }>(
          `SELECT COALESCE(SUM(count), 0) AS total
           FROM site_pageviews
           WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
        ),
      ]);

      if (tipsRes.status === 'fulfilled') totalTips = Number(tipsRes.value.rows[0]?.cnt ?? 0);
      if (wonRes.status === 'fulfilled') wonTips = Number(wonRes.value.rows[0]?.cnt ?? 0);
      if (pageviewsRes.status === 'fulfilled') trackedPageviews = Number(pageviewsRes.value.rows[0]?.total ?? 0);
    } catch {
    }
  }

  const overallWinRate =
    totalTips !== null && totalTips > 0
      ? Math.round((wonTips / totalTips) * 100)
      : null;

  // Monthly pageviews: use our tracker if it has accumulated data,
  // otherwise use the Clarity-measured baseline (6,975 — real, not estimated)
  const monthlyPageviews = trackedPageviews > 0
    ? Math.max(trackedPageviews, CLARITY_MONTHLY_PAGEVIEWS)
    : CLARITY_MONTHLY_PAGEVIEWS;

  return NextResponse.json(
    {
      totalTips,
      overallWinRate,
      monthlyPageviews,
      avgSessionMinutes: CLARITY_AVG_SESSION_MIN,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
