'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, Rocket } from 'lucide-react';
import useSWR from 'swr';
import Link from 'next/link';

const STORAGE_KEY = 'betcheza_back_banner_dismissed_v2';
const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AnnouncementData {
  announcementEnabled: boolean;
  announcementLabel: string;
  announcementHeadline: string;
  announcementSubtext: string;
  announcementLink: string;
}

export function BetchezaBackBanner() {
  const [dismissed, setDismissed] = useState(true);

  const { data } = useSWR<AnnouncementData>('/api/site-settings', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
    refreshInterval: 0,
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !window.sessionStorage.getItem(STORAGE_KEY)) {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;
  if (!data) return null;
  if (!data.announcementEnabled) return null;

  const dismiss = () => {
    try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setDismissed(true);
  };

  const hasLink = !!data.announcementLink;
  const label = data.announcementLabel || "We're back — and sharper than ever";
  const headline = data.announcementHeadline || 'Betcheza is back 🎉 with smarter tips, faster odds, and a fresh community.';
  const subtext = data.announcementSubtext || 'Welcome home, tipster — your dashboard, leaderboard streaks and bookmarks are waiting.';

  const Inner = (
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
          <span>{label}</span>
        </div>
        <p className="mt-0.5 text-sm font-bold leading-tight text-foreground">
          {headline}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
          {subtext}
        </p>
        {hasLink && (
          <span className="mt-1 inline-block text-[11px] font-semibold text-primary underline underline-offset-2">
            Learn more →
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative mb-3 overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 shadow-sm">
      <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary/15 to-transparent" />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>

      {hasLink ? (
        <Link href={data.announcementLink} className="block" target={data.announcementLink.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
          {Inner}
        </Link>
      ) : Inner}

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
