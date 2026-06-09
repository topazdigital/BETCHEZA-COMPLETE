'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserSettings } from '@/contexts/user-settings-context';
import { formatOdds } from '@/lib/utils/odds-converter';
import { cn } from '@/lib/utils';
import type { Odds, Bookmaker, Market } from '@/lib/types';

interface OddsComparisonProps {
  odds: Odds[];
  bookmakers: Bookmaker[];
  markets: Market[];
  matchContext?: {
    matchId?: string | number;
    match?: string;
    sport?: string;
    league?: string;
  };
}

function trackedHref(slug: string | undefined, opts: {
  placement: string;
  matchId?: string | number;
  match?: string;
  sport?: string;
  league?: string;
  market?: string;
  selection?: string;
  fallback?: string | null;
}): string {
  if (!slug) return opts.fallback || '#';
  const qs = new URLSearchParams();
  qs.set('placement', opts.placement);
  if (opts.matchId !== undefined && opts.matchId !== null) qs.set('matchId', String(opts.matchId));
  if (opts.match) qs.set('match', opts.match);
  if (opts.sport) qs.set('sport', opts.sport);
  if (opts.league) qs.set('league', opts.league);
  if (opts.market) qs.set('market', opts.market);
  if (opts.selection) qs.set('selection', opts.selection);
  return `/api/r/bookmaker/${encodeURIComponent(slug)}?${qs.toString()}`;
}

const BK_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500',
];
function bkColor(name: string) {
  return BK_COLORS[name.charCodeAt(0) % BK_COLORS.length];
}

export function OddsComparison({ odds, bookmakers, markets, matchContext }: OddsComparisonProps) {
  const { settings } = useUserSettings();
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.slug || '1x2');

  const currentMarket = markets.find((m) => m.slug === selectedMarket);
  const marketOdds = odds.filter((o) => o.market_id === currentMarket?.id);

  // Bookmakers that have at least one odd for this market
  const activeBookmakers = bookmakers.filter(bk =>
    marketOdds.some(o => o.bookmaker_id === bk.id)
  );

  // Unique selections for this market
  const selections = [...new Set(marketOdds.map((o) => o.selection))];

  // Best odds per selection (for highlighting)
  const bestOdds: Record<string, number> = {};
  selections.forEach((sel) => {
    const vals = marketOdds.filter(o => o.selection === sel).map(o => o.value);
    bestOdds[sel] = vals.length ? Math.max(...vals) : 0;
  });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Market Tabs */}
      <Tabs value={selectedMarket} onValueChange={setSelectedMarket} className="w-full">
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="h-auto w-max min-w-full justify-start rounded-none bg-transparent p-0">
            {markets.slice(0, 6).map((market) => (
              <TabsTrigger
                key={market.slug}
                value={market.slug}
                className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary whitespace-nowrap"
              >
                {market.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={selectedMarket} className="mt-0">
          {activeBookmakers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No odds available for this market
            </div>
          ) : (
            /* Column layout: outcomes are ROWS, bookmakers are COLUMNS */
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                {/* Header: outcome label | bk1 | bk2 | bk3 … */}
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      Outcome
                    </th>
                    {activeBookmakers.map((bk) => {
                      const href = trackedHref(bk.slug, {
                        placement: 'odds-table-header',
                        matchId: matchContext?.matchId,
                        match: matchContext?.match,
                        sport: matchContext?.sport,
                        league: matchContext?.league,
                        market: currentMarket?.slug,
                        fallback: bk.affiliate_url,
                      });
                      return (
                        <th key={bk.id} className="px-2 py-2.5 text-center font-medium whitespace-nowrap">
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-0.5 group"
                            title={`Bet at ${bk.name}`}
                          >
                            <span className={cn(
                              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white',
                              bkColor(bk.name)
                            )}>
                              {bk.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors max-w-[64px] truncate">
                              {bk.name}
                            </span>
                          </a>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60">
                  {selections.map((selection) => {
                    const best = bestOdds[selection];
                    return (
                      <tr key={selection} className="hover:bg-muted/20 transition-colors">
                        {/* Sticky selection label */}
                        <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-semibold text-sm text-foreground whitespace-nowrap">
                          {selection}
                        </td>

                        {/* One cell per bookmaker */}
                        {activeBookmakers.map((bk) => {
                          const odd = marketOdds.find(
                            o => o.bookmaker_id === bk.id && o.selection === selection
                          );
                          const isBest = odd && odd.value === best && best > 0;
                          const href = odd ? trackedHref(bk.slug, {
                            placement: 'odds-table-cell',
                            matchId: matchContext?.matchId,
                            match: matchContext?.match,
                            sport: matchContext?.sport,
                            league: matchContext?.league,
                            market: currentMarket?.slug,
                            selection,
                            fallback: bk.affiliate_url,
                          }) : null;

                          if (!odd) {
                            return (
                              <td key={bk.id} className="px-2 py-2.5 text-center text-muted-foreground text-xs">—</td>
                            );
                          }

                          const formatted = formatOdds(odd.value, settings.oddsFormat);
                          const cellCls = cn(
                            'inline-block rounded px-2 py-1 font-mono text-sm font-semibold tabular-nums transition-colors',
                            isBest
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                              : 'text-foreground hover:bg-muted/60'
                          );

                          return (
                            <td key={bk.id} className="px-2 py-2.5 text-center">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(cellCls, 'cursor-pointer hover:opacity-80')}
                                  title={`${selection} @ ${formatted} — ${bk.name}`}
                                >
                                  {formatted}
                                </a>
                              ) : (
                                <span className={cellCls}>{formatted}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer */}
              <div className="border-t border-border/60 px-3 py-2 flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Click any odds to bet at that bookmaker. Green = best price.
                </p>
                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <ExternalLink className="h-2.5 w-2.5" />
                  <span>Opens in new tab</span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
