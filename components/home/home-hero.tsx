'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MessageCircle,
  Radio,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { TeamLogo } from '@/components/ui/team-logo';
import { WhatsAppCommunityCta } from '@/components/home/whatsapp-community-cta';
import { matchToSlug } from '@/lib/utils/match-url';
import { liveStatusLabel } from '@/lib/utils/live-status';
import type { Match } from '@/lib/hooks/use-matches';

interface HomeHeroProps {
  liveMatches: Match[];
  featuredMatches: Match[];
  isLoading: boolean;
  stats: {
    live: number;
    today: number;
    isLoading: boolean;
  };
  isAuthenticated: boolean;
  welcomeName?: string;
  onRegister: () => void;
}

function eatTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function SpotlightMatch({ match, isLive }: { match: Match; isLive: boolean }) {
  const href = `/matches/${matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name)}`;
  const status = isLive
    ? liveStatusLabel(match.sport?.slug ?? 'football', match.status, match.minute)
    : `${eatTime(match.kickoffTime)} EAT`;
  const odds = match.odds
    ? [
        { label: match.homeTeam.shortName || match.homeTeam.name, value: match.odds.home },
        ...(match.odds.draw !== undefined ? [{ label: 'Draw', value: match.odds.draw }] : []),
        { label: match.awayTeam.shortName || match.awayTeam.name, value: match.odds.away },
      ]
    : [];

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-900/80 p-4 shadow-[0_28px_90px_-32px_rgba(37,99,235,0.6)] backdrop-blur-xl sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {isLive ? 'Live spotlight' : 'Match spotlight'}
          </p>
          <p className="mt-1 truncate text-xs font-medium text-slate-200">
            {match.sport?.icon ? `${match.sport.icon} ` : ''}{match.league?.name || match.sport?.name || 'Featured match'}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${
          isLive
            ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
            : 'border-blue-200/15 bg-blue-300/10 text-blue-100'
        }`}>
          {isLive ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
          ) : (
            <Clock3 className="h-3 w-3 text-cyan-200" />
          )}
          {status}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.12),transparent_70%),rgba(255,255,255,0.025)] px-3 py-5 sm:px-5 sm:py-6">
        <Link href={href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          <div className="flex items-center justify-center gap-3 sm:gap-6">
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200/20 bg-gradient-to-br from-blue-300 to-blue-600 p-1.5 shadow-lg sm:h-16 sm:w-16">
                <TeamLogo
                  teamName={match.homeTeam.name}
                  logoUrl={match.homeTeam.logo}
                  teamId={Number(match.homeTeam.id) || undefined}
                  sportSlug={match.sport?.slug}
                  size="xl"
                  className="!h-12 !w-12 bg-transparent sm:!h-14 sm:!w-14"
                />
              </div>
              <span className="mt-3 max-w-full truncate text-sm font-bold text-white sm:text-base">
                {match.homeTeam.name}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-center">
              {isLive ? (
                <span className="font-mono text-2xl font-black tabular-nums text-white sm:text-3xl">
                  {match.homeScore ?? 0}<span className="px-1.5 text-slate-500">:</span>{match.awayScore ?? 0}
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[9px] font-black tracking-[0.18em] text-slate-400">
                  VS
                </span>
              )}
              <span className="mt-2 max-w-[110px] truncate text-center text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                {isLive ? (match.status === 'halftime' ? 'Half-time' : match.sport?.name || 'Live') : match.sport?.name || 'Upcoming'}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100/20 bg-gradient-to-br from-emerald-200 to-teal-500 p-1.5 shadow-lg sm:h-16 sm:w-16">
                <TeamLogo
                  teamName={match.awayTeam.name}
                  logoUrl={match.awayTeam.logo}
                  teamId={Number(match.awayTeam.id) || undefined}
                  sportSlug={match.sport?.slug}
                  size="xl"
                  className="!h-12 !w-12 bg-transparent sm:!h-14 sm:!w-14"
                />
              </div>
              <span className="mt-3 max-w-full truncate text-sm font-bold text-white sm:text-base">
                {match.awayTeam.name}
              </span>
            </div>
          </div>
        </Link>

        {odds.length > 0 && (
          <div className={`mt-5 grid gap-2 ${odds.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {odds.map((odd) => (
              <div key={odd.label} className="rounded-xl border border-white/[0.07] bg-slate-950/55 px-2 py-2.5 text-center">
                <span className="block truncate text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  {odd.label}
                </span>
                <span className="mt-1 block font-mono text-base font-bold text-cyan-100">
                  {odd.value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[10px] text-slate-400">
          {isLive ? 'Live match updates' : 'Odds shown as provided by listed bookmakers.'}
        </span>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-blue-200 transition hover:text-white">
          Match centre <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function FixtureRow({ match }: { match: Match }) {
  const href = `/matches/${matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name)}`;
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
      <span className="w-10 shrink-0 font-mono text-[11px] font-bold text-slate-300">
        {eatTime(match.kickoffTime)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-white">
          {match.homeTeam.name} <span className="font-normal text-slate-500">vs</span> {match.awayTeam.name}
        </span>
        <span className="mt-0.5 block truncate text-[9px] text-slate-500">
          {match.league?.name || match.sport?.name || 'Upcoming'}
        </span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
    </Link>
  );
}

export function HomeHero({
  liveMatches,
  featuredMatches,
  isLoading,
  stats,
  isAuthenticated,
  welcomeName,
  onRegister,
}: HomeHeroProps) {
  const spotlight = liveMatches[0] ?? featuredMatches[0];
  const isLive = Boolean(liveMatches[0]);
  const nextMatches = featuredMatches
    .filter((match) => match.id !== spotlight?.id)
    .slice(0, 2);
  const liveCount = Math.max(stats.live || 0, liveMatches.length);

  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_78%_38%,rgba(37,99,235,0.22),transparent_35%),linear-gradient(125deg,#07111f_0%,#0b1830_55%,#0c2532_100%)] text-white"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-44 h-[34rem] w-[34rem] rounded-full border border-white/[0.06]">
        <div className="absolute inset-10 rounded-full border border-white/[0.05]" />
        <div className="absolute inset-24 rounded-full border border-white/[0.04]" />
        <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-3xl" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-[linear-gradient(0deg,rgba(16,185,129,0.08),transparent)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1.02fr_.98fr] lg:gap-8 lg:px-8 lg:py-9 xl:gap-10 xl:px-10">
        <div className="relative z-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Betcheza matchday radar
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
              liveCount > 0
                ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
                : 'border-white/10 bg-white/[0.06] text-slate-300'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${liveCount > 0 ? 'animate-pulse bg-emerald-300' : 'bg-slate-500'}`} />
              {stats.isLoading ? 'Live scores' : `${liveCount} live now`}
            </span>
          </div>

          <h1 id="home-hero-title" className="max-w-2xl text-balance text-[2.45rem] font-black leading-[0.98] tracking-[-0.055em] sm:text-5xl xl:text-[4rem]">
            Every matchday.
            <span className="mt-1 block bg-gradient-to-r from-cyan-200 via-blue-300 to-emerald-200 bg-clip-text text-transparent">
              Every signal.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Live scores, upcoming fixtures, real odds and tipster picks — all in one clear view across 35+ sports.
          </p>

          {isAuthenticated && welcomeName && (
            <p className="mt-3 text-xs text-slate-300">
              Welcome back, <span className="font-semibold text-white">{welcomeName}</span>
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            {isAuthenticated ? (
              <>
                <Link href="/feed" className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:shadow-blue-500/35">
                  Post a tip <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/dashboard" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:bg-white/10">
                  <TrendingUp className="h-4 w-4 text-cyan-200" />
                  My dashboard
                </Link>
              </>
            ) : (
              <>
                <button type="button" onClick={onRegister} className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:shadow-blue-500/35">
                  Get started free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <Link href="/matches" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:bg-white/10">
                  <Radio className="h-4 w-4 text-emerald-300" />
                  Browse matches
                </Link>
              </>
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-1.5 border-t border-white/10 pt-4">
            <Link href="/matches?status=live" className="group flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200"><Radio className="h-4 w-4" /></span>
              <span><b className="block text-sm tabular-nums">{stats.isLoading ? '–' : liveCount}</b><small className="text-[10px] text-slate-400">Live now</small></span>
            </Link>
            <Link href="/matches" className="group flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-300/10 text-blue-200"><CalendarDays className="h-4 w-4" /></span>
              <span><b className="block text-sm tabular-nums">{stats.isLoading ? '–' : stats.today}</b><small className="text-[10px] text-slate-400">Today</small></span>
            </Link>
            <Link href="/leaderboard" className="group flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><Users className="h-4 w-4" /></span>
              <span><b className="block text-sm">50K+</b><small className="text-[10px] text-slate-400">Tipsters</small></span>
            </Link>
          </div>

          <div className="mt-4 w-fit">
            <WhatsAppCommunityCta compact />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-blue-500/10 blur-2xl" />
          {spotlight ? (
            <div className="relative">
              <SpotlightMatch match={spotlight} isLive={isLive} />
              {nextMatches.length > 0 && (
                <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-3 backdrop-blur sm:px-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Up next</span>
                    <span className="text-[10px] text-slate-500">{nextMatches.length} fixture{nextMatches.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="grid gap-0.5 sm:grid-cols-2 sm:gap-1">
                    {nextMatches.map((match) => <FixtureRow key={match.id} match={match} />)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative flex min-h-64 flex-col items-center justify-center rounded-[1.6rem] border border-white/10 bg-slate-900/80 p-7 text-center shadow-2xl backdrop-blur-xl">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-300/10 text-cyan-200">
                {isLoading ? <Sparkles className="h-5 w-5 animate-pulse" /> : <Clock3 className="h-5 w-5" />}
              </span>
              <p className="mt-4 text-sm font-bold text-white">
                {isLoading ? 'Finding the next fixture' : 'No featured match right now'}
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
                {isLoading ? 'The matchday board is loading.' : 'Check the full match list for the latest schedule.'}
              </p>
              <Link href="/matches" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-200 hover:text-white">
                Browse matches <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-3 right-0 h-24 w-40 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
    </section>
  );
}
