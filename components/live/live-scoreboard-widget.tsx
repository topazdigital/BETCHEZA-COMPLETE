'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Radio, X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { matchToSlug } from '@/lib/utils/match-url';

interface LiveMatch {
  id: string;
  homeTeam: { name: string; shortName?: string; score?: number };
  awayTeam: { name: string; shortName?: string; score?: number };
  clock?: string;
  period?: string;
  status: string;
  league?: { name?: string };
}

const POLL_INTERVAL = 30_000;

function abbr(name: string, short?: string): string {
  if (short && short.length <= 4) return short;
  const parts = name.split(/\s+/);
  if (parts.length === 1) return name.slice(0, 3).toUpperCase();
  return parts.map(p => p[0]).join('').toUpperCase().slice(0, 3);
}

export function LiveScoreboardWidget() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const fetchLive = useCallback(async () => {
    try {
      const r = await fetch('/api/matches?status=live&limit=10', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json() as { matches?: LiveMatch[] };
      const live = (data.matches || []).filter(m => m.status === 'live' || m.status === 'in');
      setMatches(live);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchLive]);

  if (dismissed || matches.length === 0) return null;

  return (
    <div className={cn(
      'fixed bottom-20 right-3 z-40 md:bottom-4',
      'transition-all duration-300',
    )}>
      {/* Collapsed pill */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-lg backdrop-blur-sm hover:bg-red-500/20 transition-colors"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          {matches.length} LIVE
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="w-56 rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-red-500/8">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <Radio className="h-3.5 w-3.5" />
              LIVE SCORES
              <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold">{matches.length}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted" title="Collapse">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDismissed(true)} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted" title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Match list */}
          <div className="divide-y divide-border/50 max-h-60 overflow-y-auto">
            {matches.map(m => {
              const slug = `/matches/${matchToSlug(m.id, m.homeTeam.name, m.awayTeam.name)}`;
              return (
                <Link key={m.id} href={slug} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium" title={m.homeTeam.name}>
                        {abbr(m.homeTeam.name, m.homeTeam.shortName)}
                      </span>
                      <span className="font-black tabular-nums px-1.5 text-sm">
                        {m.homeTeam.score ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-0.5">
                      <span className="truncate text-muted-foreground" title={m.awayTeam.name}>
                        {abbr(m.awayTeam.name, m.awayTeam.shortName)}
                      </span>
                      <span className="font-black tabular-nums px-1.5 text-sm text-muted-foreground">
                        {m.awayTeam.score ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[9px] font-bold text-red-600 tabular-nums">{m.clock || 'LIVE'}</div>
                    {m.league?.name && (
                      <div className="text-[8px] text-muted-foreground truncate max-w-[50px]">{m.league.name}</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Footer link */}
          <div className="border-t border-border px-3 py-1.5">
            <Link href="/live" className="text-[10px] font-semibold text-primary hover:underline">
              Full live page →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
