#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Betcheza — COMPLETE Production Fix                                         ║
# ║  Run as root on your server:                                                ║
# ║    bash /home/admin/apps/betcheza/scripts/fix-production.sh                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

APP_DIR="/home/admin/apps/betcheza"
APP_PORT=3001
DOMAIN="betcheza.co.ke"
WWW_DOMAIN="www.betcheza.co.ke"
ENV_FILE="$APP_DIR/.env.local"

banner() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}"; }

cd "$APP_DIR"

banner "Step 1 — Diagnose current state"

echo "► Node.js port check:"
curl -sv --max-time 5 "http://127.0.0.1:${APP_PORT}/api/health" 2>&1 | grep -E "HTTP|status|db" || echo "  (no response on port $APP_PORT)"

echo ""
echo "► PM2 status:"
pm2 list 2>/dev/null || echo "  PM2 not running"

echo ""
echo "► Apache redirect check:"
echo "  https://${DOMAIN}/  →"
curl -sI --max-time 8 "https://${DOMAIN}/" 2>/dev/null | grep -iE "location:|HTTP/" | head -4 || echo "  (no response)"
echo "  https://${WWW_DOMAIN}/  →"
curl -sI --max-time 8 "https://${WWW_DOMAIN}/" 2>/dev/null | grep -iE "location:|HTTP/" | head -4 || echo "  (no response)"

banner "Step 2 — Verify .env.local exists and is correct"

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}ERROR: $ENV_FILE not found!${NC}"
  echo "Please create it with your database credentials."
  exit 1
fi

# Ensure PORT=3001 and INTERNAL_BASE_URL use port 3001
if ! grep -q "^PORT=3001" "$ENV_FILE" 2>/dev/null; then
  sed -i 's/^PORT=.*/PORT=3001/' "$ENV_FILE" 2>/dev/null || echo "PORT=3001" >> "$ENV_FILE"
  echo -e "${GREEN}✓ Set PORT=3001 in .env.local${NC}"
fi
# Update INTERNAL_BASE_URL to use port 3001
sed -i 's|^INTERNAL_BASE_URL=.*|INTERNAL_BASE_URL=http://localhost:3001|' "$ENV_FILE" 2>/dev/null || true
echo -e "${GREEN}✓ INTERNAL_BASE_URL=http://localhost:3001${NC}"

# Ensure NODE_ENV=production
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$ENV_FILE" 2>/dev/null || true

echo -e "${GREEN}✓ .env.local looks good${NC}"

banner "Step 3 — Build the Next.js app (if needed)"

NEED_BUILD=false
if [ ! -d "$APP_DIR/.next" ]; then
  echo "  .next folder missing — need to build"
  NEED_BUILD=true
elif [ ! -f "$APP_DIR/.next/BUILD_ID" ]; then
  echo "  BUILD_ID missing — incomplete build"
  NEED_BUILD=true
else
  echo "  .next/BUILD_ID exists: $(cat $APP_DIR/.next/BUILD_ID)"
fi

if $NEED_BUILD; then
  echo -e "${YELLOW}Building app (this takes 3-5 minutes)...${NC}"
  
  # Stop PM2 to free RAM during build
  pm2 stop betcheza 2>/dev/null || true
  sleep 2

  # Install dependencies
  echo "Installing dependencies..."
  npm install --prefer-offline --no-audit 2>&1 | tail -5
  
  # Build
  rm -rf "$APP_DIR/.next" 2>/dev/null || true
  NODE_OPTIONS='--max-old-space-size=1500' npm run build
  echo -e "${GREEN}✓ Build complete${NC}"
else
  echo -e "${GREEN}✓ Using existing build${NC}"
fi

banner "Step 4 — Fix Apache: stop the redirect loop"

# The root cause: DirectAdmin redirects betcheza.co.ke → www.betcheza.co.ke
# but www.betcheza.co.ke has no proxy to Node.js.
# Fix: patch ALL VirtualHosts for BOTH domains to proxy to Node.js,
# and REMOVE any Redirect/RewriteRule that causes the www loop.

DA_CONF="/usr/local/directadmin/data/users/admin/httpd.conf"

patch_apache_conf() {
  local CONF_FILE="$1"
  echo "  Patching: $CONF_FILE"

  python3 << PYEOF
import re, shutil, sys

CONF  = "$CONF_FILE"
DOMAINS = ["$DOMAIN", "$WWW_DOMAIN"]
PORT  = $APP_PORT

HTTP_PROXY = """
    # Betcheza Node.js proxy — fix-production.sh
    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "http"
    ProxyPass        /.well-known !
    ProxyPass        / http://127.0.0.1:{PORT}/ timeout=120 keepalive=On
    ProxyPassReverse / http://127.0.0.1:{PORT}/
    ProxyTimeout 120
""".format(PORT=PORT)

HTTPS_PROXY = HTTP_PROXY.replace('"http"', '"https"')

with open(CONF, "r") as f:
    content = f.read()
    lines = content.splitlines(keepends=True)

# Parse VirtualHost blocks
vhost_blocks = []
i = 0
while i < len(lines):
    line = lines[i]
    m = re.search(r"<VirtualHost\s+([^>]+)>", line)
    if m:
        start = i
        depth = 1
        i += 1
        while i < len(lines) and depth > 0:
            if re.search(r"<VirtualHost", lines[i]):
                depth += 1
            if re.search(r"</VirtualHost>", lines[i]):
                depth -= 1
            i += 1
        end = i
        block_lines = lines[start:end]
        block_text = "".join(block_lines)
        # Detect which domain this VHost serves
        domain_found = None
        for d in DOMAINS:
            if re.search(rf"(ServerName|ServerAlias)\s+{re.escape(d)}\b", block_text):
                domain_found = d
                break
        is_ssl = bool(re.search(r":443\b", line))
        vhost_blocks.append({
            "start": start, "end": end, "domain": domain_found,
            "is_ssl": is_ssl, "lines": block_lines
        })
    else:
        i += 1

changes = 0
new_lines = list(lines)
offset = 0

for vhost in vhost_blocks:
    if vhost["domain"] is None:
        continue
    
    blk = list(vhost["lines"])
    blk_text = "".join(blk)
    
    # Remove any Redirect/RewriteRule that redirects to www or away from www
    # (this is the source of the redirect loop)
    filtered = []
    skip_next = False
    for j, l in enumerate(blk):
        # Remove www redirect rules
        if re.search(r"Redirect\s+.*www\.", l, re.IGNORECASE):
            changes += 1
            print(f"  REMOVED redirect: {l.rstrip()}")
            continue
        # Remove RewriteRule that redirects to www or away
        if re.search(r"RewriteRule.*www\.", l, re.IGNORECASE) and re.search(r"\[R=?3\d\d", l, re.IGNORECASE):
            changes += 1
            print(f"  REMOVED rewrite redirect: {l.rstrip()}")
            continue
        # Remove RewriteCond that checks HTTP_HOST for www redirect
        if skip_next:
            skip_next = False
            if re.search(r"RewriteRule.*\[R=?3\d\d", l, re.IGNORECASE):
                changes += 1
                print(f"  REMOVED rewrite rule: {l.rstrip()}")
                continue
        if re.search(r"RewriteCond.*HTTP_HOST.*www", l, re.IGNORECASE):
            skip_next = True
            changes += 1
            print(f"  REMOVED rewrite cond: {l.rstrip()}")
            continue
        filtered.append(l)
    blk = filtered
    
    # Now handle ProxyPass
    has_proxy = bool(re.search(r"ProxyPass\s+/\s+http://127\.0\.0\.1:\d+/", "".join(blk)))
    
    if has_proxy:
        # Update port if wrong
        new_blk = []
        for l in blk:
            if re.search(r"ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:\d+/", l):
                new_l = re.sub(r"(ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:)\d+(/)", rf"\g<1>{PORT}\2", l)
                if new_l != l:
                    changes += 1
                new_blk.append(new_l)
            elif re.search(r"RequestHeader\s+set\s+X-Forwarded-Proto", l):
                expected = '"https"' if vhost["is_ssl"] else '"http"'
                new_l = re.sub(r'"https"|"http"', expected, l)
                if new_l != l:
                    changes += 1
                new_blk.append(new_l)
            else:
                new_blk.append(l)
        blk = new_blk
    else:
        # Inject proxy before </VirtualHost>
        proxy_block = HTTPS_PROXY if vhost["is_ssl"] else HTTP_PROXY
        inject_idx = None
        for j in range(len(blk)-1, -1, -1):
            if re.match(r"\s*</VirtualHost>", blk[j]):
                inject_idx = j
                break
        if inject_idx is not None:
            blk.insert(inject_idx, proxy_block)
            changes += 1
            print(f"  INJECTED proxy into {vhost['domain']} {'SSL' if vhost['is_ssl'] else 'HTTP'} VHost")
    
    # Replace block in new_lines
    s = vhost["start"] + offset
    e = vhost["end"] + offset
    new_lines[s:e] = blk
    offset += len(blk) - (vhost["end"] - vhost["start"])

if changes > 0:
    shutil.copy(CONF, CONF + ".bak.$(date +%Y%m%d%H%M%S)")
    with open(CONF, "w") as f:
        f.writelines(new_lines)
    print(f"  ✓ Patched Apache conf: {changes} changes")
else:
    print(f"  ✓ Apache conf already correct")
PYEOF
}

if [ -f "$DA_CONF" ]; then
  patch_apache_conf "$DA_CONF"
  
  echo "  Rebuilding DA config..."
  echo "action=rewrite&value=httpd" | directadmin socket 2>/dev/null \
    && echo -e "${GREEN}  ✓ DirectAdmin config rebuilt${NC}" \
    || echo -e "${YELLOW}  ⚠ DA socket unavailable — using httpd.conf directly${NC}"
else
  echo -e "${YELLOW}  DA httpd.conf not found at $DA_CONF${NC}"
  echo "  Looking for httpd.conf in other locations..."
  for CANDIDATE in \
    "/etc/httpd/conf.d/${DOMAIN}.conf" \
    "/etc/apache2/sites-available/${DOMAIN}.conf" \
    "/etc/apache2/conf.d/${DOMAIN}.conf"; do
    if [ -f "$CANDIDATE" ]; then
      echo "  Found: $CANDIDATE"
      patch_apache_conf "$CANDIDATE"
      break
    fi
  done
fi

# Also write userdata proxy configs (survive DA rebuilds)
echo ""
echo "  Writing DirectAdmin userdata proxy configs..."
for DA_DIR in \
  "/etc/httpd/conf/userdata/std/2_4/admin/${DOMAIN}" \
  "/etc/httpd/conf/userdata/ssl/2_4/admin/${DOMAIN}" \
  "/etc/httpd/conf/userdata/std/2_4/admin/${WWW_DOMAIN}" \
  "/etc/httpd/conf/userdata/ssl/2_4/admin/${WWW_DOMAIN}"; do
  PARENT="$(dirname "$DA_DIR")"
  if [ -d "$PARENT" ]; then
    mkdir -p "$DA_DIR"
    # HTTP (std) or HTTPS (ssl)
    if echo "$DA_DIR" | grep -q "/ssl/"; then
      PROTO="https"
    else
      PROTO="http"
    fi
    cat > "$DA_DIR/nodejsproxy.conf" << EOF
ProxyPreserveHost On
ProxyRequests Off
RequestHeader set X-Forwarded-Proto "${PROTO}"
ProxyPass        /.well-known !
ProxyPass        / http://127.0.0.1:${APP_PORT}/ timeout=120 keepalive=On
ProxyPassReverse / http://127.0.0.1:${APP_PORT}/
ProxyTimeout 120
EOF
    echo -e "${GREEN}  ✓ Wrote userdata proxy: $DA_DIR/nodejsproxy.conf${NC}"
  fi
done

# Trigger DA rebuild if possible
if command -v directadmin &>/dev/null; then
  echo "action=rewrite&value=httpd" | directadmin socket 2>/dev/null || true
fi

banner "Step 5 — Restart Apache"

if systemctl restart httpd 2>/dev/null; then
  echo -e "${GREEN}✓ Apache restarted${NC}"
elif apachectl restart 2>/dev/null; then
  echo -e "${GREEN}✓ Apache restarted (apachectl)${NC}"
else
  systemctl reload httpd 2>/dev/null || apachectl graceful 2>/dev/null || true
  echo -e "${YELLOW}⚠ Apache reloaded (graceful)${NC}"
fi
sleep 3

banner "Step 6 — Start Node.js with PM2"

# Kill anything on the port first
fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
lsof -ti:"${APP_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

# Clean PM2 state
pm2 stop betcheza 2>/dev/null || true
pm2 delete betcheza 2>/dev/null || true
sleep 1

# Start fresh
pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save

echo ""
echo "  Waiting for Node.js to come up (up to 60s)..."
WAITED=0
SUCCESS=false
while [ $WAITED -lt 60 ]; do
  HTTP_CODE=$(curl -s -o /tmp/betcheza_health.json -w "%{http_code}" \
    --max-time 10 "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    DB_STATUS=$(grep -o '"db":"[^"]*"' /tmp/betcheza_health.json 2>/dev/null | cut -d'"' -f4 || echo "?")
    echo -e "${GREEN}✓ Node.js UP on port ${APP_PORT} (db: ${DB_STATUS})${NC}"
    SUCCESS=true
    break
  fi
  echo "  Waiting... (${WAITED}s, HTTP ${HTTP_CODE})"
  sleep 5
  WAITED=$((WAITED + 5))
done

if [ "$SUCCESS" = false ]; then
  echo -e "${RED}✗ Node.js did not start! PM2 logs:${NC}"
  pm2 logs betcheza --lines 40 --nostream 2>/dev/null || true
  echo ""
  echo -e "${YELLOW}Common causes:${NC}"
  echo "  1. Build failed — run: NODE_OPTIONS='--max-old-space-size=1500' npm run build"
  echo "  2. Wrong DB credentials in .env.local"
  echo "  3. Port in use — run: fuser -k -KILL ${APP_PORT}/tcp"
  exit 1
fi

banner "Step 7 — Final verification"

echo ""
echo "  Apache redirect chain:"
echo "  https://${DOMAIN}/:"
curl -sI --max-time 10 "https://${DOMAIN}/" 2>/dev/null | grep -iE "HTTP/|location:" | head -3
echo ""
echo "  https://${WWW_DOMAIN}/:"
curl -sI --max-time 10 "https://${WWW_DOMAIN}/" 2>/dev/null | grep -iE "HTTP/|location:" | head -3
echo ""
echo "  Direct Node.js:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://127.0.0.1:${APP_PORT}/" 2>/dev/null || echo "000")
echo "  http://127.0.0.1:${APP_PORT}/ → HTTP $HTTP_CODE"

echo ""
pm2 list

echo ""
if curl -skI --max-time 10 "https://${DOMAIN}/" 2>/dev/null | grep -q "HTTP/2 200"; then
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  ✓ betcheza.co.ke is LIVE!${NC}"
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
elif curl -skI --max-time 10 "https://${WWW_DOMAIN}/" 2>/dev/null | grep -q "HTTP/2 200"; then
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  ✓ www.betcheza.co.ke is LIVE!${NC}"
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Non-www still redirecting — that's OK if www works${NC}"
else
  echo -e "${YELLOW}${BOLD}═══════════════════════════════════════${NC}"
  echo -e "${YELLOW}${BOLD}  Node.js is UP — Apache may still need manual config${NC}"
  echo -e "${YELLOW}${BOLD}═══════════════════════════════════════${NC}"
  echo ""
  echo "  Apache error log (last 15 lines):"
  tail -15 /var/log/httpd/error_log 2>/dev/null || \
  tail -15 "/var/log/httpd/${DOMAIN}-error_log" 2>/dev/null || \
  journalctl -u httpd -n 15 --no-pager 2>/dev/null || true
  echo ""
  echo -e "${YELLOW}  Manual fix — in DirectAdmin panel:${NC}"
  echo "  1. Go to: DirectAdmin → Your Account → Domain Setup → betcheza.co.ke"
  echo "  2. Make sure 'www Redirect' is set to 'None' or disabled"
  echo "  3. Go to: Advanced Features → Apache Handlers / Custom HTTPD"
  echo "  4. Add this in BOTH the HTTP and HTTPS custom config for betcheza.co.ke:"
  echo ""
  echo "     ProxyPreserveHost On"
  echo "     ProxyRequests Off"
  echo "     ProxyPass        /.well-known !"
  echo "     ProxyPass        / http://127.0.0.1:${APP_PORT}/ timeout=120 keepalive=On"
  echo "     ProxyPassReverse / http://127.0.0.1:${APP_PORT}/"
fi
