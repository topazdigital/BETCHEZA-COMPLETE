import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { query } from '@/lib/db';
import { sendMail, renderTemplate } from '@/lib/mailer';
import { buildBroadcastEmail } from '@/lib/email-templates';

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
  const batchIndex = typeof body.batchIndex === 'number' ? body.batchIndex : 0;
  const batchSize = typeof body.batchSize === 'number' ? Math.max(1, body.batchSize) : 50;

  if (!subject) return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 });
  if (!text) return NextResponse.json({ success: false, error: 'Body is required' }, { status: 400 });
  if (userIds.length === 0) return NextResponse.json({ success: false, error: 'No users selected' }, { status: 400 });

  // Slice just the batch we need
  const batchIds = userIds.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
  if (batchIds.length === 0) {
    return NextResponse.json({ success: true, sent: 0, failed: 0, done: true, total: userIds.length });
  }

  // Fetch emails + usernames from DB for this batch of IDs
  const placeholders = batchIds.map(() => '?').join(',');
  let users: { email: string; username: string }[] = [];
  try {
    const r = await query<{ email: string; username: string }>(
      `SELECT email, username FROM users WHERE id IN (${placeholders}) AND email IS NOT NULL AND email != ''`,
      batchIds
    );
    users = r.rows.filter(u => u.email);
  } catch (e) {
    console.error('[admin/users/email] DB lookup failed:', e);
    return NextResponse.json({ success: false, error: 'Failed to fetch user emails' }, { status: 500 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

  let sent = 0;
  let failed = 0;
  for (const u of users) {
    try {
      const vars: Record<string, string> = { name: u.username || 'there', email: u.email, siteUrl };
      const renderedSubject = renderTemplate(subject, vars);
      const renderedBody = renderTemplate(text, vars);
      const { html: renderedHtml, text: renderedText } = buildBroadcastEmail({
        subject: renderedSubject,
        body: renderedBody,
        recipientName: u.username || undefined,
      });
      const res = await sendMail({ to: u.email, subject: renderedSubject, html: renderedHtml, text: renderedText });
      if (res.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  const totalBatches = Math.ceil(userIds.length / batchSize);
  const done = batchIndex + 1 >= totalBatches;

  return NextResponse.json({
    success: true,
    sent,
    failed,
    batchIndex,
    totalBatches,
    done,
    total: userIds.length,
  });
}
