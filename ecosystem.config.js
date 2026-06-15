module.exports = {
  apps: [
    {
      name: 'betcheza',
      script: 'node_modules/.bin/next',
      args: 'start -H 0.0.0.0',
      cwd: '/home/admin/apps/betcheza',

      env: {
        PORT: '3001',
        NODE_ENV: 'production',
        INTERNAL_BASE_URL: 'http://localhost:3001',
      },
      env_file: '.env.local',

      // ── Restart policy ─────────────────────────────────────────────────────
      autorestart: true,
      watch: false,
      max_restarts: 20,
      // min_uptime: app must stay alive at least 20s or PM2 counts it as a
      // failed start and backs off. Prevents rapid crash-loop restarts.
      min_uptime: '20s',
      // Restart delay: 1s is fast enough for a quick recovery but avoids
      // hammering ESPN/DB on an instant retry.
      restart_delay: 1000,
      // post_start: warm the match cache after every restart so the first
      // user request is never a cold-start ESPN fetch.
      // sleep 10 — enough for Next.js to finish binding the port (listen_timeout
      // is 45s, so the process is definitely up by the time this curl fires).
      post_start: 'sleep 10 && curl -sf -H "Authorization: Bearer betcheza-cron-2024" --max-time 180 http://localhost:3001/api/warmup > /tmp/betcheza-warmup-auto.json 2>&1 || true',

      // ── Memory guard ────────────────────────────────────────────────────────
      // CRITICAL FIX: --max-old-space-size=1400 means V8 heap tops out at
      // 1400 MB, but RSS (what PM2 measures) is always 200-400 MB higher =
      // 1600-1800 MB. The old 1536M threshold was BELOW normal operating RSS,
      // so PM2 restarted the app constantly — every few minutes — causing all
      // the observed downtime. Raising to 3000M means PM2 only restarts on a
      // true memory leak, while the OS OOM-killer handles catastrophic cases.
      max_memory_restart: '3000M',

      // ── Log config ──────────────────────────────────────────────────────────
      out_file: '/root/.pm2/logs/betcheza-out.log',
      error_file: '/root/.pm2/logs/betcheza-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // ── Node.js tuning ──────────────────────────────────────────────────────
      // --max-old-space-size=1400: caps V8 heap; GC kicks in before the process
      //   bloats. Keep this — it prevents the OS OOM killer from hitting first.
      // --unhandled-rejections=warn: unhandled Promise rejections print a
      //   warning but DO NOT crash the process (default in Node 15+ is to
      //   crash). Prevents rare ESPN/DB API errors from taking the site down.
      node_args: '--max-old-space-size=1400 --unhandled-rejections=warn',

      // ── Graceful shutdown ───────────────────────────────────────────────────
      kill_timeout: 10000,
      // 45s: gives Next.js production time to compile and bind the port.
      // The old 15s value was too short — PM2 declared the process failed
      // and retried, creating a restart loop that extended downtime to 60s+.
      listen_timeout: 45000,
    },
  ],
};
