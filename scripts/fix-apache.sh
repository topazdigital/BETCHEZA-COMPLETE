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

echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}  Betcheza Apache Fix — $(date)${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

# ── 1. Verify Node app is up ──────────────────────────────────────────────────
echo -e "${YELLOW}[1] Checking Node.js app on port $APP_PORT...${NC}"
HEALTH=$(curl -s --max-time 5 "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓ Node app is healthy on port $APP_PORT${NC}"
else
  echo -e "${RED}✗ Node app is NOT responding on port $APP_PORT — fixing PM2 first${NC}"
  pm2 stop betcheza 2>/dev/null || true
  pm2 delete betcheza 2>/dev/null || true
  fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
  sleep 2
  pm2 start "$APP_DIR/ecosystem.config.js" 2>/dev/null || \
    PORT=$APP_PORT pm2 start npm --name betcheza -- start
  pm2 save
  sleep 8
  HEALTH=$(curl -s --max-time 10 "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null)
  echo "$HEALTH" | grep -q '"status":"ok"' \
    && echo -e "${GREEN}✓ Node app is now up${NC}" \
    || { echo -e "${RED}✗ Node app still not responding — check: pm2 logs betcheza${NC}"; exit 1; }
fi
echo ""

# ── 2. Diagnose Apache VirtualHost for betcheza.co.ke ────────────────────────
echo -e "${YELLOW}[2] Diagnosing Apache VirtualHost for $DOMAIN...${NC}"
echo ""
echo "--- httpd -S output (first 50 lines) ---"
httpd -S 2>&1 | head -50
echo "--- end ---"
echo ""

# Find which file(s) mention betcheza
VHOST_FILE=$(find /etc/httpd -name "*.conf" 2>/dev/null \
  | xargs grep -l "$DOMAIN" 2>/dev/null | head -1)

if [ -n "$VHOST_FILE" ]; then
  echo -e "${GREEN}Found VirtualHost config: $VHOST_FILE${NC}"
  echo "--- content ---"
  cat "$VHOST_FILE"
  echo "--- end ---"
else
  echo -e "${RED}No existing VirtualHost config found for $DOMAIN${NC}"
fi
echo ""

# ── 3. Find DocumentRoot for betcheza.co.ke ───────────────────────────────────
echo -e "${YELLOW}[3] Detecting DocumentRoot Apache is using for $DOMAIN...${NC}"
# Use httpd -S output to find which VirtualHost handles the domain
DOC_ROOT=$(httpd -S 2>&1 | grep -A5 "$DOMAIN" | grep -i "document\|docroot" \
  | grep -o '"[^"]*"' | tr -d '"' | head -1)

# Fallback: check if the standard DirectAdmin path exists
if [ -z "$DOC_ROOT" ]; then
  for CANDIDATE in \
    "/home/admin/domains/$DOMAIN/public_html" \
    "/home/admin/public_html" \
    "/home/admin/www"; do
    if [ -d "$CANDIDATE" ]; then
      DOC_ROOT="$CANDIDATE"
      break
    fi
  done
fi

echo -e "${YELLOW}DocumentRoot: ${DOC_ROOT:-unknown}${NC}"
echo ""

# ── 4. Check DirectAdmin userdata dirs ────────────────────────────────────────
echo -e "${YELLOW}[4] Checking DirectAdmin custom config dirs...${NC}"
ls /etc/httpd/conf/userdata/ 2>/dev/null && echo "" || echo "(not found)"
ls /etc/httpd/conf/userdata/std/ 2>/dev/null && echo "" || true
ls /etc/httpd/conf/userdata/std/2_4/ 2>/dev/null && echo "" || true
ls /etc/httpd/conf/userdata/std/2_4/admin/ 2>/dev/null && echo "" || true
echo ""

# ── 5. Apply the fix ──────────────────────────────────────────────────────────
echo -e "${YELLOW}[5] Applying Apache proxy fix...${NC}"

FIX_APPLIED=false

# Strategy A: DirectAdmin userdata (cleanest — survives DA rebuilds)
for DA_DIR in \
  "/etc/httpd/conf/userdata/std/2_4/admin/$DOMAIN" \
  "/etc/httpd/conf/userdata/std/2/admin/$DOMAIN" \
  "/etc/httpd/conf/userdata/std/2_4/admin"; do
  PARENT=$(dirname "$DA_DIR")
  if [ -d "$PARENT" ]; then
    mkdir -p "$DA_DIR"
    cat > "$DA_DIR/nodejsproxy.conf" << PROXY
# Betcheza reverse proxy — managed by fix-apache.sh
ProxyPreserveHost On
ProxyPass        /_next/static/ !
ProxyPass        / http://127.0.0.1:${APP_PORT}/
ProxyPassReverse / http://127.0.0.1:${APP_PORT}/
PROXY
    echo -e "${GREEN}✓ Strategy A: Wrote ProxyPass to $DA_DIR/nodejsproxy.conf${NC}"
    FIX_APPLIED=true
    break
  fi
done

# Strategy B: Create a standalone VirtualHost conf file if no DA userdata dir
if [ "$FIX_APPLIED" = false ]; then
  CONF_FILE="/etc/httpd/conf.d/${DOMAIN}.conf"
  # Find the SSL cert paths
  SSL_CERT=$(find /etc/letsencrypt/live/$DOMAIN /usr/local/directadmin/conf \
    -name "fullchain.pem" -o -name "server.crt" 2>/dev/null | head -1)

  if [ -z "$DOC_ROOT" ]; then
    DOC_ROOT="/home/admin/domains/$DOMAIN/public_html"
    mkdir -p "$DOC_ROOT"
  fi

  cat > "$CONF_FILE" << VHOST
<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN
    DocumentRoot $DOC_ROOT

    <Directory "$DOC_ROOT">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Reverse proxy to Node.js
    ProxyPreserveHost On
    ProxyPass        /_next/static/ !
    ProxyPass        / http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/

    ErrorLog  /var/log/httpd/${DOMAIN}-error_log
    CustomLog /var/log/httpd/${DOMAIN}-access_log combined
</VirtualHost>
VHOST

  echo -e "${GREEN}✓ Strategy B: Created VirtualHost at $CONF_FILE${NC}"
  FIX_APPLIED=true
fi

# Strategy C: Fix .htaccess in the doc root if we know where it is
if [ -n "$DOC_ROOT" ] && [ -d "$DOC_ROOT" ]; then
  cat > "$DOC_ROOT/.htaccess" << HTACCESS
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_URI} ^/_next/static/ [NC]
  RewriteRule ^ - [L]
  RewriteCond %{REQUEST_FILENAME} -f
  RewriteRule ^ - [L]
  RewriteRule ^(.*)\$ http://127.0.0.1:${APP_PORT}/\$1 [P,L]
</IfModule>
HTACCESS
  echo -e "${GREEN}✓ Strategy C: Updated .htaccess in $DOC_ROOT${NC}"
fi

echo ""

# ── 6. Reload Apache ──────────────────────────────────────────────────────────
echo -e "${YELLOW}[6] Reloading Apache...${NC}"
if systemctl reload httpd 2>/dev/null; then
  echo -e "${GREEN}✓ Apache reloaded (systemctl)${NC}"
elif apachectl graceful 2>/dev/null; then
  echo -e "${GREEN}✓ Apache reloaded (apachectl graceful)${NC}"
elif service httpd reload 2>/dev/null; then
  echo -e "${GREEN}✓ Apache reloaded (service)${NC}"
else
  echo -e "${RED}Could not reload Apache — try: systemctl restart httpd${NC}"
fi
echo ""

# ── 7. End-to-end test ────────────────────────────────────────────────────────
echo -e "${YELLOW}[7] End-to-end test via Apache...${NC}"
sleep 3
CODE=$(curl -s -o /tmp/betcheza_test.html -w "%{http_code}" \
  --max-time 10 -H "Host: $DOMAIN" "http://127.0.0.1/" 2>/dev/null)

if [ "$CODE" = "200" ] || [ "$CODE" = "301" ] || [ "$CODE" = "302" ]; then
  echo -e "${GREEN}${BOLD}✓ SUCCESS! Site is responding (HTTP $CODE) via Apache${NC}"
  echo -e "${GREEN}  betcheza.co.ke should be live now!${NC}"
else
  echo -e "${RED}✗ Apache still returns HTTP $CODE for $DOMAIN${NC}"
  echo ""
  echo -e "${YELLOW}─── Apache error_log (last 20 lines) ───${NC}"
  tail -20 /var/log/httpd/error_log 2>/dev/null || \
  tail -20 /var/log/httpd/${DOMAIN}-error_log 2>/dev/null
  echo ""
  echo -e "${YELLOW}─── curl verbose output ───${NC}"
  curl -v -H "Host: $DOMAIN" "http://127.0.0.1/" 2>&1 | head -40
  echo ""
  echo -e "${RED}Remaining steps to try manually:${NC}"
  echo "  1. systemctl restart httpd"
  echo "  2. httpd -t  (check for config syntax errors)"
  echo "  3. cat /var/log/httpd/${DOMAIN}-error_log | tail -30"
fi

echo ""
echo -e "${BOLD}PM2 status:${NC}"
pm2 list
