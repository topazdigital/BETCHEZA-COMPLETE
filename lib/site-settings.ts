import { query, getPool } from './db';

export interface SiteSettings {
  site_name: string;
  site_description: string;
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  primary_color: string;
  default_theme: string;
  google_analytics_id: string;
  facebook_pixel_id: string;
  twofa_enabled: string;
  twofa_method: string;
  url_rewrites: string;
  seo_pages: string;
  maintenance_mode: string;
  maintenance_message: string;
  /** JSON-serialised SocialLink[] — managed in /admin/settings → Social tab. */
  social_links: string;
  /** "true" / "false" — when true the cookie consent banner shows on first visit. */
  cookie_banner_enabled: string;
  /** Customisable banner copy. Falls back to a sensible default. */
  cookie_banner_message: string;
  [key: string]: string;
}

export interface SocialLink {
  /** Stable platform key (twitter, facebook, instagram, youtube, tiktok, telegram, whatsapp, linkedin, discord). */
  platform: string;
  /** Public URL the icon links to. */
  url: string;
  /** Optional handle (@betcheza) — purely cosmetic, shown as a tooltip. */
  handle?: string;
  /** When false, the icon is hidden from the footer even if a URL is set. */
  enabled: boolean;
}

export function parseSocialLinks(raw: string): SocialLink[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (e): e is SocialLink =>
          typeof e?.platform === 'string' && typeof e?.url === 'string',
      )
      .map((e) => ({ enabled: true, ...e }));
  } catch {
    return [];
  }
}

const DEFAULTS: SiteSettings = {
  site_name: 'Betcheza',
  site_description: 'Your trusted betting tips community. Get expert predictions, track your performance, and compete with other tipsters.',
  logo_url: '/betcheza-logo-light.svg',
  logo_dark_url: '/betcheza-logo-dark.svg',
  favicon_url: '/betcheza-favicon.svg',
  primary_color: '#10B981',
  default_theme: 'light',
  google_analytics_id: '',
  facebook_pixel_id: '',
  twofa_enabled: 'false',
  twofa_method: 'email',
  url_rewrites: '[]',
  seo_pages: '[]',
  maintenance_mode: 'false',
  maintenance_message: '',
  social_links: '[]',
  cookie_banner_enabled: 'true',
  cookie_banner_message:
    'We use cookies to improve your experience, analyse site traffic and personalise content. By clicking "Accept", you consent to our use of cookies.',
  // Captcha provider (managed via /admin/settings → Security tab):
  // 'turnstile' | 'recaptcha' | 'math' | 'none' | '' (auto)
  captcha_provider: '',
  turnstile_site_key: '',
  turnstile_secret_key: '',
  recaptcha_site_key: '',
  recaptcha_secret_key: '',
};

const g = globalThis as { __siteSettingsCache?: { value: SiteSettings; ts: number } };
const CACHE_TTL_MS = 30_000;

export async function getSiteSettings(): Promise<SiteSettings> {
  const now = Date.now();
  if (g.__siteSettingsCache && now - g.__siteSettingsCache.ts < CACHE_TTL_MS) {
    return g.__siteSettingsCache.value;
  }
  const merged: SiteSettings = { ...DEFAULTS };
  const pool = getPool();
  if (pool) {
    try {
      const result = await query<{ setting_key: string; setting_value: string }>(
        'SELECT setting_key, setting_value FROM site_settings'
      );
      result.rows.forEach((row) => {
        merged[row.setting_key] = row.setting_value;
      });
    } catch {
      // Table missing — keep defaults / memory.
    }
  }
  // Layer in any in-memory writes from /api/admin/settings (so non-DB
  // installs still see the latest admin updates).
  const mem = (globalThis as { __memorySettings?: Record<string, string> }).__memorySettings;
  if (mem) Object.assign(merged, mem);
  g.__siteSettingsCache = { value: merged, ts: now };
  return merged;
}

export function invalidateSiteSettingsCache(): void {
  delete g.__siteSettingsCache;
}

export interface SeoPageEntry {
  /** Path the rule applies to, e.g. "/", "/matches", "/results" or a glob like "/leagues/*". */
  path: string;
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export interface UrlRewriteEntry {
  /** From path (must start with / and may end with * for prefix matching). */
  source: string;
  /** Target path users actually land on. */
  destination: string;
  /** Permanent (308) when true, else 307. */
  permanent?: boolean;
}

export function parseSeoPages(raw: string): SeoPageEntry[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((e): e is SeoPageEntry => typeof e?.path === 'string');
  } catch {
    return [];
  }
}

export function parseRewrites(raw: string): UrlRewriteEntry[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is UrlRewriteEntry =>
        typeof e?.source === 'string' && typeof e?.destination === 'string'
    );
  } catch {
    return [];
  }
}

/** Find the most specific SEO entry matching a pathname. */
export function findSeoForPath(entries: SeoPageEntry[], pathname: string): SeoPageEntry | undefined {
  // Exact match wins.
  const exact = entries.find((e) => e.path === pathname);
  if (exact) return exact;
  // Then longest-prefix glob.
  const globs = entries
    .filter((e) => e.path.endsWith('/*'))
    .map((e) => ({ entry: e, prefix: e.path.slice(0, -1) }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  return globs.find((g) => pathname.startsWith(g.prefix))?.entry;
}
