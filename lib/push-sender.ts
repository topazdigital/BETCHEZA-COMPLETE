/**
 * Thin wrapper around web-push for sending browser push notifications.
 * Requires VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT env vars.
 * Gracefully no-ops if keys are missing (dev fallback).
 */

import type { PushSubscriptionRow } from './notification-store';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
}

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@betcheza.co.ke';
  return { publicKey, privateKey, subject };
}

/** List all push subscriptions that include `topic` in their topics array. */
export async function listTopicSubscriptions(topic: string): Promise<PushSubscriptionRow[]> {
  const { listPushSubscriptions } = await import('./notification-store');
  const all = await listPushSubscriptions();
  return all.filter(s => s.topics.includes(topic));
}

/** Send a push notification to one subscription. Removes it on 410 Gone. */
export async function sendPushToSubscription(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<void> {
  const { publicKey, privateKey, subject } = getVapidKeys();

  if (!publicKey || !privateKey) {
    // VAPID not configured — log intent and skip
    console.log(`[push] VAPID not set — would notify: ${payload.title}`);
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpush = require('web-push') as typeof import('web-push');
    webpush.setVapidDetails(subject, publicKey, privateKey);

    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/jackpots',
        tag: payload.tag || 'betcheza',
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-72.png',
      }),
    );
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired — clean up
      const { deletePushSubscription } = await import('./notification-store');
      await deletePushSubscription(sub.endpoint).catch(() => {});
    } else {
      console.warn('[push] send failed:', err instanceof Error ? err.message : err);
    }
  }
}

/** Send to all subscribers of a topic. */
export async function sendPushToTopic(topic: string, payload: PushPayload): Promise<number> {
  const subs = await listTopicSubscriptions(topic);
  if (subs.length === 0) return 0;
  await Promise.allSettled(subs.map(s => sendPushToSubscription(s, payload)));
  return subs.length;
}
