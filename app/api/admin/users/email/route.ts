import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { query } from '@/lib/db';
import { sendMail, renderTemplate } from '@/lib/mailer';
import { buildBroadcastEmail } from '@/lib/email-templates';
import { getEmailConfig } from '@/lib/email-config-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.read')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const userIds: number[] = Array.isArray(body.userIds) ? (body.userIds as number[]) : [];
  const subject = String(body.subject || '').trim();
  const rawBody = String(body.rawBody || body.text || body.body || '').trim();
  const text = rawBody;
  const batchIndex = typeof body.batchIndex === 'number' ? Math.max(0, Math.trunc(body.batchIndex)) : 0;
  const batchSize = typeof body.batchSize === 'number'
    ? Math.min(100, Math.max(1, Math.trunc(body.batchSize)))
    : 50;

  if (!subject) return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 });
  if (!text) return NextResponse.json({ success: false, error: 'Body is required' }, { status: 400 });
  if (userIds.length === 0) return NextResponse.json({ success: false, error: 'No users selected' }, { status: 400 });

  const emailConfig = await getEmailConfig();
  if (!emailConfig.enabled || !emailConfig.host || !emailConfig.username || !emailConfig.password) {
    return NextResponse.json({
      success: false,
      error: 'Outgoing email is not configured. Check Admin → Email Configuration.',
    }, { status: 503 });
  }

  // Slice just the batch we need
  const batchIds = userIds.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
  if (batchIds.length === 0) {
    return NextResponse.json({ success: true, accepted: 0, failed: 0, done: true, total: userIds.length });
  }

  // Fetch emails + usernames from DB for this batch of IDs
  const placeholders = batchIds.map(() => '?').join(',');
  let users: { email: string; username: string; display_name: string | null }[] = [];
  try {
    const r = await query<{ email: string; username: string; display_name: string | null }>(
      `SELECT u.email, u.username,
              COALESCE(up.display_name, u.display_name, u.username) AS display_name
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id IN (${placeholders}) AND u.email IS NOT NULL AND u.email != ''`,
      batchIds
    );
    users = r.rows.filter(u => u.email);
  } catch (e) {
    console.error('[admin/users/email] DB lookup failed:', e);
    return NextResponse.json({ success: false, error: 'Failed to fetch user emails' }, { status: 500 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

  let accepted = 0;
  let failed = 0;
  const failures: { email: string; error: string }[] = [];
  for (const [index, u] of users.entries()) {
    try {
      const displayName = u.display_name || u.username || 'there';
      const vars: Record<string, string> = { name: displayName, email: u.email, siteUrl };
      const renderedSubject = renderTemplate(subject, vars);
      const renderedBody = renderTemplate(text, vars);
      const { html: renderedHtml, text: renderedText } = buildBroadcastEmail({
        subject: renderedSubject,
        body: renderedBody,
        recipientName: displayName,
      });
      const res = await sendMail({ to: u.email, subject: renderedSubject, html: renderedHtml, text: renderedText });
      if (res.ok) accepted++;
      else {
        failed++;
        if (failures.length < 10) failures.push({ email: u.email, error: res.error || 'SMTP did not accept the recipient' });
      }
    } catch (error) {
      failed++;
      if (failures.length < 10) {
        failures.push({
          email: u.email,
          error: error instanceof Error ? error.message : 'Unexpected send error',
        });
      }
    }
    if (index < users.length - 1) await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const totalBatches = Math.ceil(userIds.length / batchSize);
  const done = batchIndex + 1 >= totalBatches;

  return NextResponse.json({
    success: true,
    accepted,
    failed,
    failures,
    batchIndex,
    totalBatches,
    done,
    total: userIds.length,
  });
}
