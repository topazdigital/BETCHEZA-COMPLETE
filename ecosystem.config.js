module.exports = {
  apps: [
    {
      name: 'betcheza',
      script: 'node_modules/.bin/next',
      args: 'start -H 0.0.0.0',
      cwd: '/home/admin/apps/betcheza',

      // Use the PORT from .env.local (3000 in production)
      env_file: '.env.local',

      // Restart policy — if the app crashes, PM2 brings it back
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,

      // Memory guard — restart if RSS exceeds 800 MB
      max_memory_restart: '800M',

      // Log config
      out_file: '/root/.pm2/logs/betcheza-out.log',
      error_file: '/root/.pm2/logs/betcheza-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Node.js tuning for Next.js production
      node_args: '--max-old-space-size=512',

      // Graceful shutdown — give Next.js time to drain connections
      kill_timeout: 10000,
      listen_timeout: 15000,
    },
  ],
};
