#!/bin/bash
# Betcheza Watchdog — pings /api/health every 5 min via system cron.
# Restarts the app if unhealthy and emails alert + recovery notices.
#
# Install (run once on server as root):
#   chmod +x /home/admin/apps/betcheza/scripts/watchdog.sh
#   echo "*/5 * * * * root /home/admin/apps/betcheza/scripts/watchdog.sh" \
#     >> /etc/cron.d/betcheza-watchdog

APP_NAME="betcheza"
APP_DIR="/home/admin/apps/betcheza"
APP_PORT="${1:-3001}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"
LOG_FILE="/root/.pm2/logs/betcheza-watchdog.log"
MAX_LOG_LINES=500

ALERT_EMAIL="patrickndungu.pnn@gmail.com"
FROM_EMAIL="betcheza@betcheza.co.ke"
SITE_NAME="Betcheza"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

log() {
  echo "[$(timestamp)] $*" >> "$LOG_FILE"
}

send_email() {
  local SUBJECT="$1"
  local BODY="$2"
  # Try mail first, then sendmail
  if command -v mail &>/dev/null; then
    echo "$BODY" | mail -s "$SUBJECT" -r "$FROM_EMAIL" "$ALERT_EMAIL" 2>/dev/null
  elif command -v sendmail &>/dev/null; then
    printf "To: %s\nFrom: %s\nSubject: %s\n\n%s\n" \
      "$ALERT_EMAIL" "$FROM_EMAIL" "$SUBJECT" "$BODY" \
      | sendmail -t 2>/dev/null
  fi
}

# Rotate log if it gets too long
LINE_COUNT=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$LINE_COUNT" -gt "$MAX_LOG_LINES" ]; then
  tail -n 200 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

# ── Health check ──────────────────────────────────────────────────────────────
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
  # App is healthy — silent exit
  exit 0
fi

# ── App is down ───────────────────────────────────────────────────────────────
DOWN_TIME="$(timestamp)"
log "ALERT: /api/health returned HTTP ${HTTP_CODE:-000} on port ${APP_PORT} — restarting ${APP_NAME}"

# Send down alert
send_email \
  "🔴 [${SITE_NAME}] Site is DOWN — $(date '+%d %b %Y %H:%M')" \
  "Betcheza (betcheza.co.ke) is not responding.

Time:     ${DOWN_TIME}
Port:     ${APP_PORT}
HTTP:     ${HTTP_CODE:-no response}
URL:      http://127.0.0.1:${APP_PORT}/api/health

Attempting automatic restart now...

-- Betcheza Watchdog"

# ── Graceful restart ──────────────────────────────────────────────────────────
pm2 restart "$APP_NAME" --update-env >> "$LOG_FILE" 2>&1

# Wait up to 30s for graceful recovery
WAITED=0
while [ $WAITED -lt 30 ]; do
  sleep 5
  WAITED=$((WAITED + 5))
  CHECK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null)
  if [ "$CHECK" = "200" ]; then
    log "RECOVERED: ${APP_NAME} back up after ${WAITED}s (graceful restart)"
    send_email \
      "✅ [${SITE_NAME}] Site RECOVERED — $(date '+%d %b %Y %H:%M')" \
      "Betcheza (betcheza.co.ke) is back online.

Down at:    ${DOWN_TIME}
Recovered:  $(timestamp)
Downtime:   ~${WAITED}s
Method:     Graceful PM2 restart

-- Betcheza Watchdog"
    exit 0
  fi
done

# ── Force restart ─────────────────────────────────────────────────────────────
log "WARN: Still down after ${WAITED}s — force-killing port ${APP_PORT} and restarting"
fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
lsof -ti:"${APP_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 3

# Delete and start fresh from ecosystem config
pm2 delete "$APP_NAME" 2>/dev/null || true
sleep 1
if [ -f "$APP_DIR/ecosystem.config.js" ]; then
  pm2 start "$APP_DIR/ecosystem.config.js" >> "$LOG_FILE" 2>&1
else
  PORT="$APP_PORT" pm2 start npm --name "$APP_NAME" -- start >> "$LOG_FILE" 2>&1
fi
pm2 save >> "$LOG_FILE" 2>&1

sleep 10
FINAL=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null)

if [ "$FINAL" = "200" ]; then
  log "RECOVERED: ${APP_NAME} back up after force restart"
  send_email \
    "✅ [${SITE_NAME}] Site RECOVERED (force restart) — $(date '+%d %b %Y %H:%M')" \
    "Betcheza (betcheza.co.ke) is back online after a force restart.

Down at:    ${DOWN_TIME}
Recovered:  $(timestamp)
Method:     Force kill + fresh PM2 start

-- Betcheza Watchdog"
else
  log "CRITICAL: ${APP_NAME} still down after force restart — manual intervention needed!"
  send_email \
    "🚨 CRITICAL [${SITE_NAME}] Site STILL DOWN — manual fix needed!" \
    "Betcheza (betcheza.co.ke) failed to recover automatically.

Down at:      ${DOWN_TIME}
Last checked: $(timestamp)
Port:         ${APP_PORT}

Automatic recovery FAILED. Please SSH into the server:

  ssh root@157.250.205.180
  cd /home/admin/apps/betcheza
  pm2 logs betcheza --lines 50
  ./deploy.sh

-- Betcheza Watchdog"
fi
