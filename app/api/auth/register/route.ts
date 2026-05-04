import { NextResponse } from 'next/server';
import { hashPassword, setAuthCookie } from '@/lib/auth';
import { mockUsers } from '@/lib/mock-data';
import { queryOne, execute, getPool } from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { ipKeyFromHeaders, rateLimit } from '@/lib/rate-limit';
import { getCaptchaProvider, recallMathAnswer, verifyCaptcha } from '@/lib/captcha';
import { issueVerification } from '@/lib/email-verification-store';
import { buildVerificationEmail } from '@/lib/email-templates/verification-email';
import { recordSignup } from '@/lib/affiliate-clicks-store';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function buildRegistrationEmail(opts: { displayName: string; username: string; email: string; appUrl: string }) {
  const { displayName, username, email, appUrl } = opts;
  const text = `Welcome to Betcheza, ${displayName}!

Your account is ready.

Username: ${username}
Email: ${email}

What you can do right now:
• Browse today's matches and live odds
• Follow your favourite teams and tipsters
• Open the AI Prediction widget on any match
• Save picks and track your ROI in your dashboard

Open the app: ${appUrl}

Bet smart. Bet small. — Team Betcheza`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#10b981 0%,#0ea5e9 100%);padding:28px 32px;color:#fff;">
          <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Welcome aboard, ${displayName} 👋</h1>
          <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">Your Betcheza account is live and ready to bet smart.</p>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#0f172a;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Thanks for joining Betcheza — we're glad to have you.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;margin:0 0 22px;">
            <tr><td style="padding:14px 18px;font-size:13px;color:#475569;">
              <div style="margin-bottom:6px;"><strong style="color:#0f172a;">Username:</strong> ${username}</div>
              <div><strong style="color:#0f172a;">Email:</strong> ${email}</div>
            </td></tr>
          </table>
          <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0f172a;">What you can do right now</p>
          <ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:14px;line-height:1.65;color:#334155;">
            <li>Browse today's matches with live odds across 200+ leagues</li>
            <li>Follow your favourite teams &amp; tipsters for instant alerts</li>
            <li>Open the AI Prediction widget on any match for a value read</li>
            <li>Save picks and track your ROI in your personal dashboard</li>
          </ul>
          <p style="margin:0 0 26px;text-align:center;">
            <a href="${appUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:9999px;font-size:14px;">Open Betcheza</a>
          </p>
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">
            Bet smart. Bet small. 1–3% of bankroll per pick.<br/>
            If you didn't create this account, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { text, html };
}

export async function POST(request: Request) {
  try {
    const ip = ipKeyFromHeaders(request.headers);
    // Tighter rate-limit on signup — 5 accounts per IP per hour stops spam
    // signup waves without affecting normal users.
    const ipLimit = rateLimit(`register:ip:${ip}`, 5, 60 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, error: `Too many signups from this network. Try again in ${ipLimit.retryAfter}s.` },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter ?? 60) } },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email, password, username, displayName, phone, countryCode, captchaToken, captchaId } = body;

    // Captcha is required for every signup to keep automated account creation
    // out. The provider (Turnstile / reCAPTCHA / math fallback) is decided
    // server-side in lib/captcha.ts.
    {
      const provider = await getCaptchaProvider();
      let expected: string | undefined;
      if (provider === 'math') {
        expected = (captchaId ? recallMathAnswer(captchaId) : null) ?? undefined;
      }
      const v = await verifyCaptcha({ token: captchaToken, remoteIp: ip, expected });
      if (!v.ok) {
        return NextResponse.json(
          { success: false, error: v.error || 'Captcha required', captchaRequired: true },
          { status: 400 },
        );
      }
    }

    // Validation
    if (!email || !password || !username || !displayName) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    let newUser: {
      id: number; email: string; phone: string | null; country_code: string | null;
      password_hash: string; google_id: null; username: string; display_name: string;
      avatar_url: null; bio: null; role: 'user'; balance: number; timezone: string;
      odds_format: 'decimal'; is_verified: boolean; created_at: Date;
    };

    if (getPool()) {
      // Check uniqueness in DB
      try {
        const existingEmail = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (existingEmail) {
          return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 400 });
        }
        const existingUsername = await queryOne<{ id: number }>('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
        if (existingUsername) {
          return NextResponse.json({ success: false, error: 'Username already taken' }, { status: 400 });
        }
        // Insert into DB
        const result = await execute(
          `INSERT INTO users (email, phone, country_code, password_hash, google_id, username, display_name, avatar_url, bio, role, balance, timezone, odds_format, is_verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL, 'user', 0, 'Africa/Nairobi', 'decimal', 0, NOW(), NOW())`,
          [email, phone || null, countryCode || null, passwordHash, username, displayName]
        );
        newUser = {
          id: result.insertId, email, phone: phone || null, country_code: countryCode || null,
          password_hash: passwordHash, google_id: null, username, display_name: displayName,
          avatar_url: null, bio: null, role: 'user', balance: 0, timezone: 'Africa/Nairobi',
          odds_format: 'decimal', is_verified: false, created_at: new Date(),
        };
      } catch (dbErr) {
        console.error('[auth/register] DB insert failed:', dbErr);
        return NextResponse.json({ success: false, error: 'Registration failed. Please try again.' }, { status: 500 });
      }
    } else {
      // Fallback: in-memory mock (no DB configured)
      const existingEmail = mockUsers.find((u) => u.email === email);
      if (existingEmail) {
        return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 400 });
      }
      const existingUsername = mockUsers.find((u) => u.username === username);
      if (existingUsername) {
        return NextResponse.json({ success: false, error: 'Username already taken' }, { status: 400 });
      }
      newUser = {
        id: mockUsers.length + 1, email, phone: phone || null, country_code: countryCode || null,
        password_hash: passwordHash, google_id: null, username, display_name: displayName,
        avatar_url: null, bio: null, role: 'user', balance: 0, timezone: 'Africa/Nairobi',
        odds_format: 'decimal', is_verified: false, created_at: new Date(),
      };
      mockUsers.push(newUser);
    }

    // ── Affiliate attribution: if this user clicked through a bookmaker
    // link in the last 30 days, the redirect handler dropped a `bz_aff`
    // cookie carrying {bid, slug, name, cid}. Roll the signup back into
    // that bookmaker's funnel so we can compute clicks → signups → CR.
    try {
      const cookieStore = await cookies();
      const aff = cookieStore.get('bz_aff')?.value;
      if (aff) {
        const parsed = JSON.parse(aff) as { bid?: number; slug?: string; name?: string; cid?: number };
        if (typeof parsed?.bid === 'number' && parsed.slug && parsed.name) {
          recordSignup({
            userId: newUser.id,
            bookmakerId: parsed.bid,
            bookmakerSlug: parsed.slug,
            bookmakerName: parsed.name,
            clickId: parsed.cid,
          });
        }
      }
    } catch (e) {
      console.warn('[auth/register] affiliate attribution failed:', e);
    }

    // Set auth cookie — user is logged in immediately, but flagged as
    // unverified until they confirm via the email code/link.
    await setAuthCookie({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    // Issue + send the verification email. Two ways to verify:
    //   1) 6-digit code typed in the modal/profile.
    //   2) Click the verify link (?token=...) in the email.
    // SMTP failures NEVER block registration — we still tell the client
    // "verifyRequired: true" so they can use the resend button.
    const verification = issueVerification(newUser.id, newUser.email);
    let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
    try {
      const origin =
        request.headers.get('origin') ||
        request.headers.get('referer')?.replace(/^(https?:\/\/[^/]+).*/, '$1') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://betcheza.com';
      const appUrl = origin.replace(/\/$/, '');
      const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verification.token)}`;
      // We also keep the original welcome content available in case admins
      // ever want a separate welcome flow — silence "unused" lint by binding it.
      void buildRegistrationEmail({
        displayName: newUser.display_name,
        username: newUser.username,
        email: newUser.email,
        appUrl,
      });
      const { text, html } = buildVerificationEmail({
        displayName: newUser.display_name,
        code: verification.code,
        verifyUrl,
      });
      const res = await sendMail({
        to: newUser.email,
        subject: 'Confirm your Betcheza email',
        text,
        html,
      });
      if (res.ok) emailStatus = 'sent';
      else if (res.skipped) emailStatus = 'skipped';
      else emailStatus = 'failed';
    } catch (e) {
      console.error('[auth/register] verification email failed:', e);
      emailStatus = 'failed';
    }

    return NextResponse.json({
      success: true,
      verifyRequired: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.display_name,
        avatarUrl: newUser.avatar_url,
        role: newUser.role,
        balance: newUser.balance,
        isEmailVerified: false,
      },
      emailStatus,
    });
  } catch (error) {
    console.error('[v0] Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
