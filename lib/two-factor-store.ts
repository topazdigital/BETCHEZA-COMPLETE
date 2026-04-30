import { randomBytes } from 'crypto';
import { sendMail } from './mailer';
import { sendSms, type SmsCarrier } from './sms-gateway';
import { getSiteSettings } from './site-settings';

/**
 * Lightweight two-factor (one-time-code) store.
 *
 * Per-user opt-in lives in memory (and would be persisted to a `users.twofa_*`
 * column in production). When 2FA is required during login we generate a 6
 * digit code, hold it for 10 minutes, and ship it via either:
 *   - the existing email-to-SMS gateway (free — no SMS provider needed)
 *   - a transactional email (always works if the SMTP gateway is set up)
 *
 * The auth flow returns a short-lived `challengeId` instead of a session
 * cookie. The client then POSTs `{ challengeId, code }` to /verify-2fa to
 * exchange it for a real auth cookie.
 */

interface UserTwoFactorPrefs {
  enabled: boolean;
  method: 'email' | 'sms';
  /** Phone digits (no formatting) — required for SMS delivery. */
  phone?: string;
  /** Email-to-SMS carrier when method = sms. */
  carrier?: SmsCarrier;
}

interface TwoFactorChallenge {
  userId: number;
  email: string;
  code: string;
  expiresAt: number;
  /** Number of failed verify attempts; 5 strikes invalidates the challenge. */
  attempts: number;
}

const g = globalThis as {
  __userTwoFactor?: Map<number, UserTwoFactorPrefs>;
  __twoFactorChallenges?: Map<string, TwoFactorChallenge>;
};
const userPrefs: Map<number, UserTwoFactorPrefs> = g.__userTwoFactor ?? (g.__userTwoFactor = new Map());
const challenges: Map<string, TwoFactorChallenge> = g.__twoFactorChallenges ?? (g.__twoFactorChallenges = new Map());

export function getUserTwoFactor(userId: number): UserTwoFactorPrefs {
  return userPrefs.get(userId) ?? { enabled: false, method: 'email' };
}

export function setUserTwoFactor(userId: number, prefs: UserTwoFactorPrefs): void {
  if (!prefs.enabled) {
    userPrefs.delete(userId);
    return;
  }
  userPrefs.set(userId, prefs);
}

/** Whether 2FA must run for this user. Combines per-user opt-in with site-wide enforcement. */
export async function requiresTwoFactor(userId: number): Promise<boolean> {
  const settings = await getSiteSettings();
  const siteForced = settings.twofa_enabled === 'true';
  const userOptIn = getUserTwoFactor(userId).enabled;
  return siteForced || userOptIn;
}

function generateCode(): string {
  // 6 digits, leading zeros preserved.
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

function generateChallengeId(): string {
  return randomBytes(24).toString('base64url');
}

/** Build + send an OTP. Returns the challenge id the client must echo back. */
export async function issueTwoFactorChallenge(opts: {
  userId: number;
  email: string;
}): Promise<{ challengeId: string; channel: 'email' | 'sms' | 'sms-fallback'; deliveredTo: string; warning?: string }> {
  const prefs = getUserTwoFactor(opts.userId);
  const code = generateCode();
  const challengeId = generateChallengeId();
  challenges.set(challengeId, {
    userId: opts.userId,
    email: opts.email,
    code,
    expiresAt: Date.now() + 10 * 60_000,
    attempts: 0,
  });
  // Periodically prune old challenges so the map stays bounded.
  if (challenges.size > 1000) {
    const now = Date.now();
    for (const [id, ch] of challenges) if (ch.expiresAt < now) challenges.delete(id);
  }

  const message = `Your Betcheza verification code is ${code}. It expires in 10 minutes.`;

  // Try SMS first if the user opted in for it AND we have a carrier.
  if (prefs.method === 'sms' && prefs.phone && prefs.carrier) {
    const r = await sendSms({
      phone: prefs.phone,
      carrier: prefs.carrier,
      subject: 'Betcheza code',
      message,
    });
    if (r.ok) {
      return { challengeId, channel: 'sms', deliveredTo: maskPhone(prefs.phone) };
    }
    // Fall through to email if SMS gateway failed.
  }

  // Email fallback (and primary path when method = email).
  const sent = await sendMail({
    to: opts.email,
    subject: 'Your Betcheza verification code',
    text: message,
    html: `<div style="font-family:sans-serif;padding:16px"><h2 style="margin:0 0 12px">Verify it&#39;s you</h2><p>Enter this code to finish signing in:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold;background:#f3f4f6;padding:12px 16px;border-radius:8px;display:inline-block">${code}</p><p style="color:#666;font-size:13px">It expires in 10 minutes. If you didn&#39;t try to sign in, you can ignore this email.</p></div>`,
  });
  if (!sent.ok) {
    return {
      challengeId,
      channel: 'email',
      deliveredTo: maskEmail(opts.email),
      warning:
        'Email delivery failed. Configure SMTP under Admin → Email Setup, then try again. The code is logged on the server in development mode.',
    };
  }
  return { challengeId, channel: 'email', deliveredTo: maskEmail(opts.email) };
}

export interface VerifyResult {
  ok: boolean;
  userId?: number;
  email?: string;
  error?: string;
}

export function verifyTwoFactor(challengeId: string, code: string): VerifyResult {
  const challenge = challenges.get(challengeId);
  if (!challenge) return { ok: false, error: 'Code expired or invalid. Start over.' };
  if (challenge.expiresAt < Date.now()) {
    challenges.delete(challengeId);
    return { ok: false, error: 'Code expired. Request a new one.' };
  }
  if (challenge.attempts >= 5) {
    challenges.delete(challengeId);
    return { ok: false, error: 'Too many wrong attempts. Start over.' };
  }
  challenge.attempts += 1;
  if (challenge.code !== String(code).trim()) {
    return { ok: false, error: 'Wrong code. Try again.' };
  }
  challenges.delete(challengeId);
  return { ok: true, userId: challenge.userId, email: challenge.email };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `••• ••• ${digits.slice(-4)}`;
}
