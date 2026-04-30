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
  odds?: {
    home: number
    draw?: number
    away: number
  }
  markets?: MarketOdds[]
  onSubmit?: (data: TipFormData) => void
  isPremiumUser?: boolean
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

// Catalog of common manual-entry markets — used ONLY when the user picks
// "Enter manually". We never auto-generate odds; the user types the price
// they actually got from their bookmaker.
const MANUAL_MARKET_TEMPLATES = [
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
] as const

export function AddTipForm({
  matchId,
  homeTeam,
  awayTeam,
  odds: _odds,
  markets: providedMarkets,
  onSubmit,
  isPremiumUser = false,
}: AddTipFormProps) {
  // Two modes:
  //  • "real"   — user picks from real bookmaker markets shipped with the match
  //  • "manual" — user types their own market, prediction text and odds
  const [mode, setMode] = useState<'real' | 'manual'>(
    providedMarkets && providedMarkets.length > 0 ? 'real' : 'manual'
  )

  const [selectedMarketKey, setSelectedMarketKey] = useState<string>("")
  const [selectedOutcome, setSelectedOutcome] = useState<{ name: string; price: number } | null>(null)

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

  // ONLY real bookmaker markets — never auto-generated. If a market arrives
  // empty we drop it so we don't show fake "0.00" prices.
  const realMarkets = useMemo<MarketOdds[]>(() => {
    if (!providedMarkets) return []
    return providedMarkets.filter(m => m && m.outcomes && m.outcomes.length > 0)
  }, [providedMarkets])

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
                {mode === 'real' ? selectedMarket?.name : MANUAL_MARKET_TEMPLATES.find(t => t.key === manualMarket)?.name}
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
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            Pick a market <span className="text-destructive">*</span>
            {errors.prediction && <span className="text-xs text-destructive">{errors.prediction}</span>}
          </Label>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {realMarkets.map((market) => (
              <div key={market.key} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{market.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {market.outcomes.map((outcome) => {
                    const isSelected = selectedMarketKey === market.key && selectedOutcome?.name === outcome.name
                    return (
                      <button
                        key={`${market.key}-${outcome.name}`}
                        type="button"
                        onClick={() => handleSelectOutcome(market, outcome)}
                        className={cn(
                          "relative flex flex-col items-center rounded-lg border-2 px-3 py-1.5 text-xs transition-all min-w-[80px]",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted"
                        )}
                      >
                        {isSelected && (
                          <Check className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-primary text-white p-0.5" />
                        )}
                        <span className="font-medium text-[11px] text-center line-clamp-2">{outcome.name}</span>
                        <span className={cn("font-bold text-sm", isSelected ? "text-primary" : "text-foreground")}>
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
                {MANUAL_MARKET_TEMPLATES.map(m => (
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
                placeholder={`e.g. ${homeTeam} -1, Over 2.5, BTTS Yes, 2-1…`}
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
