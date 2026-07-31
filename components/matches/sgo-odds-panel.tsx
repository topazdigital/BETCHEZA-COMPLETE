'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ExternalLink, TrendingUp, RefreshCw, Radio, ChevronDown, ChevronUp } from 'lucide-react';
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

interface ApiResponse {
  lines: BookmakerLine[];
  hasDraw: boolean;
  status?: string;
  isFinished?: boolean;
  isLive?: boolean;
}

interface SgoOddsPanelProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  hasDraw?: boolean;
  matchStatus?: string;
}

const FINISHED_STATUSES = new Set([
  'finished', 'ft', 'full-time', 'final', 'ended', 'post',
  'complete', 'completed', 'aet', 'pen',
]);
const LIVE_STATUSES = new Set([
  'live', 'in-progress', 'inprogress', 'halftime',
  'extra_time', 'extratime', 'penalties',
]);

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Domain map → Google favicon API gives real logos without hosting them ourselves.
// Key = normalised bookmaker slug (lowercase, alphanumeric only).
const BK_DOMAINS: Record<string, string> = {
  pinnacle:          'pinnacle.com',
  bet365:            'bet365.com',
  '1xbet':           '1xbet.com',
  onexbet:           '1xbet.com',
  draftkings:        'draftkings.com',
  fanduel:           'fanduel.com',
  betway:            'betway.com',
  williamhill:       'williamhill.com',
  bwin:              'bwin.com',
  unibet:            'unibet.com',
  unibeteu:          'unibet.eu',
  unibetuk:          'unibet.co.uk',
  betfair:           'betfair.com',
  betfairexeu:       'betfair.com',
  betfairexuk:       'betfair.com',
  ladbrokes:         'ladbrokes.com',
  ladbrokesuk:       'ladbrokes.com',
  coral:             'coral.co.uk',
  betmgm:            'betmgm.com',
  '888sport':        '888sport.com',
  sportybet:         'sportybet.com',
  marathonbet:       'marathonbet.com',
  bovada:            'bovada.lv',
  coolbet:           'coolbet.com',
  nordicbet:         'nordicbet.com',
  boylesports:       'boylesports.com',
  mybookieag:        'mybookie.ag',
  betonlineag:       'betonline.ag',
  betvictor:         'betvictor.com',
  betsson:           'betsson.com',
  betsafe:           'betsafe.com',
  casumo:            'casumo.com',
  mrgreen:           'mrgreen.com',
  betclic:           'betclic.com',
  winamax:           'winamax.fr',
  zebet:             'zebet.fr',
  vbet:              'vbet.com',
  betano:            'betano.com',
  superbet:          'superbet.com',
  betika:            'betika.com',
  sportpesa:         'sportpesa.com',
  odibets:           'odibets.com',
  betin:             'betin.co.ke',
  betpawa:           'betpawa.com',
  mozzartbet:        'mozzartbet.com',
  hollywoodbets:     'hollywoodbets.net',
  betlion:           'betlion.co.ke',
  melbet:            'melbet.com',
  '22bet':           '22bet.com',
  ggbet:             'gg.bet',
  betfred:           'betfred.com',
  skybet:            'skybet.com',
  paddy:             'paddypower.com',
  paddypower:        'paddypower.com',
  caesars:           'caesars.com',
  pointsbet:         'pointsbet.com',
  barstool:          'barstoolsports.com',
  betonvalue:        'betonvalue.com',
  mybookmaker:       'mybookie.ag',
  tipico:            'tipico.com',
  interwetten:       'interwetten.com',
  expekt:            'expekt.com',
  betsson2:          'betsson.com',
  matchbook:         'matchbook.com',
  smarkets:          'smarkets.com',
};

// Fallback colour palette (used when no domain is found or favicon fails)
const BK_PALETTES: Record<string, { bg: string; text: string }> = {
  pinnacle:       { bg: 'bg-yellow-500',   text: 'text-yellow-950' },
  bet365:         { bg: 'bg-emerald-600',   text: 'text-white' },
  '1xbet':        { bg: 'bg-blue-600',      text: 'text-white' },
  onexbet:        { bg: 'bg-blue-600',      text: 'text-white' },
  draftkings:     { bg: 'bg-emerald-800',   text: 'text-white' },
  fanduel:        { bg: 'bg-blue-800',      text: 'text-white' },
  betway:         { bg: 'bg-green-700',     text: 'text-white' },
  williamhill:    { bg: 'bg-blue-900',      text: 'text-white' },
  bwin:           { bg: 'bg-rose-700',      text: 'text-white' },
  unibet:         { bg: 'bg-green-600',     text: 'text-white' },
  betfair:        { bg: 'bg-orange-500',    text: 'text-white' },
  betfairexeu:    { bg: 'bg-orange-500',    text: 'text-white' },
  betfairexuk:    { bg: 'bg-orange-500',    text: 'text-white' },
  ladbrokes:      { bg: 'bg-red-700',       text: 'text-white' },
  coral:          { bg: 'bg-blue-500',      text: 'text-white' },
  betmgm:         { bg: 'bg-purple-700',    text: 'text-white' },
  '888sport':     { bg: 'bg-amber-500',     text: 'text-amber-950' },
  sportybet:      { bg: 'bg-green-500',     text: 'text-white' },
  marathonbet:    { bg: 'bg-indigo-600',    text: 'text-white' },
  betvictor:      { bg: 'bg-teal-600',      text: 'text-white' },
  betsson:        { bg: 'bg-sky-600',       text: 'text-white' },
  melbet:         { bg: 'bg-blue-700',      text: 'text-white' },
};
const BK_COLORS = [
  'bg-violet-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500',
  'bg-rose-500', 'bg-sky-500', 'bg-teal-500', 'bg-fuchsia-500',
];

function normKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function bkPalette(key: string, display: string): { bg: string; text: string } {
  const k = normKey(key);
  const d = normKey(display);
  if (BK_PALETTES[k]) return BK_PALETTES[k];
  if (BK_PALETTES[d]) return BK_PALETTES[d];
  const idx = display.charCodeAt(0) % BK_COLORS.length;
  return { bg: BK_COLORS[idx], text: 'text-white' };
}

/** Bookmaker logo: tries Google favicon, falls back to coloured initial badge */
function BookmakerLogo({ bookmaker, display }: { bookmaker: string; display: string }) {
  const [failed, setFailed] = useState(false);
  const k = normKey(bookmaker);
  const d = normKey(display);
  const domain = BK_DOMAINS[k] || BK_DOMAINS[d];
  const { bg, text } = bkPalette(bookmaker, display);

  if (domain && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt={display}
        width={20}
        height={20}
        className="rounded-sm object-contain shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-sm text-[8px] font-bold h-5 w-5',
      bg, text
    )}>
      {display.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const DEFAULT_SHOW = 8;

export function SgoOddsPanel({
  matchId,
  homeTeam,
  awayTeam,
  hasDraw = true,
  matchStatus = '',
}: SgoOddsPanelProps) {
  const { settings } = useUserSettings();
  const [showAll, setShowAll] = useState(false);
  const isFinishedClient = FINISHED_STATUSES.has((matchStatus || '').toLowerCase());
  const isLiveClient     = LIVE_STATUSES.has((matchStatus || '').toLowerCase());

  const shouldFetch = !isFinishedClient;
  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    shouldFetch ? `/api/matches/${matchId}/bookmaker-odds` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval:   isLiveClient ? 60_000 : 300_000,
      dedupingInterval:  isLiveClient ? 60_000 : 300_000,
    },
  );

  if (isFinishedClient || data?.isFinished) return null;

  const lines    = data?.lines ?? [];
  const showDraw = data?.hasDraw ?? hasDraw;
  const isLive   = data?.isLive ?? isLiveClient;
  const panelLabel = isLive ? 'Live Bookmaker Odds' : 'Bookmaker Odds';

  const outcomes: Array<{ key: 'home' | 'draw' | 'away'; label: string; sublabel: string }> = [
    { key: 'home', label: '1',  sublabel: homeTeam },
    ...(showDraw ? [{ key: 'draw' as const, label: 'X', sublabel: 'Draw' }] : []),
    { key: 'away', label: '2',  sublabel: awayTeam },
  ];

  const best = {
    home: lines.length ? Math.max(...lines.map(l => l.home).filter(v => v > 1)) : 0,
    draw: lines.length && showDraw
      ? Math.max(...lines.filter(l => l.draw !== undefined).map(l => l.draw!).filter(v => v > 1))
      : 0,
    away: lines.length ? Math.max(...lines.map(l => l.away).filter(v => v > 1)) : 0,
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
          {isLiveClient
            ? <Radio className="h-3.5 w-3.5 text-red-500 animate-pulse" />
            : <TrendingUp className="h-3.5 w-3.5 text-primary animate-pulse" />}
          <h3 className="text-xs font-bold uppercase tracking-wide">{panelLabel}</h3>
        </div>
        <div className="divide-y divide-border/40">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
              <div className="h-5 w-5 rounded-sm bg-muted shrink-0" />
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="ml-auto flex gap-2">
                {[0, 1, ...(hasDraw ? [2] : [])].map(j => (
                  <div key={j} className="h-7 w-12 rounded-md bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
          {isLiveClient
            ? <Radio className="h-3.5 w-3.5 text-red-500" />
            : <TrendingUp className="h-3.5 w-3.5 text-primary" />}
          <h3 className="text-xs font-bold uppercase tracking-wide">{panelLabel}</h3>
        </div>
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <TrendingUp className="h-8 w-8 opacity-20" />
          <p className="text-sm font-medium">No odds available yet</p>
          <p className="text-xs opacity-60 max-w-[240px]">
            Odds appear closer to kick-off once a configured odds API key is active.
          </p>
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

  // Sort: bookmakers with at least one best price float to the top
  const sortedLines = [...lines].sort((a, b) => {
    const aB = outcomes.some(o => typeof a[o.key] === 'number' && a[o.key] === best[o.key] && (a[o.key] as number) > 1);
    const bB = outcomes.some(o => typeof b[o.key] === 'number' && b[o.key] === best[o.key] && (b[o.key] as number) > 1);
    return (bB ? 1 : 0) - (aB ? 1 : 0);
  });

  const visible = showAll ? sortedLines : sortedLines.slice(0, DEFAULT_SHOW);
  const hidden  = sortedLines.length - DEFAULT_SHOW;

  // Column width token — matches when draw present vs absent
  const oddsColW = showDraw ? 'w-[52px]' : 'w-[60px]';

  // ── Full panel ────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {isLive
            ? <Radio className="h-3.5 w-3.5 shrink-0 text-red-500 animate-pulse" />
            : <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <h3 className="text-xs font-bold uppercase tracking-wide truncate">{panelLabel}</h3>
          {isLive && (
            <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-500 uppercase tracking-wide">
              Live
            </span>
          )}
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
            {lines.length} bookmaker{lines.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={() => mutate()}
          title="Refresh odds"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Column headers (outcome labels) */}
      <div className="flex items-end gap-2 border-b border-border/50 bg-muted/20 px-3 py-2">
        {/* Bookmaker col label */}
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Bookmaker
        </span>
        {/* One header per outcome */}
        {outcomes.map(o => (
          <div key={o.key} className={cn('flex flex-col items-center leading-tight shrink-0', oddsColW)}>
            <span className="text-[11px] font-black text-foreground">{o.label}</span>
            <span className="text-[9px] text-muted-foreground truncate w-full text-center">{o.sublabel}</span>
          </div>
        ))}
      </div>

      {/* Bookmaker rows */}
      <div className="divide-y divide-border/40">
        {visible.map(line => (
          <div
            key={line.bookmaker}
            className="flex items-center gap-2 px-3 py-2 hover:bg-muted/10 transition-colors"
          >
            {/* Logo + name */}
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <BookmakerLogo bookmaker={line.bookmaker} display={line.display} />
              <span className="text-xs font-medium text-foreground truncate">{line.display}</span>
            </div>

            {/* Odds cells */}
            {outcomes.map(o => {
              const val = line[o.key];
              const href = line.links?.[o.key];
              const isBest = typeof val === 'number' && val === best[o.key] && (best[o.key] ?? 0) > 1;
              const isInvalid = val === undefined || val === null || (typeof val === 'number' && val <= 1);

              if (isInvalid) {
                return (
                  <div key={o.key} className={cn('shrink-0 text-center text-[10px] text-muted-foreground/40', oddsColW)}>
                    —
                  </div>
                );
              }

              const formatted = formatOdds(val as number, settings.oddsFormat);
              const chip = (
                <span className={cn(
                  'inline-block w-full rounded-md py-1 text-center font-mono text-xs font-bold tabular-nums transition-all',
                  isBest
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'text-foreground hover:bg-muted/60',
                )}>
                  {formatted}
                </span>
              );

              return (
                <div key={o.key} className={cn('shrink-0', oddsColW)}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="nofollow noopener noreferrer sponsored"
                      className="block hover:opacity-80 transition-opacity"
                      title={`${o.label} @ ${formatted} — ${line.display}`}
                    >
                      {chip}
                    </a>
                  ) : chip}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Show more / less */}
      {sortedLines.length > DEFAULT_SHOW && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border/40 bg-muted/10 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
        >
          {showAll
            ? <><ChevronUp className="h-3 w-3" /> Show fewer</>
            : <><ChevronDown className="h-3 w-3" /> Show {hidden} more bookmaker{hidden === 1 ? '' : 's'}</>}
        </button>
      )}

      {/* Best price footer */}
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
