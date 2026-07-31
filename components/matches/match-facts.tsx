"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Target, Goal, Shield, Activity } from "lucide-react"
import { TeamLogo } from "@/components/ui/team-logo"
import { cn } from "@/lib/utils"

interface H2HGame {
  homeTeam?: { name?: string }
  awayTeam?: { name?: string }
  homeScore?: number | null
  awayScore?: number | null
  status?: string
}

interface MatchFactsProps {
  homeTeam: { name: string; logo?: string; form?: string }
  awayTeam: { name: string; logo?: string; form?: string }
  h2h?: H2HGame[]
}

interface Fact {
  label: string
  value: string
  hits: number
  total: number
  positive: boolean
}

function parseForm(form?: string) {
  if (!form) return { wins: 0, draws: 0, losses: 0, total: 0 }
  const chars = form.split("").filter((c) => /[WDL]/i.test(c))
  return {
    wins: chars.filter((c) => c.toUpperCase() === "W").length,
    draws: chars.filter((c) => c.toUpperCase() === "D").length,
    losses: chars.filter((c) => c.toUpperCase() === "L").length,
    total: chars.length,
  }
}

function teamFacts(
  teamName: string,
  form: string | undefined,
  h2h: H2HGame[],
): Fact[] {
  const f = parseForm(form)
  const lastN = Math.max(f.total, 1)
  const facts: Fact[] = []

  // Win rate from form
  if (f.total > 0) {
    facts.push({
      label: `Won ${f.wins}/${f.total} of last ${f.total}`,
      value: `${Math.round((f.wins / f.total) * 100)}%`,
      hits: f.wins,
      total: f.total,
      positive: f.wins / f.total >= 0.5,
    })
  }

  // Unbeaten streak
  if (f.total > 0) {
    const unbeaten = f.wins + f.draws
    facts.push({
      label: `Unbeaten in ${unbeaten}/${f.total}`,
      value: `${Math.round((unbeaten / f.total) * 100)}%`,
      hits: unbeaten,
      total: f.total,
      positive: unbeaten / f.total >= 0.6,
    })
  }

  // Goals trends from H2H — guard against null/non-array (the API may return null when no H2H data is found)
  const safeH2h = Array.isArray(h2h) ? h2h : []
  const recent = safeH2h.slice(0, 5).filter(
    (g) =>
      typeof g.homeScore === "number" &&
      typeof g.awayScore === "number" &&
      g.status?.toLowerCase() !== "scheduled",
  )

  if (recent.length > 0) {
    let teamScored = 0
    let bothScored = 0
    let over25 = 0
    let teamWon = 0
    let teamCleanSheet = 0

    for (const g of recent) {
      const homeIsTeam =
        g.homeTeam?.name?.toLowerCase() === teamName.toLowerCase()
      const teamScore = (homeIsTeam ? g.homeScore : g.awayScore) ?? 0
      const oppScore = (homeIsTeam ? g.awayScore : g.homeScore) ?? 0
      const total = (g.homeScore ?? 0) + (g.awayScore ?? 0)

      if (teamScore > 0) teamScored++
      if ((g.homeScore ?? 0) > 0 && (g.awayScore ?? 0) > 0) bothScored++
      if (total > 2) over25++
      if (teamScore > oppScore) teamWon++
      if (oppScore === 0) teamCleanSheet++
    }

    facts.push({
      label: `Scored in ${teamScored}/${recent.length} of last H2H`,
      value: `${Math.round((teamScored / recent.length) * 100)}%`,
      hits: teamScored,
      total: recent.length,
      positive: teamScored / recent.length >= 0.6,
    })
    facts.push({
      label: `BTTS in ${bothScored}/${recent.length} of last H2H`,
      value: `${Math.round((bothScored / recent.length) * 100)}%`,
      hits: bothScored,
      total: recent.length,
      positive: bothScored / recent.length >= 0.6,
    })
    facts.push({
      label: `Over 2.5 in ${over25}/${recent.length} of last H2H`,
      value: `${Math.round((over25 / recent.length) * 100)}%`,
      hits: over25,
      total: recent.length,
      positive: over25 / recent.length >= 0.6,
    })
    facts.push({
      label: `Won ${teamWon}/${recent.length} of last H2H`,
      value: `${Math.round((teamWon / recent.length) * 100)}%`,
      hits: teamWon,
      total: recent.length,
      positive: teamWon / recent.length >= 0.5,
    })
    facts.push({
      label: `Clean sheet in ${teamCleanSheet}/${recent.length} H2H`,
      value: `${Math.round((teamCleanSheet / recent.length) * 100)}%`,
      hits: teamCleanSheet,
      total: recent.length,
      positive: teamCleanSheet / recent.length >= 0.4,
    })
  }

  // Take the strongest 4
  return facts
    .sort((a, b) => b.hits / b.total - a.hits / a.total)
    .slice(0, 4)
}

export function MatchFacts({ homeTeam, awayTeam, h2h = [] }: MatchFactsProps) {
  const homeFacts = useMemo(
    () => teamFacts(homeTeam.name, homeTeam.form, h2h),
    [homeTeam, h2h],
  )
  const awayFacts = useMemo(
    () => teamFacts(awayTeam.name, awayTeam.form, h2h),
    [awayTeam, h2h],
  )

  if (homeFacts.length === 0 && awayFacts.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Activity className="h-4 w-4 text-primary" />
          Match Facts
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            Trends from recent matches
          </span>
        </h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { team: homeTeam, facts: homeFacts },
            { team: awayTeam, facts: awayFacts },
          ].map(({ team, facts }) => (
            <div key={team.name} className="space-y-2">
              <div className="flex items-center gap-2">
                <TeamLogo teamName={team.name} logoUrl={team.logo} size="sm" />
                <span className="truncate text-xs font-bold">{team.name}</span>
              </div>
              {facts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No trend data yet
                </p>
              ) : (
                <div className="space-y-1.5">
                  {facts.map((f, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-2 py-1.5",
                        f.positive
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-rose-500/15 bg-rose-500/5",
                      )}
                    >
                      <span className="truncate text-[11px] text-foreground/85">
                        {f.label}
                      </span>
                      <span
                        className={cn(
                          "ml-2 shrink-0 text-[11px] font-bold tabular-nums",
                          f.positive ? "text-emerald-500" : "text-rose-500",
                        )}
                      >
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
