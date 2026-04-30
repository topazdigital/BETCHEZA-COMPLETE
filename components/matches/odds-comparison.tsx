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
  /** Optional context — when provided we attribute outbound clicks to this match. */
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

export function OddsComparison({ odds, bookmakers, markets, matchContext }: OddsComparisonProps) {
  const { settings } = useUserSettings();
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.slug || '1x2');

  const currentMarket = markets.find((m) => m.slug === selectedMarket);
  const marketOdds = odds.filter((o) => o.market_id === currentMarket?.id);

  // Group by bookmaker
  const oddsByBookmaker = bookmakers.map((bookmaker) => {
    const bookmakerOdds = marketOdds.filter((o) => o.bookmaker_id === bookmaker.id);
    return { bookmaker, odds: bookmakerOdds };
  }).filter(({ odds }) => odds.length > 0);

  // Get unique selections for this market
  const selections = [...new Set(marketOdds.map((o) => o.selection))];

  // Find best odds for each selection
  const bestOdds: Record<string, number> = {};
  selections.forEach((selection) => {
    const selectionOdds = marketOdds.filter((o) => o.selection === selection);
    bestOdds[selection] = Math.max(...selectionOdds.map((o) => o.value));
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Market Tabs */}
      <Tabs value={selectedMarket} onValueChange={setSelectedMarket} className="w-full">
        <div className="border-b border-border">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none bg-transparent p-0">
            {markets.slice(0, 5).map((market) => (
              <TabsTrigger
                key={market.slug}
                value={market.slug}
                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {market.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={selectedMarket} className="mt-0">
          {/* Header */}
          <div className="grid grid-cols-[1fr,repeat(auto-fit,minmax(60px,1fr))] gap-2 border-b border-border bg-muted/30 px-4 py-2">
            <div className="text-sm font-medium text-muted-foreground">Bookmaker</div>
            {selections.map((selection) => (
              <div key={selection} className="text-center text-sm font-medium text-muted-foreground">
                {selection}
              </div>
            ))}
          </div>

          {/* Odds Rows */}
          <div className="divide-y divide-border">
            {oddsByBookmaker.map(({ bookmaker, odds: bookOdds }) => (
              <div
                key={bookmaker.id}
                className="grid grid-cols-[1fr,repeat(auto-fit,minmax(60px,1fr))] items-center gap-2 px-4 py-3 hover:bg-muted/30"
              >
                {/* Bookmaker */}
                <a
                  href={trackedHref(bookmaker.slug, {
                    placement: 'odds-table',
                    matchId: matchContext?.matchId,
                    match: matchContext?.match,
                    sport: matchContext?.sport,
                    league: matchContext?.league,
                    market: currentMarket?.slug,
                    fallback: bookmaker.affiliate_url,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-bold">
                    {bookmaker.name.charAt(0)}
                  </div>
                  <span className="truncate">{bookmaker.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>

                {/* Odds for each selection */}
                {selections.map((selection) => {
                  const odd = bookOdds.find((o) => o.selection === selection);
                  const isBest = odd && odd.value === bestOdds[selection];

                  return (
                    <div
                      key={selection}
                      className={cn(
                        'rounded px-2 py-1.5 text-center font-mono text-sm font-semibold transition-colors',
                        isBest
                          ? 'bg-success/10 text-success'
                          : 'bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer'
                      )}
                    >
                      {odd ? formatOdds(odd.value, settings.oddsFormat) : '-'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {oddsByBookmaker.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No odds available for this market
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
