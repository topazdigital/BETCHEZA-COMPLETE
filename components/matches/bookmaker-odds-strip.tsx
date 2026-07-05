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

// Same domain map as sgo-odds-panel — powers Google favicon logos
const BK_DOMAINS: Record<string, string> = {
  pinnacle: 'pinnacle.com', bet365: 'bet365.com', '1xbet': '1xbet.com',
  onexbet: '1xbet.com', draftkings: 'draftkings.com', fanduel: 'fanduel.com',
  betway: 'betway.com', williamhill: 'williamhill.com', bwin: 'bwin.com',
  unibet: 'unibet.com', unibeteu: 'unibet.eu', unibetuk: 'unibet.co.uk',
  betfair: 'betfair.com', betfairexeu: 'betfair.com', betfairexuk: 'betfair.com',
  ladbrokes: 'ladbrokes.com', ladbrokesuk: 'ladbrokes.com', coral: 'coral.co.uk',
  betmgm: 'betmgm.com', '888sport': '888sport.com', sportybet: 'sportybet.com',
  marathonbet: 'marathonbet.com', bovada: 'bovada.lv', coolbet: 'coolbet.com',
  nordicbet: 'nordicbet.com', boylesports: 'boylesports.com',
  mybookieag: 'mybookie.ag', betonlineag: 'betonline.ag',
  betvictor: 'betvictor.com', betsson: 'betsson.com', betsafe: 'betsafe.com',
  betclic: 'betclic.com', winamax: 'winamax.fr', vbet: 'vbet.com',
  betano: 'betano.com', superbet: 'superbet.com', betika: 'betika.com',
  sportpesa: 'sportpesa.com', odibets: 'odibets.com', betin: 'betin.co.ke',
  betpawa: 'betpawa.com', mozzartbet: 'mozzartbet.com', melbet: 'melbet.com',
  '22bet': '22bet.com', ggbet: 'gg.bet', betfred: 'betfred.com',
  skybet: 'skybet.com', paddypower: 'paddypower.com', caesars: 'caesars.com',
  pointsbet: 'pointsbet.com', matchbook: 'matchbook.com', smarkets: 'smarkets.com',
  gibets: 'gibets.com', betanysports: 'betanysports.com',
};

const BK_PALETTES: Record<string, { bg: string }> = {
  pinnacle: { bg: 'bg-yellow-500' }, bet365: { bg: 'bg-emerald-600' },
  '1xbet': { bg: 'bg-blue-600' }, onexbet: { bg: 'bg-blue-600' },
  draftkings: { bg: 'bg-emerald-800' }, fanduel: { bg: 'bg-blue-800' },
  betway: { bg: 'bg-green-700' }, williamhill: { bg: 'bg-blue-900' },
  bwin: { bg: 'bg-rose-700' }, betmgm: { bg: 'bg-purple-700' },
  sportybet: { bg: 'bg-green-500' }, melbet: { bg: 'bg-blue-700' },
};
const BK_COLORS = [
  'bg-violet-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500',
  'bg-rose-500', 'bg-sky-500', 'bg-teal-500', 'bg-fuchsia-500',
];
function normKey(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function fallbackBg(bookmaker: string, display: string) {
  const k = normKey(bookmaker); const d = normKey(display);
  if (BK_PALETTES[k]) return BK_PALETTES[k].bg;
  if (BK_PALETTES[d]) return BK_PALETTES[d].bg;
  return BK_COLORS[display.charCodeAt(0) % BK_COLORS.length];
}

function BookmakerLogo({ bookmaker, display }: { bookmaker: string; display: string }) {
  const [failed, setFailed] = useState(false);
  const k = normKey(bookmaker); const d = normKey(display);
  const domain = BK_DOMAINS[k] || BK_DOMAINS[d];
  if (domain && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt={display}
        width={14}
        height={14}
        className="rounded-[3px] object-contain shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-[3px] text-[7px] font-bold text-white h-3.5 w-3.5',
      fallbackBg(bookmaker, display)
    )}>
      {display.slice(0, 2).toUpperCase()}
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

  const outcomes: Array<{ key: 'home' | 'draw' | 'away'; label: string }> = [
    { key: 'home', label: '1' },
    ...(actualHasDraw ? [{ key: 'draw' as const, label: 'X' }] : []),
    { key: 'away', label: '2' },
  ];

  const bestPrices = {
    home: lines.length ? Math.max(...lines.map(l => l.home).filter(v => v > 1)) : 0,
    draw: lines.length && actualHasDraw
      ? Math.max(...lines.filter(l => l.draw !== undefined).map(l => l.draw!).filter(v => v > 1)) : 0,
    away: lines.length ? Math.max(...lines.map(l => l.away).filter(v => v > 1)) : 0,
  };

  // Odd column width — narrower when draw present, wider when no-draw sport
  const oddW = actualHasDraw ? 'w-11' : 'w-14';

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
                <div key={i} className="flex animate-pulse gap-1.5 items-center">
                  <div className="h-3.5 w-3.5 rounded-[3px] bg-muted shrink-0" />
                  <div className="h-3 w-16 rounded bg-muted flex-1" />
                  <div className="h-4 w-8 rounded bg-muted" />
                  {actualHasDraw && <div className="h-4 w-8 rounded bg-muted" />}
                  <div className="h-4 w-8 rounded bg-muted" />
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
              {/* Column headers */}
              <div className="flex items-center gap-1 border-b border-border/60 bg-muted/20 px-2 py-1">
                <span className="flex-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Bookmaker
                </span>
                {outcomes.map(o => (
                  <span
                    key={o.key}
                    className={cn('shrink-0 text-center text-[10px] font-black text-foreground', oddW)}
                  >
                    {o.label}
                  </span>
                ))}
              </div>

              {/* One row per bookmaker */}
              <div className="divide-y divide-border/40">
                {lines.map(line => (
                  <div
                    key={line.bookmaker}
                    className="flex items-center gap-1 px-2 py-1 hover:bg-muted/10 transition-colors"
                  >
                    {/* Logo + name */}
                    <div className="flex flex-1 items-center gap-1.5 min-w-0">
                      <BookmakerLogo bookmaker={line.bookmaker} display={line.display} />
                      <span className="text-[10px] text-foreground truncate">{line.display}</span>
                    </div>

                    {/* Odds */}
                    {outcomes.map(o => {
                      const val = line[o.key];
                      const href = line.links?.[o.key];
                      const isBest = typeof val === 'number' && val === bestPrices[o.key] && bestPrices[o.key] > 1;
                      const invalid = val === undefined || val === null || (typeof val === 'number' && val <= 1);

                      if (invalid) {
                        return (
                          <span key={o.key} className={cn('shrink-0 text-center text-[10px] text-muted-foreground/40', oddW)}>
                            —
                          </span>
                        );
                      }

                      const formatted = formatOdds(val as number, settings.oddsFormat);
                      const chip = (
                        <span className={cn(
                          'inline-block w-full rounded px-0.5 py-0.5 text-center font-mono text-[10px] font-semibold tabular-nums',
                          isBest
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                            : 'text-foreground hover:bg-muted/60',
                        )}>
                          {formatted}
                        </span>
                      );

                      return (
                        <div key={o.key} className={cn('shrink-0', oddW)}>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="nofollow noopener noreferrer sponsored"
                              onClick={(e) => e.stopPropagation()}
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
