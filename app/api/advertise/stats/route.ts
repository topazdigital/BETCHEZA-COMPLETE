import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  const pool = getPool();

  let totalTips: number | null = null;
  let wonTips = 0;
  let monthlyPageviews: number | null = null;

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
      if (pageviewsRes.status === 'fulfilled') monthlyPageviews = Number(pageviewsRes.value.rows[0]?.total ?? 0);
    } catch {
    }
  }

  const overallWinRate =
    totalTips !== null && totalTips > 0
      ? Math.round((wonTips / totalTips) * 100)
      : null;

  return NextResponse.json(
    {
      totalTips,
      overallWinRate,
      monthlyPageviews,
      avgSessionMinutes: null,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
