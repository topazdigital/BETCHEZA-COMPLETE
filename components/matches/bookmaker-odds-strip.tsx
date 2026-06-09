'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatOdds } from '@/lib/utils/odds-converter';
import { useUserSettings } from '@/contexts/user-settings-context';

interface BookmakerLine {
  bookmaker: string;
  display: string;
  home: number;
  draw?: number;
  away: number;
  links?: { home?: string; draw?: string; away?: string };
}

interface BookmakerOddsStripProps {
  matchId: string;
  matchSlug: string;
  hasDraw: boolean;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

const BK_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500',
];

function bkColor(name: string) {
  return BK_COLORS[name.charCodeAt(0) % BK_COLORS.length];
}

export function BookmakerOddsStrip({ matchId, matchSlug, hasDraw }: BookmakerOddsStripProps) {
  const [open, setOpen] = useState(false);
  const { settings } = useUserSettings();

  const { data, isLoading } = useSWR<{ lines: BookmakerLine[]; hasDraw: boolean }>(
    open ? `/api/matches/${matchId}/bookmaker-odds` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );

  const lines = data?.lines ?? [];
  const actualHasDraw = data?.hasDraw ?? hasDraw;

  const outcomes: Array<{ key: 'home' | 'draw' | 'away'; label: string; linkKey: 'home' | 'draw' | 'away' }> = [
    { key: 'home', label: '1', linkKey: 'home' },
    ...(actualHasDraw ? [{ key: 'draw' as const, label: 'X', linkKey: 'draw' as const }] : []),
    { key: 'away', label: '2', linkKey: 'away' },
  ];

  const bestPrices = {
    home: lines.length ? Math.max(...lines.map(l => l.home)) : 0,
    draw: lines.length && actualHasDraw
      ? Math.max(...lines.filter(l => l.draw !== undefined).map(l => l.draw!))
      : 0,
    away: lines.length ? Math.max(...lines.map(l => l.away)) : 0,
  };

  return (
    <div className="mt-1.5">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="flex w-full items-center justify-between rounded-md bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Compare bookmaker odds
        </span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-1 overflow-hidden rounded-md border border-border bg-card">
          {isLoading ? (
            <div className="p-2 space-y-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex animate-pulse gap-1.5">
                  <div className="h-5 w-16 rounded bg-muted" />
                  <div className="h-5 w-10 rounded bg-muted" />
                  <div className="h-5 w-10 rounded bg-muted" />
                  <div className="h-5 w-10 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : lines.length === 0 ? (
            <div className="px-3 py-2.5 text-center text-[11px] text-muted-foreground">
              No live bookmaker prices found.{' '}
              <a
                href={`/matches/${matchSlug}#bookmakers`}
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View on match page
              </a>
            </div>
          ) : (
            <>
              {/*
                HORIZONTAL layout: outcomes are ROWS, bookmakers are COLUMNS.
                Each outcome row scrolls right when there are many bookmakers.
              */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse text-[11px]">
                  {/* Header row — bookmaker names */}
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="sticky left-0 z-10 bg-muted/30 px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                        Outcome
                      </th>
                      {lines.map(line => (
                        <th key={line.bookmaker} className="px-2 py-1.5 text-center font-medium text-foreground whitespace-nowrap">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white', bkColor(line.display))}>
                              {line.display.charAt(0).toUpperCase()}
                            </span>
                            <span className="max-w-[60px] truncate text-[9px] text-muted-foreground">{line.display}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {outcomes.map(({ key, label }) => {
                      const best = bestPrices[key];
                      return (
                        <tr key={key} className="hover:bg-muted/20 transition-colors">
                          <td className="sticky left-0 z-10 bg-card px-2.5 py-1.5 font-semibold text-foreground">
                            {label}
                          </td>
                          {lines.map(line => {
                            const val = line[key as 'home' | 'draw' | 'away'];
                            const href = line.links?.[key as 'home' | 'draw' | 'away'];
                            const isBest = typeof val === 'number' && val === best && best > 0;

                            if (val === undefined || val === null || (typeof val === 'number' && val <= 1)) {
                              return (
                                <td key={line.bookmaker} className="px-2 py-1.5 text-center text-muted-foreground">—</td>
                              );
                            }

                            const formatted = formatOdds(val as number, settings.oddsFormat);
                            const cellClass = cn(
                              'rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums transition-colors',
                              isBest
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                                : 'text-foreground',
                            );

                            return (
                              <td key={line.bookmaker} className="px-2 py-1.5 text-center">
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(cellClass, 'hover:opacity-80 cursor-pointer inline-block')}
                                    title={`Bet at ${line.display}`}
                                  >
                                    {formatted}
                                  </a>
                                ) : (
                                  <span className={cellClass}>{formatted}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="border-t border-border/60 px-2.5 py-1.5">
                <a
                  href={`/matches/${matchSlug}#bookmakers`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Full comparison &amp; bet slip on match page
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
