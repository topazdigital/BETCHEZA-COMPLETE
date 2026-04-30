// Lightweight server-side cron. Runs ONCE per Node process (Next.js calls
// instrumentation.ts on boot). Polls every 5 minutes and triggers our
// internal cron endpoints.
//
// In production with multiple instances each instance polls — that's fine
// because the dispatcher dedupes per (matchId, userId) in-process. With a
// shared DB you'd add a `sent_reminders` table to dedupe globally.

const TICK_MS = 5 * 60_000;

interface CronState { started: boolean; timer: NodeJS.Timeout | null }
const g = globalThis as { __betchezaCron?: CronState };
g.__betchezaCron = g.__betchezaCron || { started: false, timer: null };
const state = g.__betchezaCron;

async function runMatchReminders(): Promise<void> {
  const base = process.env.INTERNAL_BASE_URL
    || process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || 'http://localhost:5000';
  try {
    const r = await fetch(`${base}/api/cron/match-reminders`, { cache: 'no-store' });
    if (!r.ok) console.warn('[cron] match-reminders failed:', r.status);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[cron] match-reminders error', e instanceof Error ? e.message : e);
  }
}

export function startCron(): void {
  if (state.started) return;
  state.started = true;
  // First tick after 30s so the server has time to come up.
  setTimeout(() => { void runMatchReminders(); }, 30_000);
  state.timer = setInterval(() => { void runMatchReminders(); }, TICK_MS);
  // eslint-disable-next-line no-console
  console.log('[cron] started match-reminders interval (5 min)');
}
