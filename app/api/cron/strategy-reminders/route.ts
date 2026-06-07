import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { query } from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { strategyExpiryReminderEmail } from '@/lib/email-templates';
import type { AccessRecord } from '@/app/api/strategy/access/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SENT_LOG_KEY = 'strategy-reminder-sent';

interface SentLog {
  [userId: number]: string; // userId → ISO date the reminder was last sent
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'betcheza-cron-2024';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  const oneDayMs = 24 * 60 * 60 * 1000;

  const accessRecords = fileStoreGet<AccessRecord[]>('strategy-access', []);
  const sentLog = fileStoreGet<SentLog>(SENT_LOG_KEY, {});

  // Find subscribers expiring within 24–48 hours who haven't had a reminder today
  const expiringRecords = accessRecords.filter(r => {
    const expiresAt = new Date(r.expiresAt).getTime();
    const msUntilExpiry = expiresAt - now;
    const alreadySentToday = sentLog[r.userId] === todayStr;
    return msUntilExpiry > 0 && msUntilExpiry <= 2 * oneDayMs && !alreadySentToday;
  });

  if (expiringRecords.length === 0) {
    return NextResponse.json({ sent: 0, skipped: true, reason: 'No subscribers expiring within 48h' });
  }

  let sent = 0;
  let failed = 0;

  try {
    const ids = expiringRecords.map(r => r.userId);
    const placeholders = ids.map(() => '?').join(',');
    const usersRes = await query<{ id: number; email: string; username: string; display_name: string | null }>(
      `SELECT u.id, u.email, u.username, COALESCE(up.display_name, u.username) AS display_name
       FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id IN (${placeholders}) AND u.email IS NOT NULL AND u.email != ''`,
      ids
    );

    const userMap = new Map(usersRes.rows.map(u => [u.id, u]));

    for (const record of expiringRecords) {
      const u = userMap.get(record.userId);
      if (!u) continue;

      const expiresAt = new Date(record.expiresAt).getTime();
      const daysRemaining = Math.max(1, Math.ceil((expiresAt - now) / oneDayMs));

      try {
        const tpl = strategyExpiryReminderEmail({
          subscriberName: u.display_name || u.username,
          expiresAt: record.expiresAt,
          daysRemaining,
        });
        const result = await sendMail({ to: u.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
        if (result.ok) {
          sent++;
          sentLog[record.userId] = todayStr;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // Persist updated sent log
    fileStoreSet(SENT_LOG_KEY, sentLog);
  } catch (e) {
    console.error('[strategy-reminders] DB error, skipping:', e instanceof Error ? e.message : e);
    return NextResponse.json({ sent: 0, failed: 0, error: 'DB unavailable' });
  }

  console.log(`[strategy-reminders] sent=${sent} failed=${failed} total=${expiringRecords.length}`);
  return NextResponse.json({ sent, failed, total: expiringRecords.length });
}
