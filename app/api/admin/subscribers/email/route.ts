import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listEmailSubscribers } from '@/lib/notification-store';
import { getSiteSettings } from '@/lib/site-settings';
import { renderTemplate } from '@/lib/mailer';
import { query } from '@/lib/db';
import nodemailer from 'nodemailer';

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

  // Get recipient list — either supplied (e.g. selected subset) or all active subscribers
  let allEmails: string[];
  if (Array.isArray(emailOverride) && emailOverride.length > 0) {
    allEmails = emailOverride;
  } else {
    const subs = await listEmailSubscribers();
    allEmails = subs.filter(s => s.active).map(s => s.email);
  }

  const totalCount = allEmails.length;
  const batchStart = batchIndex * batchSize;
  const batch = allEmails.slice(batchStart, batchStart + batchSize);

  if (batch.length === 0) {
    return NextResponse.json({ sent: 0, totalCount, done: true });
  }

  const settings = await getSiteSettings();
  const emailCfg = (settings as Record<string, string | undefined>);
  const smtpHost = emailCfg.smtpHost || process.env.SMTP_HOST;
  const smtpPort = parseInt(emailCfg.smtpPort || process.env.SMTP_PORT || '587', 10);
  const smtpUser = emailCfg.smtpUser || process.env.SMTP_USER;
  const smtpPass = emailCfg.smtpPass || process.env.SMTP_PASS;
  const fromEmail = emailCfg.fromEmail || process.env.FROM_EMAIL || smtpUser || 'noreply@betcheza.co.ke';
  const fromName = emailCfg.siteName || 'Betcheza';
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

  if (!smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json({ error: 'SMTP not configured. Set SMTP settings in Admin → Settings.' }, { status: 503 });
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

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort !== 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  let sent = 0;
  let failed = 0;
  for (const email of batch) {
    try {
      const name = nameMap.get(email.toLowerCase()) || 'there';
      const vars: Record<string, string> = { name, email, siteUrl };
      const renderedSubject = renderTemplate(subject, vars);
      const renderedHtml = renderTemplate(html, vars);

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: renderedSubject,
        html: renderedHtml,
      });
      sent++;
    } catch {
      failed++;
    }
  }

  const done = batchStart + batchSize >= totalCount;
  return NextResponse.json({ sent, failed, totalCount, batchIndex, done });
}
