import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getOAuthConfig, getOAuthSiteUrl, type OAuthProvider } from '@/lib/oauth-config-store';
import { PROVIDERS } from '@/lib/oauth-providers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_COOKIE = 'bcz_oauth_state';
const NEXT_COOKIE = 'bcz_oauth_next';

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

  const url = `${ep.authUrl}?${params.toString()}`;
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 min
  });
  res.cookies.set(NEXT_COOKIE, next.startsWith('/') ? next : '/', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return res;
}
