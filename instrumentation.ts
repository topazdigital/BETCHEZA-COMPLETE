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
    // Always inject the new logo — overrides any stale DB/file value so the
    // Betcheza crown-B logo is shown in header, dark mode and footer.
    g.__memorySettings['logo_url'] = '/betcheza-logo.png';
    g.__memorySettings['logo_dark_url'] = '/betcheza-logo.png';
    g.__memorySettings['footer_logo_url'] = '/betcheza-logo.png';
    didFill = true;
    if (didFill) fileStoreSet('site-settings', g.__memorySettings);
  } catch (e) {
    console.warn('[instrumentation] env seed failed:', e);
  }

  // Seed PayHero credentials from env vars into the file store so M-Pesa
  // payments work immediately without the admin needing to re-enter credentials.
  try {
    const phToken = (process.env.PAYHERO_BASIC_TOKEN || '').trim();
    const phAccountId = (process.env.PAYHERO_ACCOUNT_ID || '').trim();
    if (phToken && phAccountId) {
      const { fileStoreGet, fileStoreSet } = await import('./lib/file-store');
      type GW = { id: string; enabled: boolean; credentials: Record<string, string> };
      const gateways = fileStoreGet<GW[] | null>('payment-gateways', null);
      const gw = gateways?.find((g: GW) => g.id === 'payhero');
      // Only seed if credentials are empty — don't overwrite admin-saved values
      if (!gw?.credentials?.basic_token || gw.credentials.basic_token.length < 10) {
        const { DEFAULT_GATEWAYS } = await import('./app/api/admin/payment-gateways/route').catch(() => ({ DEFAULT_GATEWAYS: null }));
        const base = (DEFAULT_GATEWAYS || gateways || []) as GW[];
        const updated = base.map((g: GW) =>
          g.id === 'payhero'
            ? { ...g, enabled: true, credentials: { ...g.credentials, basic_token: phToken, account_id: phAccountId } }
            : g
        );
        const g2 = globalThis as { __gwStore?: GW[] };
        g2.__gwStore = updated;
        fileStoreSet('payment-gateways', updated);
        console.log('[instrumentation] PayHero credentials seeded from environment variables');
      }
    }
  } catch (e) {
    console.warn('[instrumentation] PayHero seed failed:', e);
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

  // ── DB migrations: run on every server start ────────────────────────────
  // This ensures tables/columns exist on the production server the moment
  // the app restarts after a GitHub deploy — no manual phpMyAdmin needed.
  setTimeout(async () => {
    try {
      const { query, execute, getPool } = await import('./lib/db');
      if (!getPool()) return; // no DB configured — skip silently

      // 1. community_rooms table
      await query(`
        CREATE TABLE IF NOT EXISTS community_rooms (
          id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name        VARCHAR(80) NOT NULL,
          slug        VARCHAR(80) NOT NULL,
          description TEXT DEFAULT NULL,
          icon        VARCHAR(10) DEFAULT NULL,
          color       VARCHAR(80) DEFAULT NULL,
          post_count  INT NOT NULL DEFAULT 0,
          sort_order  INT NOT NULL DEFAULT 0,
          is_active   TINYINT(1) NOT NULL DEFAULT 1,
          created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_room_slug (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 2. Seed default rooms (INSERT IGNORE = skip if already present)
      await query(`
        INSERT IGNORE INTO community_rooms (name, slug, description, icon, color, sort_order) VALUES
          ('General',       'general',    'General betting chat',                 '💬', 'bg-blue-500/15 text-blue-500 border-blue-500/30',         1),
          ('Football Tips', 'football',   'Football predictions & analysis',      '⚽', 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', 2),
          ('Value Bets',    'value-bets', 'High value picks & odds hunting',      '🎯', 'bg-amber-500/15 text-amber-600 border-amber-500/30',      3),
          ('Live Chat',     'live-chat',  'Chat during live matches',             '🔴', 'bg-rose-500/15 text-rose-500 border-rose-500/30',         4),
          ('Analysis',      'analysis',   'Deep dives, stats and breakdowns',     '📊', 'bg-purple-500/15 text-purple-600 border-purple-500/30',   5),
          ('Basketball',    'basketball', 'NBA, EuroLeague & more',               '🏀', 'bg-orange-500/15 text-orange-600 border-orange-500/30',   6),
          ('Premium Picks', 'premium',    'Top tipster premium predictions',      '👑', 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',   7)
      `);

      // 3. Add room_id column to feed_posts if not already there
      await query(`ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS room_id INT DEFAULT NULL`).catch(() => {});
      await query(`ALTER TABLE feed_posts ADD INDEX IF NOT EXISTS idx_fp_room_id (room_id)`).catch(() => {});

      // Widen teams.short_name to avoid "Data too long" errors from ESPN abbreviations
      await query(`ALTER TABLE teams MODIFY COLUMN short_name VARCHAR(100) DEFAULT NULL`).catch(() => {});
      // Widen api_id columns to avoid "Data too long" errors from long ESPN event IDs
      await query(`ALTER TABLE teams MODIFY COLUMN api_id VARCHAR(255) DEFAULT NULL`).catch(() => {});
      await query(`ALTER TABLE leagues MODIFY COLUMN api_id VARCHAR(255) DEFAULT NULL`).catch(() => {});

      console.log('[instrumentation] DB migrations applied (community_rooms + room_id)');

      // 4b. Backfill room_id on existing fake-tipster posts (user_id >= 1000)
      //     that were created before rooms existed. Match rules:
      //       - basketball sport mention  → basketball room
      //       - live match posts          → live-chat room (no easy way to detect; skip)
      //       - has pick + match_title    → football room
      //       - has match_title, no pick  → analysis room
      //       - value/odds keywords       → value-bets room
      //       - analysis keywords         → analysis room
      //       - everything else           → general room
      const roomRows = await query<{ id: number; slug: string }>(
        `SELECT id, slug FROM community_rooms WHERE is_active = 1`, []
      ).catch(() => ({ rows: [] as Array<{ id: number; slug: string }> }));
      const roomMap = new Map(roomRows.rows.map(r => [r.slug, r.id]));

      if (roomMap.size > 0) {
        const bball  = roomMap.get('basketball');
        const ftball = roomMap.get('football');
        const val    = roomMap.get('value-bets');
        const anal   = roomMap.get('analysis');
        const gen    = roomMap.get('general');

        if (bball)  await query(`UPDATE feed_posts SET room_id = ? WHERE room_id IS NULL AND user_id >= 1000 AND (LOWER(content) LIKE '%nba%' OR LOWER(content) LIKE '%basketball%' OR LOWER(content) LIKE '%euroleague%')`, [bball]).catch(() => {});
        if (ftball) await query(`UPDATE feed_posts SET room_id = ? WHERE room_id IS NULL AND user_id >= 1000 AND match_title IS NOT NULL AND pick IS NOT NULL`, [ftball]).catch(() => {});
        if (anal)   await query(`UPDATE feed_posts SET room_id = ? WHERE room_id IS NULL AND user_id >= 1000 AND match_title IS NOT NULL AND pick IS NULL`, [anal]).catch(() => {});
        if (val)    await query(`UPDATE feed_posts SET room_id = ? WHERE room_id IS NULL AND user_id >= 1000 AND match_title IS NULL AND (LOWER(content) LIKE '%value%' OR LOWER(content) LIKE '%odds%' OR LOWER(content) LIKE '%line%' OR LOWER(content) LIKE '%market%')`, [val]).catch(() => {});
        if (anal)   await query(`UPDATE feed_posts SET room_id = ? WHERE room_id IS NULL AND user_id >= 1000 AND match_title IS NULL AND (LOWER(content) LIKE '%xg%' OR LOWER(content) LIKE '%h2h%' OR LOWER(content) LIKE '%stats%' OR LOWER(content) LIKE '%analysis%' OR LOWER(content) LIKE '%research%')`, [anal]).catch(() => {});
        if (gen)    await query(`UPDATE feed_posts SET room_id = ? WHERE room_id IS NULL AND user_id >= 1000`, [gen]).catch(() => {});
        // Sync post_count in community_rooms to match actual rows
        await query(`UPDATE community_rooms cr SET post_count = (SELECT COUNT(*) FROM feed_posts fp WHERE fp.room_id = cr.id)`).catch(() => {});
        console.log('[instrumentation] Backfilled room_id on existing fake-tipster posts');
      }

      // 4. Fix known data corrections that were only applied in code (MANUAL_DAY_OVERRIDES)
      //    These rows exist in DB with wrong results; correct them once here.
      const corrections: Array<{ date: string; result: 'win' | 'loss'; picksResult: 'win' | 'loss' }> = [
        // Week 18 Day 4 (Thu 21 May 2026): Both corners picks were wins
        // Inter Kashi 4 + East Bengal 10 = 14 corners → Over 9.5 ✓
        // Jamshedpur 11 + Odisha 1 = 12 corners → Over 9.5 ✓
        { date: '2026-05-21', result: 'win', picksResult: 'win' },
      ];

      for (const fix of corrections) {
        const rows = await query<{ id: number; picks: string | null; result: string | null }>(
          `SELECT id, picks, result FROM daily_strategy WHERE date = ? LIMIT 1`,
          [fix.date],
        );
        if (!rows.rows.length) continue;
        const row = rows.rows[0];
        if (row.result === fix.result) continue; // already correct

        let picks: Array<{ result?: string }> = [];
        try { picks = JSON.parse(row.picks || '[]'); } catch { picks = []; }
        const updatedPicks = picks.map(p => ({ ...p, result: fix.picksResult }));

        await execute(
          `UPDATE daily_strategy SET result = ?, picks = ?, status = 'completed', settled_at = NOW() WHERE id = ?`,
          [fix.result, JSON.stringify(updatedPicks), row.id],
        );
        console.log(`[instrumentation] Fixed daily_strategy result for ${fix.date}: ${row.result} → ${fix.result}`);
      }
    } catch (e) {
      console.warn('[instrumentation] DB migration error:', e);
    }
  }, 2000); // 2s delay — let the pool fully initialise first

  // Seed the World Cup 2026 competition (no-op if already exists)
  setTimeout(async () => {
    try {
      const { seedWorldCupCompetition } = await import('./lib/competitions-store');
      await seedWorldCupCompetition();
    } catch (e) {
      console.warn('[instrumentation] World Cup competition seed failed:', e);
    }
  }, 3000);

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
