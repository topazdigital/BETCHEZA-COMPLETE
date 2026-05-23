'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { ensurePushSubscribed, isPushSupported, getPushPermission } from '@/lib/push-client';

const DISMISSED_KEY = 'betcheza_push_prompt_dismissed';

export function PushPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (getPushPermission() !== 'default') return;
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {}
    // Small delay so it doesn't pop on first paint
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch {}
    setVisible(false);
  }

  async function enable() {
    setEnabling(true);
    const res = await ensurePushSubscribed({ topics: ['general', 'tips', 'matches'] });
    setEnabling(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => setVisible(false), 2000);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-card shadow-xl shadow-black/20 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          {done ? (
            <p className="text-xs font-semibold text-emerald-500">✓ Push notifications enabled!</p>
          ) : (
            <>
              <p className="text-xs font-bold leading-snug">Get alerts even when Betcheza is closed</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">New tips, live goals, and daily picks — direct to your phone.</p>
              <button
                onClick={enable}
                disabled={enabling}
                className="mt-2 rounded-lg bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {enabling ? 'Enabling…' : 'Enable Notifications'}
              </button>
            </>
          )}
        </div>
        <button onClick={dismiss} className="shrink-0 rounded p-0.5 hover:bg-muted">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
