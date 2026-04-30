'use client';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BLg2P3-1UoNSjlrh-uXZH4t8Wm8QkP_4wLUZsv9zRRrGgQUBJSyvm1Z8XTwLrvW2K-G79kIgJh3pZEUbm1uvrhE';

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function ensurePushSubscribed(opts: { topics?: string[]; countryCode?: string | null } = {}): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'Push not supported by this browser' };

  // Permission
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, error: permission === 'denied' ? 'Notifications are blocked in browser settings' : 'Permission not granted' };
  }

  try {
    // Register service worker
    let registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const payload = {
      endpoint: json.endpoint || subscription.endpoint,
      keys: {
        p256dh: json.keys?.p256dh || arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: json.keys?.auth || arrayBufferToBase64(subscription.getKey('auth')),
      },
      topics: opts.topics || ['general'],
      countryCode: opts.countryCode || null,
    };

    const r = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return { ok: false, error: data.error || 'Subscription save failed' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Push registration failed' };
  }
}

export async function unsubscribePush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) return sub.unsubscribe();
  } catch {}
  return false;
}
