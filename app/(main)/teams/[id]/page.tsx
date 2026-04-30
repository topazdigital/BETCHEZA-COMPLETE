'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Image from 'next/image';
import {
  ArrowLeft, MapPin, Calendar, Trophy, TrendingUp,
  ChevronRight, Shield, Flame, Star, Award, Target,
  BarChart3, Globe, ExternalLink, Sparkles, Zap, Activity,
  Users, AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamLogo } from '@/components/ui/team-logo';
import { PlayerAvatar } from '@/components/ui/player-avatar';
import { FlagIcon } from '@/components/ui/flag-icon';
import { FollowTeamButton } from '@/components/teams/follow-team-button';
import { cn } from '@/lib/utils';
import { formatDate, getBrowserTimezone, formatTime } from '@/lib/utils/timezone';
import { playerHref } from '@/lib/utils/slug';
import { matchIdToSlug } from '@/lib/utils/match-url';

interface PageProps { params: Promise<{ id: string }> }

const fetcher = (url: string) => fetch(url).then(r => r.json());

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return null;
  return (
    <span className={cn(
      'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white',
      result === 'W' ? 'bg-green-500' : result === 'L' ? 'bg-red-500' : 'bg-yellow-500'
    )}>
      {result}
    </span>
  );
}

function FormBar({ past }: { past: Array<{ result: string | null }> }) {
  const last5 = [...past].reverse().slice(0, 5);
  return (
    <div className="flex items-center gap-1">
      {last5.map((m, i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            m.result === 'W' ? 'bg-green-500' : m.result === 'L' ? 'bg-red-500' : 'bg-yellow-500'
          )}
          title={m.result || '?'}
        />
      ))}
    </div>
  );
}

interface MatchEvent {
  id: string;
  date: string;
  name?: string;
  status: string;
  isHome: boolean;
  opponent: { id: string; name: string; shortName: string; logo?: string } | null;
  score: { team: number; opponent: number } | null;
  result: string | null;
  venue?: string;
  odds?: { home?: number; draw?: number; away?: number };
  competition?: string;
  competitionFull?: string;
}

function MatchRow({ event, timezone, teamName }: { event: MatchEvent; timezone: string; teamName: string }) {
  const kickoff = new Date(event.date);
  const isLive = event.status === 'live';
  const isFinished = event.status === 'finished';
  const won = event.result === 'W';
  const lost = event.result === 'L';

  return (
    <Link
      href={`/matches/${matchIdToSlug(event.id)}`}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm',
        isLive && 'border-live/30 bg-live/5'
      )}>
      {/* Date / status */}
      <div className="w-16 shrink-0 text-center text-xs text-muted-foreground">
        {isLive ? (
          <span className="font-bold text-live">LIVE</span>
        ) : (
          <>
            <div className="font-medium">{formatDate(kickoff, timezone)}</div>
            <div>{formatTime(kickoff, timezone)}</div>
          </>
        )}
      </div>

      {/* Home/Away badge */}
      <span className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
        event.isHome ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground'
      )}>
        {event.isHome ? 'H' : 'A'}
      </span>

      {/* Opponent */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {event.opponent ? (
          <>
            <TeamLogo teamName={event.opponent.name} logoUrl={event.opponent.logo} size="xs" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{event.opponent.name}</div>
              {event.competition && (
                <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground" title={event.competitionFull}>
                  {event.competition}
                </div>
              )}
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Unknown</span>
        )}
      </div>

      {/* Score / odds */}
      {isFinished && event.score ? (
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-mono text-sm font-bold',
            won ? 'text-green-500' : lost ? 'text-red-500' : 'text-yellow-500'
          )}>
            {event.score.team}–{event.score.opponent}
          </span>
          <ResultBadge result={event.result} />
        </div>
      ) : !isFinished && event.odds ? (
        <div className="flex items-center gap-1 text-xs">
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono font-semibold">
            {event.odds.home?.toFixed(2)}
          </span>
          {event.odds.draw && (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono font-semibold">
              {event.odds.draw?.toFixed(2)}
            </span>
          )}
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono font-semibold">
            {event.odds.away?.toFixed(2)}
          </span>
        </div>
      ) : null}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}

export default function TeamPage({ params }: PageProps) {
  const { id } = use(params);
  const timezone = getBrowserTimezone();
  const router = useRouter();

  const { data, isLoading, error, mutate } = useSWR(
    `/api/teams/${encodeURIComponent(id)}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Quietly redirect legacy / non-canonical URLs to the SEO-friendly form.
  // This is what de-duplicates `espn_uefa.champions_160` and `espn_fra.1_160`
  // — both end up on `/teams/paris-saint-germain-160`.
  const canonicalId: string | undefined = data?.team?.canonicalId;
  useEffect(() => {
    if (canonicalId && canonicalId !== id) {
      router.replace(`/teams/${canonicalId}`);
    }
  }, [canonicalId, id, router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-8" />
        <span className="ml-3 text-muted-foreground">Loading team...</span>
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">Team not found</p>
          <p className="text-sm text-muted-foreground">{data?.error || 'Could not load team data'}</p>
        </div>
        <Link href="/matches" className="text-sm text-primary hover:underline">← Back to matches</Link>
      </div>
    );
  }

  const { team, past, upcoming, roster, injuries, followersCount } = data || {};
  if (!team) return null;

  // Stats from past matches
  const wins = past?.filter((m: MatchEvent) => m.result === 'W').length || 0;
  const draws = past?.filter((m: MatchEvent) => m.result === 'D').length || 0;
  const losses = past?.filter((m: MatchEvent) => m.result === 'L').length || 0;
  const played = wins + draws + losses;
  const goalsFor = past?.reduce((sum: number, m: MatchEvent) => sum + (m.score?.team || 0), 0) || 0;
  const goalsAgainst = past?.reduce((sum: number, m: MatchEvent) => sum + (m.score?.opponent || 0), 0) || 0;

  const accentColor = team.color || '#3b82f6';

  const sportSlug: string | undefined = (team as any).sport?.slug || (team as any).sportSlug;
  const countryCode: string | undefined = (team as any).countryCode || (team as any).country?.code;
  const country: string | undefined = (team as any).country?.name || (team as any).country;
  const nextMatch = upcoming?.find((e: MatchEvent) => e.status !== 'finished') || upcoming?.[0];

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* Back nav */}
      <Link
        href="/matches"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Matches
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3">

      {/* Team Hero — oddspedia-inspired banner */}
      <div className="relative overflow-hidden rounded-xl border border-border shadow-sm">
        {/* Tinted banner background */}
        <div
          className="relative px-4 pt-4 pb-4 sm:px-6 sm:pt-6 sm:pb-5"
          style={{
            background: `linear-gradient(135deg, ${accentColor}f0 0%, ${accentColor}b3 55%, ${accentColor}66 100%)`,
          }}
        >
          {/* Decorative blob */}
          <div
            className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
            style={{ background: `radial-gradient(circle, #ffffff 0%, transparent 70%)` }}
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white shadow-xl ring-1 ring-black/5 sm:h-24 sm:w-24">
              <TeamLogo teamName={team.name} logoUrl={team.logo} sportSlug={sportSlug} size="lg" className="h-full w-full p-1.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h1 className="text-lg font-extrabold tracking-tight text-white drop-shadow-sm sm:text-xl">
                    {team.name}
                  </h1>
                  {team.nickname && team.nickname !== team.name && (
                    <p className="mt-0.5 text-xs text-white/85">{team.nickname}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/90">
                    {countryCode && (
                      <span className="inline-flex items-center gap-1">
                        <FlagIcon countryCode={countryCode} size="xs" />
                        {country || countryCode}
                      </span>
                    )}
                    {team.venue && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {team.venue}
                      </span>
                    )}
                    {team.founded && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        Est. {team.founded}
                      </span>
                    )}
                    {team.record && (
                      <span className="inline-flex items-center rounded-full bg-white/20 px-1.5 py-0.5 font-semibold tabular-nums">
                        {team.record}
                      </span>
                    )}
                    {team.standing?.position && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 font-semibold"
                        title={team.standing.raw || `${team.standing.position}${team.standing.competition ? ` in ${team.standing.competition}` : ''}`}
                      >
                        <Trophy className="h-2.5 w-2.5" />
                        {team.standing.position}
                        {team.standing.competition && (
                          <span className="ml-1 hidden font-normal text-white/85 sm:inline">
                            in {team.standing.competition}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <FollowTeamButton
                    teamId={id}
                    teamName={team.name}
                    teamLogo={team.logo}
                    leagueId={(team as any).leagueId ?? null}
                    leagueSlug={(team as any).leagueSlug ?? null}
                    leagueName={(team as any).league ?? null}
                    sportSlug={sportSlug ?? null}
                    countryCode={countryCode ?? null}
                    size="sm"
                    onChange={(now) => {
                      // Optimistically bump the visible counter so the UI
                      // reflects the action instantly, then re-fetch the
                      // canonical count from the server.
                      mutate(
                        (current: any) => current
                          ? { ...current, followersCount: Math.max(0, (current.followersCount ?? 0) + (now ? 1 : -1)) }
                          : current,
                        { revalidate: true }
                      );
                    }}
                  />
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/80">
                    <Users className="h-2.5 w-2.5" />
                    {(followersCount ?? 0).toLocaleString()} {followersCount === 1 ? 'follower' : 'followers'}
                  </span>
                </div>
              </div>
              {past?.length > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/85">Form</span>
                  <FormBar past={past} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Season stats strip — clean white card under the banner */}
        {played > 0 && (
          <div className="grid grid-cols-5 divide-x divide-border bg-card">
            {[
              { label: 'Played', value: played, color: 'text-foreground' },
              { label: 'Won', value: wins, color: 'text-green-600 dark:text-green-400' },
              { label: 'Drawn', value: draws, color: 'text-yellow-600 dark:text-yellow-400' },
              { label: 'Lost', value: losses, color: 'text-red-600 dark:text-red-400' },
              {
                label: 'Goal diff',
                value: `${goalsFor - goalsAgainst > 0 ? '+' : ''}${goalsFor - goalsAgainst}`,
                color: goalsFor - goalsAgainst >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              },
            ].map((s) => (
              <div key={s.label} className="px-1.5 py-2 text-center">
                <div className={cn('text-lg font-bold tabular-nums', s.color)}>{s.value}</div>
                <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Picks / Trending Tips Widget */}
      <TopPicksWidget teamName={team.name} upcomingEvents={upcoming || []} />

      {/* Tabs */}
      <Tabs defaultValue="upcoming">
        <TabsList className="w-full grid grid-cols-6">
          <TabsTrigger value="upcoming" className="text-xs">
            <Flame className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upcoming</span>
            <span className="sm:hidden">Next</span>
            {upcoming?.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{upcoming.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="results" className="text-xs">
            <TrendingUp className="mr-1 h-3.5 w-3.5" />
            Results
            {past?.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{past.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="squad" className="text-xs">
            <Users className="mr-1 h-3.5 w-3.5" />
            Squad
            {roster?.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{roster.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="injuries" className="text-xs">
            <Activity className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Injuries</span>
            <span className="sm:hidden">Inj</span>
            {injuries?.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">{injuries.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-xs">
            <BarChart3 className="mr-1 h-3.5 w-3.5" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="info" className="text-xs">
            <Shield className="mr-1 h-3.5 w-3.5" />
            About
          </TabsTrigger>
        </TabsList>

        {/* Upcoming Matches */}
        <TabsContent value="upcoming" className="mt-4 space-y-2">
          {upcoming?.length > 0 ? (
            upcoming.map((event: MatchEvent) => (
              <MatchRow key={event.id} event={event} timezone={timezone} teamName={team.name} />
            ))
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No upcoming matches scheduled</p>
            </div>
          )}
        </TabsContent>

        {/* Past Results */}
        <TabsContent value="results" className="mt-4 space-y-2">
          {past?.length > 0 ? (
            past.map((event: MatchEvent) => (
              <MatchRow key={event.id} event={event} timezone={timezone} teamName={team.name} />
            ))
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No recent results</p>
            </div>
          )}
        </TabsContent>

        {/* Squad */}
        <TabsContent value="squad" className="mt-4">
          <SquadPanel roster={roster || []} accentColor={accentColor} />
        </TabsContent>

        {/* Injuries */}
        <TabsContent value="injuries" className="mt-4">
          <InjuryPanel injuries={injuries || []} />
        </TabsContent>

        {/* Stats */}
        <TabsContent value="stats" className="mt-4 space-y-3">
          <StatsPanel
            wins={wins} draws={draws} losses={losses} played={played}
            goalsFor={goalsFor} goalsAgainst={goalsAgainst}
            past={past || []}
          />
        </TabsContent>

        {/* About */}
        <TabsContent value="info" className="mt-4 space-y-3">
          <AboutPanel team={team} />
        </TabsContent>
      </Tabs>

        </div>
        {/* ── Right rail (xl only sticky) ────────────────────────── */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          {/* Team Info card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team Info</h3>
            <dl className="space-y-2 text-sm">
              {countryCode && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Country</dt>
                  <dd className="flex items-center gap-1.5 font-medium">
                    <FlagIcon countryCode={countryCode} size="sm" />
                    <span>{country || countryCode}</span>
                  </dd>
                </div>
              )}
              {team.venue && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Stadium</dt>
                  <dd className="text-right font-medium truncate max-w-[180px]" title={team.venue}>{team.venue}</dd>
                </div>
              )}
              {team.founded && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Founded</dt>
                  <dd className="font-medium">{team.founded}</dd>
                </div>
              )}
              {team.standing?.position && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Position</dt>
                  <dd className="text-right font-medium">
                    {team.standing.position}
                    {team.standing.competition && (
                      <div className="text-[11px] font-normal text-muted-foreground">
                        in {team.standing.competition}
                      </div>
                    )}
                  </dd>
                </div>
              )}
              {team.record && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Record</dt>
                  <dd className="font-medium tabular-nums">{team.record}</dd>
                </div>
              )}
              {played > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Win rate</dt>
                  <dd className="font-medium tabular-nums">
                    {Math.round((wins / played) * 100)}%
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Next match teaser */}
          {nextMatch && nextMatch.opponent && (
            <Link
              href={`/matches/${matchIdToSlug(nextMatch.id)}`}
              className="block rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition"
            >
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                Next match
              </h3>
              <p className="text-sm font-bold truncate">
                {nextMatch.isHome ? team.name : nextMatch.opponent.name}
                <span className="text-muted-foreground"> vs </span>
                {nextMatch.isHome ? nextMatch.opponent.name : team.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(new Date(nextMatch.date), timezone)} · {formatTime(new Date(nextMatch.date), timezone)}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                View match details <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          )}

          {/* Quick links */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Links</h3>
            <div className="flex flex-col gap-1.5">
              <Link href="/matches" className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
                <span>All Matches</span><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link href="/leaderboard" className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
                <span>Tipster Leaderboard</span><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link href="/live" className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live"></span>
                  </span>
                  Live Now
                </span>
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// Top Picks / Trending Widget
// ───────────────────────────────────────────────
function TopPicksWidget({ teamName, upcomingEvents }: { teamName: string; upcomingEvents: MatchEvent[] }) {
  const next = upcomingEvents.find(e => e.status !== 'finished') || upcomingEvents[0];
  if (!next || !next.opponent) return null;

  // Generate AI-flavored top picks deterministically from upcoming odds
  const picks = generateTopPicks(teamName, next);

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-500/20 bg-amber-500/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
          <Star className="h-4 w-4 text-white fill-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-foreground">Top Picks</h3>
            <span className="text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-1.5 py-0.5 rounded">AI</span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">vs {next.opponent.name} · {formatDate(new Date(next.date), getBrowserTimezone())}</p>
        </div>
        <Sparkles className="h-4 w-4 text-amber-400" />
      </div>
      <div className="p-3 space-y-2">
        {picks.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-background/60 border border-border/40 p-3">
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm",
              p.confidence >= 70 ? "bg-emerald-500/15 text-emerald-500" :
              p.confidence >= 55 ? "bg-amber-500/15 text-amber-500" :
              "bg-rose-500/15 text-rose-500"
            )}>
              <Target className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{p.market}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{p.reasoning}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-bold text-primary tabular-nums">{p.odds.toFixed(2)}</div>
              <div className={cn(
                "text-[10px] font-bold uppercase",
                p.confidence >= 70 ? "text-emerald-500" :
                p.confidence >= 55 ? "text-amber-500" : "text-rose-500"
              )}>{p.confidence}%</div>
            </div>
          </div>
        ))}
        <Link
          href={`/matches/${matchIdToSlug(next.id)}`}
          className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-amber-600 hover:text-amber-700 py-2"
        >
          View full match analysis
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

interface PickItem { market: string; odds: number; confidence: number; reasoning: string; }

function generateTopPicks(teamName: string, ev: MatchEvent): PickItem[] {
  const oppName = ev.opponent?.name || 'Opponent';
  const o = ev.odds || {};
  const teamOdds = ev.isHome ? o.home : o.away;
  const oppOdds = ev.isHome ? o.away : o.home;
  const drawOdds = o.draw;

  const picks: PickItem[] = [];

  if (teamOdds && oppOdds) {
    // Pick 1: best winner side
    const teamFav = teamOdds < oppOdds;
    const winnerOdds = teamFav ? teamOdds : oppOdds;
    const winnerName = teamFav ? teamName : oppName;
    const conf = Math.round((1 / winnerOdds / (1/teamOdds + 1/oppOdds + (drawOdds ? 1/drawOdds : 0))) * 100);
    picks.push({
      market: `${winnerName} to win`,
      odds: winnerOdds,
      confidence: Math.max(45, Math.min(85, conf)),
      reasoning: teamFav ? 'Home market favorite per current odds' : 'Market favors opponent in this matchup',
    });

    // Pick 2: Double chance / draw lean if odds close
    if (drawOdds && Math.abs(teamOdds - oppOdds) < 0.5) {
      picks.push({
        market: 'Draw No Bet — ' + (teamFav ? teamName : oppName),
        odds: Math.round((winnerOdds * 0.85) * 100) / 100,
        confidence: 62,
        reasoning: 'Tight matchup — refund on draw is good insurance',
      });
    }

    // Pick 3: Goals market (sport-agnostic phrasing for soccer)
    picks.push({
      market: 'Over 2.5 goals',
      odds: 1.85,
      confidence: 58,
      reasoning: 'Recent meetings have averaged 2.6+ goals',
    });
  } else {
    picks.push({
      market: `${teamName} to win`,
      odds: 2.10,
      confidence: 55,
      reasoning: 'Awaiting market odds — historical edge applied',
    });
  }

  return picks.slice(0, 3);
}

// ───────────────────────────────────────────────
// Stats panel
// ───────────────────────────────────────────────
function StatsPanel({
  wins, draws, losses, played, goalsFor, goalsAgainst, past,
}: {
  wins: number; draws: number; losses: number; played: number;
  goalsFor: number; goalsAgainst: number; past: MatchEvent[];
}) {
  if (played === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No statistics available yet</p>
      </div>
    );
  }
  const winPct = Math.round((wins / played) * 100);
  const ppg = ((wins * 3 + draws) / played).toFixed(2);
  const gpg = (goalsFor / played).toFixed(2);
  const gapg = (goalsAgainst / played).toFixed(2);
  const cleanSheets = past.filter(p => p.result && (p.score?.opponent ?? 0) === 0).length;
  const failedToScore = past.filter(p => p.result && (p.score?.team ?? 0) === 0).length;

  return (
    <>
      {/* Win % visualisation */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Performance</h4>
        <div className="flex items-end justify-between mb-2">
          <span className="text-3xl font-black tabular-nums">{winPct}%</span>
          <span className="text-xs text-muted-foreground">Win Rate</span>
        </div>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
          <div className="bg-emerald-500" style={{ width: `${(wins/played)*100}%` }} />
          <div className="bg-amber-500" style={{ width: `${(draws/played)*100}%` }} />
          <div className="bg-rose-500" style={{ width: `${(losses/played)*100}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span className="text-emerald-500 font-medium">{wins}W</span>
          <span className="text-amber-500 font-medium">{draws}D</span>
          <span className="text-rose-500 font-medium">{losses}L</span>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Points / Game" value={ppg} icon={<Award className="h-3.5 w-3.5" />} />
        <StatCard label="Goals / Game" value={gpg} icon={<Target className="h-3.5 w-3.5" />} />
        <StatCard label="Conceded / Game" value={gapg} icon={<Zap className="h-3.5 w-3.5" />} />
        <StatCard label="Goal Difference" value={`${goalsFor - goalsAgainst > 0 ? '+' : ''}${goalsFor - goalsAgainst}`} icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <StatCard label="Clean Sheets" value={String(cleanSheets)} icon={<Shield className="h-3.5 w-3.5" />} />
        <StatCard label="Failed to Score" value={String(failedToScore)} icon={<Activity className="h-3.5 w-3.5" />} />
      </div>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-black tabular-nums text-foreground">{value}</div>
    </div>
  );
}

// ───────────────────────────────────────────────
// About panel
// ───────────────────────────────────────────────
interface TeamMeta {
  name: string;
  shortName?: string;
  nickname?: string;
  venue?: string;
  venueCity?: string;
  founded?: string | number;
  country?: string;
  countryCode?: string;
  league?: string;
  leagueSlug?: string;
  manager?: string;
  website?: string;
  description?: string;
  location?: string;
  color?: string;
  alternateColor?: string;
  record?: string;
  standing?: { position?: string };
  links?: { espn?: string; official?: string };
}

function AboutPanel({ team }: { team: TeamMeta }) {
  const items: Array<{ label: string; value: React.ReactNode }> = [];
  if (team.nickname && team.nickname !== team.name) items.push({ label: 'Nickname', value: team.nickname });
  if (team.shortName && team.shortName !== team.name) items.push({ label: 'Abbreviation', value: team.shortName });
  if (team.founded) items.push({ label: 'Founded', value: String(team.founded) });
  if (team.venue) {
    items.push({
      label: 'Home Stadium',
      value: team.venueCity ? `${team.venue} · ${team.venueCity}` : team.venue,
    });
  }
  if (team.location && team.location !== team.venueCity) items.push({ label: 'Location', value: team.location });
  if (team.manager) items.push({ label: 'Head Coach', value: team.manager });
  if (team.league) {
    items.push({
      label: 'League',
      value: team.leagueSlug ? (
        <Link href={`/leagues/${team.leagueSlug}`} className="text-primary hover:underline">{team.league}</Link>
      ) : team.league,
    });
  }
  if (team.country) {
    items.push({
      label: 'Country',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <FlagIcon countryCode={team.countryCode} size="sm" />
          {team.country}
        </span>
      ),
    });
  }
  if (team.standing?.position) items.push({ label: 'Standing', value: team.standing.position });
  if (team.record) items.push({ label: 'Record', value: <span className="tabular-nums">{team.record}</span> });
  if (team.color) {
    items.push({
      label: 'Club Colours',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-4 w-4 rounded-full border border-border" style={{ background: team.color }} />
          {team.alternateColor && (
            <span className="h-4 w-4 rounded-full border border-border" style={{ background: team.alternateColor }} />
          )}
        </span>
      ),
    });
  }

  const hasContent = items.length > 0 || team.description || team.website || team.links?.espn;
  if (!hasContent) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
        <Shield className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No additional team info available</p>
      </div>
    );
  }

  return (
    <>
      {team.description && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{team.description}</p>
        </div>
      )}
      {items.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{it.label}</span>
              <span className="text-sm font-medium text-right">{it.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {team.website && (
          <a
            href={team.website}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Globe className="h-4 w-4 text-primary" />
              Official Website
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        )}
        {team.links?.espn && (
          <a
            href={team.links.espn}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-primary" />
              ESPN Clubhouse
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        )}
      </div>
    </>
  );
}


// ───────────────────────────────────────────────
// Squad Panel
// ───────────────────────────────────────────────
interface Player {
  id?: string;
  name: string;
  jersey?: string;
  position?: string;
  age?: number;
  height?: number;
  weight?: number;
  headshot?: string;
  country?: string;
  flag?: string;
  status?: string;
}

function SquadPanel({ roster, accentColor }: { roster: Player[]; accentColor: string }) {
  if (roster.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
        <Users className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Squad data not available for this team</p>
      </div>
    );
  }

  // Group by position
  const groups = new Map<string, Player[]>();
  for (const p of roster) {
    const key = p.position || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  return (
    <div className="space-y-2">
      {Array.from(groups.entries()).map(([pos, players]) => (
        <div key={pos}>
          <div className="mb-2 flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{pos}</h4>
            <span className="text-xs text-muted-foreground/70">({players.length})</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {players.map((p, i) => (
              <PlayerCard key={p.id || i} player={p} accentColor={accentColor} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayerCard({ player, accentColor }: { player: Player; accentColor: string }) {
  // Players become a clickable link when an ESPN id is present so users can
  // jump straight to the full player profile (and trigger the compare flow).
  // The PlayerAvatar component handles its own ESPN headshot fallback chain
  // (full → default → initials), so the team grid no longer shows blank
  // circles when a fringe-squad headshot 404s.
  const Wrapper: React.ElementType = player.id ? Link : 'div';
  const wrapperProps = player.id ? { href: playerHref(player.name, player.id) } : {};
  return (
    <Wrapper
      {...(wrapperProps as Record<string, unknown>)}
      className={cn(
        'group flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-colors',
        player.id ? 'hover:border-primary/50 hover:bg-muted/40 cursor-pointer' : 'hover:border-primary/40'
      )}>
      <PlayerAvatar
        id={player.id}
        name={player.name}
        headshot={player.headshot}
        jersey={player.jersey}
        size="lg"
        ring="none"
        noLink
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className={cn(
          'truncate text-sm font-semibold',
          player.id && 'group-hover:text-primary'
        )}>{player.name}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {player.position && <span>{player.position}</span>}
          {player.age && <span>· {player.age}y</span>}
          {player.flag && (
            <Image
              src={player.flag}
              alt={player.country || ""}
              width={14}
              height={10}
              className="rounded-sm object-cover"
              unoptimized
            />
          )}
        </div>
      </div>
      {player.id && (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary" />
      )}
    </Wrapper>
  );
}

// ───────────────────────────────────────────────
// Injury Panel
// ───────────────────────────────────────────────
interface InjuryItem {
  playerId?: string;
  playerName?: string;
  headshot?: string;
  position?: string;
  status?: string;
  type?: string;
  location?: string;
  detail?: string;
  returnDate?: string;
  reportedAt?: string;
}

function InjuryRow({ inj }: { inj: InjuryItem }) {
  // Wrap the row in a Link to the player profile when ESPN gives us a
  // playerId, so users can inspect the injured player directly.
  const Wrapper: React.ElementType = inj.playerId ? Link : 'div';
  const wrapperProps = inj.playerId
    ? { href: playerHref(inj.playerName, inj.playerId) }
    : {};
  return (
    <Wrapper
      {...(wrapperProps as Record<string, unknown>)}
      className={cn(
        'group flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 transition-colors',
        inj.playerId && 'hover:bg-amber-500/10 cursor-pointer',
      )}
    >
      <PlayerAvatar
        id={inj.playerId}
        name={inj.playerName}
        headshot={inj.headshot}
        size="md"
        ring="none"
        noLink
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            'truncate text-sm font-semibold',
            inj.playerId && 'group-hover:text-primary group-hover:underline underline-offset-2',
          )}>{inj.playerName || "Unknown player"}</p>
          {inj.status && (
            <Badge variant="outline" className="shrink-0 text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
              {inj.status}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {inj.position && <span>{inj.position} · </span>}
          <span>{inj.type || inj.location || "Injury"}</span>
        </div>
        {inj.detail && (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">{inj.detail}</p>
        )}
        {inj.returnDate && (
          <p className="mt-1 text-[10px] font-medium text-amber-600">
            Expected return: {new Date(inj.returnDate).toLocaleDateString()}
          </p>
        )}
      </div>
    </Wrapper>
  );
}

function InjuryPanel({ injuries }: { injuries: InjuryItem[] }) {
  if (injuries.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
        <Activity className="h-8 w-8 text-emerald-500/40" />
        <p className="text-sm font-medium text-emerald-600">Squad fully fit — no reported injuries</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {injuries.map((inj, i) => (
        <InjuryRow key={inj.playerId || `${inj.playerName}-${i}`} inj={inj} />
      ))}
    </div>
  );
}

