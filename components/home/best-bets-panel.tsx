"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Sparkles, Flame, TrendingUp, Trophy, Star, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { TeamLogo } from "@/components/ui/team-logo"
import { FlagIcon } from "@/components/ui/flag-icon"
import { matchIdToSlug } from "@/lib/utils/match-url"

interface MatchLite {
  id: string
  homeTeam: { name: string; logo?: string }
  awayTeam: { name: string; logo?: string }
  league: { name: string; countryCode: string }
  sport: { slug: string; icon?: string }
  status: string
  kickoffTime: Date | string
  odds?: { home: number; draw?: number; away: number }
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
          href={`/matches/${matchIdToSlug(featured.match.id)}`}
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
                href={`/matches/${matchIdToSlug(p.match.id)}`}
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
                  href={`/matches/${matchIdToSlug(p.match.id)}`}
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
// Pick generator — uses ONLY real odds, no randomness
// ───────────────────────────────────────────────
function buildBestBets(matches: MatchLite[]): Pick[] {
  const todayDate = new Date()
  const today = todayDate.toDateString()
  // End of TODAY in the user's local timezone — anything scheduled after
  // midnight should fall under tomorrow's panel, not today's.
  const endOfToday = new Date(todayDate)
  endOfToday.setHours(23, 59, 59, 999)
  const endTs = endOfToday.getTime()
  const now = Date.now()
  const candidates: Pick[] = []

  for (const m of matches) {
    if (!m.odds) continue
    // Skip hash-derived fake odds — they differ from real odds on match detail page
    if (m.odds.bookmaker === 'Computed' || m.odds.bookmaker === 'Estimated' || m.odds.bookmaker === 'computed') continue
    const status = (m.status || '').toLowerCase()
    // Only true "scheduled / not started" matches are eligible — anything that
    // has kicked off, ended, was postponed, or is otherwise settled is dropped.
    // This is what previously caused yesterday's games to leak into Consensus
    // Picks when their status hadn't been flipped to "finished" yet.
    if (status && status !== 'scheduled' && status !== 'upcoming' && status !== 'ns') continue

    const ko = new Date(m.kickoffTime).getTime()
    if (Number.isNaN(ko)) continue

    const koDate = new Date(ko).toDateString()
    if (koDate !== today) continue
    // Strictly future kickoffs only — no in-progress games, no recently-started
    // games. This is the panel's whole point: tips you can still bet on.
    if (ko <= now) continue
    if (ko > endTs) continue

    // Implied probabilities
    const hp = 1 / m.odds.home
    const ap = 1 / m.odds.away
    const dp = m.odds.draw ? 1 / m.odds.draw : 0
    const total = hp + ap + dp || 1
    const homeP = hp / total
    const awayP = ap / total
    const drawP = dp / total

    // Featured pick: strongest single outcome OR a strong double-chance
    const winner = homeP >= awayP ? "home" : "away"
    const winnerP = Math.max(homeP, awayP)
    const winnerOdds = winner === "home" ? m.odds.home : m.odds.away
    const winnerName = winner === "home" ? m.homeTeam.name : m.awayTeam.name

    // Only highlight clear edges
    if (winnerP < 0.45) continue

    // If draw is also likely, prefer Double Chance for safer pick
    if (m.odds.draw && drawP > 0.27 && winnerP < 0.6) {
      const dcPrice = 1 / (winnerP + drawP)
      candidates.push({
        match: m,
        market: "Double Chance",
        selection: `${winnerName} or Draw`,
        odds: Math.round(dcPrice * 100) / 100,
        confidence: Math.round((winnerP + drawP) * 100),
        rationale: `${winnerName} favoured but draw is in play.`,
      })
    } else {
      candidates.push({
        match: m,
        market: "Match Winner",
        selection: `${winnerName} to win`,
        odds: winnerOdds,
        confidence: Math.round(winnerP * 100),
        rationale: `Bookmaker favourite at ${winnerOdds.toFixed(2)}.`,
      })
    }
  }

  // Sort by confidence desc, take top 6, but require at least 50%
  return candidates
    .filter(p => p.confidence >= 50)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
}
