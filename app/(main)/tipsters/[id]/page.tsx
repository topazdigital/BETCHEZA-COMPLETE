"use client"

import { use, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { format } from "date-fns"
import { 
  ArrowLeft, Check, Star, Users, TrendingUp, Target, Flame, 
  Calendar, MapPin, Trophy, ChevronRight, ExternalLink,
  BarChart3, Activity, Clock, BadgeCheck, MinusCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { matchIdToSlug } from "@/lib/utils/match-url"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { FollowTipsterButton } from "@/components/tipsters/follow-tipster-button"

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
  
  const { data, error, isLoading } = useSWR(
    `/api/tipsters/${id}`,
    fetcher
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
  
  const { tipster, recentTips, monthlyStats, sportBreakdown, roiSparkline } = data as {
    tipster: typeof data.tipster
    recentTips?: typeof data.recentTips
    monthlyStats?: typeof data.monthlyStats
    sportBreakdown?: typeof data.sportBreakdown
    roiSparkline?: { day: number; roi: number }[]
  }
  
  return (
    <div className="flex-1 overflow-hidden">
      <div className="mx-auto max-w-5xl px-3 py-4 pb-24 md:pb-6">
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
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {tipster.displayName.charAt(0)}
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
                    {tipster.followers.toLocaleString()} followers
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
                    onFollowChange={setIsFollowing}
                    size="sm"
                    className="h-7 text-xs"
                  />

                  {tipster.isPro && tipster.subscriptionPrice && (
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Subscribe {tipster.currency} {tipster.subscriptionPrice}/mo
                    </Button>
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
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="tips" className="text-xs px-2">Recent Tips</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs px-2">Statistics</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs px-2">Performance</TabsTrigger>
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
                  const matchHref = isReal ? `/matches/${matchIdToSlug(rawId!)}` : null
                  const Wrapper: React.ElementType = matchHref ? Link : 'div'
                  const wrapperProps = matchHref ? { href: matchHref } : {}
                  return (
                  <Wrapper
                    key={tip.id}
                    {...(wrapperProps as Record<string, unknown>)}
                    className={cn(
                      "block rounded-lg border p-4 transition-colors",
                      tip.status === 'won' && "border-success/30 bg-success/5",
                      tip.status === 'lost' && "border-destructive/30 bg-destructive/5",
                      tip.status === 'pending' && "border-warning/30 bg-warning/5",
                      tip.status === 'void' && "border-muted-foreground/30 bg-muted/30",
                      matchHref && "hover:border-primary/40 hover:shadow-sm cursor-pointer",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className={cn("font-semibold text-sm", matchHref && "group-hover:text-primary")}>
                          {tip.match.homeTeam} vs {tip.match.awayTeam}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tip.match.league} - {format(new Date(tip.match.kickoffTime), "dd MMM HH:mm")}
                        </div>
                      </div>
                      <Badge 
                        variant={tip.status === 'won' ? 'default' : tip.status === 'lost' ? 'destructive' : 'secondary'}
                        className={cn(
                          "inline-flex items-center gap-1",
                          tip.status === 'won' && "bg-success text-success-foreground",
                          tip.status === 'void' && "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {tip.status === 'void' && <MinusCircle className="h-3 w-3" />}
                        {tip.status.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline">{tip.market}</Badge>
                      <span className="font-medium">{tip.selection}</span>
                      <span className="font-mono text-primary font-bold">@{tip.odds}</span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">{tip.analysis}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Confidence: {tip.confidence}%</span>
                      <span>Stake: {tip.stake}/5</span>
                      {tip.status !== 'pending' && tip.match.homeScore !== null && (
                        <span className="font-mono">
                          Final: <strong>{tip.match.homeScore} - {tip.match.awayScore}</strong>
                          {tip.status === 'void' && ' · push'}
                        </span>
                      )}
                      {matchHref && (
                        <span className="ml-auto inline-flex items-center gap-0.5 text-primary group-hover:underline">
                          Open match <ChevronRight className="h-3 w-3" />
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
