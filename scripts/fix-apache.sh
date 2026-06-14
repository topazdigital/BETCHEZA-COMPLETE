#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Betcheza — One-shot Apache proxy fix                           ║
# ║  Run as root on your DirectAdmin server:                        ║
# ║    bash /home/admin/apps/betcheza/scripts/fix-apache.sh         ║
# ╚══════════════════════════════════════════════════════════════════╝
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

APP_PORT=3001
DOMAIN="betcheza.co.ke"
APP_DIR="/home/admin/apps/betcheza"
DA_CONF="/usr/local/directadmin/data/users/admin/httpd.conf"

echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}  Betcheza Apache Fix — $(date)${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"

# ── 1. Verify Node app is up ──────────────────────────────────────────────────
echo -e "\n${YELLOW}[1] Checking Node.js on port $APP_PORT...${NC}"
HEALTH=$(curl -s --max-time 8 "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null || true)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓ Node app healthy${NC}"
else
  echo -e "${RED}✗ Node not responding — restarting PM2...${NC}"
  pm2 stop betcheza 2>/dev/null || true
  pm2 delete betcheza 2>/dev/null || true
  fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
  sleep 3
  pm2 start "$APP_DIR/ecosystem.config.js"
  pm2 save
  sleep 10
  HEALTH=$(curl -s --max-time 15 "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null || true)
  echo "$HEALTH" | grep -q '"status":"ok"' \
    && echo -e "${GREEN}✓ Node app is now up${NC}" \
    || { echo -e "${RED}✗ Still down. Run: pm2 logs betcheza --lines 50${NC}"; exit 1; }
fi

# ── 2. Fix Apache: DA httpd.conf (handles BOTH http + https VirtualHosts) ────
echo -e "\n${YELLOW}[2] Patching DirectAdmin httpd.conf (HTTP + HTTPS VirtualHosts)...${NC}"

if [ -f "$DA_CONF" ]; then
  python3 << PYEOF
import re, sys, shutil

DA_CONF  = "$DA_CONF"
DOMAIN   = "$DOMAIN"
PORT     = $APP_PORT

HTTP_PROXY = (
    "\n    # Betcheza Node.js reverse proxy — fix-apache.sh\n"
    "    ProxyPreserveHost On\n"
    "    ProxyRequests Off\n"
    "    RequestHeader set X-Forwarded-Proto \"http\"\n"
    "    ProxyPass        /.well-known !\n"
    "    ProxyPass        /_next/static/ !\n"
    f"    ProxyPass        / http://127.0.0.1:{PORT}/ timeout=120 keepalive=On\n"
    f"    ProxyPassReverse / http://127.0.0.1:{PORT}/\n"
    "    ProxyTimeout 120\n"
)
HTTPS_PROXY = HTTP_PROXY.replace('"http"', '"https"')

def is_ssl(line):
    return bool(re.search(r":443\b", line))

with open(DA_CONF) as f:
    lines = f.readlines()

# Pass 1: update existing ProxyPass port numbers
in_betcheza = vhost_ssl = False
new_lines   = []
updates     = 0
for i, line in enumerate(lines):
    if re.search(r"<VirtualHost[^>]+>", line):
        chunk = "".join(lines[i:i+80])
        in_betcheza = bool(re.search(rf"(ServerName|ServerAlias)[^\n]*{re.escape(DOMAIN)}", chunk))
        vhost_ssl   = is_ssl(line)
    if in_betcheza and re.search(r"RequestHeader\s+set\s+X-Forwarded-Proto", line):
        exp = '"https"' if vhost_ssl else '"http"'
        new = re.sub(r'"https"|"http"', exp, line)
        if new != line: updates += 1
        new_lines.append(new); continue
    if in_betcheza and re.search(r"ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:\d+/", line):
        new = re.sub(r"(ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:)\d+(/)", rf"\g<1>{PORT}\2", line)
        if new != line: updates += 1
        new_lines.append(new); continue
    if re.match(r"\s*</VirtualHost>", line):
        in_betcheza = False
    new_lines.append(line)

# Pass 2: inject where missing
in_betcheza = vhost_ssl = False
final       = []
patched     = 0
for i, line in enumerate(new_lines):
    if re.search(r"<VirtualHost[^>]+>", line):
        chunk = "".join(new_lines[i:i+80])
        in_betcheza = bool(re.search(rf"(ServerName|ServerAlias)[^\n]*{re.escape(DOMAIN)}", chunk))
        vhost_ssl   = is_ssl(line)
    if in_betcheza and re.match(r"\s*</VirtualHost>", line):
        preceding = "".join(final[-60:])
        if "ProxyPass" not in preceding:
            final.append(HTTPS_PROXY if vhost_ssl else HTTP_PROXY)
            patched += 1
        in_betcheza = vhost_ssl = False
    final.append(line)

total = updates + patched
if total > 0:
    shutil.copy(DA_CONF, DA_CONF + ".bak")
    with open(DA_CONF, "w") as f:
        f.writelines(final)
    print(f"✓ Patched DA httpd.conf: {updates} port updates + {patched} new injections")
else:
    has_correct = f"127.0.0.1:{PORT}" in "".join(final)
    if has_correct:
        print(f"✓ DA httpd.conf already correct (port {PORT})")
    else:
        print(f"WARNING: betcheza VirtualHost not found in DA conf", file=sys.stderr)
PYEOF
else
  echo -e "${YELLOW}DA httpd.conf not found — skipping direct patch${NC}"
fi

# ── 3. Fix Apache: DirectAdmin userdata dirs (survives DA rebuilds) ───────────
echo -e "\n${YELLOW}[3] Writing DirectAdmin userdata proxy configs...${NC}"
PROXY_CONF="ProxyPreserveHost On
ProxyRequests Off
ProxyPass        /.well-known !
ProxyPass        /_next/static/ !
ProxyPass        / http://127.0.0.1:${APP_PORT}/ timeout=120 keepalive=On
ProxyPassReverse / http://127.0.0.1:${APP_PORT}/
ProxyTimeout 120"

WRITTEN=false
# Try all common DirectAdmin userdata paths (http + ssl variants)
for DA_DIR in \
  "/etc/httpd/conf/userdata/std/2_4/admin/${DOMAIN}" \
  "/etc/httpd/conf/userdata/ssl/2_4/admin/${DOMAIN}" \
  "/etc/httpd/conf/userdata/std/2_4/admin"; do
  PARENT=$(dirname "$DA_DIR")
  if [ -d "$PARENT" ]; then
    mkdir -p "$DA_DIR"
    echo "$PROXY_CONF" > "$DA_DIR/nodejsproxy.conf"
    echo -e "${GREEN}✓ Wrote proxy conf to: $DA_DIR/nodejsproxy.conf${NC}"
    WRITTEN=true
  fi
done

# Tell DirectAdmin to rebuild Apache config from userdata
if $WRITTEN; then
  if command -v directadmin &>/dev/null; then
    echo "action=rewrite&value=httpd" | directadmin socket 2>/dev/null \
      && echo -e "${GREEN}✓ DirectAdmin rewrite triggered${NC}" \
      || echo -e "${YELLOW}DA rewrite unavailable — proceeding with manual reload${NC}"
  fi
fi

# ── 4. Fix .htaccess as final fallback ────────────────────────────────────────
echo -e "\n${YELLOW}[4] Writing .htaccess proxy fallback...${NC}"
DOC_ROOT="/home/admin/domains/${DOMAIN}/public_html"
mkdir -p "$DOC_ROOT"
cat > "$DOC_ROOT/.htaccess" << HTACCESS
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_URI} ^/.well-known/ [NC]
  RewriteRule ^ - [L]
  RewriteCond %{REQUEST_URI} ^/_next/static/ [NC]
  RewriteRule ^ - [L]
  RewriteCond %{REQUEST_FILENAME} -f
  RewriteRule ^ - [L]
  RewriteRule ^(.*)\$ http://127.0.0.1:${APP_PORT}/\$1 [P,L]
</IfModule>
<IfModule mod_headers.c>
  RequestHeader set X-Forwarded-Proto "https" env=HTTPS
  RequestHeader set X-Forwarded-Proto "http" env=!HTTPS
</IfModule>
HTACCESS
echo -e "${GREEN}✓ .htaccess written to $DOC_ROOT${NC}"

# ── 5. Restart Apache (full restart, not just reload) ─────────────────────────
echo -e "\n${YELLOW}[5] Restarting Apache...${NC}"
if systemctl restart httpd 2>/dev/null; then
  echo -e "${GREEN}✓ Apache restarted${NC}"
elif apachectl restart 2>/dev/null; then
  echo -e "${GREEN}✓ Apache restarted (apachectl)${NC}"
else
  echo -e "${RED}Could not restart Apache — trying reload...${NC}"
  systemctl reload httpd 2>/dev/null || apachectl graceful 2>/dev/null || true
fi
sleep 3

# ── 6. End-to-end test ────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[6] Testing...${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 15 -H "Host: $DOMAIN" "http://127.0.0.1/" 2>/dev/null || echo "000")
HTTPS_CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
  --max-time 15 "https://${DOMAIN}/" 2>/dev/null || echo "000")

echo -e "HTTP  (via Apache):  ${HTTP_CODE}"
echo -e "HTTPS (betcheza.co.ke): ${HTTPS_CODE}"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTPS_CODE" = "200" ] || \
   [ "$HTTP_CODE" = "301" ] || [ "$HTTPS_CODE" = "301" ]; then
  echo -e "\n${GREEN}${BOLD}✓ SUCCESS — betcheza.co.ke is live!${NC}"
else
  echo -e "\n${RED}✗ Site still not responding. Running httpd syntax check:${NC}"
  httpd -t 2>&1 || true
  echo ""
  echo -e "${YELLOW}Apache error log (last 20 lines):${NC}"
  tail -20 /var/log/httpd/error_log 2>/dev/null || \
  tail -20 "/var/log/httpd/${DOMAIN}-error_log" 2>/dev/null || \
  journalctl -u httpd -n 20 --no-pager 2>/dev/null || true
fi

echo ""
pm2 list
