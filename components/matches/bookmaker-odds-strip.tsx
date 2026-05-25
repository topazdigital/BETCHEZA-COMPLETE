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

function BookmakerInitial({ name }: { name: string }) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white', colors[idx])}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
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

  const bestHome = lines.length ? Math.max(...lines.map(l => l.home)) : 0;
  const bestDraw = lines.length && actualHasDraw
    ? Math.max(...lines.filter(l => l.draw !== undefined).map(l => l.draw!))
    : 0;
  const bestAway = lines.length ? Math.max(...lines.map(l => l.away)) : 0;

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
            <div className="space-y-1 p-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex animate-pulse items-center gap-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="ml-auto flex gap-1.5">
                    <div className="h-5 w-10 rounded bg-muted" />
                    {actualHasDraw && <div className="h-5 w-10 rounded bg-muted" />}
                    <div className="h-5 w-10 rounded bg-muted" />
                  </div>
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
              {/* Column header */}
              <div className={cn(
                'grid items-center border-b border-border bg-muted/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
                actualHasDraw ? 'grid-cols-[1fr,52px,52px,52px]' : 'grid-cols-[1fr,52px,52px]',
              )}>
                <span>Bookmaker</span>
                <span className="text-center">1</span>
                {actualHasDraw && <span className="text-center">X</span>}
                <span className="text-center">2</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/60">
                {lines.map((line) => (
                  <div
                    key={line.bookmaker}
                    className={cn(
                      'grid items-center px-2.5 py-1.5 text-xs hover:bg-muted/30',
                      actualHasDraw ? 'grid-cols-[1fr,52px,52px,52px]' : 'grid-cols-[1fr,52px,52px]',
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <BookmakerInitial name={line.display} />
                      <span className="truncate font-medium text-foreground leading-none">{line.display}</span>
                    </div>

                    <OddsCell
                      value={line.home}
                      isBest={line.home === bestHome}
                      format={settings.oddsFormat}
                      href={line.links?.home}
                    />
                    {actualHasDraw && (
                      <OddsCell
                        value={line.draw}
                        isBest={!!line.draw && line.draw === bestDraw}
                        format={settings.oddsFormat}
                        href={line.links?.draw}
                      />
                    )}
                    <OddsCell
                      value={line.away}
                      isBest={line.away === bestAway}
                      format={settings.oddsFormat}
                      href={line.links?.away}
                    />
                  </div>
                ))}
              </div>

              {/* Footer link to full bookmakers section */}
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

function OddsCell({
  value,
  isBest,
  format,
  href,
}: {
  value: number | undefined;
  isBest: boolean;
  format: 'decimal' | 'fractional' | 'american';
  href?: string;
}) {
  if (value === undefined || value <= 1) {
    return <span className="text-center text-muted-foreground">–</span>;
  }

  const label = formatOdds(value, format);

  const cellClass = cn(
    'rounded px-1 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums transition-colors',
    isBest
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
      : 'text-foreground',
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(cellClass, 'block hover:opacity-80')}
        title="Bet at bookmaker"
      >
        {label}
      </a>
    );
  }

  return <span className={cellClass}>{label}</span>;
}
