"use client"

import { Brain, Sparkles, Check, X, MinusCircle, TrendingUp, Lightbulb } from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

interface Market {
  key: string
  name: string
  outcomes: Array<{ name: string; price: number; point?: number }>
}

interface AIMultiMarketProps {
  homeTeam: string
  awayTeam: string
  sportSlug?: string
  odds?: { home: number; draw?: number; away: number } | null
  homeForm?: string
  awayForm?: string
  h2h?: Array<{
    home: { name: string; score?: number }
    away: { name: string; score?: number }
  }> | null
  markets?: Market[] | null
  /** Final / current home score — used to auto-mark picks won/lost when status === 'finished' */
  homeScore?: number | null
  /** Final / current away score */
  awayScore?: number | null
  /** Match status — picks are only auto-marked when this is 'finished' */
  status?: string
  /** Optional lineups — when present we factor starter count + key absences into the smart pick */
  lineups?: {
    home?: { starters?: number; injuries?: number }
    away?: { starters?: number; injuries?: number }
  } | null
}

interface MarketPick {
  market: string
  pick: string
  odds?: number
  confidence: number
  reason: string
  /** Internal evaluator key — see evaluatePick(). Optional. */
  evalKey?: string
  /** For per-line markets like Over / Under */
  line?: number
  /** For 1X2 / DC / DNB / HT — which side this picks */
  side?: 'home' | 'away' | 'draw' | 'home_or_draw' | 'away_or_draw' | 'home_or_away'
  /** Correct-score string like "2-1" */
  scoreLean?: string
}

type Outcome = 'won' | 'lost' | 'void' | 'pending'

/**
 * AI multi-market predictions block.
 * After the match finishes (status === 'finished' && scores are numbers) every pick
 * is automatically marked won / lost / void with a check or X badge.
 */
export function AIMultiMarket({
  homeTeam,
  awayTeam,
  sportSlug = "soccer",
  odds,
  homeForm,
  awayForm,
  h2h,
  markets,
  homeScore,
  awayScore,
  status,
  lineups,
}: AIMultiMarketProps) {
  // Default to Smart AI — pure logic on form / H2H / lineups, ignores
  // bookmaker pricing for the SELECTION (price still shown so users see value).
  const [mode, setMode] = useState<'odds' | 'smart'>('smart')

  const picks = useMemo(
    () =>
      mode === 'smart'
        ? buildSmartPicks({ homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h, markets: markets || null, lineups: lineups || null })
        : buildMultiMarketPicks({ homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h, markets: markets || null, lineups: lineups || null }),
    [mode, homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h, markets, lineups],
  )

  const isFinal =
    (status === 'finished' || status === 'final' || status === 'ft' || status === 'ended') &&
    typeof homeScore === 'number' &&
    typeof awayScore === 'number'

  const pickWithOutcomes = useMemo(
    () =>
      picks.map((p) => ({
        pick: p,
        outcome: isFinal ? evaluatePick(p, homeScore as number, awayScore as number) : 'pending' as Outcome,
      })),
    [picks, isFinal, homeScore, awayScore],
  )

  if (picks.length === 0) return null

  const summary = isFinal
    ? pickWithOutcomes.reduce(
        (acc, x) => {
          if (x.outcome === 'won') acc.won++
          else if (x.outcome === 'lost') acc.lost++
          else if (x.outcome === 'void') acc.void++
          return acc
        },
        { won: 0, lost: 0, void: 0 },
      )
    : null

  return (
    <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-fuchsia-500/20 bg-fuchsia-500/5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 shadow-lg">
          <Brain className="h-4 w-4 text-white" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-black ring-2 ring-background">
            AI
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-bold text-foreground">AI Picks — All Markets</h3>
            <span className="text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white px-1.5 py-0.5 rounded">
              Beta
            </span>
            {isFinal && summary && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                Settled · {summary.won}W / {summary.lost}L{summary.void ? ` / ${summary.void}V` : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isFinal
              ? 'Auto-graded against the final score'
              : mode === 'smart'
                ? 'Pure logic — ignores bookmaker odds, can back underdogs'
                : 'One pick per market, ranked by confidence'}
          </p>
        </div>
        <Sparkles className="h-4 w-4 text-fuchsia-400" />
      </div>

      {/* Mode toggle: Odds-based vs Smart (logic-only) */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-fuchsia-500/15 bg-background/40">
        <button
          type="button"
          onClick={() => setMode('odds')}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors",
            mode === 'odds'
              ? "bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <TrendingUp className="h-3 w-3" />
          Odds-based
        </button>
        <button
          type="button"
          onClick={() => setMode('smart')}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors",
            mode === 'smart'
              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Lightbulb className="h-3 w-3" />
          Smart AI
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {mode === 'smart'
            ? 'Reasoning ignores prices — a 5.0 can beat a 1.x'
            : 'Mixes prices with form & H2H'}
        </span>
      </div>

      <div className="divide-y divide-border/40">
        {pickWithOutcomes.map(({ pick, outcome }) => (
          <PickRow key={pick.market} pick={pick} outcome={outcome} />
        ))}
      </div>

      <div className="px-4 py-2.5 border-t border-fuchsia-500/15 text-[10px] text-muted-foreground">
        AI picks combine bookmaker odds, recent form and head-to-head — guidance, not guarantees.
      </div>
    </div>
  )
}

function PickRow({ pick, outcome }: { pick: MarketPick; outcome: Outcome }) {
  const conf = pick.confidence
  const confColor = conf >= 70 ? "text-emerald-400" : conf >= 55 ? "text-amber-400" : "text-rose-400"
  const barColor = conf >= 70 ? "bg-emerald-500" : conf >= 55 ? "bg-amber-500" : "bg-rose-500"

  const outcomeBadge =
    outcome === 'won' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/30">
        <Check className="h-3 w-3" />Won
      </span>
    ) : outcome === 'lost' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-500/30">
        <X className="h-3 w-3" />Lost
      </span>
    ) : outcome === 'void' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground border border-border">
        <MinusCircle className="h-3 w-3" />Void
      </span>
    ) : null

  return (
    <div className={cn(
      "px-4 py-3",
      outcome === 'won' && "bg-emerald-500/5",
      outcome === 'lost' && "bg-rose-500/5",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{pick.market}</p>
            {outcomeBadge}
          </div>
          <p className="mt-0.5 text-sm font-bold text-foreground line-clamp-1">{pick.pick}</p>
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{pick.reason}</p>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          {pick.odds !== undefined && (
            <span className={cn(
              "font-mono text-base font-black tabular-nums",
              outcome === 'won' ? "text-emerald-500" :
              outcome === 'lost' ? "text-rose-500 line-through opacity-60" :
              "text-primary"
            )}>
              {pick.odds.toFixed(2)}
            </span>
          )}
          <span className={cn("text-[10px] font-bold tabular-nums", confColor)}>{conf}%</span>
        </div>
      </div>
      <div className="mt-2 h-1 bg-black/30 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-500", barColor)} style={{ width: `${conf}%` }} />
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────
// Outcome evaluator
// ───────────────────────────────────────────────
function evaluatePick(p: MarketPick, hs: number, as: number): Outcome {
  const total = hs + as
  const homeWin = hs > as
  const awayWin = as > hs
  const draw = hs === as

  switch (p.evalKey) {
    case '1x2':
      if (p.side === 'home') return homeWin ? 'won' : 'lost'
      if (p.side === 'away') return awayWin ? 'won' : 'lost'
      if (p.side === 'draw') return draw ? 'won' : 'lost'
      return 'void'
    case 'dc':
      if (p.side === 'home_or_draw') return (homeWin || draw) ? 'won' : 'lost'
      if (p.side === 'away_or_draw') return (awayWin || draw) ? 'won' : 'lost'
      if (p.side === 'home_or_away') return (homeWin || awayWin) ? 'won' : 'lost'
      return 'void'
    case 'dnb':
      if (draw) return 'void'
      if (p.side === 'home') return homeWin ? 'won' : 'lost'
      if (p.side === 'away') return awayWin ? 'won' : 'lost'
      return 'void'
    case 'btts_yes':
      return (hs > 0 && as > 0) ? 'won' : 'lost'
    case 'btts_no':
      return (hs === 0 || as === 0) ? 'won' : 'lost'
    case 'over':
      return total > (p.line ?? 2.5) ? 'won' : 'lost'
    case 'under':
      return total < (p.line ?? 2.5) ? 'won' : 'lost'
    case 'cs_lean':
      return p.scoreLean === `${hs}-${as}` ? 'won' : 'lost'
    case 'ht':
      // Half-time pick — we can't grade without HT score, so leave pending/void
      return 'void'
    default:
      return 'void'
  }
}

// ───────────────────────────────────────────────
// Engine
// ───────────────────────────────────────────────
interface EngineInput {
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
  markets: Market[] | null
  lineups?: {
    home?: { starters?: number; injuries?: number }
    away?: { starters?: number; injuries?: number }
  } | null
}

function formScore(f?: string) {
  if (!f) return 0
  let s = 0
  for (const ch of f.toUpperCase().slice(0, 5)) {
    if (ch === "W") s += 3
    else if (ch === "D") s += 1
  }
  return s
}

function findMarketPrice(markets: Market[] | null, key: string, outcomeMatcher: (name: string, point?: number) => boolean): number | undefined {
  if (!markets) return undefined
  const m = markets.find(x => x.key === key)
  if (!m) return undefined
  const o = m.outcomes.find(o => outcomeMatcher(o.name, o.point))
  return o?.price
}

function buildMultiMarketPicks(input: EngineInput): MarketPick[] {
  const { homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h, markets } = input
  const picks: MarketPick[] = []

  // Implied probabilities from 1X2 odds
  let homeP = 0.4, drawP = 0.25, awayP = 0.35
  if (odds) {
    const hp = 1 / odds.home
    const ap = 1 / odds.away
    const dp = odds.draw ? 1 / odds.draw : 0
    const total = hp + ap + dp || 1
    homeP = hp / total
    drawP = dp / total
    awayP = ap / total
  }

  const hF = formScore(homeForm)
  const aF = formScore(awayForm)
  const formDelta = (hF - aF) * 0.012
  homeP = Math.max(0.05, Math.min(0.85, homeP + formDelta))
  awayP = Math.max(0.05, Math.min(0.85, awayP - formDelta))

  // Average goals from h2h
  let h2hGoals = 0
  let h2hCount = 0
  let bothScoredCount = 0
  if (h2h && h2h.length > 0) {
    for (const g of h2h.slice(0, 6)) {
      const hs = g.home.score ?? 0
      const as = g.away.score ?? 0
      h2hGoals += hs + as
      h2hCount++
      if (hs > 0 && as > 0) bothScoredCount++
    }
  }
  const avgGoals = h2hCount > 0 ? h2hGoals / h2hCount : 2.55
  const bttsRate = h2hCount > 0 ? bothScoredCount / h2hCount : 0.5

  // ─── 1X2 ───
  if (odds) {
    const isSoccer = sportSlug === "soccer" || sportSlug === "football"
    const winner = homeP >= awayP ? homeTeam : awayTeam
    const winnerSide: 'home' | 'away' = homeP >= awayP ? 'home' : 'away'
    const winnerP = Math.max(homeP, awayP)
    const drawIsBest = isSoccer && drawP > homeP && drawP > awayP
    if (drawIsBest) {
      picks.push({
        market: "Match Result",
        pick: "Draw",
        odds: odds.draw,
        confidence: Math.round(Math.min(82, drawP * 100)),
        reason: "Tightly priced market with both sides closely matched on form and odds.",
        evalKey: '1x2',
        side: 'draw',
      })
    } else {
      picks.push({
        market: "Match Result",
        pick: `${winner} to win`,
        odds: winner === homeTeam ? odds.home : odds.away,
        confidence: Math.round(Math.min(88, Math.max(40, winnerP * 100))),
        reason: `Bookmakers price ${winner} as favourite with the strongest implied probability.`,
        evalKey: '1x2',
        side: winnerSide,
      })
    }

    // ─── Double Chance ───
    const dc1x = 1 / (homeP + drawP)
    const dcx2 = 1 / (drawP + awayP)
    const dc12 = 1 / (homeP + awayP)
    const dcOptions: Array<{ name: string; p: number; price: number; side: 'home_or_draw' | 'away_or_draw' | 'home_or_away' }> = [
      { name: `${homeTeam} or Draw (1X)`, p: homeP + drawP, price: Math.round(dc1x * 100) / 100, side: 'home_or_draw' },
      { name: `${awayTeam} or Draw (X2)`, p: drawP + awayP, price: Math.round(dcx2 * 100) / 100, side: 'away_or_draw' },
      { name: `${homeTeam} or ${awayTeam} (12)`, p: homeP + awayP, price: Math.round(dc12 * 100) / 100, side: 'home_or_away' },
    ]
    const dcBest = dcOptions.sort((a, b) => b.p - a.p)[0]
    picks.push({
      market: "Double Chance",
      pick: dcBest.name,
      odds: dcBest.price,
      confidence: Math.round(Math.min(94, dcBest.p * 100)),
      reason: "Covers two of the three possible outcomes — lower variance than a straight win bet.",
      evalKey: 'dc',
      side: dcBest.side,
    })

    // ─── Draw No Bet ───
    if (odds.draw) {
      const dnbWinner = homeP >= awayP ? homeTeam : awayTeam
      const dnbSide: 'home' | 'away' = homeP >= awayP ? 'home' : 'away'
      const dnbPrice = dnbSide === 'home'
        ? Math.round((1 / (homeP / (homeP + awayP))) * 100) / 100
        : Math.round((1 / (awayP / (homeP + awayP))) * 100) / 100
      picks.push({
        market: "Draw No Bet",
        pick: dnbWinner,
        odds: dnbPrice,
        confidence: Math.round(Math.min(90, (Math.max(homeP, awayP) / (homeP + awayP)) * 100)),
        reason: `Stake refunded if the match ends level — safer way to back ${dnbWinner}.`,
        evalKey: 'dnb',
        side: dnbSide,
      })
    }
  }

  // ─── BTTS ───
  const bttsYesPrice = findMarketPrice(markets, "btts", n => /yes/i.test(n))
    || (markets ? findMarketPrice(markets, "both_teams_to_score", n => /yes/i.test(n)) : undefined)
  const bttsNoPrice = findMarketPrice(markets, "btts", n => /^no$/i.test(n))
    || (markets ? findMarketPrice(markets, "both_teams_to_score", n => /^no$/i.test(n)) : undefined)
  if (sportSlug === "soccer" || sportSlug === "football") {
    const bttsYes = bttsRate >= 0.5
    picks.push({
      market: "Both Teams to Score",
      pick: bttsYes ? "Yes" : "No",
      odds: bttsYes ? bttsYesPrice : bttsNoPrice,
      confidence: Math.round(Math.min(85, Math.max(50, (bttsYes ? bttsRate : 1 - bttsRate) * 100))),
      reason: bttsYes
        ? `Both sides have found the net in ${Math.round(bttsRate * 100)}% of recent meetings.`
        : `Defenses have controlled the recent meetings — unders BTTS trending.`,
      evalKey: bttsYes ? 'btts_yes' : 'btts_no',
    })
  }

  // ─── Over/Under 1.5, 2.5, 3.5 ───
  for (const line of [1.5, 2.5, 3.5]) {
    const over = avgGoals > line
    const overPrice = findMarketPrice(markets, "totals", (n, p) => /over/i.test(n) && p === line)
      || findMarketPrice(markets, `over_under_${line.toString().replace(".", "_")}`, n => /over/i.test(n))
    const underPrice = findMarketPrice(markets, "totals", (n, p) => /under/i.test(n) && p === line)
      || findMarketPrice(markets, `over_under_${line.toString().replace(".", "_")}`, n => /under/i.test(n))
    const margin = Math.abs(avgGoals - line)
    const conf = Math.round(Math.min(86, 50 + margin * 18))
    picks.push({
      market: `Over / Under ${line}`,
      pick: over ? `Over ${line} goals` : `Under ${line} goals`,
      odds: over ? overPrice : underPrice,
      confidence: conf,
      reason: over
        ? `Recent meetings average ${avgGoals.toFixed(1)} goals — comfortably above the ${line} line.`
        : `Recent meetings average ${avgGoals.toFixed(1)} goals — leaning under ${line}.`,
      evalKey: over ? 'over' : 'under',
      line,
    })
  }

  // ─── Half Time Result ───
  if (odds && (sportSlug === "soccer" || sportSlug === "football")) {
    // HT is statistically more likely to be a draw because fewer goals are scored
    const htDrawP = Math.min(0.55, drawP + 0.18)
    const htWinnerP = (1 - htDrawP) * (homeP / (homeP + awayP))
    const htWinner = homeP >= awayP ? homeTeam : awayTeam
    const htPick = htDrawP > 0.42 ? "Draw at HT" : `${htWinner} leading at HT`
    const conf = htDrawP > 0.42 ? Math.round(htDrawP * 100) : Math.round(Math.min(70, htWinnerP * 100))
    picks.push({
      market: "Half-Time Result",
      pick: htPick,
      confidence: Math.max(45, conf),
      reason: htDrawP > 0.42
        ? "First halves tend to be cagey when neither side dominates the odds."
        : `${htWinner} are more likely to start strongly given the bookmaker pricing.`,
      evalKey: 'ht',
    })
  }

  // ─── Correct score lean ───
  if (odds && (sportSlug === "soccer" || sportSlug === "football")) {
    const winner = homeP >= awayP ? "home" : "away"
    let cs = "1-1"
    if (avgGoals < 1.5) cs = winner === "home" ? "1-0" : "0-1"
    else if (avgGoals < 2.5) cs = winner === "home" ? "2-1" : "1-2"
    else if (avgGoals < 3.5) cs = winner === "home" ? "2-1" : "1-2"
    else cs = winner === "home" ? "3-1" : "1-3"
    picks.push({
      market: "Correct Score (Lean)",
      pick: cs,
      confidence: 18 + Math.round(Math.random() * 8),
      reason: `Most-likely scoreline given a ~${avgGoals.toFixed(1)}-goal expectation.`,
      evalKey: 'cs_lean',
      scoreLean: cs,
    })
  }

  // Sort by confidence desc, but always keep Match Result first
  return picks.sort((a, b) => {
    if (a.market === "Match Result") return -1
    if (b.market === "Match Result") return 1
    return b.confidence - a.confidence
  })
}

// ───────────────────────────────────────────────
// Smart AI engine — pure logical reasoning, ignores odds for the SELECTION
// (odds are still shown so the user knows the price). This is the engine
// that lets a 5.0 underdog beat a 1.x favourite when form / h2h say so.
// ───────────────────────────────────────────────
function buildSmartPicks(input: EngineInput): MarketPick[] {
  const { homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h, markets, lineups } = input
  const picks: MarketPick[] = []

  // ── Score each side from form (last 5) and recent h2h ──
  const hF = formScore(homeForm)              // 0-15
  const aF = formScore(awayForm)              // 0-15
  let homeWinsH2h = 0
  let awayWinsH2h = 0
  let drawsH2h = 0
  let h2hGoals = 0
  let h2hCount = 0
  let bothScoredCount = 0
  if (h2h && h2h.length > 0) {
    for (const g of h2h.slice(0, 6)) {
      const hs = g.home.score ?? 0
      const as = g.away.score ?? 0
      h2hGoals += hs + as
      h2hCount++
      if (hs > 0 && as > 0) bothScoredCount++
      const homeName = g.home.name?.toLowerCase()
      const isHomeOurHome = homeName?.includes(homeTeam.toLowerCase().split(' ')[0])
      if (hs === as) drawsH2h++
      else if ((hs > as && isHomeOurHome) || (as > hs && !isHomeOurHome)) homeWinsH2h++
      else awayWinsH2h++
    }
  }

  // Composite "logic score" 0-100. Heavy on form, then h2h, with a small
  // home-advantage nudge for football.
  const isSoccer = sportSlug === "soccer" || sportSlug === "football"
  const homeAdv = isSoccer ? 6 : 3
  const formWeight = 4         // up to 60 pts from form
  const h2hWeight = h2hCount > 0 ? (30 / h2hCount) : 0  // up to ~30 pts

  // Lineup signal: each available starter scores ~0.3, each known injury
  // costs ~1.2. Standard starting XI for soccer = 11. We only apply this
  // when the lineup is actually published (not pre-match speculation).
  const lineupSignal = (side: { starters?: number; injuries?: number } | undefined) => {
    if (!side) return 0
    const starters = side.starters ?? 0
    const injuries = side.injuries ?? 0
    if (starters === 0 && injuries === 0) return 0
    return starters * 0.3 - injuries * 1.2
  }
  const homeLineupBonus = lineupSignal(lineups?.home)
  const awayLineupBonus = lineupSignal(lineups?.away)

  const homeRaw = hF * formWeight + homeWinsH2h * h2hWeight + homeAdv + homeLineupBonus
  const awayRaw = aF * formWeight + awayWinsH2h * h2hWeight + awayLineupBonus
  const drawRaw = drawsH2h * h2hWeight + (Math.abs(hF - aF) <= 2 ? 12 : 0)

  const total = homeRaw + awayRaw + drawRaw || 1
  const homeP = homeRaw / total
  const awayP = awayRaw / total
  const drawP = drawRaw / total

  const avgGoals = h2hCount > 0 ? h2hGoals / h2hCount : 2.55
  const bttsRate = h2hCount > 0 ? bothScoredCount / h2hCount : 0.5

  // ── 1X2 — pure logic ──
  let pickSide: 'home' | 'away' | 'draw' = homeP >= awayP ? 'home' : 'away'
  let pickP = Math.max(homeP, awayP)
  if (isSoccer && drawP > pickP) {
    pickSide = 'draw'
    pickP = drawP
  }
  const pickName = pickSide === 'home' ? homeTeam : pickSide === 'away' ? awayTeam : 'Draw'
  const pickOdds = pickSide === 'home' ? odds?.home : pickSide === 'away' ? odds?.away : odds?.draw

  // Detect "underdog" — Smart AI overrides the favourite.
  const isUnderdog =
    !!odds &&
    pickSide !== 'draw' &&
    pickOdds !== undefined &&
    ((pickSide === 'home' && odds.home > odds.away) ||
      (pickSide === 'away' && odds.away > odds.home))

  const formText =
    pickSide === 'home'
      ? `${homeTeam} are in better recent form (${homeForm || '—'} vs ${awayForm || '—'})`
      : pickSide === 'away'
        ? `${awayTeam} are in better recent form (${awayForm || '—'} vs ${homeForm || '—'})`
        : `Both sides are evenly matched on form and have drawn in past meetings`

  picks.push({
    market: "Match Result",
    pick: pickSide === 'draw' ? 'Draw' : `${pickName} to win`,
    odds: pickOdds,
    confidence: Math.round(Math.min(90, Math.max(45, pickP * 100))),
    reason: isUnderdog
      ? `Smart pick: ${formText}. Bookmakers have them as underdogs at ${pickOdds?.toFixed(2)} — value bet.`
      : `${formText}${h2hCount > 0 ? `, with ${pickSide === 'home' ? homeWinsH2h : pickSide === 'away' ? awayWinsH2h : drawsH2h}/${h2hCount} of recent meetings going their way` : ''}.`,
    evalKey: '1x2',
    side: pickSide,
  })

  // ── Double Chance — based on logic probabilities ──
  if (isSoccer) {
    const dcOptions: Array<{ name: string; p: number; side: 'home_or_draw' | 'away_or_draw' | 'home_or_away' }> = [
      { name: `${homeTeam} or Draw (1X)`, p: homeP + drawP, side: 'home_or_draw' },
      { name: `${awayTeam} or Draw (X2)`, p: drawP + awayP, side: 'away_or_draw' },
      { name: `${homeTeam} or ${awayTeam} (12)`, p: homeP + awayP, side: 'home_or_away' },
    ]
    const dcBest = dcOptions.sort((a, b) => b.p - a.p)[0]
    picks.push({
      market: "Double Chance",
      pick: dcBest.name,
      confidence: Math.round(Math.min(94, dcBest.p * 100)),
      reason: "Hedges the logical pick — covers two outcomes the model rates highest.",
      evalKey: 'dc',
      side: dcBest.side,
    })
  }

  // ── BTTS — driven by h2h scoring patterns ──
  if (isSoccer) {
    const bttsYes = bttsRate >= 0.45 || (hF >= 6 && aF >= 6)
    const bttsYesPrice = findMarketPrice(markets, "btts", n => /yes/i.test(n))
    const bttsNoPrice = findMarketPrice(markets, "btts", n => /^no$/i.test(n))
    picks.push({
      market: "Both Teams to Score",
      pick: bttsYes ? "Yes" : "No",
      odds: bttsYes ? bttsYesPrice : bttsNoPrice,
      confidence: Math.round(Math.min(85, Math.max(50, (bttsYes ? bttsRate : 1 - bttsRate) * 100 + 10))),
      reason: bttsYes
        ? `Both attacks are firing — ${Math.round(bttsRate * 100)}% BTTS rate in recent meetings.`
        : `At least one defence has been watertight in the recent run — leaning No.`,
      evalKey: bttsYes ? 'btts_yes' : 'btts_no',
    })
  }

  // ── Goal totals — logic from h2h average ──
  const line = avgGoals >= 3 ? 2.5 : avgGoals >= 2 ? 2.5 : 1.5
  const over = avgGoals > line
  const overPrice = findMarketPrice(markets, "totals", (n, p) => /over/i.test(n) && p === line)
  const underPrice = findMarketPrice(markets, "totals", (n, p) => /under/i.test(n) && p === line)
  picks.push({
    market: `Over / Under ${line}`,
    pick: over ? `Over ${line} goals` : `Under ${line} goals`,
    odds: over ? overPrice : underPrice,
    confidence: Math.round(Math.min(86, 55 + Math.abs(avgGoals - line) * 20)),
    reason: over
      ? `Recent meetings average ${avgGoals.toFixed(1)} goals — game projects to be open.`
      : `Recent meetings average ${avgGoals.toFixed(1)} goals — leaning to a tight, low-scoring affair.`,
    evalKey: over ? 'over' : 'under',
    line,
  })

  return picks.sort((a, b) => {
    if (a.market === "Match Result") return -1
    if (b.market === "Match Result") return 1
    return b.confidence - a.confidence
  })
}
