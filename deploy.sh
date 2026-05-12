#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo -e "${BOLD}Betcheza Deploy — $(pwd)${NC}"

echo -e "${YELLOW}[1/4] Pulling latest changes...${NC}"
# Stop tracking runtime-generated files that should never block a pull.
# Safe to run every time — a no-op once already untracked.
git rm -r --cached .local/state/ 2>/dev/null || true
git rm -r --cached .local/data/ 2>/dev/null || true

# Stash any remaining local modifications (package-lock changes, etc.)
git stash push --include-untracked -m "auto-stash before deploy $(date +%Y%m%d-%H%M%S)" 2>/dev/null || true

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
