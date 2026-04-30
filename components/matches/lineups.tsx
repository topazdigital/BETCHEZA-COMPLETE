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

// Parse a formation string like "4-3-3", "4-2-3-1", "3-4-3" or "4-4-2"
// into an array of row sizes (defence → attack), excluding the goalkeeper.
function parseFormation(formation?: string): number[] {
  if (!formation) return [];
  const parts = formation.split(/[-\s]/).map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n > 0);
  return parts;
}

function PitchPlayer({ player, isHome }: { player: Player; isHome: boolean }) {
  const Wrapper: React.ElementType = player.id ? Link : 'div';
  const wrapperProps = player.id ? { href: playerHref(player.fullName || player.name, player.id) } : {};
  // Show last name only on the pitch — saves space and matches every TV
  // graphic punters are used to.
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
  const starters = roster.starting.slice(0, 11);
  if (starters.length === 0) return null;

  // Goalkeeper is the first player after the GK→FW sort done server-side.
  const gk = starters[0];
  const outfield = starters.slice(1);

  // Use the formation string when available, otherwise infer 4-3-3.
  const formationRows = parseFormation(roster.formation);
  // Sanity-check: rows must sum to the outfielders we actually have. If
  // they don't (e.g. ESPN reports "4-3-3" but only sent 9 outfielders),
  // fall back to even chunks so every player still gets a position.
  const totalRowPlayers = formationRows.reduce((a, b) => a + b, 0);
  let rows: number[];
  if (totalRowPlayers === outfield.length && formationRows.length > 0) {
    rows = formationRows;
  } else {
    // Default to 4-3-3 / 4-4-2 / 4-3 / etc. depending on outfield count.
    if (outfield.length === 10) rows = [4, 3, 3];
    else if (outfield.length === 9) rows = [4, 3, 2];
    else if (outfield.length === 8) rows = [4, 3, 1];
    else if (outfield.length >= 11) rows = [4, 3, 3];
    else rows = [outfield.length];
  }

  // Slice outfielders into rows.
  const slicedRows: Player[][] = [];
  let cursor = 0;
  for (const n of rows) {
    slicedRows.push(outfield.slice(cursor, cursor + n));
    cursor += n;
  }

  // Render the pitch so the GK is at the bottom (own goal) and the most
  // advanced row is at the top (attacking goal). For the away team we flip
  // it so the two halves of the screen feel symmetrical when stacked.
  const orderedRows = isHome ? [...slicedRows].reverse() : slicedRows;
  const gkRow = (
    <div key="gk" className="flex items-center justify-center">
      <PitchPlayer player={gk} isHome={isHome} />
    </div>
  );

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-lg p-3',
        // Pitch background — green gradient with subtle stripes and a
        // centre line / penalty boxes so it actually looks like a pitch.
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
        {isHome ? (
          <>
            {orderedRows.map((row, i) => (
              <div key={i} className="flex items-center justify-around">
                {row.map((p, j) => (
                  <PitchPlayer key={`${i}-${j}`} player={p} isHome={isHome} />
                ))}
              </div>
            ))}
            {gkRow}
          </>
        ) : (
          <>
            {gkRow}
            {orderedRows.map((row, i) => (
              <div key={i} className="flex items-center justify-around">
                {row.map((p, j) => (
                  <PitchPlayer key={`${i}-${j}`} player={p} isHome={isHome} />
                ))}
              </div>
            ))}
          </>
        )}
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
