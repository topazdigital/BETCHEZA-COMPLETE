"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import {
  ThumbsUp, MessageSquare, TrendingUp, Filter,
  ChevronDown, ChevronUp, ExternalLink, Trophy, Flame, BookmarkCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { FollowTipsterButton } from "@/components/tipsters/follow-tipster-button"
import { useAuth } from "@/contexts/auth-context"

type Day = "today" | "tomorrow" | "upcoming" | "mine"

interface Tip {
  id: string
  matchId: string
  matchSlug?: string
  homeTeam: string
  awayTeam: string
  league: string
  sport: string
  kickoff: string | null
  prediction: string
  market: string
  odds: number
  confidence: number
  status: "pending" | "won" | "lost" | "void"
  likes: number
  comments: number
  analysis: string
  isPremium: boolean
  createdAt: string
  tipster: {
    id: number
    displayName: string
    username: string
    avatar: string
    countryCode: string
    winRate: number
    roi: number
    totalTips: number
    profit: string
    isPro: boolean
    isVerified: boolean
  }
}

interface TopTipster {
  rank: number
  id: number
  displayName: string
  username: string
  avatar: string
  winRate: number
  totalTips: number
  roi: number
  profit: string
  isPro: boolean
  isVerified: boolean
}

interface FeedData {
  tips: Tip[]
  bestTip: Tip | null
  topTipsters: TopTipster[]
  sports: string[]
  counts: { today: number; tomorrow: number; upcoming: number }
}

const SPORT_ICONS: Record<string, string> = {
  football: "⚽", soccer: "⚽", basketball: "🏀", tennis: "🎾",
  rugby: "🏉", cricket: "🏏", baseball: "⚾", "american football": "🏈",
  "ice hockey": "🏒", volleyball: "🏐", golf: "⛳", boxing: "🥊",
  mma: "🥋", cycling: "🚴", motorsport: "🏎️", swimming: "🏊",
}

function sportIcon(sport: string) {
  return SPORT_ICONS[sport.toLowerCase()] ?? "🏆"
}

function statusColor(status: string) {
  if (status === "won") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
  if (status === "lost") return "bg-rose-500/10 text-rose-600 border-rose-500/30"
  if (status === "void") return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
  return "bg-blue-500/10 text-blue-600 border-blue-500/30"
}

function Avatar({ src, name, size = "md" }: { src: string; name: string; size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false)
  const cls = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs"
  if (!err && src) return (
    <img src={src} alt={name} onError={() => setErr(true)}
      className={cn(cls, "rounded-full object-cover shrink-0")} />
  )
  return (
    <div className={cn(cls, "rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0")}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  )
}

function BestBetCard({ tip }: { tip: Tip }) {
  return (
    <div className="relative rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-background overflow-hidden">
      <div className="flex items-center gap-2 bg-emerald-500 px-3 py-1.5">
        <Trophy className="h-3.5 w-3.5 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">Today's Best Bet</span>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar src={tip.tipster.avatar} name={tip.tipster.displayName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link href={`/tipsters/${tip.tipster.username}`} className="text-sm font-bold hover:text-primary">
                {tip.tipster.displayName}
              </Link>
              {tip.tipster.isPro && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600">PRO</Badge>}
              {tip.tipster.isVerified && <Badge variant="secondary" className="text-[9px] px-1 py-0">✓ Verified</Badge>}
              <span className="text-[10px] text-muted-foreground">Win rate: <strong>{tip.tipster.winRate.toFixed(1)}%</strong></span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              {tip.league} — {tip.kickoff ? format(parseISO(tip.kickoff), "EEE d MMM, HH:mm") : "Today"}
            </p>
            <p className="font-semibold text-sm">{tip.homeTeam} <span className="text-muted-foreground">vs</span> {tip.awayTeam}</p>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-center">
                <div className="text-[10px] text-muted-foreground">{tip.market}</div>
                <div className="text-sm font-black text-primary">{tip.prediction}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-1.5 text-center">
                <div className="text-[10px] text-muted-foreground">Odds</div>
                <div className="text-lg font-black tabular-nums">{tip.odds.toFixed(2)}</div>
              </div>
              <ConfidenceBar value={tip.confidence} />
            </div>
            {tip.analysis && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{tip.analysis}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TipCard({ tip }: { tip: Tip }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors">
      <Link href={`/tipsters/${tip.tipster.username}`} className="shrink-0">
        <Avatar src={tip.tipster.avatar} name={tip.tipster.displayName} size="md" />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/tipsters/${tip.tipster.username}`} className="text-xs font-bold hover:text-primary truncate">
                {tip.tipster.displayName}
              </Link>
              {tip.tipster.isPro && (
                <span className="rounded bg-amber-500/10 px-1 py-px text-[9px] font-bold text-amber-600">PRO</span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {tip.tipster.winRate.toFixed(0)}% win •{" "}
                {tip.tipster.totalTips} tips
              </span>
              <FollowTipsterButton
                tipsterId={tip.tipster.id}
                tipsterName={tip.tipster.displayName}
                variant="pill"
                size="sm"
                className="text-[10px] h-5 px-2 py-0"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {sportIcon(tip.sport)} {tip.league}
              {tip.kickoff && " · " + format(parseISO(tip.kickoff), "HH:mm")}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusColor(tip.status))}>
              {tip.status}
            </Badge>
          </div>
        </div>

        <Link href={`/matches/${tip.matchSlug || tip.matchId}`} className="group mt-1 block">
          <p className="text-xs font-semibold group-hover:text-primary">
            {tip.homeTeam} <span className="text-muted-foreground font-normal">vs</span> {tip.awayTeam}
          </p>
        </Link>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded bg-primary/8 px-2 py-0.5">
            <span className="text-[10px] text-muted-foreground">{tip.market}</span>
            <span className="text-xs font-bold text-primary">{tip.prediction}</span>
          </div>
          <div className="rounded bg-muted px-2 py-0.5">
            <span className="text-xs font-black tabular-nums">{tip.odds.toFixed(2)}</span>
          </div>
          <ConfidenceBar value={tip.confidence} />
        </div>

        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <button className="flex items-center gap-0.5 hover:text-foreground">
            <ThumbsUp className="h-3 w-3" />{tip.likes}
          </button>
          <button className="flex items-center gap-0.5 hover:text-foreground">
            <MessageSquare className="h-3 w-3" />{tip.comments}
          </button>
          <span className="ml-auto">{format(parseISO(tip.createdAt), "MMM d, HH:mm")}</span>
        </div>
      </div>
    </div>
  )
}

function Filters({
  sports, selectedSport, onSport,
  minOdds, maxOdds, onMinOdds, onMaxOdds,
}: {
  sports: string[]
  selectedSport: string
  onSport: (s: string) => void
  minOdds: string
  maxOdds: string
  onMinOdds: (v: string) => void
  onMaxOdds: (v: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sport</h3>
        <div className="space-y-0.5">
          <button
            onClick={() => onSport("")}
            className={cn(
              "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-left transition-colors",
              !selectedSport ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            🏆 All Sports
          </button>
          {sports.map(s => (
            <button
              key={s}
              onClick={() => onSport(s)}
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-left transition-colors",
                selectedSport === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {sportIcon(s)} {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Odds Range</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] text-muted-foreground">Min</label>
            <input
              type="number" step="0.1" min="1" placeholder="1.00"
              value={minOdds}
              onChange={e => onMinOdds(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Max</label>
            <input
              type="number" step="0.1" min="1" placeholder="Any"
              value={maxOdds}
              onChange={e => onMaxOdds(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StandingsSidebar({ tipsters }: { tipsters: TopTipster[] }) {
  const now = new Date()
  const rangeLabel = `1 ${format(now, "MMM")}–${format(now, "d MMM")}`
  const prizes = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide">Top Tipsters</h3>
          <p className="text-[10px] text-muted-foreground">{rangeLabel}</p>
        </div>
        <Trophy className="h-4 w-4 text-amber-500" />
      </div>

      <div className="space-y-2">
        {tipsters.map((t, i) => (
          <div key={t.id} className="rounded-lg p-2 hover:bg-muted transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm w-5 text-center shrink-0">{prizes[i]}</span>
              <Link href={`/tipsters/${t.username}`} className="h-7 w-7 shrink-0">
                <Avatar src={t.avatar} name={t.displayName} size="sm" />
              </Link>
              <Link href={`/tipsters/${t.username}`} className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-tight">{t.displayName}</p>
                <p className="text-[10px] text-muted-foreground">{t.totalTips} tips · <span className="text-emerald-600 font-bold">{t.winRate.toFixed(0)}%</span></p>
              </Link>
            </div>
            <div className="mt-1.5 ml-14">
              <FollowTipsterButton
                tipsterId={t.id}
                tipsterName={t.displayName}
                variant="pill"
                size="sm"
                className="text-[10px] h-6 w-full px-2"
              />
            </div>
          </div>
        ))}
      </div>

      <Link href="/leaderboard" className="mt-3 flex items-center justify-center gap-1 text-[10px] font-medium text-primary hover:underline">
        View full standings <ExternalLink className="h-2.5 w-2.5" />
      </Link>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-36 w-full rounded-xl" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border p-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface MyTip {
  id: string
  matchId: string
  matchSlug?: string
  homeTeam: string
  awayTeam: string
  league: string
  sport: string
  kickoff: string | null
  prediction: string
  market: string
  odds: number
  stake: number
  confidence: number
  status: string
  analysis: string
  isPremium: boolean
  createdAt: string
}

function MyTipCard({ tip }: { tip: MyTip }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <BookmarkCheck className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/matches/${tip.matchSlug || tip.matchId}`} className="text-xs font-bold hover:text-primary">
              {tip.homeTeam || "Match"} <span className="font-normal text-muted-foreground">vs</span> {tip.awayTeam}
            </Link>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {sportIcon(tip.sport)} {tip.league}
              {tip.kickoff && " · " + format(parseISO(tip.kickoff), "HH:mm")}
            </p>
          </div>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", statusColor(tip.status))}>
            {tip.status}
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded bg-primary/8 px-2 py-0.5">
            <span className="text-[10px] text-muted-foreground">{tip.market}</span>
            <span className="text-xs font-bold text-primary">{tip.prediction}</span>
          </div>
          <div className="rounded bg-muted px-2 py-0.5">
            <span className="text-xs font-black tabular-nums">{tip.odds.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          {format(parseISO(tip.createdAt), "MMM d, HH:mm")}
        </div>
      </div>
    </div>
  )
}

export function TipsFeedClient() {
  const { isAuthenticated } = useAuth()
  const [day, setDay] = useState<Day>("today")
  const [sport, setSport] = useState("")
  const [minOdds, setMinOdds] = useState("")
  const [maxOdds, setMaxOdds] = useState("")
  const [data, setData] = useState<FeedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [myTips, setMyTips] = useState<MyTip[]>([])
  const [myTipsLoading, setMyTipsLoading] = useState(false)

  const fetchFeed = useCallback(async () => {
    if (day === "mine") return
    setLoading(true)
    try {
      const params = new URLSearchParams({ day })
      if (sport) params.set("sport", sport)
      if (minOdds) params.set("minOdds", minOdds)
      if (maxOdds) params.set("maxOdds", maxOdds)
      const res = await fetch(`/api/tips/feed?${params}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error("Failed to load tips feed", e)
    } finally {
      setLoading(false)
    }
  }, [day, sport, minOdds, maxOdds])

  const fetchMyTips = useCallback(async () => {
    if (!isAuthenticated) return
    setMyTipsLoading(true)
    try {
      const res = await fetch("/api/tips/my")
      const json = await res.json()
      setMyTips(json.tips || [])
    } catch { /* ignore */ } finally {
      setMyTipsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { void fetchFeed() }, [fetchFeed])
  useEffect(() => { if (day === "mine") void fetchMyTips() }, [day, fetchMyTips])

  const tabs: { key: Day; label: string; authOnly?: boolean }[] = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "upcoming", label: "Upcoming" },
    { key: "mine", label: "My Tips", authOnly: true },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-xl font-black">Free Betting Tips</h1>
        <p className="text-xs text-muted-foreground">
          Today's best picks from Kenya's top-rated tipsters — updated daily
        </p>
      </div>

      <div className="flex gap-4">
        {/* Left sidebar — desktop filters */}
        <aside className="hidden lg:block w-44 shrink-0 space-y-4">
          {data && (
            <Filters
              sports={data.sports}
              selectedSport={sport}
              onSport={s => { setSport(s) }}
              minOdds={minOdds}
              maxOdds={maxOdds}
              onMinOdds={setMinOdds}
              onMaxOdds={setMaxOdds}
            />
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-3">
          {/* Mobile filter toggle */}
          <div className="lg:hidden">
            <button
              onClick={() => setShowMobileFilters(v => !v)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium"
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {(sport || minOdds || maxOdds) && (
                <span className="rounded-full bg-primary px-1.5 py-px text-[10px] text-primary-foreground">
                  {[sport, minOdds, maxOdds].filter(Boolean).length}
                </span>
              )}
              {showMobileFilters ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
            </button>
            {showMobileFilters && data && (
              <Card className="mt-2">
                <CardContent className="p-3">
                  <Filters
                    sports={data.sports}
                    selectedSport={sport}
                    onSport={s => { setSport(s); setShowMobileFilters(false) }}
                    minOdds={minOdds}
                    maxOdds={maxOdds}
                    onMinOdds={setMinOdds}
                    onMaxOdds={setMaxOdds}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Best Bet */}
          {!loading && data?.bestTip && (
            <BestBetCard tip={data.bestTip} />
          )}

          {/* Tabs */}
          <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto">
            {tabs.filter(t => !t.authOnly || isAuthenticated).map(t => (
              <button
                key={t.key}
                onClick={() => setDay(t.key)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px",
                  day === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {t.key !== "mine" && data && (
                  <span className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-bold",
                    day === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {data.counts[t.key as keyof typeof data.counts] ?? 0}
                  </span>
                )}
                {t.key === "mine" && myTips.length > 0 && (
                  <span className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-bold",
                    day === "mine" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {myTips.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* My Tips tab content */}
          {day === "mine" && (
            myTipsLoading ? <LoadingSkeleton /> : myTips.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 text-center">
                <BookmarkCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold">No tips submitted yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Browse matches and add your picks to see them here
                </p>
                <Link href="/matches">
                  <Button size="sm" className="mt-4">Browse Matches</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Your <strong>{myTips.length}</strong> submitted tip{myTips.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="space-y-2">
                  {myTips.map(tip => (
                    <MyTipCard key={tip.id} tip={tip} />
                  ))}
                </div>
              </>
            )
          )}

          {/* Regular feed tab content */}
          {day !== "mine" && (
            loading ? (
              <LoadingSkeleton />
            ) : !data || data.tips.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 text-center">
                <p className="text-sm font-semibold">No tips for {day}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try switching tabs or adjusting your filters
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <p className="text-xs text-muted-foreground">
                    Showing <strong>{data.tips.length}</strong> tips
                    {sport && <> for <strong>{sport}</strong></>}
                  </p>
                </div>
                <div className="space-y-2">
                  {data.tips.map(tip => (
                    <TipCard key={tip.id} tip={tip} />
                  ))}
                </div>
              </>
            )
          )}
        </main>

        {/* Right sidebar — standings */}
        <aside className="hidden xl:block w-52 shrink-0">
          <div className="sticky top-16 space-y-4">
            {data?.topTipsters && data.topTipsters.length > 0 && (
              <StandingsSidebar tipsters={data.topTipsters} />
            )}
            <Card>
              <CardContent className="p-3 text-center space-y-1">
                <TrendingUp className="h-5 w-5 text-primary mx-auto" />
                <p className="text-xs font-bold">Become a Tipster</p>
                <p className="text-[10px] text-muted-foreground">Share picks, build a following, earn prizes</p>
                <Link href="/become-tipster">
                  <Button size="sm" className="w-full mt-1 h-7 text-xs">Get started</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  )
}
