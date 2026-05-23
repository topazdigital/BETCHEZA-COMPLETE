#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# ── Step 1: Pull + re-exec ────────────────────────────────────────────────────
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

if ! grep -q "GOOGLE_SITE_VERIFICATION" "$ENV_FILE" 2>/dev/null; then
  echo "GOOGLE_SITE_VERIFICATION=c6CwjlMj8vH8Pf7zQyFqp_BpbK-d1URyeKUso4QSJPs" >> "$ENV_FILE"
  echo -e "${GREEN}GOOGLE_SITE_VERIFICATION written to .env.local${NC}"
else
  echo -e "${GREEN}GOOGLE_SITE_VERIFICATION already in .env.local — OK${NC}"
fi

# ── App port ──────────────────────────────────────────────────────────────────
ECO_PORT=$(node -e "try{const c=require('./ecosystem.config.js');const e=c.apps[0].env;console.log(e&&e.PORT||'');}catch(e){}" 2>/dev/null)
if [ -n "$ECO_PORT" ]; then
  APP_PORT="$ECO_PORT"
  echo -e "${GREEN}App port: $APP_PORT (from ecosystem.config.js)${NC}"
else
  APP_PORT=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]')
  APP_PORT="${APP_PORT:-3001}"
  echo -e "${GREEN}App port: $APP_PORT (from .env.local)${NC}"
fi

DOMAIN="betcheza.co.ke"

# ── Apache web root ───────────────────────────────────────────────────────────
CONFIGURED_ROOT=$(grep -E '^DEPLOY_WEB_ROOT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]')
if [ -n "$CONFIGURED_ROOT" ]; then
  DOMAIN_ROOT="$CONFIGURED_ROOT"
  echo -e "${GREEN}Web root: $DOMAIN_ROOT (from DEPLOY_WEB_ROOT)${NC}"
else
  for CANDIDATE in \
    "/home/admin/domains/$DOMAIN/public_html" \
    "/home/admin/public_html" \
    "/home/admin/www" \
    "/var/www/html" \
    "/var/www/$DOMAIN"; do
    if [ -d "$CANDIDATE" ]; then
      DOMAIN_ROOT="$CANDIDATE"
      echo -e "${GREEN}Web root: $DOMAIN_ROOT (auto-detected)${NC}"
      break
    fi
  done
fi

if [ -z "$DOMAIN_ROOT" ]; then
  echo -e "${RED}⚠ Could not detect Apache web root — add DEPLOY_WEB_ROOT= to .env.local${NC}"
fi

# ── Step 2: Install dependencies ──────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
npm install --prefer-offline

# ── Step 3: Build ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Building...${NC}"
npm run build

# ── Step 4: Apache proxy config + static assets ───────────────────────────────
echo -e "${YELLOW}[4/5] Configuring Apache proxy + copying static assets...${NC}"

# ── 4a: Write DirectAdmin userdata ProxyPass config (the RIGHT way on DA) ─────
# DirectAdmin reads per-domain custom Apache config from userdata dirs.
# Writing here means ProxyPass survives DirectAdmin config rebuilds.
DA_PROXY_WRITTEN=false
for DA_USERDATA in \
  "/etc/httpd/conf/userdata/std/2_4/admin/$DOMAIN" \
  "/etc/httpd/conf/userdata/std/2/admin/$DOMAIN" \
  "/etc/httpd/conf/userdata/std/2_4/admin/${DOMAIN}.conf" \
  "/etc/httpd/conf/userdata"; do
  # Only try directories that exist (or parent exists for 2_4 path)
  PARENT=$(dirname "$DA_USERDATA")
  if [ -d "$PARENT" ] && [ "$(basename "$PARENT")" != "userdata" ]; then
    mkdir -p "$DA_USERDATA"
    cat > "$DA_USERDATA/nodejsproxy.conf" << PROXY
# Betcheza — reverse proxy to Node.js (written by deploy.sh, do not edit manually)
ProxyPreserveHost On
ProxyPass        /_next/static/ !
ProxyPass        / http://127.0.0.1:${APP_PORT}/
ProxyPassReverse / http://127.0.0.1:${APP_PORT}/
PROXY
    echo -e "${GREEN}DirectAdmin proxy config written to $DA_USERDATA/nodejsproxy.conf${NC}"
    DA_PROXY_WRITTEN=true
    break
  fi
done

if [ "$DA_PROXY_WRITTEN" = false ]; then
  echo -e "${YELLOW}DirectAdmin userdata dir not found — relying on .htaccess for proxying${NC}"
fi

# ── 4b: Copy static files + write .htaccess (compression, caching, fallback proxy) ──
if [ -n "$DOMAIN_ROOT" ] && [ -d "$DOMAIN_ROOT" ]; then
  mkdir -p "$DOMAIN_ROOT/_next/static"
  rm -rf "$DOMAIN_ROOT/_next/static"
  cp -r "$APP_DIR/.next/static" "$DOMAIN_ROOT/_next/static"
  CSS_COUNT=$(find "$DOMAIN_ROOT/_next/static" -name "*.css" 2>/dev/null | wc -l)
  echo -e "${GREEN}Static files copied ($CSS_COUNT CSS files)${NC}"

  cat > "$DOMAIN_ROOT/.htaccess" << HTACCESS
# ── Compression ───────────────────────────────────────────────────────────────
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/css \
    application/javascript application/json image/svg+xml font/woff2
</IfModule>
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css \
    application/javascript application/json image/svg+xml font/woff2
  SetEnvIfNoCase Request_URI \.(?:gif|jpe?g|png|webp|avif|gz|zip|br)$ no-gzip dont-vary
  Header append Vary Accept-Encoding
</IfModule>

# ── Caching ───────────────────────────────────────────────────────────────────
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css               "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png              "access plus 1 year"
  ExpiresByType image/jpeg             "access plus 1 year"
  ExpiresByType image/webp             "access plus 1 year"
  ExpiresByType image/avif             "access plus 1 year"
  ExpiresByType image/svg+xml          "access plus 1 year"
  ExpiresByType font/woff2             "access plus 1 year"
  ExpiresByType font/woff              "access plus 1 year"
</IfModule>

# ── Security headers ──────────────────────────────────────────────────────────
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# ── Proxy fallback (used if VirtualHost-level ProxyPass is not configured) ────
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_URI} ^/_next/static/ [NC]
  RewriteRule ^ - [L]
  RewriteCond %{REQUEST_FILENAME} -f
  RewriteRule ^ - [L]
  RewriteRule ^(.*)\$ http://127.0.0.1:${APP_PORT}/\$1 [P,L]
</IfModule>
HTACCESS
  echo -e "${GREEN}.htaccess written → port ${APP_PORT}${NC}"

  cat > "$DOMAIN_ROOT/_next/static/.htaccess" << 'STATIC_HTA'
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
STATIC_HTA
else
  echo -e "${YELLOW}Web root not found — skipping static copy${NC}"
fi

# ── 4c: Reload Apache to pick up any config changes ───────────────────────────
echo -e "${YELLOW}Reloading Apache...${NC}"
if systemctl reload httpd 2>/dev/null; then
  echo -e "${GREEN}Apache reloaded (systemctl)${NC}"
elif service httpd reload 2>/dev/null; then
  echo -e "${GREEN}Apache reloaded (service)${NC}"
elif apachectl graceful 2>/dev/null; then
  echo -e "${GREEN}Apache reloaded (apachectl graceful)${NC}"
else
  echo -e "${RED}Could not reload Apache — you may need to run: systemctl reload httpd${NC}"
fi

# ── Step 5: Clean PM2 restart ─────────────────────────────────────────────────
echo -e "${YELLOW}[5/5] Restarting Node.js server...${NC}"

pm2 stop betcheza 2>/dev/null || true
sleep 2
pm2 delete betcheza 2>/dev/null || true
sleep 1

fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
lsof -ti:"${APP_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

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
  echo -e "${RED}✗ App did NOT come up within ${MAX_WAIT}s!${NC}"
  pm2 logs betcheza --lines 30 --nostream 2>/dev/null || true
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Deploy complete! Checking site...${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"

# Final end-to-end check via Apache
SITE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://127.0.0.1/" \
  -H "Host: $DOMAIN" 2>/dev/null)
if [ "$SITE_CODE" = "200" ] || [ "$SITE_CODE" = "301" ] || [ "$SITE_CODE" = "302" ]; then
  echo -e "${GREEN}✓ Site is responding via Apache (HTTP $SITE_CODE)${NC}"
else
  echo -e "${RED}⚠ Apache returns HTTP $SITE_CODE for $DOMAIN — see diagnostic below:${NC}"
  echo ""
  echo -e "${YELLOW}Run this to diagnose the Apache → Node proxy:${NC}"
  echo "  httpd -S 2>&1 | grep -i betcheza"
  echo "  find /etc/httpd -name '*.conf' | xargs grep -l 'betcheza' 2>/dev/null"
  echo "  curl -v -H 'Host: $DOMAIN' http://127.0.0.1/ 2>&1 | head -30"
fi

pm2 list
