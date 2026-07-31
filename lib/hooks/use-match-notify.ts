'use client';

import { useState, useEffect, useCallback } from 'react';
import { isPushSupported, ensurePushSubscribed } from '@/lib/push-client';

const LS_KEY = 'betcheza:match-notifs';

function getStoredMatchIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function setStoredMatchIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(ids));
}

async function getCurrentEndpoint(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export type NotifyState = 'idle' | 'subscribed' | 'loading' | 'unsupported';

export function useMatchNotify(matchId: string) {
  const [state, setState] = useState<NotifyState>('idle');

  useEffect(() => {
    if (!isPushSupported()) {
      setState('unsupported');
      return;
    }
    const stored = getStoredMatchIds();
    if (stored.includes(matchId)) {
      setState('subscribed');
    }
  }, [matchId]);

  const toggle = useCallback(async () => {
    if (state === 'unsupported') return;
    setState('loading');

    try {
      if (state === 'subscribed') {
        // Unsubscribe this match topic
        const sub = await getCurrentEndpoint();
        if (sub) {
          const json = sub.toJSON();
          await fetch('/api/notifications/match-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId,
              action: 'unsubscribe',
              endpoint: json.endpoint || sub.endpoint,
              p256dh: json.keys?.p256dh ?? '',
              auth: json.keys?.auth ?? '',
            }),
          });
        }
        const ids = getStoredMatchIds().filter(id => id !== matchId);
        setStoredMatchIds(ids);
        setState('idle');
      } else {
        // Ensure push is subscribed + add match topic
        const result = await ensurePushSubscribed({ topics: ['general'] });
        if (!result.ok) {
          setState('idle');
          return;
        }

        const sub = await getCurrentEndpoint();
        if (!sub) {
          setState('idle');
          return;
        }

        const json = sub.toJSON();
        await fetch('/api/notifications/match-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId,
            action: 'subscribe',
            endpoint: json.endpoint || sub.endpoint,
            p256dh: json.keys?.p256dh ?? '',
            auth: json.keys?.auth ?? '',
          }),
        });

        const ids = [...new Set([...getStoredMatchIds(), matchId])];
        setStoredMatchIds(ids);
        setState('subscribed');
      }
    } catch {
      setState(state === 'subscribed' ? 'idle' : 'idle');
    }
  }, [matchId, state]);

  return { state, toggle };
}
