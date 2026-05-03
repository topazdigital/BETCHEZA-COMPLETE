"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR, { mutate } from "swr"
import {
  Wand2, Loader2, RefreshCw, Search, CheckCircle2, XCircle, Clock,
  PlayCircle, Filter, Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow } from "date-fns"

interface ActivityEntry {
  ts: string
  level: 'info' | 'success' | 'warn' | 'error'
  message: string
}
interface Tip {
  id: string
  matchId: string
  homeTeam: string
  awayTeam: string
  league?: string
  sport?: string
  kickoff?: string
  tipsterId: number
  market: string
  prediction: string
  odds: number
  stake: number
  confidence: number
  status: 'pending' | 'won' | 'lost' | 'void'
  createdAt: string
}
interface Stats {
  total: number; won: number; lost: number; pending: number; matches: number; tipsters: number
}
interface TipsterLite {
  id: number; displayName: string; username: string; avatar: string | null
  winRate: number; isPro: boolean; specialties: string[]
}
interface AutoTipsResponse {
  stats: Stats
  recent: Tip[]
  activity: ActivityEntry[]
  tipsters: TipsterLite[]
}

interface AdminMatchRaw {
  id: string
  home_team_name: string
  away_team_name: string
  league_name: string
  sport_name: string
  kickoff_time: string
  status: string
}
interface AdminMatch {
  id: string
  homeTeam: { name: string }
  awayTeam: { name: string }
  league: { name: string }
  sport: { name: string }
  kickoffTime: string
  status: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminAutoTipsPage() {
  const { data, isLoading } = useSWR<AutoTipsResponse>('/api/admin/auto-tips', fetcher, {
    refreshInterval: 30000,
  })
  const { data: matchesData } = useSWR<{ matches: AdminMatchRaw[] }>(
    '/api/admin/matches?status=scheduled&limit=200',
    fetcher,
    { refreshInterval: 60_000 },
  )

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set())
  const [tipsterFilter, setTipsterFilter] = useState<Set<number>>(new Set())
  const [matchSearch, setMatchSearch] = useState("")
  const [busy, setBusy] = useState<'gen' | 'settle' | null>(null)
  const [genLimit, setGenLimit] = useState(10)

  const stats = data?.stats || { total: 0, won: 0, lost: 0, pending: 0, matches: 0, tipsters: 0 }
  const activity = data?.activity || []
  const recent = data?.recent || []
  const tipsters = data?.tipsters || []
  const matches: AdminMatch[] = useMemo(
    () =>
      (matchesData?.matches || []).map((m) => ({
        id: m.id,
        homeTeam: { name: m.home_team_name },
        awayTeam: { name: m.away_team_name },
        league: { name: m.league_name },
        sport: { name: m.sport_name },
        kickoffTime: m.kickoff_time,
        status: m.status,
      })),
    [matchesData],
  )

  const filteredMatches = useMemo(() => {
    const q = matchSearch.toLowerCase().trim()
    if (!q) return matches.slice(0, 50)
    return matches
      .filter((m) =>
        `${m.homeTeam.name} ${m.awayTeam.name} ${m.league.name}`.toLowerCase().includes(q),
      )
      .slice(0, 50)
  }, [matches, matchSearch])

  const tipsterMap = useMemo(() => {
    const m = new Map<number, TipsterLite>()
    for (const t of tipsters) m.set(t.id, t)
    return m
  }, [tipsters])

  function toggleMatch(id: string) {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleTipster(id: number) {
    setTipsterFilter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleGenerate() {
    setBusy('gen')
    try {
      const body: Record<string, unknown> = {}
      if (selectedMatchIds.size > 0) body.matchIds = Array.from(selectedMatchIds)
      else body.limit = genLimit
      if (tipsterFilter.size > 0) body.onlyTipsterIds = Array.from(tipsterFilter)

      await fetch('/api/admin/auto-tips/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await mutate('/api/admin/auto-tips')
      setSelectedMatchIds(new Set())
    } finally {
      setBusy(null)
    }
  }

  async function handleSettle() {
    setBusy('settle')
    try {
      await fetch('/api/admin/auto-tips/settle', { method: 'POST' })
      await mutate('/api/admin/auto-tips')
    } finally {
      setBusy(null)
    }
  }

  const statusBadge = (s: Tip['status']) => {
    if (s === 'won') return <Badge variant="default" className="h-4 gap-0.5 px-1 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5" />Won</Badge>
    if (s === 'lost') return <Badge variant="destructive" className="h-4 gap-0.5 px-1 text-[10px]"><XCircle className="h-2.5 w-2.5" />Lost</Badge>
    if (s === 'void') return <Badge variant="secondary" className="h-4 px-1 text-[10px]">Void</Badge>
    return <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[10px]"><Clock className="h-2.5 w-2.5" />Pending</Badge>
  }

  return (
    <div className="space-y-3">
      {/* Title row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-1.5 text-lg font-bold">
            <Wand2 className="h-4 w-4 text-primary" /> Auto-Tip Generator
          </h1>
          <p className="text-xs text-muted-foreground">
            Seed expert tips on real upcoming matches and watch them land in tipster feeds in real time.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => mutate('/api/admin/auto-tips')}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSettle} disabled={busy !== null}>
            {busy === 'settle' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1 h-3.5 w-3.5" />}
            Settle stale
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleGenerate} disabled={busy !== null || isLoading}>
            {busy === 'gen' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="mr-1 h-3.5 w-3.5" />}
            Generate{selectedMatchIds.size > 0 ? ` (${selectedMatchIds.size})` : ` next ${genLimit}`}
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Won', value: stats.won, color: 'text-emerald-600' },
          { label: 'Lost', value: stats.lost, color: 'text-rose-600' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
          { label: 'Matches', value: stats.matches, color: 'text-foreground' },
          { label: 'Tipsters', value: stats.tipsters, color: 'text-foreground' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={cn("text-xl font-bold leading-tight", s.color)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Match picker */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">
              Upcoming matches
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {selectedMatchIds.size > 0 ? `${selectedMatchIds.size} selected` : `select to scope, or generate next ${genLimit}`}
              </span>
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-7 w-44 pl-7 text-xs"
                  placeholder="Search match…"
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                />
              </div>
              <Input
                type="number"
                min={1}
                max={50}
                className="h-7 w-14 text-xs"
                value={genLimit}
                onChange={(e) => setGenLimit(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
                disabled={selectedMatchIds.size > 0}
                title="How many upcoming matches to generate when none selected"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {filteredMatches.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">No upcoming matches.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-7 px-2 py-1"></th>
                      <th className="px-2 py-1 text-left">Match</th>
                      <th className="px-2 py-1 text-left">League</th>
                      <th className="px-2 py-1 text-left">Kickoff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatches.map((m) => {
                      const checked = selectedMatchIds.has(m.id)
                      return (
                        <tr
                          key={m.id}
                          className={cn(
                            "cursor-pointer border-t border-border hover:bg-muted/40",
                            checked && "bg-primary/10",
                          )}
                          onClick={() => toggleMatch(m.id)}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMatch(m.id)}
                              className="h-3.5 w-3.5 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="font-medium">{m.homeTeam.name} <span className="text-muted-foreground">vs</span> {m.awayTeam.name}</div>
                            <div className="text-[10px] text-muted-foreground">{m.sport.name}</div>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{m.league.name}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {m.kickoffTime ? formatDistanceToNow(new Date(m.kickoffTime), { addSuffix: true }) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Live activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {activity.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">No activity yet — hit Generate.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {activity.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 px-3 py-1.5">
                      <span className={cn(
                        "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                        a.level === 'success' && 'bg-emerald-500',
                        a.level === 'error' && 'bg-rose-500',
                        a.level === 'warn' && 'bg-amber-500',
                        a.level === 'info' && 'bg-sky-500',
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug">{a.message}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(a.ts), 'HH:mm:ss')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tipster filter */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <Filter className="h-3.5 w-3.5" /> Restrict to tipsters
            <span className="text-xs font-normal text-muted-foreground">
              {tipsterFilter.size > 0 ? `${tipsterFilter.size} selected` : 'all'}
            </span>
          </CardTitle>
          {tipsterFilter.size > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTipsterFilter(new Set())}>
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-2">
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {tipsters.map((t) => {
              const active = tipsterFilter.has(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTipster(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="font-medium">{t.displayName}</span>
                  <span className="text-[10px] opacity-70">{t.winRate}%</span>
                  {t.isPro && <span className="rounded bg-amber-500/80 px-1 text-[9px] font-bold text-white">PRO</span>}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent tips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Latest auto-generated tips</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No tips generated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">Tipster</th>
                    <th className="px-2 py-1 text-left">Match</th>
                    <th className="px-2 py-1 text-left">Pick</th>
                    <th className="px-2 py-1 text-left">Odds</th>
                    <th className="px-2 py-1 text-left">Conf.</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-left">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => {
                    const tipster = tipsterMap.get(t.tipsterId)
                    return (
                      <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                        <td className="px-2 py-1.5">
                          <span className="font-medium">{tipster?.displayName || `#${t.tipsterId}`}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="font-medium">{t.homeTeam} <span className="text-muted-foreground">vs</span> {t.awayTeam}</div>
                          <div className="text-[10px] text-muted-foreground">{t.league}</div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div>{t.prediction}</div>
                          <div className="text-[10px] text-muted-foreground">{t.market}</div>
                        </td>
                        <td className="px-2 py-1.5 font-mono">{t.odds.toFixed(2)}</td>
                        <td className="px-2 py-1.5">{t.confidence}%</td>
                        <td className="px-2 py-1.5">{statusBadge(t.status)}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
