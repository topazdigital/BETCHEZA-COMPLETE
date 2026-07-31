// Lightweight in-process rate limiter — sliding-window per (key, scope).
//
// Used to throttle abusive endpoints (login attempts, password reset, signup)
// without needing Redis. Survives only as long as the Node.js process; that is
// fine for our needs because we also rely on Cloudflare/Turnstile in front of
// authentication so this is a defense-in-depth layer rather than the only one.
//
// The `recordFailure` / `clearFailures` API is used by /api/auth/login to track
// successive bad-password attempts per email+IP and trigger the captcha
// requirement once a small threshold is crossed.

type Bucket = {
  hits: number[]
  failures: number
  lockedUntil?: number
}

const BUCKETS = new Map<string, Bucket>()

function getBucket(key: string): Bucket {
  let b = BUCKETS.get(key)
  if (!b) {
    b = { hits: [], failures: 0 }
    BUCKETS.set(key, b)
  }
  return b
}

function pruneOld(b: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs
  // Remove timestamps older than the rolling window.
  let i = 0
  while (i < b.hits.length && b.hits[i] < cutoff) i++
  if (i > 0) b.hits.splice(0, i)
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfter?: number  // seconds until next allowed call
}

/**
 * Allow up to `limit` calls per `windowMs` for the given key.
 * Returns `{ ok: true, remaining }` when allowed, `{ ok: false, retryAfter }`
 * when blocked.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const b = getBucket(key)
  pruneOld(b, windowMs, now)
  if (b.hits.length >= limit) {
    const retryAfter = Math.ceil((b.hits[0] + windowMs - now) / 1000)
    return { ok: false, remaining: 0, retryAfter: Math.max(1, retryAfter) }
  }
  b.hits.push(now)
  return { ok: true, remaining: limit - b.hits.length }
}

/**
 * Track a "failed login" for the given key (email+ip). Returns the running
 * failure count for the key. After CAPTCHA_THRESHOLD failures the caller
 * should require a captcha solution before allowing another attempt.
 */
export function recordFailure(key: string): number {
  const b = getBucket(key)
  b.failures = (b.failures || 0) + 1
  // Auto-decay failures after 30 minutes so legitimate users aren't punished
  // forever for typos.
  setTimeout(() => {
    const cur = BUCKETS.get(key)
    if (cur) cur.failures = Math.max(0, (cur.failures || 0) - 1)
  }, 30 * 60_000).unref?.()
  return b.failures
}

export function getFailures(key: string): number {
  return BUCKETS.get(key)?.failures || 0
}

export function clearFailures(key: string) {
  const b = BUCKETS.get(key)
  if (b) b.failures = 0
}

/** Threshold above which the auth modal must show a captcha challenge. */
export const CAPTCHA_THRESHOLD = 3
/** Hard lockout above which we refuse new attempts entirely (HTTP 429). */
export const HARD_LOCK_THRESHOLD = 10

/** Build a stable key for IP-based rate limiting. */
export function ipKeyFromHeaders(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for') || ''
  const cip = headers.get('cf-connecting-ip') || ''
  const xri = headers.get('x-real-ip') || ''
  // Use the first hop in x-forwarded-for which is the original client.
  return (cip || fwd.split(',')[0].trim() || xri || 'anonymous').toLowerCase()
}
