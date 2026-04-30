'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Star, Calendar, TrendingUp, Trophy, Sparkles, ChevronRight, Users,
  Target, Wallet, BadgeCheck, Flame, Activity, Percent, ArrowRight,
  Zap, Clock,
} from 'lucide-react';
import { TeamLogo } from '@/components/ui/team-logo';
import { FlagIcon } from '@/components/ui/flag-icon';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { formatDate, formatTime, getBrowserTimezone } from '@/lib/utils/timezone';
import { cn } from '@/lib/utils';
import { matchIdToSlug } from '@/lib/utils/match-url';
import { teamHref, tipsterHref } from '@/lib/utils/slug';

interface FollowedTeam {
  teamId: string;
  teamName: string;
  teamLogo?: string | null;
  leagueName?: string | null;
  leagueSlug?: string | null;
  countryCode?: string | null;
  sportSlug?: string | null;
  followedAt: string;
}

interface DashboardEvent {
  id: string;
  date: string;
  status: string;
  isHome: boolean;
  opponent: { id: string; name: string; logo?: string } | null;
  score?: { team: number; opponent: number } | null;
  result?: string | null;
  team: { id: string; name: string; logo?: string };
  league?: { name?: string | null; slug?: string | null; countryCode?: string | null };
  odds?: { home?: number; draw?: number; away?: number };
}

interface TipsterLatestTip {
  id: number | string;
  market: string;
  selection: string;
  odds: number;
  confidence: number;
  status: string;
  createdAt: string;
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    league: string;
    sport: string;
    kickoffTime: string;
    homeScore: number | null;
    awayScore: number | null;
  };
}

interface FollowedTipster {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  countryCode?: string | null;
  winRate: number;
  roi: number;
  totalTips: number;
  streak: number;
  isPro?: boolean;
  verified?: boolean;
  latestTip?: TipsterLatestTip | null;
}

interface FeedTip {
  id: number;
  market: string;
  selection: string;
  odds: number;
  stake: number;
  status: 'pending' | 'won' | 'lost' | 'void' | string;
  confidence: number;
  createdAt: string;
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    league: string;
    sport: string;
    homeScore: number | null;
    awayScore: number | null;
    kickoffTime: string;
  };
  tipster: { id: number; displayName: string; username: string; avatar: string | null };
}

interface DashboardStats {
  teamsFollowed: number;
  tipstersFollowed: number;
  tipsWon: number;
  tipsLost: number;
  tipsPending: number;
  winRate: number;
  avgFollowedWinRate: number;
  avgFollowedRoi: number;
}

interface DashboardData {
  authenticated: boolean;
  teams: FollowedTeam[];
  upcomingMatches: DashboardEvent[];
  recentResults: DashboardEvent[];
  followedTipsters: number[];
  tipsters?: FollowedTipster[];
  recentTips?: FeedTip[];
  stats?: DashboardStats;
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tz] = useState<string>(() => getBrowserTimezone());

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData({ authenticated: false, teams: [], upcomingMatches: [], recentResults: [], followedTipsters: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!user || !data?.authenticated) {
    return (
      <div className="container mx-auto max-w-lg px-3 py-10">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Star className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-bold">Your personal dashboard</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in to follow teams and get AI tips for your favourites.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasTeams = data.teams.length > 0;
  const hasTipsters = (data.tipsters?.length ?? 0) > 0;
  if (!hasTeams && !hasTipsters) {
    return (
      <div className="container mx-auto max-w-lg px-3 py-10">
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <Star className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h1 className="mt-3 text-lg font-bold">Build your personal feed</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow your favourite teams and tipsters to build a custom feed of fixtures, results and live tips.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/matches" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              Browse matches <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/tipsters" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted">
              Discover tipsters <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4">
      {/* Hero header — compact */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-bold sm:text-xl">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Your dashboard
          </h1>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            Personalised fixtures, results & live tips from people you follow.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(user?.role === 'tipster' || user?.role === 'admin') && (
            <Link href="/dashboard/payment-settings" className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 text-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-primary/10">
              <Wallet className="h-3 w-3" /> Payouts
            </Link>
          )}
          <Link href="/notifications" className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-muted transition-colors">
            Alerts <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* Compact stats strip */}
      {data.stats && (data.stats.tipstersFollowed > 0 || data.stats.teamsFollowed > 0) && (
        <section className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          <StatCard icon={<Users className="h-3.5 w-3.5" />} label="Teams" value={data.stats.teamsFollowed} tone="primary" />
          <StatCard icon={<BadgeCheck className="h-3.5 w-3.5" />} label="Tipsters" value={data.stats.tipstersFollowed} tone="primary" />
          <StatCard
            icon={<Percent className="h-3.5 w-3.5" />}
            label="Avg win"
            value={data.stats.tipstersFollowed > 0 ? `${data.stats.avgFollowedWinRate}%` : '—'}
            tone="emerald"
          />
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Avg ROI"
            value={data.stats.tipstersFollowed > 0 ? `${data.stats.avgFollowedRoi > 0 ? '+' : ''}${data.stats.avgFollowedRoi}%` : '—'}
            tone={data.stats.avgFollowedRoi >= 0 ? 'emerald' : 'rose'}
          />
        </section>
      )}

      {/* Two-column main grid: left = your feeds, right = tipsters */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Left column = followed teams + matches */}
        <div className="space-y-3 lg:col-span-2">
          {/* Followed teams chips */}
          {hasTeams && (
            <section className="rounded-lg border border-border bg-card p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3 w-3" /> Following teams ({data.teams.length})
                </h2>
                <Link href="/matches" className="text-[10px] font-bold uppercase text-primary hover:underline transition-colors">
                  Browse all →
                </Link>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.teams.map(t => (
                  <Link
                    key={t.teamId}
                    href={teamHref(t.teamName, t.teamId)}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <div className="h-4 w-4 overflow-hidden rounded-full">
                      <TeamLogo teamName={t.teamName} logoUrl={t.teamLogo || undefined} sportSlug={t.sportSlug || undefined} size="sm" className="h-full w-full" />
                    </div>
                    <span className="font-semibold">{t.teamName}</span>
                    {t.countryCode && <FlagIcon countryCode={t.countryCode} size="xs" />}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming + Results — compact two-column on desktop, stacked on mobile */}
          {hasTeams && (
            <div className="grid gap-3 sm:grid-cols-2">
              <section>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Upcoming
                  </h2>
                  {data.upcomingMatches.length > 0 && (
                    <span className="text-[9px] font-bold text-muted-foreground">{data.upcomingMatches.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {data.upcomingMatches.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">
                      No upcoming matches yet.
                    </div>
                  )}
                  {data.upcomingMatches.slice(0, 6).map((ev, i) => (
                    <DashboardMatchRow key={ev.id + i} ev={ev} tz={tz} kind="upcoming" />
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <TrendingUp className="h-3 w-3" /> Results
                  </h2>
                  {data.recentResults.length > 0 && (
                    <span className="text-[9px] font-bold text-muted-foreground">{data.recentResults.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {data.recentResults.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">
                      No recent results yet.
                    </div>
                  )}
                  {data.recentResults.slice(0, 6).map((ev, i) => (
                    <DashboardMatchRow key={ev.id + i} ev={ev} tz={tz} kind="result" />
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* AI Tips strip for upcoming matches */}
          {data.upcomingMatches.length > 0 && (
            <section>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Target className="h-3 w-3 text-amber-500" /> AI picks for your teams
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.upcomingMatches.slice(0, 6).map((ev, i) => (
                  <AiTipCard key={ev.id + 'tip' + i} ev={ev} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column = followed tipsters with their latest tip inline */}
        <div className="lg:col-span-1">
          {hasTipsters && data.tipsters && (
            <section>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <BadgeCheck className="h-3 w-3" /> Followed tipsters ({data.tipsters.length})
                </h2>
                <Link href="/tipsters" className="text-[10px] font-bold uppercase text-primary hover:underline">
                  Discover →
                </Link>
              </div>
              <div className="space-y-1.5">
                {data.tipsters.map((t) => (
                  <TipsterCardWithTip key={t.id} t={t} tz={tz} />
                ))}
              </div>
              {data.stats && (data.stats.tipsWon + data.stats.tipsLost) > 0 && (
                <div className="mt-2.5 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-[10px] text-muted-foreground font-medium">
                  Recent record:{' '}
                  <strong className="text-emerald-600 font-bold">{data.stats.tipsWon}W</strong>{' · '}
                  <strong className="text-rose-600 font-bold">{data.stats.tipsLost}L</strong>{' · '}
                  {data.stats.tipsPending} pending
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Latest tips feed across all followed tipsters */}
      {(data.recentTips?.length ?? 0) > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3 text-primary" /> Latest tips from your tipsters
          </h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {data.recentTips!.slice(0, 9).map((t) => (
              <FeedTipCard key={`${t.tipster.id}-${t.id}`} t={t} tz={tz} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, tone = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: 'primary' | 'emerald' | 'rose';
}) {
  const toneClasses =
    tone === 'emerald' ? 'text-emerald-600 bg-emerald-500/10' :
    tone === 'rose' ? 'text-rose-600 bg-rose-500/10' :
    'text-primary bg-primary/10';
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', toneClasses)}>{icon}</span>
      <div className="min-w-0">
        <div className="text-base font-bold leading-tight tabular-nums">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">{label}</div>
      </div>
    </div>
  );
}

function TipsterCardWithTip({ t, tz }: { t: FollowedTipster; tz: string }) {
  const initials = (t.displayName || t.username || '?').slice(0, 2).toUpperCase();
  const tip = t.latestTip;
  return (
    <div className="rounded-lg border border-border bg-card p-2 transition-colors hover:border-primary/40">
      {/* Tipster header — clickable */}
      <Link href={tipsterHref(t.username || t.displayName, t.username || t.id)} className="group flex items-center gap-2">
        {t.avatar ? (
          <Image src={t.avatar} alt={t.displayName} width={32} height={32} className="h-8 w-8 rounded-full object-cover ring-1 ring-background" unoptimized />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary ring-1 ring-background">{initials}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-xs font-bold group-hover:text-primary transition-colors">
            {t.displayName}
            {t.verified && <BadgeCheck className="h-2.5 w-2.5 shrink-0 text-primary" />}
          </div>
          <div className="flex items-center gap-1 truncate text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
            <span>@{t.username}</span>
            {t.countryCode && <FlagIcon countryCode={t.countryCode} size="xs" />}
            <span>·</span>
            <span className="text-emerald-600 font-bold">{t.winRate.toFixed(0)}% win</span>
            <span>·</span>
            <span className={cn('font-bold', t.roi >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {t.roi >= 0 ? '+' : ''}{t.roi.toFixed(1)}% ROI
            </span>
          </div>
        </div>
        {t.streak >= 3 && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/10 px-1 py-0.5 text-[9px] font-bold text-amber-600">
            <Flame className="h-2 w-2" />
            {t.streak}
          </div>
        )}
      </Link>

      {/* Inline latest tip */}
      {tip ? (
        <Link
          href={`/matches/${matchIdToSlug(tip.match.id)}`}
          className="mt-1.5 block rounded-lg border border-border bg-gradient-to-br from-primary/5 to-transparent p-1.5 transition-colors hover:border-primary/30"
        >
          <div className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
            <Zap className="h-2 w-2 text-primary" />
            Latest tip
            <span
              className={cn(
                'ml-auto rounded px-1 py-0 font-bold',
                tip.status === 'won' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                tip.status === 'lost' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400' :
                'bg-amber-500/15 text-amber-700 dark:text-amber-400',
              )}
            >
              {tip.status}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] font-bold">
            {tip.match.homeTeam}
            <span className="px-0.5 text-muted-foreground">v</span>
            {tip.match.awayTeam}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium text-primary uppercase">{tip.market}: {tip.selection}</div>
            </div>
            <div className="text-right flex items-center gap-1.5 shrink-0">
              <div className="text-[11px] font-bold text-primary tabular-nums">@{tip.odds.toFixed(2)}</div>
              <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-medium">
                <Clock className="h-2 w-2" />
                {formatDate(new Date(tip.match.kickoffTime), tz)}
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="mt-1.5 rounded-md border border-dashed border-border p-1.5 text-center text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
          No tips today
        </div>
      )}
    </div>
  );
}

function FeedTipCard({ t, tz }: { t: FeedTip; tz: string }) {
  const status = t.status;
  const statusBadge =
    status === 'won' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
    status === 'lost' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400' :
    status === 'pending' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
    'bg-muted text-muted-foreground';
  const initials = (t.tipster.displayName || t.tipster.username || '?').slice(0, 2).toUpperCase();
  const created = new Date(t.createdAt);
  return (
    <div className="rounded-lg border border-border bg-card p-2 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-1.5">
        <Link href={tipsterHref(t.tipster.username || t.tipster.displayName, t.tipster.username || t.tipster.id)} className="flex items-center gap-1.5 group">
          {t.tipster.avatar ? (
            <Image src={t.tipster.avatar} alt={t.tipster.displayName} width={20} height={20} className="h-5 w-5 rounded-full object-cover" unoptimized />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary">{initials}</div>
          )}
          <span className="truncate text-[10px] font-bold group-hover:text-primary transition-colors">{t.tipster.displayName}</span>
        </Link>
        <span className="ml-auto text-[9px] font-medium text-muted-foreground">{formatDate(created, tz)}</span>
        <span className={cn('rounded px-1 py-0 text-[8px] font-bold uppercase tracking-wider', statusBadge)}>{status}</span>
      </div>
      <Link
        href={`/matches/${matchIdToSlug(t.match.id)}`}
        className="mt-1 block text-[11px] font-bold hover:text-primary transition-colors truncate"
      >
        {t.match.homeTeam}
        {t.match.homeScore != null && ` ${t.match.homeScore}`}
        <span className="px-0.5 text-muted-foreground">v</span>
        {t.match.awayTeam}
        {t.match.awayScore != null && ` ${t.match.awayScore}`}
      </Link>
      <div className="mt-0.5 truncate text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
        {t.match.league} · {t.match.sport}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md bg-muted/30 p-1.5">
        <div className="min-w-0">
          <div className="text-[8px] uppercase font-bold text-muted-foreground tracking-wider">{t.market}</div>
          <div className="truncate text-[10px] font-bold text-primary">{t.selection}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] font-bold text-primary tabular-nums">@{t.odds.toFixed(2)}</div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase">{t.confidence}% CONF</div>
        </div>
      </div>
    </div>
  );
}

function DashboardMatchRow({ ev, tz, kind }: { ev: DashboardEvent; tz: string; kind: 'upcoming' | 'result' }) {
  const date = new Date(ev.date);
  const won = ev.result === 'W';
  const lost = ev.result === 'L';
  const oppName = ev.opponent?.name || 'Opponent';
  return (
    <Link
      href={`/matches/${matchIdToSlug(ev.id)}`}
      className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 hover:border-primary/40 transition-colors"
    >
      <div className="w-12 shrink-0 text-center">
        <div className="text-[11px] font-medium leading-tight">{formatDate(date, tz)}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{formatTime(date, tz)}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
          <span className="truncate">{ev.team.name}</span>
          <span className="text-muted-foreground">{ev.isHome ? 'vs' : '@'}</span>
          <span className="truncate text-muted-foreground">{oppName}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          {ev.league?.countryCode && <FlagIcon countryCode={ev.league.countryCode} size="xs" />}
          <span className="truncate">{ev.league?.name || 'League'}</span>
        </div>
      </div>
      {kind === 'result' && ev.score && (
        <div className={cn(
          'shrink-0 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums',
          won ? 'bg-emerald-500/10 text-emerald-600' : lost ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-foreground',
        )}>
          {ev.score.team}–{ev.score.opponent}
        </div>
      )}
      {kind === 'upcoming' && ev.odds?.home && (
        <div className="hidden sm:flex items-center gap-0.5 text-[10px] tabular-nums">
          <span className="rounded bg-muted px-1 py-0.5">{ev.odds.home.toFixed(2)}</span>
          {ev.odds.draw && <span className="rounded bg-muted px-1 py-0.5">{ev.odds.draw.toFixed(2)}</span>}
          {ev.odds.away && <span className="rounded bg-muted px-1 py-0.5">{ev.odds.away.toFixed(2)}</span>}
        </div>
      )}
    </Link>
  );
}

function AiTipCard({ ev }: { ev: DashboardEvent }) {
  const oppName = ev.opponent?.name || 'Opponent';
  const o = ev.odds || {};
  const teamOdds = ev.isHome ? o.home : o.away;
  const oppOdds = ev.isHome ? o.away : o.home;
  let market = `${ev.team.name} to win`;
  let odds = teamOdds || 2.0;
  let confidence = 60;
  if (teamOdds && oppOdds) {
    const teamFav = teamOdds < oppOdds;
    if (!teamFav) {
      market = 'Double chance — ' + ev.team.name + ' or draw';
      odds = Math.max(1.5, teamOdds * 0.7);
      confidence = 55;
    } else {
      confidence = Math.min(85, Math.round((1 / teamOdds) / (1/teamOdds + 1/oppOdds + (o.draw ? 1/o.draw : 0)) * 100));
    }
  }
  return (
    <Link
      href={`/matches/${matchIdToSlug(ev.id)}`}
      className="block rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-2.5 hover:border-amber-500/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase text-amber-600">AI Pick</span>
        <Trophy className="h-3 w-3 text-amber-500" />
      </div>
      <p className="mt-1 truncate text-xs font-semibold">vs {oppName}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{market}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-base font-bold text-amber-600 tabular-nums">@{odds.toFixed(2)}</span>
        <span className="text-[10px] text-muted-foreground">{confidence}% conf.</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 truncate">
          {ev.league?.countryCode && <FlagIcon countryCode={ev.league.countryCode} size="xs" />}
          <span className="truncate">{ev.league?.name || 'League'}</span>
        </span>
        <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
