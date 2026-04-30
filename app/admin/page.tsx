"use client"

import useSWR from "swr"
import {
  Users, Trophy, Calendar, TrendingUp, Target, Eye,
  Activity, ArrowUpRight, ArrowDownRight, MessageSquare,
  CheckCircle2, XCircle, Clock, Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { tipsterHref } from "@/lib/utils/slug"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users,
  trophy: Trophy,
  calendar: Calendar,
  trending: TrendingUp,
  target: Target,
  eye: Eye,
}

const ICON_COLORS: Record<string, { color: string; bg: string }> = {
  users: { color: "text-blue-500", bg: "bg-blue-500/10" },
  trophy: { color: "text-amber-500", bg: "bg-amber-500/10" },
  calendar: { color: "text-emerald-500", bg: "bg-emerald-500/10" },
  trending: { color: "text-purple-500", bg: "bg-purple-500/10" },
  target: { color: "text-green-500", bg: "bg-green-500/10" },
  eye: { color: "text-pink-500", bg: "bg-pink-500/10" },
}

interface DashboardStat {
  title: string
  value: string
  change: string
  trend: "up" | "down"
  icon: keyof typeof ICONS
}

interface RecentUser {
  id: number
  name: string
  email: string
  avatar: string
  joined: string
  status: string
  role: string
  isFake: boolean
}

interface RecentPrediction {
  id: string
  tipster: string
  tipsterId: number
  match: string
  matchId: string
  prediction: string
  odds: string
  status: "won" | "lost" | "pending" | "void"
}

interface TopTipster {
  rank: number
  id: number
  name: string
  username: string
  avatar: string
  winRate: number
  roi: number
  profit: string
  predictions: number
}

interface LiveActivity {
  action: string
  user: string
  time: string
}

interface DashboardData {
  stats: DashboardStat[]
  recentUsers: RecentUser[]
  recentPredictions: RecentPrediction[]
  topTipsters: TopTipster[]
  liveActivity: LiveActivity[]
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error("Failed")
  return r.json()
})

export default function AdminDashboard() {
  const { data, isLoading, error } = useSWR<DashboardData>(
    "/api/admin/dashboard",
    fetcher,
    { refreshInterval: 30_000 }
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        Could not load dashboard data. Please refresh the page.
      </div>
    )
  }

  const { stats, recentUsers, recentPredictions, topTipsters, liveActivity } = data

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Live overview — real users + tipster catalogue.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/users" className="text-xs">Users</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/tipsters" className="text-xs">Tipsters</Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = ICONS[stat.icon] || Users
          const tone = ICON_COLORS[stat.icon] || { color: "text-blue-500", bg: "bg-blue-500/10" }
          return (
            <Card key={stat.title}>
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone.bg}`}>
                    <Icon className={`h-4 w-4 ${tone.color}`} />
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 text-[10px] px-1.5",
                      stat.trend === "up" ? "border-emerald-500 text-emerald-500" : "border-red-500 text-red-500"
                    )}
                  >
                    {stat.trend === "up" ? <ArrowUpRight className="mr-0.5 h-2.5 w-2.5" /> : <ArrowDownRight className="mr-0.5 h-2.5 w-2.5" />}
                    {stat.change}
                  </Badge>
                </div>
                <div className="mt-2">
                  <p className="text-lg font-bold leading-none">{stat.value}</p>
                  <p className="text-[11px] uppercase text-muted-foreground mt-1">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        {/* Recent Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-2 pb-1.5 px-3">
            <CardTitle className="text-sm font-semibold">Recent Users</CardTitle>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-1.5">
              {recentUsers.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No users yet.</p>
              )}
              {recentUsers.map((user) => (
                <div key={`${user.isFake ? "f" : "r"}-${user.id}`} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full bg-muted" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium flex items-center gap-1.5 truncate">
                        {user.name}
                        {user.isFake && (
                          <Badge variant="outline" className="text-[9px] h-4 border-purple-500/40 text-purple-500 px-1">FAKE</Badge>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={user.status === "active" ? "default" : "secondary"} className="h-4 text-[9px] px-1">
                      {user.status}
                    </Badge>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{user.joined}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Predictions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-2 pb-1.5 px-3">
            <CardTitle className="text-sm font-semibold">Recent Predictions</CardTitle>
            <Link href="/admin/predictions">
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-1">
              {recentPredictions.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No predictions yet — open a few matches to seed the tipster feed.
                </p>
              )}
              {recentPredictions.map((pred) => (
                <Link
                  key={pred.id}
                  href={`/matches/${pred.matchId}`}
                  className="flex items-center justify-between rounded-md p-1.5 px-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{pred.match}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {pred.tipster} - {pred.prediction} @ {pred.odds}
                    </p>
                  </div>
                  <Badge
                    variant={pred.status === "won" ? "default" : pred.status === "lost" ? "destructive" : "secondary"}
                    className={cn("h-4 text-[9px] px-1", pred.status === "won" ? "bg-emerald-500" : "")}
                  >
                    {pred.status === "won" && <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />}
                    {pred.status === "lost" && <XCircle className="mr-0.5 h-2.5 w-2.5" />}
                    {pred.status === "pending" && <Clock className="mr-0.5 h-2.5 w-2.5" />}
                    {pred.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Tipsters & Quick Actions */}
      <div className="grid gap-2.5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between py-2 pb-1.5 px-3">
            <CardTitle className="text-sm font-semibold">Top Tipsters</CardTitle>
            <Link href="/admin/tipsters">
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                    <th className="pb-2 font-medium">Rank</th>
                    <th className="pb-2 font-medium">Tipster</th>
                    <th className="pb-2 font-medium">Win Rate</th>
                    <th className="pb-2 font-medium">ROI</th>
                    <th className="pb-2 font-medium">Tips</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {topTipsters.map((tipster) => (
                    <tr key={tipster.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-1.5">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                          tipster.rank === 1 ? "bg-amber-500 text-white" :
                          tipster.rank === 2 ? "bg-gray-400 text-white" :
                          tipster.rank === 3 ? "bg-amber-700 text-white" :
                          "bg-muted"
                        }`}>
                          {tipster.rank}
                        </div>
                      </td>
                      <td className="py-1.5">
                        <Link href={tipsterHref(tipster.username || tipster.name, tipster.username || tipster.id)} className="flex items-center gap-2 hover:text-primary">
                          <img src={tipster.avatar} alt={tipster.name} className="h-6 w-6 rounded-full bg-muted" />
                          <span className="font-medium truncate max-w-[120px]">{tipster.name}</span>
                        </Link>
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${tipster.winRate}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium">{tipster.winRate}%</span>
                        </div>
                      </td>
                      <td className={`py-1.5 font-medium ${tipster.roi >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {tipster.profit}
                      </td>
                      <td className="py-1.5 text-muted-foreground">{tipster.predictions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 pb-1.5 px-3">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 p-3 pt-0">
            <Button className="w-full h-8 justify-start gap-2 text-xs" variant="outline" asChild>
              <Link href="/admin/matches"><Calendar className="h-3.5 w-3.5" /> Manage Matches</Link>
            </Button>
            <Button className="w-full h-8 justify-start gap-2 text-xs" variant="outline" asChild>
              <Link href="/admin/users"><Users className="h-3.5 w-3.5" /> Manage Users</Link>
            </Button>
            <Button className="w-full h-8 justify-start gap-2 text-xs" variant="outline" asChild>
              <Link href="/admin/tipsters"><Trophy className="h-3.5 w-3.5" /> Tipsters</Link>
            </Button>
            <Button className="w-full h-8 justify-start gap-2 text-xs" variant="outline" asChild>
              <Link href="/admin/comments"><MessageSquare className="h-3.5 w-3.5" /> Review Comments</Link>
            </Button>
            <Button className="w-full h-8 justify-start gap-2 text-xs" variant="outline" asChild>
              <Link href="/admin/notifications"><Zap className="h-3.5 w-3.5" /> Send Notification</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Live Activity */}
      <Card>
        <CardHeader className="py-2 pb-1.5 px-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-emerald-500" />
            Live Activity
            <span className="ml-1 relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-1">
            {liveActivity.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No activity yet.</p>
            )}
            {liveActivity.map((activity, i) => (
              <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs">{activity.action}</span>
                  <span className="text-xs font-medium text-primary">{activity.user}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
