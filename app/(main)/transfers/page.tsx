import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';
import { STATIC_TRANSFER_ODDS } from '@/lib/api/static-transfers';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Football Transfer Odds 2025 - Next Club Betting | Betcheza',
  description: 'Compare football transfer betting odds for the biggest stars. Mohamed Salah, Vinicius Jr, Erling Haaland transfer destination odds from major bookmakers. Post tips and win prizes.',
  openGraph: {
    title: 'Football Transfer Betting Odds 2025 | Betcheza',
    description: 'Where will the biggest football stars end up? Live transfer destination odds for top players.',
    type: 'website',
  },
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function TransfersPage() {
  const players = STATIC_TRANSFER_ODDS.global;

  return (
    <div className="flex-1 px-3 py-4 md:px-4 md:py-5 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ArrowLeftRight className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-bold sm:text-2xl">Football Transfer Odds</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Betting odds on the summer&apos;s biggest football transfers. Prices sourced from major UK and EU bookmakers. Tipsters — post your transfer tips and earn points.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => {
          const playerSlug = slugify(player.player);
          const topOutcomes = player.outcomes.slice(0, 3);
          const favourite = player.outcomes[0];
          return (
            <Card key={player.player} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-bold leading-tight">{player.player}</CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {player.currentClub}
                    </p>
                  </div>
                  <Link href={`/transfers/${playerSlug}`}>
                    <Badge variant="outline" className="text-[10px] shrink-0 hover:bg-blue-500/10 cursor-pointer">
                      All odds <ArrowRight className="ml-0.5 h-2.5 w-2.5" />
                    </Badge>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1">
                {topOutcomes.map((o, i) => (
                  <div key={`${o.name}-${i}`} className={cn(
                    'flex items-center justify-between rounded-md px-2 py-1 text-xs',
                    i === 0 ? 'bg-blue-500/10' : 'bg-muted/40'
                  )}>
                    <span className="truncate min-w-0 flex-1 font-medium">{o.name}</span>
                    <div className="ml-2 flex shrink-0 items-center gap-1.5">
                      <span className={cn('font-mono font-bold', i === 0 ? 'text-blue-500' : 'text-muted-foreground')}>
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
                {player.outcomes.length > 3 && (
                  <Link href={`/transfers/${playerSlug}`} className="block text-center text-[10px] text-primary hover:underline pt-0.5">
                    +{player.outcomes.length - 3} more outcomes →
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* SEO text */}
      <div className="mt-8 rounded-lg border bg-muted/20 p-4">
        <h2 className="text-sm font-bold mb-2">Football Transfer Betting 2025</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The summer 2025 transfer window is one of the most exciting in years. Mohamed Salah&apos;s future at Liverpool, 
          Vinicius Jr&apos;s potential Saudi move, and Erling Haaland&apos;s Real Madrid links dominate the headlines. 
          Use Betcheza to bet on where the biggest stars will end up, post your transfer tips, and compete with other 
          tipsters on the leaderboard. Odds sourced from major UK/EU bookmakers.
        </p>
      </div>
    </div>
  );
}
