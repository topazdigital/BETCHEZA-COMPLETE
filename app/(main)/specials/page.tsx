import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, Star, ArrowLeftRight, TrendingUp, Zap, AlertCircle } from 'lucide-react';
import { discoverAllOutrights, isOutrightsQuotaExhausted, type OutrightDiscovery } from '@/lib/api/outright-discovery';
import { STATIC_TRANSFER_ODDS, type TransferOddsEntry } from '@/lib/api/static-transfers';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Outright Odds, Specials & Transfer Markets | Betcheza',
  description:
    'Live outright winner odds from real bookmakers — EPL winner, UCL winner, NBA champion, NFL Super Bowl and more. Odds update from Bet365, William Hill & DraftKings.',
  openGraph: {
    title: 'Outright Odds, Specials & Transfer Markets | Betcheza',
    description:
      'Real-time outright odds for league winners, cups, and top scorers from 20+ bookmakers.',
    type: 'website',
  },
};

const TABS = [
  { key: 'outrights', label: 'Outrights', icon: Trophy, desc: 'League & cup winners' },
  { key: 'specials', label: 'Specials', icon: Star, desc: 'International & awards' },
  { key: 'transfers', label: 'Transfers', icon: ArrowLeftRight, desc: 'Summer window' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface FlatMarket {
  displayTitle: string;
  category: string;
  outcomes: { name: string; price: number; link?: string }[];
  slug: string;
  leagueId: number;
  sportKey: string;
  updatedAt?: string;
}

const GENERIC_MARKET_NAMES = new Set([
  'tournament winner', 'league winner', 'championship winner', 'cup winner',
  "men's champion", "women's champion", 'world series winner', 'stanley cup winner',
  'super bowl winner',
]);

function flattenMarkets(outrights: OutrightDiscovery[]): FlatMarket[] {
  const flat: FlatMarket[] = [];
  for (const item of outrights) {
    for (const market of item.markets) {
      if (market.outcomes.length === 0) continue;
      const isGeneric = GENERIC_MARKET_NAMES.has(market.marketName.toLowerCase());
      const title =
        item.markets.length === 1 || isGeneric
          ? item.title
          : `${item.title} — ${market.marketName}`;
      flat.push({
        displayTitle: title,
        category: item.category,
        outcomes: [...market.outcomes].sort((a, b) => a.price - b.price),
        slug: item.slug,
        leagueId: item.leagueId ?? 0,
        sportKey: item.sportKey,
        updatedAt: item.updatedAt,
      });
    }
  }
  return flat;
}

function groupByCategory(markets: FlatMarket[]): Map<string, FlatMarket[]> {
  const map = new Map<string, FlatMarket[]>();
  for (const m of markets) {
    const cat = m.category || 'Other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(m);
  }
  return map;
}

function MarketCard({ market }: { market: FlatMarket }) {
  const favourite = market.outcomes[0];
  const displayed = market.outcomes.slice(0, 10);
  const remaining = market.outcomes.length - displayed.length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/20">
        <div className="min-w-0 flex-1">
          <Link href={`/specials/${market.slug}`} className="group">
            <h3 className="text-sm font-bold leading-tight truncate group-hover:text-primary transition-colors">
              {market.displayTitle}
            </h3>
          </Link>
          {favourite && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Favourite:{' '}
              <span className="font-semibold text-foreground">{favourite.name}</span>
              <span className="ml-1.5 font-bold text-primary">{favourite.price.toFixed(2)}</span>
            </p>
          )}
        </div>
        <Badge variant="outline" className="shrink-0 text-[9px] font-semibold text-emerald-600 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400">
          Live
        </Badge>
      </div>
      <div className="divide-y divide-border/30">
        {displayed.map((outcome, i) => {
          const row = (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted/20 transition-colors">
              <span className="flex items-center gap-1.5 text-xs min-w-0">
                {i === 0 && (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                )}
                <span className="truncate">{outcome.name}</span>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <OutrightTipButton
                  data={{
                    leagueId: market.leagueId,
                    leagueName: market.displayTitle,
                    marketName: market.displayTitle,
                    marketKey: 'outright_winner',
                    prediction: outcome.name,
                    odds: outcome.price,
                    sport: market.category,
                  }}
                  label="Tip"
                />
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                    i === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground',
                  )}
                >
                  {outcome.price.toFixed(2)}
                </span>
              </div>
            </div>
          );
          return outcome.link ? (
            <a key={i} href={outcome.link} target="_blank" rel="noopener noreferrer nofollow">
              {row}
            </a>
          ) : (
            <div key={i}>{row}</div>
          );
        })}
        {remaining > 0 && (
          <Link
            href={`/specials/${market.slug}`}
            className="flex items-center justify-center px-3 py-2 text-[11px] text-muted-foreground hover:text-primary transition-colors"
          >
            +{remaining} more selections →
          </Link>
        )}
      </div>
      {market.updatedAt && (
        <div className="px-3 py-1.5 border-t border-border/30 text-[10px] text-muted-foreground/60">
          Updated {market.updatedAt}
        </div>
      )}
    </div>
  );
}

function EmptyState({ quotaExhausted }: { quotaExhausted: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
      {quotaExhausted ? (
        <>
          <p className="text-sm font-medium text-muted-foreground">Live odds refreshing soon</p>
          <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
            Our bookmaker data feed is refreshing (monthly quota). Odds will reappear automatically
            when the feed restores. Check back shortly.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-muted-foreground">No live outright markets available right now</p>
          <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
            Live odds are fetched from bookmaker feeds. This can happen at the start of a new season
            when markets haven't opened yet. Check back soon.
          </p>
        </>
      )}
    </div>
  );
}

function MarketGrid({ grouped, total, quotaExhausted }: {
  grouped: Map<string, FlatMarket[]>;
  total: number;
  quotaExhausted: boolean;
}) {
  if (total === 0) return <EmptyState quotaExhausted={quotaExhausted} />;
  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([category, markets]) => (
        <div key={category}>
          <div className="mb-2.5 flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {category}
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {markets.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {markets.map((m, i) => (
              <MarketCard key={i} market={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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

function TransfersContent({ players }: { players: TransferOddsEntry[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200/80 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
              Summer Transfer Window — Bookmaker Odds
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400/80">
              Prices sourced from Bet365, William Hill, Betfair &amp; Paddy Power aggregates.
              Odds reflect current bookmaker markets for next permanent club.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {players.map((player) => {
          const posColor =
            player.position
              ? (POSITION_COLOR[player.position] ?? 'text-muted-foreground bg-muted/40')
              : '';
          const favourite = player.outcomes[0];
          const displayed = player.outcomes.slice(0, 8);
          const remaining = player.outcomes.length - displayed.length;
          return (
            <div
              key={player.player}
              className="flex flex-col rounded-lg border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-1.5 border-b border-border/40 bg-muted/10 px-2.5 pt-2 pb-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-xs font-bold leading-tight">{player.player}</p>
                    {player.position && (
                      <span className={cn('shrink-0 rounded px-1 py-0 text-[9px] font-bold leading-4', posColor)}>
                        {player.position}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Currently at{' '}
                    <span className="font-medium text-foreground">{player.currentClub}</span>
                    {favourite && (
                      <span className="ml-1.5 font-semibold text-primary">
                        {favourite.name.replace(/\s*\(stay\)/i, ' (stay)')} —{' '}
                        {favourite.price.toFixed(2)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border/30">
                {displayed.map((outcome, i) => {
                  const isStay = outcome.name.toLowerCase().includes('stay');
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-muted/20 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 text-xs min-w-0">
                        {i === 0 && (
                          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <span className="truncate">{outcome.name}</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <OutrightTipButton
                          data={{
                            leagueId: 0,
                            leagueName: player.player,
                            marketName: `${player.player} — Next Club`,
                            marketKey: 'player_transfer',
                            prediction: outcome.name,
                            odds: outcome.price,
                            sport: 'Transfers',
                          }}
                          label="Tip"
                        />
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                            isStay
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : i === 0
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-foreground',
                          )}
                        >
                          {outcome.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {remaining > 0 && (
                  <div className="flex items-center justify-center px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    +{remaining} more options
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function SpecialsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = 'outrights' } = await searchParams;
  const activeTab = (TABS.some((t) => t.key === tab) ? tab : 'outrights') as TabKey;

  const outrights = await discoverAllOutrights().catch(() => [] as OutrightDiscovery[]);
  const quotaExhausted = isOutrightsQuotaExhausted();
  const allMarkets = flattenMarkets(outrights);

  const SPECIALS_CATS = new Set(['International', 'Specials', 'European Cups', 'Champions League']);
  const outrightsMarkets = allMarkets.filter((m) => !SPECIALS_CATS.has(m.category));
  const specialsMarkets = allMarkets.filter((m) => SPECIALS_CATS.has(m.category));

  const transfers = STATIC_TRANSFER_ODDS.global;

  return (
    <div className="w-full min-h-screen">
      <div className="border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0 text-yellow-500" />
          <h1 className="text-base font-bold sm:text-lg">Betting Markets</h1>
          <Badge variant="secondary" className="text-[10px] font-semibold flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" />
            Live bookmaker odds
          </Badge>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Outright winners &amp; specials — best prices from Bet365, William Hill, Betfair &amp; DraftKings.
          Odds update every 48 hours.
        </p>
      </div>

      <div className="sticky top-0 z-10 border-b border-border bg-card">
        <nav className="flex overflow-x-auto px-3 sm:px-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === activeTab;
            return (
              <Link
                key={t.key}
                href={`/specials?tab=${t.key}`}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {t.label}
                <span className="ml-1 hidden text-[10px] font-normal opacity-60 sm:inline">
                  {t.desc}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-2 py-4 sm:px-3">
        {activeTab === 'outrights' && (
          <MarketGrid
            grouped={groupByCategory(outrightsMarkets)}
            total={outrightsMarkets.length}
            quotaExhausted={quotaExhausted}
          />
        )}
        {activeTab === 'specials' && (
          <MarketGrid
            grouped={groupByCategory(specialsMarkets)}
            total={specialsMarkets.length}
            quotaExhausted={quotaExhausted}
          />
        )}
        {activeTab === 'transfers' && <TransfersContent players={transfers} />}
      </div>
    </div>
  );
}
