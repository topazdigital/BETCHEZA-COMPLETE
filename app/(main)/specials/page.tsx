import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, Star, ArrowLeftRight, TrendingUp, ExternalLink } from 'lucide-react';
import { discoverAllOutrights, type OutrightDiscovery } from '@/lib/api/outright-discovery';
import { STATIC_TRANSFER_ODDS, type TransferOddsEntry } from '@/lib/api/static-transfers';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Outright Odds, Specials & Transfer Markets | Betcheza',
  description:
    'Outright winner odds, specials and transfer betting markets from 25+ bookmakers. EPL winner, UCL winner, top scorer markets and summer window transfer destination odds.',
  openGraph: {
    title: 'Outright Odds, Specials & Transfer Markets | Betcheza',
    description:
      'Real bookmaker outright odds for league winners, cups, top scorers plus summer transfer destination markets.',
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
}

// Generic market names that don't carry enough context on their own
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
      // Use the item's descriptive title unless the market name adds distinct info
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
  const displayed = market.outcomes.slice(0, 9);
  const remaining = market.outcomes.length - displayed.length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/20">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight truncate">{market.displayTitle}</h3>
          {favourite && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Favourite:{' '}
              <span className="font-semibold text-foreground">{favourite.name}</span>
              <span className="ml-1.5 font-bold text-primary">{favourite.price.toFixed(2)}</span>
            </p>
          )}
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {displayed.map((outcome, i) => {
          const row = (
            <div
              className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted/20 transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs min-w-0">
                {i === 0 && (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                )}
                <span className="truncate">{outcome.name}</span>
              </span>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                  i === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground',
                )}
              >
                {outcome.price.toFixed(2)}
              </span>
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
          <div className="flex items-center justify-center px-3 py-2 text-[11px] text-muted-foreground">
            +{remaining} more selections
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  detail,
  links,
}: {
  icon: React.ElementType;
  message: string;
  detail: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">{detail}</p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
          >
            {link.label} <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

function MarketGrid({ grouped, total, emptyConfig }: {
  grouped: Map<string, FlatMarket[]>;
  total: number;
  emptyConfig: Parameters<typeof EmptyState>[0];
}) {
  if (total === 0) return <EmptyState {...emptyConfig} />;
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
              Summer 2025/26 Transfer Window — Bookmaker odds
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
                      <span
                        className={cn(
                          'shrink-0 rounded px-1 py-0 text-[9px] font-bold leading-4',
                          posColor,
                        )}
                      >
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
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
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
  const allMarkets = flattenMarkets(outrights);

  const SPECIALS_CATS = new Set(['International', 'Specials', 'European Cups', 'Champions League']);
  const outrightsMarkets = allMarkets.filter((m) => !SPECIALS_CATS.has(m.category));
  const specialsMarkets = allMarkets.filter((m) => SPECIALS_CATS.has(m.category));

  const transfers = STATIC_TRANSFER_ODDS.global;

  return (
    <div className="w-full min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0 text-yellow-500" />
          <h1 className="text-base font-bold sm:text-lg">Betting Markets</h1>
          <Badge variant="secondary" className="text-[10px] font-semibold">
            Real bookmaker odds
          </Badge>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Outright winners, specials &amp; transfer markets — prices from Bet365, William Hill,
          Betfair &amp; DraftKings
        </p>
      </div>

      {/* Tab nav */}
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

      {/* Content */}
      <div className="px-2 py-4 sm:px-3">
        {activeTab === 'outrights' && (
          <MarketGrid
            grouped={groupByCategory(outrightsMarkets)}
            total={outrightsMarkets.length}
            emptyConfig={{
              icon: Trophy,
              message: 'No outright markets available right now',
              detail:
                'Live odds are fetched from bookmaker feeds. Check back shortly or visit the bookmakers below.',
              links: [
                {
                  label: 'Oddschecker Outrights',
                  href: 'https://www.oddschecker.com/football/english/premier-league#outrights',
                },
                { label: 'Bet365', href: 'https://www.bet365.com' },
              ],
            }}
          />
        )}
        {activeTab === 'specials' && (
          <MarketGrid
            grouped={groupByCategory(specialsMarkets)}
            total={specialsMarkets.length}
            emptyConfig={{
              icon: Star,
              message: 'No specials in current bookmaker feed',
              detail:
                "Award markets (Ballon d'Or, FIFA Best), manager markets and international specials are sourced from bookmaker feeds that update independently. Check back shortly.",
              links: [
                { label: 'Bet365', href: 'https://www.bet365.com' },
                { label: 'SportPesa', href: 'https://www.sportpesa.com' },
                { label: '1xBet', href: 'https://www.1xbet.com' },
              ],
            }}
          />
        )}
        {activeTab === 'transfers' && <TransfersContent players={transfers} />}
      </div>
    </div>
  );
}
