import { NextResponse } from 'next/server';
import { getCaptchaProvider, recallMathAnswer, verifyCaptcha } from '@/lib/captcha';
import { ipKeyFromHeaders, rateLimit } from '@/lib/rate-limit';

const FORM_LIMIT = 6;
const FORM_WINDOW_MS = 15 * 60_000;

export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function cleanFormText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Require the app's configured captcha provider and apply a per-IP submission
 * limit before any public form can save data or send mail.
 */
export async function protectPublicForm(
  request: Request,
  scope: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; ip: string } | { ok: false; response: NextResponse }> {
  const ip = ipKeyFromHeaders(request.headers);
  const limit = rateLimit(`public-form:${scope}:${ip}`, FORM_LIMIT, FORM_WINDOW_MS);
  if (!limit.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Too many submissions. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } },
      ),
    };
  }

  const provider = await getCaptchaProvider();
  const captchaId = typeof body.captchaId === 'string' ? body.captchaId : '';
  const expected = (provider === 'math' || provider === 'none') && captchaId
    ? recallMathAnswer(captchaId) ?? undefined
    : undefined;
  if (provider === 'none' && expected === undefined) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Please complete the security check.' },
        { status: 400 },
      ),
    };
  }
  const result = await verifyCaptcha({
    token: typeof body.captchaToken === 'string' ? body.captchaToken : undefined,
    remoteIp: ip,
    expected,
  });

  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: result.error || 'Please complete the security check.' },
        { status: 400 },
      ),
    };
  }

  return { ok: true, ip };
}
