import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight } from 'lucide-react';
import { STATIC_TRANSFER_ODDS, type TransferOddsEntry } from '@/lib/api/static-transfers';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getPlayerBySlug(slug: string): TransferOddsEntry | null {
  return STATIC_TRANSFER_ODDS.global.find(p => slugify(p.player) === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const player = getPlayerBySlug(slug);
  if (!player) return { title: 'Transfer Odds | Betcheza' };

  const fav = player.outcomes[0];
  const top3 = player.outcomes.slice(0, 3).map(o => `${o.name} (${o.price.toFixed(2)})`).join(', ');
  const description = `Where will ${player.player} go? Latest transfer destination betting odds from major bookmakers. Current favourite: ${fav?.name} at ${fav?.price.toFixed(2)}. Odds: ${top3}.`;

  return {
    title: `${player.player} Transfer Odds 2025 – Next Club Betting | Betcheza`,
    description,
    openGraph: {
      title: `${player.player} Transfer Odds 2025 | Betcheza`,
      description,
      type: 'article',
    },
    alternates: {
      canonical: `/transfers/${slug}`,
    },
    other: {
      'script:ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${player.player} Transfer Odds 2025`,
        description,
        about: {
          '@type': 'Person',
          name: player.player,
          affiliation: { '@type': 'SportsTeam', name: player.currentClub },
        },
      }),
    },
  };
}

export default async function TransferPlayerPage({ params }: PageProps) {
  const { slug } = await params;
  const player = getPlayerBySlug(slug);

  if (!player) {
    return (
      <div className="flex-1 px-3 py-4 md:px-4">
        <Button variant="ghost" size="sm" className="mb-4 h-7 text-xs px-2" asChild>
          <Link href="/transfers"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />All Transfers</Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ArrowLeftRight className="h-12 w-12 text-muted-foreground/30" />
            <p className="font-semibold">Player not found</p>
            <Button asChild size="sm"><Link href="/transfers">Browse all transfers</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 px-3 py-4 md:px-4 md:py-5 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4 h-7 text-xs px-2" asChild>
        <Link href="/transfers"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />All Transfers</Link>
      </Button>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <ArrowLeftRight className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-bold sm:text-2xl">{player.player} Transfer Odds</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            Currently at {player.currentClub}
          </Badge>
          <span className="text-xs text-muted-foreground">{player.outcomes.length} destinations priced by bookmakers</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowLeftRight className="h-4 w-4 text-blue-500" />
            {player.player} – Next Club Odds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {player.outcomes.map((o, idx) => (
              <div
                key={`${o.name}-${idx}`}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                  idx === 0 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-muted/40'
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    idx === 0 && 'bg-blue-500 text-white',
                    idx === 1 && 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
                    idx === 2 && 'bg-amber-700 text-amber-100',
                    idx > 2 && 'bg-muted text-muted-foreground',
                  )}>
                    {idx + 1}
                  </span>
                  <span className="truncate font-medium">{o.name}</span>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  <span className={cn('font-mono font-bold', idx === 0 ? 'text-blue-500 text-base' : 'text-success')}>
                    {o.price.toFixed(2)}
                  </span>
                  <OutrightTipButton
                    data={{
                      leagueId: 1,
                      leagueName: 'Transfer Market',
                      marketName: `${player.player} Next Club`,
                      marketKey: 'player_transfer',
                      prediction: `${player.player} → ${o.name}`,
                      odds: o.price,
                      sport: 'football',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SEO text */}
      <div className="mt-6 rounded-lg border bg-muted/20 p-4">
        <h2 className="text-sm font-bold mb-2">{player.player} – Transfer Betting Guide 2025</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          These are the latest bookmaker odds on where {player.player} will play next. 
          Currently at {player.currentClub}, the favourite destination is <strong>{player.outcomes[0]?.name}</strong> at{' '}
          <strong>{player.outcomes[0]?.price.toFixed(2)}</strong>. 
          Prices are sourced from major UK and European bookmakers and updated regularly through the transfer window. 
          Think you know where {player.player} is heading? Post your transfer tip on Betcheza and compete with 
          thousands of other football tipsters.
        </p>
      </div>

      <div className="mt-4 text-center">
        <Button asChild variant="outline" size="sm">
          <Link href="/transfers">
            <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
            All player transfer odds
          </Link>
        </Button>
      </div>
    </div>
  );
}
