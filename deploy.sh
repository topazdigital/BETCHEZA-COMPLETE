#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
echo -e "${BOLD}Betcheza Deploy${NC}"
echo -e "${YELLOW}[1/4] Pulling latest changes...${NC}"
git pull origin main
echo -e "${YELLOW}[2/4] Installing dependencies...${NC}"
npm install --prefer-offline
echo -e "${YELLOW}[3/4] Building...${NC}"
npm run build
echo -e "${YELLOW}[4/4] Restarting server...${NC}"
fuser -k 5001/tcp 2>/dev/null || true
sleep 1
pm2 restart betcheza 2>/dev/null || pm2 start npm --name "betcheza" -- start
pm2 save
echo -e "${GREEN}${BOLD}Deploy complete! betcheza.co.ke is live.${NC}"
pm2 list
