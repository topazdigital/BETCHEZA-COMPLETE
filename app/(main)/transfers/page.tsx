import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftRight, ArrowRight, TrendingUp } from 'lucide-react';
import { STATIC_TRANSFER_ODDS } from '@/lib/api/static-transfers';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Football Transfer Odds 2025/26 - Next Club Betting | Betcheza',
  description: 'Compare football transfer betting odds for the biggest stars — Mbappé, Haaland, Salah, Wirtz and more. Real bookmaker prices from Bet365, William Hill & Paddy Power. Post tips and win prizes.',
  openGraph: {
    title: 'Football Transfer Betting Odds 2025/26 | Betcheza',
    description: 'Where will the biggest football stars end up? Live transfer destination odds for 40+ players.',
    type: 'website',
  },
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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

export default function TransfersPage() {
  const players = STATIC_TRANSFER_ODDS.global;
  const totalPlayers = players.length;

  return (
    <div className="w-full min-h-screen">
      {/* Compact header */}
      <div className="border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-blue-500" />
            <h1 className="text-base font-bold sm:text-lg leading-tight">Football Transfer Odds</h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{totalPlayers}</span> players priced
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] text-muted-foreground">Real bookmaker prices · Updated daily</span>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Bet on where the biggest stars will play next. Prices from Bet365, William Hill, Paddy Power &amp; Betfair.
        </p>
      </div>

      {/* Player grid */}
      <div className="px-2 py-3 sm:px-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {players.map((player) => {
            const playerSlug = slugify(player.player);
            const topOutcomes = player.outcomes.slice(0, 3);
            const favourite = player.outcomes[0];
            const posColor = player.position ? POSITION_COLOR[player.position] ?? 'text-muted-foreground bg-muted/40' : '';

            return (
              <div
                key={player.player}
                className="rounded-lg border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-1.5 px-2.5 pt-2 pb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-xs font-bold leading-tight truncate">{player.player}</p>
                      {player.position && (
                        <span className={cn('shrink-0 rounded px-1 py-0 text-[9px] font-bold leading-4', posColor)}>
                          {player.position}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      <p className="text-[10px] text-muted-foreground truncate">{player.currentClub}</p>
                    </div>
                  </div>
                  <Link href={`/transfers/${playerSlug}`} className="shrink-0">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 hover:bg-blue-500/10 cursor-pointer gap-0.5">
                      All <ArrowRight className="h-2 w-2" />
                    </Badge>
                  </Link>
                </div>

                {/* Outcomes */}
                <div className="px-2 pb-2 space-y-0.5">
                  {topOutcomes.map((o, i) => (
                    <div
                      key={`${o.name}-${i}`}
                      className={cn(
                        'flex items-center justify-between rounded px-2 py-1 text-[11px]',
                        i === 0 ? 'bg-blue-500/10' : 'bg-muted/40'
                      )}
                    >
                      <span className="truncate min-w-0 flex-1 font-medium leading-tight">{o.name}</span>
                      <div className="ml-1.5 flex shrink-0 items-center gap-1">
                        <span className={cn(
                          'font-mono font-bold text-[11px]',
                          i === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
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
                  {player.outcomes.length > 3 && (
                    <Link
                      href={`/transfers/${playerSlug}`}
                      className="block text-center text-[10px] text-primary hover:underline pt-0.5"
                    >
                      +{player.outcomes.length - 3} more destinations →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info note */}
        <div className="mt-4 rounded-lg border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Football Transfer Betting 2025/26:</strong> The summer 2025/26 transfer window is one of the most active in years.
            Odds sourced from major UK and European bookmakers including Bet365, William Hill, Paddy Power, and Betfair Exchange.
            Prices are updated throughout the window as rumours develop. Think you know where a player is heading?
            Post your transfer tip on Betcheza and compete with thousands of tipsters on the leaderboard.
          </p>
        </div>
      </div>
    </div>
  );
}
