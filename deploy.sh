#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo -e "${BOLD}Betcheza Deploy — $(pwd)${NC}"

echo -e "${YELLOW}[1/5] Pulling latest changes...${NC}"
git rm -r --cached .local/state/ 2>/dev/null || true
git rm -r --cached .local/data/ 2>/dev/null || true
git stash push --include-untracked -m "auto-stash before deploy $(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
git pull origin main

echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
npm install --prefer-offline

echo -e "${YELLOW}[3/5] Building...${NC}"
npm run build

echo -e "${YELLOW}[4/5] Copying static assets to Apache web root (CSS fix)...${NC}"
# Next.js static files (CSS, JS, fonts) must be directly accessible by Apache.
# The proxy may not forward /_next/static/ reliably, so we serve them from disk.
DOMAIN_ROOT="/home/admin/domains/betcheza.co.ke/public_html"
if [ -d "$DOMAIN_ROOT" ]; then
  mkdir -p "$DOMAIN_ROOT/_next/static"
  # Remove old static files first (avoids stale hashed files accumulating)
  rm -rf "$DOMAIN_ROOT/_next/static"
  cp -r "$APP_DIR/.next/static" "$DOMAIN_ROOT/_next/static"
  echo -e "${GREEN}Static files copied to $DOMAIN_ROOT/_next/static${NC}"
  # Quick sanity check — look for at least one CSS file
  CSS_COUNT=$(find "$DOMAIN_ROOT/_next/static" -name "*.css" 2>/dev/null | wc -l)
  if [ "$CSS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}CSS check: $CSS_COUNT stylesheet(s) found — OK${NC}"
  else
    echo -e "${RED}WARNING: No CSS files found in static output — check Tailwind build${NC}"
  fi
else
  echo -e "${RED}WARNING: Apache web root not found at $DOMAIN_ROOT${NC}"
  echo -e "${RED}CSS may not load! Check your DirectAdmin domain path.${NC}"
  # Try common alternative paths
  for ALTDIR in "/var/www/html" "/home/admin/public_html" "/home/admin/www"; do
    if [ -d "$ALTDIR" ]; then
      echo -e "${YELLOW}Found possible web root at $ALTDIR — copying there instead${NC}"
      mkdir -p "$ALTDIR/_next/static"
      rm -rf "$ALTDIR/_next/static"
      cp -r "$APP_DIR/.next/static" "$ALTDIR/_next/static"
      echo -e "${GREEN}Copied to $ALTDIR/_next/static${NC}"
      break
    fi
  done
fi

echo -e "${YELLOW}[5/5] Restarting server...${NC}"
fuser -k 5001/tcp 2>/dev/null || true
sleep 1
pm2 restart betcheza --update-env 2>/dev/null || pm2 start npm --name "betcheza" -- start
pm2 save

echo -e "${GREEN}${BOLD}Deploy complete! betcheza.co.ke is live.${NC}"
pm2 list
