import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getOAuthConfig, getOAuthSiteUrl, type OAuthProvider } from '@/lib/oauth-config-store';
import { PROVIDERS } from '@/lib/oauth-providers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_COOKIE = 'bcz_oauth_state';
const NEXT_COOKIE = 'bcz_oauth_next';

// Multi-part TLDs where the registrable domain is 3 labels deep (e.g. betcheza.co.ke)
const MULTI_PART_TLDS = new Set([
  'co.ke', 'co.uk', 'com.au', 'co.nz', 'co.za', 'co.in', 'co.jp', 'co.id',
  'com.br', 'com.mx', 'com.ar', 'org.uk', 'me.uk', 'net.au',
]);

/**
 * Returns a cookie domain that covers both www and non-www variants of a host,
 * e.g. "www.betcheza.co.ke" → ".betcheza.co.ke".
 * Returns undefined for localhost / Replit dev domains (don't set domain there).
 */
function getRootDomain(host: string): string | undefined {
  const h = host.split(':')[0]; // strip port
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.replit.dev') || h.endsWith('.replit.app')) {
    return undefined;
  }
  const parts = h.split('.');
  if (parts.length < 2) return undefined;
  const twoPartTld = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(twoPartTld) && parts.length >= 3) {
    // e.g. www.betcheza.co.ke → .betcheza.co.ke
    return '.' + parts.slice(-3).join('.');
  }
  // e.g. www.betcheza.com → .betcheza.com
  return '.' + parts.slice(-2).join('.');
}

async function getRedirectUri(req: NextRequest, provider: OAuthProvider): Promise<string> {
  // Admin-configured Site URL wins so OAuth callbacks always land on the
  // production domain regardless of which environment kicked off the flow.
  const siteUrl = await getOAuthSiteUrl();
  if (siteUrl) return `${siteUrl}/api/auth/oauth/${provider}/callback`;
  // Otherwise prefer x-forwarded-* headers because we sit behind a proxy.
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:5000';
  return `${proto}://${host}/api/auth/oauth/${provider}/callback`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  const p = provider as OAuthProvider;
  if (!PROVIDERS[p]) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  const cfg = (await getOAuthConfig())[p];
  if (!cfg.enabled || !cfg.clientId) {
    const siteUrl = await getOAuthSiteUrl();
    const base = siteUrl || (() => {
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost';
      return `${proto}://${host}`;
    })();
    const url = new URL('/', base);
    url.searchParams.set('auth_error', `${p}_not_configured`);
    return NextResponse.redirect(url);
  }

  const ep = PROVIDERS[p];
  const redirectUri = await getRedirectUri(req, p);
  const state = randomBytes(24).toString('base64url');
  const next = req.nextUrl.searchParams.get('next') || '/';

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ep.scope,
    state,
  });
  if (ep.extraAuthParams) {
    Object.entries(ep.extraAuthParams).forEach(([k, v]) => params.set(k, v));
  }

  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const cookieDomain = getRootDomain(rawHost);
  const isSecure = process.env.NODE_ENV === 'production';

  const url = `${ep.authUrl}?${params.toString()}`;
  const res = NextResponse.redirect(url);

  const cookieBase = {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 10 * 60,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };

  res.cookies.set(STATE_COOKIE, state, cookieBase);
  res.cookies.set(NEXT_COOKIE, next.startsWith('/') ? next : '/', cookieBase);
  return res;
}
