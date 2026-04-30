'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, Rocket } from 'lucide-react';

const STORAGE_KEY = 'betcheza_back_banner_dismissed_v1';

export function BetchezaBackBanner() {
  const [visible, setVisible] = useState(false);

  // Mount-only check — keep dismissals sticky across reloads.
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !window.sessionStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
    setVisible(false);
  };

  return (
    <div className="relative mb-3 overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 shadow-sm">
      {/* Subtle animated shimmer */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary/15 to-transparent" />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="relative flex items-start gap-3">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
          <Rocket className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
        </span>

        <div className="min-w-0 pr-5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            <span>We&apos;re back — and sharper than ever</span>
          </div>
          <p className="mt-0.5 text-sm font-bold leading-tight text-foreground">
            Betcheza is back 🎉 with smarter tips, faster odds, and a fresh community.
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
            Welcome home, tipster — your dashboard, leaderboard streaks and bookmarks are waiting.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
