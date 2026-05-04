import { NextRequest, NextResponse } from 'next/server';
import { getOAuthConfig, getOAuthSiteUrl, type OAuthProvider } from '@/lib/oauth-config-store';
import { PROVIDERS, exchangeCodeForToken, fetchOAuthProfile } from '@/lib/oauth-providers';
import { setAuthCookie } from '@/lib/auth';
import { queryOne, execute, getPool } from '@/lib/db';
import { mockUsers } from '@/lib/mock-data';
import type { User } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_COOKIE = 'bcz_oauth_state';
const NEXT_COOKIE = 'bcz_oauth_next';

async function getRedirectUri(req: NextRequest, provider: OAuthProvider): Promise<string> {
  const siteUrl = await getOAuthSiteUrl();
  if (siteUrl) return `${siteUrl}/api/auth/oauth/${provider}/callback`;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:5000';
  return `${proto}://${host}/api/auth/oauth/${provider}/callback`;
}

async function errorRedirect(req: NextRequest, code: string) {
  const siteUrl = await getOAuthSiteUrl();
  const base = siteUrl || (() => {
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost';
    return `${proto}://${host}`;
  })();
  const url = new URL('/', base);
  url.searchParams.set('auth_error', code);
  return NextResponse.redirect(url);
}

function makeUsername(email?: string): string {
  const base = (email?.split('@')[0] || `user_${Date.now()}`)
    .toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || `user_${Date.now()}`;
  return `${base}_${Math.floor(Math.random() * 9000) + 1000}`;
}

interface DbUser {
  id: number; email: string; username: string; display_name: string;
  avatar_url: string | null; role: 'user' | 'tipster' | 'admin';
  balance: number; is_verified: boolean; google_id: string | null;
}

async function dbFindOrCreate(opts: {
  provider: OAuthProvider; providerId: string;
  email?: string; name?: string; avatarUrl?: string;
}): Promise<DbUser | null> {
  if (!getPool()) return null;
  const sel = 'SELECT id, email, username, display_name, avatar_url, role, balance, is_verified, google_id FROM users';

  if (opts.provider === 'google') {
    const u = await queryOne<DbUser>(`${sel} WHERE google_id = ? LIMIT 1`, [opts.providerId]);
    if (u) return u;
  } else {
    try {
      const u = await queryOne<DbUser>(`${sel} WHERE oauth_provider = ? AND oauth_provider_id = ? LIMIT 1`, [opts.provider, opts.providerId]);
      if (u) return u;
    } catch { /* columns may not exist yet */ }
  }

  if (opts.email) {
    const u = await queryOne<DbUser>(`${sel} WHERE email = ? LIMIT 1`, [opts.email]);
    if (u) {
      try {
        if (opts.provider === 'google') {
          await execute('UPDATE users SET google_id = ? WHERE id = ?', [opts.providerId, u.id]);
        } else {
          await execute('UPDATE users SET oauth_provider = ?, oauth_provider_id = ? WHERE id = ?', [opts.provider, opts.providerId, u.id]);
        }
        if (!u.avatar_url && opts.avatarUrl) await execute('UPDATE users SET avatar_url = ? WHERE id = ?', [opts.avatarUrl, u.id]);
      } catch { /* ignore */ }
      return u;
    }
  }

  const username = makeUsername(opts.email);
  const displayName = opts.name || username;
  const email = opts.email || `${opts.provider}_${opts.providerId}@oauth.local`;
  const verified = opts.email ? 1 : 0;

  try {
    let insertId: number;
    if (opts.provider === 'google') {
      const r = await execute(
        `INSERT INTO users (email, username, display_name, avatar_url, password_hash, google_id, role, balance, timezone, odds_format, is_verified, created_at) VALUES (?, ?, ?, ?, '', ?, 'user', 0, 'Africa/Nairobi', 'decimal', ?, NOW())`,
        [email, username, displayName, opts.avatarUrl ?? null, opts.providerId, verified]
      );
      insertId = r.insertId;
    } else {
      try {
        const r = await execute(
          `INSERT INTO users (email, username, display_name, avatar_url, password_hash, oauth_provider, oauth_provider_id, role, balance, timezone, odds_format, is_verified, created_at) VALUES (?, ?, ?, ?, '', ?, ?, 'user', 0, 'Africa/Nairobi', 'decimal', ?, NOW())`,
          [email, username, displayName, opts.avatarUrl ?? null, opts.provider, opts.providerId, verified]
        );
        insertId = r.insertId;
      } catch {
        const r = await execute(
          `INSERT INTO users (email, username, display_name, avatar_url, password_hash, role, balance, timezone, odds_format, is_verified, created_at) VALUES (?, ?, ?, ?, '', 'user', 0, 'Africa/Nairobi', 'decimal', ?, NOW())`,
          [email, username, displayName, opts.avatarUrl ?? null, verified]
        );
        insertId = r.insertId;
      }
    }
    return await queryOne<DbUser>(`${sel} WHERE id = ? LIMIT 1`, [insertId]);
  } catch (e) {
    console.error('[oauth-callback] db create user failed:', e);
    return null;
  }
}

function mockFindOrCreate(opts: { provider: OAuthProvider; providerId: string; email?: string; name?: string; avatarUrl?: string; }): User {
  const all = mockUsers as (User & { oauth_provider?: string; oauth_provider_id?: string })[];
  let user = all.find(u => u.oauth_provider === opts.provider && u.oauth_provider_id === opts.providerId);
  if (user) return user;
  if (opts.email) {
    user = all.find(u => u.email.toLowerCase() === opts.email!.toLowerCase());
    if (user) {
      (user as typeof user & { oauth_provider?: string; oauth_provider_id?: string }).oauth_provider = opts.provider;
      (user as typeof user & { oauth_provider?: string; oauth_provider_id?: string }).oauth_provider_id = opts.providerId;
      if (!user.avatar_url && opts.avatarUrl) user.avatar_url = opts.avatarUrl;
      return user;
    }
  }
  const username = makeUsername(opts.email);
  const newUser: User & { oauth_provider?: string; oauth_provider_id?: string } = {
    id: all.length + 1, email: opts.email || `${opts.provider}_${opts.providerId}@oauth.local`,
    phone: null, country_code: null, password_hash: '',
    google_id: opts.provider === 'google' ? opts.providerId : null,
    username, display_name: opts.name || username, avatar_url: opts.avatarUrl ?? null,
    bio: null, role: 'user', balance: 0, timezone: 'Africa/Nairobi',
    odds_format: 'decimal', is_verified: !!opts.email, created_at: new Date(),
    oauth_provider: opts.provider, oauth_provider_id: opts.providerId,
  };
  all.push(newUser);
  return newUser;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = provider as OAuthProvider;
  if (!PROVIDERS[p]) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });

  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (error) return await errorRedirect(req, `${p}_${error}`);
  if (!code) return await errorRedirect(req, `${p}_no_code`);

  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== state) return await errorRedirect(req, `${p}_state_mismatch`);

  const cfg = (await getOAuthConfig())[p];
  if (!cfg.enabled || !cfg.clientId || !cfg.clientSecret) {
    return await errorRedirect(req, `${p}_not_configured`);
  }

  const redirectUri = await getRedirectUri(req, p);
  const tokenRes = await exchangeCodeForToken(p, code, redirectUri, cfg);
  if (!tokenRes) return await errorRedirect(req, `${p}_token_failed`);

  const profile = await fetchOAuthProfile(p, tokenRes.accessToken);
  if (!profile?.providerId) return await errorRedirect(req, `${p}_profile_failed`);

  const oauthOpts = { provider: p, providerId: profile.providerId, email: profile.email, name: profile.name, avatarUrl: profile.avatarUrl };
  const dbUser = await dbFindOrCreate(oauthOpts);
  const user = dbUser ?? mockFindOrCreate(oauthOpts);

  await setAuthCookie({ userId: user.id, email: user.email, role: user.role });

  const next = req.cookies.get(NEXT_COOKIE)?.value || '/';
  // Build redirect base from site URL / forwarded headers — never use req.url
  // (req.url is the internal http://localhost:5001/... address behind the proxy).
  const siteUrl = await getOAuthSiteUrl();
  const baseUrl = siteUrl || (() => {
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost';
    return `${proto}://${host}`;
  })();
  const res = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', baseUrl));
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(NEXT_COOKIE);
  return res;
}

export const POST = GET;
