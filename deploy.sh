#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

# Always run from the app directory (works whether you call ./deploy.sh or bash deploy.sh from anywhere)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo -e "${BOLD}Betcheza Deploy — $(pwd)${NC}"

echo -e "${YELLOW}[1/4] Pulling latest changes...${NC}"
# Stash ALL local changes (auto-tips.json, package-lock.json, etc.) so git pull never blocks
git stash --include-untracked 2>/dev/null || true
git pull origin main

echo -e "${YELLOW}[2/4] Installing dependencies...${NC}"
npm install --prefer-offline

echo -e "${YELLOW}[3/4] Building...${NC}"
npm run build

echo -e "${YELLOW}[4/4] Restarting server...${NC}"
fuser -k 5001/tcp 2>/dev/null || true
sleep 1
pm2 restart betcheza --update-env 2>/dev/null || pm2 start npm --name "betcheza" -- start
pm2 save

echo -e "${GREEN}${BOLD}Deploy complete! betcheza.co.ke is live.${NC}"
pm2 list
