import { NextRequest, NextResponse } from 'next/server';
import { mockUsers } from '@/lib/mock-data';
import { queryOne, getPool } from '@/lib/db';
import { createPasswordResetToken } from '@/lib/password-reset-store';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:5000';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  // DB-first lookup, fall back to in-memory mock when no DB is configured
  let user: { id: number; email: string; display_name: string } | undefined;
  if (getPool()) {
    try {
      const row = await queryOne<{ id: number; email: string; display_name: string }>(
        'SELECT id, email, display_name FROM users WHERE LOWER(email) = ? LIMIT 1',
        [email],
      );
      if (row) user = row;
    } catch { /* fall through to mock */ }
  }
  if (!user) {
    const m = mockUsers.find((u) => u.email.toLowerCase() === email);
    if (m) user = { id: m.id, email: m.email, display_name: m.display_name };
  }

  // Always pretend success so the endpoint can't be used to enumerate accounts.
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const { token, expiresAt } = createPasswordResetToken(user.id, user.email);
  const origin = getOrigin(req);
  const link = `${origin}/?reset_token=${encodeURIComponent(token)}#reset`;

  const html = `
    <div style="font-family:Inter,system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f7fafc;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <div style="width:32px;height:32px;border-radius:8px;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;">B</div>
          <strong style="font-size:18px;color:#0f172a;">Betcheza</strong>
        </div>
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Reset your password</h1>
        <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
          We received a request to reset the password for <strong>${user.email}</strong>.
          Click the button below to choose a new password. This link expires in 60 minutes.
        </p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#10b981;color:white;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">Reset password</a>
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
          If the button doesn't work, paste this link into your browser:<br/>
          <span style="word-break:break-all;color:#0f172a;">${link}</span>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
        <p style="color:#94a3b8;font-size:12px;margin:0;">
          Didn't request this? You can safely ignore this email — your password won't change.
        </p>
      </div>
    </div>
  `;
  const text = `Reset your Betcheza password\n\nWe received a request to reset the password for ${user.email}.\n\nUse this link (expires in 60 min):\n${link}\n\nIf you didn't request it, ignore this email.`;

  const mail = await sendMail({
    to: user.email,
    subject: 'Reset your Betcheza password',
    html,
    text,
  });

  // When SMTP isn't configured we still return ok=true so the UX doesn't leak;
  // expose the link in dev so admins can test the flow.
  const devHint = process.env.NODE_ENV !== 'production' && (mail.skipped || !mail.ok)
    ? { devResetLink: link, mailSkipped: !!mail.skipped, mailError: mail.error }
    : {};

  return NextResponse.json({ ok: true, expiresAt, ...devHint });
}
