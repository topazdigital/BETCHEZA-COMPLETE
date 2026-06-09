import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Star, Trophy, Globe, Users, ArrowLeftRight, Calendar, ExternalLink } from 'lucide-react';
import { SPECIALS, getSpecialBySlug } from '@/lib/api/specials';
import { cn } from '@/lib/utils';

interface Params { slug: string }

export async function generateStaticParams() {
  return SPECIALS.map(s => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const special = getSpecialBySlug(slug);
  if (!special) return { title: 'Market Not Found | Betcheza' };

  const fav = special.outcomes[0];
  const favStr = fav ? ` Favourite: ${fav.name} at ${fav.price.toFixed(2)}.` : '';

  return {
    title: `${special.title} — Betting Odds | Betcheza`,
    description: `${special.title} betting odds.${favStr} Compare prices from leading bookmakers. ${special.subtitle ?? ''}`,
    openGraph: {
      title: `${special.title} | Betcheza`,
      description: `All selections & best odds for ${special.title}.${favStr}`,
      type: 'website',
    },
  };
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'World Cup 2026': Globe,
  'Manager Markets': Users,
  'Player Awards': Star,
  'Transfer Specials': ArrowLeftRight,
  'Premier League 2026/27': Trophy,
  'Champions League 2026/27': Star,
};

const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'World Cup 2026':          { color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25' },
  'Manager Markets':         { color: 'text-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25' },
  'Player Awards':           { color: 'text-yellow-500',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/25' },
  'Transfer Specials':       { color: 'text-violet-500',  bg: 'bg-violet-500/10',  border: 'border-violet-500/25' },
  'Premier League 2026/27':  { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  'Champions League 2026/27':{ color: 'text-purple-500',  bg: 'bg-purple-500/10',  border: 'border-purple-500/25' },
};

export default async function SpecialSlugPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const special = getSpecialBySlug(slug);
  if (!special) notFound();

  const Icon = CATEGORY_ICONS[special.category] ?? Trophy;
  const catStyle = CATEGORY_COLORS[special.category] ?? { color: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border' };
  const fav = special.outcomes[0];

  const related = SPECIALS.filter(s => s.category === special.category && s.id !== special.id).slice(0, 4);

  return (
    <div className="w-full min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-muted/30 px-3 py-2 sm:px-4">
        <nav className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Link href="/specials" className="flex items-center gap-1 hover:text-primary transition-colors">
            <ChevronLeft className="h-3 w-3" />
            Specials &amp; Markets
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{special.category}</span>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{special.title}</span>
        </nav>
      </div>

      <div className="px-3 py-4 sm:px-4 max-w-3xl mx-auto">
        {/* Header */}
        <div className={cn('rounded-xl border p-4 mb-4', catStyle.border)}>
          <div className="flex items-start gap-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', catStyle.bg)}>
              <Icon className={cn('h-5 w-5', catStyle.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', catStyle.bg, catStyle.color)}>
                  {special.category}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold leading-snug">{special.title}</h1>
              {special.subtitle && (
                <p className="mt-0.5 text-sm text-muted-foreground">{special.subtitle}</p>
              )}
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                Last updated: {special.updatedAt}
              </div>
            </div>
          </div>
        </div>

        {/* Favourite highlight */}
        {fav && (
          <div className={cn('rounded-xl border p-3.5 mb-4 flex items-center justify-between gap-3', catStyle.border, catStyle.bg)}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">Market Favourite</p>
              <p className="text-base font-black text-foreground">{fav.name}</p>
              {fav.bookmaker && <p className="text-[11px] text-muted-foreground mt-0.5">Best odds via {fav.bookmaker}</p>}
            </div>
            <div className="text-right shrink-0">
              <span className={cn('text-3xl font-black tabular-nums font-mono', catStyle.color)}>{fav.price.toFixed(2)}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">decimal odds</p>
            </div>
          </div>
        )}

        {/* All outcomes table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
          <div className="bg-muted/30 px-3 py-2 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              All Selections ({special.outcomes.length})
            </h2>
            <p className="text-[10px] text-muted-foreground">Decimal odds</p>
          </div>
          <div className="divide-y divide-border/60">
            {special.outcomes.map((o, i) => (
              <div
                key={`${o.name}-${i}`}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5',
                  i === 0 ? cn(catStyle.bg, 'border-b border-border') : 'hover:bg-muted/30'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 shrink-0 text-center text-[10px] font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className={cn('text-sm font-semibold truncate', i === 0 && 'font-bold text-foreground')}>{o.name}</span>
                  {i === 0 && (
                    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide', catStyle.bg, catStyle.color)}>
                      Fav
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 ml-3">
                  {o.bookmaker && (
                    <span className="hidden sm:block text-[10px] text-muted-foreground">{o.bookmaker}</span>
                  )}
                  <span className={cn(
                    'font-mono text-sm font-black tabular-nums',
                    i === 0 ? catStyle.color : 'text-emerald-600 dark:text-emerald-400'
                  )}>
                    {o.price.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 mb-4 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Odds correct as of {special.updatedAt}.</span>{' '}
          Prices are best available from UK &amp; European bookmakers. Always check current prices with your bookmaker before placing a bet.
          Gambling involves risk. Please bet responsibly.
        </div>

        {/* Related markets */}
        {related.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              More in {special.category}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {related.map(rel => {
                const relFav = rel.outcomes[0];
                return (
                  <Link
                    key={rel.id}
                    href={`/specials/${rel.slug}`}
                    className={cn('flex items-center justify-between rounded-lg border px-3 py-2.5 hover:shadow-sm hover:border-primary/30 transition-all bg-card', catStyle.border)}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{rel.title}</p>
                      {relFav && (
                        <p className="text-[10px] text-muted-foreground truncate">Fav: {relFav.name} — {relFav.price.toFixed(2)}</p>
                      )}
                    </div>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground ml-2" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-4 text-center">
          <Link
            href="/specials"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            All Specials &amp; Markets
          </Link>
        </div>
      </div>
    </div>
  );
}
