'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          prompt: (cb?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          cancel: () => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
        };
      };
    };
  }
}

export function GoogleOneTap() {
  const { isAuthenticated, loginWithGoogleOneTap } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated || initialized.current) return;

    let cancelled = false;

    async function init() {
      try {
        const res = await fetch('/api/auth/google-client-id');
        const data = await res.json().catch(() => ({}));
        const clientId = data?.clientId as string | null | undefined;
        if (!clientId || cancelled) return;

        const loadScript = () =>
          new Promise<void>((resolve, reject) => {
            if (window.google?.accounts?.id) { resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.async = true;
            s.defer = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
            document.head.appendChild(s);
          });

        await loadScript();
        if (cancelled || !window.google?.accounts?.id) return;

        initialized.current = true;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential?: string }) => {
            if (!response.credential) return;
            await loginWithGoogleOneTap(response.credential);
          },
          cancel_on_tap_outside: false,
          context: 'signin',
          itp_support: true,
        });

        window.google.accounts.id.prompt();
      } catch {
        // Google One Tap is non-critical — silently skip on error
      }
    }

    init();

    return () => {
      cancelled = true;
      try { window.google?.accounts?.id?.cancel(); } catch { /* no-op */ }
    };
  }, [isAuthenticated, loginWithGoogleOneTap]);

  return null;
}
