import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { fileStoreGet } from '@/lib/file-store';
import { sendMail } from '@/lib/mailer';
import { strategyPicksEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AccessRecord {
  userId: number;
  expiresAt: string;
}

interface DbDayRow {
  picks: string | null;
  stake: number;
  target_win: number;
  day_number: number;
  combined_odds: number | string;
  is_approved: number;
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

  // Mark picks as approved in DB
  let affectedRows = 0;
  try {
    const r = await execute(
      `UPDATE daily_strategy SET is_approved = 1, approved_at = NOW() WHERE date = ?`,
      [date]
    );
    affectedRows = r.affectedRows ?? 0;
  } catch (e) {
    console.error('[strategy/approve] DB update failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (affectedRows === 0) {
    return NextResponse.json({ error: 'No strategy entry found for that date' }, { status: 404 });
  }

  // Send picks to all active subscribers (non-blocking)
  setImmediate(async () => {
    try {
      const result = await query<DbDayRow>(
        `SELECT picks, stake, target_win, day_number, combined_odds FROM daily_strategy WHERE date = ?`,
        [date]
      );
      if (!result.rows.length || !result.rows[0].picks) return;

      const row = result.rows[0];
      const picks = JSON.parse(row.picks as string);
      if (!Array.isArray(picks) || picks.length === 0) return;

      const accessRecords = fileStoreGet<AccessRecord[]>('strategy-access', []);
      const now = Date.now();
      const activeUserIds = accessRecords
        .filter(r => new Date(r.expiresAt).getTime() > now)
        .map(r => r.userId);

      if (activeUserIds.length === 0) return;

      const placeholders = activeUserIds.map(() => '?').join(',');
      const usersRes = await query<{ id: number; email: string; username: string; display_name: string | null }>(
        `SELECT u.id, u.email, u.username, COALESCE(up.display_name, u.username) AS display_name
         FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id IN (${placeholders}) AND u.email IS NOT NULL AND u.email != ''`,
        activeUserIds
      );

      for (const u of usersRes.rows) {
        try {
          const tpl = strategyPicksEmail({
            subscriberName: u.display_name || u.username,
            day: row.day_number,
            date,
            stake: row.stake,
            targetWin: row.target_win,
            picks,
            combinedOdds: parseFloat(String(row.combined_odds)),
          });
          await sendMail({ to: u.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
        } catch { /* skip one failed recipient */ }
      }
    } catch (e) {
      console.error('[strategy/approve] email blast failed:', e);
    }
  });

  return NextResponse.json({ success: true, date });
}
