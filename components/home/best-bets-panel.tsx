"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Sparkles, Flame, TrendingUp, Trophy, Star, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { TeamLogo } from "@/components/ui/team-logo"
import { FlagIcon } from "@/components/ui/flag-icon"
import { matchToSlug } from "@/lib/utils/match-url"

interface MatchMarketOutcome {
  name: string
  price: number
  point?: number
}
interface MatchMarket {
  key?: string
  name: string
  outcomes: MatchMarketOutcome[]
}

interface MatchLite {
  id: string
  homeTeam: { name: string; logo?: string; form?: string }
  awayTeam: { name: string; logo?: string; form?: string }
  league: { name: string; countryCode: string }
  sport: { slug: string; icon?: string }
  status: string
  kickoffTime: Date | string
  odds?: { home: number; draw?: number; away: number }
  markets?: MatchMarket[]
}

interface BestBetsPanelProps {
  matches: MatchLite[]
}

interface Pick {
  match: MatchLite
  market: string
  selection: string
  odds: number
  confidence: number
  rationale: string
}

/**
 * Right-rail "Today's Best Bets" panel.
 * Generates picks deterministically from real bookmaker odds (no random).
 * Mimics the Oddspedia "Today's Best Betting Tips" panel.
 */
export function BestBetsPanel({ matches }: BestBetsPanelProps) {
  const picks = useMemo(() => buildBestBets(matches), [matches])

  if (picks.length === 0) {
    return (
      <aside className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <Sparkles className="h-4 w-4 text-amber-500" /> Today's Best Bets
        </h3>
        <p className="text-xs text-muted-foreground">
          Picks generate as soon as bookmaker odds publish — check back shortly.
        </p>
      </aside>
    )
  }

  // Build a top "featured" pick + 2-fold accumulator from the next 2.
  // Dedupe by match id so the same fixture never appears in more than one
  // section — when only 1-2 distinct matches qualify, downstream sections
  // gracefully hide instead of repeating the featured pick.
  const seen = new Set<string>()
  const unique: Pick[] = []
  for (const p of picks) {
    if (seen.has(p.match.id)) continue
    seen.add(p.match.id)
    unique.push(p)
  }
  const featured = unique[0]
  const acca = unique.slice(1, 3)
  const accaOdds = acca.reduce((p, c) => p * c.odds, 1)
  const others = unique.slice(3, 6)

  return (
    <aside className="space-y-3">
      {/* Heading */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
          Today's Best Bets
        </h3>
      </div>

      {/* Featured pick */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-card p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Badge className="gap-1 bg-emerald-500/15 text-emerald-500 border-0 hover:bg-emerald-500/15">
            <Flame className="h-3 w-3" />
            Top Pick
          </Badge>
          <span className="text-[10px] text-muted-foreground truncate">
            <FlagIcon countryCode={featured.match.league.countryCode} size="xs" className="mr-1.5 inline-block align-middle" /> {featured.match.league.name}
          </span>
        </div>
        <Link
          href={`/matches/${matchToSlug(featured.match.id, featured.match.homeTeam.name, featured.match.awayTeam.name)}`}
          className="block group"
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {featured.market}
          </p>
          <p className="mt-0.5 text-base font-bold text-foreground group-hover:text-primary line-clamp-1">
            {featured.selection}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 min-w-0">
              <TeamLogo teamName={featured.match.homeTeam.name} logoUrl={featured.match.homeTeam.logo} size="sm" />
              <span className="truncate">{featured.match.homeTeam.name}</span>
              <span className="text-muted-foreground/60">vs</span>
              <TeamLogo teamName={featured.match.awayTeam.name} logoUrl={featured.match.awayTeam.logo} size="sm" />
              <span className="truncate">{featured.match.awayTeam.name}</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Confidence</p>
              <div className="flex items-center gap-1">
                <p className={cn(
                  "text-sm font-black tabular-nums",
                  featured.confidence >= 70 ? "text-emerald-500" : "text-amber-500",
                )}>
                  {featured.confidence}%
                </p>
                <ConfidenceStars n={Math.min(5, Math.max(1, Math.round(featured.confidence / 18)))} />
              </div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/30">
              <p className="text-[10px] text-emerald-500/80 font-semibold uppercase tracking-wide">Best Odds</p>
              <p className="text-lg font-black tabular-nums text-emerald-500">{featured.odds.toFixed(2)}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Accumulator */}
      {acca.length === 2 && (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">
              Today's 2-Fold Accumulator
            </h4>
          </div>
          <div className="space-y-2">
            {acca.map((p, i) => (
              <Link
                key={i}
                href={`/matches/${matchToSlug(p.match.id, p.match.homeTeam.name, p.match.awayTeam.name)}`}
                className="group block rounded-lg bg-background/50 p-2.5 hover:bg-background transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold truncate">
                      {p.match.homeTeam.name} – {p.match.awayTeam.name}
                    </p>
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary truncate mt-0.5">
                      {p.selection}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-amber-500 tabular-nums shrink-0">
                    {p.odds.toFixed(2)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-amber-500/20 pt-3">
            <span className="text-xs text-muted-foreground">Total Odds</span>
            <span className="text-lg font-black tabular-nums text-amber-500">
              {accaOdds.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Other consensus picks */}
      {others.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">
              Consensus Picks
            </h4>
            <Link href="/matches" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ul>
            {others.map((p, i) => (
              <li key={i}>
                <Link
                  href={`/matches/${matchToSlug(p.match.id, p.match.homeTeam.name, p.match.awayTeam.name)}`}
                  className="group flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/40 transition-colors"
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    p.confidence >= 70 ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500",
                  )}>
                    {p.confidence}%
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                      {p.selection}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {p.match.homeTeam.name} vs {p.match.awayTeam.name}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums shrink-0">
                    {p.odds.toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer note */}
      <p className="px-1 text-[10px] text-muted-foreground">
        Picks ranked by bookmaker-implied probability. Bet responsibly — 18+.
      </p>
    </aside>
  )
}

function ConfidenceStars({ n }: { n: number }) {
  return (
    <span className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  )
}

// ───────────────────────────────────────────────
// Pick generator — scans ALL available markets, picks best fit per match
// ───────────────────────────────────────────────

/** Parse a form string like "WWDLW" into a 0–1 score (most-recent weighted). */
function parseFormScore(form: string | undefined): number {
  if (!form) return 0.5
  const chars = form.replace(/[^WwDdLl]/g, '').slice(-5).toUpperCase().split('')
  if (chars.length === 0) return 0.5
  let pts = 0, maxPts = 0
  chars.forEach((c, i) => {
    const w = 1 + i * 0.3
    maxPts += 3 * w
    if (c === 'W') pts += 3 * w
    else if (c === 'D') pts += 1 * w
  })
  return maxPts > 0 ? Math.min(pts / maxPts, 1) : 0.5
}

/** Remove bookmaker margin and return normalised per-outcome probabilities. */
function marginFreeProbs(outcomes: MatchMarketOutcome[]): Array<MatchMarketOutcome & { prob: number }> {
  const valid = outcomes.filter(o => o.price > 1.01)
  if (valid.length < 2) return []
  const vig = valid.reduce((s, o) => s + 1 / o.price, 0)
  return valid.map(o => ({ ...o, prob: (1 / o.price) / vig }))
}

/** Map API market key to a normalised category label. */
function mktCategory(key: string, name: string): string {
  const k = key.toLowerCase()
  if (k === 'h2h') return 'Match Winner'
  if (k === 'spreads' || k === 'asian_handicap') return 'Asian Handicap'
  if (k === 'double_chance') return 'Double Chance'
  if (k === 'dnb' || k === 'draw_no_bet') return 'Draw No Bet'
  if (k === 'btts') return 'BTTS'
  if (k === 'btts_and_result') return 'BTTS & Result'
  if (k === 'ht_ft') return 'HT/FT'
  if (k === 'h2h_1h' || k === 'h2h_ht' || k === 'ht_result') return 'HT Result'
  if (k === 'odd_even_goals') return 'Odd/Even Goals'
  if (k === 'exact_goals') return 'Exact Goals'
  if (k === 'correct_score') return 'Correct Score'
  if (k === 'win_to_nil') return 'Win to Nil'
  if (k === 'first_team_to_score') return 'First to Score'
  if (k === 'goal_first_half') return '1st Half Goal'
  if (k.startsWith('clean_sheet')) return 'Clean Sheet'
  if (/totals_0[_-]5/.test(k) || (k === 'totals' && name.includes('0.5'))) return 'O/U 0.5 Goals'
  if (/totals_1[_-]5/.test(k) || (k === 'totals' && name.includes('1.5'))) return 'O/U 1.5 Goals'
  if (/totals_2[_-]5/.test(k) || (k === 'totals' && name.includes('2.5'))) return 'O/U 2.5 Goals'
  if (/totals_3[_-]5/.test(k) || (k === 'totals' && name.includes('3.5'))) return 'O/U 3.5 Goals'
  if (/totals_4[_-]5/.test(k) || (k === 'totals' && name.includes('4.5'))) return 'O/U 4.5 Goals'
  if (k === 'totals_1h' || k === 'totals_h1') return '1st Half Goals'
  if (k === 'totals_2h' || k === 'totals_h2') return '2nd Half Goals'
  if (k.startsWith('corners_')) return 'Corners'
  if (k.startsWith('totals_')) return 'Total Goals'
  if (k === 'totals') return 'Total Goals'
  return name || key
}

function buildBestBets(matches: MatchLite[]): Pick[] {
  const todayDate = new Date()
  const today = todayDate.toDateString()
  const endOfToday = new Date(todayDate)
  endOfToday.setHours(23, 59, 59, 999)
  const endTs = endOfToday.getTime()
  const now = Date.now()
  const candidates: Pick[] = []

  for (const m of matches) {
    if (!m.odds) continue
    // Skip computed/estimated odds
    if ((m.odds as Record<string, unknown>).bookmaker === 'Computed' ||
        (m.odds as Record<string, unknown>).bookmaker === 'Estimated' ||
        (m.odds as Record<string, unknown>).bookmaker === 'computed') continue

    const status = (m.status || '').toLowerCase()
    if (status && status !== 'scheduled' && status !== 'upcoming' && status !== 'ns') continue

    const ko = new Date(m.kickoffTime).getTime()
    if (Number.isNaN(ko)) continue
    if (new Date(ko).toDateString() !== today) continue
    if (ko <= now || ko > endTs) continue

    // ── Fair probability decomposition ──────────────────────────────────────
    const rawH = 1 / Math.max(m.odds.home, 1.01)
    const rawD = m.odds.draw ? 1 / Math.max(m.odds.draw, 1.01) : 0
    const rawA = 1 / Math.max(m.odds.away, 1.01)
    const rawT = rawH + rawD + rawA || 1
    const nH = rawH / rawT
    const nA = rawA / rawT

    // Match profile
    const hFS = parseFormScore(m.homeTeam.form)
    const aFS = parseFormScore(m.awayTeam.form)
    const homeGoalShare = Math.min(0.80, Math.max(0.35, 0.50 + (nH - 0.33) * 0.65))
    const λH = 2.65 * homeGoalShare * (0.82 + 0.36 * hFS)
    const λA = 2.65 * (1 - homeGoalShare) * (0.82 + 0.36 * aFS)
    const expectedGoals = λH + λA

    const strongFav    = Math.max(nH, nA) > 0.57
    const veryStrongFav = Math.max(nH, nA) > 0.66
    const tightMatch   = Math.abs(nH - nA) < 0.13
    const lowGoals     = expectedGoals < 2.05
    const highGoals    = expectedGoals > 3.05

    // Multiplier-based scoring (same engine as match card computeSmartPick)
    const INTEREST: Record<string, number> = {
      'Win to Nil':     1.28,
      'Asian Handicap': 1.22,
      'Clean Sheet':    1.20,
      'Draw No Bet':    1.16,
      'First to Score': 1.12,
      'O/U 3.5 Goals':  1.10,
      'O/U 2.5 Goals':  1.06,
      'BTTS':           1.04,
      'Match Winner':   1.00,
      'HT Result':      0.95,
      'Corners':        0.94,
      'Corners Race':   0.88,
      '1st Half Goals': 0.86,
      '2nd Half Goals': 0.86,
      'O/U 4.5 Goals':  0.94,
      'Total Goals':    0.90,
      'Regulation Result': 0.90,
      'BTTS & Result':  0.80,
      'HT/FT':          0.76,
      'Correct Score':  0.74,
      'Double Chance':  0.70,
      'Exact Goals':    0.68,
      '1st Half Goal':  0.65,
      'O/U 1.5 Goals':  0.50,
      'O/U 0.5 Goals':  0.28,
      'Odd/Even Goals': 0.32,
    }
    // marketScore(conf, market, pick, price) → full score for ranking candidates
    const marketScore = (conf: number, market: string, pick: string, price: number): number => {
      const pickLower = pick.toLowerCase()
      const multiplier = INTEREST[market] ?? 1.00
      let fit = 0
      if (market === 'Win to Nil') {
        const isCleanSweep = pickLower !== 'neither' && pickLower !== 'no' && pickLower !== 'neither team'
        if (isCleanSweep && veryStrongFav) fit = 20
        else if (isCleanSweep && strongFav) fit = 9
        else fit = -18
      } else if (market === 'Clean Sheet') {
        const isYes = pickLower === 'yes'
        if (isYes && veryStrongFav) fit = 20
        else if (isYes && strongFav) fit = 9
        else if (isYes) fit = 0
        else fit = -20
      } else if (market === 'Asian Handicap') {
        fit = veryStrongFav ? 16 : strongFav ? 9 : tightMatch ? -4 : 4
      } else if (market === 'Draw No Bet') {
        fit = strongFav ? 9 : 6
      } else if (market === 'First to Score') {
        fit = highGoals ? 10 : 5
      } else if (market === 'Match Winner') {
        fit = veryStrongFav ? 12 : strongFav ? 7 : 0
      } else if (market === 'BTTS') {
        if (pickLower === 'yes' && highGoals) fit = 12
        else if (pickLower === 'yes') fit = 4
        else if (pickLower === 'no' && (lowGoals || veryStrongFav)) fit = 10
      } else if (pickLower.startsWith('under')) {
        if (market === 'O/U 4.5 Goals' || market === 'Total Goals') {
          fit = lowGoals ? 2 : -18
        } else if (market === 'O/U 3.5 Goals') {
          fit = lowGoals ? 6 : -16
        } else {
          fit = lowGoals ? 16 : !highGoals ? 4 : -4
        }
      } else if (pickLower.startsWith('over') && (market === 'O/U 2.5 Goals' || market === 'O/U 3.5 Goals')) {
        fit = highGoals ? 14 : 3
      } else if (market === 'Corners' || market === 'HT Result') {
        if (tightMatch) fit = 8
      }
      const oddsBonus = price >= 1.25 && price <= 2.80 ? 6 : price > 2.80 && price <= 4.00 ? 2 : 0
      return conf * multiplier + fit + oddsBonus
    }

    // ── Scan all available markets ───────────────────────────────────────────
    interface MarketCandidate { market: string; selection: string; odds: number; confidence: number; score: number }
    const mktCandidates: MarketCandidate[] = []

    if (m.markets && m.markets.length > 0) {
      for (const mkt of m.markets) {
        const key = (mkt.key || '').toLowerCase()
        const outcomes = mkt.outcomes || []
        if (outcomes.length < 2) continue
        if (outcomes.some(o => o.price < 1.10)) continue
        const probs = marginFreeProbs(outcomes)
        if (probs.length < 2) continue
        const best = probs.reduce((a, b) => b.prob > a.prob ? b : a)
        const conf = Math.round(best.prob * 100)
        if (conf < 50) continue
        const category = mktCategory(key, mkt.name)
        const score = marketScore(conf, category, best.name, best.price)
        const existing = mktCandidates.findIndex(c => c.market === category)
        const entry: MarketCandidate = { market: category, selection: best.name, odds: best.price, confidence: conf, score }
        if (existing >= 0) { if (score > mktCandidates[existing].score) mktCandidates[existing] = entry }
        else mktCandidates.push(entry)
      }
    }

    // ── Fallback: compute from h2h odds if no markets present ───────────────
    if (mktCandidates.length === 0) {
      const homeP = nH, awayP = nA
      const drawP = rawD / rawT
      const winner = homeP >= awayP ? "home" : "away"
      const winnerP = Math.max(homeP, awayP)
      const winnerOdds = winner === "home" ? m.odds.home : m.odds.away
      const winnerName = winner === "home" ? m.homeTeam.name : m.awayTeam.name
      if (winnerP >= 0.45) {
        if (m.odds.draw && drawP > 0.27 && winnerP < 0.6) {
          const dcPrice = 1 / (winnerP + drawP)
          mktCandidates.push({
            market: "Double Chance", selection: `${winnerName} or Draw`,
            odds: Math.round(dcPrice * 100) / 100,
            confidence: Math.round((winnerP + drawP) * 100),
            score: Math.round((winnerP + drawP) * 100) - 8,
          })
        } else {
          mktCandidates.push({
            market: "Match Winner", selection: `${winnerName} to win`,
            odds: winnerOdds, confidence: Math.round(winnerP * 100),
            score: Math.round(winnerP * 100) + (strongFav ? 12 : 0),
          })
        }
      }
    }

    if (mktCandidates.length === 0) continue

    // Best candidate for this match
    mktCandidates.sort((a, b) => b.score !== a.score ? b.score - a.score : b.odds - a.odds)
    const best = mktCandidates.find(c => c.odds >= 1.20) ?? mktCandidates[0]
    if (best.confidence < 50) continue

    // Human-readable selection label
    const hn = m.homeTeam.name, an = m.awayTeam.name
    let selectionLabel = best.selection
    if (best.selection === 'Home') selectionLabel = `${hn} to Win`
    else if (best.selection === 'Away') selectionLabel = `${an} to Win`
    else if (best.selection === '1') selectionLabel = `${hn} to Win`
    else if (best.selection === '2') selectionLabel = `${an} to Win`
    else if (best.selection === 'X') selectionLabel = 'Draw'

    candidates.push({
      match: m,
      market: best.market,
      selection: selectionLabel,
      odds: best.odds,
      confidence: Math.min(best.confidence, 95),
      rationale: `${best.market} — ${best.confidence}% confidence.`,
    })
  }

  return candidates
    .filter(p => p.confidence >= 50)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
}
