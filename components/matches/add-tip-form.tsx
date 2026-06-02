"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Lock, Send, AlertCircle, Check, TrendingUp, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

interface MarketOdds {
  key: string
  name: string
  outcomes: Array<{
    name: string
    price: number
  }>
}

interface AddTipFormProps {
  matchId: string
  homeTeam: string
  awayTeam: string
  /** Sport slug e.g. "soccer", "baseball", "basketball", "tennis", "hockey" */
  sport?: string
  odds?: {
    home: number
    draw?: number
    away: number
  }
  markets?: MarketOdds[]
  onSubmit?: (data: TipFormData) => void
  isPremiumUser?: boolean
  initialMarketKey?: string
  initialOutcome?: { name: string; price: number }
}

interface TipFormData {
  prediction: string
  predictionLabel: string
  odds: number
  stake: number
  confidence: number
  analysis: string
  isPremium: boolean
  marketKey: string
}

// ── Market category helpers ───────────────────────────────────────────────
type MarketCategory = 'main' | 'goals' | 'handicap' | 'halftime' | 'other'

function categorizeMarket(key: string): MarketCategory {
  const k = key.toLowerCase()
  if (
    k.includes('h2h') || k.includes('moneyline') || k === 'double_chance' ||
    k === 'draw_no_bet' || k === 'dnb' || k.includes('winner') ||
    k === 'match_result' || k === '1x2' || k === 'result' || k === 'outrights'
  ) return 'main'
  if (
    k.includes('total') || k.includes('btts') || k.includes('both_teams') ||
    k.includes('goals') || k.includes('goal') || k.includes('over_under') ||
    k.includes('over/under') || k.includes('clean_sheet') || k.includes('scoring')
  ) return 'goals'
  if (
    k.includes('spread') || k.includes('handicap') || k.includes('asian') ||
    k.includes('european') || k.includes('line')
  ) return 'handicap'
  if (
    k.includes('half') || k.startsWith('ht') || k.includes('_ht') ||
    k.includes('q1') || k.includes('q2') || k.includes('quarter') ||
    k.includes('period') || k.includes('first_half') || k.includes('2nd_half') ||
    k.includes('second_half') || k.includes('halftime')
  ) return 'halftime'
  return 'other'
}

const CATEGORY_LABELS: Record<MarketCategory, string> = {
  main: 'Main',
  goals: 'Goals',
  handicap: 'Handicap',
  halftime: 'H/T',
  other: 'Other',
}

// Sport-specific manual-entry market catalogs.
// Each list contains only markets that are valid/meaningful for that sport.
// Tipsters must always enter the real price from their bookmaker — never invent odds.
const SPORT_MANUAL_MARKETS: Record<string, readonly { key: string; name: string }[]> = {
  soccer: [
    { key: 'h2h', name: 'Match Result (1X2)' },
    { key: 'double_chance', name: 'Double Chance' },
    { key: 'dnb', name: 'Draw No Bet' },
    { key: 'btts', name: 'Both Teams to Score' },
    { key: 'btts_and_result', name: 'BTTS & Result' },
    { key: 'over_under_0_5', name: 'Over/Under 0.5 Goals' },
    { key: 'over_under_1_5', name: 'Over/Under 1.5 Goals' },
    { key: 'over_under_2_5', name: 'Over/Under 2.5 Goals' },
    { key: 'over_under_3_5', name: 'Over/Under 3.5 Goals' },
    { key: 'over_under_4_5', name: 'Over/Under 4.5 Goals' },
    { key: 'asian_handicap', name: 'Asian Handicap' },
    { key: 'european_handicap', name: 'European Handicap (3-way)' },
    { key: 'ht_result', name: 'Half-Time Result' },
    { key: 'ht_ft', name: 'Half-Time / Full-Time' },
    { key: 'ht_over_under', name: 'HT Over/Under Goals' },
    { key: 'second_half_result', name: '2nd Half Result' },
    { key: 'correct_score', name: 'Correct Score' },
    { key: 'win_to_nil', name: 'Win to Nil' },
    { key: 'clean_sheet', name: 'Clean Sheet' },
    { key: 'odd_even', name: 'Odd / Even Goals' },
    { key: 'team_total', name: 'Team Total Goals' },
    { key: 'race_to_n', name: 'Race to N Goals' },
    { key: 'corners', name: 'Corners (Total / Handicap)' },
    { key: 'cards', name: 'Cards (Total / Handicap)' },
    { key: 'first_goalscorer', name: 'First Goalscorer' },
    { key: 'anytime_goalscorer', name: 'Anytime Goalscorer' },
  ],
  baseball: [
    { key: 'h2h', name: 'Moneyline' },
    { key: 'run_line', name: 'Run Line (±1.5)' },
    { key: 'totals', name: 'Over/Under Runs' },
    { key: 'alt_run_line', name: 'Alternate Run Line' },
    { key: 'team_totals', name: 'Team Total Runs' },
    { key: 'first_5_innings', name: 'First 5 Innings Result' },
    { key: 'first_5_totals', name: 'First 5 Innings O/U Runs' },
    { key: '1st_inning_score', name: '1st Inning — Will a Run Score?' },
    { key: 'odd_even', name: 'Odd / Even Total Runs' },
    { key: 'nrfi', name: 'No Run First Inning (NRFI)' },
    { key: 'innings_pitched', name: 'Starting Pitcher Innings O/U' },
  ],
  basketball: [
    { key: 'h2h', name: 'Moneyline' },
    { key: 'spreads', name: 'Point Spread' },
    { key: 'totals', name: 'Over/Under Points' },
    { key: 'alt_spread', name: 'Alternate Spread' },
    { key: 'team_totals', name: 'Team Total Points' },
    { key: 'first_half', name: 'First Half Result' },
    { key: 'first_half_totals', name: 'First Half O/U Points' },
    { key: '1st_quarter', name: '1st Quarter Result' },
    { key: '1st_quarter_totals', name: '1st Quarter O/U Points' },
    { key: 'race_to_n', name: 'Race to N Points' },
    { key: 'margin_of_victory', name: 'Margin of Victory' },
    { key: 'odd_even', name: 'Odd / Even Total Points' },
  ],
  tennis: [
    { key: 'h2h', name: 'Match Winner' },
    { key: 'set_handicap', name: 'Set Handicap' },
    { key: 'total_sets', name: 'Total Sets O/U' },
    { key: 'total_games', name: 'Total Games O/U' },
    { key: 'set_1_winner', name: 'Set 1 Winner' },
    { key: 'set_1_games', name: 'Set 1 Total Games O/U' },
    { key: 'first_set_to_6', name: 'First Set to 6 Games' },
    { key: 'tiebreak', name: 'Will a Tiebreak Occur?' },
    { key: 'correct_sets', name: 'Correct Set Score' },
    { key: 'game_handicap', name: 'Game Handicap' },
  ],
  hockey: [
    { key: 'h2h', name: 'Moneyline (60 min)' },
    { key: 'puck_line', name: 'Puck Line (±1.5)' },
    { key: 'totals', name: 'Over/Under Goals' },
    { key: 'btts', name: 'Both Teams to Score' },
    { key: 'alt_puck_line', name: 'Alternate Puck Line' },
    { key: 'team_totals', name: 'Team Total Goals' },
    { key: 'period_1_result', name: 'Period 1 Result' },
    { key: 'period_1_totals', name: 'Period 1 Over/Under Goals' },
    { key: 'period_2_result', name: 'Period 2 Result' },
    { key: 'first_goal', name: 'First Team to Score' },
    { key: 'ot_result', name: 'Regulation / OT / SO Result' },
    { key: 'odd_even', name: 'Odd / Even Goals' },
  ],
  football: [
    { key: 'h2h', name: 'Moneyline' },
    { key: 'spreads', name: 'Point Spread' },
    { key: 'totals', name: 'Over/Under Points' },
    { key: 'alt_spread', name: 'Alternate Spread' },
    { key: 'team_totals', name: 'Team Total Points' },
    { key: 'first_half', name: 'First Half Result' },
    { key: 'first_half_totals', name: '1H Over/Under Points' },
    { key: '1st_quarter', name: '1st Quarter Result' },
    { key: 'first_score', name: 'First Team to Score' },
    { key: 'winning_margin', name: 'Winning Margin' },
    { key: 'td_scorer', name: 'Anytime Touchdown Scorer' },
    { key: 'odd_even', name: 'Odd / Even Points' },
  ],
  mma: [
    { key: 'h2h', name: 'Fight Winner' },
    { key: 'method_of_victory', name: 'Method of Victory' },
    { key: 'goes_distance', name: 'Fight Goes the Distance?' },
    { key: 'total_rounds', name: 'Total Rounds O/U' },
    { key: 'winning_round', name: 'Winning Round (1 / 2 / 3+)' },
    { key: 'round_1_finish', name: 'Round 1 Finish — Yes/No' },
    { key: 'decision_type', name: 'Decision Type (Unanimous / Split)' },
  ],
  cricket: [
    { key: 'match_winner', name: 'Match Winner' },
    { key: 'total_runs', name: 'Total Runs O/U' },
    { key: 'innings_runs', name: 'First Innings Runs O/U' },
    { key: 'top_batsman', name: 'Top Batsman' },
    { key: 'top_bowler', name: 'Top Bowler / Most Wickets' },
    { key: 'first_wicket', name: 'Method of First Wicket' },
    { key: 'player_runs', name: 'Player Runs O/U' },
    { key: 'innings_lead', name: 'First Innings Lead' },
    { key: 'series_winner', name: 'Series Winner' },
  ],
  rugby: [
    { key: 'match_result', name: 'Match Result (1X2)' },
    { key: 'dnb', name: 'Draw No Bet' },
    { key: 'handicap', name: 'Handicap' },
    { key: 'totals', name: 'Over/Under Points' },
    { key: 'team_totals', name: 'Team Total Points' },
    { key: 'first_try', name: 'First Try Scorer' },
    { key: 'anytime_try', name: 'Anytime Try Scorer' },
    { key: 'half_result', name: 'First Half Result' },
    { key: 'half_totals', name: '1H Over/Under Points' },
    { key: 'winning_margin', name: 'Winning Margin' },
  ],
  volleyball: [
    { key: 'h2h', name: 'Match Winner' },
    { key: 'handicap', name: 'Set Handicap' },
    { key: 'total_sets', name: 'Total Sets O/U' },
    { key: 'set_1_winner', name: 'Set 1 Winner' },
    { key: 'set_1_points', name: 'Set 1 Total Points O/U' },
    { key: 'match_points', name: 'Total Match Points O/U' },
    { key: 'correct_sets', name: 'Correct Set Score' },
  ],
}

// Placeholder examples per sport for the prediction input field
const SPORT_PREDICTION_PLACEHOLDER: Record<string, string> = {
  soccer: 'Chelsea -1, Over 2.5, BTTS Yes, 2-1…',
  baseball: 'Yankees -1.5, Over 8.5 Runs, Moneyline…',
  basketball: 'Lakers -4.5, Over 215.5 Pts, Moneyline…',
  tennis: 'Djokovic 2-0, Over 22.5 Games, Set 1 Winner…',
  hockey: 'Maple Leafs -1.5, Over 5.5 Goals, BTTS Yes…',
  football: 'Chiefs -7, Over 51.5 Pts, Moneyline…',
  mma: 'KO/TKO, Goes Distance No, Under 2.5 Rounds…',
  cricket: 'India to win, Over 300.5 Runs, Top Batsman…',
  rugby: 'All Blacks -8.5, Over 42.5 Pts, First Try…',
  volleyball: 'Brazil 3-1, Over 3.5 Sets, Set 1 Winner…',
}

function getManualMarketsForSport(sport?: string): readonly { key: string; name: string }[] {
  const s = (sport || 'soccer')
    .toLowerCase()
    .replace(/american[\s_-]?football|americanfootball|nfl/g, 'football')
    .replace(/ice[\s_-]?hockey|nhl/g, 'hockey')
    .replace(/nba/g, 'basketball')
    .replace(/mlb/g, 'baseball')
    .replace(/soccer/g, 'soccer')
  return SPORT_MANUAL_MARKETS[s] ?? SPORT_MANUAL_MARKETS['soccer']
}

function getPredictionPlaceholder(home: string, sport?: string): string {
  const s = (sport || 'soccer')
    .toLowerCase()
    .replace(/american[\s_-]?football|americanfootball|nfl/g, 'football')
    .replace(/ice[\s_-]?hockey|nhl/g, 'hockey')
    .replace(/nba/g, 'basketball')
    .replace(/mlb/g, 'baseball')
  const tpl = SPORT_PREDICTION_PLACEHOLDER[s] || SPORT_PREDICTION_PLACEHOLDER['soccer']
  // Inject home team name for extra relevance
  return tpl.replace(/^[\w\s]+(?= -| to| 2)/, home)
}

export function AddTipForm({
  matchId,
  homeTeam,
  awayTeam,
  sport,
  odds: _odds,
  markets: providedMarkets,
  onSubmit,
  isPremiumUser = false,
  initialMarketKey,
  initialOutcome,
}: AddTipFormProps) {
  // Sport-specific manual market list — filters to only valid markets for this sport
  const sportMarkets = useMemo(() => getManualMarketsForSport(sport), [sport])
  const predictionPlaceholder = useMemo(() => getPredictionPlaceholder(homeTeam, sport), [homeTeam, sport])
  // Two modes:
  //  • "real"   — user picks from real bookmaker markets shipped with the match
  //  • "manual" — user types their own market, prediction text and odds
  const [mode, setMode] = useState<'real' | 'manual'>(
    initialMarketKey ? 'real' : (providedMarkets && providedMarkets.length > 0 ? 'real' : 'manual')
  )

  const [selectedMarketKey, setSelectedMarketKey] = useState<string>(initialMarketKey ?? "")
  const [selectedOutcome, setSelectedOutcome] = useState<{ name: string; price: number } | null>(initialOutcome ?? null)

  // Manual entry state
  const [manualMarket, setManualMarket] = useState<string>('')
  const [manualPrediction, setManualPrediction] = useState<string>('')
  const [manualOdds, setManualOdds] = useState<string>('')

  const [stake, setStake] = useState(3)
  const [confidence, setConfidence] = useState([70])
  const [analysis, setAnalysis] = useState("")
  const [isPremium, setIsPremium] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeCategory, setActiveCategory] = useState<MarketCategory>('main')

  // ONLY real bookmaker markets — never auto-generated. If a market arrives
  // empty we drop it so we don't show fake "0.00" prices.
  const realMarkets = useMemo<MarketOdds[]>(() => {
    if (!providedMarkets) return []
    return providedMarkets.filter(m => m && m.outcomes && m.outcomes.length > 0)
  }, [providedMarkets])

  // Which categories actually have at least one market
  const availableCategories = useMemo<MarketCategory[]>(() => {
    const cats = new Set<MarketCategory>()
    for (const m of realMarkets) cats.add(categorizeMarket(m.key))
    const order: MarketCategory[] = ['main', 'goals', 'handicap', 'halftime', 'other']
    return order.filter(c => cats.has(c))
  }, [realMarkets])

  // Auto-select the first available category when markets load
  const effectiveCategory = availableCategories.includes(activeCategory)
    ? activeCategory
    : (availableCategories[0] ?? 'main')

  const visibleMarkets = useMemo(
    () => realMarkets.filter(m => categorizeMarket(m.key) === effectiveCategory),
    [realMarkets, effectiveCategory],
  )

  const selectedMarket = realMarkets.find(m => m.key === selectedMarketKey)

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (mode === 'real') {
      if (!selectedOutcome) newErrors.prediction = "Pick a market and an outcome"
    } else {
      if (!manualMarket) newErrors.market = "Choose a market"
      if (!manualPrediction.trim()) newErrors.prediction = "Type your prediction"
      const oddsNum = parseFloat(manualOdds)
      if (!oddsNum || oddsNum < 1.01 || oddsNum > 1000) {
        newErrors.odds = "Enter the real odds you got (1.01–1000)"
      }
    }

    if (analysis.length < 20) newErrors.analysis = "Analysis must be at least 20 characters"
    if (analysis.length > 500) newErrors.analysis = "Analysis must be under 500 characters"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSelectOutcome = (market: MarketOdds, outcome: { name: string; price: number }) => {
    setSelectedMarketKey(market.key)
    setSelectedOutcome(outcome)
    setErrors(prev => ({ ...prev, prediction: "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)

    let data: TipFormData
    if (mode === 'real' && selectedOutcome) {
      data = {
        prediction: `${selectedMarketKey}:${selectedOutcome.name}`,
        predictionLabel: selectedOutcome.name,
        odds: selectedOutcome.price,
        stake,
        confidence: confidence[0],
        analysis,
        isPremium: isPremiumUser && isPremium,
        marketKey: selectedMarketKey,
      }
    } else {
      const tpl = MANUAL_MARKET_TEMPLATES.find(t => t.key === manualMarket)
      data = {
        prediction: `${manualMarket}:${manualPrediction.trim()}`,
        predictionLabel: manualPrediction.trim(),
        odds: parseFloat(manualOdds),
        stake,
        confidence: confidence[0],
        analysis,
        isPremium: isPremiumUser && isPremium,
        marketKey: manualMarket || 'custom',
      }
      void tpl
    }

    try {
      if (onSubmit) {
        await onSubmit(data)
      }
      setSelectedMarketKey("")
      setSelectedOutcome(null)
      setManualMarket('')
      setManualPrediction('')
      setManualOdds('')
      setStake(3)
      setConfidence([70])
      setAnalysis("")
      setIsPremium(false)
    } catch (error) {
      console.error("Failed to submit tip:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const previewLabel = mode === 'real' ? selectedOutcome?.name : manualPrediction.trim()
  const previewOdds = mode === 'real' ? selectedOutcome?.price : parseFloat(manualOdds || '0')
  const hasPreview = mode === 'real' ? !!selectedOutcome : !!previewLabel && !!previewOdds && previewOdds > 1

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode switch — show only if real markets exist */}
      {realMarkets.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setMode('real')}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              mode === 'real' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Live odds ({realMarkets.length} markets)
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
              mode === 'manual' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Pencil className="h-3 w-3" />
            Enter manually
          </button>
        </div>
      )}

      {/* Selected Prediction Display (sticky preview) */}
      {hasPreview && (
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {mode === 'real' ? selectedMarket?.name : sportMarkets.find(t => t.key === manualMarket)?.name}
              </p>
              <p className="text-base font-semibold text-foreground truncate">{previewLabel}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">Odds</p>
              <p className="text-xl font-bold text-primary">{previewOdds?.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {mode === 'real' && realMarkets.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5 text-xs">
              Pick a market <span className="text-destructive">*</span>
            </Label>
            {errors.prediction && (
              <span className="text-[10px] text-destructive">{errors.prediction}</span>
            )}
          </div>

          {/* Category tabs — compact pill nav */}
          {availableCategories.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all whitespace-nowrap",
                    effectiveCategory === cat
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                  <span className="ml-1 opacity-60">
                    {realMarkets.filter(m => categorizeMarket(m.key) === cat).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Markets for active category */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
            {visibleMarkets.map((market) => (
              <div key={market.key} className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {market.name}
                </p>
                <div className="flex flex-wrap gap-1">
                  {market.outcomes.map((outcome) => {
                    const isSelected =
                      selectedMarketKey === market.key && selectedOutcome?.name === outcome.name
                    return (
                      <button
                        key={`${market.key}-${outcome.name}`}
                        type="button"
                        onClick={() => handleSelectOutcome(market, outcome)}
                        className={cn(
                          "relative flex flex-col items-center rounded-md border px-2 py-1 text-xs transition-all min-w-[64px]",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted",
                        )}
                      >
                        {isSelected && (
                          <Check className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary text-white p-0.5" />
                        )}
                        <span className="font-medium text-[10px] text-center line-clamp-1 leading-tight">
                          {outcome.name}
                        </span>
                        <span className={cn(
                          "font-bold text-[13px] leading-tight",
                          isSelected ? "text-primary" : "text-foreground",
                        )}>
                          {outcome.price.toFixed(2)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ── Manual entry ───────────────────────────────────────────────
        <div className="space-y-3">
          {realMarkets.length === 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              No live bookmaker odds attached to this match — enter your pick manually.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="manual-market">
              Market <span className="text-destructive">*</span>
              {errors.market && <span className="ml-2 text-xs text-destructive">{errors.market}</span>}
            </Label>
            <Select value={manualMarket} onValueChange={setManualMarket}>
              <SelectTrigger id="manual-market">
                <SelectValue placeholder="Pick a market (1X2, BTTS, Over/Under, AH…)" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {sportMarkets.map(m => (
                  <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="manual-prediction">
                Your prediction <span className="text-destructive">*</span>
                {errors.prediction && <span className="ml-2 text-xs text-destructive">{errors.prediction}</span>}
              </Label>
              <Input
                id="manual-prediction"
                placeholder={`e.g. ${predictionPlaceholder}`}
                value={manualPrediction}
                onChange={e => setManualPrediction(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-odds">
                Odds <span className="text-destructive">*</span>
              </Label>
              <Input
                id="manual-odds"
                type="number"
                step="0.01"
                min="1.01"
                max="1000"
                placeholder="2.10"
                value={manualOdds}
                onChange={e => setManualOdds(e.target.value)}
                className={cn(errors.odds && "border-destructive")}
              />
              {errors.odds && <p className="text-[10px] text-destructive">{errors.odds}</p>}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Type the <strong>real price</strong> from your bookmaker — never invent odds.
          </p>
        </div>
      )}

      {/* Stake (1–5) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Stake (units)</Label>
          <span className="text-xs font-semibold">{stake}/5</span>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStake(s)}
              className={cn(
                "flex-1 rounded-md border-2 py-1.5 text-xs font-medium transition-all",
                stake === s ? "border-primary bg-primary text-primary-foreground" : "border-muted hover:border-primary/50"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Confidence</Label>
          <span className="text-xs font-semibold">{confidence[0]}%</span>
        </div>
        <Slider value={confidence} onValueChange={setConfidence} max={100} min={50} step={5} />
      </div>

      {/* Analysis */}
      <div className="space-y-1.5">
        <Label htmlFor="analysis" className="text-xs">
          Analysis <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="analysis"
          placeholder="Why this pick? Form, injuries, head-to-head, value angle…"
          value={analysis}
          onChange={(e) => setAnalysis(e.target.value)}
          rows={3}
          className={cn("text-sm", errors.analysis && "border-destructive")}
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          {errors.analysis ? <p className="text-destructive">{errors.analysis}</p> : <span>Min 20 characters</span>}
          <span>{analysis.length}/500</span>
        </div>
      </div>

      {/* Premium */}
      {isPremiumUser && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-2.5">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-warning" />
            <p className="text-xs font-medium">Premium tip (subscribers only)</p>
          </div>
          <Switch checked={isPremium} onCheckedChange={setIsPremium} />
        </div>
      )}

      {/* Returns */}
      {hasPreview && previewOdds && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-muted-foreground">Return on 10 units:</span>
          </div>
          <span className="font-semibold text-emerald-500">{(10 * previewOdds).toFixed(2)} units</span>
        </div>
      )}

      {/* Submit */}
      <Button type="submit" className="w-full gap-2" disabled={isSubmitting || !hasPreview}>
        <Send className="h-4 w-4" />
        {isSubmitting ? "Submitting…" : hasPreview ? `Post tip @ ${previewOdds?.toFixed(2)}` : "Pick a prediction"}
      </Button>
    </form>
  )
}
