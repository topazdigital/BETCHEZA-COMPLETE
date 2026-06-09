import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Target, Trophy, Users, ArrowLeftRight, Star, Globe, TrendingUp,
  Zap, Calendar, ArrowRight, Wifi, WifiOff, Flag, Shield, Swords,
} from 'lucide-react';
import { SPECIALS, SPECIAL_CATEGORIES, getSpecialsByCategory } from '@/lib/api/specials';
import type { SpecialCategory, Special } from '@/lib/api/specials';
import { discoverAllOutrights } from '@/lib/api/outright-discovery';
import type { OutrightDiscovery } from '@/lib/api/outright-discovery';
import { OutrightTipButton } from '@/components/outrights/outright-tip-button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Specials & Outright Betting Markets 2026 | Betcheza',
  description:
    'Football specials, outright odds and long-term betting markets in one place — World Cup 2026, Ballon d\'Or, manager markets, transfer specials, Premier League & Champions League ante-posts. Best odds from UK bookmakers.',
  openGraph: {
    title: 'Specials & Outright Markets | Betcheza',
    description:
      'All football specials and outright markets — World Cup 2026, awards, manager markets, live bookmaker prices.',
    type: 'website',
  },
};

export const revalidate = 3600;

// ── Category metadata for static specials ──────────────────────────────────
const SPECIAL_CAT_META: Record<SpecialCategory, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  'World Cup 2026':          { icon: Globe,         color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25' },
  'Manager Markets':         { icon: Users,         color: 'text-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25' },
  'Player Awards':           { icon: Star,          color: 'text-yellow-500',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/25' },
  'Transfer Specials':       { icon: ArrowLeftRight,color: 'text-violet-500',  bg: 'bg-violet-500/10',  border: 'border-violet-500/25' },
  'Premier League 2026/27':  { icon: Trophy,        color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  'Champions League 2026/27':{ icon: Star,          color: 'text-purple-500',  bg: 'bg-purple-500/10',  border: 'border-purple-500/25' },
};

// ── Category metadata for live outrights ───────────────────────────────────
const OUTRIGHT_CAT_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'International':    { icon: Globe,      color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'Champions League': { icon: Star,       color: 'text-purple-500',  bg: 'bg-purple-500/10' },
  'European Cups':    { icon: Swords,     color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  'League Winners':   { icon: Trophy,     color: 'text-yellow-500',  bg: 'bg-yellow-500/10' },
  'Top Scorers':      { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'Domestic Cups':    { icon: Shield,     color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  'NBA':              { icon: Trophy,     color: 'text-sky-500',     bg: 'bg-sky-500/10' },
  'NFL':              { icon: Trophy,     color: 'text-green-600',   bg: 'bg-green-600/10' },
  'Tennis':           { icon: Zap,        color: 'text-lime-500',    bg: 'bg-lime-500/10' },
  'Golf':             { icon: Flag,       color: 'text-green-500',   bg: 'bg-green-500/10' },
  'Motor Racing':     { icon: Zap,        color: 'text-red-600',     bg: 'bg-red-600/10' },
};
function getOutrightCatMeta(cat: string) {
  return OUTRIGHT_CAT_META[cat] ?? { icon: Trophy, color: 'text-muted-foreground', bg: 'bg-muted/40' };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtOdds(price: number) { return price.toFixed(2); }

// ── Components ──────────────────────────────────────────────────────────────
function SpecialCard({ special }: { special: Special }) {
  const { icon: Icon, color, bg, border } = SPECIAL_CAT_META[special.category];
  const top6 = special.outcomes.slice(0, 6);
  const fav  = special.outcomes[0];

  return (
    <Link
      href={`/specials/${special.slug}`}
      className={cn('group flex flex-col rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all hover:border-primary/30', border)}
    >
      {/* Card header */}
      <div className={cn('px-3 pt-3 pb-2 border-b', border.replace('border-', 'border-b-'))}>
        <div className="flex items-start gap-2">
          <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', bg)}>
            <Icon className={cn('h-3.5 w-3.5', color)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-snug group-hover:text-primary transition-colors">{special.title}</p>
            {special.subtitle && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">{special.subtitle}</p>
            )}
          </div>
        </div>

        {/* Favourite chip */}
        {fav && (
          <div className={cn('mt-2 flex items-center justify-between rounded-lg px-2.5 py-1.5', bg)}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground shrink-0">Fav</span>
              <span className="truncate text-[11px] font-bold text-foreground">{fav.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1 ml-2">
              <span className={cn('font-mono text-sm font-black', color)}>{fmtOdds(fav.price)}</span>
              {fav.bookmaker && <span className="text-[9px] text-muted-foreground">{fav.bookmaker}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Outcome list */}
      <div className="flex-1 px-2.5 py-2 space-y-0.5">
        {top6.slice(1).map((o, i) => (
          <div key={`${o.name}-${i}`} className="flex items-center justify-between rounded px-1.5 py-0.5 hover:bg-muted/40">
            <span className="truncate min-w-0 flex-1 text-[11px] font-medium text-foreground">{o.name}</span>
            <div className="flex shrink-0 items-center gap-1.5 ml-2">
              <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {fmtOdds(o.price)}
              </span>
              {o.bookmaker && (
                <span className="hidden sm:block text-[9px] text-muted-foreground w-12 truncate text-right">{o.bookmaker}</span>
              )}
            </div>
          </div>
        ))}
        {special.outcomes.length > 6 && (
          <p className="text-center text-[10px] text-muted-foreground pt-0.5">
            +{special.outcomes.length - 6} more selections
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 py-1.5 border-t border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <Calendar className="h-2.5 w-2.5" />
          {special.updatedAt}
        </div>
        <span className={cn('flex items-center gap-0.5 text-[10px] font-semibold', color)}>
          View all <ArrowRight className="h-2.5 w-2.5" />
        </span>
      </div>
    </Link>
  );
}

function OutrightCard({ market }: { market: OutrightDiscovery }) {
  const firstMarket = market.markets[0];
  const topOutcomes = firstMarket?.outcomes.slice(0, 4) ?? [];
  const fav = topOutcomes[0];

  return (
    <Link
      href={`/outrights/${market.slug}`}
      className="group flex flex-col rounded-xl border border-emerald-500/20 bg-card overflow-hidden hover:shadow-md hover:border-emerald-500/40 transition-all"
    >
      {/* Live badge header */}
      <div className="flex items-start justify-between gap-1.5 px-3 pt-3 pb-2 border-b border-emerald-500/20">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live
            </span>
          </div>
          <p className="text-xs font-bold leading-snug group-hover:text-primary transition-colors">{market.title}</p>
          {market.leagueName && market.leagueName !== market.title && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{market.leagueName}</p>
          )}
        </div>
      </div>

      {/* Favourite chip */}
      {fav && (
        <div className="px-3 pt-2">
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/8 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground shrink-0">Fav</span>
              <span className="truncate text-[11px] font-bold text-foreground">{fav.name}</span>
            </div>
            <span className="ml-2 font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">{fmtOdds(fav.price)}</span>
          </div>
        </div>
      )}

      {/* Outcome list */}
      <div className="flex-1 px-2.5 py-2 space-y-0.5">
        {topOutcomes.slice(1).map((o, i) => (
          <div key={`${o.name}-${i}`} className="flex items-center justify-between rounded px-1.5 py-0.5 hover:bg-muted/40">
            <span className="truncate min-w-0 flex-1 text-[11px] font-medium">{o.name}</span>
            <div className="flex shrink-0 items-center gap-1 ml-2">
              <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {fmtOdds(o.price)}
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
        ))}
        {firstMarket && firstMarket.outcomes.length > 4 && (
          <p className="text-center text-[10px] text-primary pt-0.5">
            +{firstMarket.outcomes.length - 4} more →
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 py-1.5 border-t border-emerald-500/15 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <Wifi className="h-2.5 w-2.5 text-emerald-500" />
          Real bookmaker prices
        </div>
        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          All odds <ArrowRight className="h-2.5 w-2.5" />
        </span>
      </div>
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default async function SpecialsPage() {
  const [outrights] = await Promise.allSettled([discoverAllOutrights()]);
  const outrightMarkets: OutrightDiscovery[] = outrights.status === 'fulfilled' ? outrights.value : [];
  const hasLive = outrightMarkets.length > 0;

  const totalSpecials = SPECIALS.length;
  const totalOutrights = outrightMarkets.length;

  // Group outrights by category
  const outrightsByCategory: Record<string, OutrightDiscovery[]> = {};
  for (const m of outrightMarkets) {
    if (!outrightsByCategory[m.category]) outrightsByCategory[m.category] = [];
    outrightsByCategory[m.category].push(m);
  }
  const outrightCategoryOrder = [
    'International','Champions League','European Cups','League Winners',
    'Top Scorers','Domestic Cups','NBA','NFL','MLB','NHL','Tennis','Golf','Motor Racing','Cricket','Rugby',
  ];
  const sortedOutrightCats = Object.keys(outrightsByCategory).sort(
    (a, b) => (outrightCategoryOrder.indexOf(a) + 1 || 99) - (outrightCategoryOrder.indexOf(b) + 1 || 99)
  );

  return (
    <div className="w-full min-h-screen">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-4 w-4 shrink-0 text-rose-500" />
            <h1 className="text-base font-bold sm:text-lg leading-tight">Specials &amp; Markets</h1>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{totalSpecials}</span> curated
              {hasLive && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="font-semibold text-foreground">{totalOutrights}</span>
                  <span className="text-emerald-600 font-semibold">live</span>
                </>
              )}
            </span>
          </div>
          <Link
            href="/transfers"
            className="flex items-center gap-1.5 rounded-md bg-violet-500/10 border border-violet-500/20 px-2.5 py-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
          >
            <ArrowLeftRight className="h-3 w-3" />
            Transfer Odds
          </Link>
        </div>

        <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">
          {totalSpecials} curated markets{hasLive ? ` · ${totalOutrights} live outright markets` : ''} · June 2026
        </p>

        {/* Category pills nav — static specials */}
        <div className="mt-2 flex flex-wrap gap-1">
          {SPECIAL_CATEGORIES.map(cat => {
            const { icon: Icon, color, bg } = SPECIAL_CAT_META[cat];
            const count = getSpecialsByCategory(cat).length;
            if (count === 0) return null;
            return (
              <a
                key={cat}
                href={`#${cat.toLowerCase().replace(/[\s/]+/g, '-')}`}
                className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold hover:opacity-75 transition-opacity', color, bg)}
              >
                <Icon className="h-2.5 w-2.5" />
                {cat}
                <span className="opacity-60">({count})</span>
              </a>
            );
          })}
          {hasLive && (
            <a
              href="#live-outrights"
              className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:opacity-75 transition-opacity"
            >
              <Wifi className="h-2.5 w-2.5" />
              Live Outrights
              <span className="opacity-60">({totalOutrights})</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Disclaimer ─────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-amber-500/5 px-3 py-2 sm:px-4">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">Curated odds</span> are best available from UK &amp; European bookmakers (Paddy Power, bet365, William Hill, Coral, Betway, Unibet) as of June 2026.
          <span className="font-semibold text-foreground"> Live outright odds</span> are sourced directly from bookmakers via SportsGameOdds API, updated every 2 hours.
          Always verify current prices before placing bets.
        </p>
      </div>

      {/* ── Curated Specials ────────────────────────────────────────────── */}
      <div className="px-2 py-4 sm:px-3 space-y-6">
        {SPECIAL_CATEGORIES.map(cat => {
          const items = getSpecialsByCategory(cat);
          if (items.length === 0) return null;
          const { icon: Icon, color, bg } = SPECIAL_CAT_META[cat];
          return (
            <section key={cat} id={cat.toLowerCase().replace(/[\s/]+/g, '-')}>
              <div className="mb-2.5 flex items-center gap-1.5">
                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded', bg)}>
                  <Icon className={cn('h-3 w-3', color)} />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat}</h2>
                <span className="text-[10px] text-muted-foreground/60">({items.length} markets)</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map(special => (
                  <SpecialCard key={special.id} special={special} />
                ))}
              </div>
            </section>
          );
        })}

        {/* ── Transfer CTA ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Summer Transfer Window Odds</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Full odds for 43+ players including Mbappé, Wirtz, Salah, Bellingham &amp; more
              </p>
            </div>
            <Link
              href="/transfers"
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 transition-colors"
            >
              <ArrowLeftRight className="h-3 w-3" />
              Transfer Odds
            </Link>
          </div>
        </div>

        {/* ── Live Outright Odds (SGO) ─────────────────────────────────── */}
        <section id="live-outrights">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-500/10">
              {hasLive
                ? <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                Live Outright Odds
                {hasLive && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 normal-case tracking-normal">
                    {totalOutrights} markets · Real bookmaker prices
                  </span>
                )}
              </h2>
            </div>
          </div>

          {!hasLive ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center px-4">
              <WifiOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">No live outright markets available</p>
              <p className="mt-1 text-xs text-muted-foreground/70 max-w-sm mx-auto">
                Live outrights are powered by SportsGameOdds. Configure your API key in Admin → Settings to enable real-time futures odds across football, basketball, tennis and more.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {sortedOutrightCats.map(cat => {
                const items = outrightsByCategory[cat];
                const { icon: Icon, color, bg } = getOutrightCatMeta(cat);
                return (
                  <div key={cat}>
                    <div className="mb-2 flex items-center gap-1.5">
                      <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded', bg)}>
                        <Icon className={cn('h-2.5 w-2.5', color)} />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{cat}</span>
                      <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map(market => (
                        <OutrightCard key={market.sportKey} market={market} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
