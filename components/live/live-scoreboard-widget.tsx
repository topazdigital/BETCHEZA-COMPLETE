'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Radio, X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { matchToSlug } from '@/lib/utils/match-url';
import useSWR from 'swr';

interface LiveMatch {
  id: string;
  homeTeam: { name: string; shortName?: string; score?: number };
  awayTeam: { name: string; shortName?: string; score?: number };
  clock?: string;
  period?: string;
  status: string;
  league?: { name?: string };
}

const POLL_INTERVAL = 20_000;
const GOAL_HIDE_DELAY = 60_000; // hide the popup after 60 s of no new goals
const fetcher = (url: string) => fetch(url).then(r => r.json());

function abbr(name: string, short?: string): string {
  if (short && short.length <= 4) return short;
  const parts = name.split(/\s+/);
  if (parts.length === 1) return name.slice(0, 3).toUpperCase();
  return parts.map(p => p[0]).join('').toUpperCase().slice(0, 3);
}

function scoreKey(m: LiveMatch) {
  return `${m.homeTeam.score ?? 0}-${m.awayTeam.score ?? 0}`;
}

export function LiveScoreboardWidget() {
  // Matches that had a goal (score > 0) — shown in the popup
  const [goalMatches, setGoalMatches] = useState<LiveMatch[]>([]);
  const [open, setOpen] = useState(true);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Track previous scores per match to detect goal events
  const prevScores = useRef<Record<string, string>>({});
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data } = useSWR('/api/matches?status=live&limit=20', fetcher, {
    refreshInterval: POLL_INTERVAL,
  });

  useEffect(() => {
    const raw = ((data?.matches || []) as LiveMatch[]).filter(
      m => m.status === 'live' || m.status === 'halftime' || m.status === 'in'
    );

    let goalScored = false;
    const newGoalMatches: LiveMatch[] = [];

    raw.forEach(m => {
      const key = scoreKey(m);
      const prev = prevScores.current[m.id];
      const homeScore = m.homeTeam.score ?? 0;
      const awayScore = m.awayTeam.score ?? 0;

      // A goal happened if the score changed AND total > 0
      if (prev !== undefined && prev !== key && (homeScore + awayScore) > 0) {
        goalScored = true;
      }

      if ((homeScore + awayScore) > 0) {
        newGoalMatches.push(m);
      }

      prevScores.current[m.id] = key;
    });

    // On first load, prime the ref but don't show popup
    const isFirstLoad = Object.keys(prevScores.current).length === raw.length &&
      !goalScored && goalMatches.length === 0;

    if (goalScored) {
      setGoalMatches(newGoalMatches);
      setVisible(true);
      setDismissed(false);
      setOpen(true);

      // Auto-hide after 60 s of no further goals
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), GOAL_HIDE_DELAY);
    } else if (newGoalMatches.length > 0 && visible) {
      // Keep list up-to-date while popup is already showing
      setGoalMatches(newGoalMatches);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!visible || dismissed || goalMatches.length === 0) return null;

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
          GOAL! {goalMatches.length > 1 ? `${goalMatches.length} games` : ''}
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="w-56 rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-red-500/8">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <Radio className="h-3.5 w-3.5" />
              GOAL!
              <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold">{goalMatches.length}</span>
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
            {goalMatches.map(m => {
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
                    <div className="text-[9px] font-bold text-red-600 tabular-nums">⚽ GOAL</div>
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
