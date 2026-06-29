"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
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

export interface KnockoutBracketProps {
  leagueId: number
  silentWhenEmpty?: boolean
}

function formatMatchDate(dateStr: string, compact = false): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    return compact ? `${day}/${d.getUTCMonth() + 1} ${hh}:${mm}` : `${day} ${month}, ${hh}:${mm}`
  } catch {
    return ''
  }
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]+/g, ' ')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

export function KnockoutBracket({ leagueId, silentWhenEmpty = true }: KnockoutBracketProps) {
  const { data, error, isLoading } = useSWR<BracketResponse>(
    `/api/leagues/${leagueId}/bracket`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10 * 60_000 }
  )

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

      {/* Full bracket — horizontally scrollable on both mobile and desktop */}
      <div className="overflow-x-auto">
        <BracketTree rounds={data.rounds} />
      </div>
    </div>
  )
}

// ── Bracket tree ──────────────────────────────────────────────────────────────

const CONNECTOR_W = 14  // px — width of the connector stub on each side
const CARD_W_SM = 108   // px — mobile card width
const CARD_W_LG = 160   // px — desktop card width

function BracketTree({ rounds }: { rounds: RoundOut[] }) {
  // Total rounds count drives how wide we make the whole tree
  const totalRounds = rounds.length

  return (
    <div className="flex items-stretch py-2 px-1 min-w-max select-none">
      {rounds.map((round, ri) => {
        const isFirst = ri === 0
        const isLast = ri === totalRounds - 1
        return (
          <BracketColumn
            key={round.code}
            round={round}
            isFirst={isFirst}
            isLast={isLast}
          />
        )
      })}
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function BracketColumn({
  round,
  isFirst,
  isLast,
}: {
  round: RoundOut
  isFirst: boolean
  isLast: boolean
}) {
  // Group ties into pairs — each pair feeds one tie in the next round.
  // The last group may be a singleton (e.g., 3rd-place or bye).
  const pairs: Tie[][] = []
  for (let i = 0; i < round.ties.length; i += 2) {
    pairs.push(round.ties.slice(i, Math.min(i + 2, round.ties.length)))
  }

  return (
    <div
      className="flex flex-col shrink-0"
      style={{ width: `calc(${CONNECTOR_W}px + var(--bcard-w, ${CARD_W_LG}px) + ${CONNECTOR_W}px)` }}
    >
      {/* Round header */}
      <div
        className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground py-1 mx-2 mb-1 rounded bg-muted/30"
        style={{ minWidth: 0 }}
      >
        <span
          className="hidden sm:inline"
          style={{ fontSize: '9px', letterSpacing: '.05em' }}
        >{round.label}</span>
        <span className="sm:hidden" style={{ fontSize: '8px' }}>{round.code}</span>
      </div>

      {/* Pairs */}
      <div className="flex flex-1 flex-col">
        {pairs.map((pair, pi) => (
          <BracketPair
            key={pi}
            ties={pair}
            isFirst={isFirst}
            isLast={isLast}
          />
        ))}
      </div>
    </div>
  )
}

// ── Pair ──────────────────────────────────────────────────────────────────────

function BracketPair({
  ties,
  isFirst,
  isLast,
}: {
  ties: Tie[]
  isFirst: boolean
  isLast: boolean
}) {
  const hasPair = ties.length === 2

  return (
    <div className="flex flex-1 flex-col relative">
      {ties.map((tie, i) => (
        <div
          key={tie.id}
          className="flex flex-1 items-center relative"
          style={{ minHeight: '56px' }}
        >
          {/* ── Left connector stub ── */}
          {!isFirst && (
            <div
              className="shrink-0 self-stretch flex items-center"
              style={{ width: CONNECTOR_W }}
            >
              <div className="w-full h-px bg-border/60" />
            </div>
          )}
          {isFirst && <div style={{ width: CONNECTOR_W }} className="shrink-0" />}

          {/* ── Tie card ── */}
          <div
            className="flex-1 min-w-0"
            style={{ maxWidth: `var(--bcard-w, ${CARD_W_LG}px)` }}
          >
            <TieCard tie={tie} />
          </div>

          {/* ── Right connector stub (horizontal) ── */}
          {!isLast && (
            <div
              className="shrink-0 self-stretch flex items-center"
              style={{ width: CONNECTOR_W }}
            >
              <div className="w-full h-px bg-border/60" />
            </div>
          )}
          {isLast && <div style={{ width: CONNECTOR_W }} className="shrink-0" />}

          {/* ── Right vertical bracket line (drawn on each tie wrapper) ──
               For the first tie in a pair: right border from center downward
               For the second tie in a pair: right border from center upward   */}
          {!isLast && hasPair && (
            <div
              className="absolute bg-border/60 pointer-events-none"
              style={{
                right: 0,
                width: 1,
                // tie 0 → bottom half; tie 1 → top half
                top: i === 0 ? '50%' : 0,
                bottom: i === 0 ? 0 : '50%',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tie card ──────────────────────────────────────────────────────────────────

function TieCard({ tie }: { tie: Tie }) {
  const router = useRouter()
  const isLive = tie.status === 'in-progress'
  const legs = [...tie.legs].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  const firstLeg = legs[0]

  const homeScore = tie.aggregate != null ? tie.aggregate.home : null
  const awayScore = tie.aggregate != null ? tie.aggregate.away : null

  const dateStr = firstLeg
    ? (isLive ? '● LIVE' : formatMatchDate(firstLeg.date))
    : ''
  const shortDate = firstLeg
    ? (isLive ? '●' : formatMatchDate(firstLeg.date, true))
    : ''

  // Only clickable when both teams are real decided teams, not placeholders
  const isPlaceholder = (team: { id: string; name: string }) => {
    const n = team.name.toLowerCase()
    return !team.id ||
      n.includes('winner') || n.includes('loser') ||
      n.includes('tbd') || n.includes('round of') ||
      n.includes('group ') || n.startsWith('winner') || n.startsWith('loser')
  }
  const bothTeamsDecided = !isPlaceholder(tie.homeTeam) && !isPlaceholder(tie.awayTeam)

  const matchHref = bothTeamsDecided && firstLeg
    ? `/matches/${matchToSlug(firstLeg.matchId, tie.homeTeam.name, tie.awayTeam.name)}`
    : null

  return (
    <div
      role={matchHref ? 'button' : undefined}
      tabIndex={matchHref ? 0 : undefined}
      onClick={matchHref ? () => router.push(matchHref) : undefined}
      onKeyDown={matchHref ? (e) => { if (e.key === 'Enter') router.push(matchHref) } : undefined}
      className={cn(
        'rounded border text-[10px] overflow-hidden',
        'sm:text-[11px]',
        isLive ? 'border-live/60 bg-live/5' : 'border-border bg-background',
        tie.status === 'scheduled' && !isLive && 'border-dashed',
        matchHref && 'cursor-pointer hover:opacity-80 transition-opacity',
      )}
    >
      {/* Date row */}
      <div
        className={cn(
          'px-1 py-px border-b text-[9px] truncate',
          'sm:text-[10px]',
          isLive
            ? 'text-live font-semibold bg-live/10 border-live/30'
            : 'text-muted-foreground bg-muted/30 border-border/40',
        )}
      >
        <span className="sm:hidden">{shortDate || 'TBD'}</span>
        <span className="hidden sm:inline">{dateStr || 'TBD'}</span>
      </div>

      {/* Home */}
      <TeamScoreRow
        team={tie.homeTeam}
        score={homeScore}
        winner={tie.winnerSide === 'home'}
        loser={tie.winnerSide === 'away'}
      />
      <div className="h-px bg-border/40 mx-1" />
      {/* Away */}
      <TeamScoreRow
        team={tie.awayTeam}
        score={awayScore}
        winner={tie.winnerSide === 'away'}
        loser={tie.winnerSide === 'home'}
      />
    </div>
  )
}

function TeamScoreRow({
  team,
  score,
  winner,
  loser,
}: {
  team: { id: string; name: string; logo?: string }
  score: number | null
  winner: boolean
  loser: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1 py-0.5',
        winner && 'bg-success/5',
      )}
    >
      <div className="shrink-0 w-4 h-4 flex items-center justify-center overflow-hidden">
        <TeamLogo
          teamName={team.name}
          logoUrl={team.logo}
          size="xs"
        />
      </div>
      <span
        className={cn(
          'flex-1 truncate leading-tight',
          winner && 'font-semibold text-foreground',
          loser && 'text-muted-foreground',
          !winner && !loser && 'text-foreground/90',
        )}
      >
        <span className="sm:hidden">{team.name.substring(0, 10)}</span>
        <span className="hidden sm:inline">{team.name}</span>
      </span>
      <span
        className={cn(
          'shrink-0 font-mono font-semibold text-right',
          'w-4 sm:w-5',
          winner && 'text-foreground',
          loser && 'text-muted-foreground',
          score == null && 'text-muted-foreground/50',
        )}
      >
        {score != null ? score : ''}
      </span>
    </div>
  )
}
