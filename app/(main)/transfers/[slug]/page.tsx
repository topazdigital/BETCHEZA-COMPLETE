import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, ChevronRight, TrendingUp } from 'lucide-react';
import { STATIC_TRANSFER_ODDS, type TransferOddsEntry } from '@/lib/api/static-transfers';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
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

const POSITION_COLOR: Record<string, string> = {
  FW: 'text-red-500 bg-red-500/10',
  AM: 'text-orange-500 bg-orange-500/10',
  MF: 'text-blue-500 bg-blue-500/10',
  DM: 'text-green-600 bg-green-600/10',
  CB: 'text-teal-500 bg-teal-500/10',
  RB: 'text-violet-500 bg-violet-500/10',
  LB: 'text-violet-500 bg-violet-500/10',
  GK: 'text-yellow-600 bg-yellow-600/10',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const player = getPlayerBySlug(slug);
  if (!player) return { title: 'Transfer Odds | Betcheza' };

  const fav = player.outcomes[0];
  const top3 = player.outcomes.slice(0, 3).map(o => `${o.name} (${o.price.toFixed(2)})`).join(', ');
  const description = `Where will ${player.player} go? Latest transfer destination odds from Bet365, William Hill & Paddy Power. Current favourite: ${fav?.name} at ${fav?.price.toFixed(2)}. Odds: ${top3}.`;

  return {
    title: `${player.player} Transfer Odds 2025/26 – Next Club Betting | Betcheza`,
    description,
    openGraph: { title: `${player.player} Transfer Odds | Betcheza`, description, type: 'article' },
    alternates: { canonical: `/transfers/${slug}` },
    other: {
      'script:ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${player.player} Transfer Odds 2025/26`,
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
  const allPlayers = STATIC_TRANSFER_ODDS.global;
  const playerIndex = allPlayers.findIndex(p => slugify(p.player) === slug);
  const prevPlayer = playerIndex > 0 ? allPlayers[playerIndex - 1] : null;
  const nextPlayer = playerIndex < allPlayers.length - 1 ? allPlayers[playerIndex + 1] : null;

  if (!player) {
    return (
      <div className="w-full px-3 py-4">
        <Button variant="ghost" size="sm" className="mb-4 h-7 text-xs px-2" asChild>
          <Link href="/transfers"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />All Transfers</Link>
        </Button>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ArrowLeftRight className="h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-sm">Player not found</p>
          <Button asChild size="sm"><Link href="/transfers">Browse all transfers</Link></Button>
        </div>
      </div>
    );
  }

  const fav = player.outcomes[0];
  const posColor = player.position ? POSITION_COLOR[player.position] ?? 'text-muted-foreground bg-muted/40' : '';

  return (
    <div className="w-full min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-card px-3 py-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Link href="/transfers" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeftRight className="h-3 w-3" /> Transfers
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium truncate">{player.player}</span>
      </div>

      <div className="px-3 py-3 sm:px-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold sm:text-lg leading-tight">{player.player}</h1>
                {player.position && (
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', posColor)}>
                    {player.position}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {player.currentClub}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{player.outcomes.length} destinations priced</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0" asChild>
              <Link href="/transfers"><ArrowLeft className="mr-1 h-3 w-3" />Back</Link>
            </Button>
          </div>

          {/* Favourite highlight */}
          {fav && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2">
              <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Most Likely Destination</p>
                <p className="text-sm font-bold truncate">{fav.name}</p>
              </div>
              <div className="ml-auto text-xl font-mono font-bold text-blue-500">{fav.price.toFixed(2)}</div>
            </div>
          )}
        </div>

        {/* All outcomes */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold">{player.player} – Next Club Odds</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Bet365 · William Hill · Paddy Power</span>
          </div>
          <div className="p-2 space-y-1">
            {player.outcomes.map((o, idx) => (
              <div
                key={`${o.name}-${idx}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                  idx === 0 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-muted/40'
                )}
              >
                <span className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                  idx === 0 && 'bg-blue-500 text-white',
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
                    idx === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                  )}>
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
        </div>

        {/* SEO note */}
        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Latest bookmaker odds on where <strong>{player.player}</strong> will play next season.
            Currently at <strong>{player.currentClub}</strong>, the favourite destination is <strong>{fav?.name}</strong> at{' '}
            <strong>{fav?.price.toFixed(2)}</strong>. Prices sourced from Bet365, William Hill, Paddy Power and Betfair Exchange.
          </p>
        </div>

        {/* Prev / Next player navigation */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {prevPlayer ? (
            <Link
              href={`/transfers/${slugify(prevPlayer.player)}`}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition-colors min-w-0 flex-1"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{prevPlayer.player}</span>
            </Link>
          ) : <div className="flex-1" />}
          {nextPlayer ? (
            <Link
              href={`/transfers/${slugify(nextPlayer.player)}`}
              className="flex items-center justify-end gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition-colors min-w-0 flex-1"
            >
              <span className="truncate">{nextPlayer.player}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
          ) : <div className="flex-1" />}
        </div>

        <div className="mt-3 text-center">
          <Link href="/transfers" className="text-[11px] text-primary hover:underline">
            ← View all {STATIC_TRANSFER_ODDS.global.length} players
          </Link>
        </div>
      </div>
    </div>
  );
}
