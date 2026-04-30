/**
 * Resolve external API keys from the admin site_settings table first,
 * with the matching environment variable as a fallback. Admin panel:
 * /admin/settings → API Keys tab.
 *
 * Cached for 30 s (matches the SiteSettings cache in lib/site-settings.ts)
 * so this is cheap to call from request handlers.
 */
import { getSiteSettings } from './site-settings';

type KnownKey =
  | 'the_odds_api_key'
  | 'sportsgameodds_api_key'
  | 'openai_api_key'
  | 'vapid_public_key'
  | 'vapid_private_key'
  | 'vapid_subject';

const ENV_MAP: Record<KnownKey, string> = {
  the_odds_api_key: 'THE_ODDS_API_KEY',
  sportsgameodds_api_key: 'SPORTSGAMEODDS_API_KEY',
  openai_api_key: 'OPENAI_API_KEY',
  vapid_public_key: 'VAPID_PUBLIC_KEY',
  vapid_private_key: 'VAPID_PRIVATE_KEY',
  vapid_subject: 'VAPID_SUBJECT',
};

export async function getApiKey(key: KnownKey): Promise<string> {
  // Admin DB value takes precedence (so a key can be rotated without redeploy).
  try {
    const settings = await getSiteSettings();
    const v = (settings as Record<string, string | undefined>)[key];
    if (v && v.trim()) return v.trim();
  } catch {
    /* fall through to env */
  }
  return (process.env[ENV_MAP[key]] || '').trim();
}

/**
 * Synchronous variant for code paths that can't await (legacy fetch helpers).
 * Reads ONLY from process.env — admin overrides require the async variant.
 */
export function getApiKeyEnv(key: KnownKey): string {
  return (process.env[ENV_MAP[key]] || '').trim();
}
