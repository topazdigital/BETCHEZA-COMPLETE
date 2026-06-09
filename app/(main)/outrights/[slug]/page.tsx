import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, ArrowLeft, Star, ExternalLink, ChevronRight } from 'lucide-react';
import { discoverAllOutrights } from '@/lib/api/outright-discovery';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getMarket = cache(async (slug: string) => {
  const all = await discoverAllOutrights();
  return all.find(m => m.slug === slug) ?? null;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const market = await getMarket(slug);
  if (!market) return { title: 'Outright Odds | Betcheza' };

  const topFav = market.markets[0]?.outcomes[0];
  const top3 = market.markets[0]?.outcomes.slice(0, 3).map(o => `${o.name} ${o.price.toFixed(2)}`).join(', ');
  const description = topFav
    ? `${market.title} betting odds. Top favourite: ${topFav.name} at ${topFav.price.toFixed(2)}. Compare prices: ${top3}. Post tips & win prizes on Betcheza.`
    : `Live ${market.title} outright betting odds from major UK and EU bookmakers. Compare prices and post tips.`;

  return {
    title: `${market.title} Betting Odds | Betcheza`,
    description,
    openGraph: { title: `${market.title} Odds | Betcheza`, description, type: 'website' },
    alternates: { canonical: `/outrights/${slug}` },
    other: {
      'script:ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${market.title} Betting Odds`,
        description: `Outright betting odds for ${market.title}`,
        itemListElement: (market.markets[0]?.outcomes ?? []).slice(0, 10).map((o, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: o.name,
          description: `${o.name} to win: ${o.price.toFixed(2)}`,
        })),
      }),
    },
  };
}

export const revalidate = 43200;

export default async function OutrightSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const market = await getMarket(slug);

  if (!market) {
    return (
      <div className="w-full px-3 py-4">
        <Button variant="ghost" size="sm" className="mb-4 h-7 text-xs px-2" asChild>
          <Link href="/outrights"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />All Outrights</Link>
        </Button>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-sm">Market not found</p>
          <p className="text-xs text-muted-foreground">This outright market may not be active right now.</p>
          <Button asChild size="sm"><Link href="/outrights">Browse all outrights</Link></Button>
        </div>
      </div>
    );
  }

  const leagueHref = market.leagueSlug ? `/leagues/${market.leagueSlug}` : null;
  const firstMarket = market.markets[0];
  const fav = firstMarket?.outcomes[0];

  return (
    <div className="w-full min-h-screen">
      {/* Top breadcrumb bar */}
      <div className="border-b border-border bg-card px-3 py-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Link href="/outrights" className="hover:text-foreground transition-colors flex items-center gap-1">
          <Trophy className="h-3 w-3" /> Outrights
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium truncate">{market.title}</span>
      </div>

      <div className="px-3 py-3 sm:px-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold sm:text-lg leading-tight">{market.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{market.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{market.totalOutcomes} selections from live bookmakers</span>
                {leagueHref && (
                  <Link href={leagueHref} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                    <ExternalLink className="h-2.5 w-2.5" />{market.leagueName}
                  </Link>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0" asChild>
              <Link href="/outrights"><ArrowLeft className="mr-1 h-3 w-3" />Back</Link>
            </Button>
          </div>

          {/* Favourite highlight */}
          {fav && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
              <Star className="h-4 w-4 text-yellow-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Current Favourite</p>
                <p className="text-sm font-bold truncate">{fav.name}</p>
              </div>
              <div className="ml-auto text-xl font-mono font-bold text-yellow-500">{fav.price.toFixed(2)}</div>
            </div>
          )}
        </div>

        {/* Markets */}
        <div className="space-y-3">
          {market.markets.map((m, mi) => (
            <div key={m.eventId ?? mi} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-xs font-semibold">{m.marketName}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{m.outcomes.length} selections</span>
              </div>
              <div className="p-2 space-y-1">
                {m.outcomes.map((o, idx) => (
                  <div
                    key={`${o.name}-${idx}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                      idx === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-muted/40'
                    )}
                  >
                    <span className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                      idx === 0 && 'bg-yellow-500 text-white',
                      idx === 1 && 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
                      idx === 2 && 'bg-amber-700 text-amber-100',
                      idx > 2 && 'bg-muted text-muted-foreground',
                    )}>
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate font-medium">{o.name}</span>
                    <div className="flex shrink-0 items-center gap-1.5 ml-auto">
                      <span className={cn(
                        'font-mono font-bold text-xs',
                        idx === 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'
                      )}>
                        {o.price.toFixed(2)}
                      </span>
                      <OutrightTipButton
                        data={{
                          leagueId: market.leagueId ?? 0,
                          leagueName: market.leagueName ?? market.title,
                          marketName: m.marketName,
                          marketKey: market.sportKey.includes('top_scorer') ? 'top_scorer' : 'outright_winner',
                          prediction: o.name,
                          odds: o.price,
                          matchSlug: market.leagueSlug,
                          sport: 'football',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* SEO footer */}
        <div className="mt-4 rounded-lg border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Live <strong>{market.title}</strong> outright odds aggregated from major UK and EU bookmakers. 
            Current favourite: <strong>{fav?.name}</strong> at <strong>{fav?.price.toFixed(2)}</strong>. 
            Post your tip on Betcheza and compete on the leaderboard.
          </p>
        </div>
      </div>
    </div>
  );
}
