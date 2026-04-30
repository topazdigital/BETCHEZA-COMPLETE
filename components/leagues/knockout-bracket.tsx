"use client"

import useSWR from "swr"
import Link from "next/link"
import { Trophy, Loader2, AlertCircle } from "lucide-react"
import { TeamLogo } from "@/components/ui/team-logo"
import { cn } from "@/lib/utils"
import { matchIdToSlug } from "@/lib/utils/match-url"

// Knockout bracket renderer for cup competitions.
// Fetches `/api/leagues/<id>/bracket` and lays the rounds out as horizontal
// columns (R16 → QF → SF → F). Each tie shows both legs and the aggregate
// when applicable. The component degrades gracefully:
//   - while loading: spinner
//   - no bracket data (regular-season league): nothing rendered
//   - api error: small error banner
// so the league page can always include it without conditional logic.

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
  rounds: RoundOut[]
  season: string
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('bad-status')
  return r.json()
})

interface KnockoutBracketProps {
  leagueId: number
  /** When true, hide the empty-state outright (so non-cup leagues render nothing). */
  silentWhenEmpty?: boolean
}

export function KnockoutBracket({ leagueId, silentWhenEmpty = true }: KnockoutBracketProps) {
  const { data, error, isLoading } = useSWR<BracketResponse>(
    `/api/leagues/${leagueId}/bracket`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10 * 60_000 }
  )

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        Couldn&apos;t load the bracket right now.
      </div>
    )
  }

  // Most leagues are league-format (Premier League, La Liga, etc.) — they
  // have no knockout rounds, so we just render nothing instead of a noisy
  // empty state.
  if (!data?.isKnockout || data.rounds.length === 0) {
    if (silentWhenEmpty) return null
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
        This competition doesn&apos;t have a knockout bracket published.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-warning" />
        <h2 className="text-base font-semibold">Knockout Bracket</h2>
        {data.season && (
          <span className="text-xs text-muted-foreground">Season {data.season}</span>
        )}
      </div>

      {/* Horizontal scroll for tight viewports — bracket is the rare case
          where we'd rather scroll than wrap, since pairing relationships
          are spatial. */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-4">
          {data.rounds.map((round) => (
            <RoundColumn key={round.code} round={round} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RoundColumn({ round }: { round: RoundOut }) {
  return (
    <div className="flex w-[260px] shrink-0 flex-col">
      <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {round.label}
      </div>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {round.ties.map((tie) => (
          <TieCard key={tie.id} tie={tie} />
        ))}
      </div>
    </div>
  )
}

function TieCard({ tie }: { tie: Tie }) {
  const isLive = tie.status === 'in-progress'
  const isDone = tie.status === 'finished'
  // Determine each side's score line — for two-leg ties we show
  // "1-2 / 0-0 (agg 1-2)" so users see both legs and the aggregate at once.
  const legs = [...tie.legs].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  const legLine = legs
    .filter(l => l.homeScore != null && l.awayScore != null)
    .map(l => `${l.homeScore}-${l.awayScore}`)
    .join(' / ')

  return (
    <div
      className={cn(
        'rounded-lg border bg-background p-2 shadow-sm transition-colors',
        isLive && 'border-live/50 bg-live/5',
        isDone && 'border-border',
        !isLive && !isDone && 'border-dashed',
      )}
    >
      <TeamRow team={tie.homeTeam} winner={tie.winnerSide === 'home'} loser={tie.winnerSide === 'away'} />
      <div className="my-1 h-px bg-border" />
      <TeamRow team={tie.awayTeam} winner={tie.winnerSide === 'away'} loser={tie.winnerSide === 'home'} />

      {/* Score / status line */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {isLive && <span className="font-semibold text-live">LIVE</span>}
          {!isLive && legs.length > 1 && tie.aggregate && (
            <>Agg <span className="font-semibold text-foreground">{tie.aggregate.home}-{tie.aggregate.away}</span></>
          )}
          {!isLive && legs.length === 1 && tie.aggregate && (
            <span className="font-semibold text-foreground">{tie.aggregate.home}-{tie.aggregate.away}</span>
          )}
          {!tie.aggregate && !isLive && (
            <span>Upcoming</span>
          )}
        </span>
        {legLine && (
          <span title="Leg scores" className="font-mono">{legLine}</span>
        )}
      </div>

      {/* Quick links into the legs themselves */}
      {legs.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {legs.map((l, idx) => (
            <Link
              key={l.matchId}
              href={`/matches/${matchIdToSlug(l.matchId)}`}
              className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {legs.length > 1 ? `Leg ${l.legNumber || idx + 1}` : 'Match'}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamRow({ team, winner, loser }: { team: { id: string; name: string; logo?: string }; winner: boolean; loser: boolean }) {
  // Build a /teams/<slug>-<id> link so users can jump from a knockout-bracket
  // tile straight to either club's profile page. Falls back to a plain row
  // when the upstream feed didn't include a team id (rare).
  const href = team.id ? `/teams/${slugify(team.name)}-${team.id}` : null
  const inner = (
    <>
      <TeamLogo teamName={team.name} logoUrl={team.logo} size="xs" />
      <span
        className={cn(
          'flex-1 truncate text-xs',
          winner && 'font-semibold text-foreground',
          loser && 'text-muted-foreground line-through opacity-70',
        )}
      >
        {team.name}
      </span>
    </>
  )
  if (!href) {
    return <div className="flex items-center gap-2">{inner}</div>
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/60 hover:text-primary transition-colors"
      title={`Open ${team.name}'s page`}
    >
      {inner}
    </Link>
  )
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
