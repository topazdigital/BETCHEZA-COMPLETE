// Lightweight server-side cron. Runs ONCE per Node process (Next.js calls
// instrumentation.ts on boot). Polls every 5 minutes and triggers our
// internal cron endpoints.
//
// Jackpot auto-sync runs every 60 minutes — checks all bookmakers for newly
// published jackpots and adds them automatically without wiping live rounds.
// Daily strategy auto-posts at 9:00 AM EAT (06:00 UTC) every day.

const TICK_MS = 5 * 60_000; // 5 min base tick
const JACKPOT_SYNC_EVERY_N_TICKS = 12;           // 12 × 5min = 60min
const COMPETITION_SETTLE_EVERY_N_TICKS = 12;      // every 60min
const COMPETITION_RULE_CHECK_EVERY_N_TICKS = 12;  // every 60min

interface CronState {
  started: boolean;
  timer: NodeJS.Timeout | null;
  tickCount: number;
  lastStrategyDate: string;
  lastWeeklyReportDate: string;
}
const g = globalThis as { __betchezaCron?: CronState };
g.__betchezaCron = g.__betchezaCron || { started: false, timer: null, tickCount: 0, lastStrategyDate: '', lastWeeklyReportDate: '' };
const state = g.__betchezaCron;

function getBaseUrl(): string {
  return (
    process.env.INTERNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
    `http://localhost:${process.env.PORT || 5000}`
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
      // Fire the Tip of the Day notification 2 minutes after picks are generated
      setTimeout(() => { void runTipOfTheDay(); }, 2 * 60 * 1000);
    }
  } catch (e) {
    console.warn('[cron] daily-strategy error', e instanceof Error ? e.message : e);
  }
}

async function runTipOfTheDay(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/tip-of-the-day`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) {
      console.warn('[cron] tip-of-the-day failed:', r.status);
    } else {
      const data = await r.json() as { ok: boolean; skipped?: boolean; pick?: { match: string; pick: string; odds: number }; pushCount?: number; inAppCount?: number };
      if (data.skipped) {
        console.log('[cron] tip-of-the-day: already sent today');
      } else if (data.ok && data.pick) {
        console.log(`[cron] tip-of-the-day: sent "${data.pick.pick} @ ${data.pick.odds}" to ${data.pushCount ?? 0} push + ${data.inAppCount ?? 0} in-app`);
      }
    }
  } catch (e) {
    console.warn('[cron] tip-of-the-day error', e instanceof Error ? e.message : e);
  }
}

function isStrategyTime(): boolean {
  const now = new Date();
  // 9:00 AM EAT = 06:00 UTC. Run if UTC hour is 6 and minutes 0–4 (within first 5-min tick window)
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  return utcHour === 6 && utcMin < 5;
}

const LIVE_SCORES_EVERY_N_TICKS = 1;           // every 5-min tick (fast enough for goal alerts)
const CHALLENGE_STATUS_EVERY_N_TICKS = 1;      // every 5-min tick — keeps match_status in DB accurate
const FAKE_ACTIVITY_EVERY_N_TICKS = 3;         // every 15 min
const FAKE_VOTES_EVERY_N_TICKS = 6;            // every 30 min
const SETTLE_TIPS_EVERY_N_TICKS = 6;           // every 30 min — settles old pending auto-tips

async function runSettleTips(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/settle-tips`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) {
      console.warn('[cron] settle-tips failed:', r.status);
    } else {
      const data = await r.json() as { ok?: boolean; settled?: number; corrected?: number };
      if ((data.settled ?? 0) > 0) {
        console.log(`[cron] settle-tips: settled ${data.settled} tips`);
      }
    }
  } catch (e) {
    console.warn('[cron] settle-tips error', e instanceof Error ? e.message : e);
  }
}

async function runChallengeStatusSync(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/challenge-status-sync`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) {
      console.warn('[cron] challenge-status-sync failed:', r.status);
    } else {
      const data = await r.json() as { ok?: boolean; skipped?: boolean; checked?: number; updated?: number; settled?: number; cancelled?: number };
      if (!data.skipped && ((data.updated ?? 0) > 0 || (data.settled ?? 0) > 0)) {
        console.log(`[cron] challenge-status-sync: checked=${data.checked} updated=${data.updated} settled=${data.settled} cancelled=${data.cancelled}`);
      }
    }
  } catch (e) {
    console.warn('[cron] challenge-status-sync error', e instanceof Error ? e.message : e);
  }
}

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

async function runFakeVotes(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/fake-votes?secret=${process.env.CRON_SECRET || 'betcheza-cron-2024'}`, {
      cache: 'no-store',
    });
    if (!r.ok) console.warn('[cron] fake-votes failed:', r.status);
  } catch (e) {
    console.warn('[cron] fake-votes error', e instanceof Error ? e.message : e);
  }
}

async function runCompetitionRuleCheck(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/competition-rule-check`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) {
      console.warn('[cron] competition-rule-check failed:', r.status);
    } else {
      const data = await r.json() as { checked?: number; kicked?: number };
      if ((data.kicked ?? 0) > 0) {
        console.log(`[cron] competition-rule-check: checked ${data.checked} comps, kicked ${data.kicked} violators`);
      }
    }
  } catch (e) {
    console.warn('[cron] competition-rule-check error', e instanceof Error ? e.message : e);
  }
}

async function runCompetitionSettle(): Promise<void> {
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/competition-settle`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) {
      console.warn('[cron] competition-settle failed:', r.status);
    } else {
      const data = await r.json() as { processed: number; competitions: Array<{ name: string; action: string }> };
      if (data.processed > 0) {
        console.log(`[cron] competition-settle: ${data.processed} processed — ${data.competitions.map(c => `${c.name} (${c.action})`).join(', ')}`);
      }
    }
  } catch (e) {
    console.warn('[cron] competition-settle error', e instanceof Error ? e.message : e);
  }
}

async function runWeeklyTipsterReport(): Promise<void> {
  // Only run on Sundays
  if (new Date().getDay() !== 0) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  if (state.lastWeeklyReportDate === todayStr) return;
  try {
    const r = await fetch(`${getBaseUrl()}/api/cron/weekly-tipster-report`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'betcheza-cron-2024'}` },
    });
    if (!r.ok) {
      console.warn('[cron] weekly-tipster-report failed:', r.status);
    } else {
      state.lastWeeklyReportDate = todayStr;
      const data = await r.json() as { sent?: number; skipped?: boolean; week?: string };
      if (!data.skipped) {
        console.log(`[cron] weekly-tipster-report: sent ${data.sent ?? 0} emails for week ${data.week}`);
      }
    }
  } catch (e) {
    console.warn('[cron] weekly-tipster-report error', e instanceof Error ? e.message : e);
  }
}

async function tick(): Promise<void> {
  state.tickCount++;
  void runMatchReminders();
  void runLiveScores();
  void runChallengeStatusSync();

  if (state.tickCount % FAKE_ACTIVITY_EVERY_N_TICKS === 0) {
    void runFakeActivity();
  }

  if (state.tickCount % FAKE_VOTES_EVERY_N_TICKS === 0) {
    void runFakeVotes();
  }

  if (state.tickCount % SETTLE_TIPS_EVERY_N_TICKS === 0) {
    void runSettleTips();
  }

  if (state.tickCount % JACKPOT_SYNC_EVERY_N_TICKS === 0) {
    void runJackpotSync();
  }

  if (state.tickCount % COMPETITION_SETTLE_EVERY_N_TICKS === 0) {
    void runCompetitionSettle();
  }

  if (state.tickCount % COMPETITION_RULE_CHECK_EVERY_N_TICKS === 0) {
    void runCompetitionRuleCheck();
  }

  if (isStrategyTime()) {
    void runDailyStrategy();
  }

  // Weekly tipster report — Sunday morning EAT (06:00 UTC = 9am EAT)
  if (new Date().getDay() === 0 && isStrategyTime()) {
    void runWeeklyTipsterReport();
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
  setTimeout(() => { void runFakeActivity(); }, 90_000);       // 90 s — seed initial feed posts
  setTimeout(() => { void runSettleTips(); }, 300_000);        // 5 min — clear any stale pending tips on startup
  setTimeout(() => { void runChallengeStatusSync(); }, 150_000); // 2.5 min — sync challenge match_status from API

  // Auto-post daily strategy on startup if it hasn't been posted today yet
  // and it's past 9am EAT (6am UTC)
  setTimeout(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    if (utcHour >= 6) {
      void runDailyStrategy();
    }
  }, 240_000); // 4 min

  // Fire Tip of the Day on startup if it's past 9:05am EAT (6:05 UTC) and
  // daily-strategy has already run (picks exist). The 2-min chain from
  // runDailyStrategy handles fresh runs; this covers restarts after 9am.
  setTimeout(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    if (utcHour > 6 || (utcHour === 6 && utcMin >= 5)) {
      void runTipOfTheDay();
    }
  }, 270_000); // 4.5 min (after daily-strategy has had time to run)

  state.timer = setInterval(() => { void tick(); }, TICK_MS);
  console.log('[cron] started — match-reminders (5 min), live-scores (5 min), challenge-status-sync (5 min), fake-activity (15 min), fake-votes (30 min), settle-tips (30 min), jackpot-sync (60 min), daily-strategy + tip-of-the-day (9am EAT)');
}
