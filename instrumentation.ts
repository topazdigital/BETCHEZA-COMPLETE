// Next.js calls this once when the server process starts (both `next dev`
// and `next start`). We use it to kick off our background cron loop for
// match-kickoff reminders.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startCron } = await import('./lib/cron');
  startCron();
}
