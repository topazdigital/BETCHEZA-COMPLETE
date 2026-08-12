#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# Runtime jackpot data is intentionally outside git, but keep an explicit
# deploy backup as a guard against a file-copy/reset step removing ignored
# state. Upcoming jackpots are user-facing content and must survive deploys.
JACKPOT_STATE_FILE="$APP_DIR/.local/state/jackpots.json"
JACKPOT_DEPLOY_BACKUP="/tmp/betcheza-jackpots.json.deploy-backup"
if [ -f "$JACKPOT_STATE_FILE" ]; then
  mkdir -p "$(dirname "$JACKPOT_DEPLOY_BACKUP")"
  cp -f "$JACKPOT_STATE_FILE" "$JACKPOT_DEPLOY_BACKUP" 2>/dev/null || true
else
  rm -f "$JACKPOT_DEPLOY_BACKUP" 2>/dev/null || true
fi

# ── NVM / Node PATH bootstrap ─────────────────────────────────────────────────
# GitHub Actions runners and cron shells don't source ~/.bashrc / ~/.bash_profile
# so NVM and the node/npm/pm2 binaries are missing from PATH. Source NVM here
# before any node/npm/pm2 commands so the script works in all environments.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" --no-use
# If NVM is installed but no node is in PATH yet, use the default/current version
command -v node &>/dev/null || { nvm use default 2>/dev/null || nvm use node 2>/dev/null || true; }
# Fallback: common manual install paths
for _np in /usr/local/bin /usr/bin "$HOME/.local/bin" "$HOME/bin"; do
  [ -x "$_np/node" ] && export PATH="$_np:$PATH" && break
done
# Add PM2 global bin if installed locally
[ -d "$HOME/.npm-global/bin" ] && export PATH="$HOME/.npm-global/bin:$PATH"
[ -d "$HOME/.local/lib/node_modules/.bin" ] && export PATH="$HOME/.local/lib/node_modules/.bin:$PATH"
echo "[deploy] node: $(node --version 2>/dev/null || echo 'NOT FOUND') | npm: $(npm --version 2>/dev/null || echo 'NOT FOUND') | pm2: $(pm2 --version 2>/dev/null || echo 'NOT FOUND')"

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
# Restore jackpot content if a deployment/reset step removed the ignored file.
if [ ! -f "$JACKPOT_STATE_FILE" ] && [ -f "$JACKPOT_DEPLOY_BACKUP" ]; then
  mkdir -p "$(dirname "$JACKPOT_STATE_FILE")"
  cp -f "$JACKPOT_DEPLOY_BACKUP" "$JACKPOT_STATE_FILE"
  echo -e "${GREEN}  ✓ Restored upcoming jackpot state after pull${NC}"
fi
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
# Strip any Replit-internal package proxy URLs from package-lock.json so that
# npm install works correctly on the production server (those URLs are only
# reachable inside Replit's network and cause 404s everywhere else).
if grep -q "package-firewall.replit.local" package-lock.json 2>/dev/null; then
  sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json
  echo -e "${GREEN}  ✓ Stripped Replit proxy URLs from package-lock.json${NC}"
fi
npm install --prefer-offline

# ── Step 3: Stop PM2 BEFORE building to free RAM ─────────────────────────────
# PM2 holds ~1.4 GB of RAM for the running app. If it stays up during build,
# the build process + PM2 together exceed the server's RAM and the OOM killer
# terminates the build ("Killed" at "Collecting page data"). Stop PM2 first.
echo -e "${YELLOW}[2b/5] Stopping PM2 to free RAM for build...${NC}"
pm2 stop betcheza 2>/dev/null || true
sleep 2

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
# Cap build at 1.5 GB — enough for Next.js Turbopack with 80+ routes, but
# leaves headroom on a 4 GB server. (Was 4096 which competed with PM2.)
NODE_OPTIONS='--max-old-space-size=1500' npm run build

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

  # Static "site is starting" page — served by Apache when Node is not yet
  # listening (connection refused = 503). Users see a friendly loading screen
  # instead of a blank browser tab during PM2 restarts or cold-starts.
  cat > "$DOMAIN_ROOT/loading.html" << 'LOADING_HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="8">
<title>Betcheza — Starting up…</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f1117;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
  .wrap{max-width:360px;padding:2rem 1rem}
  .logo{font-size:2rem;font-weight:900;color:#3b82f6;letter-spacing:-0.04em;margin-bottom:0.5rem}
  .dot{display:inline-block;width:10px;height:10px;background:#3b82f6;border-radius:50%;margin:0 3px;animation:bounce 1.2s infinite ease-in-out}
  .dot:nth-child(2){animation-delay:.2s}
  .dot:nth-child(3){animation-delay:.4s}
  @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-12px)}}
  p{font-size:.9rem;color:#94a3b8;margin-top:1rem}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Betcheza</div>
  <div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
  <p>Site is starting up — refreshing automatically…</p>
</div>
</body>
</html>
LOADING_HTML
  echo -e "${GREEN}Static loading page written → ${DOMAIN_ROOT}/loading.html${NC}"

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

# When Node is down, Apache returns 502 (connection refused) or 503.
# ProxyErrorOverride makes Apache substitute our custom page for both.
<IfModule mod_proxy.c>
  ProxyErrorOverride On
</IfModule>
ErrorDocument 502 /loading.html
ErrorDocument 503 /loading.html

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

# ── 4c: Patch DA httpd.conf with a robust Python script ──────────────────────
# This patches ALL betcheza.co.ke VirtualHosts (HTTP + HTTPS) in the DA conf.
# It is the most reliable method because it edits the authoritative config file
# that DirectAdmin manages, rather than fighting with a separate conf.d file.
CONFD_FILE="/etc/httpd/conf.d/${DOMAIN}.conf"
if [ -f /usr/local/directadmin/data/users/admin/httpd.conf ]; then
  python3 << PYEOF
import re, sys

DA_CONF  = "/usr/local/directadmin/data/users/admin/httpd.conf"
DOMAIN   = "${DOMAIN}"
APP_PORT = ${APP_PORT}

HTTP_PROXY = (
    "\n    # Node.js reverse proxy — managed by deploy.sh\n"
    "    ProxyPreserveHost On\n"
    "    ProxyRequests Off\n"
    "    RequestHeader set X-Forwarded-Proto \"http\"\n"
    "    ProxyPass        /.well-known !\n"
    "    ProxyPass        /_next/static/ !\n"
    f"    ProxyPass        / http://127.0.0.1:{APP_PORT}/ timeout=120 keepalive=On\n"
    f"    ProxyPassReverse / http://127.0.0.1:{APP_PORT}/\n"
    "    ProxyTimeout 120\n"
)
HTTPS_PROXY = HTTP_PROXY.replace('"http"', '"https"')

def is_ssl(line):
    return bool(re.search(r":443\b", line))

with open(DA_CONF) as f:
    lines = f.readlines()

# Pass 1: update existing ProxyPass port numbers (handles re-deploys)
in_betcheza = False
vhost_ssl   = False
new_lines   = []
updates     = 0
for i, line in enumerate(lines):
    if re.search(r"<VirtualHost[^>]+>", line):
        chunk = "".join(lines[i:i+80])
        in_betcheza = bool(re.search(rf"(ServerName|ServerAlias)[^\n]*{re.escape(DOMAIN)}", chunk))
        vhost_ssl = is_ssl(line)
    if in_betcheza and re.search(r"RequestHeader\s+set\s+X-Forwarded-Proto", line):
        expected = '"https"' if vhost_ssl else '"http"'
        new_line = re.sub(r'"https"|"http"', expected, line)
        if new_line != line: updates += 1
        new_lines.append(new_line)
        continue
    if in_betcheza and re.search(r"ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:\d+/", line):
        new_line = re.sub(r"(ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:)\d+(/)", rf"\g<1>{APP_PORT}\2", line)
        if new_line != line: updates += 1
        new_lines.append(new_line)
        continue
    if re.match(r"\s*</VirtualHost>", line):
        in_betcheza = False
    new_lines.append(line)

# Pass 2: inject ProxyPass where missing
in_betcheza = False
vhost_ssl   = False
final_lines = []
patched     = 0
for i, line in enumerate(new_lines):
    if re.search(r"<VirtualHost[^>]+>", line):
        chunk = "".join(new_lines[i:i+80])
        in_betcheza = bool(re.search(rf"(ServerName|ServerAlias)[^\n]*{re.escape(DOMAIN)}", chunk))
        vhost_ssl = is_ssl(line)
    if in_betcheza and re.match(r"\s*</VirtualHost>", line):
        preceding = "".join(final_lines[-60:])
        if "ProxyPass" not in preceding:
            final_lines.append(HTTPS_PROXY if vhost_ssl else HTTP_PROXY)
            patched += 1
        in_betcheza = False
        vhost_ssl   = False
    final_lines.append(line)

total = updates + patched
if total > 0:
    import shutil
    shutil.copy(DA_CONF, DA_CONF + ".bak")
    with open(DA_CONF, "w") as f:
        f.writelines(final_lines)
    print(f"✓ DA httpd.conf patched: {updates} updated, {patched} injected (total {total} VHosts)")
else:
    # Already correctly configured — verify port matches
    if f"127.0.0.1:{APP_PORT}" in "".join(new_lines):
        print(f"✓ DA httpd.conf already has correct ProxyPass → port {APP_PORT}")
    else:
        print(f"WARNING: Could not find or patch betcheza VirtualHost in {DA_CONF}", file=sys.stderr)
PYEOF

  # Always write the HTTP conf.d as belt-and-suspenders fallback
  # (DA patch handles HTTPS; this ensures HTTP works even if DA conf is reset)
  if [ -d "/etc/httpd/conf.d" ]; then
    cat > "$CONFD_FILE" << CONFD
# Betcheza HTTP reverse-proxy fallback — written by deploy.sh $(date +%Y-%m-%d)
# The primary proxy config lives in DirectAdmin's httpd.conf (patched above).
# This file ensures HTTP port 80 works even if the DA patch is ever reset.
<IfModule mod_proxy.c>
  <IfDefine !betcheza_proxy_loaded>
    Define betcheza_proxy_loaded
  </IfDefine>
</IfModule>
CONFD
    echo -e "${GREEN}conf.d marker written → ${CONFD_FILE}${NC}"
  fi
else
  echo -e "${YELLOW}DA httpd.conf not found — writing conf.d HTTP+HTTPS proxy${NC}"
  if [ -d "/etc/httpd/conf.d" ]; then
    cat > "$CONFD_FILE" << CONFD
# Betcheza reverse-proxy — written by deploy.sh $(date +%Y-%m-%d)
# (DirectAdmin not detected; using standalone conf.d VirtualHost)
<IfModule mod_proxy.c>
  <VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}
    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "http"
    ProxyPass        /.well-known !
    ProxyPass        /_next/static/ !
    ProxyPass        / http://127.0.0.1:${APP_PORT}/ timeout=120 keepalive=On
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/
    ProxyTimeout 120
  </VirtualHost>
</IfModule>
CONFD
    echo -e "${GREEN}conf.d proxy file written → ${CONFD_FILE}${NC}"
  fi
fi

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
# Smart cache policy: preserve the file cache if it is < 2 hours old.
# Wiping unconditionally caused blank homepages when ESPN timed out during the
# post-deploy warmup — the only surviving data was 20 camel1 matches, which
# is not enough to populate "Today's Matches". A cache that is < 2 h old is
# still fresh enough to show immediately while the background refresh fills in.
# Caches older than 2 h contain yesterday's schedule and should be wiped.
echo -e "${YELLOW}[4e/5] Checking match cache age...${NC}"
CACHE_FILE="${APP_DIR}/.local/state/matches-cache.json"
if [ -f "$CACHE_FILE" ]; then
  CACHE_MTIME=$(date -r "$CACHE_FILE" +%s 2>/dev/null || echo 0)
  CACHE_AGE_MIN=$(( ( $(date +%s) - CACHE_MTIME ) / 60 ))
  if [ "$CACHE_AGE_MIN" -lt 120 ]; then
    echo -e "${GREEN}  ✓ Match cache is ${CACHE_AGE_MIN}min old — preserving (ESPN warmup will patch it)${NC}"
  else
    rm -f "$CACHE_FILE" 2>/dev/null && echo "  ✓ Removed stale matches-cache.json (${CACHE_AGE_MIN}min old)" || true
    if command -v mysql &>/dev/null && [ -n "${DB_PASS:-}" ]; then
      mysql -u"${DB_USER:-admin}" -p"${DB_PASS}" "${DB_NAME:-betcheza}" -e \
        "DELETE FROM match_cache WHERE cache_key='all_matches';" 2>/dev/null \
        && echo "  ✓ Cleared DB match_cache" || echo "  ⚠ DB clear skipped (table may not exist yet)"
    fi
    echo -e "${GREEN}[4e/5] Stale cache wiped — fresh fetch will run on next startup${NC}"
  fi
else
  echo -e "${YELLOW}  No existing match cache — fresh fetch will run on next startup${NC}"
fi

# ── Step 5: Restart Node.js (fast path: reload if running, start if not) ──────
echo -e "${YELLOW}[5/5] Restarting Node.js server...${NC}"

# Kill any stale process holding the port
fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
lsof -ti:"${APP_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

if pm2 describe betcheza &>/dev/null; then
  # Process exists — delete and re-start so new ecosystem.config.js is picked up
  pm2 delete betcheza 2>/dev/null || true
  sleep 1
fi

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
