import { listEmailSubscribers } from './notification-store';
import { sendBulkMailBatched } from './mailer';
import { buildJackpotAlertEmail } from './email-templates/jackpot-alert';
import { SUPPORTED_BOOKMAKERS } from './jackpot-types';
import type { Jackpot } from './jackpot-types';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.co.ke';
export async function sendJackpotNotification(jackpot: Jackpot, opts?: { perEmailDelayMs?: number }): Promise<{ sent: number; failed: number; skipped: boolean; total: number; recipientCount: number }> {
  const bookmaker = SUPPORTED_BOOKMAKERS.find(b => b.slug === jackpot.bookmakerSlug);
  const bookmakerColor = bookmaker?.color ?? '#7c3aed';
  const specificTopic = jackpot.bookmakerSlug + '_jackpot';
  const [generalSubs, specificSubs] = await Promise.all([listEmailSubscribers('jackpot_alerts'), listEmailSubscribers(specificTopic)]);
  const emailSet = new Set<string>();
  const recipients: Array<{ email: string; unsubscribeToken: string }> = [];
  for (const sub of [...generalSubs, ...specificSubs]) {
    if (!emailSet.has(sub.email)) { emailSet.add(sub.email); recipients.push({ email: sub.email, unsubscribeToken: sub.unsubscribeToken }); }
  }
  if (recipients.length === 0) return { sent: 0, failed: 0, skipped: true, total: 0, recipientCount: 0 };
  const topPicks = jackpot.games.filter(g => g.aiPrediction || g.prediction).map(g => ({ home: g.home, away: g.away, pick: (g.aiPrediction || g.prediction) as string }));
  const jackpotUrl = APP_URL + '/jackpots/' + jackpot.bookmakerSlug;
  let sent = 0; let failed = 0;
  for (const recipient of recipients) {
    const { subject, html, text } = buildJackpotAlertEmail({ bookmakerName: jackpot.bookmakerName, bookmakerColor, jackpotTitle: jackpot.title, jackpotAmount: jackpot.jackpotAmount, currency: jackpot.currency, deadline: jackpot.deadline, gamesCount: jackpot.games.length, topPicks, jackpotUrl, unsubscribeUrl: '/api/email/unsubscribe?token=' + recipient.unsubscribeToken, appUrl: APP_URL });
    const result = await sendBulkMailBatched([recipient.email], subject, html, text, { batchSize: 1, perEmailDelayMs: opts?.perEmailDelayMs ?? 80, perBatchDelayMs: 0 });
    sent += result.sent; failed += result.failed;
    if (result.skipped) return { sent: 0, failed: 0, skipped: true, total: recipients.length, recipientCount: recipients.length };
  }
  return { sent, failed, skipped: false, total: recipients.length, recipientCount: recipients.length };
}
