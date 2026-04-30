"use client"

import useSWR from "swr"
import Link from "next/link"
import { Star, ChevronRight, Sparkles, BadgeCheck, TrendingUp, Pin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TeamLogo } from "@/components/ui/team-logo"
import { cn } from "@/lib/utils"
import { matchIdToSlug } from "@/lib/utils/match-url"

export interface FeaturedItem {
  matchId: string
  pinned: boolean
  match: {
    id: string
    homeTeam: { name: string; shortName?: string; logo?: string }
    awayTeam: { name: string; shortName?: string; logo?: string }
    kickoffTime: string
    status: string
    league: { name: string; country?: string }
    sport: { name: string; slug: string }
  }
  tip: {
    tipster: { id: string; displayName: string; rank: number; isPremium: boolean; verified: boolean }
    prediction: string
    market: string
    odds: number
    confidence: number
  }
}

interface FeaturedResponse {
  enabled: boolean
  items: FeaturedItem[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

/**
 * SWR hook used by both the standalone panel AND the live-row marquee
 * injection so they share a cache and don't double-fetch.
 */
export function useFavoritedTips() {
  const { data, error, isLoading } = useSWR<FeaturedResponse>(
    "/api/featured",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  )
  return {
    items: data?.enabled && Array.isArray(data?.items) ? data.items : [],
    isLoading,
    error,
  }
}

export function FavoritedTipsPanel() {
  const { data, error, isLoading } = useSWR<FeaturedResponse>("/api/featured", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  })

  if (error || isLoading) return null
  if (!data?.enabled || !data.items?.length) return null

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-bold text-foreground">Favorited Tips</h2>
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
            {data.items.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/matches?status=scheduled">
            More games
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Hand-picked tips while there&apos;s a lull in live action.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map(item => (
          <FavoritedTipCard key={item.matchId} item={item} />
        ))}
      </div>
    </section>
  )
}

/**
 * Marquee-friendly variant of the tip card. Used inline inside the Live Now
 * scroller so featured tips show alongside live matches with the same height
 * and width when there's a lull in live action (1-3 live games).
 */
export function FavoritedTipMarqueeCard({ item }: { item: FeaturedItem }) {
  const { match, tip, pinned } = item
  const t = new Date(match.kickoffTime)
  const time = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const day = t.toDateString() === new Date().toDateString()
    ? "Today"
    : t.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })

  const confColor =
    tip.confidence >= 80 ? "text-emerald-500" :
    tip.confidence >= 65 ? "text-amber-500" :
    "text-rose-400"

  return (
    <Link
      href={`/matches/${matchIdToSlug(match.id)}`}
      className={cn(
        // Match the live cards' height by giving the card a minimum height
        // close to MatchCardNew's typical render. The flex column lets the
        // tip box anchor at the bottom.
        "group flex h-full min-h-[200px] flex-col rounded-xl border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-md",
        pinned ? "border-amber-500/50" : "border-amber-500/30",
      )}
    >
      {/* Top label — clearly identifies this is a featured tip, not a live match */}
      <div className="mb-2 flex items-center justify-between">
        <Badge className="h-5 gap-1 bg-gradient-to-r from-amber-500/20 to-amber-500/10 text-amber-600 border border-amber-500/40 dark:text-amber-400 hover:from-amber-500/20 hover:to-amber-500/10 px-1.5 text-[10px] uppercase tracking-wide">
          <Star className="h-2.5 w-2.5 fill-amber-500" /> Featured Tip
        </Badge>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          {pinned && <Pin className="h-3 w-3 text-amber-500" />}
          {time} · {day}
        </span>
      </div>

      {/* League */}
      <p className="mb-2 truncate text-[11px] text-muted-foreground">{match.league.name}</p>

      {/* Teams */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} size="sm" />
          <span className="text-sm font-semibold text-foreground group-hover:text-primary truncate">
            {match.homeTeam.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} size="sm" />
          <span className="text-sm font-semibold text-foreground group-hover:text-primary truncate">
            {match.awayTeam.name}
          </span>
        </div>
      </div>

      {/* Tip box anchored at bottom */}
      <div className="mt-auto rounded-lg border border-border bg-muted/40 p-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{tip.market}</span>
          <span className={cn("text-xs font-bold", confColor)}>{tip.confidence}%</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate flex items-center gap-1 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{tip.prediction}</span>
          </span>
          <span className="text-sm font-bold text-primary flex items-center gap-1 shrink-0">
            <TrendingUp className="h-3.5 w-3.5" />
            {tip.odds.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            {tip.tipster.displayName}
            {tip.tipster.verified && <BadgeCheck className="h-3 w-3 text-primary" />}
          </span>
          <span>#{tip.tipster.rank}</span>
        </div>
      </div>
    </Link>
  )
}

function FavoritedTipCard({ item }: { item: FeaturedItem }) {
  const { match, tip, pinned } = item
  const t = new Date(match.kickoffTime)
  const time = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const day = t.toDateString() === new Date().toDateString()
    ? "Today"
    : t.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })

  const confColor =
    tip.confidence >= 80 ? "text-emerald-500" :
    tip.confidence >= 65 ? "text-amber-500" :
    "text-muted-foreground"

  return (
    <Link
      href={`/matches/${matchIdToSlug(match.id)}`}
      className={cn(
        "group block rounded-xl border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-md",
        pinned ? "border-amber-500/50" : "border-border",
      )}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{match.league.name}</span>
        <span className="flex items-center gap-1 shrink-0">
          {pinned && <Pin className="h-3 w-3 text-amber-500" />}
          {time} · {day}
        </span>
      </div>
      <div className="mb-3 space-y-0.5">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate">
          {match.homeTeam.name}
        </p>
        <p className="text-xs text-muted-foreground">vs</p>
        <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate">
          {match.awayTeam.name}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{tip.market}</span>
          <span className={cn("text-xs font-bold", confColor)}>{tip.confidence}%</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            {tip.prediction}
          </span>
          <span className="text-sm font-bold text-primary flex items-center gap-1 shrink-0">
            <TrendingUp className="h-3.5 w-3.5" />
            {tip.odds.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            {tip.tipster.displayName}
            {tip.tipster.verified && <BadgeCheck className="h-3 w-3 text-primary" />}
          </span>
          <span>#{tip.tipster.rank}</span>
        </div>
      </div>
    </Link>
  )
}
