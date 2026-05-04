'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = 'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported';

export function JackpotNotifyButton({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (sub) setStatus('subscribed');
      });
    }).catch(() => {});
  }, []);

  async function subscribe() {
    if (status === 'loading') return;
    setStatus('loading');

    try {
      // Get VAPID public key
      const keyRes = await fetch('/api/notifications/vapid-public-key');
      const { publicKey } = await keyRes.json() as { publicKey: string | null };

      if (!publicKey) {
        // No VAPID — store intent in localStorage and show subscribed state
        localStorage.setItem('betcheza_jackpot_notify', '1');
        setStatus('subscribed');
        return;
      }

      // Request notification permission
      const perm = await Notification.requestPermission();
      if (perm === 'denied') { setStatus('denied'); return; }
      if (perm !== 'granted') { setStatus('idle'); return; }

      // Register service worker and subscribe
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as string,
      });

      const subJson = sub.toJSON();
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
          topics: ['jackpots', 'general'],
          countryCode: 'KE',
        }),
      });

      setStatus('subscribed');
    } catch (e) {
      console.warn('[JackpotNotifyButton] subscribe failed', e);
      setStatus('idle');
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      localStorage.removeItem('betcheza_jackpot_notify');
      setStatus('idle');
    } catch { setStatus('idle'); }
  }

  if (status === 'unsupported') return null;

  if (status === 'subscribed') {
    return (
      <button
        onClick={unsubscribe}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
          'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800',
          'hover:bg-green-200 dark:hover:bg-green-950/60',
          className
        )}
        title="Click to turn off jackpot notifications"
      >
        <BellRing className="h-3.5 w-3.5" />
        Alerts on
      </button>
    );
  }

  if (status === 'denied') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1', className)} title="Enable notifications in your browser settings">
        <BellOff className="h-3.5 w-3.5" />
        Blocked
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={subscribe}
      disabled={status === 'loading'}
      className={cn('h-7 text-xs gap-1.5 rounded-full', className)}
    >
      {status === 'loading'
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Bell className="h-3.5 w-3.5" />
      }
      {status === 'loading' ? 'Setting up…' : 'Notify me'}
    </Button>
  );
}
