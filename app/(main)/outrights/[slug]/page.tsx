import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, ArrowLeft, Star, ExternalLink } from 'lucide-react';
import { discoverAllOutrights } from '@/lib/api/outright-discovery';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  if (!market) {
    return { title: 'Outright Odds | Betcheza' };
  }

  const topFav = market.markets[0]?.outcomes[0];
  const top3 = market.markets[0]?.outcomes.slice(0, 3).map(o => `${o.name} ${o.price.toFixed(2)}`).join(', ');
  const description = topFav
    ? `${market.title} betting odds 2025/26. Top favourite: ${topFav.name} at ${topFav.price.toFixed(2)}. Compare prices: ${top3}. Post tips & win prizes on Betcheza.`
    : `Live ${market.title} outright betting odds from major UK and EU bookmakers. Compare prices and post tips.`;

  return {
    title: `${market.title} Betting Odds 2025/26 | Betcheza`,
    description,
    openGraph: {
      title: `${market.title} Odds | Betcheza`,
      description,
      type: 'website',
    },
    alternates: {
      canonical: `/outrights/${slug}`,
    },
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
      <div className="flex-1 px-3 py-4 md:px-4">
        <Button variant="ghost" size="sm" className="mb-4 h-7 text-xs px-2" asChild>
          <Link href="/outrights"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />All Outrights</Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/30" />
            <p className="font-semibold">Market not found</p>
            <p className="text-sm text-muted-foreground">This outright market may not be active right now. Check back soon.</p>
            <Button asChild size="sm"><Link href="/outrights">Browse all outrights</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const leagueHref = market.leagueSlug ? `/leagues/${market.leagueSlug}` : null;

  return (
    <div className="flex-1 px-3 py-4 md:px-4 md:py-5 max-w-4xl mx-auto">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" asChild>
          <Link href="/outrights"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />All Outrights</Link>
        </Button>
        {leagueHref && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" asChild>
            <Link href={leagueHref}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />{market.leagueName ?? 'League page'}</Link>
          </Button>
        )}
      </div>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-5 w-5 text-warning" />
          <h1 className="text-xl font-bold sm:text-2xl">{market.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">{market.category}</Badge>
          <span className="text-xs text-muted-foreground">{market.totalOutcomes} outcomes from live bookmakers</span>
        </div>
      </div>

      <div className="space-y-6">
        {market.markets.map((m, mi) => (
          <Card key={m.eventId ?? mi}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-warning" />
                  {m.marketName}
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">{m.outcomes.length} selections</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {m.outcomes.map((o, idx) => (
                  <div
                    key={`${o.name}-${idx}`}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                      idx === 0 ? 'bg-warning/10 border border-warning/20' : 'bg-muted/40'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        idx === 0 && 'bg-warning text-warning-foreground',
                        idx === 1 && 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
                        idx === 2 && 'bg-amber-700 text-amber-100',
                        idx > 2 && 'bg-muted text-muted-foreground',
                      )}>
                        {idx + 1}
                      </span>
                      <span className="truncate font-medium">{o.name}</span>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-2">
                      <span className={cn('font-mono font-bold', idx === 0 ? 'text-warning text-base' : 'text-success')}>
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
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SEO text block */}
      <div className="mt-8 rounded-lg border bg-muted/20 p-4">
        <h2 className="text-sm font-bold mb-2">{market.title} Betting Guide</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          These are live {market.title} outright odds aggregated from major UK and EU bookmakers. 
          Prices are updated regularly throughout the season. The favourite to win is currently{' '}
          <strong>{market.markets[0]?.outcomes[0]?.name}</strong> at{' '}
          <strong>{market.markets[0]?.outcomes[0]?.price.toFixed(2)}</strong>.
          Use Betcheza to post tips, track your record, and compete with other tipsters on the leaderboard.
        </p>
      </div>
    </div>
  );
}
