import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listEmailSubscribers } from '@/lib/notification-store';
import { renderTemplate, sendMail } from '@/lib/mailer';
import { query } from '@/lib/db';
import { getEmailConfig } from '@/lib/email-config-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { subject, html, batchIndex = 0, batchSize = 50, emails: emailOverride } = body as {
    subject: string;
    html: string;
    batchIndex?: number;
    batchSize?: number;
    emails?: string[];
  };

  if (!subject?.trim() || !html?.trim()) {
    return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
  }

  const hasEmailOverride = Array.isArray(emailOverride);
  // Get recipient list — either supplied (e.g. selected subset) or all active subscribers
  let allEmails: string[];
  if (hasEmailOverride) {
    allEmails = emailOverride;
  } else {
    const subs = await listEmailSubscribers();
    allEmails = subs.filter(s => s.active).map(s => s.email);
  }

  const totalCount = allEmails.length;
  const safeBatchSize = Math.min(100, Math.max(1, Math.trunc(Number(batchSize) || 50)));
  const safeBatchIndex = Math.max(0, Math.trunc(Number(batchIndex) || 0));
  const batchStart = safeBatchIndex * safeBatchSize;
  const batch = hasEmailOverride
    ? allEmails
    : allEmails.slice(batchStart, batchStart + safeBatchSize);

  if (batch.length === 0) {
    return NextResponse.json({ sent: 0, totalCount, done: true });
  }

  const emailCfg = await getEmailConfig();
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

  if (!emailCfg.enabled || !emailCfg.host || !emailCfg.username || !emailCfg.password) {
    return NextResponse.json({ error: 'Outgoing email is not configured. Check Admin → Email Configuration.' }, { status: 503 });
  }

  // Build a name lookup map (email → username) for personalisation.
  // Falls back gracefully if DB is unavailable.
  const nameMap = new Map<string, string>();
  try {
    const placeholders = batch.map(() => '?').join(',');
    const r = await query<{ email: string; username: string }>(
      `SELECT email, username FROM users WHERE email IN (${placeholders})`,
      batch,
    );
    for (const row of r.rows) {
      if (row.email && row.username) nameMap.set(row.email.toLowerCase(), row.username);
    }
  } catch {
    // non-fatal — personalisation falls back to 'there'
  }

  let sent = 0;
  let failed = 0;
  const failures: { email: string; error: string }[] = [];
  for (const [index, email] of batch.entries()) {
    try {
      const name = nameMap.get(email.toLowerCase()) || 'there';
      const vars: Record<string, string> = { name, email, siteUrl };
      const renderedSubject = renderTemplate(subject, vars);
      const renderedHtml = renderTemplate(html, vars);

      const result = await sendMail({
        to: email,
        subject: renderedSubject,
        html: renderedHtml,
      });
      if (result.ok) sent++;
      else {
        failed++;
        if (failures.length < 10) failures.push({ email, error: result.error || 'SMTP did not accept the recipient' });
      }
    } catch (error) {
      failed++;
      if (failures.length < 10) {
        failures.push({ email, error: error instanceof Error ? error.message : 'Unexpected send error' });
      }
    }
    if (index < batch.length - 1) await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const done = hasEmailOverride || batchStart + safeBatchSize >= totalCount;
  return NextResponse.json({ sent, failed, failures, totalCount, batchIndex: safeBatchIndex, done });
}
