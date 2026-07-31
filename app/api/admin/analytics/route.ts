import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({
      daily: [],
      topPages: [],
      totals: { today: 0, yesterday: 0, week: 0, month: 0 },
    });
  }

  const [dailyRes, topPagesRes, totalsRes] = await Promise.allSettled([
    query<{ date: string; total: number }>(
      `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, SUM(count) AS total
       FROM site_pageviews
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY date
       ORDER BY date ASC`
    ),
    query<{ path: string; total: number }>(
      `SELECT path, SUM(count) AS total
       FROM site_pageviews
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY path
       ORDER BY total DESC
       LIMIT 15`
    ),
    query<{ today: number; yesterday: number; week: number; month: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN date = CURDATE() THEN count END), 0)                          AS today,
         COALESCE(SUM(CASE WHEN date = CURDATE() - INTERVAL 1 DAY THEN count END), 0)         AS yesterday,
         COALESCE(SUM(CASE WHEN date >= CURDATE() - INTERVAL 6 DAY THEN count END), 0)        AS week,
         COALESCE(SUM(CASE WHEN date >= CURDATE() - INTERVAL 29 DAY THEN count END), 0)       AS month
       FROM site_pageviews`
    ),
  ]);

  const daily = dailyRes.status === 'fulfilled'
    ? dailyRes.value.rows.map(r => ({ date: r.date, total: Number(r.total) }))
    : [];

  const topPages = topPagesRes.status === 'fulfilled'
    ? topPagesRes.value.rows.map(r => ({ path: r.path, total: Number(r.total) }))
    : [];

  const raw = totalsRes.status === 'fulfilled' ? totalsRes.value.rows[0] : null;
  const totals = {
    today:     Number(raw?.today     ?? 0),
    yesterday: Number(raw?.yesterday ?? 0),
    week:      Number(raw?.week      ?? 0),
    month:     Number(raw?.month     ?? 0),
  };

  return NextResponse.json({ daily, topPages, totals });
}
