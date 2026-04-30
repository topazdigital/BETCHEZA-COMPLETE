import { NextRequest, NextResponse } from 'next/server';
import { getOAuthConfig, getOAuthSiteUrl, type OAuthProvider } from '@/lib/oauth-config-store';
import { PROVIDERS, exchangeCodeForToken, fetchOAuthProfile } from '@/lib/oauth-providers';
import { mockUsers } from '@/lib/mock-data';
import { setAuthCookie } from '@/lib/auth';
import type { User, TipsterProfile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_COOKIE = 'bcz_oauth_state';
const NEXT_COOKIE = 'bcz_oauth_next';

async function getRedirectUri(req: NextRequest, provider: OAuthProvider): Promise<string> {
  // Must match exactly what we sent in the start handler — prefer the
  // admin-configured Site URL when set, otherwise derive from the request.
  const siteUrl = await getOAuthSiteUrl();
  if (siteUrl) return `${siteUrl}/api/auth/oauth/${provider}/callback`;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:5000';
  return `${proto}://${host}/api/auth/oauth/${provider}/callback`;
}

function findOrCreateUser(opts: {
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}): User & { tipster_profile?: TipsterProfile } {
  const allUsers = mockUsers as (User & { tipster_profile?: TipsterProfile; oauth_provider?: string; oauth_provider_id?: string })[];

  // 1) Match on (provider, providerId)
  let user = allUsers.find(
    (u) => u.oauth_provider === opts.provider && u.oauth_provider_id === opts.providerId,
  );
  if (user) return user;

  // 2) Match on email (link existing email/password account)
  if (opts.email) {
    user = allUsers.find((u) => u.email.toLowerCase() === opts.email!.toLowerCase());
    if (user) {
      user.oauth_provider = opts.provider;
      user.oauth_provider_id = opts.providerId;
      if (!user.avatar_url && opts.avatarUrl) user.avatar_url = opts.avatarUrl;
      return user;
    }
  }

  // 3) Create new user
  const username = (opts.email?.split('@')[0] || `user_${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24) || `user_${Date.now()}`;

  const newUser: User & { oauth_provider?: string; oauth_provider_id?: string } = {
    id: allUsers.length + 1,
    email: opts.email || `${opts.provider}_${opts.providerId}@oauth.local`,
    phone: null,
    country_code: null,
    password_hash: '',
    google_id: opts.provider === 'google' ? opts.providerId : null,
    username,
    display_name: opts.name || username,
    avatar_url: opts.avatarUrl ?? null,
    bio: null,
    role: 'user',
    balance: 0,
    timezone: 'UTC',
    odds_format: 'decimal',
    is_verified: !!opts.email,
    created_at: new Date(),
    oauth_provider: opts.provider,
    oauth_provider_id: opts.providerId,
  };
  allUsers.push(newUser);
  return newUser;
}

function errorRedirect(req: NextRequest, code: string) {
  const url = new URL('/', req.url);
  url.searchParams.set('auth_error', code);
  return NextResponse.redirect(url);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  const p = provider as OAuthProvider;
  if (!PROVIDERS[p]) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });

  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (error) return errorRedirect(req, `${p}_${error}`);
  if (!code) return errorRedirect(req, `${p}_no_code`);

  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== state) return errorRedirect(req, `${p}_state_mismatch`);

  const cfg = (await getOAuthConfig())[p];
  if (!cfg.enabled || !cfg.clientId || !cfg.clientSecret) {
    return errorRedirect(req, `${p}_not_configured`);
  }

  const redirectUri = await getRedirectUri(req, p);
  const tokenRes = await exchangeCodeForToken(p, code, redirectUri, cfg);
  if (!tokenRes) return errorRedirect(req, `${p}_token_failed`);

  const profile = await fetchOAuthProfile(p, tokenRes.accessToken);
  if (!profile?.providerId) return errorRedirect(req, `${p}_profile_failed`);

  const user = findOrCreateUser({
    provider: p,
    providerId: profile.providerId,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
  });

  await setAuthCookie({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const next = req.cookies.get(NEXT_COOKIE)?.value || '/';
  const res = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', req.url));
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(NEXT_COOKIE);
  return res;
}

// Apple uses form_post — accept POST too.
export const POST = GET;
