/**
 * Sends a web-push notification to all subscribers when a strategy day
 * is fully settled (all picks resolved WIN or LOSS).
 *
 * Uses a process-lifetime dedup set so the notification fires at most once
 * per date, even if the settlement cron runs multiple times in quick
 * succession or both the cron and the admin resettle path settle the same day.
 */
import { listPushSubscriptions } from './notification-store';
import { sendPushToSubscription } from './push-sender';
import type { StrategyPick } from '@/app/api/strategy/predictions/route';

const g = globalThis as { __strategyNotifiedDays?: Set<string> };
if (!g.__strategyNotifiedDays) g.__strategyNotifiedDays = new Set();

export async function sendStrategyResultPush(
  date: string,
  dayNumber: number,
  result: 'win' | 'loss',
  picks: StrategyPick[],
): Promise<void> {
  const dedupeKey = `strategy-result-${date}`;
  if (g.__strategyNotifiedDays!.has(dedupeKey)) return;
  g.__strategyNotifiedDays!.add(dedupeKey);

  const combinedOdds = picks.reduce((acc, p) => acc * (p.odds || 1), 1);
  const oddsStr = combinedOdds.toFixed(2) + 'x';
  const pickCount = picks.length;

  const isWin = result === 'win';
  const title = isWin
    ? `🏆 Day ${dayNumber} Strategy: WIN!`
    : `❌ Day ${dayNumber} Strategy: Loss`;
  const body = isWin
    ? `All ${pickCount} picks WON at combined ${oddsStr} — great day! 🎉`
    : `Today's ${pickCount} picks didn't come through (combined ${oddsStr}). Check tomorrow's picks.`;

  try {
    const allSubs = await listPushSubscriptions();
    if (allSubs.length === 0) return;

    const results = await Promise.allSettled(
      allSubs.map(sub =>
        sendPushToSubscription(sub, {
          title,
          body,
          url: '/strategy',
          tag: `strategy-result-${date}`,
          icon: '/icon-192.png',
          requireInteraction: isWin,
        })
      )
    );
    const sent = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[strategy-push] Day ${dayNumber} ${result.toUpperCase()} pushed to ${sent}/${allSubs.length} subscribers (${oddsStr})`);
  } catch (e) {
    console.warn('[strategy-push] push failed:', e instanceof Error ? e.message : e);
  }
}
