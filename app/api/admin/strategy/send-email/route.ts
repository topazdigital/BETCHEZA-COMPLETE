import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';
import { fileStoreGet } from '@/lib/file-store';
import { sendMail } from '@/lib/mailer';
import { strategyPicksEmail } from '@/lib/email-templates';
import type { AccessRecord } from '@/app/api/strategy/access/route';
import type { DayPrediction } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId: number | null = body.userId ?? null;

  const { query: dbQuery } = await import('@/lib/db');

  let dayData: DayPrediction | null = null;
  try {
    const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const eatNow = new Date(Date.now() + EAT_OFFSET_MS);
    const todayStr = eatNow.toISOString().slice(0, 10);

    const res = await dbQuery<{
      date: string; day_number: number; stake: number; save_amount: number;
      target_win: number; combined_odds: string | number; picks: string | null;
    }>(
      `SELECT date, day_number, stake, save_amount, target_win, combined_odds, picks
       FROM daily_strategy WHERE date = ? LIMIT 1`,
      [todayStr]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      dayData = {
        day: row.day_number,
        date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
        stake: row.stake,
        save: row.save_amount,
        targetWin: row.target_win,
        picks: row.picks ? JSON.parse(row.picks) : [],
        combinedOdds: parseFloat(String(row.combined_odds)) || 0,
        status: 'active',
      };
    }
  } catch { /* fallback */ }

  if (!dayData || dayData.picks.length === 0) {
    return NextResponse.json({ error: 'No active picks found for today. Post picks first.' }, { status: 400 });
  }

  const accessRecords = fileStoreGet<AccessRecord[]>('strategy-access', []);
  const now = Date.now();
  const activeRecords = accessRecords.filter(r => new Date(r.expiresAt).getTime() > now);

  let targetIds: number[] = activeRecords.map(r => r.userId);
  if (targetUserId !== null) {
    targetIds = targetIds.filter(id => id === targetUserId);
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ error: 'No active subscribers to email.' }, { status: 400 });
  }

  let usersRes: { rows: Array<{ id: number; email: string; username: string; display_name: string | null }> } = { rows: [] };
  try {
    const placeholders = targetIds.map(() => '?').join(',');
    usersRes = await dbQuery<{ id: number; email: string; username: string; display_name: string | null }>(
      `SELECT u.id, u.email, u.username, COALESCE(up.display_name, u.username) AS display_name
       FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id IN (${placeholders}) AND u.email IS NOT NULL AND u.email != ''`,
      targetIds
    );
  } catch { }

  const currentDay = dayData;
  let sent = 0;
  const failed: string[] = [];
  for (const u of usersRes.rows) {
    try {
      const tpl = strategyPicksEmail({
        subscriberName: u.display_name || u.username,
        day: currentDay.day,
        date: currentDay.date,
        stake: currentDay.stake,
        targetWin: currentDay.targetWin,
        picks: currentDay.picks,
        combinedOdds: currentDay.combinedOdds,
      });
      await sendMail({ to: u.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      sent++;
    } catch (e) {
      failed.push(u.email);
      console.error('[strategy-send-email] failed for', u.email, e);
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    total: usersRes.rows.length,
    failed,
    message: targetUserId
      ? `Email sent to subscriber.`
      : `Sent to ${sent} of ${usersRes.rows.length} active subscriber${usersRes.rows.length !== 1 ? 's' : ''}.`,
  });
}
