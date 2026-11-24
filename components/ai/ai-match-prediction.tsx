"use client"

import { Brain, TrendingUp, AlertCircle, Sparkles, Lock } from "lucide-react"
import { useMemo, useState, useEffect } from "react"
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
  markets?: Array<{
    key: string
    name: string
    outcomes: Array<{ name: string; price: number; point?: number }>
    isDerived?: boolean
  }> | null
  /** Stable match ID used as the localStorage cache key. */
  matchId?: string
  /** True once the match has finished — locks to the pre-match prediction. */
  isFinished?: boolean
}

const LS_PREFIX = 'betcheza:ai-pred:v2:'

/**
 * Rule-based AI prediction. Generates a deterministic-feeling prediction
 * from real signals (odds + form + h2h). Labelled "AI" — no external API
 * required, but ready to be swapped for a Groq/OpenAI call.
 *
 * The prediction is locked into localStorage the first time meaningful data
 * is available (pre-match) so it never flips after the match ends, even
 * though post-match ESPN odds change to reflect the actual result.
 */
export function AIMatchPrediction({
  homeTeam,
  awayTeam,
  sportSlug = "soccer",
  odds,
  homeForm,
  awayForm,
  h2h,
  markets,
  matchId,
  isFinished = false,
}: AIMatchPredictionProps) {
  // Compute prediction from current data.
  // IMPORTANT: when the match is finished, we deliberately strip bookmaker odds
  // before running the engine. Post-match odds collapse to reflect the actual
  // result (e.g. draw odds drop to 1.01 after a 0-0) — feeding them into the
  // algorithm would flip the predicted winner to match the real outcome,
  // destroying user trust. Without odds we fall back to form + H2H, which
  // never changes pre- vs post-match and keeps the prediction stable.
  const liveAnalysis = useMemo(() => {
    const safeOdds = isFinished ? null : odds
    const safeMarkets = isFinished ? null : markets
    return analyseMatch({ homeTeam, awayTeam, sportSlug, odds: safeOdds, homeForm, awayForm, h2h, markets: safeMarkets })
  }, [homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h, markets, isFinished])

  // Locked pre-match prediction, loaded from / saved to localStorage
  const [lockedAnalysis, setLockedAnalysis] = useState<AnalysisResult | null>(null)

  useEffect(() => {
    if (!matchId) return
    const key = `${LS_PREFIX}${matchId}`
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        // Always prefer the stored pre-match prediction
        setLockedAnalysis(JSON.parse(stored) as AnalysisResult)
        return
      }
      // For finished matches: always snapshot so all subsequent visits (this
      // browser) see the same stable prediction. liveAnalysis has odds stripped.
      // Always save regardless of signal availability so the prediction persists.
      if (isFinished) {
        localStorage.setItem(key, JSON.stringify(liveAnalysis))
        setLockedAnalysis(liveAnalysis)
        return
      }
      // Pre-match: only persist once we have at least one meaningful signal
      const hasMeaningfulData = odds !== null && odds !== undefined
        || !!(homeForm) || !!(awayForm)
        || (Array.isArray(h2h) && h2h.length > 0)
        || (Array.isArray(markets) && markets.some((market) => !market.isDerived && market.outcomes.length > 0))
      if (hasMeaningfulData) {
        localStorage.setItem(key, JSON.stringify(liveAnalysis))
        setLockedAnalysis(liveAnalysis)
      }
    } catch { /* ignore localStorage errors in SSR/private browsing */ }
  // Re-run when data loads so we capture odds once they arrive — but once
  // stored, the localStorage branch returns early and never overwrites.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, odds, homeForm, awayForm, h2h, markets, isFinished, liveAnalysis])

  // Always prefer locked prediction; for finished matches liveAnalysis is
  // already odds-stripped so it's also safe to fall back to.
  const analysis = lockedAnalysis ?? liveAnalysis

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
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-bold text-foreground">Betcheza AI Prediction</h3>
            <span className="text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-1.5 py-0.5 rounded">AI</span>
            {isFinished && lockedAnalysis && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400 border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 rounded">
                <Lock className="h-2.5 w-2.5" />
                Pre-match
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Betcheza AI · compares available markets, odds, form &amp; head-to-head</p>
        </div>
        <Sparkles className="h-4 w-4 text-violet-400" />
      </div>

      {/* Main Prediction */}
      <div className="p-4 space-y-4">
        <div className={cn("rounded-xl bg-gradient-to-br p-4 border border-white/5", confBg)}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Best market{analysis.market ? ` · ${analysis.market}` : ''}
              </p>
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
  markets?: Array<{
    key: string
    name: string
    outcomes: Array<{ name: string; price: number; point?: number }>
    isDerived?: boolean
  }> | null
}

interface AnalysisResult {
  prediction: string
  market?: string
  subPrediction?: string
  confidence: number
  reasoning: string[]
}

type MarketFamily =
  | 'result'
  | 'double_chance'
  | 'draw_no_bet'
  | 'btts'
  | 'totals'
  | 'handicap'
  | 'clean_sheet'
  | 'win_to_nil'
  | 'first_team_to_score'
  | 'goal_first_half'

interface RankedMarketPick {
  market: string
  pick: string
  price: number
  modelProbability: number
  marketProbability: number
  edge: number
  family: MarketFamily
}

function normalizeMarketText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.+-]/g, '')
}

function predictionMarketFamily(key: string, name: string): MarketFamily | null {
  const value = normalizeMarketText(`${key} ${name}`)
  if (value.includes('doublechance')) return 'double_chance'
  if (value.includes('drawnobet')) return 'draw_no_bet'
  if (value.includes('btts') || value.includes('bothteamstoscore')) return 'btts'
  if (value.includes('cleansheet')) return 'clean_sheet'
  if (value.includes('wintonil')) return 'win_to_nil'
  if (value.includes('firstteamtoscore')) return 'first_team_to_score'
  if (value.includes('goalfirsthalf')) return 'goal_first_half'
  if (value.includes('asian') || value.includes('handicap') || value.includes('spread')) return 'handicap'
  if (value.includes('total') || value.includes('over') || value.includes('under')) return 'totals'
  if (
    value.includes('1x2') ||
    value.includes('matchresult') ||
    value.includes('fulltimeresult') ||
    value.includes('matchwinner') ||
    value === 'h2h' ||
    value.includes('moneyline')
  ) return 'result'
  return null
}

function matchOutcomeSide(name: string, homeTeam: string, awayTeam: string): 'home' | 'away' | 'draw' | null {
  const value = normalizeMarketText(name)
  const home = normalizeMarketText(homeTeam)
  const away = normalizeMarketText(awayTeam)
  if (value === 'x' || value === 'draw' || value.includes('draw')) return 'draw'
  if (value === '1' || value === 'home' || value.includes(home)) return 'home'
  if (value === '2' || value === 'away' || value.includes(away)) return 'away'
  return null
}

function marketLine(name: string, point?: number): number | null {
  if (typeof point === 'number' && Number.isFinite(point)) return point
  const signedMatch = name.match(/[+-]\d+(?:\.\d+)?/)
  if (signedMatch) return Number(signedMatch[0])
  const match = name.match(/[+-]?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function poissonProbability(lambda: number, goals: number): number {
  if (goals < 0) return 0
  let probability = Math.exp(-lambda)
  for (let i = 1; i <= goals; i++) probability *= lambda / i
  return probability
}

function poissonAtMost(lambda: number, goals: number): number {
  if (goals < 0) return 0
  let probability = Math.exp(-lambda)
  let total = probability
  for (let i = 1; i <= goals; i++) {
    probability *= lambda / i
    total += probability
  }
  return total
}

function estimateAvailableMarketPick(
  input: AnalyseInput,
  probabilities: { home: number; draw: number; away: number },
): RankedMarketPick | null {
  const isSoccerMatch = input.sportSlug === 'soccer' || input.sportSlug === 'football'
  const markets = (input.markets || []).filter((market) => !market.isDerived)
  if (!markets.length) return null

  const history = input.h2h?.slice(0, 6) || []
  let goals = 0
  let bothScored = 0
  for (const game of history) {
    const homeScore = game.home.score ?? 0
    const awayScore = game.away.score ?? 0
    goals += homeScore + awayScore
    if (homeScore > 0 && awayScore > 0) bothScored++
  }
  // Shrink a small head-to-head sample toward a neutral league scoring baseline.
  const expectedGoals = history.length > 0 ? (goals + 2.6 * 2) / (history.length + 2) : 2.6
  const homeShare = Math.min(0.72, Math.max(0.28,
    (probabilities.home + probabilities.away) > 0
      ? probabilities.home / (probabilities.home + probabilities.away)
      : 0.55,
  ))
  const lambdaHome = Math.max(0.2, expectedGoals * homeShare)
  const lambdaAway = Math.max(0.2, expectedGoals - lambdaHome)
  const noGoal = Math.exp(-(lambdaHome + lambdaAway))
  const homeFirst = (lambdaHome / (lambdaHome + lambdaAway)) * (1 - noGoal)
  const awayFirst = 1 - noGoal - homeFirst

  const candidates: RankedMarketPick[] = []
  for (const market of markets) {
    const family = predictionMarketFamily(market.key, market.name)
    if (!family || !market.outcomes.length) continue
    // These goal and handicap estimates are soccer-specific. Other sports stay
    // on their native moneyline until a sport-specific model is available.
    if (!isSoccerMatch && family !== 'result') continue
    const impliedTotal = market.outcomes.reduce(
      (sum, outcome) => sum + (outcome.price > 1 ? 1 / outcome.price : 0),
      0,
    )
    if (impliedTotal <= 0) continue

    for (const outcome of market.outcomes) {
      if (!Number.isFinite(outcome.price) || outcome.price < 1.2 || outcome.price > 6) continue
      const label = normalizeMarketText(outcome.name)
      const side = matchOutcomeSide(outcome.name, input.homeTeam, input.awayTeam)
      let modelProbability: number | null = null
      let pick = outcome.name

      if (family === 'result') {
        if (side === 'home') modelProbability = probabilities.home
        else if (side === 'away') modelProbability = probabilities.away
        else if (side === 'draw') modelProbability = probabilities.draw
        if (side === 'home') pick = `${input.homeTeam} to win`
        else if (side === 'away') pick = `${input.awayTeam} to win`
        else if (side === 'draw') pick = 'Draw'
      } else if (family === 'double_chance') {
        if (label.includes('1x') || (label.includes('home') && label.includes('draw')) ||
            (label.includes(normalizeMarketText(input.homeTeam)) && label.includes('draw'))) {
          modelProbability = probabilities.home + probabilities.draw
          pick = `${input.homeTeam} or Draw`
        } else if (label.includes('x2') || (label.includes('away') && label.includes('draw')) ||
            (label.includes(normalizeMarketText(input.awayTeam)) && label.includes('draw'))) {
          modelProbability = probabilities.away + probabilities.draw
          pick = `${input.awayTeam} or Draw`
        } else if (label.includes('12') || (label.includes(normalizeMarketText(input.homeTeam)) && label.includes(normalizeMarketText(input.awayTeam)))) {
          modelProbability = probabilities.home + probabilities.away
          pick = `${input.homeTeam} or ${input.awayTeam}`
        }
      } else if (family === 'draw_no_bet') {
        if (side === 'home') {
          modelProbability = probabilities.home / Math.max(probabilities.home + probabilities.away, 0.001)
          pick = `${input.homeTeam} (Draw No Bet)`
        } else if (side === 'away') {
          modelProbability = probabilities.away / Math.max(probabilities.home + probabilities.away, 0.001)
          pick = `${input.awayTeam} (Draw No Bet)`
        }
      } else if (family === 'btts' && history.length > 0) {
        const yesProbability = (bothScored + 1) / (history.length + 2)
        if (label === 'yes' || label.includes('yes')) {
          modelProbability = yesProbability
          pick = 'Both Teams to Score — Yes'
        } else if (label === 'no' || label.includes('no')) {
          modelProbability = 1 - yesProbability
          pick = 'Both Teams to Score — No'
        }
      } else if (family === 'totals' && history.length > 0) {
        const line = marketLine(outcome.name, outcome.point)
        if (line !== null && (label.includes('over') || label.includes('under'))) {
          const underProbability = poissonAtMost(expectedGoals, Math.floor(line))
          if (label.includes('over')) {
            modelProbability = 1 - underProbability
            pick = `Over ${line} Goals`
          } else {
            modelProbability = underProbability
            pick = `Under ${line} Goals`
          }
        }
      } else if (family === 'handicap' && side && side !== 'draw') {
        const line = marketLine(outcome.name, outcome.point)
        if (line !== null) {
          let coverProbability = 0
          for (let homeGoals = 0; homeGoals <= 9; homeGoals++) {
            for (let awayGoals = 0; awayGoals <= 9; awayGoals++) {
              const jointProbability = poissonProbability(lambdaHome, homeGoals) * poissonProbability(lambdaAway, awayGoals)
              const adjustedDifference = side === 'home'
                ? homeGoals + line - awayGoals
                : awayGoals + line - homeGoals
              coverProbability += adjustedDifference > 0
                ? jointProbability
                : adjustedDifference === 0 ? jointProbability * 0.5 : 0
            }
          }
          modelProbability = coverProbability
        }
      } else if (family === 'clean_sheet') {
        const marketLabel = normalizeMarketText(`${market.key} ${market.name}`)
        const defendingSide = marketLabel.includes('home') || marketLabel.includes(normalizeMarketText(input.homeTeam))
          ? 'home'
          : marketLabel.includes('away') || marketLabel.includes(normalizeMarketText(input.awayTeam))
            ? 'away'
            : null
        if (defendingSide && (label === 'yes' || label === 'no')) {
          const yesProbability = defendingSide === 'home' ? Math.exp(-lambdaAway) : Math.exp(-lambdaHome)
          modelProbability = label === 'yes' ? yesProbability : 1 - yesProbability
        }
      } else if (family === 'win_to_nil') {
        if (side === 'home') modelProbability = Math.exp(-lambdaAway) * (1 - Math.exp(-lambdaHome))
        else if (side === 'away') modelProbability = Math.exp(-lambdaHome) * (1 - Math.exp(-lambdaAway))
        else if (label.includes('neither')) {
          modelProbability = 1 -
            Math.exp(-lambdaAway) * (1 - Math.exp(-lambdaHome)) -
            Math.exp(-lambdaHome) * (1 - Math.exp(-lambdaAway))
        }
      } else if (family === 'first_team_to_score') {
        if (side === 'home') modelProbability = homeFirst
        else if (side === 'away') modelProbability = awayFirst
        else if (label.includes('nogoal') || label.includes('not')) modelProbability = noGoal
      } else if (family === 'goal_first_half' && (label === 'yes' || label === 'no')) {
        const yesProbability = 1 - Math.exp(-(lambdaHome + lambdaAway) * 0.48)
        modelProbability = label === 'yes' ? yesProbability : 1 - yesProbability
      }

      if (modelProbability === null || !Number.isFinite(modelProbability) || modelProbability < 0.3) continue
      const marketProbability = (1 / outcome.price) / impliedTotal
      candidates.push({
        market: market.name,
        pick,
        price: outcome.price,
        modelProbability,
        marketProbability,
        edge: modelProbability - marketProbability,
        family,
      })
    }
  }

  candidates.sort((a, b) =>
    b.edge - a.edge ||
    Number(a.family === 'result') - Number(b.family === 'result') ||
    b.modelProbability - a.modelProbability,
  )
  return candidates[0] || null
}

function analyseMatch(input: AnalyseInput): AnalysisResult {
  const { homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h } = input
  const isSoccer = sportSlug === "soccer" || sportSlug === "football"
  const reasoning: string[] = []

  // 1. Odds → implied probabilities
  let homeP = 0.4, drawP = 0.25, awayP = 0.35
  if (!isSoccer) drawP = 0
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

  const totalProbability = homeP + drawP + awayP || 1
  const bestMarket = estimateAvailableMarketPick(input, {
    home: homeP / totalProbability,
    draw: drawP / totalProbability,
    away: awayP / totalProbability,
  })
  if (bestMarket && bestMarket.edge >= 0.01) {
    prediction = bestMarket.pick
    confidence = Math.round(Math.min(92, Math.max(34, bestMarket.modelProbability * 100)))
    subPrediction = `Odds ${bestMarket.price.toFixed(2)} · estimated value edge ${Math.round(bestMarket.edge * 100)} pts`
    reasoning.unshift(
      `${bestMarket.market} compares best among available bookmaker markets: estimated probability ${Math.round(bestMarket.modelProbability * 100)}% vs ${Math.round(bestMarket.marketProbability * 100)}% market-implied.`,
    )
    return { prediction, market: bestMarket.market, subPrediction, confidence, reasoning }
  }

  return {
    prediction,
    market: sportSlug === 'soccer' || sportSlug === 'football' ? 'Match Result (1X2)' : 'Moneyline',
    subPrediction,
    confidence,
    reasoning,
  }
}
