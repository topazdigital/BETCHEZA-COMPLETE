"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import useSWR from "swr"
import { Search, CheckCircle2, XCircle, Clock, TrendingUp, Filter, ExternalLink, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { format } from "date-fns"
import { matchIdToSlug } from "@/lib/utils/match-url"
import { cn } from "@/lib/utils"
import { tipsterHref } from "@/lib/utils/slug"

interface Prediction {
  id: string
  tipster: { id: number; name: string; avatar: string | null; username: string }
  match: { id: string; slug: string | null; homeTeam: string; awayTeam: string; league: string; sport: string; kickoff: string }
  prediction: string
  market: string
  odds: number
  stake: number
  confidence: number
  status: 'pending' | 'won' | 'lost' | 'void'
  isPremium: boolean
  likes: number
  comments: number
  createdAt: string
}

interface Stats {
  total: number
  won: number
  lost: number
  pending: number
  void: number
  winRate: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function AdminPredictionsPage() {
  const { data, isLoading } = useSWR<{ items: Prediction[]; stats: Stats }>(
    '/api/admin/predictions',
    fetcher,
    { refreshInterval: 30000 },
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const predictions = data?.items || []
  const stats = data?.stats || { total: 0, won: 0, lost: 0, pending: 0, void: 0, winRate: 0 }

  const filtered = predictions.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.tipster.name.toLowerCase().includes(q) ||
      p.match.homeTeam.toLowerCase().includes(q) ||
      p.match.awayTeam.toLowerCase().includes(q) ||
      p.prediction.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold">Predictions</h1>
        <p className="text-xs text-muted-foreground">Live tip feed from every active tipster</p>
      </div>

      <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
        <StatBox label="Total" value={stats.total} />
        <StatBox label="Won" value={stats.won} icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="emerald" />
        <StatBox label="Lost" value={stats.lost} icon={<XCircle className="h-3.5 w-3.5" />} tone="rose" />
        <StatBox label="Pending" value={stats.pending} icon={<Clock className="h-3.5 w-3.5" />} tone="amber" />
        <StatBox label="Win rate" value={`${stats.winRate}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} tone="primary" />
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tipsters, teams, picks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="void">Void</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] uppercase text-muted-foreground">
                  <th className="p-2">Tipster</th>
                  <th className="p-2">Match</th>
                  <th className="p-2">Pick</th>
                  <th className="p-2 text-right">Odds</th>
                  <th className="p-2 text-right">Stake</th>
                  <th className="p-2 text-right">Conf.</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Created</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="p-2">
                      <Link href={tipsterHref(p.tipster.username || p.tipster.name, p.tipster.username || p.tipster.id)} className="flex items-center gap-1.5 hover:text-primary">
                        {p.tipster.avatar ? (
                          <Image src={p.tipster.avatar} alt={p.tipster.name} width={20} height={20} className="h-5 w-5 rounded-full" unoptimized />
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                            {p.tipster.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate max-w-[120px] font-medium">{p.tipster.name}</span>
                      </Link>
                    </td>
                    <td className="p-2">
                      <Link href={`/matches/${matchIdToSlug(p.match.id)}`} className="hover:text-primary">
                        <div className="font-medium truncate max-w-[200px]">
                          {p.match.homeTeam} <span className="text-muted-foreground">vs</span> {p.match.awayTeam}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{p.match.league}</div>
                      </Link>
                    </td>
                    <td className="p-2">
                      <div className="font-medium truncate max-w-[160px]">{p.prediction}</div>
                      <div className="text-[10px] text-muted-foreground">{p.market}</div>
                    </td>
                    <td className="p-2 text-right font-bold tabular-nums">{p.odds.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums">{p.stake}u</td>
                    <td className="p-2 text-right tabular-nums">{p.confidence}%</td>
                    <td className="p-2">
                      <Badge variant={p.status === "won" ? "default" : p.status === "lost" ? "destructive" : "secondary"} className="text-[10px]">
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(p.createdAt), 'MMM d HH:mm')}</td>
                    <td className="p-2">
                      <Link href={`/matches/${matchIdToSlug(p.match.id)}`} className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-muted-foreground">
                      No predictions match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}

function StatBox({ label, value, icon, tone = 'default' }: { label: string; value: string | number; icon?: React.ReactNode; tone?: 'default' | 'emerald' | 'rose' | 'amber' | 'primary' }) {
  const toneClass =
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'rose' ? 'text-rose-600' :
    tone === 'amber' ? 'text-amber-600' :
    tone === 'primary' ? 'text-primary' : ''
  return (
    <Card>
      <CardContent className="p-2.5">
        <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={cn("mt-0.5 text-base font-bold tabular-nums", toneClass)}>{value}</div>
      </CardContent>
    </Card>
  )
}
