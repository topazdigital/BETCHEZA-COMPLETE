import { query, execute, getPool } from './db';

export type OAuthProvider = 'google' | 'facebook' | 'apple' | 'github' | 'twitter' | 'discord' | 'linkedin' | 'microsoft';

export interface OAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  /** Apple needs a JWT private key + key ID + team ID. We keep it generic. */
  extra?: Record<string, string>;
}

export interface OAuthAllConfig {
  google: OAuthProviderConfig;
  facebook: OAuthProviderConfig;
  apple: OAuthProviderConfig;
  github: OAuthProviderConfig;
  twitter: OAuthProviderConfig;
  discord: OAuthProviderConfig;
  linkedin: OAuthProviderConfig;
  microsoft: OAuthProviderConfig;
}

const DEFAULTS: OAuthAllConfig = {
  google: { enabled: false, clientId: '', clientSecret: '' },
  facebook: { enabled: false, clientId: '', clientSecret: '' },
  apple: { enabled: false, clientId: '', clientSecret: '', extra: { teamId: '', keyId: '', privateKey: '' } },
  github: { enabled: false, clientId: '', clientSecret: '' },
  twitter: { enabled: false, clientId: '', clientSecret: '' },
  discord: { enabled: false, clientId: '', clientSecret: '' },
  linkedin: { enabled: false, clientId: '', clientSecret: '' },
  microsoft: { enabled: false, clientId: '', clientSecret: '' },
};

const g = globalThis as { __oauthCfg?: OAuthAllConfig };

function fromEnv(): OAuthAllConfig {
  const cfg = JSON.parse(JSON.stringify(DEFAULTS)) as OAuthAllConfig;
  const map: Array<[OAuthProvider, string]> = [
    ['google', 'GOOGLE'],
    ['facebook', 'FACEBOOK'],
    ['apple', 'APPLE'],
    ['github', 'GITHUB'],
    ['twitter', 'TWITTER'],
    ['discord', 'DISCORD'],
    ['linkedin', 'LINKEDIN'],
    ['microsoft', 'MICROSOFT'],
  ];
  for (const [k, env] of map) {
    const id = process.env[`${env}_CLIENT_ID`] || '';
    const secret = process.env[`${env}_CLIENT_SECRET`] || '';
    if (id && secret) {
      cfg[k] = { enabled: true, clientId: id, clientSecret: secret };
    }
  }
  if (process.env.APPLE_TEAM_ID) {
    cfg.apple.extra = {
      teamId: process.env.APPLE_TEAM_ID || '',
      keyId: process.env.APPLE_KEY_ID || '',
      privateKey: process.env.APPLE_PRIVATE_KEY || '',
    };
  }
  return cfg;
}

/**
 * Optional production "Site URL" override. When set (e.g. `https://betcheza.com`)
 * we use it to build OAuth callback URLs and to display the callback URI in the
 * admin panel — so admins can configure providers from any environment (Replit
 * dev, staging, etc.) and still register the production redirect URI.
 *
 * Stored alongside the OAuth provider config in `admin_settings` (key
 * `oauth_site_url`) and falls back to in-memory + the OAUTH_SITE_URL env var.
 */
const gs = globalThis as { __oauthSiteUrl?: string };

function normalizeSiteUrl(raw: string | null | undefined): string {
  const v = (raw || '').trim();
  if (!v) return '';
  // Strip trailing slashes — we always append the path ourselves.
  return v.replace(/\/+$/, '');
}

export async function getOAuthSiteUrl(): Promise<string> {
  if (getPool()) {
    try {
      const result = await query<{ value: string }>(
        "SELECT value FROM admin_settings WHERE name = 'oauth_site_url' LIMIT 1"
      );
      const rows = (result as unknown as { rows?: { value: string }[] }).rows
        ?? (result as unknown as { value: string }[]) ?? [];
      if (rows.length > 0) return normalizeSiteUrl(rows[0].value);
    } catch {
      // table missing — fall through
    }
  }
  if (gs.__oauthSiteUrl !== undefined) return gs.__oauthSiteUrl;
  return normalizeSiteUrl(process.env.OAUTH_SITE_URL);
}

export async function setOAuthSiteUrl(value: string): Promise<string> {
  const normalized = normalizeSiteUrl(value);
  gs.__oauthSiteUrl = normalized;
  if (getPool()) {
    try {
      await query(
        `INSERT INTO admin_settings (name, value, type, description)
         VALUES ('oauth_site_url', ?, 'string', 'Public site URL used for OAuth callback URLs')
         ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
        [normalized]
      );
    } catch {
      // ignore — in-memory fallback already saved
    }
  }
  return normalized;
}

export async function getOAuthConfig(): Promise<OAuthAllConfig> {
  if (getPool()) {
    try {
      const result = await query<{ name: string; value: string }>(
        "SELECT name, value FROM admin_settings WHERE name LIKE 'oauth_%'"
      );
      const rows = (result as unknown as { rows?: { name: string; value: string }[] }).rows ?? (result as unknown as { name: string; value: string }[]) ?? [];
      if (rows.length > 0) {
        const cfg = JSON.parse(JSON.stringify(DEFAULTS)) as OAuthAllConfig;
        const m = new Map(rows.map((r) => [r.name, r.value]));
        (Object.keys(cfg) as OAuthProvider[]).forEach((p) => {
          cfg[p].enabled = m.get(`oauth_${p}_enabled`) === 'true';
          cfg[p].clientId = m.get(`oauth_${p}_client_id`) || '';
          cfg[p].clientSecret = m.get(`oauth_${p}_client_secret`) || '';
        });
        cfg.apple.extra = {
          teamId: m.get('oauth_apple_team_id') || '',
          keyId: m.get('oauth_apple_key_id') || '',
          privateKey: m.get('oauth_apple_private_key') || '',
        };
        return cfg;
      }
    } catch {
      // table missing — fall through
    }
  }
  if (g.__oauthCfg) return g.__oauthCfg;
  const env = fromEnv();
  g.__oauthCfg = env;
  return env;
}

export async function saveOAuthConfig(patch: Partial<OAuthAllConfig>): Promise<OAuthAllConfig> {
  const current = await getOAuthConfig();
  const merged = { ...current } as OAuthAllConfig;
  (Object.keys(patch) as OAuthProvider[]).forEach((p) => {
    const incoming = patch[p];
    if (!incoming) return;
    merged[p] = {
      ...merged[p],
      ...incoming,
      // Don't overwrite a stored secret with empty string (allows partial updates)
      clientSecret: incoming.clientSecret || merged[p].clientSecret,
      extra: incoming.extra ? { ...(merged[p].extra || {}), ...incoming.extra } : merged[p].extra,
    };
  });
  g.__oauthCfg = merged;

  if (getPool()) {
    try {
      const entries: Array<[string, string]> = [];
      (Object.keys(merged) as OAuthProvider[]).forEach((p) => {
        entries.push([`oauth_${p}_enabled`, String(merged[p].enabled)]);
        entries.push([`oauth_${p}_client_id`, merged[p].clientId]);
        entries.push([`oauth_${p}_client_secret`, merged[p].clientSecret]);
      });
      if (merged.apple.extra) {
        entries.push(['oauth_apple_team_id', merged.apple.extra.teamId || '']);
        entries.push(['oauth_apple_key_id', merged.apple.extra.keyId || '']);
        entries.push(['oauth_apple_private_key', merged.apple.extra.privateKey || '']);
      }
      for (const [name, value] of entries) {
        await query(
          `INSERT INTO admin_settings (name, value, type, description)
           VALUES (?, ?, 'string', 'OAuth provider config')
           ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
          [name, value]
        );
      }
    } catch {
      // ignore — in-memory fallback already saved
    }
  }
  return merged;
}

export function maskedOAuthConfig(cfg: OAuthAllConfig) {
  const out: Record<string, { enabled: boolean; clientId: string; secretSet: boolean; extra?: Record<string, boolean> }> = {};
  (Object.keys(cfg) as OAuthProvider[]).forEach((p) => {
    out[p] = {
      enabled: cfg[p].enabled,
      clientId: cfg[p].clientId,
      secretSet: !!cfg[p].clientSecret,
      extra: cfg[p].extra
        ? Object.fromEntries(Object.entries(cfg[p].extra!).map(([k, v]) => [k, !!v]))
        : undefined,
    };
  });
  return out;
}
