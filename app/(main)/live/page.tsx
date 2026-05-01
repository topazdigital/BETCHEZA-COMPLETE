"use client"

import { useState, useMemo } from "react"
import { Radio, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { MatchCardNew } from "@/components/matches/match-card-new"
import { ALL_SPORTS, getSportIcon } from "@/lib/sports-data"
import { useLiveMatches } from "@/lib/hooks/use-matches"
import { FlagIcon } from "@/components/ui/flag-icon"
import { FavoritedTipsPanel } from "@/components/home/favorited-tips-panel"
import { BestBetsPanel } from "@/components/home/best-bets-panel"

// Priority order for sports (football first, then by popularity)
const SPORT_PRIORITY: Record<number, number> = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 27: 8, 26: 9, 29: 10, 33: 11,
}

export default function LivePage() {
  const { matches, isLoading, error } = useLiveMatches()
  const [selectedSport, setSelectedSport] = useState<number | null>(null)

  const filteredMatches = selectedSport
    ? matches.filter(m => m.sportId === selectedSport)
    : matches

  // Sport tabs (only sports with live matches)
  const sportCounts = useMemo(() => {
    const counts = ALL_SPORTS.map(sport => ({
      ...sport,
      icon: getSportIcon(sport.slug),
      count: matches.filter(m => m.sportId === sport.id).length,
    })).filter(s => s.count > 0)
    return counts.sort((a, b) => (SPORT_PRIORITY[a.id] ?? 99) - (SPORT_PRIORITY[b.id] ?? 99))
  }, [matches])

  // Group matches by league with metadata
  const groupedMatches = useMemo(() => {
    const groups: Record<string, {
      leagueName: string
      country: string
      countryCode?: string
      sportSlug: string
      matches: typeof matches
    }> = {}
    filteredMatches.forEach(match => {
      const leagueName = match.league?.name || 'Other'
      const key = `${match.sportId}-${leagueName}`
      if (!groups[key]) {
        groups[key] = {
          leagueName,
          country: match.league?.country || '',
          countryCode: match.league?.countryCode,
          sportSlug: match.sport?.slug || 'football',
          matches: [],
        }
      }
      groups[key].matches.push(match)
    })
    // Sort: football first, more matches first
    return Object.values(groups).sort((a, b) => {
      if (a.sportSlug === 'football' && b.sportSlug !== 'football') return -1
      if (b.sportSlug === 'football' && a.sportSlug !== 'football') return 1
      return b.matches.length - a.matches.length
    })
  }, [filteredMatches])

  const totalLive = matches.length
  const totalPredictions = matches.reduce((acc, m) => acc + (m.tipsCount || 0), 0)
  const totalWatching = totalPredictions * 10

  return (
    <div className="flex min-h-0 flex-1">
      {/* LEFT SIDEBAR — Favorited Tips (lg+) */}
      <aside className="hidden lg:block w-64 xl:w-72 shrink-0 border-r border-border">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
          <FavoritedTipsPanel />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="px-3 py-3 md:px-5 md:py-4">
          {/* Compact Header */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-live"></span>
              </span>
              <h1 className="text-lg font-bold">Live</h1>
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold">{totalLive}</Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" />
              <span className="tabular-nums">{totalWatching.toLocaleString()} watching</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline tabular-nums">{totalPredictions} tips</span>
            </div>
          </div>

          {/* Sport Filter Pills */}
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            <Button
              variant={selectedSport === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSport(null)}
              className="shrink-0 h-7 text-[11px] px-2.5"
            >
              All
              <Badge variant="secondary" className="ml-1.5 h-3.5 px-1 text-[9px] font-bold">{matches.length}</Badge>
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
                <Badge variant="secondary" className="h-3.5 px-1 text-[9px] font-bold">{sport.count}</Badge>
              </Button>
            ))}
          </div>

          {/* Live Matches grouped by league */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex items-center gap-3">
                <Spinner className="h-8 w-8" />
                <span className="text-muted-foreground text-sm">Loading live matches…</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
              <Radio className="mb-2 h-8 w-8 text-muted-foreground" />
              <h1 className="text-base font-bold">Unable to load live matches</h1>
              <p className="mt-1 text-xs text-muted-foreground">Please try again later</p>
            </div>
          ) : groupedMatches.length > 0 ? (
            <div className="space-y-2.5">
              {groupedMatches.map(group => (
                <section key={`${group.sportSlug}-${group.leagueName}`} className="overflow-hidden rounded-xl border border-border bg-card">
                  {/* League header row */}
                  <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-sm leading-none">{getSportIcon(group.sportSlug)}</span>
                      {group.countryCode && (
                        <FlagIcon countryCode={group.countryCode} size="sm" />
                      )}
                      <h2 className="truncate text-[11px] font-bold uppercase tracking-tight">{group.leagueName}</h2>
                      {group.country && (
                        <span className="hidden text-[10px] text-muted-foreground sm:inline">· {group.country}</span>
                      )}
                    </div>
                    <Badge variant="destructive" className="h-4.5 gap-1 px-1 text-[9px] font-bold">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white"></span>
                      </span>
                      {group.matches.length}
                    </Badge>
                  </header>
                  {/* Match rows */}
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
              <Radio className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-base font-semibold">
                {selectedSport ? "No live matches in this sport" : "Nothing live right now"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                We poll the feeds every 20s — anything that kicks off will pop up here automatically.
              </p>
              <div className="mt-3 flex gap-2">
                {selectedSport && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSelectedSport(null)}>
                    See all sports
                  </Button>
                )}
                <Button size="sm" className="h-8 text-xs" asChild>
                  <a href="/matches">Upcoming matches</a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR — Best Bets (xl+) */}
      <aside className="hidden xl:block w-72 shrink-0 border-l border-border">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
          <BestBetsPanel matches={matches} />
        </div>
      </aside>
    </div>
  )
}
