// Next.js calls this once when the server process starts (both `next dev`
// and `next start`). We use it to kick off our background cron loop for
// match-kickoff reminders and to seed env-backed API keys into the memory store.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Seed env-backed API keys + SMTP into the shared memory settings store so
  // getApiKey() and getSiteSettings() can resolve them immediately — without
  // requiring the admin to open Settings and click Save first.
  try {
    const { fileStoreGet, fileStoreSet } = await import('./lib/file-store');
    const ENV_BACKED: Record<string, string> = {
      the_odds_api_key: 'THE_ODDS_API_KEY',
      sportsgameodds_api_key: 'SPORTSGAMEODDS_API_KEY',
      openai_api_key: 'OPENAI_API_KEY',
      football_data_api_key: 'FOOTBALL_DATA_API_KEY',
      vapid_public_key: 'VAPID_PUBLIC_KEY',
      vapid_private_key: 'VAPID_PRIVATE_KEY',
      vapid_subject: 'VAPID_SUBJECT',
      google_analytics_id: 'GOOGLE_ANALYTICS_ID',
      facebook_pixel_id: 'FACEBOOK_PIXEL_ID',
    };
    const g = globalThis as { __memorySettings?: Record<string, string> };
    if (!g.__memorySettings) {
      g.__memorySettings = { ...fileStoreGet<Record<string, string>>('site-settings', {}) };
    }
    let didFill = false;
    for (const [key, envName] of Object.entries(ENV_BACKED)) {
      if (!g.__memorySettings[key] || !String(g.__memorySettings[key]).trim()) {
        const val = (process.env[envName] || '').trim();
        if (val) { g.__memorySettings[key] = val; didFill = true; }
      }
    }
    if (didFill) fileStoreSet('site-settings', g.__memorySettings);
  } catch (e) {
    console.warn('[instrumentation] env seed failed:', e);
  }

  const { startCron } = await import('./lib/cron');
  startCron();
}
