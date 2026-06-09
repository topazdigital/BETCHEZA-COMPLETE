import type { Metadata } from 'next';
import Link from 'next/link';
import { Target, Trophy, Users, ArrowLeftRight, Star, Globe, TrendingUp, ExternalLink, Calendar } from 'lucide-react';
import { SPECIALS, SPECIAL_CATEGORIES, getSpecialsByCategory } from '@/lib/api/specials';
import type { SpecialCategory, Special } from '@/lib/api/specials';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Football Specials & Betting Markets 2026 | Betcheza',
  description: 'Manager sack races, next job markets, World Cup 2026 odds, Ballon d\'Or, Premier League top scorer, player transfers — all football specials in one place.',
  openGraph: {
    title: 'Football Specials & Betting Markets | Betcheza',
    description: 'Current manager markets, World Cup 2026, player awards and transfer specials.',
    type: 'website',
  },
};

const CATEGORY_META: Record<SpecialCategory, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  'World Cup 2026':          { icon: Globe,         color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
  'Manager Markets':         { icon: Users,         color: 'text-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30' },
  'Player Awards':           { icon: Star,          color: 'text-yellow-500',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30' },
  'Transfer Specials':       { icon: ArrowLeftRight,color: 'text-violet-500',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30' },
  'Premier League 2026/27':  { icon: Trophy,        color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  'Champions League 2026/27':{ icon: Star,          color: 'text-purple-500',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30' },
};

function formatOdds(price: number): string {
  return price.toFixed(2);
}

function SpecialCard({ special }: { special: Special }) {
  const { icon: Icon, color, bg, border } = CATEGORY_META[special.category];
  const top6 = special.outcomes.slice(0, 6);
  const favourite = special.outcomes[0];

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden hover:shadow-sm transition-shadow', border)}>
      {/* Header */}
      <div className={cn('px-3 pt-2.5 pb-2 border-b', border.replace('border-', 'border-b-'))}>
        <div className="flex items-start gap-2">
          <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', bg)}>
            <Icon className={cn('h-3.5 w-3.5', color)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-snug">{special.title}</p>
            {special.subtitle && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">{special.subtitle}</p>
            )}
          </div>
        </div>

        {/* Favourite chip */}
        {favourite && (
          <div className={cn('mt-2 flex items-center justify-between rounded-md px-2.5 py-1.5', bg)}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">Favourite</span>
              <span className="truncate text-xs font-bold text-foreground">{favourite.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1 ml-2">
              <span className={cn('font-mono text-sm font-bold', color)}>{formatOdds(favourite.price)}</span>
              {favourite.bookmaker && (
                <span className="text-[9px] text-muted-foreground">{favourite.bookmaker}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Outcomes list */}
      <div className="px-2.5 py-2 space-y-0.5">
        {top6.slice(1).map((o, i) => (
          <div
            key={`${o.name}-${i}`}
            className="flex items-center justify-between rounded px-1.5 py-1 hover:bg-muted/40 transition-colors"
          >
            <span className="truncate min-w-0 flex-1 text-[11px] font-medium text-foreground">{o.name}</span>
            <div className="flex shrink-0 items-center gap-1.5 ml-2">
              <span className="font-mono text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                {formatOdds(o.price)}
              </span>
              {o.bookmaker && (
                <span className="hidden sm:block text-[9px] text-muted-foreground w-14 truncate text-right">{o.bookmaker}</span>
              )}
            </div>
          </div>
        ))}

        {special.outcomes.length > 6 && (
          <p className="pt-0.5 text-center text-[10px] text-muted-foreground">
            +{special.outcomes.length - 6} more selections
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <Calendar className="h-2.5 w-2.5" />
          Updated {special.updatedAt}
        </div>
        <Link
          href="/transfers"
          className={cn(
            'hidden text-[10px] font-semibold hover:underline',
            special.category === 'Transfer Specials' && 'flex items-center gap-0.5',
            color,
          )}
        >
          <ArrowLeftRight className="h-2.5 w-2.5" />
          Transfer odds
        </Link>
      </div>
    </div>
  );
}

export default function SpecialsPage() {
  const totalSpecials = SPECIALS.length;

  return (
    <div className="w-full min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-4 w-4 shrink-0 text-rose-500" />
            <h1 className="text-base font-bold sm:text-lg leading-tight">Specials &amp; Markets</h1>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{totalSpecials}</span> active markets
            </span>
          </div>
          <Link
            href="/outrights"
            className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <Trophy className="h-3 w-3" />
            Outright Odds
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>

        <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">{totalSpecials} active markets · Updated June 2026</p>

        {/* Category pill nav */}
        <div className="mt-2 flex flex-wrap gap-1">
          {SPECIAL_CATEGORIES.map(cat => {
            const { icon: Icon, color, bg } = CATEGORY_META[cat];
            const count = getSpecialsByCategory(cat).length;
            if (count === 0) return null;
            return (
              <a
                key={cat}
                href={`#${cat.toLowerCase().replace(/[\s/]+/g, '-')}`}
                className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-75', color, bg)}
              >
                <Icon className="h-2.5 w-2.5" />
                {cat}
                <span className="opacity-60">({count})</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-b border-border bg-amber-500/5 px-3 py-2 sm:px-4">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">Odds shown</span> are best available from UK &amp; European bookmakers (Paddy Power, bet365, William Hill, Coral, Betway, Unibet) as of June 2026.
          Always verify current prices with your chosen bookmaker before placing bets.
        </p>
      </div>

      {/* Content */}
      <div className="px-2 py-3 sm:px-3 space-y-5">
        {SPECIAL_CATEGORIES.map(cat => {
          const items = getSpecialsByCategory(cat);
          if (items.length === 0) return null;
          const { icon: Icon, color, bg } = CATEGORY_META[cat];
          return (
            <section key={cat} id={cat.toLowerCase().replace(/[\s/]+/g, '-')}>
              <div className="mb-2 flex items-center gap-1.5">
                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded', bg)}>
                  <Icon className={cn('h-3 w-3', color)} />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat}</h2>
                <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map(special => (
                  <SpecialCard key={special.id} special={special} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* CTA to transfers */}
      <div className="mx-2 mb-4 sm:mx-3 rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Summer Transfer Window Odds</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Full odds for 43+ players including Mbappé, Wirtz, Bellingham &amp; more
            </p>
          </div>
          <Link
            href="/transfers"
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 transition-colors"
          >
            <ArrowLeftRight className="h-3 w-3" />
            Transfer Odds
          </Link>
        </div>
      </div>
    </div>
  );
}
