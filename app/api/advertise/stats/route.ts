import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { getFakeTipsters } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

// Baseline from Microsoft Clarity (real measured values, last updated 2026-06-29)
// Sessions: 1,779 × pages/session: 3.92 = 6,975 monthly pageviews
// Avg. active time: 2.5 min
// Mobile share: 87% (Clarity device breakdown)
// Geography: Kenya 78%, East Africa 93% (Clarity)
const CLARITY_MONTHLY_PAGEVIEWS = 6975;
const CLARITY_AVG_SESSION_MIN   = 2.5;

export async function GET() {
  const pool = getPool();

  let totalTips: number | null = null;
  let overallWinRate: number | null = null;
  let trackedPageviews = 0;
  let realUserCount: number | null = null;

  if (pool) {
    try {
      const [tipsRes, settledRes, pageviewsRes, usersRes] = await Promise.allSettled([
        // Count all tips (auto_tips = AI-posted tips, tips = user-posted)
        query<{ cnt: number }>(
          `SELECT (SELECT COUNT(*) FROM auto_tips) + (SELECT COUNT(*) FROM tips) AS cnt`
        ),
        // Win rate: won / (won + lost) from auto_tips — excludes pending & void
        query<{ won: number; lost: number }>(
          `SELECT
             SUM(status = 'won')  AS won,
             SUM(status = 'lost') AS lost
           FROM auto_tips`
        ),
        // Real tracked pageviews from our site counter
        query<{ total: number }>(
          `SELECT COALESCE(SUM(count), 0) AS total
           FROM site_pageviews
           WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
        ),
        // Real registered user count
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users'),
      ]);

      if (tipsRes.status === 'fulfilled') {
        totalTips = Number(tipsRes.value.rows[0]?.cnt ?? 0);
      }
      if (settledRes.status === 'fulfilled') {
        const won  = Number(settledRes.value.rows[0]?.won  ?? 0);
        const lost = Number(settledRes.value.rows[0]?.lost ?? 0);
        if (won + lost > 0) overallWinRate = Math.round((won / (won + lost)) * 100);
      }
      if (pageviewsRes.status === 'fulfilled') {
        trackedPageviews = Number(pageviewsRes.value.rows[0]?.total ?? 0);
      }
      if (usersRes.status === 'fulfilled') {
        realUserCount = Number(usersRes.value.rows[0]?.cnt ?? 0);
      }
    } catch {
      // DB unavailable — fall through to nulls
    }
  }

  // Total users = real DB users + fake tipster profiles (all count as users on the platform)
  const fakeCount   = getFakeTipsters().length;
  const totalUsers  = realUserCount !== null ? realUserCount + fakeCount : null;

  // Monthly pageviews: use our tracker if it has meaningful data, else Clarity baseline
  const monthlyPageviews = trackedPageviews > 0
    ? Math.max(trackedPageviews, CLARITY_MONTHLY_PAGEVIEWS)
    : CLARITY_MONTHLY_PAGEVIEWS;

  return NextResponse.json(
    {
      totalTips,
      overallWinRate,
      monthlyPageviews,
      avgSessionMinutes: CLARITY_AVG_SESSION_MIN,
      totalUsers,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
