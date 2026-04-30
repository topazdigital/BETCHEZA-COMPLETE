import type { OAuthProvider, OAuthProviderConfig } from './oauth-config-store';

export interface ProviderEndpoints {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scope: string;
  /** Whether the provider exchanges code in JSON or form-encoded body */
  tokenContentType: 'json' | 'form';
  /** Optional auth method: form/basic */
  tokenAuth?: 'body' | 'basic';
  /** Field on userInfo for email */
  emailKey?: string;
  /** Field on userInfo for display name */
  nameKey?: string;
  /** Field on userInfo for avatar */
  avatarKey?: string;
  /** Whether the provider sets PKCE / specifics */
  responseType?: 'code';
  /** When supported, ask Google for refresh + show consent on login */
  extraAuthParams?: Record<string, string>;
}

export const PROVIDERS: Record<OAuthProvider, ProviderEndpoints> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    tokenContentType: 'form',
    emailKey: 'email',
    nameKey: 'name',
    avatarKey: 'picture',
    extraAuthParams: { access_type: 'online', prompt: 'select_account' },
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)',
    scope: 'email,public_profile',
    tokenContentType: 'form',
    emailKey: 'email',
    nameKey: 'name',
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    tokenContentType: 'form',
    emailKey: 'email',
    nameKey: 'name',
    avatarKey: 'avatar_url',
  },
  apple: {
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    scope: 'name email',
    tokenContentType: 'form',
    extraAuthParams: { response_mode: 'form_post' },
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username',
    scope: 'users.read tweet.read',
    tokenContentType: 'form',
    tokenAuth: 'basic',
    nameKey: 'name',
  },
  discord: {
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scope: 'identify email',
    tokenContentType: 'form',
    emailKey: 'email',
    nameKey: 'username',
    avatarKey: 'avatar',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email',
    tokenContentType: 'form',
    emailKey: 'email',
    nameKey: 'name',
    avatarKey: 'picture',
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    scope: 'openid email profile',
    tokenContentType: 'form',
    emailKey: 'email',
    nameKey: 'name',
    avatarKey: 'picture',
  },
};

export interface NormalizedProfile {
  providerId: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  avatarUrl?: string;
}

export async function fetchOAuthProfile(
  provider: OAuthProvider,
  accessToken: string,
): Promise<NormalizedProfile | null> {
  const ep = PROVIDERS[provider];
  if (!ep.userInfoUrl) return null;

  const res = await fetch(ep.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'Betcheza/1.0',
    },
  });
  if (!res.ok) return null;
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!j) return null;

  // GitHub email is sometimes private, hit a separate endpoint for it.
  let email: string | undefined =
    typeof j[ep.emailKey || 'email'] === 'string'
      ? (j[ep.emailKey || 'email'] as string)
      : undefined;
  if (provider === 'github' && !email) {
    const er = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'Betcheza/1.0',
      },
    });
    if (er.ok) {
      const arr = (await er.json().catch(() => [])) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = arr.find((e) => e.primary && e.verified) || arr.find((e) => e.verified) || arr[0];
      email = primary?.email;
    }
  }

  // Twitter v2 wraps user under `data`
  let providerId = String(j.id || j.sub || '');
  let name: string | undefined =
    typeof j[ep.nameKey || 'name'] === 'string'
      ? (j[ep.nameKey || 'name'] as string)
      : undefined;
  let avatarUrl: string | undefined =
    typeof j[ep.avatarKey || 'avatar_url'] === 'string'
      ? (j[ep.avatarKey || 'avatar_url'] as string)
      : undefined;

  if (provider === 'twitter') {
    const data = (j as { data?: Record<string, unknown> }).data;
    if (data) {
      providerId = String(data.id || providerId);
      if (typeof data.name === 'string') name = data.name;
      if (typeof data.profile_image_url === 'string') avatarUrl = data.profile_image_url;
    }
  }

  if (provider === 'facebook') {
    const pic = (j as { picture?: { data?: { url?: string } } }).picture;
    if (pic?.data?.url) avatarUrl = pic.data.url;
  }

  if (provider === 'discord' && avatarUrl && providerId) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${providerId}/${avatarUrl}.png`;
  }

  return {
    providerId,
    email: email?.toLowerCase(),
    emailVerified: typeof j.email_verified === 'boolean' ? (j.email_verified as boolean) : undefined,
    name,
    avatarUrl,
  };
}

export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  cfg: OAuthProviderConfig,
): Promise<{ accessToken: string; idToken?: string } | null> {
  const ep = PROVIDERS[provider];

  const params = new URLSearchParams({
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (ep.tokenAuth !== 'basic') {
    params.set('client_id', cfg.clientId);
    params.set('client_secret', cfg.clientSecret);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Betcheza/1.0',
  };
  if (ep.tokenAuth === 'basic') {
    const b = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${b}`;
  }

  const res = await fetch(ep.tokenUrl, {
    method: 'POST',
    headers,
    body: params.toString(),
  });
  if (!res.ok) {
    console.error(`[oauth/${provider}] token exchange failed`, res.status, await res.text().catch(() => ''));
    return null;
  }
  const j = (await res.json().catch(() => null)) as { access_token?: string; id_token?: string } | null;
  if (!j?.access_token) return null;
  return { accessToken: j.access_token, idToken: j.id_token };
}
