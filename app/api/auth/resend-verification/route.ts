import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { issueVerification, isVerified } from '@/lib/email-verification-store';
import { mockUsers } from '@/lib/mock-data';
import { queryOne, getPool } from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { buildVerificationEmail } from '@/lib/email-templates/verification-email';
import { ipKeyFromHeaders, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Sign in first.' }, { status: 401 });
  }

  // Limit: 5 resends per IP per 10 minutes — covers user error retries while
  // blocking spam loops.
  const ip = ipKeyFromHeaders(request.headers);
  const limit = rateLimit(`verify:resend:${auth.userId}:${ip}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: `Please wait ${limit.retryAfter}s before requesting another code.` },
      { status: 429 },
    );
  }

  if (isVerified(auth.userId)) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  // DB-first lookup, fall back to in-memory mock
  let user: { id: number; email: string; display_name: string } | null = null;
  if (getPool()) {
    try {
      const row = await queryOne<{ id: number; email: string; display_name: string }>(
        'SELECT id, email, display_name FROM users WHERE id = ? LIMIT 1',
        [auth.userId],
      );
      if (row) user = row;
    } catch { /* fall through */ }
  }
  if (!user) {
    const m = mockUsers.find(u => u.id === auth.userId);
    if (m) user = { id: m.id, email: m.email, display_name: m.display_name };
  }
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
  }

  const v = issueVerification(user.id, user.email);
  const origin =
    request.headers.get('origin') ||
    request.headers.get('referer')?.replace(/^(https?:\/\/[^/]+).*/, '$1') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://betcheza.com';
  const verifyUrl = `${origin.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(v.token)}`;
  const { text, html } = buildVerificationEmail({
    displayName: user.display_name,
    code: v.code,
    verifyUrl,
  });

  let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
  try {
    const res = await sendMail({
      to: user.email,
      subject: 'Your Betcheza verification code',
      text,
      html,
    });
    if (res.ok) emailStatus = 'sent';
    else if (res.skipped) emailStatus = 'skipped';
    else emailStatus = 'failed';
  } catch (e) {
    console.error('[auth/resend-verification] email failed:', e);
    emailStatus = 'failed';
  }

  return NextResponse.json({ success: true, emailStatus });
}
