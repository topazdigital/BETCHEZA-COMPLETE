'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Flame,
  TrendingUp,
  Clock,
  ChevronRight,
  Trophy,
  Target,
  Users,
  Star,
  ArrowRight,
  Zap,
  Shield,
  Sparkles,
} from 'lucide-react';
import { BetchezaBackBanner } from '@/components/home/betcheza-back-banner';
import { SportsFilter } from '@/components/sports/sports-filter';
import { MatchCardNew } from '@/components/matches/match-card-new';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMatches, useLiveMatches, useMatchStats, type Match } from '@/lib/hooks/use-matches';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { ALL_SPORTS, getSportIcon } from '@/lib/sports-data';
import { BestBetsPanel } from '@/components/home/best-bets-panel';
import { FavoritedTipsPanel, FavoritedTipMarqueeCard, useFavoritedTips, type FeaturedItem } from '@/components/home/favorited-tips-panel';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { matchIdToSlug } from '@/lib/utils/match-url';
import { liveStatusLabel } from '@/lib/utils/live-status';
import { tipsterHref } from '@/lib/utils/slug';
import { NewsletterSection } from '@/components/sections/newsletter';

interface ApiTipster {
  id: number;
  username: string;
  displayName?: string;
  winRate: number;
  streak: number;
  roi: number;
  totalTips: number;
  avatar?: string | null;
}

const tipstersFetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => (Array.isArray(d?.tipsters) ? (d.tipsters as ApiTipster[]) : []));

export default function HomePage() {
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null);
  const { open: openAuthModal } = useAuthModal();

  // Real top tipsters (DB-backed; gracefully shows fallback panel when empty)
  const { data: topTipstersData } = useSWR<ApiTipster[]>(
    '/api/tipsters?sortBy=winRate&limit=4',
    tipstersFetcher,
    { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false },
  );
  const topTipsters = topTipstersData ?? [];

  const { matches, isLoading } = useMatches(
    selectedSportId ? { sportId: selectedSportId } : undefined
  );
  // Always fetch unfiltered set so per-sport counts (Oddspedia-style) stay
  // accurate regardless of the currently selected sport.
  const { matches: allMatches } = useMatches();
  const { matches: liveMatches } = useLiveMatches();
  const { items: favoritedTips } = useFavoritedTips();
  // When live action is sparse (1-3 games) we mix featured tips into the live
  // marquee row instead of showing them in a separate panel below.
  const liveRowTips = liveMatches.length > 0 && liveMatches.length <= 3
    ? favoritedTips
    : [];
  const stats = useMatchStats();

  // Calculate match counts per sport from the UNFILTERED list.
  const matchCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    allMatches.forEach(m => {
      counts[m.sportId] = (counts[m.sportId] || 0) + 1;
    });
    return counts;
  }, [allMatches]);

  // Get featured/upcoming matches
  const upcomingMatches = useMemo(() => {
    return matches
      .filter(m => m.status === 'scheduled')
      .slice(0, 12);
  }, [matches]);

  // Today's matches: latest matches across all sports, ordered by kickoff
  // time ascending. Once a match has kicked off (or finished) it disappears
  // from this section — live matches have their own dedicated row above, and
  // finished ones move to /results. A 2-minute grace window catches matches
  // that haven't had their status flipped to "live" yet.
  const todayMatches = useMemo(() => {
    const today = new Date().toDateString();
    const liveStatuses = new Set([
      'live', 'in_progress', 'halftime', 'extra_time', 'penalties',
      'finished', 'final', 'ft', 'ended', 'postponed', 'cancelled',
    ]);
    const cutoff = Date.now() - 2 * 60 * 1000;
    return matches
      .filter(m => {
        if (new Date(m.kickoffTime).toDateString() !== today) return false;
        if (liveStatuses.has(m.status)) return false;
        // Hide anything whose kickoff time is already in the past.
        if (new Date(m.kickoffTime).getTime() <= cutoff) return false;
        return true;
      })
      .sort((a, b) =>
        new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
      )
      .slice(0, 40);
  }, [matches]);

  // Group upcoming by sport for variety display
  const upcomingBySport = useMemo(() => {
    const groups: Record<string, typeof matches> = {};
    upcomingMatches.forEach(m => {
      if (!groups[m.sport.name]) groups[m.sport.name] = [];
      if (groups[m.sport.name].length < 4) {
        groups[m.sport.name].push(m);
      }
    });
    return groups;
  }, [upcomingMatches]);

  return (
    <div className="overflow-hidden">
        {/* Hero Section — compact */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-primary/5">
          <div className="px-4 py-4 sm:py-6">
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-8">
              {/* Left: Main content */}
              <div className="flex flex-col justify-center">
                {/* "We're back" announcement — animated, dismissable per session */}
                <BetchezaBackBanner />
                <Badge variant="secondary" className="mb-2 w-fit text-[10px]">
                  <Zap className="mr-1 h-3 w-3" />
                  Trusted by 50,000+ tipsters
                </Badge>
                <h1 className="mb-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  The Complete Platform for
                  <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"> Sports Betting Tips</span>
                </h1>
                <p className="mb-3 text-pretty text-sm text-muted-foreground">
                  Expert predictions across 35+ sports — track performance and compete worldwide.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openAuthModal('register')}>
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/matches">
                      Browse Matches
                    </Link>
                  </Button>
                </div>

                {/* Quick Stats — each tile links somewhere relevant so the
                    "they look clickable" promise is honoured. */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <Link
                    href="/matches?status=live"
                    className="rounded-lg p-1 text-center transition-colors hover:bg-muted/50"
                  >
                    <div className="text-2xl font-bold text-foreground">{stats.live ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Live Now</div>
                  </Link>
                  <Link
                    href="/matches"
                    className="rounded-lg p-1 text-center transition-colors hover:bg-muted/50"
                  >
                    <div className="text-2xl font-bold text-foreground">{stats.today ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Today</div>
                  </Link>
                  <Link
                    href="/matches"
                    className="rounded-lg p-1 text-center transition-colors hover:bg-muted/50"
                  >
                    <div className="text-2xl font-bold text-foreground">35+</div>
                    <div className="text-xs text-muted-foreground">Sports</div>
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="rounded-lg p-1 text-center transition-colors hover:bg-muted/50"
                  >
                    <div className="text-2xl font-bold text-foreground">50K+</div>
                    <div className="text-xs text-muted-foreground">Tipsters</div>
                  </Link>
                </div>
              </div>

              {/* Right: Live Now / Featured Matches carousel */}
              <div className="hidden lg:flex lg:items-center lg:justify-center">
                <div className="relative w-full max-w-md">
                  <HeroCarousel
                    liveMatches={liveMatches.slice(0, 3)}
                    featuredMatches={upcomingMatches.slice(0, 3)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sports Filter */}
        <section className="border-b border-border bg-card/50 px-4 py-2">
          <SportsFilter 
            selectedSportId={selectedSportId}
            onSelectSport={setSelectedSportId}
            matchCounts={matchCounts}
          />
        </section>

        {/* 3-column content area: [Left: Live+Tips] [Center: Main] [Right: Best Bets] */}
      <div className="flex min-h-0">

        {/* LEFT PANEL — Live Now + Favorited Tips (lg+) */}
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0 border-r border-border">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3 space-y-3">
            {/* Live Now compact list */}
            <LiveSidePanel liveMatches={liveMatches} upcomingMatches={upcomingMatches} />
            {/* Favorited Tips */}
            <FavoritedTipsPanel />
          </div>
        </aside>

        {/* CENTER — main content */}
        <div className="flex-1 min-w-0 overflow-hidden px-4 py-3">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <>
              {/* Mobile-only: Live section (hidden on lg+ since it's in the left panel) */}
              <section className="mb-4 lg:hidden">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={cn(
                        'absolute inline-flex h-full w-full rounded-full opacity-75',
                        liveMatches.length > 0 ? 'animate-ping bg-live' : 'bg-muted-foreground/40',
                      )}></span>
                      <span className={cn(
                        'relative inline-flex h-2.5 w-2.5 rounded-full',
                        liveMatches.length > 0 ? 'bg-live' : 'bg-muted-foreground/60',
                      )}></span>
                    </span>
                    <h2 className="text-lg font-bold text-foreground">Live Now</h2>
                    <Badge variant={liveMatches.length > 0 ? 'destructive' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                      {liveMatches.length}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/matches?status=live">
                      View all
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                {liveMatches.length > 0 ? (
                  <LiveMarquee matches={liveMatches} tips={liveRowTips} />
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card/40 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">No live games right now.</span>{' '}
                        Refreshing every 10s — meanwhile, here are the next kickoffs.
                      </p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                        <Link href="/matches?status=scheduled">
                          See schedule
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                    {upcomingMatches.length > 0 && (
                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {upcomingMatches.slice(0, 6).map((m) => {
                          const t = new Date(m.kickoffTime);
                          const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const day = t.toDateString() === new Date().toDateString()
                            ? 'Today'
                            : t.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                          return (
                            <Link
                              key={m.id}
                              href={`/matches/${matchIdToSlug(m.id)}`}
                              className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 transition-colors hover:border-primary/50"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-foreground group-hover:text-primary">
                                  {m.homeTeam.name} vs {m.awayTeam.name}
                                </p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {m.league?.name || m.sport?.name}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-semibold text-foreground">{time}</p>
                                <p className="text-[9px] text-muted-foreground">{day}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Favorited Tips — shown standalone only when there are zero
                  live games. When 1-3 are live, the tips are mixed into the
                  live marquee row instead. */}
              {liveMatches.length === 0 && <FavoritedTipsPanel />}

              {/* Top Tipsters */}
              <section className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-warning" />
                    <h2 className="text-lg font-bold text-foreground">Top Tipsters</h2>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/leaderboard">
                      Leaderboard
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                {topTipsters.length > 0 ? (
                  <div
                    className={cn(
                      // Mobile: horizontal scroll snap row (no vertical stack).
                      // Tablet+: switch to a clean responsive grid.
                      'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                      'sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4',
                    )}
                  >
                    {topTipsters.map((tipster, index) => {
                      const initial = (tipster.displayName || tipster.username || '?').charAt(0).toUpperCase();
                      return (
                        <Link
                          key={tipster.id}
                          href={tipsterHref(tipster.username || tipster.displayName, tipster.username || tipster.id)}
                          className="group w-[78%] shrink-0 snap-start rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-lg sm:w-auto sm:shrink"
                        >
                          <div className="mb-2.5 flex items-center gap-2.5">
                            <div className="relative">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                                {initial}
                              </div>
                              {index < 3 && (
                                <div className={cn(
                                  'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                                  index === 0 && 'bg-yellow-500 text-yellow-950',
                                  index === 1 && 'bg-gray-300 text-gray-700',
                                  index === 2 && 'bg-amber-700 text-amber-100',
                                )}>
                                  #{index + 1}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                                {tipster.displayName || tipster.username}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span>{tipster.totalTips} tips</span>
                                {tipster.streak > 0 && (
                                  <span className="flex items-center gap-0.5 text-success">
                                    <Flame className="h-2.5 w-2.5" />
                                    {tipster.streak}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="rounded-lg bg-success/10 py-1">
                              <div className="text-base font-bold text-success">{tipster.winRate}%</div>
                              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Win Rate</div>
                            </div>
                            <div className="rounded-lg bg-primary/10 py-1">
                              <div className="text-base font-bold text-primary">+{tipster.roi}%</div>
                              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">ROI</div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card/40 p-5 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-semibold text-foreground">No verified tipsters yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The leaderboard fills up as tipsters post and grade picks. Check back soon.
                    </p>
                    <div className="mt-3 flex justify-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs px-3" asChild>
                        <Link href="/leaderboard">Open leaderboard</Link>
                      </Button>
                      <Button size="sm" className="h-8 text-xs px-3" onClick={() => openAuthModal('register')}>
                        Become a tipster
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              {/* Today's Matches by League — with Best Bets right rail */}
              <section className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Today&apos;s Matches</h2>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{todayMatches.length}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/matches">
                      All matches
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>

                <div>
                {todayMatches.length > 0 ? (
                  <div className="space-y-2">
                    {todayMatches.slice(0, 12).map(match => (
                      <MatchCardNew key={match.id} match={match} variant="compact" showSport />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-5 text-center">
                    <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
                    <h3 className="mt-3 text-base font-semibold">No matches today</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Check back later or browse upcoming matches
                    </p>
                    <Button className="mt-4 h-8 text-xs" asChild>
                      <Link href="/matches">Browse Matches</Link>
                    </Button>
                  </div>
                )}
                </div>
              </section>

              {/* Multi-Sport Section */}
              {Object.keys(upcomingBySport).length > 1 && (
                <section className="mb-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Across All Sports</h2>
                  </div>
                  <div className={cn(
                    'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    'md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-3',
                  )}>
                    {Object.entries(upcomingBySport).slice(0, 6).map(([sportName, sportMatches]) => (
                      <div key={sportName} className="w-[80%] shrink-0 snap-start rounded-xl border border-border bg-card p-3 md:w-auto md:shrink">
                        <div className="mb-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg">{sportMatches[0]?.sport.icon}</span>
                            <h3 className="text-sm font-semibold">{sportName}</h3>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                            <Link href={`/matches?sport=${sportMatches[0]?.sport.slug}`}>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {sportMatches.slice(0, 3).map(match => (
                            <Link 
                              key={match.id}
                              href={`/matches/${matchIdToSlug(match.id)}`}
                              className="block rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="truncate font-medium">{match.homeTeam.name}</span>
                                <span className="ml-2 shrink-0 font-mono text-primary">{match.odds?.home.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="truncate font-medium">{match.awayTeam.name}</span>
                                <span className="ml-2 shrink-0 font-mono text-primary">{match.odds?.away.toFixed(2)}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Features Section */}
              <section className="mb-5">
                <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-4">
                  <h2 className="mb-3 text-center text-xl font-bold">Why Choose Betcheza?</h2>
                  {/* Mobile: horizontal scroll snap — no vertical stacking */}
                  <div className={cn(
                    'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    'sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4',
                  )}>
                    <div className="w-[72%] shrink-0 snap-start rounded-xl bg-muted/40 p-3 text-center sm:w-auto sm:shrink sm:rounded-none sm:bg-transparent sm:p-0">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="mb-1 font-semibold">Expert Predictions</h3>
                      <p className="text-sm text-muted-foreground">AI-powered tips with detailed analysis</p>
                    </div>
                    <div className="w-[72%] shrink-0 snap-start rounded-xl bg-muted/40 p-3 text-center sm:w-auto sm:shrink sm:rounded-none sm:bg-transparent sm:p-0">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                        <TrendingUp className="h-5 w-5 text-success" />
                      </div>
                      <h3 className="mb-1 font-semibold">Track Performance</h3>
                      <p className="text-sm text-muted-foreground">Detailed stats and ROI tracking</p>
                    </div>
                    <div className="w-[72%] shrink-0 snap-start rounded-xl bg-muted/40 p-3 text-center sm:w-auto sm:shrink sm:rounded-none sm:bg-transparent sm:p-0">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                        <Users className="h-5 w-5 text-warning" />
                      </div>
                      <h3 className="mb-1 font-semibold">Community</h3>
                      <p className="text-sm text-muted-foreground">Connect with top tipsters worldwide</p>
                    </div>
                    <div className="w-[72%] shrink-0 snap-start rounded-xl bg-muted/40 p-3 text-center sm:w-auto sm:shrink sm:rounded-none sm:bg-transparent sm:p-0">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                        <Shield className="h-5 w-5 text-destructive" />
                      </div>
                      <h3 className="mb-1 font-semibold">Verified Results</h3>
                      <p className="text-sm text-muted-foreground">Transparent and audited statistics</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Newsletter signup */}
              <NewsletterSection />
            </>
          )}
        </div>

        {/* RIGHT PANEL — Best Bets (xl+) */}
        <aside className="hidden xl:block w-72 shrink-0 border-l border-border">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
            <BestBetsPanel matches={todayMatches} />
          </div>
        </aside>

      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// LiveSidePanel — compact live + upcoming for the left sidebar on desktop
// ───────────────────────────────────────────────
type SidePanelMatch = ReturnType<typeof useMatches>['matches'][number];

function LiveSidePanel({
  liveMatches,
  upcomingMatches,
}: {
  liveMatches: SidePanelMatch[];
  upcomingMatches: SidePanelMatch[];
}) {
  const hasLive = liveMatches.length > 0;
  const displayMatches = hasLive ? liveMatches.slice(0, 8) : upcomingMatches.slice(0, 8);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            hasLive ? 'animate-ping bg-live' : 'bg-muted-foreground/40',
          )}></span>
          <span className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            hasLive ? 'bg-live' : 'bg-muted-foreground/60',
          )}></span>
        </span>
        <h3 className="text-xs font-bold text-foreground">{hasLive ? 'Live Now' : 'Up Next'}</h3>
        <Badge variant={hasLive ? 'destructive' : 'secondary'} className="h-4 px-1 text-[9px]">
          {displayMatches.length}
        </Badge>
        <Link href="/matches?status=live" className="ml-auto text-[10px] text-primary hover:underline">
          All
        </Link>
      </div>
      <div className="space-y-1">
        {displayMatches.map(m => {
          const t = new Date(m.kickoffTime);
          const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <Link
              key={m.id}
              href={`/matches/${matchIdToSlug(m.id)}`}
              className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] transition-colors hover:border-primary/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground group-hover:text-primary">
                  {m.homeTeam.shortName || m.homeTeam.name} <span className="text-muted-foreground">vs</span> {m.awayTeam.shortName || m.awayTeam.name}
                </p>
                <p className="truncate text-[9px] text-muted-foreground">{m.league?.name || m.sport?.name}</p>
              </div>
              <div className="shrink-0 text-right">
                {m.status === 'live' || m.status === 'halftime' ? (
                  <span className="rounded bg-live/20 px-1 py-0.5 text-[9px] font-bold text-live">
                    {m.status === 'halftime' ? 'HT' : m.minute ? `${m.minute}'` : 'LIVE'}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-foreground">{time}</span>
                )}
              </div>
            </Link>
          );
        })}
        {displayMatches.length === 0 && (
          <p className="py-2 text-center text-[10px] text-muted-foreground">No matches right now</p>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// Hero Carousel — alternates Live Now ↔ Featured Matches every 6s
// Slides right-to-left. Shows HT badge for halftime matches.
// ───────────────────────────────────────────────
type CarouselMatch = ReturnType<typeof useMatches>['matches'][number];

function HeroCarousel({
  liveMatches,
  featuredMatches,
}: {
  liveMatches: CarouselMatch[];
  featuredMatches: CarouselMatch[];
}) {
  // Slides we actually have content for
  const slides = useMemo(() => {
    const list: Array<'live' | 'featured'> = [];
    if (liveMatches.length > 0) list.push('live');
    if (featuredMatches.length > 0) list.push('featured');
    return list;
  }, [liveMatches.length, featuredMatches.length]);

  const [index, setIndex] = useState(0);

  // Reset when the available slides change
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  // Auto-rotate every 6 seconds when there is more than one slide
  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex(i => (i + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) {
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
      {/* Sliding viewport */}
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

      {/* Dots */}
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

function LiveSlide({ matches, totalCount }: { matches: CarouselMatch[]; totalCount: number }) {
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
          const tickerLabel = liveStatusLabel(
            match.sport.slug,
            match.status,
            match.minute,
          );
          return (
            <Link
              key={match.id}
              href={`/matches/${matchIdToSlug(match.id)}`}
              className="block rounded-lg bg-card/50 p-3 transition-colors hover:bg-card"
            >
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{match.sport.icon} {match.league.name}</span>
                <span
                  className={cn(
                    'ml-2 shrink-0 font-mono font-bold',
                    match.status === 'halftime'
                      ? 'rounded-full bg-warning/20 px-2 py-0.5 text-warning'
                      : 'text-live',
                  )}
                >
                  {tickerLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">{match.homeTeam.name}</span>
                <span className="ml-2 shrink-0 font-mono text-lg font-bold text-live">{match.homeScore ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">{match.awayTeam.name}</span>
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

function FeaturedSlide({ matches }: { matches: CarouselMatch[] }) {
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
            href={`/matches/${matchIdToSlug(match.id)}`}
            className="block rounded-lg bg-card/50 p-3 transition-colors hover:bg-card"
          >
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{match.sport.icon} {match.league.name}</span>
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

// ───────────────────────────────────────────────
// LiveMarquee — auto-scrolls live matches right→left in a continuous loop.
// Pauses on hover so you can read a card. We render the list twice so the
// CSS animation can loop without a visible jump.
// ───────────────────────────────────────────────
type MarqueeEntry =
  | { kind: 'live'; match: Match }
  | { kind: 'tip'; tip: FeaturedItem };

function LiveMarquee({ matches, tips = [] }: { matches: Match[]; tips?: FeaturedItem[] }) {
  // When live action is sparse (1-3 games) we mix featured tips into the same
  // row so the marquee never looks empty. The cards share the same w-80 width
  // and stretched height so the row reads as a single continuous strip.
  const entries: MarqueeEntry[] = [
    ...matches.map((m) => ({ kind: 'live' as const, match: m })),
    ...tips.map((t) => ({ kind: 'tip' as const, tip: t })),
  ];

  // Tune speed to the number of cards so a row of 4 doesn't fly past.
  const cards = entries.length;
  const duration = Math.max(28, cards * 9); // seconds per loop

  // Only loop the marquee when there are enough cards to overflow the row
  // (otherwise we'd render the same 1-2 cards twice and look broken).
  const MARQUEE_MIN = 4;
  const shouldLoop = cards >= MARQUEE_MIN;
  const cardsToRender = shouldLoop ? [...entries, ...entries] : entries;

  if (!shouldLoop) {
    // Non-looping: grid layout so cards don't get clipped by overflow-hidden
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cardsToRender.map((entry, idx) => (
          <div
            key={
              entry.kind === 'live'
                ? `live-${entry.match.id}-${idx}`
                : `tip-${entry.tip.matchId}-${idx}`
            }
          >
            {entry.kind === 'live'
              ? <MatchCardNew match={entry.match} showSport />
              : <FavoritedTipMarqueeCard item={entry.tip} />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden">
      {/* Fade edges only when looping */}
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
            className="w-72 sm:w-80 shrink-0"
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
