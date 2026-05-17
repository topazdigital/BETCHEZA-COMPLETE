// Lightweight server-side cron. Runs ONCE per Node process (Next.js calls
// instrumentation.ts on boot). Polls every 5 minutes and triggers our
// internal cron endpoints.
//
// Jackpot auto-sync runs every 60 minutes — checks all bookmakers for newly
// published jackpots and adds them automatically without wiping live rounds.
// Daily strategy auto-posts at 9:00 AM EAT (06:00 UTC) every day.

const TICK_MS = 5 * 60_000; // 5 min base tick
const JACKPOT_SYNC_EVERY_N_TICKS = 12; // 12 × 5min = 60min

interface CronState {
  started: boolean;
  timer: NodeJS.Timeout | null;
  tickCount: number;
  lastStrategyDate: string;
}
const g = globalThis as { __betchezaCron?: CronState };
g.__betchezaCron = g.__betchezaCron || { started: false, timer: null, tickCount: 0, lastStrategyDate: '' };
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
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
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
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
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

async function runLiveScores(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/live-scores`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) console.warn('[cron] live-scores failed:', r.status);
  } catch (e) {
    console.warn('[cron] live-scores error', e instanceof Error ? e.message : e);
  }
}

async function runDailyStrategy(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (state.lastStrategyDate === todayStr) return; // already ran today
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/daily-strategy`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) {
      console.warn('[cron] daily-strategy failed:', r.status);
    } else {
      state.lastStrategyDate = todayStr;
      const data = await r.json() as { date?: string; picks?: unknown[]; message?: string };
      console.log(`[cron] daily-strategy: ${data.message ?? `posted ${data.picks?.length ?? 0} picks for ${data.date}`}`);
    }
  } catch (e) {
    console.warn('[cron] daily-strategy error', e instanceof Error ? e.message : e);
  }
}

function isStrategyTime(): boolean {
  const now = new Date();
  // 9:00 AM EAT = 06:00 UTC. Run if UTC hour is 6 and minutes 0–4 (within first 5-min tick window)
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  return utcHour === 6 && utcMin < 5;
}

const LIVE_SCORES_EVERY_N_TICKS = 1; // every 5-min tick (fast enough for goal alerts)
const FAKE_ACTIVITY_EVERY_N_TICKS = 6; // every 30 min — seeds feed posts from fake tipsters

async function runFakeActivity(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/fake-activity`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) console.warn('[cron] fake-activity failed:', r.status);
  } catch (e) {
    console.warn('[cron] fake-activity error', e instanceof Error ? e.message : e);
  }
}

async function tick(): Promise<void> {
  state.tickCount++;
  void runMatchReminders();
  void runLiveScores();

  if (state.tickCount % JACKPOT_SYNC_EVERY_N_TICKS === 0) {
    void runJackpotSync();
  }

  if (state.tickCount % FAKE_ACTIVITY_EVERY_N_TICKS === 0) {
    void runFakeActivity();
  }

  if (isStrategyTime()) {
    void runDailyStrategy();
  }
}

export function startCron(): void {
  if (state.started) return;
  state.started = true;

  // Delay startup cron jobs to allow Turbopack to lazy-compile API routes first.
  // Next.js 16 with Turbopack compiles routes on first request — if we hit them
  // too early we get 404. These delays give the server time to warm up.
  setTimeout(() => { void runMatchReminders(); }, 120_000);   // 2 min
  setTimeout(() => { void runJackpotSync(); }, 180_000);       // 3 min

  // Auto-post daily strategy on startup if it hasn't been posted today yet
  // and it's past 9am EAT (6am UTC)
  setTimeout(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    if (utcHour >= 6) {
      void runDailyStrategy();
    }
  }, 240_000); // 4 min

  // Seed community feed posts on startup (5 min delay)
  setTimeout(() => { void runFakeActivity(); }, 300_000); // 5 min

  state.timer = setInterval(() => { void tick(); }, TICK_MS);
  console.log('[cron] started — match-reminders (5 min), live-scores (5 min), fake-activity (30 min), jackpot-sync (60 min), daily-strategy (9am EAT)');
}
