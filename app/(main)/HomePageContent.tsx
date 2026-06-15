'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import useSWR, { useSWRConfig } from 'swr';
import {
  Flame,
  TrendingUp,
  Clock,
  ChevronRight,
  Trophy,
  Target,
  Users,
  ArrowRight,
  Zap,
  Shield,
  ShieldCheck,
  Medal,
  PenLine,
  LayoutDashboard,
} from 'lucide-react';
const BetchezaBackBanner = dynamic(
  () => import('@/components/home/betcheza-back-banner').then(m => ({ default: m.BetchezaBackBanner })),
  { ssr: false }
);
const SportsFilter = dynamic(
  () => import('@/components/sports/sports-filter').then(m => ({ default: m.SportsFilter })),
  { ssr: false, loading: () => <div className="h-8 rounded-md bg-muted/50 animate-pulse" /> }
);
import { TeamLogo } from '@/components/ui/team-logo';
const MatchCardNew = dynamic(
  () => import('@/components/matches/match-card-new').then(m => ({ default: m.MatchCardNew })),
  { ssr: false, loading: () => <div className="rounded-xl border border-border bg-card/60 animate-pulse" style={{ height: '76px' }} /> }
);
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMatches, useLiveMatches, useMatchStats } from '@/lib/hooks/use-matches';
import { cn } from '@/lib/utils';
import { MyTipsPanel, useFavoritedTips } from '@/components/home/favorited-tips-panel';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useAuth } from '@/contexts/auth-context';
import { matchToSlug } from '@/lib/utils/match-url';
import { tipsterHref } from '@/lib/utils/slug';

const PanelSkeleton = () => (
  <div className="space-y-2 p-1">
    {[1,2,3].map(i => (
      <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
    ))}
  </div>
);

const BestBetsPanel = dynamic(
  () => import('@/components/home/best-bets-panel').then(m => ({ default: m.BestBetsPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);
const FavoritedTipsPanel = dynamic(
  () => import('@/components/home/favorited-tips-panel').then(m => ({ default: m.FavoritedTipsPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);
const NewsletterSection = dynamic(
  () => import('@/components/sections/newsletter').then(m => ({ default: m.NewsletterSection })),
  { ssr: false, loading: () => <div className="h-24 rounded-xl bg-muted/30 animate-pulse" /> }
);
const WorldCupOddsCard = dynamic(
  () => import('@/components/home/world-cup-odds-card').then(m => ({ default: m.WorldCupOddsCard })),
  { ssr: false, loading: () => <div className="h-28 rounded-xl bg-emerald-500/5 border border-emerald-500/20 animate-pulse mb-4" /> }
);
const HeroCarousel = dynamic(
  () => import('@/components/home/hero-carousel').then(m => ({ default: m.HeroCarousel })),
  { ssr: false, loading: () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card/50 p-4 animate-pulse shadow-xl" style={{ height: '88px' }} />
      ))}
    </div>
  )}
);
const LiveSidePanel = dynamic(
  () => import('@/components/home/live-side-panel').then(m => ({ default: m.LiveSidePanel })),
  { ssr: false, loading: () => <div className="h-32 rounded-xl bg-muted/30 animate-pulse" /> }
);
const SidebarBanners = dynamic(
  () => import('@/components/home/sidebar-banners').then(m => ({ default: m.SidebarBanners })),
  { ssr: false }
);
const MobileBannerStrip = dynamic(
  () => import('@/components/home/sidebar-banners').then(m => ({ default: m.MobileBannerStrip })),
  { ssr: false }
);

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

interface TipsterOfWeekData {
  tipster: {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
    bio: string | null;
    winRate: number;
    roi: number;
    streak: number;
    wonTips: number;
    lostTips: number;
    totalTips: number;
    isPro: boolean;
    verified: boolean;
    countryCode: string | null;
    href: string;
  } | null;
  weeklyWon: number;
  weeklyLost: number;
  weeklyTotal: number;
  weeklyWinRate: number;
  isWeekly: boolean;
  performanceVerified: boolean;
}

const homeFetcher = (url: string) => fetch(url).then((r) => r.json());

export default function HomePageContent({ initialHomeData }: { initialHomeData?: Record<string, unknown> | null }) {
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  const { open: openAuthModal } = useAuthModal();
  const { user, isAuthenticated } = useAuth();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const w = window as any;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIsIdle(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setIsIdle(true), 300);
    return () => clearTimeout(t);
  }, []);

  // ── Single consolidated fetch: replaces 5 separate API calls ──────────────
  const { data: homeData } = useSWR('/api/home', homeFetcher, {
    revalidateOnFocus: true,
    // Refresh every 90 s so newly-warmed caches (post cold-start) surface quickly.
    // Previously 5 min — with the non-blocking cold-start fix the server always
    // responds in < 500 ms so frequent polling is cheap.
    dedupingInterval: 30_000,
    refreshInterval: 90_000,
    fallbackData: initialHomeData ?? undefined,
    onSuccess(data) {
      // Only seed caches that aren't already independently fetched by child hooks.
      // Do NOT seed /api/matches — the layout's useMatchStats fetches it with a
      // different key shape; seeding with wrong data causes .filter() errors.
      if (data?.featured) mutate('/api/featured', data.featured, false);
    },
  });

  const topTipsters: ApiTipster[] = homeData?.topTipsters?.tipsters ?? [];
  const totwData: TipsterOfWeekData | undefined = homeData?.tipsterOfWeek ?? undefined;

  const { matches, isLoading } = useMatches(
    selectedSportId ? { sportId: selectedSportId } : undefined
  );
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
    matches.forEach(m => {
      counts[m.sportId] = (counts[m.sportId] || 0) + 1;
    });
    return counts;
  }, [matches]);

  // Get upcoming matches for TODAY only — sorted by kickoff time ascending (soonest first).
  // Excludes anything whose kickoff is in the past or on a different day.
  const upcomingMatches = useMemo(() => {
    const now = Date.now();
    const todayStr = new Date().toDateString();
    const todayMatches = matches
      .filter(m => {
        if (m.status !== 'scheduled') return false;
        const ko = new Date(m.kickoffTime);
        if (ko.toDateString() !== todayStr) return false; // must be today
        if (ko.getTime() <= now) return false; // must be in the future
        return true;
      })
      .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime())
      .slice(0, 12);

    // If no more matches today, fall back to the next available day's soonest 12
    if (todayMatches.length > 0) return todayMatches;
    return matches
      .filter(m => m.status === 'scheduled' && new Date(m.kickoffTime).getTime() > now)
      .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime())
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
                {isAuthenticated && user ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Welcome back, <span className="font-semibold text-foreground">{user.displayName || user.username}</span> 👋
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" asChild>
                        <Link href="/feed">
                          <PenLine className="mr-2 h-4 w-4" />
                          Post a Tip
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          My Dashboard
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
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
                )}

                {/* Quick Stats — each tile links somewhere relevant so the
                    "they look clickable" promise is honoured. */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <Link
                    href="/matches?status=live"
                    className="rounded-lg p-1 text-center transition-colors hover:bg-muted/50"
                  >
                    <div className="text-2xl font-bold tabular-nums text-foreground min-w-[2ch] mx-auto">{stats.isLoading ? '–' : (stats.live || 0)}</div>
                    <div className="text-xs text-muted-foreground">Live Now</div>
                  </Link>
                  <Link
                    href="/matches"
                    className="rounded-lg p-1 text-center transition-colors hover:bg-muted/50"
                  >
                    <div className="text-2xl font-bold tabular-nums text-foreground min-w-[2ch] mx-auto">{stats.isLoading ? '–' : (stats.today || 0)}</div>
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
                    isLoading={isLoading}
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
            {/* My Tips — logged-in user's recent tips */}
            <MyTipsPanel />
            {/* Favorited Tips */}
            {isIdle && <FavoritedTipsPanel />}
            {/* Promotional banners */}
            {isIdle && <SidebarBanners />}
          </div>
        </aside>

        {/* CENTER — main content */}
        <div className="flex-1 min-w-0 overflow-hidden px-4 py-3">
          {isLoading && matches.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card/60 p-3 animate-pulse">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-20 rounded bg-muted" />
                        <div className="h-3 w-14 rounded bg-muted/60" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-muted" />
                          <div className="h-4 w-24 rounded bg-muted" />
                        </div>
                        <div className="h-5 w-8 rounded bg-muted/60" />
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-24 rounded bg-muted" />
                          <div className="h-6 w-6 rounded-full bg-muted" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="h-8 w-12 rounded bg-muted/60" />
                      <div className="h-8 w-12 rounded bg-muted/60" />
                      <div className="h-8 w-12 rounded bg-muted/60" />
                    </div>
                  </div>
                </div>
              ))}
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
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {liveMatches.slice(0, 6).map((m) => (
                      <MatchCardNew key={m.id} match={m} variant="compact" showLeague={true} />
                    ))}
                  </div>
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
                          const isMatchToday = t.toDateString() === new Date().toDateString();
                          const day = isMatchToday
                            ? null
                            : t.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                          return (
                            <Link
                              key={m.id}
                              href={`/matches/${matchToSlug(m.id, m.homeTeam.name, m.awayTeam.name)}`}
                              className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 transition-colors hover:border-primary/50"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <TeamLogo teamName={m.homeTeam.name} logoUrl={m.homeTeam.logo} sportSlug={m.sport?.slug} size="xs" />
                                  <span className="truncate text-[11px] font-medium text-foreground group-hover:text-primary">
                                    {m.homeTeam.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 truncate mt-0.5">
                                  <TeamLogo teamName={m.awayTeam.name} logoUrl={m.awayTeam.logo} sportSlug={m.sport?.slug} size="xs" />
                                  <span className="truncate text-[11px] font-medium text-foreground group-hover:text-primary">
                                    {m.awayTeam.name}
                                  </span>
                                </div>
                                <p className="truncate text-[9px] text-muted-foreground mt-0.5">
                                  {m.league?.name || m.sport?.name}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-semibold text-foreground">{time}</p>
                                {day && <p className="text-[9px] text-muted-foreground">{day}</p>}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Promotional banner strip — mobile only; sidebars handle desktop */}
              {isIdle && (
                <div className="mb-4 lg:hidden">
                  <MobileBannerStrip />
                </div>
              )}

              {/* My Tips + Favorited Tips — mobile only; on lg+ they live in the left sidebar */}
              <div className="mb-4 lg:hidden space-y-3">
                <MyTipsPanel />
                {isIdle && <FavoritedTipsPanel />}
              </div>

              {/* Tipster of the Week spotlight */}
              {totwData?.tipster && (
                <section className="mb-4">
                  <Link
                    href={tipsterHref(totwData.tipster.username, totwData.tipster.username)}
                    className="group block rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-yellow-400/5 to-transparent p-3 transition-all hover:border-amber-400/60 hover:shadow-md"
                  >
                    {/* Header row */}
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Medal className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-bold uppercase tracking-wide text-amber-600">
                          {totwData.isWeekly ? 'Tipster of the Week' : 'Top Performer'}
                        </span>
                        {/* Always show "This Week" chip so users know these stats are weekly */}
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0 text-[9px] font-bold text-amber-600 border border-amber-400/30">
                          This Week
                        </span>
                        {totwData.performanceVerified && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-bold text-emerald-600">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Verified
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground group-hover:text-primary">
                        View profile →
                      </span>
                    </div>

                    {/* Tipster row */}
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/40 bg-amber-500 text-lg font-bold text-white shadow-sm">
                          {totwData.tipster.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={totwData.tipster.avatar} alt="" className="h-full w-full object-cover" fetchPriority="high" loading="eager" />
                          ) : (
                            (totwData.tipster.displayName || totwData.tipster.username).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow">
                          <Trophy className="h-3 w-3 text-white" />
                        </div>
                      </div>

                      {/* Info + stats */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1">
                          <span className="truncate text-sm font-bold text-foreground group-hover:text-amber-600">
                            {totwData.tipster.displayName}
                          </span>
                          {totwData.tipster.isPro && (
                            <span className="shrink-0 rounded bg-amber-500 px-1 py-0 text-[8px] font-bold text-white">PRO</span>
                          )}
                        </div>

                        {/* This-week stats pills — clearly labelled */}
                        <div className="flex flex-wrap gap-1.5">
                          <div className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-center">
                            <span className="text-xs font-bold text-emerald-600">
                              {totwData.weeklyWinRate ?? totwData.tipster.winRate}%
                            </span>
                            <span className="ml-1 text-[9px] text-muted-foreground uppercase">Win</span>
                          </div>
                          <div className="rounded-md bg-primary/10 px-2 py-0.5">
                            <span className="text-xs font-bold text-primary">
                              {(totwData.tipster.roi ?? 0) >= 0 ? '+' : ''}{totwData.tipster.roi ?? 0}%
                            </span>
                            <span className="ml-1 text-[9px] text-muted-foreground uppercase">ROI</span>
                          </div>
                          <div className="rounded-md bg-muted px-2 py-0.5">
                            <span className="text-xs font-bold text-foreground">
                              {totwData.weeklyWon}W / {totwData.weeklyLost}L
                            </span>
                            <span className="ml-1 text-[9px] text-amber-600 font-semibold uppercase">
                              This week
                            </span>
                          </div>
                          {totwData.tipster.streak > 1 && (
                            <div className="flex items-center gap-0.5 rounded-md bg-warning/10 px-2 py-0.5">
                              <Flame className="h-3 w-3 text-warning" />
                              <span className="text-xs font-bold text-warning">{totwData.tipster.streak}</span>
                              <span className="ml-0.5 text-[9px] text-muted-foreground uppercase">Streak</span>
                            </div>
                          )}
                        </div>
                        {/* Subtle all-time context so users know profile page has different (all-time) numbers */}
                        {(totwData.tipster as { allTimeWinRate?: number }).allTimeWinRate != null && (
                          <p className="mt-1.5 text-[9px] text-muted-foreground">
                            All-time: {(totwData.tipster as { allTimeWinRate?: number }).allTimeWinRate}% win ·{' '}
                            {((totwData.tipster as { allTimeRoi?: number }).allTimeRoi ?? 0) >= 0 ? '+' : ''}
                            {(totwData.tipster as { allTimeRoi?: number }).allTimeRoi}% ROI
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </section>
              )}

              {/* World Cup 2026 Featured Odds */}
              <WorldCupOddsCard />

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
                      // Mobile: 2-col grid (no horizontal scroll, cards stack neatly)
                      // md: 3-col, xl: 4-col (accounts for left + right sidebars)
                      'grid grid-cols-2 gap-3',
                      'md:grid-cols-3 xl:grid-cols-4',
                    )}
                  >
                    {topTipsters.map((tipster, index) => {
                      const initial = (tipster.displayName || tipster.username || '?').charAt(0).toUpperCase();
                      return (
                        <Link
                          key={tipster.id}
                          href={tipsterHref(tipster.username || tipster.displayName, tipster.username || tipster.id)}
                          className="group rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-lg"
                        >
                          <div className="mb-2.5 flex items-center gap-2.5">
                            <div className="relative shrink-0">
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-base font-bold text-primary-foreground">
                                {(tipster as { avatar?: string | null }).avatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={(tipster as { avatar?: string | null }).avatar!} alt="" className="h-full w-full object-cover" fetchPriority={index === 0 ? "high" : "auto"} loading="eager" />
                                ) : initial}
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
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 truncate">
                                <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                                  {tipster.displayName || tipster.username}
                                </span>
                                {(tipster as { performanceVerified?: boolean }).performanceVerified && (
                                  <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
                                )}
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
                              <div className="text-base font-bold text-primary">{(tipster.roi ?? 0) >= 0 ? '+' : ''}{tipster.roi ?? 0}%</div>
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
                              href={`/matches/${matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name)}`}
                              className="block rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} sportSlug={match.sport?.slug} size="xs" />
                                  <span className="truncate font-medium">{match.homeTeam.name}</span>
                                </div>
                                <span className="ml-2 shrink-0 font-mono text-primary">{match.odds?.home.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} sportSlug={match.sport?.slug} size="xs" />
                                  <span className="truncate font-medium">{match.awayTeam.name}</span>
                                </div>
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
              {isIdle && <NewsletterSection />}
            </>
          )}

          {/* SEO content — always rendered for crawlers; provides headings + keyword-rich text */}
          <section aria-label="About Betcheza" className="mt-6 rounded-2xl border border-border bg-card/50 p-5 text-sm text-muted-foreground">
            <h2 className="mb-3 text-base font-bold text-foreground">Kenya&apos;s #1 Sports Betting Tips &amp; Predictions Platform</h2>
            <p className="mb-3 leading-relaxed">
              Betcheza is Kenya&apos;s most trusted sports betting tips and predictions platform, trusted by over 50,000 bettors across Kenya, Tanzania, Uganda, and beyond.
              We combine expert tipster analysis with AI-powered football predictions to bring you accurate, data-driven betting tips every day.
              Whether you need SportPesa jackpot tips, Betika grand jackpot predictions, or Odibets accumulator picks, Betcheza has you covered.
            </p>
            <h2 className="mb-2 text-sm font-bold text-foreground">Free AI Football Predictions &amp; Betting Tips</h2>
            <p className="mb-3 leading-relaxed">
              Our AI Predictor analyses team form, head-to-head records, player injuries, and live odds to generate high-accuracy football predictions.
              Get free betting tips for the English Premier League, La Liga, Serie A, Bundesliga, Champions League, and the Kenya Premier League.
              Every prediction includes detailed analysis — win probability, expected goals, both-teams-to-score odds, and over/under goals markets.
            </p>
            <h2 className="mb-2 text-sm font-bold text-foreground">SportPesa &amp; Betika Jackpot Tips</h2>
            <p className="mb-3 leading-relaxed">
              Win the SportPesa Mega Jackpot and Midweek Jackpot with our expert banker selections and full 13-game predictions.
              We also provide complete Betika Grand Jackpot predictions (17 games), Odibets jackpot tips, Bahatibet jackpot analysis, and Wazabet accumulator tips.
              Our jackpot tipsters have a proven track record with transparent, audited results you can verify.
            </p>
            <h2 className="mb-2 text-sm font-bold text-foreground">Tipster Community &amp; Leaderboard</h2>
            <p className="leading-relaxed">
              Join thousands of tipsters sharing football tips and sports predictions on Betcheza. Follow top-rated tipsters on the leaderboard, track their win rates and ROI, and copy their best picks.
              Post your own tips, earn points for correct predictions, and compete in tipster challenges. Sign up free and start winning with Kenya&apos;s best sports betting community.
            </p>
          </section>
        </div>

        {/* RIGHT PANEL — Best Bets + Banners (xl+) */}
        <aside className="hidden xl:block w-72 shrink-0 border-l border-border">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3 space-y-3">
            {isIdle ? <BestBetsPanel matches={todayMatches} /> : <PanelSkeleton />}
            {isIdle && <SidebarBanners />}
          </div>
        </aside>

      </div>
    </div>
  );
}

