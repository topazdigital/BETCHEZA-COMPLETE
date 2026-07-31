// Captcha verification helper.
//
// We support two captcha providers, both optional:
//   1. Cloudflare Turnstile (preferred — privacy-friendly, free, no PII).
//   2. Google reCAPTCHA v2 / v3.
//
// Provider selection (first match wins):
//   1. Admin panel (Settings → Security → Captcha) writes its values to the
//      `site_settings` table — these take precedence so a deploy never has
//      to redeploy to swap providers.
//   2. Environment variables (TURNSTILE_SECRET_KEY / RECAPTCHA_SECRET_KEY +
//      the matching NEXT_PUBLIC_*_SITE_KEY) — used when the admin hasn't
//      configured anything.
//   3. Math fallback — server-issued question via /api/captcha/challenge.

import { getSiteSettings } from './site-settings'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

export type CaptchaProvider = 'turnstile' | 'recaptcha' | 'math' | 'none'

export interface CaptchaConfig {
  provider: CaptchaProvider
  /** Public site key (safe to expose). */
  siteKey: string | null
  /** Secret used server-side. Never exposed to the browser. */
  secretKey: string | null
}

/**
 * Resolve the configured captcha provider — admin panel first, then env.
 * The admin can also explicitly disable captcha by setting provider to "none".
 */
export async function getCaptchaConfig(): Promise<CaptchaConfig> {
  let settings: Record<string, string> = {}
  try {
    settings = await getSiteSettings() as Record<string, string>
  } catch {
    // DB unreachable — fall through to env-only.
  }

  const adminProvider = (settings.captcha_provider || '').trim()

  // 1. Admin chose Turnstile and supplied keys → use them.
  if (adminProvider === 'turnstile') {
    const secret = settings.turnstile_secret_key || process.env.TURNSTILE_SECRET_KEY || ''
    const site = settings.turnstile_site_key || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
    if (secret) return { provider: 'turnstile', siteKey: site || null, secretKey: secret }
  }
  // 2. Admin chose reCAPTCHA and supplied keys.
  if (adminProvider === 'recaptcha') {
    const secret = settings.recaptcha_secret_key || process.env.RECAPTCHA_SECRET_KEY || ''
    const site = settings.recaptcha_site_key || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''
    if (secret) return { provider: 'recaptcha', siteKey: site || null, secretKey: secret }
  }
  // 3. Admin chose math — always works.
  if (adminProvider === 'math') {
    return { provider: 'math', siteKey: null, secretKey: null }
  }
  // 4. Admin disabled captcha entirely.
  if (adminProvider === 'none') {
    return { provider: 'none', siteKey: null, secretKey: null }
  }

  // No admin choice — fall back to whichever env var is set.
  const envTurnstile = (settings.turnstile_secret_key || process.env.TURNSTILE_SECRET_KEY || '').trim()
  if (envTurnstile) {
    return {
      provider: 'turnstile',
      siteKey: settings.turnstile_site_key || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null,
      secretKey: envTurnstile,
    }
  }
  const envRecaptcha = (settings.recaptcha_secret_key || process.env.RECAPTCHA_SECRET_KEY || '').trim()
  if (envRecaptcha) {
    return {
      provider: 'recaptcha',
      siteKey: settings.recaptcha_site_key || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null,
      secretKey: envRecaptcha,
    }
  }

  // 5. Default: built-in math captcha — always available.
  return { provider: 'math', siteKey: null, secretKey: null }
}

export async function getCaptchaProvider(): Promise<CaptchaProvider> {
  return (await getCaptchaConfig()).provider
}

/**
 * Public-facing captcha config — safe to expose to the browser.
 */
export async function getPublicCaptchaConfig(): Promise<{ provider: CaptchaProvider; siteKey: string | null }> {
  const cfg = await getCaptchaConfig()
  return { provider: cfg.provider, siteKey: cfg.siteKey }
}

/**
 * Verify a captcha token against the configured provider. Returns true when
 * the token is genuine and recent.
 *
 * For the 'math' provider, the `token` is the user's typed answer and
 * `expected` is the answer we issued and stored in the challenge cookie / store.
 */
export async function verifyCaptcha(opts: {
  token: string | null | undefined
  remoteIp?: string
  /** Only used for the 'math' provider. */
  expected?: string
}): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getCaptchaConfig()
  const token = (opts.token || '').trim()
  if (cfg.provider === 'none') return { ok: true }
  if (!token) return { ok: false, error: 'Captcha required' }

  if (cfg.provider === 'turnstile') {
    try {
      const body = new URLSearchParams({
        secret: cfg.secretKey || '',
        response: token,
      })
      if (opts.remoteIp) body.set('remoteip', opts.remoteIp)
      const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body })
      const data = await res.json().catch(() => ({})) as { success?: boolean; 'error-codes'?: string[] }
      if (data.success) return { ok: true }
      return { ok: false, error: 'Captcha verification failed' }
    } catch {
      return { ok: false, error: 'Captcha provider unreachable' }
    }
  }

  if (cfg.provider === 'recaptcha') {
    try {
      const body = new URLSearchParams({
        secret: cfg.secretKey || '',
        response: token,
      })
      if (opts.remoteIp) body.set('remoteip', opts.remoteIp)
      const res = await fetch(RECAPTCHA_VERIFY_URL, { method: 'POST', body })
      const data = await res.json().catch(() => ({})) as { success?: boolean; score?: number }
      if (data.success && (data.score === undefined || data.score >= 0.4)) return { ok: true }
      return { ok: false, error: 'Captcha verification failed' }
    } catch {
      return { ok: false, error: 'Captcha provider unreachable' }
    }
  }

  // Math captcha — token is the user-typed answer, expected is the answer we
  // signed and gave them. Compare in constant time.
  if (cfg.provider === 'math') {
    const exp = (opts.expected || '').trim()
    if (!exp) return { ok: false, error: 'Captcha expired' }
    if (token.length === exp.length && safeEqual(token, exp)) return { ok: true }
    return { ok: false, error: 'Wrong captcha answer' }
  }

  return { ok: true }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Generate a fresh math challenge — server-issued, non-guessable. */
export function generateMathChallenge(): { id: string; question: string; answer: string } {
  const a = 2 + Math.floor(Math.random() * 8)
  const b = 2 + Math.floor(Math.random() * 8)
  const op = Math.random() < 0.5 ? '+' : '-'
  const answer = String(op === '+' ? a + b : Math.abs(a - b))
  const question = `${Math.max(a, b)} ${op === '+' ? '+' : '-'} ${Math.min(a, b)}`
  // Random id so the answer can't be guessed without storing it server-side.
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  return { id, question, answer }
}

// In-memory store for math challenges (TTL 10 min). For multi-process
// deployments swap for Redis / DB — but for a single Next.js node this is
// perfectly adequate and avoids extra infra.
const MATH_STORE = new Map<string, { answer: string; expires: number }>()

export function rememberMathAnswer(id: string, answer: string) {
  MATH_STORE.set(id, { answer, expires: Date.now() + 10 * 60_000 })
  // Best-effort GC: keep the map small.
  if (MATH_STORE.size > 5000) {
    const now = Date.now()
    for (const [k, v] of MATH_STORE) {
      if (v.expires < now) MATH_STORE.delete(k)
    }
  }
}

export function recallMathAnswer(id: string): string | null {
  const v = MATH_STORE.get(id)
  if (!v) return null
  if (v.expires < Date.now()) {
    MATH_STORE.delete(id)
    return null
  }
  // Single-use — burn after recall.
  MATH_STORE.delete(id)
  return v.answer
}
