module.exports = {
  apps: [
    {
      name: 'betcheza',
      script: 'node_modules/.bin/next',
      args: 'start -H 0.0.0.0',
      cwd: '/home/admin/apps/betcheza',

      // PORT 3001 — avoids conflict with other apps on the server.
      // INTERNAL_BASE_URL must match so cron self-calls reach the right port.
      env: {
        PORT: '3001',
        NODE_ENV: 'production',
        INTERNAL_BASE_URL: 'http://localhost:3001',
      },
      env_file: '.env.local',

      // Restart policy — if the app crashes, PM2 brings it back.
      // post_start hook fires /api/warmup after every restart (including
      // auto-restarts from memory limit) so the match cache is always
      // pre-populated before users hit the site.
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '20s',
      restart_delay: 3000,
      post_start: 'sleep 30 && curl -sf -H "Authorization: Bearer betcheza-cron-2024" --max-time 180 http://localhost:3001/api/warmup > /tmp/betcheza-warmup-auto.json 2>&1 || true',

      // Memory guard — restart if RSS exceeds 1.5 GB.
      // Was 1024M, which caused frequent restarts that wiped the in-memory
      // match cache and forced cold-start API refetches on every restart.
      // Next.js production with many routes + match cache needs more headroom.
      max_memory_restart: '1536M',

      // Log config
      out_file: '/root/.pm2/logs/betcheza-out.log',
      error_file: '/root/.pm2/logs/betcheza-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Node.js tuning for Next.js production.
      // Increased heap from 768MB → 1400MB to reduce GC pressure and prevent
      // the OOM-triggered PM2 restarts that were wiping the match cache.
      node_args: '--max-old-space-size=1400',

      // Graceful shutdown — give Next.js time to drain connections
      kill_timeout: 10000,
      // 45s gives Next.js production time to bind the port on a cold start.
      // 15s was too short — PM2 would declare the process failed and retry,
      // creating a restart loop that kept the site down for 30-60 seconds.
      listen_timeout: 45000,
    },
  ],
};
