// In-memory activity log for the Auto-Tip Generator admin panel.
// Persists in a global so it survives Next.js dev hot-reloads.

export interface ActivityEntry {
  ts: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

const g = globalThis as { __autoTipActivity?: ActivityEntry[] };
g.__autoTipActivity = g.__autoTipActivity || [];
const log = g.__autoTipActivity;

const MAX = 200;

export function pushActivity(level: ActivityEntry['level'], message: string) {
  log.unshift({ ts: new Date().toISOString(), level, message });
  if (log.length > MAX) log.length = MAX;
}

export function listActivity(limit = 100): ActivityEntry[] {
  return log.slice(0, limit);
}

export function clearActivity() {
  log.length = 0;
}
