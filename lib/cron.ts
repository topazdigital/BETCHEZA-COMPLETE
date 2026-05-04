// Lightweight server-side cron. Runs ONCE per Node process (Next.js calls
// instrumentation.ts on boot). Polls every 5 minutes and triggers our
// internal cron endpoints.
//
// Jackpot auto-sync runs every 60 minutes — checks all bookmakers for newly
// published jackpots and adds them automatically without wiping live rounds.

const TICK_MS = 5 * 60_000; // 5 min base tick
const JACKPOT_SYNC_EVERY_N_TICKS = 12; // 12 × 5min = 60min

interface CronState { started: boolean; timer: NodeJS.Timeout | null; tickCount: number }
const g = globalThis as { __betchezaCron?: CronState };
g.__betchezaCron = g.__betchezaCron || { started: false, timer: null, tickCount: 0 };
const state = g.__betchezaCron;

function getBaseUrl(): string {
  return (
    process.env.INTERNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
    'http://localhost:5000'
  );
}

async function runMatchReminders(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/match-reminders`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron'}` },
    });
    if (!r.ok) console.warn('[cron] match-reminders failed:', r.status);
  } catch (e) {
    console.warn('[cron] match-reminders error', e instanceof Error ? e.message : e);
  }
}

async function runJackpotSync(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/jackpot-sync`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron'}` },
    });
    if (!r.ok) {
      console.warn('[cron] jackpot-sync failed:', r.status);
    } else {
      const data = await r.json() as { message?: string; created?: number; refreshed?: number; skipped?: number };
      console.log(`[cron] jackpot-sync: ${data.message ?? `created=${data.created} refreshed=${data.refreshed} skipped=${data.skipped}`}`);
    }
  } catch (e) {
    console.warn('[cron] jackpot-sync error', e instanceof Error ? e.message : e);
  }
}

async function tick(): Promise<void> {
  state.tickCount++;
  void runMatchReminders();

  // Run jackpot sync every JACKPOT_SYNC_EVERY_N_TICKS ticks (every 60 minutes)
  if (state.tickCount % JACKPOT_SYNC_EVERY_N_TICKS === 0) {
    void runJackpotSync();
  }
}

export function startCron(): void {
  if (state.started) return;
  state.started = true;

  // First tick: match reminders after 30s, jackpot sync after 10s (initial population)
  setTimeout(() => { void runMatchReminders(); }, 30_000);
  setTimeout(() => { void runJackpotSync(); }, 10_000);

  state.timer = setInterval(() => { void tick(); }, TICK_MS);
  console.log('[cron] started — match-reminders (5 min), jackpot-sync (60 min, first run in 10s)');
}
