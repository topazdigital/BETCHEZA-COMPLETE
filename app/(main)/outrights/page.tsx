import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, TrendingUp, Star, Target, ArrowRight, Globe, Swords, Shield } from 'lucide-react';
import { discoverAllOutrights } from '@/lib/api/outright-discovery';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Outright Football Betting Odds - Winner, Top Scorer & Specials | Betcheza',
  description: 'Compare real outright football betting odds: league winners, top scorers, World Cup 2026, Champions League, relegation, manager specials and more. Live prices from major bookmakers.',
  openGraph: {
    title: 'Outright Football Betting Odds 2025/26 | Betcheza',
    description: 'All outright football markets in one place — league winners, top scorers, World Cup, Champions League and football specials.',
    type: 'website',
  },
};

export const revalidate = 43200;

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; description: string }> = {
  International: { icon: Globe, color: 'text-blue-500 bg-blue-500/10', description: 'World Cup, Euros, Copa America and more' },
  'Champions League': { icon: Star, color: 'text-purple-500 bg-purple-500/10', description: 'UEFA Champions League outrights' },
  'European Cups': { icon: Swords, color: 'text-indigo-500 bg-indigo-500/10', description: 'Europa League, Conference League' },
  'League Winners': { icon: Trophy, color: 'text-yellow-500 bg-yellow-500/10', description: 'Which team wins the league?' },
  'Top Scorers': { icon: TrendingUp, color: 'text-emerald-500 bg-emerald-500/10', description: 'Top scorer futures markets' },
  'Domestic Cups': { icon: Shield, color: 'text-orange-500 bg-orange-500/10', description: 'FA Cup, Coppa Italia, and more' },
  Specials: { icon: Target, color: 'text-rose-500 bg-rose-500/10', description: 'Manager, transfer, and special bets' },
  'North America': { icon: Trophy, color: 'text-sky-500 bg-sky-500/10', description: 'NBA, NFL, MLB and more' },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { icon: Trophy, color: 'text-muted-foreground bg-muted/40', description: '' };
}

export default async function OutrightsPage() {
  const markets = await discoverAllOutrights();

  const grouped: Record<string, typeof markets> = {};
  for (const m of markets) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  const categoryOrder = [
    'International', 'Champions League', 'European Cups', 'League Winners',
    'Top Scorers', 'Domestic Cups', 'Specials', 'North America', 'Other Competitions',
  ];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (categoryOrder.indexOf(a) + 1 || 99) - (categoryOrder.indexOf(b) + 1 || 99)
  );

  const hasData = markets.length > 0;

  return (
    <div className="flex-1 px-3 py-4 md:px-4 md:py-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-5 w-5 text-warning" />
          <h1 className="text-xl font-bold sm:text-2xl">Outright Betting Odds</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          All live outright football markets in one place — league winners, top scorers, World Cup 2026, Champions League, manager specials and more. Real bookmaker prices, updated daily.
        </p>
        {hasData && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sortedCategories.map(cat => {
              const { icon: Icon, color } = getCategoryMeta(cat);
              return (
                <a key={cat} href={`#${cat.toLowerCase().replace(/\s+/g, '-')}`} className={cn('flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-80', color)}>
                  <Icon className="h-3 w-3" />
                  {cat}
                  <span className="opacity-60">({grouped[cat].length})</span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/30" />
            <p className="font-semibold">No live outright markets found</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Outright markets require a live odds provider (The Odds API). Configure your API key in Admin → Settings to enable live odds.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedCategories.map(cat => {
            const items = grouped[cat];
            const { icon: Icon, color, description } = getCategoryMeta(cat);
            return (
              <section key={cat} id={cat.toLowerCase().replace(/\s+/g, '-')}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">{cat}</h2>
                    {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(market => {
                    const firstMarket = market.markets[0];
                    const topOutcomes = firstMarket?.outcomes.slice(0, 4) ?? [];
                    return (
                      <Card key={market.sportKey} className="overflow-hidden transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-sm font-bold leading-tight">{market.title}</CardTitle>
                              {market.leagueName && market.leagueName !== market.title && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{market.leagueName}</p>
                              )}
                            </div>
                            <Link href={`/outrights/${market.slug}`}>
                              <Badge variant="outline" className="text-[10px] shrink-0 hover:bg-primary/10 cursor-pointer">
                                All odds <ArrowRight className="ml-0.5 h-2.5 w-2.5" />
                              </Badge>
                            </Link>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1">
                          {topOutcomes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No outcomes available</p>
                          ) : (
                            topOutcomes.map((o, i) => (
                              <div key={`${o.name}-${i}`} className={cn(
                                'flex items-center justify-between rounded-md px-2 py-1 text-xs',
                                i === 0 ? 'bg-warning/10' : 'bg-muted/40'
                              )}>
                                <span className="truncate min-w-0 flex-1 font-medium">{o.name}</span>
                                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                                  <span className={cn('font-mono font-bold', i === 0 ? 'text-warning' : 'text-success')}>
                                    {o.price.toFixed(2)}
                                  </span>
                                  <OutrightTipButton
                                    data={{
                                      leagueId: market.leagueId ?? 0,
                                      leagueName: market.leagueName ?? market.title,
                                      marketName: market.title,
                                      marketKey: market.sportKey.includes('top_scorer') ? 'top_scorer' : 'outright_winner',
                                      prediction: o.name,
                                      odds: o.price,
                                      matchSlug: market.leagueSlug,
                                      sport: 'football',
                                    }}
                                  />
                                </div>
                              </div>
                            ))
                          )}
                          {firstMarket && firstMarket.outcomes.length > 4 && (
                            <Link href={`/outrights/${market.slug}`} className="block text-center text-[10px] text-primary hover:underline pt-0.5">
                              +{firstMarket.outcomes.length - 4} more outcomes →
                            </Link>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
