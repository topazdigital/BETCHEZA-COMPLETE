"use client"

import { use, useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import { format } from "date-fns"
import { 
  ArrowLeft, Check, Star, Users, TrendingUp, Target, Flame, 
  Calendar, MapPin, Trophy, ChevronRight, ExternalLink,
  BarChart3, Activity, Clock, BadgeCheck, MinusCircle, Zap, Award, ShieldCheck, Medal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { matchToSlug } from "@/lib/utils/match-url"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { FollowTipsterButton } from "@/components/tipsters/follow-tipster-button"
import { useRouter } from "next/navigation"
import { CreditCard, Loader2 } from "lucide-react"

interface PageProps {
  params: Promise<{ id: string }>
}

// Tiny dependency-free SVG sparkline for tipster ROI trend.
function RoiSparkline({
  data,
  finalRoi,
  totalTips,
  className = "",
  height = 140,
}: {
  data?: { day: number; roi: number }[]
  finalRoi: number
  totalTips?: number
  className?: string
  height?: number
}) {
  if (!data || data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center bg-muted/30 rounded-lg text-sm text-muted-foreground">
        Not enough data yet.
      </div>
    )
  }
  const w = 600
  const h = height
  const pad = 12
  const xs = data.map((_, i) => pad + (i * (w - pad * 2)) / (data.length - 1))
  const ys = data.map(d => d.roi)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 1)
  const range = Math.max(0.5, maxY - minY)
  const ny = (v: number) => h - pad - ((v - minY) / range) * (h - pad * 2)

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ny(ys[i]).toFixed(1)}`).join(' ')
  const fill = `${path} L${xs[xs.length - 1].toFixed(1)},${(h - pad).toFixed(1)} L${xs[0].toFixed(1)},${(h - pad).toFixed(1)} Z`
  const positive = finalRoi >= 0
  const stroke = positive ? "hsl(var(--success, 142 76% 36%))" : "hsl(var(--destructive, 0 84% 60%))"
  const fillCol = positive ? "url(#roi-grad-pos)" : "url(#roi-grad-neg)"
  const zeroY = ny(0)

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="roi-grad-pos" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="roi-grad-neg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(239 68 68)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(239 68 68)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {minY < 0 && maxY > 0 && (
          <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY}
            strokeDasharray="4 4" stroke="currentColor" className="text-muted-foreground/40" strokeWidth="1" />
        )}
        <path d={fill} fill={fillCol} />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ny(ys[i])} r={i === xs.length - 1 ? 3.5 : 2}
            fill={stroke} />
        ))}
      </svg>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Day 1: <span className="font-semibold text-foreground">{ys[0]}%</span></span>
        <span className={cn("font-semibold", positive ? "text-success" : "text-destructive")}>
          {positive ? "+" : ""}{finalRoi}% ROI
        </span>
        {typeof totalTips === "number" && (
          <span>{totalTips} total tips</span>
        )}
      </div>
    </div>
  )
}

function SubscribeButton({ tipsterId, tipsterName, price, currency }: {
  tipsterId: number
  tipsterName: string
  price: number
  currency: string
}) {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    if (!isAuthenticated) {
      router.push('/login?next=' + encodeURIComponent(window.location.pathname))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/tipsters/${tipsterId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipsterId, tipsterName, price, currency }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Subscription failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs text-success border-success/40" disabled>
        <Check className="mr-1 h-3 w-3" /> Subscribed!
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSubscribe} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CreditCard className="mr-1 h-3 w-3" />}
        Subscribe {currency} {price}/mo
      </Button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  )
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function TipsterProfilePage({ params }: PageProps) {
  const { id } = use(params)
  const { isAuthenticated } = useAuth()
  const [isFollowing, setIsFollowing] = useState(false)
  const [activeTab, setActiveTab] = useState("tips")
  const [followerDelta, setFollowerDelta] = useState(0)
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/tipsters/${id}`,
    fetcher
  )

  const { data: compsData } = useSWR<{
    competitions: Array<{
      id: number
      slug: string
      name: string
      type: string
      status: string
      startDate: string
      endDate: string
      rank: number | null
      points: number | null
      tips: number | null
      winRate: number | null
      prizePool: number
      currency: string
      prizes: Array<{ place: string; amount: number }>
      entryFee: number
    }>
  }>(
    activeTab === "competitions" ? `/api/tipsters/${id}/competitions` : null,
    fetcher,
  )
  
  if (isLoading) {
    return (
      <div className="flex-1 flex h-96 items-center justify-center">
        <div className="flex items-center gap-3">
          <Spinner className="h-8 w-8" />
          <span className="text-muted-foreground">Loading tipster profile...</span>
        </div>
      </div>
    )
  }
  
  if (error || !data?.tipster) {
    return (
      <div className="flex-1 p-8 text-center">
        <h1 className="text-2xl font-bold">Tipster not found</h1>
        <p className="text-muted-foreground mt-2">The tipster you&apos;re looking for doesn&apos;t exist.</p>
        <Button asChild className="mt-4">
          <Link href="/tipsters">Back to Tipsters</Link>
        </Button>
      </div>
    )
  }
  
  const { tipster, recentTips, monthlyStats, sportBreakdown, marketBreakdown, roiSparkline } = data as {
    tipster: typeof data.tipster
    recentTips?: typeof data.recentTips
    monthlyStats?: typeof data.monthlyStats
    sportBreakdown?: typeof data.sportBreakdown
    marketBreakdown?: { market: string; won: number; lost: number; total: number; winRate: number }[]
    roiSparkline?: { day: number; roi: number }[]
  }
  
  return (
    <div className="flex-1 overflow-hidden">
      <div className="px-3 py-4 pb-24 md:pb-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs" asChild>
          <Link href="/tipsters">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to Tipsters
          </Link>
        </Button>
        
        {/* Profile Header Card */}
        <Card className="mb-4 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-transparent p-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground overflow-hidden">
                  {tipster.avatar ? (
                    <img src={tipster.avatar} alt={tipster.displayName} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    tipster.displayName.charAt(0)
                  )}
                </div>
                {tipster.rank <= 3 && (
                  <div className={cn(
                    "absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    tipster.rank === 1 && "bg-yellow-500 text-yellow-950",
                    tipster.rank === 2 && "bg-gray-300 text-gray-700",
                    tipster.rank === 3 && "bg-amber-700 text-amber-100"
                  )}>
                    #{tipster.rank}
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <h1 className="text-lg font-bold">{tipster.displayName}</h1>
                  {tipster.verified && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </span>
                  )}
                  {tipster.isPro && (
                    <Badge className="h-4 bg-gradient-to-r from-primary to-primary/80 text-[10px] px-1.5">
                      <Star className="mr-1 h-3 w-3" />
                      PRO
                    </Badge>
                  )}
                  {tipster.performanceVerified && (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-600">
                      <ShieldCheck className="h-3 w-3" />
                      Performance Verified
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground mb-1.5">@{tipster.username}</p>
                
                <p className="text-xs text-foreground/80 mb-3 max-w-2xl">
                  {tipster.bio}
                </p>
                
                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {tipster.country}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {format(new Date(tipster.joinedAt), "MMM yyyy")}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {(tipster.followers + followerDelta).toLocaleString()} followers
                  </div>
                </div>
                
                {/* Specialties */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {tipster.specialties.map((spec: string) => (
                    <Badge key={spec} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {spec}
                    </Badge>
                  ))}
                </div>
                
                {/* Actions */}
                <div className="flex flex-wrap gap-1.5">
                  <FollowTipsterButton
                    tipsterId={tipster.id}
                    tipsterName={tipster.displayName}
                    onFollowChange={(following) => {
                      setIsFollowing(following)
                      setFollowerDelta(d => d + (following ? 1 : -1))
                      setTimeout(() => mutate(), 1500)
                    }}
                    size="sm"
                    className="h-7 text-xs"
                  />

                  {tipster.isPro && tipster.subscriptionPrice && (
                    <SubscribeButton
                      tipsterId={tipster.id}
                      tipsterName={tipster.displayName}
                      price={tipster.subscriptionPrice}
                      currency={tipster.currency}
                    />
                  )}
                  
                  {tipster.socials?.twitter && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a 
                        href={`https://twitter.com/${tipster.socials.twitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
              <div className="rounded-lg bg-card border border-border p-2 text-center">
                <div className="text-xl font-bold text-success">{tipster.winRate}%</div>
                <div className="text-[11px] uppercase text-muted-foreground">Win Rate</div>
              </div>
              <div className="rounded-lg bg-card border border-border p-2 text-center">
                <div className="text-xl font-bold text-primary">+{tipster.roi}%</div>
                <div className="text-[11px] uppercase text-muted-foreground">ROI</div>
              </div>
              <div className="rounded-lg bg-card border border-border p-2 text-center">
                <div className="text-xl font-bold">{tipster.totalTips}</div>
                <div className="text-[11px] uppercase text-muted-foreground">Total Tips</div>
              </div>
              <div className="rounded-lg bg-card border border-border p-2 text-center">
                <div className="flex items-center justify-center gap-0.5">
                  <div className="text-xl font-bold text-warning">{tipster.streak}</div>
                  {tipster.streak > 0 && <Flame className="h-3.5 w-3.5 text-warning" />}
                </div>
                <div className="text-[11px] uppercase text-muted-foreground">Win Streak</div>
              </div>
              <div className="rounded-lg bg-card border border-border p-2 text-center">
                <div className="text-xl font-bold">{tipster.avgOdds}</div>
                <div className="text-[11px] uppercase text-muted-foreground">Avg Odds</div>
              </div>
              <div className="rounded-lg bg-card border border-border p-2 text-center">
                <div className="text-xl font-bold">#{tipster.rank}</div>
                <div className="text-[11px] uppercase text-muted-foreground">Rank</div>
              </div>
            </div>

            {/* Inline ROI sparkline — quick visual of the trend */}
            {roiSparkline && roiSparkline.length > 1 && (
              <div className="mt-3 rounded-lg bg-card border border-border p-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    ROI · last {roiSparkline.length} days
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold",
                    tipster.roi >= 0 ? "text-success" : "text-destructive",
                  )}>
                    {tipster.roi >= 0 ? "+" : ""}{tipster.roi}%
                  </span>
                </div>
                <RoiSparkline data={roiSparkline} finalRoi={tipster.roi} height={40} />
              </div>
            )}
          </div>
        </Card>

        {/* My Picks Performance Tracker */}
        {recentTips && recentTips.length > 0 && (() => {
          const settled = (recentTips as Array<{ status: string; odds?: number; market?: string; selection?: string; match?: { homeTeam?: string; awayTeam?: string } }>).filter(t => t.status === 'won' || t.status === 'lost');
          const lastTen = settled.slice(0, 10);
          const wonCount = lastTen.filter(t => t.status === 'won').length;
          const lostCount = lastTen.filter(t => t.status === 'lost').length;
          const formPct = lastTen.length > 0 ? Math.round((wonCount / lastTen.length) * 100) : 0;
          // Current streak
          let streakCount = 0;
          let streakType = '';
          for (const t of settled) {
            if (streakCount === 0) { streakType = t.status; streakCount = 1; }
            else if (t.status === streakType) streakCount++;
            else break;
          }
          // ROI from last 10 settled tips (assuming 1 unit stake each)
          const roiLast10 = lastTen.length > 0
            ? Math.round(lastTen.reduce((acc, t) => acc + (t.status === 'won' ? ((t.odds ?? 2) - 1) : -1), 0) / lastTen.length * 100)
            : 0;
          // Best market (most wins)
          const marketWins: Record<string, number> = {};
          for (const t of settled.filter(t => t.status === 'won')) {
            const m = (t.market || t.selection || 'Other') as string;
            marketWins[m] = (marketWins[m] || 0) + 1;
          }
          const bestMarket = Object.entries(marketWins).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

          return (
            <Card className="mb-4 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
              <CardContent className="p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-wide">My Picks · Performance Tracker</h2>
                  <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0 text-[9px] font-semibold text-primary">Last {lastTen.length}</span>
                </div>

                {/* Recent form strip */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium">Recent Form</span>
                    {streakCount > 1 && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[9px] font-bold",
                        streakType === 'won' ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-500",
                      )}>
                        {streakType === 'won' ? <Flame className="h-2.5 w-2.5" /> : <MinusCircle className="h-2.5 w-2.5" />}
                        {streakCount} {streakType === 'won' ? 'W' : 'L'} streak
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {lastTen.map((t, i) => (
                      <span
                        key={i}
                        title={`${(t.match as { homeTeam?: string; awayTeam?: string } | undefined)?.homeTeam ?? ''} ${(t.market || t.selection || '')}`}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded text-[8px] font-black",
                          t.status === 'won' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white",
                        )}
                      >
                        {t.status === 'won' ? 'W' : 'L'}
                      </span>
                    ))}
                    {lastTen.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">No settled picks yet.</span>
                    )}
                  </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-card p-2 text-center">
                    <div className={cn("text-base font-bold leading-tight", formPct >= 55 ? "text-emerald-500" : formPct >= 45 ? "text-amber-500" : "text-rose-500")}>
                      {formPct}%
                    </div>
                    <div className="text-[9px] uppercase text-muted-foreground">Form ({lastTen.length})</div>
                    <div className="mt-1 text-[9px] text-muted-foreground">
                      <span className="text-emerald-500 font-semibold">{wonCount}W</span>
                      {' '}<span className="text-rose-500 font-semibold">{lostCount}L</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card p-2 text-center">
                    <div className={cn("text-base font-bold leading-tight", roiLast10 >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {roiLast10 >= 0 ? '+' : ''}{roiLast10}%
                    </div>
                    <div className="text-[9px] uppercase text-muted-foreground">Avg ROI</div>
                    <div className="mt-1 text-[9px] text-muted-foreground">per unit bet</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card p-2 text-center">
                    <Award className="mx-auto h-3.5 w-3.5 text-amber-500" />
                    <div className="mt-0.5 text-[9px] uppercase text-muted-foreground">Best Market</div>
                    <div className="text-[10px] font-semibold truncate" title={bestMarket ?? '–'}>{bestMarket ?? '–'}</div>
                  </div>
                </div>

                {/* Win rate bar */}
                {lastTen.length > 0 && (
                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Win rate (last {lastTen.length})</span>
                      <span className={cn("font-bold", formPct >= 55 ? "text-emerald-500" : "text-amber-500")}>{formPct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", formPct >= 55 ? "bg-emerald-500" : formPct >= 45 ? "bg-amber-500" : "bg-rose-500")}
                        style={{ width: `${formPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="tips" className="text-xs px-1">Recent Tips</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs px-1">Statistics</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs px-1">Performance</TabsTrigger>
            <TabsTrigger value="competitions" className="text-xs px-1">Competitions</TabsTrigger>
          </TabsList>
          
          {/* Tips Tab */}
          <TabsContent value="tips" className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" />
                  Recent Predictions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {recentTips?.map((tip: {
                  id: number;
                  settledByProb?: boolean;
                  match: {
                    homeTeam: string;
                    awayTeam: string;
                    kickoffTime: string;
                    league: string;
                    homeScore: number | null;
                    awayScore: number | null;
                  };
                  market: string;
                  selection: string;
                  odds: number;
                  stake: number;
                  analysis: string;
                  status: 'won' | 'lost' | 'pending' | 'void';
                  confidence: number;
                  likes: number;
                  createdAt: string;
                }) => {
                  // Wrap the tip card in a Link to the match detail page when
                  // the API surfaced a usable match id (skip mock placeholder ids).
                  const rawId = (tip.match as { id?: string }).id ?? null
                  const isReal = !!rawId && !rawId.startsWith('match_')
                  const matchHref = isReal ? `/matches/${matchToSlug(rawId!, tip.match.homeTeam, tip.match.awayTeam)}` : null
                  const Wrapper: React.ElementType = matchHref ? Link : 'div'
                  const wrapperProps = matchHref ? { href: matchHref } : {}
                  return (
                  <Wrapper
                    key={tip.id}
                    {...(wrapperProps as Record<string, unknown>)}
                    className={cn(
                      "block rounded-lg border px-3 py-2 transition-colors",
                      tip.status === 'won' && "border-success/30 bg-success/5",
                      tip.status === 'lost' && "border-destructive/30 bg-destructive/5",
                      tip.status === 'pending' && "border-warning/20 bg-warning/3",
                      tip.status === 'void' && "border-muted-foreground/20 bg-muted/20",
                      matchHref && "hover:border-primary/40 hover:shadow-sm cursor-pointer",
                    )}
                  >
                    {/* Row 1: teams + status badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("font-semibold text-xs truncate", matchHref && "group-hover:text-primary")}>
                        {tip.match.homeTeam} vs {tip.match.awayTeam}
                      </span>
                      <Badge 
                        variant={tip.status === 'won' ? 'default' : tip.status === 'lost' ? 'destructive' : 'secondary'}
                        className={cn(
                          "shrink-0 text-[10px] px-1.5 py-0 h-4",
                          tip.status === 'won' && "bg-success text-success-foreground",
                          tip.status === 'void' && "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {tip.status.toUpperCase()}
                      </Badge>
                    </div>
                    {/* Row 2: league + date */}
                    <div className="text-[10px] text-muted-foreground mb-1">
                      {tip.match.league} · {format(new Date(tip.match.kickoffTime), "dd MMM HH:mm")}
                    </div>
                    {/* Row 3: market + pick + odds + score */}
                    <div className="flex items-center gap-1.5 flex-wrap text-xs mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{tip.market}</Badge>
                      <span className="font-medium">{tip.selection}</span>
                      <span className="font-mono text-primary font-bold">@{tip.odds}</span>
                      {tip.status !== 'pending' && !tip.settledByProb && tip.match.homeScore !== null && (
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                          Final: <strong>{tip.match.homeScore}–{tip.match.awayScore}</strong>
                        </span>
                      )}
                    </div>
                    {/* Row 4: analysis (1 line) + open link */}
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-muted-foreground line-clamp-1 flex-1">{tip.analysis}</p>
                      {matchHref && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-primary">
                          Open <ChevronRight className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </Wrapper>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Win/Loss Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Results Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1 text-sm">
                        <span className="text-success">Won</span>
                        <span className="font-bold">{tipster.wonTips}</span>
                      </div>
                      <Progress 
                        value={(tipster.wonTips / tipster.totalTips) * 100} 
                        className="h-2 bg-muted"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1 text-sm">
                        <span className="text-destructive">Lost</span>
                        <span className="font-bold">{tipster.lostTips}</span>
                      </div>
                      <Progress 
                        value={(tipster.lostTips / tipster.totalTips) * 100} 
                        className="h-2 bg-muted [&>div]:bg-destructive"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1 text-sm">
                        <span className="text-warning">Pending</span>
                        <span className="font-bold">{tipster.pendingTips}</span>
                      </div>
                      <Progress 
                        value={(tipster.pendingTips / tipster.totalTips) * 100} 
                        className="h-2 bg-muted [&>div]:bg-warning"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Sport Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5 text-primary" />
                    Sports Focus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sportBreakdown?.map((sport: { sport: string; percentage: number; tips: number }) => (
                      <div key={sport.sport}>
                        <div className="flex justify-between mb-1 text-sm">
                          <span>{sport.sport}</span>
                          <span className="font-bold">{sport.percentage}%</span>
                        </div>
                        <Progress 
                          value={sport.percentage} 
                          className="h-2"
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          {sport.tips} tips
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Prediction Accuracy by Market Type */}
            {marketBreakdown && marketBreakdown.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-5 w-5 text-primary" />
                    Prediction Accuracy by Market
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Historical win rate per betting market — settled tips only
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {marketBreakdown.map((m: { market: string; won: number; lost: number; total: number; winRate: number }) => (
                      <div key={m.market}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{m.market}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {m.won}W / {m.lost}L · {m.total} tips
                            </span>
                          </div>
                          <span className={cn(
                            "text-sm font-bold",
                            m.winRate >= 65 ? "text-success" :
                            m.winRate >= 50 ? "text-primary" :
                            "text-destructive"
                          )}>
                            {m.winRate}%
                          </span>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full transition-all",
                              m.winRate >= 65 ? "bg-success" :
                              m.winRate >= 50 ? "bg-primary" :
                              "bg-destructive"
                            )}
                            style={{ width: `${m.winRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[10px] text-muted-foreground border-t border-border pt-3">
                    Green ≥ 65% · Blue 50–64% · Red &lt; 50% — based on all historically settled picks
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Key Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-5 w-5 text-warning" />
                  Key Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{tipster.avgOdds}</div>
                    <div className="text-xs text-muted-foreground">Average Odds</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{tipster.followers}</div>
                    <div className="text-xs text-muted-foreground">Followers</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{tipster.following}</div>
                    <div className="text-xs text-muted-foreground">Following</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">
                      {Math.round(tipster.totalTips / 12)}
                    </div>
                    <div className="text-xs text-muted-foreground">Tips/Month (Avg)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Monthly Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Month</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Tips</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Won</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Lost</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Win Rate</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyStats?.map((month: {
                        month: string;
                        tips: number;
                        won: number;
                        lost: number;
                        profit: number;
                        winRate: number;
                      }) => (
                        <tr key={month.month} className="border-b last:border-0">
                          <td className="py-3 font-medium">{month.month}</td>
                          <td className="py-3 text-center">{month.tips}</td>
                          <td className="py-3 text-center text-success">{month.won}</td>
                          <td className="py-3 text-center text-destructive">{month.lost}</td>
                          <td className="py-3 text-center">
                            <Badge variant={month.winRate >= 60 ? "default" : "secondary"}>
                              {month.winRate}%
                            </Badge>
                          </td>
                          <td className={cn(
                            "py-3 text-right font-bold",
                            month.profit > 0 ? "text-success" : "text-destructive"
                          )}>
                            {month.profit > 0 ? '+' : ''}{month.profit}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            
            {/* ROI Sparkline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-primary" />
                  ROI Trend (last {(roiSparkline?.length ?? 14)} days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RoiSparkline data={roiSparkline} finalRoi={tipster.roi} totalTips={tipster.totalTips} />
              </CardContent>
            </Card>

            {/* Win / Loss History Sparkline */}
            {recentTips && recentTips.length >= 3 && (() => {
              type TipEntry = { status: string; odds?: number }
              const settled = (recentTips as TipEntry[]).filter(t => t.status === 'won' || t.status === 'lost')
              if (settled.length < 3) return null
              // Build cumulative profit points from oldest → newest (slice reverses to get chronological)
              const chrono = [...settled].reverse()
              let cumulative = 0
              const points = chrono.map(t => {
                cumulative += t.status === 'won' ? ((t.odds ?? 2) - 1) : -1
                return Math.round(cumulative * 100) / 100
              })
              const w = 600, h = 80, pad = 8
              const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1))
              const minY = Math.min(...points)
              const maxY = Math.max(...points)
              const range = Math.max(0.5, maxY - minY)
              const ny = (v: number) => h - pad - ((v - minY) / range) * (h - pad * 2)
              const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ny(points[i]).toFixed(1)}`).join(' ')
              const fillD = `${pathD} L${xs[xs.length-1].toFixed(1)},${(h-pad).toFixed(1)} L${xs[0].toFixed(1)},${(h-pad).toFixed(1)} Z`
              const isPositive = cumulative >= 0
              const strokeCol = isPositive ? "#10b981" : "#ef4444"
              const wonCount = settled.filter(t => t.status === 'won').length
              const lostCount = settled.filter(t => t.status === 'lost').length
              const zeroY = ny(0)
              return (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Profit Curve · Last {settled.length} Settled
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="wl-grad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={strokeCol} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={strokeCol} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {minY < 0 && maxY > 0 && (
                        <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY}
                          strokeDasharray="4 4" stroke="currentColor" className="text-muted-foreground/30" strokeWidth="1" />
                      )}
                      <path d={fillD} fill="url(#wl-grad)" />
                      <path d={pathD} fill="none" stroke={strokeCol} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="text-emerald-500 font-semibold">{wonCount}W</span>
                      <span className={cn("font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                        {isPositive ? "+" : ""}{cumulative.toFixed(2)} units
                      </span>
                      <span className="text-rose-500 font-semibold">{lostCount}L</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })()}
          </TabsContent>

          {/* Competitions Tab */}
          <TabsContent value="competitions" className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                  <Trophy className="h-4 w-4 text-warning" />
                  Competition History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {!compsData ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading competition history…
                  </div>
                ) : compsData.competitions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Trophy className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No competition history yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {compsData.competitions.map(comp => {
                      const isActive = comp.status === 'active'
                      const isCompleted = comp.status === 'completed'
                      const topPrize = comp.prizes[0]
                      return (
                        <Link key={comp.id} href={`/competitions/${comp.slug}`} className="block rounded-lg border px-3 py-2 hover:border-primary/40 hover:shadow-sm transition-colors">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-xs truncate">{comp.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge
                                variant={isActive ? 'default' : isCompleted ? 'secondary' : 'outline'}
                                className={cn(
                                  "text-[9px] px-1.5 py-0 h-4",
                                  isActive && "bg-success text-success-foreground",
                                )}
                              >
                                {comp.status.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize">
                                {comp.type}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-1">
                            <span>{format(new Date(comp.startDate), "dd MMM")} – {format(new Date(comp.endDate), "dd MMM yyyy")}</span>
                            <span>Pool: <span className="font-semibold text-foreground">{comp.currency} {comp.prizePool.toLocaleString()}</span></span>
                            {topPrize && <span>1st: <span className="text-warning font-semibold">{comp.currency} {topPrize.amount.toLocaleString()}</span></span>}
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            {comp.rank !== null && (
                              <span className={cn(
                                "inline-flex items-center gap-1 font-bold",
                                comp.rank === 1 && "text-yellow-500",
                                comp.rank === 2 && "text-gray-400",
                                comp.rank === 3 && "text-amber-700",
                                comp.rank > 3 && "text-muted-foreground",
                              )}>
                                <Medal className="h-3 w-3" />
                                #{comp.rank}
                              </span>
                            )}
                            {comp.points !== null && (
                              <span className="text-primary font-semibold">{comp.points} pts</span>
                            )}
                            {comp.tips !== null && (
                              <span className="text-muted-foreground">{comp.tips} tips</span>
                            )}
                            {comp.winRate !== null && (
                              <span className={cn(
                                "font-semibold",
                                comp.winRate >= 60 ? "text-success" : "text-muted-foreground"
                              )}>{comp.winRate}% win</span>
                            )}
                            <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
