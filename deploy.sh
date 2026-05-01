#!/bin/bash
set -e
cd /home/admin/apps/betcheza

echo "=========================================="
echo "  BETCHEZA DEPLOY"
echo "=========================================="

echo ""
echo "[1/5] Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main

echo ""
echo "[2/5] Installing dependencies..."
npm install --no-audit --no-fund 2>&1 | tail -5

echo ""
echo "[3/5] Building Next.js..."
npm run build 2>&1 | tail -20

echo ""
echo "[4/5] Restarting PM2 (admin user)..."
sudo -u admin -i pm2 restart betcheza --update-env

echo ""
echo "[5/5] Checking status..."
sleep 4
sudo -u admin -i pm2 list | grep betcheza
echo ""
echo "Last 10 log lines:"
sudo -u admin -i pm2 logs betcheza --lines 10 --nostream | tail -15

echo ""
echo "=========================================="
echo "  DEPLOY COMPLETE - https://betcheza.co.ke"
echo "=========================================="
