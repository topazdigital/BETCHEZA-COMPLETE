import { NextResponse } from 'next/server';
import { setAuthCookie, verifyPassword } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { issueTwoFactorChallenge, requiresTwoFactor } from '@/lib/two-factor-store';
import {
  CAPTCHA_THRESHOLD,
  HARD_LOCK_THRESHOLD,
  clearFailures,
  getFailures,
  ipKeyFromHeaders,
  rateLimit,
  recordFailure,
} from '@/lib/rate-limit';
import { getCaptchaProvider, recallMathAnswer, verifyCaptcha } from '@/lib/captcha';

export const dynamic = 'force-dynamic';

interface DbUser {
  id: number;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'tipster' | 'admin';
  balance: number;
  is_verified: boolean;
  password_hash: string;
}

const COLS = 'id, email, username, display_name, avatar_url, role, balance, is_verified, password_hash';

async function findUserByEmail(email: string): Promise<DbUser | null> {
  return queryOne<DbUser>(`SELECT ${COLS} FROM users WHERE LOWER(email) = ? LIMIT 1`, [email.toLowerCase()]);
}

async function findUserByUsername(username: string): Promise<DbUser | null> {
  return queryOne<DbUser>(`SELECT ${COLS} FROM users WHERE LOWER(username) = ? LIMIT 1`, [username.toLowerCase()]);
}

async function findUserByPhone(phone: string): Promise<DbUser | null> {
  const normalised = phone.replace(/\s+/g, '');
  return queryOne<DbUser>(`SELECT ${COLS} FROM users WHERE phone = ? LIMIT 1`, [normalised]);
}

function detectIdentifierType(id: string): 'email' | 'phone' | 'username' {
  if (id.includes('@')) return 'email';
  if (/^\+?[\d\s\-()]{7,}$/.test(id)) return 'phone';
  return 'username';
}

export async function POST(request: Request) {
  try {
    const ip = ipKeyFromHeaders(request.headers);

    const ipLimit = rateLimit(`login:ip:${ip}`, 20, 5 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many attempts. Try again in ${ipLimit.retryAfter}s.`,
        },
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

    // Support both legacy `email` field and new `identifier` field
    const { email: emailField, identifier: identifierField, password, captchaToken, captchaId, rememberMe } = body as {
      email?: string;
      identifier?: string;
      password?: string;
      captchaToken?: string;
      captchaId?: string;
      rememberMe?: boolean;
    };

    const rawIdentifier = (identifierField || emailField || '').trim();

    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Please enter your login details and password' },
        { status: 400 }
      );
    }

    const normalizedEmail = rawIdentifier.toLowerCase();
    const failureKey = `login:fail:${normalizedEmail}:${ip}`;
    const failureCount = getFailures(failureKey);

    if (failureCount >= HARD_LOCK_THRESHOLD) {
      return NextResponse.json(
        {
          success: false,
          error: 'This account is temporarily locked. Reset your password to continue.',
        },
        { status: 423 },
      );
    }

    if (failureCount >= CAPTCHA_THRESHOLD) {
      const provider = await getCaptchaProvider();
      let expected: string | undefined;
      if (provider === 'math') {
        expected = (captchaId ? recallMathAnswer(captchaId) : null) ?? undefined;
      }
      const v = await verifyCaptcha({ token: captchaToken, remoteIp: ip, expected });
      if (!v.ok) {
        return NextResponse.json(
          {
            success: false,
            error: v.error || 'Captcha required',
            captchaRequired: true,
          },
          { status: 401 },
        );
      }
    }

    const identifierType = detectIdentifierType(rawIdentifier);
    let user: DbUser | null = null;
    if (identifierType === 'email') {
      user = await findUserByEmail(rawIdentifier);
    } else if (identifierType === 'phone') {
      user = await findUserByPhone(rawIdentifier);
    } else {
      user = await findUserByUsername(rawIdentifier);
    }

    if (!user) {
      recordFailure(failureKey);
      return NextResponse.json(
        {
          success: false,
          error: 'No account found with those details',
          captchaRequired: getFailures(failureKey) >= CAPTCHA_THRESHOLD,
        },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      recordFailure(failureKey);
      return NextResponse.json(
        {
          success: false,
          error: 'Incorrect password',
          captchaRequired: getFailures(failureKey) >= CAPTCHA_THRESHOLD,
        },
        { status: 401 }
      );
    }

    clearFailures(failureKey);

    if (await requiresTwoFactor(user.id)) {
      const challenge = await issueTwoFactorChallenge({
        userId: user.id,
        email: user.email,
      });
      return NextResponse.json({
        success: true,
        requiresTwoFactor: true,
        challengeId: challenge.challengeId,
        channel: challenge.channel,
        deliveredTo: challenge.deliveredTo,
        warning: challenge.warning,
      });
    }

    await setAuthCookie(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      { rememberMe: !!rememberMe },
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        balance: user.balance,
        isEmailVerified: !!user.is_verified,
      },
    });
  } catch (error) {
    console.error('[login] Login error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
