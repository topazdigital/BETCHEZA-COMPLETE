import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, TrendingUp, Star, Target, ArrowRight, Globe, Swords, Shield, Tv, Zap, Flag, Music } from 'lucide-react';
import { discoverAllOutrights } from '@/lib/api/outright-discovery';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Outright Betting Odds - All Sports & Leagues | Betcheza',
  description: 'Compare live outright betting odds across all sports: football league winners, top scorers, World Cup 2026, Champions League, NBA, NFL, golf, tennis and more. Real bookmaker prices, updated daily.',
  openGraph: {
    title: 'Outright Betting Odds - All Sports | Betcheza',
    description: 'All outright markets in one place — football, basketball, tennis, golf, motor racing and more.',
    type: 'website',
  },
};

export const revalidate = 43200;

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'International':    { icon: Globe,   color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'Champions League': { icon: Star,    color: 'text-purple-500',  bg: 'bg-purple-500/10' },
  'European Cups':    { icon: Swords,  color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  'League Winners':   { icon: Trophy,  color: 'text-yellow-500',  bg: 'bg-yellow-500/10' },
  'Top Scorers':      { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'Domestic Cups':    { icon: Shield,  color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  'Specials':         { icon: Target,  color: 'text-rose-500',    bg: 'bg-rose-500/10' },
  'NBA':              { icon: Trophy,  color: 'text-sky-500',     bg: 'bg-sky-500/10' },
  'NFL':              { icon: Trophy,  color: 'text-green-600',   bg: 'bg-green-600/10' },
  'MLB':              { icon: Trophy,  color: 'text-red-500',     bg: 'bg-red-500/10' },
  'NHL':              { icon: Trophy,  color: 'text-cyan-500',    bg: 'bg-cyan-500/10' },
  'US Soccer':        { icon: Flag,    color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  'NCAA':             { icon: Trophy,  color: 'text-amber-600',   bg: 'bg-amber-600/10' },
  'Tennis':           { icon: Zap,     color: 'text-lime-500',    bg: 'bg-lime-500/10' },
  'Golf':             { icon: Flag,    color: 'text-green-500',   bg: 'bg-green-500/10' },
  'Motor Racing':     { icon: Zap,     color: 'text-red-600',     bg: 'bg-red-600/10' },
  'Cricket':          { icon: Trophy,  color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  'Rugby':            { icon: Trophy,  color: 'text-brown-500',   bg: 'bg-orange-700/10' },
  'Boxing/MMA':       { icon: Swords,  color: 'text-red-700',     bg: 'bg-red-700/10' },
  'Basketball':       { icon: Trophy,  color: 'text-orange-400',  bg: 'bg-orange-400/10' },
  'American Football':{ icon: Trophy,  color: 'text-green-700',   bg: 'bg-green-700/10' },
  'Snooker':          { icon: Target,  color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
  'Darts':            { icon: Target,  color: 'text-violet-500',  bg: 'bg-violet-500/10' },
  'Australian Rules': { icon: Trophy,  color: 'text-yellow-600',  bg: 'bg-yellow-600/10' },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { icon: Trophy, color: 'text-muted-foreground', bg: 'bg-muted/40' };
}

export default async function OutrightsPage() {
  const markets = await discoverAllOutrights();

  const grouped: Record<string, typeof markets> = {};
  for (const m of markets) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  const categoryOrder = [
    'International','Champions League','European Cups','League Winners',
    'Top Scorers','Domestic Cups','Specials',
    'NBA','NFL','MLB','NHL','US Soccer','NCAA',
    'Tennis','Golf','Motor Racing','Cricket','Rugby',
    'Boxing/MMA','Basketball','American Football','Baseball',
    'Ice Hockey','Australian Rules','Snooker','Darts','Other Competitions',
  ];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (categoryOrder.indexOf(a) + 1 || 99) - (categoryOrder.indexOf(b) + 1 || 99)
  );

  const hasData = markets.length > 0;
  const totalMarkets = markets.length;
  const totalOutcomes = markets.reduce((s, m) => s + m.totalOutcomes, 0);

  return (
    <div className="w-full min-h-screen">
      {/* Compact header */}
      <div className="border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="h-4 w-4 shrink-0 text-yellow-500" />
            <h1 className="text-base font-bold sm:text-lg leading-tight">Outright Betting Odds</h1>
            {hasData && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{totalMarkets}</span> markets ·
                <span className="font-semibold text-foreground">{totalOutcomes}</span> selections
              </span>
            )}
          </div>
          {hasData && (
            <p className="text-[11px] text-muted-foreground w-full sm:hidden">
              {totalMarkets} markets · {totalOutcomes} selections · Real bookmaker prices
            </p>
          )}
        </div>

        {/* Category pills */}
        {hasData && (
          <div className="mt-2 flex flex-wrap gap-1">
            {sortedCategories.map(cat => {
              const { icon: Icon, color, bg } = getCategoryMeta(cat);
              return (
                <a
                  key={cat}
                  href={`#${cat.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`}
                  className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-75', color, bg)}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {cat}
                  <span className="opacity-60">({grouped[cat].length})</span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
          <Trophy className="h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-sm">No live outright markets found</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Outright markets require a live odds provider (The Odds API). Configure your API key in Admin → Settings to enable live odds.
          </p>
        </div>
      ) : (
        <div className="px-2 py-3 sm:px-3 space-y-4">
          {sortedCategories.map(cat => {
            const items = grouped[cat];
            const { icon: Icon, color, bg } = getCategoryMeta(cat);
            return (
              <section key={cat} id={cat.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}>
                {/* Section header */}
                <div className="mb-2 flex items-center gap-1.5">
                  <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded', bg)}>
                    <Icon className={cn('h-3 w-3', color)} />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat}</h2>
                  <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
                </div>

                {/* Market cards grid — compact, more per row */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map(market => {
                    const firstMarket = market.markets[0];
                    const topOutcomes = firstMarket?.outcomes.slice(0, 4) ?? [];
                    return (
                      <div
                        key={market.sportKey}
                        className="rounded-lg border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow"
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between gap-1.5 px-2.5 pt-2 pb-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold leading-tight truncate">{market.title}</p>
                            {market.leagueName && market.leagueName !== market.title && (
                              <p className="text-[10px] text-muted-foreground truncate">{market.leagueName}</p>
                            )}
                          </div>
                          <Link href={`/outrights/${market.slug}`} className="shrink-0">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 hover:bg-primary/10 cursor-pointer gap-0.5">
                              All <ArrowRight className="h-2 w-2" />
                            </Badge>
                          </Link>
                        </div>

                        {/* Outcomes */}
                        <div className="px-2 pb-2 space-y-0.5">
                          {topOutcomes.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground px-1">No data</p>
                          ) : (
                            topOutcomes.map((o, i) => (
                              <div
                                key={`${o.name}-${i}`}
                                className={cn(
                                  'flex items-center justify-between rounded px-2 py-1 text-[11px]',
                                  i === 0 ? 'bg-yellow-500/10' : 'bg-muted/40'
                                )}
                              >
                                <span className="truncate min-w-0 flex-1 font-medium leading-tight">{o.name}</span>
                                <div className="ml-1.5 flex shrink-0 items-center gap-1">
                                  <span className={cn(
                                    'font-mono font-bold text-[11px]',
                                    i === 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'
                                  )}>
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
                            <Link
                              href={`/outrights/${market.slug}`}
                              className="block text-center text-[10px] text-primary hover:underline pt-0.5"
                            >
                              +{firstMarket.outcomes.length - 4} more →
                            </Link>
                          )}
                        </div>
                      </div>
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
