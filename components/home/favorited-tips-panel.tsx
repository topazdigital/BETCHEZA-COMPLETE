"use client"

import useSWR from "swr"
import Link from "next/link"
import {
  Star, ChevronRight, Sparkles, BadgeCheck, TrendingUp, Pin,
  Target, Clock, CheckCircle2, XCircle, Minus, PenLine,
} from "lucide-react"
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

function ConfidenceDot({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("h-1.5 w-1.5 rounded-full",
        value >= 80 ? "bg-emerald-500" : value >= 65 ? "bg-amber-500" : "bg-rose-400"
      )} />
      <span className={cn("text-[10px] font-medium",
        value >= 80 ? "text-emerald-500" : value >= 65 ? "text-amber-500" : "text-rose-400"
      )}>
        {value >= 80 ? "High" : value >= 65 ? "Med" : "Low"} · {value}%
      </span>
    </div>
  )
}

function FavoritedTipCard({ item }: { item: FeaturedItem }) {
  const { match, tip, pinned } = item
  const t = new Date(match.kickoffTime)
  const isToday = t.toDateString() === new Date().toDateString()
  const timeLabel = isToday
    ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : t.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })

  return (
    <Link
      href={`/matches/${matchIdToSlug(match.id)}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200",
        "hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5",
        pinned ? "border-amber-400/60" : "border-border",
      )}
    >
      {pinned && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
      )}

      <div className="flex items-center justify-between px-3 pt-2.5 pb-0">
        <span className="truncate text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {match.league.name}
        </span>
        <span className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />{timeLabel}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} size="sm" />
          <span className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} size="sm" />
          <span className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
        </div>
      </div>

      <div className="mx-3 h-px bg-border/60" />

      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-[12px] font-bold text-foreground truncate">{tip.prediction}</span>
          </div>
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-black text-primary font-mono">
            {tip.odds.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{tip.market}</span>
          <ConfidenceDot value={tip.confidence} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-muted/30 px-3 py-1.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
          <Target className="h-3 w-3 shrink-0" />
          {tip.tipster.displayName}
          {tip.tipster.verified && <BadgeCheck className="h-3 w-3 text-primary shrink-0" />}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">#{tip.tipster.rank}</span>
      </div>
    </Link>
  )
}

export function FavoritedTipsPanel() {
  const { data, error, isLoading } = useSWR<FeaturedResponse>("/api/featured", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  })

  if (error || isLoading) return null
  if (!data?.enabled || !data.items?.length) return null

  return (
    <section className="mb-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500/50" />
          </div>
          <h2 className="text-sm font-bold text-foreground">Favorited Tips</h2>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400">
            {data.items.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" asChild>
          <Link href="/matches?status=scheduled">
            More <ChevronRight className="ml-0.5 h-3 w-3" />
          </Link>
        </Button>
      </div>
      <div className="space-y-2">
        {data.items.slice(0, 5).map(item => (
          <FavoritedTipCard key={item.matchId} item={item} />
        ))}
      </div>
    </section>
  )
}

interface MyTip {
  id: string
  matchId: string
  matchSlug: string
  prediction: string
  market: string
  odds: number
  confidence: number
  status: string
  createdAt: string
}

interface MyTipsResponse {
  tips: MyTip[]
  authenticated: boolean
}

function StatusIcon({ status }: { status: string }) {
  if (status === "won") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (status === "lost") return <XCircle className="h-3.5 w-3.5 text-rose-500" />
  if (status === "void") return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  return <Clock className="h-3.5 w-3.5 text-amber-500" />
}

function MyTipRow({ tip }: { tip: MyTip }) {
  const ago = (() => {
    const diff = Date.now() - new Date(tip.createdAt).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  })()

  return (
    <Link
      href={`/matches/${tip.matchSlug}`}
      className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 transition-all hover:border-primary/40 hover:bg-muted/40"
    >
      <StatusIcon status={tip.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-foreground group-hover:text-primary transition-colors">
          {tip.prediction}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">{tip.market}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-black font-mono text-primary">{tip.odds.toFixed(2)}</p>
        <p className="text-[9px] text-muted-foreground">{ago}</p>
      </div>
    </Link>
  )
}

export function MyTipsPanel() {
  const { data, isLoading } = useSWR<MyTipsResponse>("/api/tips/my", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })

  if (isLoading || !data?.authenticated || !data.tips?.length) return null

  return (
    <section className="mb-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <PenLine className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-bold text-foreground">My Tips</h2>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {data.tips.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" asChild>
          <Link href="/dashboard">
            View all <ChevronRight className="ml-0.5 h-3 w-3" />
          </Link>
        </Button>
      </div>
      <div className="space-y-1.5">
        {data.tips.slice(0, 5).map(tip => (
          <MyTipRow key={tip.id} tip={tip} />
        ))}
      </div>
    </section>
  )
}

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
        "group flex h-full min-h-[200px] flex-col rounded-xl border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-md",
        pinned ? "border-amber-500/50" : "border-amber-500/30",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <Badge className="h-5 gap-1 bg-gradient-to-r from-amber-500/20 to-amber-500/10 text-amber-600 border border-amber-500/40 dark:text-amber-400 hover:from-amber-500/20 hover:to-amber-500/10 px-1.5 text-[10px] uppercase tracking-wide">
          <Star className="h-2.5 w-2.5 fill-amber-500" /> Featured Tip
        </Badge>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          {pinned && <Pin className="h-3 w-3 text-amber-500" />}
          {time} · {day}
        </span>
      </div>
      <p className="mb-2 truncate text-[11px] text-muted-foreground">{match.league.name}</p>
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} size="sm" />
          <span className="text-sm font-semibold text-foreground group-hover:text-primary truncate">{match.homeTeam.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} size="sm" />
          <span className="text-sm font-semibold text-foreground group-hover:text-primary truncate">{match.awayTeam.name}</span>
        </div>
      </div>
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
