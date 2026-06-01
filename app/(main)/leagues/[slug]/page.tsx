"use client"

import { use, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import useSWR from "swr"
import {
  ArrowLeft, Trophy, Calendar, TrendingUp,
  ChevronRight, Clock, Star, Target, Loader2,
  AlertCircle, ChevronDown, Info, Bookmark, BarChart2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MatchCardNew } from "@/components/matches/match-card-new"
import { KnockoutBracket } from "@/components/leagues/knockout-bracket"
import { Spinner } from "@/components/ui/spinner"
import { TeamLogo } from "@/components/ui/team-logo"
import { FlagIcon } from "@/components/ui/flag-icon"
import { cn } from "@/lib/utils"
import { ALL_LEAGUES, getSportIcon } from "@/lib/sports-data"
import { playerHref } from "@/lib/utils/slug"
import { resolveLeagueSlug } from "@/lib/league-aliases"
import { useMatches } from "@/lib/hooks/use-matches"
import { isLiveMatchStatus } from "@/lib/utils/live-status"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PageProps {
  params: Promise<{ slug: string }>
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface StandingRow {
  position: number
  team: { id: string; name: string; logo?: string; href?: string | null }
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

interface OutrightOutcome { name: string; price: number; link?: string }
interface OutrightMarket { id: string; name: string; outcomes: OutrightOutcome[] }

interface ScorerRow {
  position: number
  player: { id: string; name: string; photo?: string; position?: string }
  team: { id?: string; name: string; logo?: string }
  stats: { goals: number }
}

const SPORT_ICON_BY_ID: Record<number, string> = {
  1: 'football', 2: 'basketball', 3: 'tennis',
  5: 'american-football', 6: 'baseball', 7: 'ice-hockey',
  27: 'mma',
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function LoadingBox() {
  return (
    <div className="flex h-24 items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function titleCase(s: string) {
  return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function generateSeasons(): { label: string; year: number | null }[] {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const currentSeasonStart = month >= 7 ? year : year - 1;

  const seasons: { label: string; year: number | null }[] = [
    {
      label: `${currentSeasonStart}/${String(currentSeasonStart + 1).slice(-2)} (Current)`,
      year: null,
    },
  ];
  for (let i = 1; i <= 4; i++) {
    const y = currentSeasonStart - i;
    seasons.push({ label: `${y}/${String(y + 1).slice(-2)}`, year: y });
  }
  return seasons;
}

const SEASONS = generateSeasons();

export default function LeaguePage({ params }: PageProps) {
  const { slug } = use(params)
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)

  const normalisedSlug = resolveLeagueSlug(slug) || slug
  const knownLeague = ALL_LEAGUES.find(l => l.slug === normalisedSlug)

  const { matches: allMatches, isLoading: matchesLoading } = useMatches(
    knownLeague ? { leagueId: knownLeague.id, sportId: knownLeague.sportId } : undefined
  )

  const isPastSeason = selectedSeason !== null
  const matches = isPastSeason
    ? []
    : knownLeague
    // Client-side safety filter: must match BOTH leagueId AND sportId so that
    // a stale SWR cache can't bleed matches from other leagues onto this page.
    ? allMatches.filter(m => {
        const md = m as { leagueId?: number; sportId?: number };
        const leagueMatch = md.leagueId === knownLeague.id;
        const sportMatch = !knownLeague.sportId || md.sportId === knownLeague.sportId;
        return leagueMatch && sportMatch;
      })
    : allMatches.filter(m => {
        // Check both raw league slug AND name-derived slug, since URLs are always
        // built from the name when the league is unknown (no raw slug matches name).
        const rawSlug = (m.league?.slug || '').toLowerCase()
        const nameSlug = slugify(m.league?.name || '').toLowerCase()
        const normLower = normalisedSlug.toLowerCase()
        const slugLower = slug.toLowerCase()
        return rawSlug === normLower || rawSlug === slugLower
            || nameSlug === normLower || nameSlug === slugLower
      })

  const firstMatch = matches[0]
  const league = knownLeague || (firstMatch ? {
    id: firstMatch.leagueId,
    name: firstMatch.league?.name || titleCase(normalisedSlug),
    slug: normalisedSlug,
    country: firstMatch.league?.country || '',
    countryCode: firstMatch.league?.countryCode || 'WO',
    sportId: firstMatch.sportId || 1,
    tier: firstMatch.league?.tier ?? 1,
  } : null)

  const seasonQuery = selectedSeason ? `?season=${selectedSeason}` : ''
  const { data: standingsRes, isLoading: standingsLoading } = useSWR<{ success: boolean; data: StandingRow[] }>(
    league ? `/api/leagues/${league.id}/standings${seasonQuery}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  )
  const { data: outrightsRes, isLoading: outrightsLoading } = useSWR<{ success: boolean; data: OutrightMarket[] }>(
    league ? `/api/leagues/${league.id}/outrights` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  )
  const { data: scorersRes, isLoading: scorersLoading } = useSWR<{ scorers: ScorerRow[] }>(
    league ? `/api/leagues/${league.id}/scorers${seasonQuery}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  )

  if (!league) {
    if (matchesLoading) {
      return (
        <div className="flex-1 flex h-96 items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      )
    }

    const displayName = normalisedSlug.match(/^espn[-_]?\d+$/i)
      ? 'Competition'
      : titleCase(normalisedSlug);
    return (
      <div className="flex-1 px-3 py-3 md:px-4 md:py-4">
        <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs px-2" asChild>
          <Link href="/matches"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back</Link>
        </Button>

        <Card className="mb-4 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
                No current fixtures found. The season may be in a break or yet to begin — check back soon, or explore matches across all leagues below.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mt-1">
              <Button asChild size="sm">
                <Link href="/matches">All Matches</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/live">Live Now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold mb-1">About this Competition</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {displayName} is tracked on Betcheza with AI-powered match predictions, live scores, and community tips. Bookmark this page to be notified when fixtures are announced.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Bookmark className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold mb-1">Free Betting Tips</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    When fixtures are live, our AI analyses team form, head-to-head records, and odds to deliver the best free tips for every {displayName} match.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <BarChart2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold mb-1">AI Predictions</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Our prediction engine covers 1X2, BTTS, Over/Under, Asian Handicap and Correct Score markets — fully automated for every match week.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Star className="h-3.5 w-3.5 text-warning" />Popular Leagues
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { name: 'Premier League', slug: 'premier-league', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
                { name: 'La Liga', slug: 'la-liga', flag: '🇪🇸' },
                { name: 'Champions League', slug: 'champions-league', flag: '🇪🇺' },
                { name: 'Bundesliga', slug: 'bundesliga', flag: '🇩🇪' },
                { name: 'Serie A', slug: 'serie-a', flag: '🇮🇹' },
                { name: 'Ligue 1', slug: 'ligue-1', flag: '🇫🇷' },
              ].map(l => (
                <Link key={l.slug} href={`/leagues/${l.slug}`}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-medium hover:border-primary hover:bg-accent transition-colors">
                  <span>{l.flag}</span>{l.name}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const standings = standingsRes?.data ?? []
  const outrightMarket = outrightsRes?.data?.[0]
  const scorers = scorersRes?.scorers ?? []

  const liveMatches = matches.filter(m => isLiveMatchStatus(m.status))
  const upcomingMatches = matches.filter(m => m.status === 'scheduled')
    .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime())
  const finishedMatches = matches.filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime())

  const sportIcon = getSportIcon(SPORT_ICON_BY_ID[league.sportId] || 'football')

  return (
    <div className="flex-1 overflow-hidden">
        <div className="px-3 py-3 md:px-4 md:py-4">
          {/* Back Button */}
          <Button variant="ghost" size="sm" className="mb-2 h-7 text-xs px-2" asChild>
            <Link href="/matches">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back
            </Link>
          </Button>

          {/* League Header */}
          <Card className="mb-3 overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-transparent p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card text-2xl">
                  {sportIcon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <FlagIcon countryCode={league.countryCode} size="sm" />
                    <h1 className="truncate text-lg font-bold sm:text-xl">{league.name}</h1>
                  </div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{league.country}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Season Selector */}
                  <Select
                    value={selectedSeason === null ? 'current' : String(selectedSeason)}
                    onValueChange={(v) => setSelectedSeason(v === 'current' ? null : Number(v))}
                  >
                    <SelectTrigger className="h-7 gap-1 border-border bg-card/80 text-[10px] w-auto min-w-[120px]">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEASONS.map(s => (
                        <SelectItem key={s.year ?? 'current'} value={s.year === null ? 'current' : String(s.year)} className="text-[10px]">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                    {matches.length}
                  </Badge>
                  {standings.length > 0 && (
                    <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                      <Trophy className="h-2.5 w-2.5 text-warning" />
                      {standings.length}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-card py-2 text-center border border-border/50">
                  <div className="text-xl font-bold text-live">{liveMatches.length}</div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Live</div>
                </div>
                <div className="rounded-lg bg-card py-2 text-center border border-border/50">
                  <div className="text-xl font-bold text-primary">{upcomingMatches.length}</div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Upcoming</div>
                </div>
                <div className="rounded-lg bg-card py-2 text-center border border-border/50">
                  <div className="text-xl font-bold">{finishedMatches.length}</div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Played</div>
                </div>
                <div className="rounded-lg bg-card py-2 text-center border border-border/50">
                  <div className="text-xl font-bold text-warning">
                    {outrightMarket?.outcomes.length ?? 0}
                  </div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Runners</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Knockout bracket */}
          <div className="mb-3">
            <KnockoutBracket leagueId={league.id} />
          </div>

          {/* Two-column layout */}
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* ── Main column: matches + standings table ─────────── */}
            <div className="min-w-0 space-y-3">
              {matchesLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : (
                <>
                  {/* Live */}
                  {liveMatches.length > 0 && (
                    <section>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-live"></span>
                        </span>
                        <h2 className="text-sm font-bold">Live Now</h2>
                        <Badge variant="destructive" className="h-4 px-1 text-[9px]">{liveMatches.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {liveMatches.map(match => (
                          <MatchCardNew key={match.id} match={match} variant="compact" showLeague={false} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Upcoming */}
                  {upcomingMatches.length > 0 && (
                    <section>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <h2 className="text-sm font-bold">Upcoming</h2>
                        <Badge variant="secondary" className="h-4 px-1 text-[9px]">{upcomingMatches.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {upcomingMatches.slice(0, 12).map(match => (
                          <MatchCardNew key={match.id} match={match} variant="compact" showLeague={false} />
                        ))}
                      </div>
                      {upcomingMatches.length > 12 && (
                        <Button variant="ghost" size="sm" className="mt-2 h-7 w-full text-xs" asChild>
                          <Link href={`/matches?league=${league.slug}&tab=upcoming`}>
                            View all {upcomingMatches.length} matches
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </section>
                  )}

                  {/* Recent Results */}
                  {finishedMatches.length > 0 && (
                    <section>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-success" />
                        <h2 className="text-sm font-bold">Recent Results</h2>
                      </div>
                      <div className="space-y-1">
                        {finishedMatches.slice(0, 8).map(match => (
                          <MatchCardNew key={match.id} match={match} variant="compact" showLeague={false} />
                        ))}
                      </div>
                    </section>
                  )}

                  {liveMatches.length + upcomingMatches.length + finishedMatches.length === 0 && (
                    isPastSeason ? (
                      <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center gap-1.5 p-6 text-center">
                          <Calendar className="h-6 w-6 text-muted-foreground/60" />
                          <p className="text-sm font-semibold">{SEASONS.find(s => s.year === selectedSeason)?.label} archive</p>
                          <p className="max-w-md text-[11px] text-muted-foreground">
                            Live/upcoming data is current-season only. Standings and scorers below reflect your selection.
                          </p>
                          <Button size="sm" variant="outline" className="mt-2 h-7 text-xs px-3" onClick={() => setSelectedSeason(null)}>
                            Back to current
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <EmptyState icon={Calendar} title="No matches scheduled" hint="Check back when the new round begins." />
                    )
                  )}
                </>
              )}

              {/* Full standings table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Trophy className="h-3.5 w-3.5 text-warning" />
                    League Table
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {standingsLoading ? (
                    <LoadingBox />
                  ) : standings.length === 0 ? (
                    <EmptyState
                      icon={AlertCircle}
                      title="No standings available"
                      hint="Standings are not published for this competition or the season hasn't started yet."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-[10px] uppercase tracking-wide text-muted-foreground">
                            <th className="pb-1.5 pr-2 text-left font-bold">#</th>
                            <th className="pb-1.5 text-left font-bold">Team</th>
                            <th className="pb-1.5 text-center font-bold">P</th>
                            <th className="pb-1.5 text-center font-bold">W</th>
                            <th className="pb-1.5 text-center font-bold">D</th>
                            <th className="pb-1.5 text-center font-bold">L</th>
                            <th className="pb-1.5 text-center font-bold hidden sm:table-cell">GF</th>
                            <th className="pb-1.5 text-center font-bold hidden sm:table-cell">GA</th>
                            <th className="pb-1.5 text-center font-bold">GD</th>
                            <th className="pb-1.5 pl-2 text-center font-bold">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row) => (
                            <tr
                              key={row.team.id}
                              className={cn(
                                "border-b transition-colors hover:bg-muted/50",
                                row.position <= 4 && "bg-success/5",
                                row.position >= standings.length - 2 && "bg-destructive/5"
                              )}
                            >
                              <td className="py-1.5 pr-2">
                                <span className={cn(
                                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black",
                                  row.position <= 4 && "bg-success text-success-foreground",
                                  row.position >= standings.length - 2 && "bg-destructive text-destructive-foreground"
                                )}>
                                  {row.position}
                                </span>
                              </td>
                              <td className="py-1.5">
                                {row.team.href ? (
                                  <Link
                                    href={row.team.href}
                                    className="group flex items-center gap-1.5 hover:text-primary"
                                  >
                                    <TeamLogo teamName={row.team.name} logoUrl={row.team.logo} size="xs" />
                                    <span className="truncate font-semibold group-hover:underline">{row.team.name}</span>
                                  </Link>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <TeamLogo teamName={row.team.name} logoUrl={row.team.logo} size="xs" />
                                    <span className="truncate font-semibold">{row.team.name}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 text-center font-medium">{row.played}</td>
                              <td className="py-1.5 text-center text-success font-medium">{row.won}</td>
                              <td className="py-1.5 text-center font-medium">{row.drawn}</td>
                              <td className="py-1.5 text-center text-destructive font-medium">{row.lost}</td>
                              <td className="py-1.5 text-center hidden sm:table-cell text-muted-foreground">{row.goalsFor}</td>
                              <td className="py-1.5 text-center hidden sm:table-cell text-muted-foreground">{row.goalsAgainst}</td>
                              <td className="py-1.5 text-center font-bold">
                                <span className={row.goalDifference > 0 ? "text-success" : row.goalDifference < 0 ? "text-destructive" : "text-muted-foreground"}>
                                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                                </span>
                              </td>
                              <td className="py-1.5 pl-2 text-center font-black">{row.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Right sidebar: outrights + scorers ─────────────── */}
            <aside className="space-y-3">
              {/* Outrights */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-xs">
                    <Target className="h-3.5 w-3.5 text-warning" />
                    Outright Winner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0">
                  {outrightsLoading ? (
                    <LoadingBox />
                  ) : !outrightMarket || outrightMarket.outcomes.length === 0 ? (
                    <EmptyState
                      icon={Target}
                      title="No outright market open"
                      hint="Bookmakers haven't priced this season yet."
                    />
                  ) : (
                    outrightMarket.outcomes.filter(o => o.price <= 51).slice(0, 10).map((o, idx) => (
                      <div
                        key={`${o.name}-${idx}`}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                          idx === 0 ? "bg-warning/10" : "bg-muted/40"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            idx === 0 && "bg-warning text-warning-foreground",
                            idx === 1 && "bg-gray-300 text-gray-700",
                            idx === 2 && "bg-amber-700 text-amber-100",
                            idx > 2 && "bg-muted"
                          )}>
                            {idx + 1}
                          </span>
                          <span className="truncate">{o.name}</span>
                          {idx === 0 && (
                            <Star className="h-3 w-3 shrink-0 text-warning" />
                          )}
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          <span className="font-mono font-bold text-success">
                            {o.price.toFixed(2)}
                          </span>
                          {o.link && (
                            <a
                              href={o.link}
                              target="_blank"
                              rel="nofollow noopener sponsored"
                              className="rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-semibold px-1.5 py-0.5"
                              title="Open the bookmaker's bet slip"
                            >
                              Bet
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Top Scorers */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Top Scorers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {scorersLoading ? (
                    <LoadingBox />
                  ) : scorers.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="No top scorers data"
                      hint="Top scorer stats are not yet published for this competition."
                    />
                  ) : (
                    <ol className="space-y-2">
                      {scorers.slice(0, 10).map((s) => {
                        const hasId = !!s.player.id;
                        const Wrapper: React.ElementType = hasId ? Link : 'div';
                        const wrapperProps = hasId ? { href: playerHref(s.player.name, s.player.id) } : {};
                        return (
                        <li key={`${s.position}-${s.player.id}`}>
                          <Wrapper
                            {...wrapperProps}
                            className={cn(
                              "flex items-center gap-3 rounded-lg bg-muted/30 p-2",
                              hasId && "transition-colors hover:bg-primary/10"
                            )}
                          >
                          <span className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            s.position === 1 && "bg-yellow-500 text-yellow-950",
                            s.position === 2 && "bg-gray-300 text-gray-700",
                            s.position === 3 && "bg-amber-700 text-amber-100",
                            s.position > 3 && "bg-muted"
                          )}>
                            {s.position}
                          </span>
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                            {s.player.photo ? (
                              <Image
                                src={s.player.photo}
                                alt={s.player.name}
                                fill
                                sizes="32px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                                {s.player.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "truncate text-sm font-semibold",
                              hasId && "group-hover:text-primary"
                            )}>{s.player.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{s.team.name}</p>
                          </div>
                          <span className="shrink-0 font-mono text-sm font-bold text-success">
                            {s.stats.goals}
                          </span>
                          </Wrapper>
                        </li>
                      );})}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>

          {/* ── Rich Auto-Generated SEO Content ── */}
          <LeagueRichContent
            league={league}
            standings={standings}
            scorers={scorers}
            upcomingMatches={upcomingMatches}
            finishedMatches={finishedMatches}
            liveMatches={liveMatches}
          />
        </div>
      </div>
  )
}

/* ── Rich SEO content block ─────────────────────────────────────────────── */

interface LeagueRichContentProps {
  league: { id: number; name: string; slug: string; country: string; countryCode: string; sportId: number; tier: number }
  standings: StandingRow[]
  scorers: ScorerRow[]
  upcomingMatches: { kickoffTime: string | Date; homeTeam: { name: string }; awayTeam: { name: string } }[]
  finishedMatches: { kickoffTime: string | Date; homeTeam: { name: string }; awayTeam: { name: string }; homeScore: number | null; awayScore: number | null }[]
  liveMatches: { homeTeam: { name: string }; awayTeam: { name: string } }[]
}

function LeagueRichContent({ league, standings, scorers, upcomingMatches, finishedMatches, liveMatches }: LeagueRichContentProps) {
  const topTeam = standings[0]
  const topScorer = scorers[0]
  const nextFixture = upcomingMatches[0]
  const lastResult = finishedMatches[0]

  const aboutLines: string[] = []
  if (standings.length > 0) {
    aboutLines.push(`${standings.length} teams compete in the current ${league.name} season.`)
    if (topTeam) aboutLines.push(`${topTeam.team.name} currently lead the table with ${topTeam.points} points from ${topTeam.played} matches.`)
  }
  if (topScorer) {
    aboutLines.push(`${topScorer.player.name} (${topScorer.team.name}) leads the scoring charts with ${topScorer.stats.goals} goal${topScorer.stats.goals !== 1 ? 's' : ''} this season.`)
  }
  if (liveMatches.length > 0) {
    aboutLines.push(`${liveMatches.length} ${league.name} match${liveMatches.length !== 1 ? 'es are' : ' is'} live right now — follow the scores in real time.`)
  } else if (nextFixture) {
    const d = new Date(nextFixture.kickoffTime)
    const dateLabel = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    aboutLines.push(`Next fixture: ${nextFixture.homeTeam.name} vs ${nextFixture.awayTeam.name} on ${dateLabel}.`)
  }
  if (lastResult) {
    aboutLines.push(`Most recent result: ${lastResult.homeTeam.name} ${lastResult.homeScore ?? '?'} – ${lastResult.awayScore ?? '?'} ${lastResult.awayTeam.name}.`)
  }

  if (aboutLines.length === 0) {
    aboutLines.push(`${league.name} fixtures, results, standings and AI-powered predictions are available on Betcheza. Check back for the latest updates when the next round begins.`)
  }

  return (
    <div className="mt-4 space-y-3">
      {/* About */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Info className="h-3.5 w-3.5 text-primary" />
            About {league.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {aboutLines.map((line, i) => (
            <p key={i} className="text-[12px] text-muted-foreground leading-relaxed">{line}</p>
          ))}
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Betcheza tracks every {league.name} match with live scores, community tips from verified tipsters, and AI predictions covering 1X2, BTTS, Over/Under, Asian Handicap and Correct Score markets — all free.
          </p>
        </CardContent>
      </Card>

      {/* Upcoming Fixtures Summary */}
      {upcomingMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Upcoming {league.name} Fixtures
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {upcomingMatches.slice(0, 5).map((m, i) => {
                const d = new Date(m.kickoffTime)
                const dateLabel = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                const timeLabel = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-medium truncate">{m.homeTeam.name} <span className="text-muted-foreground">vs</span> {m.awayTeam.name}</span>
                    <span className="shrink-0 ml-2 text-muted-foreground tabular-nums">{dateLabel} · {timeLabel}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              All times are shown in your local timezone. Free AI predictions will be published before each kick-off.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Results Summary */}
      {finishedMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Trophy className="h-3.5 w-3.5 text-success" />
              Recent {league.name} Results
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {finishedMatches.slice(0, 5).map((m, i) => {
                const d = new Date(m.kickoffTime)
                const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <span className="truncate font-medium">{m.homeTeam.name}</span>
                    <span className="shrink-0 mx-2 font-bold tabular-nums text-foreground">
                      {m.homeScore ?? '?'} – {m.awayScore ?? '?'}
                    </span>
                    <span className="truncate font-medium text-right">{m.awayTeam.name}</span>
                    <span className="shrink-0 ml-2 text-muted-foreground text-[10px]">{dateLabel}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEO footer */}
      <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {league.name} predictions, tips, standings and top scorers on Betcheza Kenya. Free AI-powered betting tips updated before every match.{' '}
          <Link href="/responsible-gambling" className="underline hover:text-foreground">Bet responsibly.</Link>
          {' '}
          <Link href="/matches" className="underline hover:text-foreground">Browse all matches →</Link>
        </p>
      </div>
    </div>
  )
}
