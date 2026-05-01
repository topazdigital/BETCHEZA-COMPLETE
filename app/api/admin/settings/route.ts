import { NextRequest, NextResponse } from 'next/server';
import { query, execute, getPool } from '@/lib/db';
import { invalidateSiteSettingsCache } from '@/lib/site-settings';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// In-memory storage for development mode when no database. Exposed on
// globalThis so the public site-settings reader picks up admin updates
// even when no DB is configured.
const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'Betcheza',
  site_description: 'Your trusted betting tips community. Get expert predictions, track your performance, and compete with other tipsters.',
  default_theme: 'light',
  maintenance_mode: 'false',
  registration_enabled: 'true',
  email_verification: 'true',
  tipsters_auto_approval: 'false',
  comments_moderation: 'true',
  max_predictions_per_day: '10',
  min_odds_allowed: '1.2',
  max_odds_allowed: '50',
  primary_color: '#10B981',
  default_odds_format: 'decimal',
  notify_new_user: 'true',
  notify_new_prediction: 'true',
  notify_new_comment: 'false',
  google_analytics_id: '',
  facebook_pixel_id: '',
  logo_url: '',
  logo_dark_url: '',
  favicon_url: '',
  twofa_enabled: 'false',
  twofa_method: 'email',
  url_rewrites: '[]',
  seo_pages: '[]',
  cookie_banner_enabled: 'true',
  cookie_banner_message:
    'We use cookies to improve your experience, analyse site traffic and personalise content. By clicking "Accept", you consent to our use of cookies.',
};

const g = globalThis as { __memorySettings?: Record<string, string> };
// Initialize from file store (survives restarts) then fall back to defaults
const memorySettings: Record<string, string> = g.__memorySettings ?? (g.__memorySettings = {
  ...DEFAULT_SETTINGS,
  ...fileStoreGet<Record<string, string>>('site-settings', {}),
});

// Map of admin-panel keys to the matching environment-variable name.
// When the admin opens the settings page, any key that's blank in the DB
// but present in process.env is auto-filled from the env so the admin
// doesn't have to copy-paste it back in. Saving the form persists the
// value to the DB, after which the env var is no longer needed.
const ENV_BACKED_SETTINGS: Record<string, string> = {
  the_odds_api_key: 'THE_ODDS_API_KEY',
  sportsgameodds_api_key: 'SPORTSGAMEODDS_API_KEY',
  openai_api_key: 'OPENAI_API_KEY',
  vapid_public_key: 'VAPID_PUBLIC_KEY',
  vapid_private_key: 'VAPID_PRIVATE_KEY',
  vapid_subject: 'VAPID_SUBJECT',
  google_analytics_id: 'GOOGLE_ANALYTICS_ID',
  facebook_pixel_id: 'FACEBOOK_PIXEL_ID',
  // Football-data.org is also wired up in code but not yet surfaced in the
  // admin UI — list it here anyway so future tabs pick it up automatically.
  football_data_api_key: 'FOOTBALL_DATA_API_KEY',
  // Captcha — admin can paste these in the Security tab (preferred) but if
  // they're already set in env vars we'll show them prefilled.
  turnstile_site_key: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  turnstile_secret_key: 'TURNSTILE_SECRET_KEY',
  recaptcha_site_key: 'NEXT_PUBLIC_RECAPTCHA_SITE_KEY',
  recaptcha_secret_key: 'RECAPTCHA_SECRET_KEY',
};

function fillFromEnv(settings: Record<string, string>): Record<string, string> {
  for (const [key, envName] of Object.entries(ENV_BACKED_SETTINGS)) {
    const current = settings[key];
    if (!current || !String(current).trim()) {
      const envValue = (process.env[envName] || '').trim();
      if (envValue) settings[key] = envValue;
    }
  }
  return settings;
}

// Get all settings
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pool = getPool();

  // If no database, return memory settings (still backfilled from env so the
  // admin sees the API keys that are already wired up in code).
  if (!pool) {
    return NextResponse.json({
      settings: fillFromEnv({ ...memorySettings }),
      source: 'memory',
    });
  }

  try {
    const result = await query<{ setting_key: string; setting_value: string }>(`
      SELECT setting_key, setting_value
      FROM site_settings
      ORDER BY setting_key
    `);

    // Convert to object format
    const settings: Record<string, string> = { ...memorySettings };

    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    // Backfill any blank API-key field from the matching env var so the
    // admin can see "this is already set in code" without having to
    // re-paste it every time they open the page.
    fillFromEnv(settings);

    return NextResponse.json({
      settings,
      source: 'database',
    });
  } catch (error) {
    console.error('[Admin API] Failed to get settings:', error);

    // Return default settings on error
    return NextResponse.json({
      settings: fillFromEnv({ ...memorySettings }),
      source: 'memory',
    });
  }
}

// Update settings
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pool = getPool();

  // Parse body ONCE — re-reading after the body is consumed throws and used
  // to surface as the misleading "Failed to save settings" toast on the
  // Social Links tab.
  let settings: Record<string, unknown> | undefined;
  try {
    const body = await request.json();
    settings = body?.settings;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 });
  }

  // Always update in-memory copy so non-DB readers + cache reflect change
  // immediately, regardless of whether DB write succeeds.
  Object.assign(memorySettings, settings);
  // Persist to file so settings survive process restarts
  fileStoreSet('site-settings', memorySettings);
  invalidateSiteSettingsCache();

  // If no database configured, file + memory store are the source of truth.
  if (!pool) {
    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      source: 'file',
    });
  }

  // Upsert each setting. If any individual upsert fails (DB unreachable,
  // missing column, etc) we still consider the save successful because the
  // change is already live in memory + cache. We surface the warning so an
  // admin can investigate, but the UI doesn't show a scary error toast.
  let dbFailures = 0;
  let lastError: unknown = null;
  for (const [key, value] of Object.entries(settings)) {
    try {
      await execute(
        `INSERT INTO site_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, String(value ?? '')],
      );
    } catch (err) {
      dbFailures++;
      lastError = err;
    }
  }

  if (dbFailures === 0) {
    return NextResponse.json({
      success: true,
      message: 'Settings saved to database',
      source: 'database',
    });
  }

  console.warn(
    `[Admin API] settings: ${dbFailures} of ${Object.keys(settings).length} writes failed; ` +
    `kept memory copy. Last error:`,
    lastError,
  );
  return NextResponse.json({
    success: true,
    message: 'Settings saved (database currently unreachable — kept in memory)',
    source: 'memory',
    dbFailures,
  });
}
