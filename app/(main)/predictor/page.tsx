"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles, Brain, Target, TrendingUp, Loader2, AlertTriangle, Trophy, Zap,
  Clock, Activity, Crosshair, ChevronDown, History, HelpCircle, Search, X, Swords,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface AltMarket {
  market: string
  pick: string
  confidence: number
}

interface PredictionResult {
  pick: string
  market: string
  confidence: number
  recommendedBet: string
  altMarkets: AltMarket[]
  reasoning: string[]
  source: "openai" | "fallback"
}

interface UpcomingFixture {
  id: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffTime: string
  sport: string
}

interface RecentPredictionRecord {
  id: string
  createdAt: string
  league: string
  homeTeam: string
  awayTeam: string
  market: string
  pick: string
  confidence: number
  result: 'pending' | 'won' | 'lost' | 'push'
}

function formatKickoff(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    if (diff < 0) return "Soon"
    if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)}m`
    if (diff < 24 * 60 * 60 * 1000) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
    return d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

export default function MatchPredictorPage() {
  const [teamQuery, setTeamQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<UpcomingFixture | null>(null)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingFixture[]>([])
  const [recent, setRecent] = useState<RecentPredictionRecord[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/predictor/upcoming?limit=100", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { matches: [] })
      .then((d: { matches: UpcomingFixture[] }) => {
        if (!cancelled) setUpcoming(d.matches || [])
      })
      .catch(() => {})
    fetch("/api/predictor/recent?limit=9", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { predictions: [] })
      .then((d: { predictions: RecentPredictionRecord[] }) => {
        if (!cancelled) setRecent(d.predictions || [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filteredMatches = useMemo(() => {
    if (!teamQuery.trim()) return upcoming.slice(0, 20)
    const q = teamQuery.toLowerCase()
    return upcoming.filter(m =>
      m.homeTeam.toLowerCase().includes(q) ||
      m.awayTeam.toLowerCase().includes(q) ||
      m.league.toLowerCase().includes(q)
    ).slice(0, 15)
  }, [teamQuery, upcoming])

  const refreshRecent = async () => {
    try {
      const r = await fetch("/api/predictor/recent?limit=9", { cache: "no-store" })
      if (!r.ok) return
      const d = await r.json() as { predictions: RecentPredictionRecord[] }
      setRecent(d.predictions || [])
    } catch {}
  }

  const handleSelectMatch = (match: UpcomingFixture) => {
    setSelectedMatch(match)
    setTeamQuery(`${match.homeTeam} vs ${match.awayTeam}`)
    setShowDropdown(false)
    setResult(null)
    setError(null)
  }

  const clearSelection = () => {
    setSelectedMatch(null)
    setTeamQuery("")
    setResult(null)
    setError(null)
    inputRef.current?.focus()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!selectedMatch) {
      setError("Please select a match from the list")
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/predictor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          league: selectedMatch.league,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Prediction failed")
      }
      const data = (await res.json()) as PredictionResult
      setResult(data)
      refreshRecent()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const confidenceTone = (c: number) =>
    c >= 70 ? "text-emerald-500" : c >= 55 ? "text-amber-500" : "text-rose-500"

  const confidenceBg = (c: number) =>
    c >= 70
      ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30"
      : c >= 55
        ? "from-amber-500/20 to-amber-500/5 border-amber-500/30"
        : "from-rose-500/20 to-rose-500/5 border-rose-500/30"

  return (
    <div className="flex-1">
      <div className="px-3 py-4 md:px-4 md:py-6">
        {/* Hero */}
        <div className="mb-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-3.5">
          <div className="flex items-start gap-2.5">
            <div className="rounded-lg bg-primary/20 p-2">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black md:text-xl leading-tight">Betcheza AI Predictor</h1>
              <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                Search any team to see their upcoming fixtures, pick a match, and get an AI prediction instantly.
              </p>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <StatTile icon={Crosshair} value="68%" label="3-mo accuracy" tone="success" />
          <StatTile icon={Activity} value="42" label="Markets covered" tone="primary" />
          <StatTile icon={Sparkles} value="1,284" label="AI calls today" tone="warning" />
          <StatTile icon={Clock} value="<3s" label="Avg response" tone="muted" />
        </div>

        {/* H2H shortcut */}
        <Link href="/predictor/h2h" className="mb-3 flex items-center gap-3 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent p-3 hover:border-red-500/60 hover:bg-red-500/15 transition-colors group">
          <div className="rounded-lg bg-red-500/20 p-2 group-hover:bg-red-500/30 transition-colors">
            <Swords className="h-4 w-4 text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Head-to-Head Predictor</p>
            <p className="text-xs text-muted-foreground leading-snug">Compare two teams directly — historical stats, odds, and AI matchup analysis.</p>
          </div>
          <span className="text-xs font-medium text-red-400 shrink-0">Try it →</span>
        </Link>

        <div className="grid gap-3 md:grid-cols-5">
          {/* Form */}
          <Card className="md:col-span-2">
            <CardHeader className="py-2.5 px-3">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Target className="h-3.5 w-3.5 text-primary" />
                Select a Match
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <form onSubmit={submit} className="space-y-3">
                {/* Single team search bar */}
                <div className="space-y-1" ref={dropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={inputRef}
                      placeholder="Search team or league…"
                      value={teamQuery}
                      onChange={(e) => {
                        setTeamQuery(e.target.value)
                        setShowDropdown(true)
                        if (selectedMatch && e.target.value !== `${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}`) {
                          setSelectedMatch(null)
                        }
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="h-9 pl-8 pr-8 text-xs"
                      autoComplete="off"
                    />
                    {teamQuery && (
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Match dropdown */}
                  {showDropdown && filteredMatches.length > 0 && !selectedMatch && (
                    <div className="absolute z-50 mt-0.5 max-h-64 w-full max-w-xs overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                      {filteredMatches.map((match) => (
                        <button
                          key={match.id}
                          type="button"
                          onClick={() => handleSelectMatch(match)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold leading-tight truncate">
                              {match.homeTeam} <span className="text-muted-foreground">vs</span> {match.awayTeam}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{match.league}</div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold text-primary mt-0.5">
                            {formatKickoff(match.kickoffTime)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {showDropdown && teamQuery.trim() && filteredMatches.length === 0 && !selectedMatch && (
                    <div className="absolute z-50 mt-0.5 w-full max-w-xs rounded-lg border border-border bg-popover px-3 py-3 text-center shadow-lg">
                      <p className="text-xs text-muted-foreground">No upcoming matches found for &ldquo;{teamQuery}&rdquo;</p>
                    </div>
                  )}
                </div>

                {/* Selected match display */}
                {selectedMatch && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Selected match</div>
                    <div className="text-sm font-bold leading-tight">
                      {selectedMatch.homeTeam} <span className="text-muted-foreground text-xs font-normal">vs</span> {selectedMatch.awayTeam}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-[10px] text-muted-foreground truncate">{selectedMatch.league}</div>
                      <div className="text-[10px] font-bold text-primary">{formatKickoff(selectedMatch.kickoffTime)}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-medium">Context <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea
                    placeholder="e.g. Key injuries, rotation…"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-xs"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[10px] text-destructive">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-8 gap-1.5 text-xs font-bold"
                  disabled={loading || !selectedMatch}
                >
                  {loading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" />Predict</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Result */}
          <div className="md:col-span-3">
            {!result && !loading && (
              <Card className="h-full border-dashed">
                <CardContent className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                  <h3 className="mt-3 text-base font-semibold">Your AI prediction will appear here</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Search a team above, pick an upcoming fixture, then hit Predict.
                    You&apos;ll get a pick, confidence %, recommended bet + alt markets.
                  </p>
                </CardContent>
              </Card>
            )}

            {loading && (
              <Card className="h-full">
                <CardContent className="flex h-full flex-col items-center justify-center p-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Crunching form, H2H trends and odds value…</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <div className="space-y-3">
                {selectedMatch && (
                  <div className="text-xs font-semibold text-muted-foreground">
                    Prediction for: <span className="text-foreground">{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</span>
                    <span className="ml-2 text-muted-foreground">— {selectedMatch.league}</span>
                  </div>
                )}
                {/* Headline pick */}
                <Card className={cn("overflow-hidden border-2 bg-gradient-to-br", confidenceBg(result.confidence))}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{result.market}</p>
                        <p className="mt-1 truncate text-xl font-black md:text-2xl">{result.pick}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Confidence</p>
                        <p className={cn("text-3xl font-black tabular-nums", confidenceTone(result.confidence))}>{result.confidence}%</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-background/60 p-2.5">
                      <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recommended bet</p>
                        <p className="text-sm font-semibold">{result.recommendedBet}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Alt markets */}
                {result.altMarkets.length > 0 && (
                  <Card>
                    <CardContent className="p-3">
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" />Alt markets to watch
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {result.altMarkets.map((m, i) => (
                          <div key={i} className="rounded-lg border bg-card p-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.market}</p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold">{m.pick}</p>
                              <Badge variant="outline" className={cn("shrink-0 font-bold", confidenceTone(m.confidence))}>
                                {m.confidence}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Reasoning */}
                {result.reasoning.length > 0 && (
                  <Card>
                    <CardContent className="p-3">
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <Zap className="h-3.5 w-3.5" />Why this pick
                      </h3>
                      <ul className="space-y-1.5">
                        {result.reasoning.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <p className="text-center text-[10px] text-muted-foreground">
                  {result.source === "openai"
                    ? "AI prediction · for entertainment, not financial advice. Bet responsibly."
                    : "Heuristic prediction · enable the AI integration for sharper picks. Bet responsibly."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Past Predictions */}
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <History className="h-4 w-4 text-primary" />
            Past Predictions
          </h2>
          {recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-4 text-center text-[11px] text-muted-foreground">
              No predictions yet. Search a team above and run one to see results here.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/40">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="h-4 text-[9px] px-1.5 truncate max-w-[60%]">{p.league}</Badge>
                    <Badge className={cn(
                      'h-5 text-[9px] px-1.5 border font-bold',
                      p.result === 'won' && 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
                      p.result === 'lost' && 'bg-rose-500/15 text-rose-600 border-rose-500/30',
                      p.result === 'push' && 'bg-muted text-muted-foreground border-border',
                      p.result === 'pending' && 'bg-amber-500/15 text-amber-600 border-amber-500/30',
                    )}>
                      {p.result === 'won' ? '✓ Won' : p.result === 'lost' ? '✗ Lost' : p.result === 'push' ? '⊘ Push' : '⏳ Pending'}
                    </Badge>
                  </div>
                  <div className="text-xs font-bold leading-tight truncate">{p.homeTeam} vs {p.awayTeam}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground truncate pr-1">
                      <span className="font-semibold text-foreground">{p.market}</span>: {p.pick}
                    </div>
                    <span className={cn('text-xs font-bold tabular-nums', confidenceTone(p.confidence))}>{p.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FAQ */}
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <HelpCircle className="h-4 w-4 text-primary" />
            Frequently asked questions
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {FAQS.map((f, i) => (
              <details key={i} className="group p-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold">
                  {f.q}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

const FAQS = [
  { q: 'How accurate is Betcheza AI?', a: 'Across the last three months our blended model has hit roughly 68% on flagship markets. Confidence is exposed honestly so you can size your stakes accordingly.' },
  { q: 'Which markets does the predictor cover?', a: 'Match result (1X2), double chance, both teams to score, over/under goals, Asian handicap, basketball spreads & totals, tennis match winner, and more.' },
  { q: 'Is the predictor free to use?', a: 'Yes — generating predictions is free. Pro users unlock unlimited generations, alt-market expansion and historical accuracy reports.' },
  { q: 'How is "confidence" calculated?', a: 'We blend implied probability from real bookmaker odds, recent form, head-to-head history, and squad availability signals into a single 0–100 score.' },
  { q: 'Should I bet only the top pick?', a: 'Not necessarily. Alt markets sometimes carry better value. We surface them with their own confidence score so you can hunt edges.' },
] as const

function StatTile({ icon: Icon, value, label, tone }: {
  icon: React.ComponentType<{ className?: string }>
  value: string
  label: string
  tone: 'success' | 'primary' | 'warning' | 'muted'
}) {
  return (
    <div className={cn(
      'rounded-lg border p-2 text-center',
      tone === 'success' && 'border-emerald-500/30 bg-emerald-500/5',
      tone === 'primary' && 'border-primary/30 bg-primary/5',
      tone === 'warning' && 'border-amber-500/30 bg-amber-500/5',
      tone === 'muted'   && 'border-border bg-card',
    )}>
      <Icon className={cn(
        'mx-auto h-3.5 w-3.5',
        tone === 'success' && 'text-emerald-500',
        tone === 'primary' && 'text-primary',
        tone === 'warning' && 'text-amber-500',
        tone === 'muted'   && 'text-muted-foreground',
      )} />
      <div className="mt-0.5 text-base font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}
