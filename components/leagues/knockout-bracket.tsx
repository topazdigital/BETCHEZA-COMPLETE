"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Trophy, Loader2, AlertCircle } from "lucide-react"
import { TeamLogo } from "@/components/ui/team-logo"
import { cn } from "@/lib/utils"
import { matchToSlug } from "@/lib/utils/match-url"

interface Leg {
  matchId: string
  date: string
  homeScore: number | null
  awayScore: number | null
  status: string
  legNumber: 1 | 2 | 0
}

interface Tie {
  id: string
  homeTeam: { id: string; name: string; logo?: string }
  awayTeam: { id: string; name: string; logo?: string }
  legs: Leg[]
  aggregate: { home: number; away: number } | null
  winnerSide: 'home' | 'away' | 'draw' | null
  status: 'scheduled' | 'in-progress' | 'finished'
}

interface RoundOut {
  code: string
  label: string
  order: number
  ties: Tie[]
}

interface BracketResponse {
  isKnockout: boolean
  isCupCompetition?: boolean
  rounds: RoundOut[]
  season: string
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('bad-status')
  return r.json()
})

interface KnockoutBracketProps {
  leagueId: number
  silentWhenEmpty?: boolean
}

function formatMatchDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    return `${day} ${month}, ${hh}:${mm}`
  } catch {
    return ''
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function KnockoutBracket({ leagueId, silentWhenEmpty = true }: KnockoutBracketProps) {
  const { data, error, isLoading } = useSWR<BracketResponse>(
    `/api/leagues/${leagueId}/bracket`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10 * 60_000 }
  )

  const [mobileRound, setMobileRound] = useState(0)

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        Couldn&apos;t load the bracket right now.
      </div>
    )
  }

  if (!data?.isKnockout || data.rounds.length === 0) {
    if (data?.isCupCompetition) {
      return (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">Knockout Bracket</h2>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <Trophy className="h-4 w-4 shrink-0 opacity-40" />
            <div>
              <p className="font-medium text-foreground">Knockout stage not yet available</p>
              <p className="mt-0.5 text-[11px]">The bracket will appear once group stage is complete.</p>
            </div>
          </div>
        </div>
      )
    }
    if (silentWhenEmpty) return null
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        No knockout bracket available.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Trophy className="h-3.5 w-3.5 text-warning" />
        <h2 className="text-sm font-semibold">Knockout Bracket</h2>
        {data.season && (
          <span className="text-[11px] text-muted-foreground">Season {data.season}</span>
        )}
      </div>

      {/* ── DESKTOP: horizontal column layout ── */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="flex min-w-max items-start gap-0 p-3">
          {data.rounds.map((round, ri) => (
            <DesktopRoundColumn key={round.code} round={round} isLast={ri === data.rounds.length - 1} />
          ))}
        </div>
      </div>

      {/* ── MOBILE: tab + list layout ── */}
      <div className="sm:hidden">
        {/* Round tabs */}
        <div className="flex overflow-x-auto border-b border-border scrollbar-none">
          {data.rounds.map((round, ri) => (
            <button
              key={round.code}
              onClick={() => setMobileRound(ri)}
              className={cn(
                'shrink-0 px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors',
                mobileRound === ri
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {round.label}
            </button>
          ))}
        </div>
        {/* Match list for selected round */}
        <div className="divide-y divide-border">
          {(data.rounds[mobileRound]?.ties ?? []).map((tie) => (
            <MobileTieRow key={tie.id} tie={tie} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Desktop column ──────────────────────────────────────────────────────────

function DesktopRoundColumn({ round, isLast }: { round: RoundOut; isLast: boolean }) {
  return (
    <div className={cn(
      'flex w-[168px] shrink-0 flex-col',
      !isLast && 'border-r border-border/40 mr-0 pr-0'
    )}>
      {/* Round header */}
      <div className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40">
        {round.label}
      </div>
      {/* Ties — evenly spaced so connector lines would align */}
      <div className="flex flex-1 flex-col justify-around py-1 gap-0.5">
        {round.ties.map((tie) => (
          <DesktopTieCard key={tie.id} tie={tie} />
        ))}
      </div>
    </div>
  )
}

function DesktopTieCard({ tie }: { tie: Tie }) {
  const isLive = tie.status === 'in-progress'
  const legs = [...tie.legs].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  const firstLeg = legs[0]
  const dateStr = firstLeg ? formatMatchDate(firstLeg.date) : ''

  const homeScore = tie.aggregate ? tie.aggregate.home : null
  const awayScore = tie.aggregate ? tie.aggregate.away : null

  return (
    <div className={cn(
      'mx-1 my-0.5 rounded border text-[11px] overflow-hidden',
      isLive ? 'border-live/60 bg-live/5' : 'border-border bg-background',
      tie.status === 'scheduled' && 'border-dashed'
    )}>
      {/* Date row */}
      <div className={cn(
        'px-1.5 py-0.5 text-[10px] border-b',
        isLive ? 'bg-live/10 border-live/30 text-live font-semibold' : 'bg-muted/30 border-border/40 text-muted-foreground'
      )}>
        {isLive ? '● LIVE' : dateStr || 'TBD'}
      </div>

      {/* Home team */}
      <CompactTeamRow
        team={tie.homeTeam}
        score={homeScore}
        winner={tie.winnerSide === 'home'}
        loser={tie.winnerSide === 'away'}
        legs={legs}
        side="home"
      />

      {/* Divider */}
      <div className="h-px bg-border/50 mx-1.5" />

      {/* Away team */}
      <CompactTeamRow
        team={tie.awayTeam}
        score={awayScore}
        winner={tie.winnerSide === 'away'}
        loser={tie.winnerSide === 'home'}
        legs={legs}
        side="away"
      />
    </div>
  )
}

function CompactTeamRow({
  team,
  score,
  winner,
  loser,
  legs,
  side,
}: {
  team: { id: string; name: string; logo?: string }
  score: number | null
  winner: boolean
  loser: boolean
  legs: Leg[]
  side: 'home' | 'away'
}) {
  const href = team.id ? `/teams/${slugify(team.name)}-${team.id}` : null
  const matchHref = legs[0]
    ? `/matches/${matchToSlug(legs[0].matchId, legs[0].homeScore != null ? legs[0].matchId : '', '')}`
    : null

  const inner = (
    <div className={cn(
      'flex items-center gap-1 px-1.5 py-1',
      winner && 'bg-success/5',
    )}>
      <TeamLogo teamName={team.name} logoUrl={team.logo} size="xs" className="shrink-0 h-3.5 w-3.5" />
      <span className={cn(
        'flex-1 truncate text-[11px] leading-tight',
        winner && 'font-semibold text-foreground',
        loser && 'text-muted-foreground',
        !winner && !loser && 'text-foreground/90',
      )}>
        {team.name}
      </span>
      <span className={cn(
        'shrink-0 font-mono text-[11px] font-semibold w-5 text-right',
        winner && 'text-foreground',
        loser && 'text-muted-foreground',
        !winner && !loser && score == null && 'text-muted-foreground',
      )}>
        {score != null ? score : ''}
      </span>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:bg-muted/40 transition-colors" title={team.name}>
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}

// ── Mobile row ──────────────────────────────────────────────────────────────

function MobileTieRow({ tie }: { tie: Tie }) {
  const isLive = tie.status === 'in-progress'
  const legs = [...tie.legs].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  const firstLeg = legs[0]
  const dateStr = firstLeg ? formatMatchDate(firstLeg.date) : ''

  const homeScore = tie.aggregate ? tie.aggregate.home : null
  const awayScore = tie.aggregate ? tie.aggregate.away : null

  const matchHref = firstLeg
    ? `/matches/${matchToSlug(firstLeg.matchId, tie.homeTeam.name, tie.awayTeam.name)}`
    : null

  const inner = (
    <div className="px-3 py-2">
      {/* Date */}
      <div className={cn(
        'mb-1.5 text-[10px] font-medium',
        isLive ? 'text-live' : 'text-muted-foreground'
      )}>
        {isLive ? '● LIVE' : dateStr || 'TBD'}
      </div>

      {/* Teams */}
      <div className="flex flex-col gap-1">
        {/* Home */}
        <div className="flex items-center gap-2">
          <TeamLogo teamName={tie.homeTeam.name} logoUrl={tie.homeTeam.logo} size="xs" className="h-4 w-4 shrink-0" />
          <span className={cn(
            'flex-1 text-xs',
            tie.winnerSide === 'home' && 'font-semibold',
            tie.winnerSide === 'away' && 'text-muted-foreground',
          )}>
            {tie.homeTeam.name}
          </span>
          <span className={cn(
            'font-mono text-xs font-semibold w-5 text-right shrink-0',
            tie.winnerSide === 'home' ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {homeScore != null ? homeScore : '–'}
          </span>
        </div>
        {/* Away */}
        <div className="flex items-center gap-2">
          <TeamLogo teamName={tie.awayTeam.name} logoUrl={tie.awayTeam.logo} size="xs" className="h-4 w-4 shrink-0" />
          <span className={cn(
            'flex-1 text-xs',
            tie.winnerSide === 'away' && 'font-semibold',
            tie.winnerSide === 'home' && 'text-muted-foreground',
          )}>
            {tie.awayTeam.name}
          </span>
          <span className={cn(
            'font-mono text-xs font-semibold w-5 text-right shrink-0',
            tie.winnerSide === 'away' ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {awayScore != null ? awayScore : '–'}
          </span>
        </div>
      </div>

      {/* Two-leg aggregate note */}
      {legs.length > 1 && tie.aggregate && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Agg: <span className="font-semibold text-foreground">{tie.aggregate.home}–{tie.aggregate.away}</span>
        </div>
      )}
    </div>
  )

  if (matchHref) {
    return (
      <Link href={matchHref} className="block hover:bg-muted/30 transition-colors">
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}
