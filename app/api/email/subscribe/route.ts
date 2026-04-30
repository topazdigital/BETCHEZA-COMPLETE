import { NextRequest, NextResponse } from 'next/server';
import { subscribeEmail } from '@/lib/notification-store';
import { sendMail, renderTemplate } from '@/lib/mailer';
import { getTemplate } from '@/lib/email-templates-store';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TOPIC_LABELS: Record<string, string> = {
  daily_tips: 'Daily expert tips',
  match_alerts: 'Live match alerts',
  big_picks: 'High-confidence VIP picks',
  weekly_digest: 'Weekly performance digest',
  league_news: 'League & team news',
  promotions: 'Promotions & bonuses',
};

function buildWelcomeEmail(opts: { email: string; topics: string[]; unsubscribeUrl: string; appUrl: string }) {
  const { email, topics, unsubscribeUrl, appUrl } = opts;
  const friendlyTopics = topics
    .map((t) => TOPIC_LABELS[t] || t.replace(/_/g, ' '))
    .map((t) => `<li style="margin:4px 0;color:#334155;">${t}</li>`)
    .join('');

  const text = `Welcome to Betcheza!

You're now subscribed to: ${topics.map((t) => TOPIC_LABELS[t] || t).join(', ')}.

We'll send you the day's sharpest tips, value bets and live alerts — straight to ${email}.

Open the app: ${appUrl}
Unsubscribe anytime: ${appUrl}${unsubscribeUrl}

Bet smart, bet small. — Team Betcheza`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed 0%,#ec4899 100%);padding:28px 32px;color:#fff;">
          <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Welcome to Betcheza 🎯</h1>
          <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">Your sports betting copilot is ready.</p>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#0f172a;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hi there,</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
            Thanks for subscribing! You'll now receive the following from us at <strong>${email}</strong>:
          </p>
          <ul style="margin:0 0 18px;padding:0 0 0 20px;font-size:14px;line-height:1.6;">${friendlyTopics}</ul>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#475569;">
            Every email is curated by our team of tipsters and our in-house AI — no spam, no fluff, just sharp picks and real numbers.
          </p>
          <p style="margin:0 0 28px;text-align:center;">
            <a href="${appUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:9999px;font-size:14px;">Open Betcheza</a>
          </p>
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">
            Bet smart. Bet small. 1–3% of bankroll per pick.<br/>
            <a href="${appUrl}${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> any time.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { text, html };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email || '').toString().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }
  const topics = Array.isArray(body.topics) && body.topics.length > 0
    ? body.topics.map((t: unknown) => String(t)).slice(0, 12)
    : ['daily_tips'];
  const countryCode = body.countryCode ? String(body.countryCode).toUpperCase().slice(0, 8) : null;
  const row = await subscribeEmail({ email, topics, countryCode });
  const unsubscribeUrl = `/api/email/unsubscribe?token=${row.unsubscribeToken}`;

  // Fire the welcome email — don't fail the subscription if SMTP isn't
  // configured (the mailer logs and returns { skipped: true } in that case).
  // We use the admin-panel SMTP config (lib/email-config-store.ts) so admins
  // can swap providers any time without redeploying.
  const appUrl =
    req.nextUrl.origin ||
    (process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.com').replace(/\/$/, '');
  // Prefer the admin-editable welcome template; fall back to the legacy hand-coded one
  // if the template is missing or empty for any reason.
  let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
  let subject = 'Welcome to Betcheza — your tips inbox is live 🎯';
  let html: string;
  let text: string;
  try {
    const tpl = getTemplate('subscriber_welcome');
    const vars = { name: email.split('@')[0], email, siteUrl: appUrl };
    subject = renderTemplate(tpl.subject || subject, vars);
    html = renderTemplate(tpl.html, vars) || buildWelcomeEmail({ email, topics, unsubscribeUrl, appUrl }).html;
    text = renderTemplate(tpl.text, vars) || buildWelcomeEmail({ email, topics, unsubscribeUrl, appUrl }).text;
  } catch {
    const fallback = buildWelcomeEmail({ email, topics, unsubscribeUrl, appUrl });
    html = fallback.html;
    text = fallback.text;
  }
  try {
    const res = await sendMail({
      to: email,
      subject,
      text,
      html,
    });
    if (res.ok) emailStatus = 'sent';
    else if (res.skipped) emailStatus = 'skipped';
    else emailStatus = 'failed';
  } catch (e) {
    console.error('[email/subscribe] welcome email failed:', e);
    emailStatus = 'failed';
  }

  return NextResponse.json({
    success: true,
    id: row.id,
    unsubscribeUrl,
    emailStatus,
  });
}
