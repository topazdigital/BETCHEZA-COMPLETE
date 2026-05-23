#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# ── Step 1: Pull + re-exec ────────────────────────────────────────────────────
# After git pull we re-exec so ALL remaining steps run with the freshly-pulled
# version of this script, not the old version bash already buffered.
if [ -z "$BETCHEZA_DEPLOY_REEXECED" ]; then
  echo -e "${BOLD}Betcheza Deploy — $(pwd)${NC}"
  echo -e "${YELLOW}[1/5] Pulling latest changes...${NC}"
  git rm -r --cached .local/state/ 2>/dev/null || true
  git rm -r --cached .local/data/ 2>/dev/null || true
  git stash push --include-untracked -m "auto-stash before deploy $(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
  git pull origin main
  export BETCHEZA_DEPLOY_REEXECED=1
  exec bash "$APP_DIR/deploy.sh" "$@"
fi

echo -e "${BOLD}Betcheza Deploy — $(pwd) [running updated deploy.sh]${NC}"

# ── Step 1b: Read config ──────────────────────────────────────────────────────
echo -e "${YELLOW}[1b/5] Reading configuration...${NC}"
ENV_FILE="$APP_DIR/.env.local"

# Ensure GOOGLE_SITE_VERIFICATION is present
if ! grep -q "GOOGLE_SITE_VERIFICATION" "$ENV_FILE" 2>/dev/null; then
  echo "GOOGLE_SITE_VERIFICATION=c6CwjlMj8vH8Pf7zQyFqp_BpbK-d1URyeKUso4QSJPs" >> "$ENV_FILE"
  echo -e "${GREEN}GOOGLE_SITE_VERIFICATION written to .env.local${NC}"
else
  echo -e "${GREEN}GOOGLE_SITE_VERIFICATION already in .env.local — OK${NC}"
fi

# ── App port: ecosystem.config.js > .env.local > 3001 ────────────────────────
ECO_PORT=$(node -e "try{const c=require('./ecosystem.config.js');const e=c.apps[0].env;console.log(e&&e.PORT||'');}catch(e){}" 2>/dev/null)
if [ -n "$ECO_PORT" ]; then
  APP_PORT="$ECO_PORT"
  echo -e "${GREEN}App port: $APP_PORT (from ecosystem.config.js)${NC}"
else
  APP_PORT=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]')
  APP_PORT="${APP_PORT:-3001}"
  echo -e "${GREEN}App port: $APP_PORT (from .env.local)${NC}"
fi

# ── Apache web root: DEPLOY_WEB_ROOT in .env.local, or auto-detect ───────────
CONFIGURED_ROOT=$(grep -E '^DEPLOY_WEB_ROOT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]')

if [ -n "$CONFIGURED_ROOT" ]; then
  DOMAIN_ROOT="$CONFIGURED_ROOT"
  echo -e "${GREEN}Web root: $DOMAIN_ROOT (from DEPLOY_WEB_ROOT in .env.local)${NC}"
else
  # Auto-detect: try common DirectAdmin / cPanel / generic paths
  for CANDIDATE in \
    "/home/admin/domains/betcheza.co.ke/public_html" \
    "/home/admin/public_html" \
    "/home/admin/www" \
    "/var/www/html" \
    "/var/www/betcheza.co.ke" \
    "/home/admin/apps/betcheza/public"; do
    if [ -d "$CANDIDATE" ]; then
      DOMAIN_ROOT="$CANDIDATE"
      echo -e "${GREEN}Web root: $DOMAIN_ROOT (auto-detected)${NC}"
      break
    fi
  done
fi

if [ -z "$DOMAIN_ROOT" ]; then
  echo -e "${RED}⚠ Could not find Apache web root. Static files will NOT be copied.${NC}"
  echo -e "${RED}  Add DEPLOY_WEB_ROOT=/path/to/apache/docroot to your .env.local to fix this.${NC}"
fi

# ── Apache proxy port check ───────────────────────────────────────────────────
# Find what port Apache's VirtualHost is currently configured to proxy to
APACHE_PORT=$(grep -rh "ProxyPass\|127\.0\.0\.1" /etc/httpd/conf.d/ 2>/dev/null \
  | grep -o "127\.0\.0\.1:[0-9]*" | head -1 | cut -d: -f2)
if [ -n "$APACHE_PORT" ] && [ "$APACHE_PORT" != "$APP_PORT" ]; then
  echo -e "${RED}⚠ WARNING: Apache is configured to proxy to port $APACHE_PORT but the app"
  echo -e "  will start on port $APP_PORT. The site will NOT work until these match.${NC}"
  echo -e "${YELLOW}  Fix option A: Update ecosystem.config.js → PORT: '$APACHE_PORT'${NC}"
  echo -e "${YELLOW}  Fix option B: Update Apache VirtualHost → ProxyPass port to $APP_PORT${NC}"
elif [ -n "$APACHE_PORT" ]; then
  echo -e "${GREEN}Apache proxy port matches app port ($APP_PORT) — OK${NC}"
fi

# ── Step 2: Install dependencies ──────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
npm install --prefer-offline

# ── Step 3: Build ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Building...${NC}"
npm run build

# ── Step 4: Copy static assets + write .htaccess (if web root found) ─────────
echo -e "${YELLOW}[4/5] Copying static assets + writing .htaccess...${NC}"
if [ -n "$DOMAIN_ROOT" ] && [ -d "$DOMAIN_ROOT" ]; then
  mkdir -p "$DOMAIN_ROOT/_next/static"
  rm -rf "$DOMAIN_ROOT/_next/static"
  cp -r "$APP_DIR/.next/static" "$DOMAIN_ROOT/_next/static"
  echo -e "${GREEN}Static files copied to $DOMAIN_ROOT/_next/static${NC}"

  CSS_COUNT=$(find "$DOMAIN_ROOT/_next/static" -name "*.css" 2>/dev/null | wc -l)
  [ "$CSS_COUNT" -gt 0 ] && echo -e "${GREEN}CSS check: $CSS_COUNT stylesheet(s) — OK${NC}" \
    || echo -e "${RED}WARNING: No CSS files found${NC}"

  cat > "$DOMAIN_ROOT/.htaccess" << HTACCESS
# ── Brotli compression ────────────────────────────────────────────────────────
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/css \
    application/javascript application/json image/svg+xml font/woff2
</IfModule>

# ── Gzip fallback ─────────────────────────────────────────────────────────────
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css \
    application/javascript application/json image/svg+xml font/woff2
  SetEnvIfNoCase Request_URI \.(?:gif|jpe?g|png|webp|avif|gz|zip|br)$ no-gzip dont-vary
  Header append Vary Accept-Encoding
</IfModule>

# ── Long-term caching for hashed assets ──────────────────────────────────────
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css                  "access plus 1 year"
  ExpiresByType application/javascript    "access plus 1 year"
  ExpiresByType image/png                 "access plus 1 year"
  ExpiresByType image/jpeg                "access plus 1 year"
  ExpiresByType image/webp                "access plus 1 year"
  ExpiresByType image/avif                "access plus 1 year"
  ExpiresByType image/svg+xml             "access plus 1 year"
  ExpiresByType font/woff2                "access plus 1 year"
  ExpiresByType font/woff                 "access plus 1 year"
</IfModule>

# ── Security headers ──────────────────────────────────────────────────────────
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# ── Proxy to Next.js (only used if Apache AllowOverride lets .htaccess proxy) ─
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_URI} ^/_next/static/ [NC]
  RewriteRule ^ - [L]
  RewriteCond %{REQUEST_FILENAME} -f
  RewriteRule ^ - [L]
  RewriteRule ^(.*)\$ http://127.0.0.1:${APP_PORT}/\$1 [P,L]
</IfModule>
HTACCESS

  echo -e "${GREEN}.htaccess written → proxying to port ${APP_PORT}${NC}"

  cat > "$DOMAIN_ROOT/_next/static/.htaccess" << 'STATIC_HTA'
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
STATIC_HTA
else
  echo -e "${YELLOW}Skipping static copy (no web root found — Apache may use VirtualHost ProxyPass instead)${NC}"
fi

# ── Step 5: Clean PM2 restart ─────────────────────────────────────────────────
echo -e "${YELLOW}[5/5] Restarting server...${NC}"

# Stop + delete ALL betcheza instances (handles duplicates cleanly)
pm2 stop betcheza 2>/dev/null || true
sleep 2
pm2 delete betcheza 2>/dev/null || true
sleep 1

# Force-free the port
fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
lsof -ti:"${APP_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

# Start single clean instance
if [ -f "$APP_DIR/ecosystem.config.js" ]; then
  pm2 start "$APP_DIR/ecosystem.config.js"
else
  PORT="$APP_PORT" pm2 start npm --name "betcheza" -- start
fi
pm2 save

# ── Step 6: Health check ──────────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Verifying app is healthy on port ${APP_PORT}...${NC}"
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
  echo -e "${YELLOW}  Waiting... (${WAITED}s / ${MAX_WAIT}s, HTTP ${HTTP_CODE})${NC}"
  sleep 5
  WAITED=$((WAITED + 5))
done

if [ "$SUCCESS" = false ]; then
  echo -e "${RED}✗ App did NOT come up within ${MAX_WAIT}s on port ${APP_PORT}!${NC}"
  pm2 logs betcheza --lines 30 --nostream 2>/dev/null || true
  exit 1
fi

echo -e "${GREEN}${BOLD}Deploy complete! betcheza.co.ke is live.${NC}"
pm2 list
