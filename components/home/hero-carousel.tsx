'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TeamLogo } from '@/components/ui/team-logo';
import { liveStatusLabel } from '@/lib/utils/live-status';
import { matchToSlug } from '@/lib/utils/match-url';
import type { Match } from '@/lib/hooks/use-matches';

function LiveSlide({ matches, totalCount }: { matches: Match[]; totalCount: number }) {
  return (
    <div className="rounded-2xl border border-live/30 bg-gradient-to-br from-live/10 to-transparent p-6 shadow-xl shadow-live/10">
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-live"></span>
        </span>
        <span className="font-semibold text-live">Live Now</span>
        <span className="ml-auto text-sm text-muted-foreground">{totalCount} matches</span>
      </div>
      <div className="space-y-3">
        {matches.map(match => {
          const tickerLabel = liveStatusLabel(match.sport?.slug ?? 'football', match.status, match.minute);
          return (
            <Link
              key={match.id}
              href={`/matches/${matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name)}`}
              className="block rounded-lg bg-card/50 p-3 transition-colors hover:bg-card"
            >
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{match.sport?.icon} {match.league?.name}</span>
                <span className={cn(
                  'ml-2 shrink-0 font-mono font-bold',
                  match.status === 'halftime'
                    ? 'rounded-full bg-warning/20 px-2 py-0.5 text-warning'
                    : 'text-live',
                )}>
                  {tickerLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-1.5">
                  <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} sportSlug={match.sport?.slug} size="xs" />
                  <span className="truncate text-sm font-medium">{match.homeTeam.name}</span>
                </div>
                <span className="ml-2 shrink-0 font-mono text-lg font-bold text-live">{match.homeScore ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-1.5">
                  <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} sportSlug={match.sport?.slug} size="xs" />
                  <span className="truncate text-sm font-medium">{match.awayTeam.name}</span>
                </div>
                <span className="ml-2 shrink-0 font-mono text-lg font-bold text-live">{match.awayScore ?? 0}</span>
              </div>
            </Link>
          );
        })}
      </div>
      <Button variant="ghost" className="mt-4 w-full" asChild>
        <Link href="/matches?status=live">
          View all live matches
          <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function FeaturedSlide({ matches }: { matches: Match[] }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-6 shadow-xl shadow-primary/10">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-semibold text-primary">Featured Matches</span>
        <span className="ml-auto text-sm text-muted-foreground">{matches.length} picks</span>
      </div>
      <div className="space-y-3">
        {matches.map(match => (
          <Link
            key={match.id}
            href={`/matches/${matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name)}`}
            className="block rounded-lg bg-card/50 p-3 transition-colors hover:bg-card"
          >
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{match.sport?.icon} {match.league?.name}</span>
              <span className="ml-2 shrink-0">
                {new Date(match.kickoffTime).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium">{match.homeTeam.name}</span>
              <span className="ml-2 shrink-0 font-mono text-sm font-semibold text-primary">
                {match.odds?.home?.toFixed(2) ?? '–'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium">{match.awayTeam.name}</span>
              <span className="ml-2 shrink-0 font-mono text-sm font-semibold text-primary">
                {match.odds?.away?.toFixed(2) ?? '–'}
              </span>
            </div>
          </Link>
        ))}
      </div>
      <Button variant="ghost" className="mt-4 w-full" asChild>
        <Link href="/matches">
          Browse all matches
          <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

export function HeroCarousel({
  liveMatches,
  featuredMatches,
  isLoading,
}: {
  liveMatches: Match[];
  featuredMatches: Match[];
  isLoading?: boolean;
}) {
  const slides = useMemo(() => {
    const list: Array<'live' | 'featured'> = [];
    if (liveMatches.length > 0) list.push('live');
    if (featuredMatches.length > 0) list.push('featured');
    return list;
  }, [liveMatches.length, featuredMatches.length]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex(i => (i + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/50 p-4 animate-pulse shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 space-y-2.5">
                  <div className="h-3 w-28 rounded bg-muted" />
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted" />
                    <div className="h-4 w-24 rounded bg-muted" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted" />
                    <div className="h-4 w-20 rounded bg-muted" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="h-14 w-10 rounded-lg bg-muted/60" />
                  <div className="h-14 w-10 rounded-lg bg-muted/60" />
                  <div className="h-14 w-10 rounded-lg bg-muted/60" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center shadow-xl">
        <Clock className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-semibold">No matches available right now</p>
        <p className="mt-1 text-xs text-muted-foreground">New fixtures load throughout the day.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map(slide => (
            <div key={slide} className="w-full shrink-0">
              {slide === 'live' ? (
                <LiveSlide matches={liveMatches} totalCount={liveMatches.length} />
              ) : (
                <FeaturedSlide matches={featuredMatches} />
              )}
            </div>
          ))}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${s === 'live' ? 'Live Now' : 'Featured Matches'}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
