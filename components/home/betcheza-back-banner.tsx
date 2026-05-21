'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X, Rocket } from 'lucide-react';
import useSWR from 'swr';
import Link from 'next/link';

const DISMISS_KEY = 'betcheza_back_banner_dismissed_v2';
const CACHE_KEY = 'bz_announcement';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AnnouncementData {
  announcementEnabled: boolean;
  announcementLabel: string;
  announcementHeadline: string;
  announcementSubtext: string;
  announcementLink: string;
}

function readCache(): AnnouncementData | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}

export function BetchezaBackBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  const cached = mounted ? readCache() : undefined;

  const { data } = useSWR<AnnouncementData>('/api/site-settings', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
    refreshInterval: 0,
    fallbackData: cached,
    onSuccess(d) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch {}
    },
  });

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(!!window.sessionStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try { window.sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  const show = mounted && !dismissed && !!data?.announcementEnabled;

  const label = data?.announcementLabel || "We're back — and sharper than ever";
  const headline = data?.announcementHeadline || 'Betcheza is back 🎉 with smarter tips, faster odds, and a fresh community.';
  const subtext = data?.announcementSubtext || 'Welcome home, tipster — your dashboard, leaderboard streaks and bookmarks are waiting.';
  const hasLink = !!data?.announcementLink;

  if (!show) return null;

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
    <div
      className="fixed left-0 right-0 top-0 z-[200] px-3 py-2 shadow-lg"
      style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-1.5 top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>

        {hasLink ? (
          <Link href={data!.announcementLink} className="block" target={data!.announcementLink.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
            {Inner}
          </Link>
        ) : Inner}
      </div>
    </div>
  );
}
