import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware that:
 *   1. Gates the whole site behind a maintenance page when admin enabled it.
 *   2. Applies admin-managed URL rewrites (redirects).
 *   3. Forwards the current pathname as `x-pathname` so the root layout can
 *      compute per-page SEO metadata via `generateMetadata`.
 *
 * IMPORTANT: Self-fetch calls use INTERNAL_BASE_URL (localhost) NOT the public
 * origin. Using the public origin caused a circular deadlock:
 *   request → middleware fetch → Apache → Node.js (busy) → 503
 * Using localhost bypasses Apache entirely and avoids the deadlock.
 */

interface CachedRewrites {
  rules: Array<{ source: string; destination: string; permanent?: boolean }>;
  ts: number;
}
interface CachedMaintenance {
  enabled: boolean;
  message: string;
  ts: number;
}

const TTL_MS = 30_000;
// Extend initial back-off so we don't hit API routes before they compile.
const STARTUP_DELAY_MS = 2 * 60 * 1000;
const startedAt = Date.now();

let rewriteCache: CachedRewrites | null = null;
let maintenanceCache: CachedMaintenance | null = null;

/**
 * Returns the internal base URL to use for self-fetch calls.
 * Uses INTERNAL_BASE_URL env var (e.g. http://localhost:3001) to avoid
 * routing through Apache/nginx and causing circular connection deadlocks.
 * Falls back to http://localhost:3000 if the env var is not set.
 */
function getInternalBase(): string {
  return process.env.INTERNAL_BASE_URL || 'http://localhost:3000';
}

async function loadRewrites(): Promise<CachedRewrites['rules']> {
  if (Date.now() - startedAt < STARTUP_DELAY_MS) return rewriteCache?.rules ?? [];
  if (rewriteCache && Date.now() - rewriteCache.ts < TTL_MS) return rewriteCache.rules;
  try {
    const res = await fetch(`${getInternalBase()}/api/site-settings/rewrites`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      rewriteCache = { rules: [], ts: Date.now() };
      return [];
    }
    const data = (await res.json()) as { rewrites?: CachedRewrites['rules'] };
    rewriteCache = { rules: Array.isArray(data.rewrites) ? data.rewrites : [], ts: Date.now() };
    return rewriteCache.rules;
  } catch {
    rewriteCache = { rules: [], ts: Date.now() };
    return [];
  }
}

async function loadMaintenance(): Promise<CachedMaintenance> {
  if (Date.now() - startedAt < STARTUP_DELAY_MS) return maintenanceCache ?? { enabled: false, message: '', ts: 0 };
  if (maintenanceCache && Date.now() - maintenanceCache.ts < TTL_MS) return maintenanceCache;
  try {
    const res = await fetch(`${getInternalBase()}/api/site-settings/maintenance`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      maintenanceCache = { enabled: false, message: '', ts: Date.now() };
      return maintenanceCache;
    }
    const data = (await res.json()) as { enabled?: boolean; message?: string };
    maintenanceCache = { enabled: !!data.enabled, message: data.message || '', ts: Date.now() };
    return maintenanceCache;
  } catch {
    maintenanceCache = { enabled: false, message: '', ts: Date.now() };
    return maintenanceCache;
  }
}

function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/maintenance') ||
    /\.[a-zA-Z0-9]{1,5}$/.test(pathname)
  );
}

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ── Maintenance gate ────────────────────────────────────────────
  if (!isExempt(pathname)) {
    const m = await loadMaintenance();
    if (m.enabled) {
      const url = req.nextUrl.clone();
      url.pathname = '/maintenance';
      url.search = '';
      return NextResponse.rewrite(url);
    }
  }

  // ── URL rewrites (redirects) ────────────────────────────────────
  if (
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/static') &&
    !/\.[a-zA-Z0-9]{1,5}$/.test(pathname)
  ) {
    const rules = await loadRewrites();
    for (const rule of rules) {
      const dest = matchRewrite(pathname, rule.source, rule.destination);
      if (dest) {
        const url = req.nextUrl.clone();
        url.pathname = dest;
        url.search = search;
        return NextResponse.redirect(url, rule.permanent ? 308 : 307);
      }
    }
  }

  const res = NextResponse.next();
  res.headers.set('x-pathname', pathname);
  return res;
}

function matchRewrite(pathname: string, source: string, destination: string): string | null {
  if (!source.startsWith('/')) return null;
  if (source.endsWith('/*')) {
    const prefix = source.slice(0, -1);
    if (!pathname.startsWith(prefix)) return null;
    const rest = pathname.slice(prefix.length);
    if (destination.endsWith('/*')) return destination.slice(0, -1) + rest;
    return destination;
  }
  return pathname === source ? destination : null;
}

export const config = {
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
};
