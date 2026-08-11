'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock, Sparkles, ChevronRight, Timer } from 'lucide-react';
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

function useMatchCountdown(kickoffTime: string | Date, enabled: boolean) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(kickoffTime).getTime() - Date.now()));

  useEffect(() => {
    if (!enabled) return;
    const update = () => setRemaining(Math.max(0, new Date(kickoffTime).getTime() - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [kickoffTime, enabled]);

  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: remaining <= 0,
  };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[42px] rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-center backdrop-blur-sm">
      <div className="font-mono text-lg font-black leading-none tabular-nums text-white">
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/55">{label}</div>
    </div>
  );
}

function HeadlineFixture({ match }: { match: Match }) {
  const countdown = useMatchCountdown(match.kickoffTime, match.status === 'scheduled');
  const kickoff = new Date(match.kickoffTime);
  const dateLabel = kickoff.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = kickoff.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const slug = matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name);

  return (
    <Link
      href={`/matches/${slug}`}
      className="group block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-slate-950 via-primary/30 to-slate-900 p-4 text-white shadow-xl shadow-primary/10 transition-all hover:border-primary/60 hover:shadow-primary/20"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/75">
          <Sparkles className="h-3 w-3 text-amber-300" />
          Featured fixture
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-white/60">
          <CalendarDays className="h-3 w-3" />
          {dateLabel} · {timeLabel}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 sm:gap-5">
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 p-1.5 shadow-lg shadow-black/20 sm:h-16 sm:w-16">
            <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} teamId={Number(match.homeTeam.id) || undefined} sportSlug={match.sport?.slug} size="xl" className="!h-12 !w-12 bg-transparent sm:!h-14 sm:!w-14" />
          </div>
          <span className="mt-2 max-w-[120px] truncate text-xs font-bold sm:text-sm">{match.homeTeam.name}</span>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/45">VS</span>
          <span className="mt-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/70">
            {match.league?.name || 'Football'}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 p-1.5 shadow-lg shadow-black/20 sm:h-16 sm:w-16">
            <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} teamId={Number(match.awayTeam.id) || undefined} sportSlug={match.sport?.slug} size="xl" className="!h-12 !w-12 bg-transparent sm:!h-14 sm:!w-14" />
          </div>
          <span className="mt-2 max-w-[120px] truncate text-xs font-bold sm:text-sm">{match.awayTeam.name}</span>
        </div>
      </div>

      {!countdown.done && match.status === 'scheduled' ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">
            <Timer className="h-3 w-3 text-primary-foreground/70" />
            Kick-off in
          </div>
          <div className="flex justify-center gap-1.5 sm:gap-2">
            <CountdownUnit value={countdown.days} label="Days" />
            <CountdownUnit value={countdown.hours} label="Hrs" />
            <CountdownUnit value={countdown.minutes} label="Min" />
            <CountdownUnit value={countdown.seconds} label="Sec" />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-white/10 py-2 text-center text-xs font-bold text-white/75">
          Match centre
        </div>
      )}

      {match.odds && (
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
          <div className="rounded-md bg-white/10 px-1 py-1.5"><span className="block text-white/45">Arsenal</span><b>{match.odds.home.toFixed(2)}</b></div>
          <div className="rounded-md bg-white/10 px-1 py-1.5"><span className="block text-white/45">Draw</span><b>{match.odds.draw?.toFixed(2) ?? '–'}</b></div>
          <div className="rounded-md bg-white/10 px-1 py-1.5"><span className="block text-white/45">Man City</span><b>{match.odds.away.toFixed(2)}</b></div>
        </div>
      )}
    </Link>
  );
}

function FeaturedSlide({ matches }: { matches: Match[] }) {
  const headline = matches.find(match => {
    const teams = `${match.homeTeam.name} ${match.awayTeam.name}`.toLowerCase();
    return teams.includes('arsenal') && teams.includes('manchester city');
  });

  if (headline) return <HeadlineFixture match={headline} />;

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
