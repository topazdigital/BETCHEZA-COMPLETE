#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

DOMAIN="betcheza.co.ke"
DA_CONF="/usr/local/directadmin/data/users/admin/httpd.conf"

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

echo -e "${BOLD}Betcheza Deploy — $(pwd) [updated script]${NC}"

# ── Step 1b: Read config ──────────────────────────────────────────────────────
echo -e "${YELLOW}[1b/5] Reading configuration...${NC}"
ENV_FILE="$APP_DIR/.env.local"

if ! grep -q "GOOGLE_SITE_VERIFICATION" "$ENV_FILE" 2>/dev/null; then
  echo "GOOGLE_SITE_VERIFICATION=c6CwjlMj8vH8Pf7zQyFqp_BpbK-d1URyeKUso4QSJPs" >> "$ENV_FILE"
  echo -e "${GREEN}GOOGLE_SITE_VERIFICATION written to .env.local${NC}"
else
  echo -e "${GREEN}GOOGLE_SITE_VERIFICATION already in .env.local — OK${NC}"
fi

# App port: ecosystem.config.js > .env.local > 3001
ECO_PORT=$(node -e "try{const c=require('./ecosystem.config.js');const e=c.apps[0].env;console.log(e&&e.PORT||'');}catch(e){}" 2>/dev/null)
if [ -n "$ECO_PORT" ]; then
  APP_PORT="$ECO_PORT"
  echo -e "${GREEN}App port: $APP_PORT (from ecosystem.config.js)${NC}"
else
  APP_PORT=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]')
  APP_PORT="${APP_PORT:-3001}"
  echo -e "${GREEN}App port: $APP_PORT (from .env.local)${NC}"
fi

# Apache web root
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

# ── Step 2: Install dependencies ──────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
npm install --prefer-offline

# ── Step 3: Build ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Building...${NC}"
npm run build

# ── Step 4: Apache proxy config ───────────────────────────────────────────────
echo -e "${YELLOW}[4/5] Configuring Apache reverse proxy...${NC}"

# ── 4a: Patch DirectAdmin's httpd.conf (the authoritative Apache config on DA) ─
# DA stores all VirtualHosts in /usr/local/directadmin/data/users/admin/httpd.conf
# We inject ProxyPass into every betcheza VirtualHost using Python so it survives
# across Apache config syntax changes. This is backed up before every change.
if [ -f "$DA_CONF" ]; then
  cp "$DA_CONF" "${DA_CONF}.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true

  python3 << PYEOF
import re, sys

DA_CONF  = "$DA_CONF"
DOMAIN   = "$DOMAIN"
APP_PORT = $APP_PORT

PROXY_BLOCK = """
    # Node.js reverse proxy — managed by deploy.sh (do not remove)
    ProxyPreserveHost On
    ProxyPass        /_next/static/ !
    ProxyPass        / http://127.0.0.1:{port}/
    ProxyPassReverse / http://127.0.0.1:{port}/
""".format(port=APP_PORT)

with open(DA_CONF, "r") as f:
    lines = f.readlines()

in_betcheza = False
patched     = 0
new_lines   = []

for i, line in enumerate(lines):
    # Detect start of a VirtualHost block
    if re.search(r"<VirtualHost[^>]+>", line):
        # Peek at next ~8 lines to check if this VH is for our domain
        chunk = "".join(lines[i : i + 8])
        if DOMAIN in chunk:
            in_betcheza = True

    # Inject ProxyPass just before </VirtualHost> for betcheza blocks
    if in_betcheza and re.match(r"\s*</VirtualHost>", line):
        # Check we haven't already patched this block
        preceding = "".join(new_lines[-25:])
        if "ProxyPass" not in preceding:
            new_lines.append(PROXY_BLOCK)
            patched += 1
        else:
            # Update port in existing ProxyPass lines
            pass
        in_betcheza = False

    new_lines.append(line)

if patched == 0:
    # May already be patched — check if ProxyPass is present
    full = "".join(new_lines)
    if "ProxyPass" in full and DOMAIN in full:
        print(f"ProxyPass already present in {DA_CONF} — ensuring port is {APP_PORT}")
        # Update port in existing entries
        new_lines_str = "".join(new_lines)
        import re as _re
        new_lines_str = _re.sub(
            r"(ProxyPass\s+/\s+http://127\.0\.0\.1:)\d+(/)",
            rf"\g<1>{APP_PORT}\2",
            new_lines_str
        )
        new_lines_str = _re.sub(
            r"(ProxyPassReverse\s+/\s+http://127\.0\.0\.1:)\d+(/)",
            rf"\g<1>{APP_PORT}\2",
            new_lines_str
        )
        with open(DA_CONF, "w") as f:
            f.write(new_lines_str)
        print("Port updated.")
    else:
        print(f"WARNING: Could not find betcheza VirtualHost in {DA_CONF}", file=sys.stderr)
else:
    with open(DA_CONF, "w") as f:
        f.writelines(new_lines)
    print(f"Patched {patched} VirtualHost block(s) for {DOMAIN} → port {APP_PORT}")
PYEOF

  echo -e "${GREEN}DA httpd.conf patched with ProxyPass → port ${APP_PORT}${NC}"
else
  echo -e "${YELLOW}DA config not found at $DA_CONF — skipping VirtualHost patch${NC}"
fi

# ── 4b: Copy static assets + .htaccess (fallback proxy + compression) ─────────
if [ -n "$DOMAIN_ROOT" ] && [ -d "$DOMAIN_ROOT" ]; then
  mkdir -p "$DOMAIN_ROOT/_next/static"
  rm -rf "$DOMAIN_ROOT/_next/static"
  cp -r "$APP_DIR/.next/static" "$DOMAIN_ROOT/_next/static"
  CSS_COUNT=$(find "$DOMAIN_ROOT/_next/static" -name "*.css" 2>/dev/null | wc -l)
  echo -e "${GREEN}Static files copied ($CSS_COUNT CSS file(s))${NC}"

  cat > "$DOMAIN_ROOT/.htaccess" << HTACCESS
# Compression
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

# Long-term caching
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

# Security headers
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Fallback proxy (used only if VirtualHost-level ProxyPass is absent)
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

# ── 4c: Remove any stale conflicting conf.d file we may have created earlier ───
rm -f "/etc/httpd/conf.d/${DOMAIN}.conf" 2>/dev/null && \
  echo -e "${YELLOW}Removed stale /etc/httpd/conf.d/${DOMAIN}.conf${NC}" || true

# ── 4d: Reload Apache to pick up DA config changes ────────────────────────────
echo -e "${YELLOW}Reloading Apache...${NC}"
if systemctl reload httpd 2>/dev/null; then
  echo -e "${GREEN}Apache reloaded${NC}"
elif apachectl graceful 2>/dev/null; then
  echo -e "${GREEN}Apache reloaded (apachectl graceful)${NC}"
else
  echo -e "${RED}Could not auto-reload Apache — run: systemctl reload httpd${NC}"
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

# ── Step 6: Health check on Node ──────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Verifying app health...${NC}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"
MAX_WAIT=90
WAITED=0
SUCCESS=false
while [ $WAITED -lt $MAX_WAIT ]; do
  HTTP_CODE=$(curl -s -o /tmp/betcheza_health.json -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ]; then
    DB_STATUS=$(grep -o '"db":"[^"]*"' /tmp/betcheza_health.json 2>/dev/null | cut -d'"' -f4)
    echo -e "${GREEN}✓ Node app is UP on port ${APP_PORT} (db: ${DB_STATUS:-unknown})${NC}"
    SUCCESS=true
    break
  fi
  echo -e "${YELLOW}  Waiting... (${WAITED}s / ${MAX_WAIT}s, HTTP ${HTTP_CODE})${NC}"
  sleep 5
  WAITED=$((WAITED + 5))
done

if [ "$SUCCESS" = false ]; then
  echo -e "${RED}✗ Node app did NOT come up within ${MAX_WAIT}s!${NC}"
  pm2 logs betcheza --lines 30 --nostream 2>/dev/null || true
  exit 1
fi

# ── End-to-end site check via Apache ──────────────────────────────────────────
echo ""
echo -e "${YELLOW}Checking site via Apache (HTTPS)...${NC}"
sleep 2
SITE_CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
  --max-time 15 "https://${DOMAIN}/" 2>/dev/null)
if [ "$SITE_CODE" = "200" ] || [ "$SITE_CODE" = "301" ] || [ "$SITE_CODE" = "302" ]; then
  echo -e "${GREEN}${BOLD}✓ betcheza.co.ke is LIVE (HTTPS $SITE_CODE)${NC}"
else
  echo -e "${RED}⚠ HTTPS returned $SITE_CODE — Apache may need manual check${NC}"
  echo -e "${YELLOW}  Run: tail -30 /var/log/httpd/${DOMAIN}-error_log${NC}"
fi

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Deploy complete!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
pm2 list
