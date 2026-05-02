"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { User, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { playerHref } from "@/lib/utils/slug"
import { PlayerAvatar } from "@/components/ui/player-avatar"

interface Player {
  id?: string
  name: string
  fullName?: string
  position?: string
  jersey?: string
  starter: boolean
  headshot?: string
}

interface TeamRoster {
  teamId?: string
  teamName?: string
  teamLogo?: string
  formation?: string
  coach?: string
  starting: Player[]
  bench: Player[]
}

interface LineupsProps {
  homeTeam: string
  awayTeam: string
  homeRoster?: TeamRoster | null
  awayRoster?: TeamRoster | null
  isConfirmed?: boolean
}

function PlayerRow({ player, bench }: { player: Player; bench?: boolean }) {
  // Players become a clickable link when an id is present.
  const Wrapper: React.ElementType = player.id ? Link : 'div'
  const wrapperProps = player.id ? { href: playerHref(player.fullName || player.name, player.id) } : {}

  return (
    <Wrapper
      {...(wrapperProps as Record<string, unknown>)}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors",
        player.id ? "hover:bg-primary/10" : "hover:bg-muted/50",
        bench && "opacity-70"
      )}>
      <span className="w-6 text-center font-mono text-xs font-bold text-muted-foreground shrink-0">
        {player.jersey || "—"}
      </span>
      <PlayerAvatar
        id={player.id}
        name={player.fullName || player.name}
        headshot={player.headshot}
        size="md"
        ring="border"
        noLink
      />
      <span className={cn(
        "flex-1 truncate text-sm font-medium",
        player.id && "group-hover:text-primary group-hover:underline underline-offset-2"
      )}>
        {player.fullName || player.name}
      </span>
      {player.position && (
        <Badge variant="outline" className="text-[9px] py-0 px-1.5 shrink-0 uppercase">
          {player.position}
        </Badge>
      )}
    </Wrapper>
  )
}

// ── Player role classification ────────────────────────────────────────────────
// Granular role bucket so we can map each formation line to the right players
// (e.g. CDMs go in the DM row, LW/RW wingers go in the WING row, etc.) rather
// than relying on the coarse GK/DF/MF/FW sort that previously caused CBs to
// appear on the wings in 3-back systems.
type Role = 'GK' | 'DEF' | 'DM' | 'CM' | 'AM' | 'WING' | 'FW'

// ESPN encodes lateral position as a dash-suffix: "CD-L", "CM-R", "CF-L" etc.
function espnSuffix(pos: string): 'L' | 'R' | 'C' {
  if (pos.endsWith('-L')) return 'L'
  if (pos.endsWith('-R')) return 'R'
  return 'C'
}

function classifyPlayer(p: Player): Role {
  const pos = (p.position || '').toUpperCase().trim()
  if (!pos) return 'CM'
  if (pos === 'G' || pos === 'GK' || pos.startsWith('GOAL')) return 'GK'
  if (/CDM|DMF|^DM\b|DEFENSIVE\s*MID/.test(pos)) return 'DM'
  // ESPN uses bare "AM" for attacking midfielder
  if (/CAM|AMF|^AM$|ATTACK.*MID|SS\b|SECONDARY/.test(pos)) return 'AM'
  // Wide midfielders / wingers — LM/RM in ESPN = wide midfielders
  if (/^LW\b|^RW\b|WING|^LM\b|^RM\b|LWF|RWF/.test(pos)) return 'WING'
  // Central midfielders — ESPN: CM, CM-L, CM-R, MF, M
  if (/^CM\b|^MC|MIDFIELD|^M\b|^MF\b/.test(pos)) return 'CM'
  // Forwards — ESPN: CF, CF-L, CF-R, ST, FW, F
  if (/^CF\b|^ST\b|^FW\b|^F\b|STRIK|FORWARD/.test(pos)) return 'FW'
  // Defenders — ESPN uses CD (Center Defender) not CB for centre-backs
  if (/^CB\b|^CD\b|^LB\b|^RB\b|^LWB|^RWB|^SW\b|DEFEND|BACK|^D\b|^DF\b/.test(pos)) return 'DEF'
  return 'CM'
}

// L → C → R so each row reads left-flank to right-flank.
// ESPN encodes side as a dash-suffix ("CD-L", "CM-R") not a leading letter,
// so check the suffix first then fall back to leading letter for classic
// abbreviations (LB, RB, LW, RW …).
function sideRank(p: Player): number {
  const pos = (p.position || '').toUpperCase()
  const suffix = espnSuffix(pos)
  if (suffix === 'L') return 0
  if (suffix === 'R') return 2
  if (pos.startsWith('L')) return 0
  if (pos.startsWith('R')) return 2
  return 1
}

// For a formation with `n` lines (excluding GK), what preferred role does
// each line represent from defence to attack?
function rolesForLines(n: number): Role[] {
  if (n <= 1) return ['CM']
  if (n === 2) return ['DEF', 'FW']
  if (n === 3) return ['DEF', 'CM', 'FW']
  if (n === 4) return ['DEF', 'DM', 'AM', 'FW']
  if (n === 5) return ['DEF', 'DM', 'CM', 'AM', 'FW']
  const out: Role[] = ['DEF']
  for (let i = 0; i < n - 2; i++) out.push('CM')
  out.push('FW')
  return out
}

// Priority for filling the DEF row: pure centre-backs (CB / CD in ESPN) are
// preferred over fullbacks/wing-backs so that in a 3-back formation the three
// CBs fill the defensive line and the fullbacks overflow to midfield.
function defPriority(p: Player): number {
  const pos = (p.position || '').toUpperCase()
  if (/^CB\b|^CD\b/.test(pos)) return 0  // Centre-backs: highest priority
  if (/^LWB|^RWB/.test(pos)) return 2    // Wing-backs: lowest (play as mids)
  return 1                                 // Full-backs: middle
}

// Fallback buckets: when a row's preferred bucket is short, try neighbours.
const FALLBACK: Record<Role, Role[]> = {
  GK:   ['GK'],
  DEF:  ['DEF', 'DM'],
  DM:   ['DM', 'CM', 'DEF'],
  CM:   ['CM', 'AM', 'DM', 'WING'],
  AM:   ['AM', 'CM', 'WING'],
  WING: ['WING', 'AM', 'FW', 'CM'],
  FW:   ['FW', 'WING', 'AM'],
}

function parseFormation(f?: string): number[] {
  if (!f) return [4, 4, 2]
  const parts = f.split(/[-\s]/).map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0)
  return parts.length ? parts : [4, 4, 2]
}

// Build an array of rows (GK row first, then defence → attack) with players
// correctly classified and ordered left-to-right within each row.
function buildFormationRows(roster: TeamRoster): Player[][] {
  const starters = roster.starting.slice(0, 11)
  if (starters.length === 0) return []

  const formation = parseFormation(roster.formation)

  // Fill role buckets.
  const buckets: Record<Role, Player[]> = {
    GK: [], DEF: [], DM: [], CM: [], AM: [], WING: [], FW: [],
  }
  for (const p of starters) buckets[classifyPlayer(p)].push(p)
  // Pre-sort each bucket. For DEF: sort CBs before fullbacks/wing-backs so a
  // 3-back formation always fills its DEF row with the three centre-backs
  // rather than letting fullbacks displace a CB to the wing.
  for (const k of Object.keys(buckets) as Role[]) {
    if (k === 'DEF') {
      buckets[k].sort((a, b) => {
        const pd = defPriority(a) - defPriority(b)
        if (pd !== 0) return pd
        return sideRank(a) - sideRank(b)
      })
    } else {
      buckets[k].sort((a, b) => sideRank(a) - sideRank(b))
    }
  }

  const lineRoles = rolesForLines(formation.length)
  const roles: Role[] = ['GK', ...lineRoles]
  const counts: number[] = [1, ...formation]

  const rows: Player[][] = roles.map(() => [])

  // First pass: fill each row from its preferred bucket (+ fallbacks).
  for (let i = 0; i < roles.length; i++) {
    const need = counts[i]
    for (const fb of FALLBACK[roles[i]]) {
      while (rows[i].length < need && buckets[fb].length) {
        rows[i].push(buckets[fb].shift()!)
      }
      if (rows[i].length >= need) break
    }
  }

  // Second pass: dump any leftover players into the row with the most slack.
  const leftovers = (Object.keys(buckets) as Role[]).flatMap(k => buckets[k])
  for (const p of leftovers) {
    let best = -1, bestSlack = 0
    for (let i = 1; i < counts.length; i++) {
      const slack = counts[i] - rows[i].length
      if (slack > bestSlack) { best = i; bestSlack = slack }
    }
    if (best === -1) best = rows.length - 1
    rows[best].push(p)
  }

  // Re-sort every non-GK row by side after fallback fills.
  for (let i = 1; i < rows.length; i++) {
    rows[i].sort((a, b) => sideRank(a) - sideRank(b))
  }

  return rows
}

function PitchPlayer({ player, isHome }: { player: Player; isHome: boolean }) {
  const Wrapper: React.ElementType = player.id ? Link : 'div';
  const wrapperProps = player.id ? { href: playerHref(player.fullName || player.name, player.id) } : {};
  const lastName = (player.fullName || player.name).split(/\s+/).slice(-1)[0];
  return (
    <Wrapper
      {...(wrapperProps as Record<string, unknown>)}
      className={cn(
        'group flex flex-col items-center gap-1',
        player.id && 'cursor-pointer',
      )}
      title={player.fullName || player.name}
    >
      <PlayerAvatar
        id={player.id}
        name={player.fullName || player.name}
        headshot={player.headshot}
        jersey={player.jersey}
        size="md"
        ring={isHome ? 'blue' : 'red'}
        noLink
        className={cn('shadow-md transition-transform', player.id && 'group-hover:scale-110')}
      />
      <span className="max-w-[80px] truncate rounded bg-black/70 px-1 text-[10px] font-medium text-white">
        {lastName}
      </span>
    </Wrapper>
  );
}

function FormationPitch({ roster, isHome }: { roster: TeamRoster; isHome: boolean }) {
  // rows[0] = GK, rows[1] = defence, …, rows[last] = attack
  const rows = buildFormationRows(roster)
  if (rows.length === 0) return null

  // For the home team: GK at bottom → attack at top.
  // For the away team: GK at top → attack at bottom.
  // buildFormationRows always returns [GK, DEF, …, FW] so we reverse for home.
  const displayRows = isHome ? [...rows].reverse() : rows

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-lg p-3',
        'bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-700',
      )}
      style={{
        backgroundImage:
          'linear-gradient(180deg, rgba(0,0,0,0) 0, rgba(0,0,0,0) 49.5%, rgba(255,255,255,0.45) 49.5%, rgba(255,255,255,0.45) 50.5%, rgba(0,0,0,0) 50.5%, rgba(0,0,0,0) 100%), repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 18px, rgba(0,0,0,0.04) 18px 36px)',
      }}
    >
      {/* Centre circle */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
      {/* Penalty boxes */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-12 w-2/3 -translate-x-1/2 rounded-t-md border-x border-t border-white/40" />
      <div className="pointer-events-none absolute top-0 left-1/2 h-12 w-2/3 -translate-x-1/2 rounded-b-md border-x border-b border-white/40" />

      <div className="relative z-10 flex flex-col gap-3 py-2">
        {displayRows.map((row, i) => (
          <div key={i} className="flex items-center justify-around">
            {row.map((p, j) => (
              <PitchPlayer key={`${i}-${j}`} player={p} isHome={isHome} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RosterList({ roster, teamName }: { roster: TeamRoster; teamName: string }) {
  const [showBench, setShowBench] = useState(false)
  const starters = roster.starting.slice(0, 11)
  const bench = roster.bench

  return (
    <div className="space-y-1">
      {starters.length > 0 && (
        <div>
          <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Starting XI
          </p>
          <div className="space-y-0.5">
            {starters.map((p, i) => (
              <PlayerRow key={i} player={p} />
            ))}
          </div>
        </div>
      )}
      {bench.length > 0 && (
        <div className="mt-2">
          <button
            className="flex w-full items-center gap-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 hover:text-foreground transition-colors"
            onClick={() => setShowBench(!showBench)}
          >
            {showBench ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Bench ({bench.length})
          </button>
          {showBench && (
            <div className="space-y-0.5">
              {bench.slice(0, 12).map((p, i) => (
                <PlayerRow key={i} player={p} bench />
              ))}
            </div>
          )}
        </div>
      )}
      {starters.length === 0 && bench.length === 0 && (
        <p className="px-3 py-4 text-sm text-muted-foreground text-center">
          No lineup data available
        </p>
      )}
    </div>
  )
}

export function Lineups({
  homeTeam,
  awayTeam,
  homeRoster,
  awayRoster,
  isConfirmed = false,
}: LineupsProps) {
  const hasData = (homeRoster && homeRoster.starting.length > 0) ||
    (awayRoster && awayRoster.starting.length > 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Lineups</CardTitle>
          {isConfirmed ? (
            <Badge className="gap-1 text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" />
              Confirmed
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-500/30">
              <AlertCircle className="h-3 w-3" />
              Predicted
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <Tabs defaultValue="home" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="home" className="gap-2 text-sm">
                <User className="h-4 w-4" />
                {homeRoster?.teamName || homeTeam}
                {homeRoster?.formation && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {homeRoster.formation}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="away" className="gap-2 text-sm">
                <User className="h-4 w-4" />
                {awayRoster?.teamName || awayTeam}
                {awayRoster?.formation && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {awayRoster.formation}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="home" className="mt-0">
              {homeRoster ? (
                <div className="space-y-3">
                  {homeRoster.coach && (
                    <p className="px-3 text-xs text-muted-foreground">
                      Coach: <span className="font-medium text-foreground">{homeRoster.coach}</span>
                    </p>
                  )}
                  {homeRoster.starting.length >= 7 && (
                    <FormationPitch roster={homeRoster} isHome />
                  )}
                  <RosterList roster={homeRoster} teamName={homeRoster.teamName || homeTeam} />
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No lineup data for {homeTeam}
                </p>
              )}
            </TabsContent>

            <TabsContent value="away" className="mt-0">
              {awayRoster ? (
                <div className="space-y-3">
                  {awayRoster.coach && (
                    <p className="px-3 text-xs text-muted-foreground">
                      Coach: <span className="font-medium text-foreground">{awayRoster.coach}</span>
                    </p>
                  )}
                  {awayRoster.starting.length >= 7 && (
                    <FormationPitch roster={awayRoster} isHome={false} />
                  )}
                  <RosterList roster={awayRoster} teamName={awayRoster.teamName || awayTeam} />
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No lineup data for {awayTeam}
                </p>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="py-10 text-center text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Lineup not announced yet</p>
            <p className="text-sm mt-1">Squad lists are usually confirmed 1 hour before kickoff.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
