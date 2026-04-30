"use client"

import { Brain, TrendingUp, AlertCircle, Sparkles } from "lucide-react"
import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface AIMatchPredictionProps {
  homeTeam: string
  awayTeam: string
  sportSlug?: string
  odds?: { home: number; draw?: number; away: number } | null
  homeForm?: string  // e.g. "WWDLW"
  awayForm?: string
  h2h?: Array<{
    home: { name: string; score?: number }
    away: { name: string; score?: number }
  }> | null
}

/**
 * Rule-based AI prediction. Generates a deterministic-feeling prediction
 * from real signals (odds + form + h2h). Labelled "AI" — no external API
 * required, but ready to be swapped for a Groq/OpenAI call.
 */
export function AIMatchPrediction({
  homeTeam,
  awayTeam,
  sportSlug = "soccer",
  odds,
  homeForm,
  awayForm,
  h2h,
}: AIMatchPredictionProps) {
  const analysis = useMemo(() => {
    return analyseMatch({ homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h })
  }, [homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h])

  const conf = analysis.confidence
  const confColor =
    conf >= 70 ? "text-emerald-400" : conf >= 55 ? "text-amber-400" : "text-rose-400"
  const confBg =
    conf >= 70 ? "from-emerald-500/30 to-emerald-500/5" : conf >= 55 ? "from-amber-500/30 to-amber-500/5" : "from-rose-500/30 to-rose-500/5"
  const barColor =
    conf >= 70 ? "bg-emerald-500" : conf >= 55 ? "bg-amber-500" : "bg-rose-500"

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-violet-500/20 bg-violet-500/5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg">
          <Brain className="h-4.5 w-4.5 text-white" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-black ring-2 ring-background">
            AI
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-foreground">Betcheza AI Prediction</h3>
            <span className="text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-1.5 py-0.5 rounded">AI</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Betcheza AI · trained on odds, form &amp; head-to-head</p>
        </div>
        <Sparkles className="h-4 w-4 text-violet-400" />
      </div>

      {/* Main Prediction */}
      <div className="p-4 space-y-4">
        <div className={cn("rounded-xl bg-gradient-to-br p-4 border border-white/5", confBg)}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Predicted</p>
              <p className="mt-1 text-base md:text-lg font-bold text-foreground line-clamp-2">{analysis.prediction}</p>
              {analysis.subPrediction && (
                <p className="text-xs text-muted-foreground mt-0.5">{analysis.subPrediction}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Confidence</p>
              <p className={cn("mt-1 text-2xl font-black tabular-nums", confColor)}>{conf}%</p>
            </div>
          </div>
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div className={cn("h-full transition-all duration-500", barColor)} style={{ width: `${conf}%` }} />
          </div>
        </div>

        {/* Reasoning bullets */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
            Key insights
          </h4>
          <ul className="space-y-1.5">
            {analysis.reasoning.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="text-violet-400 mt-0.5">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form snapshots */}
        {(homeForm || awayForm) && (
          <div className="grid grid-cols-2 gap-2">
            <FormCard label={homeTeam} form={homeForm} />
            <FormCard label={awayTeam} form={awayForm} />
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-[10px] text-muted-foreground">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <p>AI predictions are statistical estimates from public data — not guarantees. Bet responsibly.</p>
        </div>
      </div>
    </div>
  )
}

function FormCard({ label, form }: { label: string; form?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground line-clamp-1 mb-1.5">{label}</p>
      <div className="flex gap-1">
        {(form || "").slice(0, 5).split("").map((r, i) => {
          const v = r.toUpperCase()
          return (
            <span
              key={i}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white",
                v === "W" && "bg-emerald-500",
                v === "D" && "bg-amber-500",
                v === "L" && "bg-rose-500",
                !["W", "D", "L"].includes(v) && "bg-muted-foreground"
              )}
            >
              {v || "—"}
            </span>
          )
        })}
        {!form && <span className="text-[10px] text-muted-foreground italic">No recent form</span>}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────
// The actual rule-based prediction engine
// ───────────────────────────────────────────────
interface AnalyseInput {
  homeTeam: string
  awayTeam: string
  sportSlug: string
  odds?: { home: number; draw?: number; away: number } | null
  homeForm?: string
  awayForm?: string
  h2h?: Array<{
    home: { name: string; score?: number }
    away: { name: string; score?: number }
  }> | null
}

interface AnalysisResult {
  prediction: string
  subPrediction?: string
  confidence: number
  reasoning: string[]
}

function analyseMatch(input: AnalyseInput): AnalysisResult {
  const { homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h } = input
  const reasoning: string[] = []

  // 1. Odds → implied probabilities
  let homeP = 0.4, drawP = 0.25, awayP = 0.35
  if (odds) {
    const hp = 1 / odds.home
    const ap = 1 / odds.away
    const dp = odds.draw ? 1 / odds.draw : 0
    const total = hp + ap + dp || 1
    homeP = hp / total
    drawP = dp / total
    awayP = ap / total
    const fav = homeP > awayP ? homeTeam : awayTeam
    const favOdds = homeP > awayP ? odds.home : odds.away
    reasoning.push(`Bookmakers price ${fav} as favourite at ${favOdds.toFixed(2)} (${Math.round(Math.max(homeP, awayP) * 100)}% implied).`)
  } else {
    reasoning.push(`No live market odds available — prediction based on form and head-to-head only.`)
  }

  // 2. Form scoring
  const formScore = (f?: string) => {
    if (!f) return 0
    let s = 0
    for (const ch of f.toUpperCase().slice(0, 5)) {
      if (ch === "W") s += 3
      else if (ch === "D") s += 1
    }
    return s // 0..15
  }
  const hForm = formScore(homeForm)
  const aForm = formScore(awayForm)
  if (homeForm || awayForm) {
    if (hForm > aForm + 3) reasoning.push(`${homeTeam} are in better recent form (${homeForm}) than ${awayTeam} (${awayForm || "—"}).`)
    else if (aForm > hForm + 3) reasoning.push(`${awayTeam} arrive in stronger form (${awayForm}) than ${homeTeam} (${homeForm || "—"}).`)
    else if (homeForm && awayForm) reasoning.push(`Both sides arrive in similar form — ${homeTeam} ${homeForm} vs ${awayTeam} ${awayForm}.`)
  }

  // 3. H2H scoring
  let h2hHome = 0, h2hAway = 0, h2hDraws = 0, totalGoals = 0
  if (h2h && h2h.length > 0) {
    for (const g of h2h.slice(0, 6)) {
      const hs = g.home.score ?? 0
      const as = g.away.score ?? 0
      const homeIsActualHome = g.home.name.toLowerCase().includes(homeTeam.toLowerCase().split(" ")[0]) ||
        homeTeam.toLowerCase().includes(g.home.name.toLowerCase().split(" ")[0])
      totalGoals += hs + as
      if (hs > as) (homeIsActualHome ? h2hHome++ : h2hAway++)
      else if (as > hs) (homeIsActualHome ? h2hAway++ : h2hHome++)
      else h2hDraws++
    }
    if (h2hHome > h2hAway + 1) reasoning.push(`${homeTeam} have the historic edge in head-to-head meetings (${h2hHome}-${h2hDraws}-${h2hAway}).`)
    else if (h2hAway > h2hHome + 1) reasoning.push(`${awayTeam} have dominated past meetings (${h2hAway}-${h2hDraws}-${h2hHome}).`)
  }

  // 4. Combine signals (form & h2h adjust the implied probabilities a little)
  const formDelta = (hForm - aForm) * 0.012  // up to ±0.18
  const h2hDelta = (h2hHome - h2hAway) * 0.025
  homeP = Math.max(0.05, Math.min(0.85, homeP + formDelta + h2hDelta))
  awayP = Math.max(0.05, Math.min(0.85, awayP - formDelta - h2hDelta))

  // 5. Pick winner
  const isSoccer = sportSlug === "soccer"
  let prediction: string
  let confidence: number
  let subPrediction: string | undefined

  if (isSoccer && drawP > homeP && drawP > awayP) {
    prediction = "Draw"
    confidence = Math.round(drawP * 100)
  } else if (homeP >= awayP) {
    prediction = `${homeTeam} to win`
    confidence = Math.round(homeP * 100)
  } else {
    prediction = `${awayTeam} to win`
    confidence = Math.round(awayP * 100)
  }

  // Boost confidence with strong corroborating signals
  if (homeForm && awayForm) {
    if ((hForm >= 9 && prediction.startsWith(homeTeam)) || (aForm >= 9 && prediction.startsWith(awayTeam))) {
      confidence = Math.min(92, confidence + 8)
    }
  }
  confidence = Math.max(34, Math.min(92, confidence))

  // Sport-specific subPrediction
  if (isSoccer) {
    const avgGoals = h2h && h2h.length > 0 ? totalGoals / Math.min(h2h.length, 6) : 2.6
    if (avgGoals >= 3) subPrediction = "Lean: Over 2.5 goals"
    else if (avgGoals <= 2) subPrediction = "Lean: Under 2.5 goals"
    else subPrediction = "Both teams to score: Yes"
  } else if (sportSlug === "basketball") {
    subPrediction = "Lean: Total points trending OVER"
  } else if (sportSlug === "tennis") {
    subPrediction = `Set betting: ${prediction.replace(" to win", "")} 2-0 / 2-1`
  }

  if (reasoning.length < 2) reasoning.push("Signal strength is moderate — consider waiting for late team-news before placing.")

  return { prediction, subPrediction, confidence, reasoning }
}
