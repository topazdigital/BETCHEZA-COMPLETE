"use client"

import { Brain, Sparkles, Check, X, MinusCircle, TrendingUp, Lightbulb, Archive } from "lucide-react"
import { useMemo, useState, useEffect } from "react"
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
  /** Match ID — used to snapshot pre-match odds to localStorage so they survive after the match ends */
  matchId?: string
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
  matchId,
}: AIMultiMarketProps) {
  // Default to Smart AI — pure logic on form / H2H / lineups, ignores
  // bookmaker pricing for the SELECTION (price still shown so users see value).
  const [mode, setMode] = useState<'odds' | 'smart'>('smart')

  // ── Pre-match odds snapshot ──────────────────────────────────────────────
  // Bookmakers pull odds the moment a match kicks off / finishes. We snapshot
  // them to localStorage when they're live so they can be shown (read-only) as
  // "Pre-match odds" after the match ends — exactly like OddsPedia does.
  const isFinalStatus =
    status === 'finished' || status === 'final' || status === 'ft' || status === 'ended'

  const [frozenOdds, setFrozenOdds]       = useState<{ home: number; draw?: number; away: number } | null>(null)
  const [frozenMarkets, setFrozenMarkets] = useState<Market[] | null>(null)
  const [frozenForm, setFrozenForm]       = useState<{ home?: string; away?: string } | null>(null)
  const [frozenH2h, setFrozenH2h]         = useState<AIMultiMarketProps['h2h'] | null>(null)
  const [usingFrozen, setUsingFrozen]     = useState(false)

  // Any signal worth remembering — not just odds. Form/H2H alone are enough
  // for Smart AI mode to produce picks, so they must be snapshotted too.
  const hasCurrentSignal = !!(odds || homeForm || awayForm || (h2h && h2h.length > 0))

  useEffect(() => {
    if (!matchId) return
    const key = `betcheza_prematch_${matchId}`
    if (hasCurrentSignal && !isFinalStatus) {
      // Save whatever signals are live (odds, form, h2h) while the match is
      // upcoming / live, so they survive after the provider stops returning
      // them post-kickoff or post-final-whistle.
      try {
        localStorage.setItem(key, JSON.stringify({
          odds: odds ?? null,
          markets: markets ?? null,
          form: { home: homeForm, away: awayForm },
          h2h: h2h ?? null,
        }))
      } catch { /* localStorage unavailable (SSR / private) */ }
    } else if (isFinalStatus) {
      // Match finished — restore whichever signals the provider has stopped
      // returning from the pre-match snapshot. Restore each field
      // independently rather than gating on "no live signal at all": a
      // finished match can still have live form/H2H while odds/markets have
      // gone missing (or vice-versa), and odds-mode specifically needs odds
      // even when smart-mode signals are still flowing.
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const snap = JSON.parse(raw)
          if (!odds) setFrozenOdds(snap.odds ?? null)
          if (!markets) setFrozenMarkets(snap.markets ?? null)
          if (!homeForm && !awayForm) setFrozenForm(snap.form ?? null)
          if (!h2h || h2h.length === 0) setFrozenH2h(snap.h2h ?? null)
          setUsingFrozen(true)
        }
      } catch { /* ignore parse errors */ }
    }
  }, [matchId, odds, markets, homeForm, awayForm, h2h, isFinalStatus, hasCurrentSignal])

  // Use frozen signals as fallback when live signals have gone missing
  const effectiveOdds    = odds ?? frozenOdds
  const effectiveMarkets = markets ?? frozenMarkets
  const effectiveHomeForm = homeForm ?? frozenForm?.home
  const effectiveAwayForm = awayForm ?? frozenForm?.away
  const effectiveH2h      = (h2h && h2h.length > 0) ? h2h : (frozenH2h ?? h2h)

  // Picks recompute whenever any input changes (odds, form, h2h, markets, lineups).
  // We intentionally do NOT lock picks — the algorithm is deterministic so the
  // same inputs always produce the same output, and locking was preventing picks
  // from updating when async data (h2h, form) arrived after the initial render.
  const picks = useMemo(() => {
    if (mode === 'smart') {
      // Smart AI runs on form + H2H — doesn't require odds.
      // Frozen signals (pre-match snapshot) are used as a fallback once the
      // live provider stops returning them (post-kickoff / post-final).
      const hasAnyData = !!(effectiveHomeForm || effectiveAwayForm || (effectiveH2h && effectiveH2h.length > 0) || effectiveOdds)
      if (!hasAnyData) return []
      return buildSmartPicks({ homeTeam, awayTeam, sportSlug, odds: effectiveOdds ?? null, homeForm: effectiveHomeForm, awayForm: effectiveAwayForm, h2h: effectiveH2h, markets: effectiveMarkets || null, lineups: lineups || null })
    }
    // Odds-based mode requires odds — fall back to the frozen pre-match snapshot too.
    if (!effectiveOdds) return []
    return buildMultiMarketPicks({ homeTeam, awayTeam, sportSlug, odds: effectiveOdds, homeForm: effectiveHomeForm, awayForm: effectiveAwayForm, h2h: effectiveH2h, markets: effectiveMarkets || null, lineups: lineups || null })
  }, [mode, homeTeam, awayTeam, sportSlug, effectiveOdds, effectiveMarkets, effectiveHomeForm, effectiveAwayForm, effectiveH2h, lineups])

  const isFinal =
    isFinalStatus &&
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

  // For finished matches: never hide the block — show a "no pre-match data" notice
  // so users can see the match ended but analysis wasn't available (vs. nothing at all).
  if (picks.length === 0) {
    if (!isFinal) return null   // upcoming/live with no data → hide silently
    return (
      <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-transparent overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-fuchsia-500/20 bg-fuchsia-500/5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 shadow-lg">
            <Brain className="h-4 w-4 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-black ring-2 ring-background">AI</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-foreground">AI Picks — All Markets</h3>
              <span className="text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white px-1.5 py-0.5 rounded">Beta</span>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded">Match Ended</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {homeScore} – {awayScore} · Final
            </p>
          </div>
        </div>
        <div className="px-4 py-5 flex items-start gap-3">
          <Archive className="h-5 w-5 text-muted-foreground/50 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Pre-match analysis not available</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No pre-match odds or form data was captured for this game. AI picks are generated before kick-off — visit upcoming matches to see picks in action.
            </p>
          </div>
        </div>
      </div>
    )
  }

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
            {usingFrozen && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide bg-sky-500/10 text-sky-600 border border-sky-500/25 px-1.5 py-0.5 rounded">
                <Archive className="h-2.5 w-2.5 shrink-0" />
                Pre-match odds
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

  // ─── 1X2 / Moneyline ───
  if (odds) {
    const isSoccerMatch = sportSlug === "soccer" || sportSlug === "football"
    const winner = homeP >= awayP ? homeTeam : awayTeam
    const winnerSide: 'home' | 'away' = homeP >= awayP ? 'home' : 'away'
    const winnerP = Math.max(homeP, awayP)
    const drawIsBest = isSoccerMatch && drawP > homeP && drawP > awayP
    // Soccer/rugby/cricket → "Match Result"; no-draw sports → "Moneyline"
    const primaryMarketName = isSoccerMatch ? "Match Result" : "Moneyline"
    if (drawIsBest) {
      picks.push({
        market: primaryMarketName,
        pick: "Draw",
        odds: odds.draw,
        confidence: Math.round(Math.min(82, drawP * 100)),
        reason: "Tightly priced market with both sides closely matched on form and odds.",
        evalKey: '1x2',
        side: 'draw',
      })
    } else {
      picks.push({
        market: primaryMarketName,
        pick: `${winner} to win`,
        odds: winner === homeTeam ? odds.home : odds.away,
        confidence: Math.round(Math.min(88, Math.max(40, winnerP * 100))),
        reason: `Bookmakers price ${winner} as favourite with the strongest implied probability.`,
        evalKey: '1x2',
        side: winnerSide,
      })
    }

    // ─── Double Chance — soccer/rugby only (requires a draw outcome) ───
    if (isSoccerMatch && odds.draw) {
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
    }

    // ─── Draw No Bet — soccer/rugby only ───
    if (isSoccerMatch && odds.draw) {
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
    // Use > 0.5 (strict) so the default rate of 0.5 (no H2H data) picks No,
    // avoiding the previous always-Yes bias from the 0.5 >= 0.5 comparison.
    const bttsYes = bttsRate > 0.5
    picks.push({
      market: "Both Teams to Score",
      pick: bttsYes ? "Yes" : "No",
      odds: bttsYes ? bttsYesPrice : bttsNoPrice,
      confidence: Math.round(Math.min(85, Math.max(50, (bttsYes ? bttsRate : 1 - bttsRate) * 100))),
      reason: bttsYes
        ? h2hCount > 0
          ? `Both sides have found the net in ${Math.round(bttsRate * 100)}% of recent meetings.`
          : `Implied probabilities and form lean toward both attacks getting on the scoresheet.`
        : h2hCount > 0
          ? `Defenses have controlled the recent meetings — unders BTTS trending.`
          : `Defensive shape and odds suggest at least one clean sheet is likely.`,
      evalKey: bttsYes ? 'btts_yes' : 'btts_no',
    })
  }

  // ─── Over/Under — soccer/football only (goals-based lines) ───
  if (sportSlug === "soccer" || sportSlug === "football") {
    // When there's no H2H data, use totals market odds to determine direction
    // rather than the old default of 2.55 which always picked Over 2.5.
    const effectiveAvgGoals = (() => {
      if (h2hCount > 0) return avgGoals
      const totMkt = markets?.find(m =>
        (m.key ?? '').toLowerCase().includes('total') ||
        m.name.toLowerCase().includes('over')
      )
      if (totMkt) {
        const overO = totMkt.outcomes.find(o => /over/i.test(o.name))
        const underO = totMkt.outcomes.find(o => /under/i.test(o.name))
        if (overO && underO) return underO.price < overO.price ? 2.3 : 2.7
      }
      // Fall back to 1X2 implied strength as a proxy for goal expectation
      const favP = Math.max(homeP, awayP)
      return favP > 0.60 ? 2.3 : favP < 0.42 ? 2.7 : 2.5
    })()

    for (const line of [1.5, 2.5, 3.5]) {
      const over = effectiveAvgGoals > line
      const overPrice = findMarketPrice(markets, "totals", (n, p) => /over/i.test(n) && p === line)
        || findMarketPrice(markets, `over_under_${line.toString().replace(".", "_")}`, n => /over/i.test(n))
      const underPrice = findMarketPrice(markets, "totals", (n, p) => /under/i.test(n) && p === line)
        || findMarketPrice(markets, `over_under_${line.toString().replace(".", "_")}`, n => /under/i.test(n))
      const margin = Math.abs(effectiveAvgGoals - line)
      const conf = Math.round(Math.min(86, 50 + margin * 18))
      picks.push({
        market: `Over / Under ${line} Goals`,
        pick: over ? `Over ${line} Goals` : `Under ${line} Goals`,
        odds: over ? overPrice : underPrice,
        confidence: conf,
        reason: over
          ? h2hCount > 0
            ? `Recent meetings average ${effectiveAvgGoals.toFixed(1)} goals — comfortably above the ${line} line.`
            : `Market pricing and team profiles project an open game above ${line} goals.`
          : h2hCount > 0
            ? `Recent meetings average ${effectiveAvgGoals.toFixed(1)} goals — leaning under ${line}.`
            : `Odds and defensive shape suggest a tight, lower-scoring contest.`,
        evalKey: over ? 'over' : 'under',
        line,
      })
    }
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
      confidence: 18 + (Math.abs(homeTeam.charCodeAt(0) - awayTeam.charCodeAt(0)) % 8),
      reason: `Most-likely scoreline given a ~${avgGoals.toFixed(1)}-goal expectation.`,
      evalKey: 'cs_lean',
      scoreLean: cs,
    })
  }

  const isPrimary = (m: string) => m === "Match Result" || m === "Moneyline"
  return picks.sort((a, b) => {
    if (isPrimary(a.market)) return -1
    if (isPrimary(b.market)) return 1
    return b.confidence - a.confidence
  })
}

// ───────────────────────────────────────────────
// Smart AI engine — Tony Bloom-inspired multi-signal analysis.
// Logic first, odds second. Underdogs can and do win. Every market
// (BTTS Yes/No, Over/Under, draw, away win) is equally on the table.
// ───────────────────────────────────────────────

/** Rich form breakdown from a "WWDLW" string */
function parseForm(raw?: string) {
  const chars = (raw || '').toUpperCase().replace(/[^WDL]/g, '').split('').slice(0, 5)
  const wins   = chars.filter(c => c === 'W').length
  const draws  = chars.filter(c => c === 'D').length
  const losses = chars.filter(c => c === 'L').length
  const games  = chars.length
  const pts    = wins * 3 + draws
  // Momentum: last 2 games weighted more — recent form matters most
  const recent = chars.slice(-2)
  const momentum = recent.reduce((s, c) => s + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0) // 0-6
  // Draw tendency (≥2 draws in 5 = team that ties a lot)
  const drawTendency = draws >= 2
  // Losing streak signal (≥3 losses = bad form, may be defensive / demoralised)
  const losingStreak = losses >= 3
  // Winning streak (≥3 wins = in-form, dangerous)
  const winStreak = wins >= 3
  // Clean-sheet proxy: high win rate with some draws suggests defensive solidity
  const solidProxy = wins / Math.max(games, 1)   // 0-1
  return { wins, draws, losses, games, pts, momentum, drawTendency, losingStreak, winStreak, solidProxy }
}

/** Analyse H2H array for richer signals */
function parseH2H(
  h2h: Array<{ home: { name: string; score?: number }; away: { name: string; score?: number } }> | null | undefined,
  homeTeam: string,
) {
  if (!h2h || h2h.length === 0) return null
  let homeWins = 0, awayWins = 0, draws = 0
  let totalGoals = 0, bothScored = 0
  let homeGoals = 0, awayGoals = 0
  const games = Math.min(h2h.length, 6)
  for (const g of h2h.slice(0, games)) {
    const hs = g.home.score ?? 0
    const as = g.away.score ?? 0
    totalGoals += hs + as
    if (hs > 0 && as > 0) bothScored++
    const isOurHome = g.home.name?.toLowerCase().includes(homeTeam.toLowerCase().split(' ')[0])
    if (isOurHome) { homeGoals += hs; awayGoals += as }
    else            { homeGoals += as; awayGoals += hs }  // swap perspective
    if (hs === as) draws++
    else if ((hs > as && isOurHome) || (as > hs && !isOurHome)) homeWins++
    else awayWins++
  }
  const avgGoals   = totalGoals / games
  const bttsRate   = bothScored / games
  const avgHomG    = homeGoals  / games
  const avgAwayG   = awayGoals  / games
  // Dominant side
  const dominant = homeWins > awayWins ? 'home' : awayWins > homeWins ? 'away' : 'even'
  // Recent trend: last 2 H2H vs overall
  const recentGames = h2h.slice(0, 2)
  let recentHomeW = 0, recentAwayW = 0
  for (const g of recentGames) {
    const hs = g.home.score ?? 0, as = g.away.score ?? 0
    const isOurHome = g.home.name?.toLowerCase().includes(homeTeam.toLowerCase().split(' ')[0])
    if (hs > as && isOurHome) recentHomeW++
    else if (as > hs && !isOurHome) recentHomeW++
    else if (hs > as && !isOurHome) recentAwayW++
    else if (as > hs && isOurHome) recentAwayW++
  }
  const recentTrend: 'home' | 'away' | 'even' =
    recentHomeW > recentAwayW ? 'home' : recentAwayW > recentHomeW ? 'away' : 'even'
  return { homeWins, awayWins, draws, games, avgGoals, bttsRate, avgHomG, avgAwayG, dominant, recentTrend }
}

function buildSmartPicks(input: EngineInput): MarketPick[] {
  const { homeTeam, awayTeam, sportSlug, odds, homeForm, awayForm, h2h, markets, lineups } = input
  const picks: MarketPick[] = []

  const isSoccer = sportSlug === "soccer" || sportSlug === "football"

  // ── Rich form analysis ──
  const hForm = parseForm(homeForm)
  const aForm = parseForm(awayForm)
  const hasFormData = hForm.games > 0 || aForm.games > 0

  // ── Rich H2H analysis ──
  const hx = parseH2H(h2h, homeTeam)
  const hasH2H = hx !== null

  // ── Lineup injury signal ──
  const injuryHit = (side: { starters?: number; injuries?: number } | undefined) => {
    if (!side) return 0
    const injuries = side.injuries ?? 0
    const starters = side.starters ?? 0
    if (starters === 0 && injuries === 0) return 0
    return injuries * 1.5 - starters * 0.2  // positive = hurt, negative = strong squad
  }
  const homeInjuryHit = injuryHit(lineups?.home)
  const awayInjuryHit = injuryHit(lineups?.away)

  // ── Bookmaker implied probs (used only as confirmation, never primary driver) ──
  let oddsHomeP = 0.40, oddsDrawP = 0.25, oddsAwayP = 0.35
  if (odds) {
    const rH = 1 / Math.max(odds.home, 1.01)
    const rA = 1 / Math.max(odds.away, 1.01)
    const rD = odds.draw ? 1 / Math.max(odds.draw, 1.01) : 0
    const t  = rH + rA + rD || 1
    oddsHomeP = rH / t; oddsDrawP = rD / t; oddsAwayP = rA / t
  }
  // Detect match profile from odds: big favourite vs even contest
  const favOdds = odds ? Math.min(odds.home, odds.away) : 2.0
  const isBigFavourite = favOdds < 1.45          // e.g. 1-1.44 = heavy favourite
  const isOpenContest  = favOdds >= 2.00          // close, both teams price > 2.0

  // ── Logic score — form + H2H + home advantage + lineups ──
  // Home advantage in football is real: ~0.4 expected goal boost
  const homeAdv  = isSoccer ? 7 : 3
  // Form: momentum (last 2 games) carries twice the weight of older results
  const hFormPts = hForm.pts + hForm.momentum * 1.5 - homeInjuryHit * 2
  const aFormPts = aForm.pts + aForm.momentum * 1.5 - awayInjuryHit * 2

  // H2H scores: recent trend overrides overall if they diverge
  let hH2hScore = 0, aH2hScore = 0, dH2hScore = 0
  if (hx) {
    const trendBoost = 1.4  // recent 2 games matter more than history
    hH2hScore = hx.homeWins * 3 + (hx.recentTrend === 'home' ? hx.homeWins * trendBoost : 0)
    aH2hScore = hx.awayWins * 3 + (hx.recentTrend === 'away' ? hx.awayWins * trendBoost : 0)
    dH2hScore = hx.draws * 2
  }

  // Draw bias: only apply when form is genuinely close AND both teams show draw tendency
  const formGap     = Math.abs(hFormPts - aFormPts)
  const bothDrawers = hForm.drawTendency && aForm.drawTendency
  const drawBias    = (hasFormData && formGap <= 3 && isSoccer) ? (bothDrawers ? 12 : 6) : 0

  const homeRaw = hFormPts * 2.5 + hH2hScore + homeAdv
  const awayRaw = aFormPts * 2.5 + aH2hScore
  const drawRaw = dH2hScore + drawBias

  const rawTotal = homeRaw + awayRaw + drawRaw || 1
  let homeP = homeRaw / rawTotal
  let awayP = awayRaw / rawTotal
  let drawP = drawRaw / rawTotal

  // No form/H2H at all → fall back to odds, but flag low confidence
  if (!hasFormData && !hasH2H && odds) {
    homeP = oddsHomeP; awayP = oddsAwayP; drawP = oddsDrawP
  }

  // ── 1X2 / Moneyline — logic decides, odds used only to detect upsets ──
  let pickSide: 'home' | 'away' | 'draw' = homeP >= awayP ? 'home' : 'away'
  let pickP = Math.max(homeP, awayP)
  if (isSoccer && drawP > pickP) { pickSide = 'draw'; pickP = drawP }

  const pickName  = pickSide === 'home' ? homeTeam : pickSide === 'away' ? awayTeam : 'Draw'
  const pickOdds  = pickSide === 'home' ? odds?.home : pickSide === 'away' ? odds?.away : odds?.draw
  const isUnderdog =
    !!odds && pickSide !== 'draw' && pickOdds !== undefined &&
    ((pickSide === 'home' && odds.home > odds.away * 1.1) ||
     (pickSide === 'away' && odds.away > odds.home * 1.1))

  // Build vivid match-result reasoning from available signals
  const resultReason = (() => {
    const parts: string[] = []
    // Form narrative
    if (hasFormData) {
      if (pickSide === 'home') {
        if (hForm.winStreak)  parts.push(`${homeTeam} are on a strong run (${homeForm}) heading into this`)
        else if (hForm.momentum >= 4) parts.push(`${homeTeam} come in with good recent momentum (${homeForm})`)
        else parts.push(`${homeTeam} show the stronger form (${homeForm} vs ${awayForm})`)
        if (aForm.losingStreak) parts.push(`${awayTeam} have struggled badly in recent outings`)
      } else if (pickSide === 'away') {
        if (aForm.winStreak)  parts.push(`${awayTeam} arrive in outstanding form (${awayForm})`)
        else if (aForm.momentum >= 4) parts.push(`${awayTeam} carry strong recent momentum (${awayForm})`)
        else parts.push(`${awayTeam} are the better-performing side on current form (${awayForm} vs ${homeForm})`)
        if (hForm.losingStreak) parts.push(`${homeTeam} look fragile — struggling to win lately`)
      } else {
        parts.push(`Form is evenly balanced (${homeForm} vs ${awayForm}) — a draw is the logical outcome`)
        if (bothDrawers) parts.push(`both sides tend to draw rather than win, reinforcing the stalemate`)
      }
    }
    // H2H narrative
    if (hx) {
      if (pickSide === 'home' && hx.homeWins >= 3)
        parts.push(`dominant in ${hx.homeWins}/${hx.games} H2H meetings`)
      else if (pickSide === 'away' && hx.awayWins >= 3)
        parts.push(`has won ${hx.awayWins}/${hx.games} of recent encounters`)
      else if (pickSide === 'draw' && hx.draws >= 2)
        parts.push(`${hx.draws} of the last ${hx.games} H2H meetings ended level`)
      else if (hx.recentTrend !== 'even' && hx.recentTrend === pickSide)
        parts.push(`recent H2H trend also tilts ${pickSide === 'home' ? homeTeam : awayTeam}'s way`)
    }
    // Injury / lineup
    if (homeInjuryHit > 2 && pickSide !== 'home') parts.push(`${homeTeam} hit by injuries to key players`)
    if (awayInjuryHit > 2 && pickSide !== 'away') parts.push(`${awayTeam} missing important starters`)
    // Underdog flag
    if (isUnderdog)
      parts.push(`bookmakers have them as underdogs at ${pickOdds?.toFixed(2)} — this is a genuine value pick`)
    if (parts.length === 0) parts.push(`logic model rates ${pickName} the more likely outcome`)
    return parts.slice(0, 3).join('; ') + '.'
  })()

  const smartPrimaryMarket = isSoccer ? "Match Result" : "Moneyline"
  picks.push({
    market: smartPrimaryMarket,
    pick: pickSide === 'draw' ? 'Draw' : `${pickName} to win`,
    odds: pickOdds,
    confidence: Math.round(Math.min(88, Math.max(44, pickP * 100 + (isUnderdog ? -5 : 0)))),
    reason: resultReason,
    evalKey: '1x2',
    side: pickSide,
  })

  // ── Double Chance — based on logic probabilities, with smart narrative ──
  if (isSoccer) {
    const dcOptions: Array<{ name: string; p: number; side: 'home_or_draw' | 'away_or_draw' | 'home_or_away'; reason: string }> = [
      {
        name: `${homeTeam} or Draw (1X)`,
        p: homeP + drawP,
        side: 'home_or_draw',
        reason: pickSide === 'home'
          ? `Safer hedge on ${homeTeam}'s form edge — a draw still returns.`
          : `${homeTeam} aren't convincing enough to back outright; 1X covers both likely outcomes.`,
      },
      {
        name: `${awayTeam} or Draw (X2)`,
        p: drawP + awayP,
        side: 'away_or_draw',
        reason: pickSide === 'away'
          ? `Logical hedge behind ${awayTeam}'s advantage — keeps the draw in play.`
          : `${awayTeam} are capable of at least a point here; X2 covers both rational outcomes.`,
      },
      {
        name: `${homeTeam} or ${awayTeam} (12)`,
        p: homeP + awayP,
        side: 'home_or_away',
        reason: `Both teams are attacking — a draw looks unlikely; 12 backs a decisive result.`,
      },
    ]
    const dcBest = dcOptions.sort((a, b) => b.p - a.p)[0]
    picks.push({
      market: "Double Chance",
      pick: dcBest.name,
      confidence: Math.round(Math.min(93, dcBest.p * 100)),
      reason: dcBest.reason,
      evalKey: 'dc',
      side: dcBest.side,
    })
  }

  // ── BTTS — multi-signal qualitative analysis ──
  if (isSoccer) {
    const bttsYesPrice = findMarketPrice(markets, "btts", n => /yes/i.test(n))
      || findMarketPrice(markets, "both_teams_to_score", n => /yes/i.test(n))
    const bttsNoPrice  = findMarketPrice(markets, "btts", n => /^no$/i.test(n))
      || findMarketPrice(markets, "both_teams_to_score", n => /^no$/i.test(n))

    // Signals for Yes
    let yesScore = 0, noScore = 0
    const bttsCues: string[] = []

    // 1. H2H BTTS rate — strongest signal
    if (hx) {
      if (hx.bttsRate >= 0.67)      { yesScore += 3; bttsCues.push(`both scored in ${Math.round(hx.bttsRate * 100)}% of recent meetings`) }
      else if (hx.bttsRate >= 0.50) { yesScore += 1; bttsCues.push(`slightly more meetings had both teams scoring`) }
      else if (hx.bttsRate <= 0.33) { noScore  += 3; bttsCues.push(`only ${Math.round(hx.bttsRate * 100)}% of recent H2H meetings saw both score`) }
      else                          { noScore  += 1; bttsCues.push(`fewer than half of H2H meetings went BTTS`) }
      // Average goals per team — if either averages <0.5, hard to score
      if (hx.avgHomG < 0.5 || hx.avgAwayG < 0.5) { noScore += 2; bttsCues.push(`one side rarely scores in this fixture`) }
    }

    // 2. Big favourite = likely clean sheet for the strong side → No
    if (isBigFavourite) { noScore += 2; bttsCues.push(`heavy favourite likely keeps a clean sheet`) }
    else if (isOpenContest) { yesScore += 1; bttsCues.push(`open, competitive odds — both sides will attack`) }

    // 3. Both teams in winning form = both attack, both may concede
    if (hForm.wins >= 2 && aForm.wins >= 2) { yesScore += 2; bttsCues.push(`both sides are scoring and winning regularly`) }

    // 4. Losing teams often fail to score
    if (hForm.losingStreak) { noScore += 2; bttsCues.push(`${homeTeam} have struggled to find the net recently`) }
    if (aForm.losingStreak) { noScore += 2; bttsCues.push(`${awayTeam} have looked toothless going forward`) }

    // 5. Draw-heavy teams tend to involve goals on both sides (1-1, 2-2)
    if (hForm.drawTendency && aForm.drawTendency) { yesScore += 1; bttsCues.push(`both sides often draw, which usually means goals at both ends`) }

    // 6. Market odds as tiebreaker
    if (bttsYesPrice && bttsNoPrice) {
      if (bttsYesPrice < bttsNoPrice) { yesScore += 1 }
      else if (bttsNoPrice < bttsYesPrice) { noScore += 1 }
    }

    const bttsYes = yesScore >= noScore
    const bttsMargin = Math.abs(yesScore - noScore)
    const bttsConf = Math.round(Math.min(84, Math.max(51, 55 + bttsMargin * 5)))
    const bttsTopCue = bttsCues[0] || (bttsYes ? 'attacking profiles suggest both teams will score' : 'defensive solidity from at least one side expected')

    picks.push({
      market: "Both Teams to Score",
      pick: bttsYes ? "Yes" : "No",
      odds: bttsYes ? bttsYesPrice : bttsNoPrice,
      confidence: bttsConf,
      reason: bttsYes
        ? `Yes — ${bttsTopCue}${bttsCues[1] ? `; ${bttsCues[1]}` : ''}.`
        : `No — ${bttsTopCue}${bttsCues[1] ? `; ${bttsCues[1]}` : ''}.`,
      evalKey: bttsYes ? 'btts_yes' : 'btts_no',
    })
  }

  // ── Over / Under 2.5 Goals — qualitative goal expectation ──
  if (isSoccer) {
    let overScore = 0, underScore = 0
    const goalCues: string[] = []

    // 1. H2H average goals — definitive when available
    if (hx) {
      if (hx.avgGoals >= 3.2)      { overScore += 4; goalCues.push(`meetings average ${hx.avgGoals.toFixed(1)} goals — prolific fixture`) }
      else if (hx.avgGoals >= 2.6) { overScore += 2; goalCues.push(`H2H averages ${hx.avgGoals.toFixed(1)} goals — tends to be open`) }
      else if (hx.avgGoals <= 1.8) { underScore += 4; goalCues.push(`tight historically — only ${hx.avgGoals.toFixed(1)} goals per meeting`) }
      else if (hx.avgGoals <= 2.4) { underScore += 2; goalCues.push(`H2H typically cautious — ${hx.avgGoals.toFixed(1)} goals per game`) }
    }

    // 2. Big favourite often controls and wins low (1-0 type scorelines)
    if (isBigFavourite) { underScore += 2; goalCues.push(`heavy favourite tends to control and close out tightly`) }
    else if (isOpenContest) { overScore += 1; goalCues.push(`evenly matched sides — both must go for it`) }

    // 3. Both teams in attacking form
    if (hForm.wins >= 3 && aForm.wins >= 2) { overScore += 2; goalCues.push(`both sides are prolific and clinical lately`) }
    else if (hForm.wins >= 2 && aForm.wins >= 2) { overScore += 1; goalCues.push(`both teams scoring regularly`) }

    // 4. Losing teams struggle to score, making games lower-scoring
    if (hForm.losingStreak && aForm.losingStreak) { underScore += 3; goalCues.push(`both sides in poor form — expect a scrappy, low-scoring affair`) }
    else if (hForm.losingStreak || aForm.losingStreak) { underScore += 1; goalCues.push(`at least one side has been poor going forward`) }

    // 5. High draw tendency from both sides suggests 0-0 or 1-1 type games
    if (hForm.drawTendency && aForm.drawTendency && !hx) {
      underScore += 1; goalCues.push(`both teams draw a lot — hints at cagey, low-scoring style`)
    }

    // 6. Tactical/momentum signal: if one side in winning streak they may grind, not attack
    if (hForm.winStreak && !aForm.winStreak) { underScore += 1; goalCues.push(`${homeTeam} will protect their lead mentality`) }

    // 7. Market odds tiebreaker
    const totMkt = markets?.find(m =>
      (m.key ?? '').toLowerCase().includes('total') ||
      m.name.toLowerCase().includes('over')
    )
    if (totMkt) {
      const mOver = totMkt.outcomes.find(o => /over/i.test(o.name))
      const mUnder = totMkt.outcomes.find(o => /under/i.test(o.name))
      if (mOver && mUnder) {
        if (mOver.price < mUnder.price)        overScore += 1
        else if (mUnder.price < mOver.price)   underScore += 1
      }
    } else if (odds && !hx) {
      // No market data: open contest (balanced odds) → lean over; lopsided → lean under
      if (isOpenContest)  overScore += 1
      if (isBigFavourite) underScore += 1
    }

    const line = 2.5
    const pickOver = overScore >= underScore
    const goalMargin = Math.abs(overScore - underScore)
    const goalConf = Math.round(Math.min(85, Math.max(51, 54 + goalMargin * 6)))
    const overPrice  = findMarketPrice(markets, "totals", (n, p) => /over/i.test(n)  && p === line)
    const underPrice = findMarketPrice(markets, "totals", (n, p) => /under/i.test(n) && p === line)
    const topGoalCue = goalCues[0] || (pickOver ? 'open, attacking contest expected' : 'tight, low-scoring affair expected')

    picks.push({
      market: `Over / Under ${line} Goals`,
      pick: pickOver ? `Over ${line} Goals` : `Under ${line} Goals`,
      odds: pickOver ? overPrice : underPrice,
      confidence: goalConf,
      reason: pickOver
        ? `Over — ${topGoalCue}${goalCues[1] ? `; ${goalCues[1]}` : ''}.`
        : `Under — ${topGoalCue}${goalCues[1] ? `; ${goalCues[1]}` : ''}.`,
      evalKey: pickOver ? 'over' : 'under',
      line,
    })
  }

  // ── Non-soccer sport-specific markets — use real bookmaker data when available ──
  // For basketball, baseball, hockey, american football, tennis: generate Spread + Totals
  if (!isSoccer && markets && markets.length > 0) {
    const spreadMarket = markets.find(m =>
      ['spreads', 'spread', 'run_line', 'puck_line', 'alternate_spreads'].includes(m.key.toLowerCase()) ||
      /\b(spread|run\s*line|puck\s*line|handicap)\b/i.test(m.name)
    )
    if (spreadMarket && spreadMarket.outcomes.length >= 2) {
      const homeFirstWord = homeTeam.split(' ')[0].toLowerCase()
      const awayFirstWord = awayTeam.split(' ')[0].toLowerCase()
      const homeSpreadOut = spreadMarket.outcomes.find(o =>
        o.name.toLowerCase().includes(homeFirstWord) ||
        /home|^1$/i.test(o.name)
      )
      const awaySpreadOut = spreadMarket.outcomes.find(o =>
        o.name.toLowerCase().includes(awayFirstWord) ||
        /away|^2$/i.test(o.name)
      )
      const spreadOut = homeP >= awayP ? (homeSpreadOut ?? spreadMarket.outcomes[0]) : (awaySpreadOut ?? spreadMarket.outcomes[1])
      const spreadLabel =
        sportSlug === 'baseball' ? 'Run Line' :
        (sportSlug === 'hockey' || sportSlug === 'icehockey') ? 'Puck Line' :
        'Point Spread'
      const pointDiff = Math.abs(homeP - awayP)
      picks.push({
        market: spreadLabel,
        pick: spreadOut.name,
        odds: spreadOut.price,
        confidence: Math.round(Math.min(82, Math.max(45, 50 + pointDiff * 80))),
        reason: `Logic model backs ${homeP >= awayP ? homeTeam : awayTeam} to cover — form and H2H support this side.`,
        evalKey: '1x2',
        side: homeP >= awayP ? 'home' : 'away',
      })
    }

    const totalsMarket = markets.find(m =>
      ['totals', 'total', 'game_totals'].includes(m.key.toLowerCase()) ||
      /\b(over.?under|o\/u|total)\b/i.test(m.name)
    )
    if (totalsMarket && totalsMarket.outcomes.length >= 2) {
      const highFormBoth = hFormPts >= 8 && aFormPts >= 8
      const lowFormBoth  = hFormPts <= 4 && aFormPts <= 4
      const pickOver = highFormBoth || (!lowFormBoth && hFormPts + aFormPts >= 12)
      const overOut  = totalsMarket.outcomes.find(o => /over/i.test(o.name))
      const underOut = totalsMarket.outcomes.find(o => /under/i.test(o.name))
      const totalsOut = pickOver ? overOut : underOut
      if (totalsOut) {
        const unitLabel =
          sportSlug === 'baseball'  ? 'Runs' :
          sportSlug === 'tennis'    ? 'Games' :
          sportSlug === 'hockey' || sportSlug === 'icehockey' ? 'Goals' : 'Points'
        const lineStr = totalsOut.point !== undefined ? ` ${totalsOut.point}` : ''
        picks.push({
          market: `Over / Under${lineStr} ${unitLabel}`,
          pick: `${pickOver ? 'Over' : 'Under'}${lineStr} ${unitLabel}`,
          odds: totalsOut.price,
          confidence: Math.round(Math.min(80, 50 + (highFormBoth || lowFormBoth ? 20 : 10))),
          reason: pickOver
            ? `Both sides are in good form — backing an active, high-scoring contest.`
            : `Defensive form is dominant — leaning under on the ${unitLabel.toLowerCase()} total.`,
          evalKey: pickOver ? 'over' : 'under',
          line: totalsOut.point,
        })
      }
    }
  }

  const isPrimaryMarket = (m: string) => m === "Match Result" || m === "Moneyline"
  return picks.sort((a, b) => {
    if (isPrimaryMarket(a.market)) return -1
    if (isPrimaryMarket(b.market)) return 1
    return b.confidence - a.confidence
  })
}
