#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# ── Step 1: Pull latest changes ───────────────────────────────────────────────
# IMPORTANT: After git pull this script re-execs itself so the REST of the
# deploy always runs with the newest version of deploy.sh, not the old one
# that bash buffered at startup.
if [ -z "$BETCHEZA_DEPLOY_REEXECED" ]; then
  echo -e "${BOLD}Betcheza Deploy — $(pwd)${NC}"
  echo -e "${YELLOW}[1/5] Pulling latest changes...${NC}"
  git rm -r --cached .local/state/ 2>/dev/null || true
  git rm -r --cached .local/data/ 2>/dev/null || true
  git stash push --include-untracked -m "auto-stash before deploy $(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
  git pull origin main
  # Re-exec with the freshly-pulled script so all remaining steps use new code
  export BETCHEZA_DEPLOY_REEXECED=1
  exec bash "$APP_DIR/deploy.sh" "$@"
fi

# ── From here we are running the pulled version of deploy.sh ─────────────────
echo -e "${BOLD}Betcheza Deploy — $(pwd) [using updated deploy.sh]${NC}"

# ── Step 1b: Ensure runtime env vars ─────────────────────────────────────────
echo -e "${YELLOW}[1b/5] Ensuring runtime env vars are set...${NC}"
ENV_FILE="$APP_DIR/.env.local"

if ! grep -q "GOOGLE_SITE_VERIFICATION" "$ENV_FILE" 2>/dev/null; then
  echo "GOOGLE_SITE_VERIFICATION=c6CwjlMj8vH8Pf7zQyFqp_BpbK-d1URyeKUso4QSJPs" >> "$ENV_FILE"
  echo -e "${GREEN}GOOGLE_SITE_VERIFICATION written to .env.local${NC}"
else
  echo -e "${GREEN}GOOGLE_SITE_VERIFICATION already in .env.local — OK${NC}"
fi

# Port: ecosystem.config.js wins (avoids conflicts), then .env.local, then 3001
ECO_PORT=$(node -e "try{const c=require('./ecosystem.config.js');const e=c.apps[0].env;console.log(e&&e.PORT||'');}catch(e){}" 2>/dev/null)
if [ -n "$ECO_PORT" ]; then
  APP_PORT="$ECO_PORT"
  echo -e "${GREEN}App port: $APP_PORT (from ecosystem.config.js)${NC}"
else
  APP_PORT=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]')
  APP_PORT="${APP_PORT:-3001}"
  echo -e "${GREEN}App port: $APP_PORT (from .env.local)${NC}"
fi

# ── Step 2: Install dependencies ──────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
npm install --prefer-offline

# ── Step 3: Build ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Building...${NC}"
npm run build

# ── Step 4: Copy static assets + write .htaccess ─────────────────────────────
echo -e "${YELLOW}[4/5] Copying static assets to Apache web root + configuring compression...${NC}"
DOMAIN_ROOT="/home/admin/domains/betcheza.co.ke/public_html"
if [ -d "$DOMAIN_ROOT" ]; then
  mkdir -p "$DOMAIN_ROOT/_next/static"
  rm -rf "$DOMAIN_ROOT/_next/static"
  cp -r "$APP_DIR/.next/static" "$DOMAIN_ROOT/_next/static"
  echo -e "${GREEN}Static files copied to $DOMAIN_ROOT/_next/static${NC}"

  CSS_COUNT=$(find "$DOMAIN_ROOT/_next/static" -name "*.css" 2>/dev/null | wc -l)
  if [ "$CSS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}CSS check: $CSS_COUNT stylesheet(s) found — OK${NC}"
  else
    echo -e "${RED}WARNING: No CSS files found in static output — check Tailwind build${NC}"
  fi

  cat > "$DOMAIN_ROOT/.htaccess" << HTACCESS
# ── Brotli compression (Apache mod_brotli — preferred over gzip) ──────────────
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS \
    text/html text/plain text/xml text/css text/javascript \
    application/javascript application/x-javascript application/json \
    application/xml application/rss+xml application/atom+xml \
    image/svg+xml font/ttf font/otf font/woff font/woff2 \
    application/font-woff application/font-woff2
  BrotliFilterNote Input brotli_in
  BrotliFilterNote Output brotli_out
  BrotliFilterNote Ratio brotli_ratio
</IfModule>

# ── Gzip compression fallback (mod_deflate) ───────────────────────────────────
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE \
    text/html text/plain text/xml text/css text/javascript \
    application/javascript application/x-javascript application/json \
    application/xml application/rss+xml application/atom+xml \
    image/svg+xml font/ttf font/otf font/woff font/woff2 \
    application/font-woff application/font-woff2
  SetEnvIfNoCase Request_URI \.(?:gif|jpe?g|png|webp|avif|gz|zip|br)$ no-gzip dont-vary
  Header append Vary Accept-Encoding
</IfModule>

# ── Browser caching for Next.js hashed static assets ─────────────────────────
<IfModule mod_expires.c>
  ExpiresActive On
  <FilesMatch "\._next\/static\/">
    ExpiresDefault "access plus 1 year"
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  ExpiresByType text/css                    "access plus 1 year"
  ExpiresByType application/javascript      "access plus 1 year"
  ExpiresByType application/x-javascript   "access plus 1 year"
  ExpiresByType image/png                   "access plus 1 year"
  ExpiresByType image/jpg                   "access plus 1 year"
  ExpiresByType image/jpeg                  "access plus 1 year"
  ExpiresByType image/webp                  "access plus 1 year"
  ExpiresByType image/avif                  "access plus 1 year"
  ExpiresByType image/svg+xml               "access plus 1 year"
  ExpiresByType image/x-icon               "access plus 1 year"
  ExpiresByType font/woff2                  "access plus 1 year"
  ExpiresByType font/woff                   "access plus 1 year"
  ExpiresByType application/font-woff2      "access plus 1 year"
</IfModule>

# ── Security headers ──────────────────────────────────────────────────────────
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Link "<//>; rel=dns-prefetch, <//a.espncdn.com>; rel=preconnect, <//media.api-sports.io>; rel=preconnect, <//resources.premierleague.com>; rel=preconnect"
</IfModule>

# ── Proxy all non-static requests to the Next.js server ──────────────────────
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_URI} ^/_next/static/ [NC]
  RewriteRule ^ - [L]
  RewriteCond %{REQUEST_FILENAME} -f
  RewriteRule ^ - [L]
  RewriteRule ^(.*)\$ http://127.0.0.1:${APP_PORT}/\$1 [P,L]
</IfModule>
HTACCESS

  echo -e "${GREEN}.htaccess written — proxying to port ${APP_PORT}${NC}"

  cat > "$DOMAIN_ROOT/_next/static/.htaccess" << 'STATIC_HTA'
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
STATIC_HTA

else
  echo -e "${RED}WARNING: Apache web root not found at $DOMAIN_ROOT${NC}"
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

# ── Step 5: Clean start — delete all betcheza instances, start fresh ──────────
echo -e "${YELLOW}[5/5] Restarting server...${NC}"

# Stop and delete ALL existing betcheza PM2 instances (handles duplicates)
pm2 stop betcheza 2>/dev/null || true
sleep 2
pm2 delete betcheza 2>/dev/null || true
sleep 1

# Force-kill anything still holding the port
fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
lsof -ti:"${APP_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

# Start from ecosystem config (single clean instance)
if [ -f "$APP_DIR/ecosystem.config.js" ]; then
  pm2 start "$APP_DIR/ecosystem.config.js"
else
  PORT="$APP_PORT" pm2 start npm --name "betcheza" -- start
fi
pm2 save

# ── Step 6: Health check ──────────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Verifying app is healthy...${NC}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"
MAX_WAIT=90
WAITED=0
SUCCESS=false
while [ $WAITED -lt $MAX_WAIT ]; do
  HTTP_CODE=$(curl -s -o /tmp/betcheza_health.json -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ]; then
    DB_STATUS=$(grep -o '"db":"[^"]*"' /tmp/betcheza_health.json 2>/dev/null | cut -d'"' -f4)
    echo -e "${GREEN}✓ App is UP on port ${APP_PORT} (db: ${DB_STATUS:-unknown})${NC}"
    SUCCESS=true
    break
  fi
  echo -e "${YELLOW}  Waiting for app to start... (${WAITED}s / ${MAX_WAIT}s, HTTP ${HTTP_CODE})${NC}"
  sleep 5
  WAITED=$((WAITED + 5))
done

if [ "$SUCCESS" = false ]; then
  echo -e "${RED}✗ App did NOT come up within ${MAX_WAIT}s on port ${APP_PORT}!${NC}"
  echo -e "${RED}  Check: pm2 logs betcheza --lines 50${NC}"
  pm2 logs betcheza --lines 30 --nostream 2>/dev/null || true
  exit 1
fi

echo -e "${GREEN}${BOLD}Deploy complete! betcheza.co.ke is live.${NC}"
pm2 list
