/**
 * Push + in-app notifications for challenge participants.
 *
 * Covers two lifecycle events:
 *  1. Match went live  — sent to both participants when match_status flips scheduled→live.
 *  2. Challenge settled — sent to each participant with a personalised win/loss/draw message.
 *
 * Only real (non-fake) user IDs receive notifications.
 * All errors are swallowed — notifications are non-critical.
 */
import { isFakeUserId } from './challenges-store';

interface SettledPayload {
  challengeId: number;
  challengerId: number;
  challengedId: number | null;
  winnerId: number | null;
  draw: boolean;
  homeTeam: string;
  awayTeam: string;
  score: string;
  challengerName: string;
  challengedName: string;
}

async function pushToUser(
  userId: number,
  title: string,
  body: string,
  url: string,
  tag: string,
): Promise<void> {
  try {
    const { listPushSubscriptions } = await import('./notification-store');
    const { sendPushToSubscription } = await import('./push-sender');
    const subs = await listPushSubscriptions(userId);
    await Promise.allSettled(subs.map(s => sendPushToSubscription(s, { title, body, url, tag })));
  } catch { /* non-critical */ }
}

async function inAppNotify(
  userId: number,
  type: string,
  title: string,
  content: string,
  link: string,
): Promise<void> {
  try {
    const { createNotification } = await import('./notification-store');
    await createNotification({ userId, type, title, content, link, channel: 'inapp' });
  } catch { /* non-critical */ }
}

function realUsers(...ids: (number | null | undefined)[]): number[] {
  return ids.filter((id): id is number => typeof id === 'number' && !isFakeUserId(id));
}

/**
 * Notify both challenge participants that their match has kicked off.
 * Call this when match_status transitions from 'scheduled' → 'live'.
 */
export async function notifyParticipantsMatchLive(params: {
  challengeId: number;
  challengerId: number;
  challengedId: number | null;
  homeTeam: string;
  awayTeam: string;
  isFake: boolean;
}): Promise<void> {
  if (params.isFake) return;
  const { challengeId, challengerId, challengedId, homeTeam, awayTeam } = params;
  const users = realUsers(challengerId, challengedId);
  if (!users.length) return;

  const title = '⚔️ Your Challenge is LIVE!';
  const body = `${homeTeam} vs ${awayTeam} has kicked off. Watch the scores update in real time.`;
  const url = '/challenges';
  const tag = `challenge-live-${challengeId}`;

  await Promise.allSettled(users.map(uid => Promise.all([
    pushToUser(uid, title, body, url, tag),
    inAppNotify(uid, 'challenge_live', title, body, url),
  ])));
}

/**
 * Notify both challenge participants of the final result.
 * Call this immediately after settleChallenge() resolves.
 */
export async function notifyParticipantsSettled(params: SettledPayload): Promise<void> {
  const { challengeId, challengerId, challengedId, winnerId, draw, homeTeam, awayTeam, score, challengerName, challengedName } = params;
  const matchLabel = `${homeTeam} vs ${awayTeam}`;
  const url = '/challenges';

  async function notifyOne(uid: number, isWinner: boolean | null): Promise<void> {
    if (isFakeUserId(uid)) return;
    let title: string;
    let body: string;
    const tag = `challenge-settled-${challengeId}`;

    if (draw) {
      title = '🤝 Challenge Draw';
      body = `${matchLabel} ended ${score}. It's a draw — your stake has been refunded.`;
    } else if (isWinner) {
      title = '🏆 You Won the Challenge!';
      const opponentName = uid === challengerId ? challengedName : challengerName;
      body = `${matchLabel} ended ${score}. You beat ${opponentName}! Prize on its way.`;
    } else {
      title = '😔 Challenge Result';
      const winnerName = winnerId === challengerId ? challengerName : challengedName;
      body = `${matchLabel} ended ${score}. ${winnerName} won this one. Better luck next time!`;
    }

    await Promise.all([
      pushToUser(uid, title, body, url, tag),
      inAppNotify(uid, 'challenge_settled', title, body, url),
    ]);
  }

  const tasks: Promise<void>[] = [];

  if (typeof challengerId === 'number') {
    tasks.push(notifyOne(challengerId, draw ? null : winnerId === challengerId));
  }
  if (typeof challengedId === 'number') {
    tasks.push(notifyOne(challengedId, draw ? null : winnerId === challengedId));
  }

  await Promise.allSettled(tasks);
}
