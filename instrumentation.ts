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

  // Seed SMTP env vars into the email config file store so sendMail() works
  // immediately without the admin needing to open Email Setup and click Save.
  try {
    const smtpHost = (process.env.SMTP_HOST || '').trim();
    const smtpUser = (process.env.SMTP_USERNAME || '').trim();
    if (smtpHost && smtpUser) {
      const { fileStoreGet, fileStoreSet } = await import('./lib/file-store');
      const existing = fileStoreGet<Record<string, unknown> | null>('email-config', null);
      // Only seed if no host is already stored (so admin overrides aren't clobbered)
      if (!existing || !existing.host) {
        const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
        const smtpSecure = (process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
        fileStoreSet('email-config', {
          enabled: true,
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          username: smtpUser,
          password: (process.env.SMTP_PASSWORD || '').trim(),
          fromEmail: (process.env.SMTP_FROM_EMAIL || smtpUser).trim(),
          fromName: (process.env.SMTP_FROM_NAME || 'Betcheza').trim(),
          replyTo: (process.env.SMTP_REPLY_TO || '').trim(),
        });
        console.log('[instrumentation] SMTP config seeded from environment variables');
      }
    }
  } catch (e) {
    console.warn('[instrumentation] SMTP seed failed:', e);
  }

  const { startCron } = await import('./lib/cron');
  startCron();

  // Pre-warm the matches cache immediately on startup so the very first
  // user request is served from cache instead of waiting for external APIs.
  // Fire-and-forget — never blocks the server from becoming ready.
  setTimeout(async () => {
    try {
      const { getAllMatches } = await import('./lib/api/unified-sports-api');
      await getAllMatches();
      console.log('[instrumentation] matches cache warmed on startup');
    } catch (e) {
      console.warn('[instrumentation] matches cache warm-up failed:', e);
    }
  }, 500);
}
