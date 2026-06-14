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
  # Stash any uncommitted local changes (env files, runtime data, etc.)
  git stash push --include-untracked -m "auto-stash before deploy $(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
  # Fetch then hard-reset — avoids "divergent branches" errors that block a
  # plain `git pull` when the server has local commits not on origin.
  # The server should always mirror origin/main exactly.
  git fetch origin
  git reset --hard origin/main
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
# Clear stale Next.js build cache before every deploy to prevent partial-build
# artifacts from causing TypeScript or module-resolution failures.
# Use || true so a locked/busy file doesn't abort the script (set -e is active).
rm -rf "$APP_DIR/.next" 2>/dev/null || {
  echo -e "${YELLOW}  rm -rf .next had issues — retrying with find...${NC}"
  find "$APP_DIR/.next" -type f -delete 2>/dev/null || true
  find "$APP_DIR/.next" -type d -empty -delete 2>/dev/null || true
}
# Give the build process extra heap — Next.js (especially with turbopack and
# many routes) can exceed the default 512 MB Node.js limit.
NODE_OPTIONS='--max-old-space-size=4096' npm run build

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

HTTP_PROXY_BLOCK = (
    "\n    # Node.js reverse proxy — managed by deploy.sh\n"
    "    ProxyPreserveHost On\n"
    "    ProxyRequests Off\n"
    "    RequestHeader set X-Forwarded-Proto \"http\"\n"
    "    ProxyPass        /.well-known !\n"
    "    ProxyPass        /_next/static/ !\n"
    f"    ProxyPass        / http://127.0.0.1:{APP_PORT}/ timeout=120 keepalive=On\n"
    f"    ProxyPassReverse / http://127.0.0.1:{APP_PORT}/\n"
    "    ProxyTimeout 120\n"
    "    SetEnv proxy-nokeepalive 0\n"
    "    SetEnv force-proxy-request-1.0 0\n"
)

HTTPS_PROXY_BLOCK = (
    "\n    # Node.js reverse proxy — managed by deploy.sh\n"
    "    ProxyPreserveHost On\n"
    "    ProxyRequests Off\n"
    "    RequestHeader set X-Forwarded-Proto \"https\"\n"
    "    ProxyPass        /.well-known !\n"
    "    ProxyPass        /_next/static/ !\n"
    f"    ProxyPass        / http://127.0.0.1:{APP_PORT}/ timeout=120 keepalive=On\n"
    f"    ProxyPassReverse / http://127.0.0.1:{APP_PORT}/\n"
    "    ProxyTimeout 120\n"
    "    SetEnv proxy-nokeepalive 0\n"
    "    SetEnv force-proxy-request-1.0 0\n"
)

def is_ssl_vhost(lines, start_idx):
    """Return True if the VirtualHost at start_idx listens on port 443."""
    opening = lines[start_idx]
    return bool(re.search(r":443\b", opening))

with open(DA_CONF, "r") as f:
    lines = f.readlines()

# ── Pass 1: update any existing ProxyPass port lines inside betcheza VHosts ───
# Search up to 80 lines ahead for ServerName/ServerAlias (DA configs vary).
in_betcheza = False
vhost_ssl    = False
new_lines    = []
updates      = 0

for i, line in enumerate(lines):
    if re.search(r"<VirtualHost[^>]+>", line):
        chunk = "".join(lines[i : i + 80])
        in_betcheza = bool(
            re.search(rf"(ServerName|ServerAlias)[^\n]*{re.escape(DOMAIN)}", chunk)
        )
        vhost_ssl = is_ssl_vhost(lines, i)

    if in_betcheza and re.search(r"RequestHeader\s+set\s+X-Forwarded-Proto", line):
        expected = '"https"' if vhost_ssl else '"http"'
        new_line = re.sub(r'"https"|"http"', expected, line)
        if new_line != line:
            updates += 1
        new_lines.append(new_line)
        continue

    if in_betcheza and re.search(r"ProxyPass(Reverse)?\s+/\s+http://127\.0\.0\.1:\d+/", line):
        new_line = re.sub(
            r"(ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:)\d+(/)",
            rf"\g<1>{APP_PORT}\2",
            line,
        )
        if new_line != line:
            updates += 1
        new_lines.append(new_line)
        continue

    if re.match(r"\s*</VirtualHost>", line):
        in_betcheza = False
        vhost_ssl   = False

    new_lines.append(line)

# ── Pass 2: if no existing ProxyPass was found, inject before </VirtualHost> ──
if updates == 0:
    in_betcheza  = False
    vhost_ssl    = False
    vhost_start  = -1
    patched      = 0
    final_lines  = []
    for i, line in enumerate(new_lines):
        if re.search(r"<VirtualHost[^>]+>", line):
            chunk = "".join(new_lines[i : i + 80])
            in_betcheza = bool(
                re.search(rf"(ServerName|ServerAlias)[^\n]*{re.escape(DOMAIN)}", chunk)
            )
            vhost_ssl   = is_ssl_vhost(new_lines, i)
            vhost_start = i
        if in_betcheza and re.match(r"\s*</VirtualHost>", line):
            preceding = "".join(final_lines[-50:])
            if "ProxyPass" not in preceding:
                block = HTTPS_PROXY_BLOCK if vhost_ssl else HTTP_PROXY_BLOCK
                final_lines.append(block)
                patched += 1
            in_betcheza = False
            vhost_ssl   = False
        final_lines.append(line)
    new_lines = final_lines
    if patched > 0:
        updates = patched

if updates > 0:
    with open(DA_CONF, "w") as f:
        f.writelines(new_lines)
    print(f"✓ Updated {updates} ProxyPass entry/entries for {DOMAIN} → port {APP_PORT}")
else:
    print(f"WARNING: Could not locate betcheza VirtualHost in {DA_CONF}", file=sys.stderr)
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

# Fallback proxy (used only if VirtualHost-level ProxyPass is absent).
# Sets X-Forwarded-Proto so Next.js knows the original protocol — prevents
# HTTP/HTTPS redirect loops when Apache is the SSL terminator.
<IfModule mod_rewrite.c>
  RewriteEngine On

  # Pass through ACME / Let's Encrypt challenges unchanged
  RewriteCond %{REQUEST_URI} ^/.well-known/ [NC]
  RewriteRule ^ - [L]

  # Pass through locally served Next.js static assets unchanged
  RewriteCond %{REQUEST_URI} ^/_next/static/ [NC]
  RewriteRule ^ - [L]

  # Pass through files that exist on disk (uploaded assets, etc.)
  RewriteCond %{REQUEST_FILENAME} -f
  RewriteRule ^ - [L]

  # Set X-Forwarded-Proto before proxying so Node.js sees the right protocol
  RewriteCond %{HTTPS} on
  RewriteRule ^ - [E=X_PROTO:https,NS]
  RewriteCond %{HTTPS} !on
  RewriteRule ^ - [E=X_PROTO:http,NS]

  RewriteRule ^(.*)\$ http://127.0.0.1:${APP_PORT}/\$1 [P,L]
</IfModule>

<IfModule mod_headers.c>
  # Forward the original protocol to Node.js (set by RewriteRule env above)
  RequestHeader set X-Forwarded-Proto "%{X_PROTO}e" env=X_PROTO
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

# ── Step 4e: Match cache handling ─────────────────────────────────────────────
# Do NOT clear match_cache or matches-cache.json on deploy.
# Clearing the cache on every deploy was the primary cause of "0 matches"
# pages: after clearing, if ESPN returned 0 on cold start the empty result
# was written back to DB + file, poisoning the cache for all future requests.
# The app now protects against cache poisoning in code (MIN_MATCHES_TO_PERSIST
# guard) and uses a 4-hour stale TTL, so existing cached data safely serves
# users while the background ESPN refresh fetches today's matches.
# The warmup step (6b below) forces a live ESPN re-fetch and waits for it.
echo -e "${GREEN}[4e/5] Keeping existing match cache — no cache wipe on deploy${NC}"

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

# ── Step 6b: Pre-warm caches (SYNCHRONOUS) ────────────────────────────────────
# Hit /api/warmup and WAIT for it to finish before completing the deploy.
# Running warmup in the background meant users could hit the site during the
# 8-10 second ESPN fetch window and see "No matches found". Now we block here
# until warmup confirms match data is loaded, so the site is always ready.
WARMUP_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]')
WARMUP_SECRET="${WARMUP_SECRET:-betcheza-cron-2024}"
echo -e "${YELLOW}Pre-warming caches (waiting for completion)...${NC}"
WARMUP_RESPONSE=$(curl -s \
  -H "Authorization: Bearer ${WARMUP_SECRET}" \
  --max-time 180 \
  "http://127.0.0.1:${APP_PORT}/api/warmup" 2>/dev/null)
WARMUP_MATCHES=$(echo "$WARMUP_RESPONSE" | grep -o '"matches":"[^"]*"' | cut -d'"' -f4 | grep -o '^[0-9]*')
if [ -n "$WARMUP_MATCHES" ] && [ "$WARMUP_MATCHES" -gt 0 ] 2>/dev/null; then
  echo -e "${GREEN}✓ Cache warm — ${WARMUP_MATCHES} matches loaded${NC}"
else
  echo -e "${YELLOW}⚠ Warmup completed but match count unclear — response: ${WARMUP_RESPONSE}${NC}"
  # Non-fatal: ESPN may have a temporary hiccup; the site will still serve
  # any previously cached data and refresh in the background.
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
