import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { sendStrategyResultPush } from '@/lib/strategy-push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DbRow {
  id: number;
  day_number: number;
  result: string | null;
  picks: string | null;
  result_published: number;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { date } = body as { date?: string };
  if (!date) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  }

  // Fetch the current row so we can send push notification
  let dayRow: DbRow | null = null;
  try {
    const res = await query<DbRow>(
      `SELECT id, day_number, result, picks, result_published FROM daily_strategy WHERE date = ? LIMIT 1`,
      [date]
    );
    dayRow = res.rows[0] ?? null;
  } catch { /* non-fatal */ }

  if (!dayRow) {
    return NextResponse.json({ error: 'No strategy entry found for that date' }, { status: 404 });
  }

  // Mark picks/result as published publicly.
  // If no result is recorded yet that's fine — publishing makes the picks
  // visible to all users now; the result badge will appear once settled/saved.
  try {
    await execute(
      `UPDATE daily_strategy SET result_published = 1, is_approved = 1 WHERE date = ?`,
      [date]
    );
  } catch (e) {
    console.error('[strategy/publish-result] DB update failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  // Send push notifications non-blocking
  setImmediate(async () => {
    try {
      if (dayRow!.result && dayRow!.picks) {
        const picks = JSON.parse(dayRow!.picks);
        await sendStrategyResultPush(date, dayRow!.day_number || 0, dayRow!.result as 'win' | 'loss', picks);
      }
    } catch (e) {
      console.error('[strategy/publish-result] push notification failed:', e);
    }
  });

  return NextResponse.json({ success: true, date, result: dayRow.result });
}
