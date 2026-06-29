import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { getFakeTipsters } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  const pool = getPool();

  let totalUsers = 0;
  let totalTipsters = 0;
  let totalTips = 0;
  let wonTips = 0;
  let newUsersThisMonth = 0;
  let activeUsersThisMonth = 0;
  let totalFollows = 0;
  let totalChallenges = 0;

  if (pool) {
    try {
      const [
        userCountRes,
        tipsterCountRes,
        tipsCountRes,
        wonTipsRes,
        newUsersRes,
        activeUsersRes,
        followsRes,
        challengesRes,
      ] = await Promise.allSettled([
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users'),
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM tipster_profiles WHERE is_active = 1'),
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM tips'),
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM tips WHERE status = "won"'),
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'),
        query<{ cnt: number }>('SELECT COUNT(DISTINCT user_id) AS cnt FROM tips WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'),
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM user_follows'),
        query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM challenges'),
      ]);

      if (userCountRes.status === 'fulfilled') totalUsers = Number(userCountRes.value.rows[0]?.cnt ?? 0);
      if (tipsterCountRes.status === 'fulfilled') totalTipsters = Number(tipsterCountRes.value.rows[0]?.cnt ?? 0);
      if (tipsCountRes.status === 'fulfilled') totalTips = Number(tipsCountRes.value.rows[0]?.cnt ?? 0);
      if (wonTipsRes.status === 'fulfilled') wonTips = Number(wonTipsRes.value.rows[0]?.cnt ?? 0);
      if (newUsersRes.status === 'fulfilled') newUsersThisMonth = Number(newUsersRes.value.rows[0]?.cnt ?? 0);
      if (activeUsersRes.status === 'fulfilled') activeUsersThisMonth = Number(activeUsersRes.value.rows[0]?.cnt ?? 0);
      if (followsRes.status === 'fulfilled') totalFollows = Number(followsRes.value.rows[0]?.cnt ?? 0);
      if (challengesRes.status === 'fulfilled') totalChallenges = Number(challengesRes.value.rows[0]?.cnt ?? 0);
    } catch {
    }
  }

  const fakes = getFakeTipsters();
  const combinedUsers = Math.max(totalUsers + fakes.length, 50000);
  const combinedTipsters = Math.max(totalTipsters + fakes.filter(f => f.isPro).length, 1200);
  const combinedTips = Math.max(totalTips, 85000);
  const overallWinRate = totalTips > 0 ? Math.round((wonTips / totalTips) * 100) : 67;

  return NextResponse.json({
    totalUsers: combinedUsers,
    totalTipsters: combinedTipsters,
    totalTips: combinedTips,
    overallWinRate,
    newUsersThisMonth: Math.max(newUsersThisMonth, 3200),
    activeUsersThisMonth: Math.max(activeUsersThisMonth, 18000),
    totalFollows: Math.max(totalFollows, 120000),
    totalChallenges: Math.max(totalChallenges, 4500),
    monthlyPageviews: 320000,
    avgSessionMinutes: 8.4,
    mobilePercent: 87,
    kenyaPercent: 78,
    eastAfricaPercent: 93,
    ageRange: {
      '18-24': 31,
      '25-34': 44,
      '35-44': 18,
      '45+': 7,
    },
    topSports: [
      { sport: 'Football', percent: 74 },
      { sport: 'Basketball', percent: 9 },
      { sport: 'Tennis', percent: 7 },
      { sport: 'Rugby', percent: 5 },
      { sport: 'Other', percent: 5 },
    ],
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
