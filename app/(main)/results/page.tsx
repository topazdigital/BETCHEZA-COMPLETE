"use client"

import { useState, useMemo } from "react"
import { Calendar, Search, Trophy, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { SidebarNew } from "@/components/layout/sidebar-new"
import { MatchCardNew } from "@/components/matches/match-card-new"
import { FlagIcon } from "@/components/ui/flag-icon"
import { ALL_SPORTS, getSportIcon } from "@/lib/sports-data"
import { useFinishedMatches } from "@/lib/hooks/use-matches"

// Sort sports by priority (football first)
const SPORT_PRIORITY: Record<number, number> = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 27: 8, 26: 9, 29: 10, 33: 11,
}

const DAY_OPTIONS = [
  { value: "1", label: "Today" },
  { value: "3", label: "Last 3 days" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "custom", label: "Pick a date…" },
]

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default function ResultsPage() {
  const [selectedSport, setSelectedSport] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState("7")
  const [customDate, setCustomDate] = useState<string>(toIsoDate(new Date()))

  // Auto-refreshes every 60s — newly finished matches will pop in.
  const { matches: finishedMatches, isLoading } = useFinishedMatches()

  // Date-range filter — supports a "Last N days" rolling window OR a single
  // calendar day selected via the date picker.
  const filteredByDate = useMemo(() => {
    if (dateRange === "custom") {
      // Compare on local-date string so timezones don't shift the result.
      const target = new Date(customDate + "T00:00:00")
      if (Number.isNaN(target.getTime())) return []
      const targetStr = target.toDateString()
      return finishedMatches.filter(
        (m) => new Date(m.kickoffTime).toDateString() === targetStr,
      )
    }
    const days = parseInt(dateRange, 10) || 7
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return finishedMatches.filter(m => new Date(m.kickoffTime).getTime() >= cutoff)
  }, [finishedMatches, dateRange, customDate])

  // Apply sport + search filters
  const filteredResults = useMemo(() => {
    return filteredByDate.filter(match => {
      if (selectedSport !== null && match.sportId !== selectedSport) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !match.homeTeam.name.toLowerCase().includes(q) &&
          !match.awayTeam.name.toLowerCase().includes(q) &&
          !(match.league?.name || "").toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [filteredByDate, selectedSport, searchQuery])

  // Sport pills (only sports that have results)
  const sportCounts = useMemo(() => {
    const counts = ALL_SPORTS.map(sport => ({
      ...sport,
      icon: getSportIcon(sport.slug),
      count: filteredByDate.filter(m => m.sportId === sport.id).length,
    })).filter(s => s.count > 0)
    return counts.sort((a, b) => (SPORT_PRIORITY[a.id] ?? 99) - (SPORT_PRIORITY[b.id] ?? 99))
  }, [filteredByDate])

  // Group by league. Newest finished match first within each group, and
  // groups sorted by their most recent kick-off so the freshest results
  // bubble straight to the top of the page.
  const groupedMatches = useMemo(() => {
    type Group = {
      leagueName: string
      country: string
      countryCode?: string
      sportSlug: string
      sportId: number
      latestKickoff: number
      matches: typeof filteredResults
    }
    const groups: Record<string, Group> = {}

    filteredResults.forEach(match => {
      const leagueName = match.league?.name || "Other"
      const key = `${match.sportId}-${leagueName}`
      const ts = new Date(match.kickoffTime).getTime()
      if (!groups[key]) {
        groups[key] = {
          leagueName,
          country: match.league?.country || "",
          countryCode: match.league?.countryCode,
          sportSlug: match.sport?.slug || "football",
          sportId: match.sportId,
          latestKickoff: ts,
          matches: [],
        }
      }
      groups[key].matches.push(match)
      groups[key].latestKickoff = Math.max(groups[key].latestKickoff, ts)
    })

    // Sort matches inside each group: newest first.
    Object.values(groups).forEach(g => {
      g.matches.sort(
        (a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime(),
      )
    })

    // Sort groups: latest kick-off first, with football breaking ties.
    return Object.values(groups).sort((a, b) => {
      if (a.latestKickoff !== b.latestKickoff) return b.latestKickoff - a.latestKickoff
      const pa = SPORT_PRIORITY[a.sportId] ?? 99
      const pb = SPORT_PRIORITY[b.sportId] ?? 99
      return pa - pb
    })
  }, [filteredResults])

  const totalResults = filteredResults.length
  const sportsCovered = new Set(filteredResults.map(m => m.sportId)).size
  const leagueCount = new Set(filteredResults.map(m => m.leagueId)).size
  const avgGoals =
    totalResults > 0
      ? (
          filteredResults.reduce(
            (acc, m) => acc + (m.homeScore || 0) + (m.awayScore || 0),
            0,
          ) / totalResults
        ).toFixed(1)
      : "0"

  return (
    <div className="flex">
      <SidebarNew selectedSportId={selectedSport} onSelectSport={setSelectedSport} />

      <div className="flex-1 overflow-hidden">
        <div className="px-3 py-3 md:px-5 md:py-4">
          {/* Compact header */}
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-success" />
              <h1 className="text-lg font-bold">Results</h1>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">{totalResults}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="h-7 rounded-md border border-border bg-card px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Result date range"
              >
                {DAY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {dateRange === "custom" && (
                <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <input
                    type="date"
                    value={customDate}
                    max={toIsoDate(new Date())}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="h-7 bg-transparent text-[11px] focus:outline-none"
                    aria-label="Pick date"
                  />
                </div>
              )}
              <div className="relative w-40 sm:w-48">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search teams or league…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 pl-7 text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Compact stats */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatChip icon="🏆" label="Results" value={totalResults} accent="text-success" />
            <StatChip icon="🎯" label="Sports" value={sportsCovered} accent="text-primary" />
            <StatChip icon="🏟️" label="Leagues" value={leagueCount} accent="text-blue-500" />
            <StatChip icon="⚽" label="Avg goals" value={avgGoals} accent="text-amber-500" />
          </div>

          {/* Sport pills */}
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            <Button
              variant={selectedSport === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSport(null)}
              className="shrink-0 h-7 text-[11px] px-2.5"
            >
              All
              <Badge variant="secondary" className="ml-1 h-3.5 px-1 text-[9px]">
                {filteredByDate.length}
              </Badge>
            </Button>
            {sportCounts.map(sport => (
              <Button
                key={sport.id}
                variant={selectedSport === sport.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSport(sport.id)}
                className="shrink-0 h-7 gap-1.5 text-[11px] px-2.5"
              >
                <span className="text-xs leading-none">{sport.icon}</span>
                <span>{sport.name}</span>
                <Badge variant="secondary" className="h-3.5 px-1 text-[9px]">{sport.count}</Badge>
              </Button>
            ))}
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          ) : groupedMatches.length > 0 ? (
            <div className="space-y-2.5">
              {groupedMatches.map(group => (
                <section
                  key={`${group.sportSlug}-${group.leagueName}`}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  {/* League header row */}
                  <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-sm leading-none">{getSportIcon(group.sportSlug)}</span>
                      {group.countryCode && <FlagIcon countryCode={group.countryCode} size="sm" />}
                      <h2 className="truncate text-[11px] font-bold uppercase tracking-tight">{group.leagueName}</h2>
                      {group.country && (
                        <span className="hidden text-[10px] text-muted-foreground sm:inline">· {group.country}</span>
                      )}
                    </div>
                    <Badge variant="secondary" className="h-4.5 gap-1 px-1 text-[9px] font-bold">
                      <TrendingUp className="h-2.5 w-2.5" />
                      {group.matches.length}
                    </Badge>
                  </header>
                  {/* Match rows — compact like Live page */}
                  <div className="divide-y divide-border">
                    {group.matches.map(match => (
                      <MatchCardNew key={match.id} match={match} variant="compact" />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border px-5 text-center">
              <Calendar className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-base font-semibold">No finished matches</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {searchQuery
                  ? "Try a different search query or clear your filters."
                  : dateRange === "custom"
                    ? `No matches finished on ${new Date(customDate + "T00:00:00").toDateString()}.`
                    : "Nothing has finished in the selected window."}
              </p>
              <div className="mt-3 flex gap-2">
                {searchQuery && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSearchQuery("")}>
                    Clear search
                  </Button>
                )}
                {dateRange !== "30" && (
                  <Button size="sm" className="h-8 text-xs" onClick={() => setDateRange("30")}>
                    Last 30 days
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: string
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-base leading-none">{icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${accent ?? ""}`}>{value}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
