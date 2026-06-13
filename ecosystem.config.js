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

      // Restart policy — if the app crashes, PM2 brings it back
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,

      // Memory guard — restart if RSS exceeds 1 GB
      max_memory_restart: '1024M',

      // Log config
      out_file: '/root/.pm2/logs/betcheza-out.log',
      error_file: '/root/.pm2/logs/betcheza-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Node.js tuning for Next.js production
      node_args: '--max-old-space-size=768',

      // Graceful shutdown — give Next.js time to drain connections
      kill_timeout: 10000,
      listen_timeout: 15000,
    },
  ],
};
