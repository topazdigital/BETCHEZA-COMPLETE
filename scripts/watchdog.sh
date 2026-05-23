#!/bin/bash
# Betcheza Watchdog — pings /api/health every 5 min via system cron.
# If the app doesn't respond, it restarts PM2 and logs the event.
#
# Install (run once on server as root):
#   chmod +x /home/admin/apps/betcheza/scripts/watchdog.sh
#   echo "*/5 * * * * root /home/admin/apps/betcheza/scripts/watchdog.sh" \
#     >> /etc/cron.d/betcheza-watchdog

APP_NAME="betcheza"
APP_PORT="${1:-3001}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"
LOG_FILE="/root/.pm2/logs/betcheza-watchdog.log"
MAX_LOG_LINES=500

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

log() {
  echo "[$(timestamp)] $*" >> "$LOG_FILE"
}

# Rotate log if it gets too long
LINE_COUNT=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$LINE_COUNT" -gt "$MAX_LOG_LINES" ]; then
  tail -n 200 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

# Ping the health endpoint (3 second timeout)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$HEALTH_URL" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
  # App is healthy — silent exit (no noise in logs)
  exit 0
fi

# App is not responding — log and restart
log "ALERT: /api/health returned HTTP ${HTTP_CODE:-000} on port ${APP_PORT} — restarting ${APP_NAME}"

# Try graceful restart first
pm2 restart "$APP_NAME" --update-env >> "$LOG_FILE" 2>&1

# Wait up to 20s for it to come back
WAITED=0
while [ $WAITED -lt 20 ]; do
  sleep 4
  WAITED=$((WAITED + 4))
  CHECK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$HEALTH_URL" 2>/dev/null)
  if [ "$CHECK" = "200" ]; then
    log "RECOVERED: ${APP_NAME} is back up after ${WAITED}s"
    exit 0
  fi
done

# Still down — force kill the port and do a hard restart
log "WARN: Still down after ${WAITED}s — force-killing port ${APP_PORT} and restarting"
fuser -k -KILL "${APP_PORT}/tcp" 2>/dev/null || true
lsof -ti:"${APP_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2
pm2 start "$APP_NAME" --update-env >> "$LOG_FILE" 2>&1
pm2 save >> "$LOG_FILE" 2>&1

sleep 5
FINAL=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$HEALTH_URL" 2>/dev/null)
if [ "$FINAL" = "200" ]; then
  log "RECOVERED: ${APP_NAME} is back up after force restart"
else
  log "CRITICAL: ${APP_NAME} still down after force restart — manual intervention needed!"
fi
