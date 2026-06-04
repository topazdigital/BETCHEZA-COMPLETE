'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const MatchCardNew = dynamic(
  () => import('@/components/matches/match-card-new').then(m => ({ default: m.MatchCardNew })),
  { loading: () => <div className="h-24 w-72 shrink-0 rounded-xl border border-border bg-card/60 animate-pulse" /> }
);

import { FavoritedTipMarqueeCard, type FeaturedItem } from '@/components/home/favorited-tips-panel';
import type { Match } from '@/lib/hooks/use-matches';

type MarqueeEntry =
  | { kind: 'live'; match: Match }
  | { kind: 'tip'; tip: FeaturedItem };

export function LiveMarquee({ matches, tips = [] }: { matches: Match[]; tips?: FeaturedItem[] }) {
  const entries: MarqueeEntry[] = [
    ...matches.map((m) => ({ kind: 'live' as const, match: m })),
    ...tips.map((t) => ({ kind: 'tip' as const, tip: t })),
  ];

  const cards = entries.length;
  const duration = Math.max(28, cards * 9);

  // Always use the sliding marquee; duplicate cards only when there are enough to loop
  const MARQUEE_DUPE_MIN = 3;
  const shouldDupe = cards >= MARQUEE_DUPE_MIN;
  const cardsToRender = shouldDupe ? [...entries, ...entries] : entries;

  return (
    <div className="group relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
      <div
        className="flex items-stretch gap-4 pb-2 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: `${duration}s` }}
      >
        {cardsToRender.map((entry, idx) => (
          <div
            key={
              entry.kind === 'live'
                ? `live-${entry.match.id}-${idx}`
                : `tip-${entry.tip.matchId}-${idx}`
            }
            className={cn('w-72 sm:w-80 shrink-0')}
            aria-hidden={idx >= cards}
          >
            {entry.kind === 'live'
              ? <MatchCardNew match={entry.match} showSport />
              : <FavoritedTipMarqueeCard item={entry.tip} />}
          </div>
        ))}
      </div>
    </div>
  );
}
