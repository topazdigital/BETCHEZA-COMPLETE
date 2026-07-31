#!/bin/bash
# Run this on your live server after git pull to restart the app cleanly.
# Usage: cd /home/admin/apps/betcheza && bash restart-production.sh

set -e
APP_DIR="/home/admin/apps/betcheza"
cd "$APP_DIR"

echo "=== Betcheza Production Restart ==="
echo "[1/4] Installing dependencies..."
npm install --omit=dev --legacy-peer-deps

echo "[2/4] Building Next.js..."
NODE_OPTIONS='--max-old-space-size=1024' npm run build

echo "[3/4] Reloading PM2 (zero-downtime)..."
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js

echo "[4/4] Saving PM2 process list..."
pm2 save

echo ""
echo "=== Done. App is live at http://localhost:3001 ==="
pm2 status
