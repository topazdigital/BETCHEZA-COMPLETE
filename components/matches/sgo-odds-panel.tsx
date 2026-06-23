'use client';

import useSWR from 'swr';
import { ExternalLink, TrendingUp, RefreshCw } from 'lucide-react';
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

interface SgoOddsPanelProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  hasDraw?: boolean;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

const BK_PALETTES: Record<string, { bg: string; text: string }> = {
  pinnacle:       { bg: 'bg-yellow-500',   text: 'text-yellow-950' },
  bet365:         { bg: 'bg-emerald-600',   text: 'text-white' },
  '1xbet':        { bg: 'bg-blue-600',      text: 'text-white' },
  '1xBet':        { bg: 'bg-blue-600',      text: 'text-white' },
  draftkings:     { bg: 'bg-emerald-800',   text: 'text-white' },
  fanduel:        { bg: 'bg-blue-800',      text: 'text-white' },
  betway:         { bg: 'bg-green-700',     text: 'text-white' },
  williamhill:    { bg: 'bg-blue-900',      text: 'text-white' },
  bwin:           { bg: 'bg-rose-700',      text: 'text-white' },
  unibet:         { bg: 'bg-green-600',     text: 'text-white' },
  betfair:        { bg: 'bg-orange-500',    text: 'text-white' },
  ladbrokes:      { bg: 'bg-red-700',       text: 'text-white' },
  coral:          { bg: 'bg-blue-500',      text: 'text-white' },
  paddy:          { bg: 'bg-emerald-500',   text: 'text-white' },
};

const BK_COLORS = [
  'bg-violet-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500',
  'bg-rose-500', 'bg-sky-500', 'bg-teal-500', 'bg-fuchsia-500',
];

function bkStyle(display: string): { bg: string; text: string } {
  const key = display.toLowerCase().replace(/\s+/g, '');
  if (BK_PALETTES[key]) return BK_PALETTES[key];
  if (BK_PALETTES[display]) return BK_PALETTES[display];
  const idx = display.charCodeAt(0) % BK_COLORS.length;
  return { bg: BK_COLORS[idx], text: 'text-white' };
}

function BookmakerBadge({ display }: { display: string }) {
  const { bg, text } = bkStyle(display);
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <span className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-black',
        bg, text
      )}>
        {display.slice(0, 2).toUpperCase()}
      </span>
      <span className="max-w-[60px] truncate text-[9px] text-muted-foreground leading-tight text-center">
        {display}
      </span>
    </div>
  );
}

export function SgoOddsPanel({ matchId, homeTeam, awayTeam, hasDraw = true }: SgoOddsPanelProps) {
  const { settings } = useUserSettings();

  const { data, isLoading, mutate } = useSWR<{ lines: BookmakerLine[]; hasDraw: boolean }>(
    `/api/matches/${matchId}/bookmaker-odds`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );

  const lines = data?.lines ?? [];
  const showDraw = data?.hasDraw ?? hasDraw;

  const outcomes: Array<{ key: 'home' | 'draw' | 'away'; label: string; sublabel: string }> = [
    { key: 'home', label: '1', sublabel: homeTeam },
    ...(showDraw ? [{ key: 'draw' as const, label: 'X', sublabel: 'Draw' }] : []),
    { key: 'away', label: '2', sublabel: awayTeam },
  ];

  const best = {
    home: lines.length ? Math.max(...lines.map(l => l.home).filter(v => v > 1)) : 0,
    draw: lines.length && showDraw
      ? Math.max(...lines.filter(l => l.draw !== undefined).map(l => l.draw!).filter(v => v > 1))
      : 0,
    away: lines.length ? Math.max(...lines.map(l => l.away).filter(v => v > 1)) : 0,
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wide">Live Bookmaker Odds</h3>
        </div>
        <div className="p-3 space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="h-9 w-14 rounded-md bg-muted shrink-0" />
              {[0, 1, 2, 3].map(j => (
                <div key={j} className="h-9 flex-1 rounded-md bg-muted" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wide">Live Bookmaker Odds</h3>
        </div>
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <TrendingUp className="h-8 w-8 opacity-20" />
          <p className="text-sm font-medium">No live bookmaker prices yet</p>
          <p className="text-xs opacity-60">Odds will appear once published closer to kick-off.</p>
          <button
            onClick={() => mutate()}
            className="mt-1 flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wide">Live Bookmaker Odds</h3>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
            {lines.length} bookmaker{lines.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={() => mutate()}
          title="Refresh odds"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          {/* Bookmaker header row */}
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="sticky left-0 z-10 bg-muted/20 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap min-w-[60px]">
                Outcome
              </th>
              {lines.map(line => (
                <th key={line.bookmaker} className="px-2.5 py-2 text-center">
                  <BookmakerBadge display={line.display} />
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/40">
            {outcomes.map(({ key, label, sublabel }) => {
              const bestVal = best[key];
              return (
                <tr key={key} className="hover:bg-muted/20 transition-colors">
                  {/* Outcome label */}
                  <td className="sticky left-0 z-10 bg-card px-3 py-2.5 whitespace-nowrap">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-black text-foreground">{label}</span>
                      <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">{sublabel}</span>
                    </div>
                  </td>

                  {/* Odds per bookmaker */}
                  {lines.map(line => {
                    const val = line[key];
                    const href = line.links?.[key];
                    const isBest = typeof val === 'number' && val === bestVal && bestVal > 1;
                    const isInvalid = val === undefined || val === null || (typeof val === 'number' && val <= 1);

                    if (isInvalid) {
                      return (
                        <td key={line.bookmaker} className="px-2.5 py-2.5 text-center text-muted-foreground/40 text-xs">
                          —
                        </td>
                      );
                    }

                    const formatted = formatOdds(val as number, settings.oddsFormat);

                    const cellClass = cn(
                      'inline-block rounded-lg px-2.5 py-1 font-mono text-sm font-black tabular-nums transition-all',
                      isBest
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40 shadow-sm'
                        : 'text-foreground hover:bg-muted/60',
                    );

                    return (
                      <td key={line.bookmaker} className="px-2.5 py-2.5 text-center">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="nofollow noopener noreferrer sponsored"
                            className={cn(cellClass, 'cursor-pointer hover:opacity-80')}
                            title={`Bet ${label} @ ${formatted} — ${line.display}`}
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

      {/* Best odds summary row */}
      <div className="border-t border-border/50 bg-muted/10 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Best price:</span>
        {outcomes.map(({ key, label }) => {
          const val = best[key];
          if (!val || val <= 1) return null;
          const bestLine = lines.find(l => l[key] === val);
          return (
            <span key={key} className="flex items-center gap-1 text-[10px]">
              <span className="font-semibold text-muted-foreground">{label}</span>
              <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatOdds(val, settings.oddsFormat)}
              </span>
              {bestLine && (
                <span className="text-muted-foreground/60">@ {bestLine.display}</span>
              )}
            </span>
          );
        })}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <ExternalLink className="h-2.5 w-2.5" />
          Green = best price
        </span>
      </div>
    </div>
  );
}
