#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Betcheza — Emergency Apache Redirect Loop Fix                              ║
# ║  Run as root:  bash /home/admin/apps/betcheza/scripts/emergency-fix.sh      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
set -uo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

APP_DIR="/home/admin/apps/betcheza"
APP_PORT=3001
DOMAIN="betcheza.co.ke"
WWW_DOMAIN="www.betcheza.co.ke"
DA_CONF="/usr/local/directadmin/data/users/admin/httpd.conf"

banner() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}"; }

cd "$APP_DIR"

banner "1 — Show current Apache redirect state"
echo "Redirect lines for betcheza in DA httpd.conf:"
grep -n "betcheza\|www\." "$DA_CONF" 2>/dev/null | grep -iE "redirect|rewrite" | head -30 || echo "  (none found or file missing)"

banner "2 — Completely remove ALL www redirects from Apache config"

python3 << 'PYEOF'
import re, shutil, sys

DA_CONF  = "/usr/local/directadmin/data/users/admin/httpd.conf"
DOMAIN   = "betcheza.co.ke"
WWW_DOMAIN = "www.betcheza.co.ke"
APP_PORT = 3001

HTTP_PROXY = f"""
    # Betcheza Node.js proxy — emergency-fix.sh
    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "http"
    ProxyPass        /.well-known !
    ProxyPass        / http://127.0.0.1:{APP_PORT}/ timeout=120 keepalive=On
    ProxyPassReverse / http://127.0.0.1:{APP_PORT}/
    ProxyTimeout 120
"""

HTTPS_PROXY = HTTP_PROXY.replace('"http"', '"https"')

try:
    with open(DA_CONF, "r") as f:
        original = f.read()
        lines = original.splitlines(keepends=True)
except FileNotFoundError:
    print(f"ERROR: {DA_CONF} not found", file=sys.stderr)
    sys.exit(1)

# ── Pass 1: identify VirtualHost block boundaries ─────────────────────────────
# Find all VirtualHost blocks for betcheza or www.betcheza
def get_vhost_blocks(lines):
    blocks = []
    i = 0
    while i < len(lines):
        m = re.search(r"<VirtualHost\s+([^>]+)>", lines[i])
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
            block_text = "".join(lines[start:end])
            is_betcheza = bool(re.search(
                rf"(ServerName|ServerAlias)\s+({re.escape(DOMAIN)}|{re.escape(WWW_DOMAIN)})\b",
                block_text
            ))
            is_ssl = bool(re.search(r":443\b", lines[start]))
            blocks.append({
                "start": start, "end": end,
                "is_betcheza": is_betcheza, "is_ssl": is_ssl,
                "lines": list(lines[start:end])
            })
        else:
            i += 1
    return blocks

blocks = get_vhost_blocks(lines)
betcheza_blocks = [b for b in blocks if b["is_betcheza"]]

if not betcheza_blocks:
    print("WARNING: No betcheza VirtualHost blocks found in DA conf", file=sys.stderr)
    sys.exit(1)

print(f"Found {len(betcheza_blocks)} betcheza VirtualHost block(s) to patch")

# ── Pass 2: rewrite each betcheza VirtualHost block ───────────────────────────
REDIRECT_PATTERNS = [
    # Redirect directives
    r"^\s*Redirect\b.*",
    r"^\s*RedirectPermanent\b.*",
    r"^\s*RedirectMatch\b.*",
    # RewriteRule that redirects (R= flag)
    r"^\s*RewriteRule\s+.*\[.*R=?\d*.*\].*",
    # RewriteCond that checks HTTP_HOST for www
    r"^\s*RewriteCond\s+.*HTTP_HOST.*",
    # RewriteCond that checks HTTPS for redirect
    r"^\s*RewriteCond\s+.*HTTPS.*off.*",
    # RewriteRule that redirects to https (https://)
    r"^\s*RewriteRule\s+.*https://.*",
]

def is_redirect_line(line):
    for pat in REDIRECT_PATTERNS:
        if re.match(pat, line, re.IGNORECASE):
            return True
    return False

def clean_vhost_block(block_lines, is_ssl):
    """Remove all redirect lines, update or inject ProxyPass."""
    result = []
    removed = []
    
    for line in block_lines:
        if is_redirect_line(line):
            removed.append(line.rstrip())
            continue
        # Update existing ProxyPass port
        if re.search(r"ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:\d+/", line):
            line = re.sub(
                r"(ProxyPass(?:Reverse)?\s+/\s+http://127\.0\.0\.1:)\d+(/)",
                rf"\g<1>{APP_PORT}\2",
                line
            )
        # Update X-Forwarded-Proto
        if re.search(r"RequestHeader\s+set\s+X-Forwarded-Proto", line):
            expected = '"https"' if is_ssl else '"http"'
            line = re.sub(r'"https"|"http"', expected, line)
        result.append(line)
    
    # Check if ProxyPass is present after cleaning
    block_text = "".join(result)
    has_proxy = bool(re.search(r"ProxyPass\s+/\s+http://127\.0\.0\.1", block_text))
    
    if not has_proxy:
        # Inject before </VirtualHost>
        for j in range(len(result)-1, -1, -1):
            if re.match(r"\s*</VirtualHost>", result[j]):
                proxy_block = HTTPS_PROXY if is_ssl else HTTP_PROXY
                result.insert(j, proxy_block)
                break
    
    return result, removed

# Apply cleaning to each betcheza block
new_lines = list(lines)
offset = 0
total_removed = []

for block in betcheza_blocks:
    s = block["start"] + offset
    e = block["end"] + offset
    cleaned, removed = clean_vhost_block(list(new_lines[s:e]), block["is_ssl"])
    total_removed.extend(removed)
    new_lines[s:e] = cleaned
    offset += len(cleaned) - (e - s)

# ── Pass 3: remove any bare Redirect/Rewrite lines OUTSIDE VirtualHost blocks ─
# These are sometimes added by DA at the top level
final_lines = []
in_vhost = False
for line in new_lines:
    if re.search(r"<VirtualHost", line):
        in_vhost = True
    if re.search(r"</VirtualHost>", line):
        in_vhost = False
        final_lines.append(line)
        continue
    # Remove bare redirect lines outside VirtualHost for betcheza
    if not in_vhost and is_redirect_line(line):
        total_removed.append(f"[global] {line.rstrip()}")
        continue
    final_lines.append(line)

# Write output
shutil.copy(DA_CONF, DA_CONF + ".bak")
with open(DA_CONF, "w") as f:
    f.writelines(final_lines)

if total_removed:
    print(f"\nRemoved {len(total_removed)} redirect line(s):")
    for r in total_removed:
        print(f"  - {r}")
else:
    print("\nNo redirect lines found to remove (config may already be clean)")

print(f"\n✓ DA httpd.conf patched and backed up to {DA_CONF}.bak")
PYEOF

banner "3 — Trigger DirectAdmin to rebuild Apache config"
if command -v directadmin &>/dev/null; then
  echo "action=rewrite&value=httpd" | directadmin socket 2>/dev/null \
    && echo -e "${GREEN}✓ DA config rebuilt${NC}" \
    || echo -e "${YELLOW}⚠ DA socket unavailable${NC}"
fi

banner "4 — Restart Apache"
if systemctl restart httpd 2>/dev/null; then
  echo -e "${GREEN}✓ Apache restarted${NC}"
elif apachectl restart 2>/dev/null; then
  echo -e "${GREEN}✓ Apache restarted${NC}"
else
  apachectl graceful 2>/dev/null || true
  echo -e "${YELLOW}Apache reloaded (graceful)${NC}"
fi
sleep 3

banner "5 — Verify Node.js is running"
echo "PM2 status:"
pm2 list

echo ""
NODE_UP=false
for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /tmp/bz_health.json -w "%{http_code}" --max-time 15 \
    "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null; true)
  if [ "$CODE" = "200" ]; then
    DB=$(grep -o '"db":"[^"]*"' /tmp/bz_health.json 2>/dev/null | cut -d'"' -f4 || echo "?")
    echo -e "${GREEN}✓ Node.js UP on port ${APP_PORT} (db: ${DB})${NC}"
    NODE_UP=true
    break
  fi
  echo "  Health check attempt $i: HTTP $CODE — waiting 10s..."
  sleep 10
done

if [ "$NODE_UP" = "false" ]; then
  echo -e "${RED}✗ Node.js not responding! Starting fresh...${NC}"
  pm2 stop betcheza 2>/dev/null || true
  pm2 delete betcheza 2>/dev/null || true
  fuser -k "${APP_PORT}/tcp" 2>/dev/null || true
  sleep 3
  pm2 start "$APP_DIR/ecosystem.config.js"
  pm2 save
  sleep 20
  CODE=$(curl -s -o /tmp/bz_health.json -w "%{http_code}" --max-time 20 \
    "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null; true)
  if [ "$CODE" = "200" ]; then
    echo -e "${GREEN}✓ Node.js UP now${NC}"
    NODE_UP=true
  else
    echo -e "${RED}Still not responding. Check logs: pm2 logs betcheza --lines 50 --nostream${NC}"
  fi
fi

banner "6 — Test redirect chain"
echo ""
echo "Testing https://${DOMAIN}/:"
curl -sIL --max-time 15 "https://${DOMAIN}/" 2>/dev/null | grep -iE "HTTP/|location:" | head -8 || echo "  timeout"

echo ""
echo "Testing https://${WWW_DOMAIN}/:"
curl -sIL --max-time 15 "https://${WWW_DOMAIN}/" 2>/dev/null | grep -iE "HTTP/|location:" | head -8 || echo "  timeout"

echo ""
echo "Direct Node.js test:"
curl -s --max-time 15 "http://127.0.0.1:${APP_PORT}/" -o /dev/null -w "  http://127.0.0.1:${APP_PORT}/ → HTTP %{http_code}\n" 2>/dev/null || echo "  timeout"

banner "7 — Result"
echo ""
if curl -skI --max-time 15 "https://${DOMAIN}/" 2>/dev/null | head -1 | grep -q "200"; then
  echo -e "${GREEN}${BOLD}✓ betcheza.co.ke is LIVE and showing 200!${NC}"
elif curl -skI --max-time 15 "https://${WWW_DOMAIN}/" 2>/dev/null | head -1 | grep -q "200"; then
  echo -e "${GREEN}${BOLD}✓ www.betcheza.co.ke is LIVE and showing 200!${NC}"
  echo -e "${YELLOW}  Non-www still needs fixing in DirectAdmin domain settings${NC}"
else
  echo -e "${YELLOW}${BOLD}Apache may need manual config in DirectAdmin panel.${NC}"
  echo ""
  echo "If you still see ERR_TOO_MANY_REDIRECTS, do this in DirectAdmin:"
  echo ""
  echo "  1. Login to DirectAdmin → Account Manager → Domain Setup"
  echo "  2. Click on betcheza.co.ke"
  echo "  3. Find 'www Redirect' — set to NONE / disabled"
  echo "  4. Save"
  echo ""
  echo "  5. Go to Advanced Features → Apache Handlers (or Custom HTTPD Directives)"
  echo "  6. In the custom config box for betcheza.co.ke (both HTTP + HTTPS), add:"
  echo ""
  echo "     ProxyPreserveHost On"
  echo "     ProxyRequests Off"
  echo "     ProxyPass /.well-known !"
  echo "     ProxyPass / http://127.0.0.1:3001/ timeout=120 keepalive=On"
  echo "     ProxyPassReverse / http://127.0.0.1:3001/"
  echo ""
  echo "  7. Save and restart Apache"
  echo ""
  echo "Apache conf sections for betcheza:"
  grep -n "betcheza\|Redirect\|Rewrite\|ProxyPass" "$DA_CONF" 2>/dev/null | grep -A2 -B2 "betcheza" | head -40
fi
