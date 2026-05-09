import { NextRequest, NextResponse } from 'next/server';
import { query, execute, getPool } from '@/lib/db';
import { invalidateSiteSettingsCache } from '@/lib/site-settings';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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
const memorySettings: Record<string, string> = g.__memorySettings ?? (g.__memorySettings = {
  ...DEFAULT_SETTINGS,
  ...fileStoreGet<Record<string, string>>('site-settings', {}),
});

const ENV_BACKED_SETTINGS: Record<string, string> = {
  the_odds_api_key: 'THE_ODDS_API_KEY',
  sportsgameodds_api_key: 'SPORTSGAMEODDS_API_KEY',
  openai_api_key: 'OPENAI_API_KEY',
  vapid_public_key: 'VAPID_PUBLIC_KEY',
  vapid_private_key: 'VAPID_PRIVATE_KEY',
  vapid_subject: 'VAPID_SUBJECT',
  google_analytics_id: 'GOOGLE_ANALYTICS_ID',
  facebook_pixel_id: 'FACEBOOK_PIXEL_ID',
  football_data_api_key: 'FOOTBALL_DATA_API_KEY',
  turnstile_site_key: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  turnstile_secret_key: 'TURNSTILE_SECRET_KEY',
  recaptcha_site_key: 'NEXT_PUBLIC_RECAPTCHA_SITE_KEY',
  recaptcha_secret_key: 'RECAPTCHA_SECRET_KEY',
};

function fillFromEnv(settings: Record<string, string>): Record<string, string> {
  let didFill = false;
  for (const [key, envName] of Object.entries(ENV_BACKED_SETTINGS)) {
    const current = settings[key];
    if (!current || !String(current).trim()) {
      const envValue = (process.env[envName] || '').trim();
      if (envValue) {
        settings[key] = envValue;
        if (!memorySettings[key] || !String(memorySettings[key]).trim()) {
          memorySettings[key] = envValue;
          didFill = true;
        }
      }
    }
  }
  if (didFill) {
    fileStoreSet('site-settings', memorySettings);
  }
  return settings;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pool = getPool();

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

    const settings: Record<string, string> = { ...memorySettings };
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    fillFromEnv(settings);

    return NextResponse.json({ settings, source: 'database' });
  } catch (error) {
    console.error('[Admin API] Failed to get settings:', error);
    return NextResponse.json({
      settings: fillFromEnv({ ...memorySettings }),
      source: 'memory',
    });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pool = getPool();

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

  Object.assign(memorySettings, settings);
  fileStoreSet('site-settings', memorySettings);
  invalidateSiteSettingsCache();

  if (!pool) {
    return NextResponse.json({ success: true, message: 'Settings saved successfully', source: 'file' });
  }

  let dbFailures = 0;
  let lastError: unknown = null;
  for (const [key, value] of Object.entries(settings)) {
    try {
      await execute(
        `INSERT INTO site_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [key, String(value ?? '')],
      );
    } catch (err) {
      dbFailures++;
      lastError = err;
    }
  }

  if (dbFailures === 0) {
    return NextResponse.json({ success: true, message: 'Settings saved to database', source: 'database' });
  }

  console.warn(`[Admin API] settings: ${dbFailures} of ${Object.keys(settings).length} writes failed; kept memory copy. Last error:`, lastError);
  return NextResponse.json({
    success: true,
    message: 'Settings saved (database currently unreachable — kept in memory)',
    source: 'memory',
    dbFailures,
  });
}
