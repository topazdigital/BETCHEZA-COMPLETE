"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Match } from "@/lib/types"

interface HeadToHeadProps {
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
}

// Mock H2H data - will be replaced with API data
const mockH2HData = {
  totalMatches: 12,
  homeWins: 5,
  draws: 4,
  awayWins: 3,
  recentMatches: [
    { date: "2026-01-15", homeTeam: "Arsenal", awayTeam: "Chelsea", homeScore: 2, awayScore: 1, competition: "Premier League" },
    { date: "2025-10-22", homeTeam: "Chelsea", awayTeam: "Arsenal", homeScore: 1, awayScore: 1, competition: "Premier League" },
    { date: "2025-04-10", homeTeam: "Arsenal", awayTeam: "Chelsea", homeScore: 0, awayScore: 2, competition: "FA Cup" },
    { date: "2024-12-05", homeTeam: "Chelsea", awayTeam: "Arsenal", homeScore: 2, awayScore: 2, competition: "Premier League" },
    { date: "2024-08-18", homeTeam: "Arsenal", awayTeam: "Chelsea", homeScore: 3, awayScore: 1, competition: "Premier League" },
  ]
}

export function HeadToHead({ homeTeam, awayTeam, homeLogo, awayLogo }: HeadToHeadProps) {
  const { totalMatches, homeWins, draws, awayWins, recentMatches } = mockH2HData
  
  const homeWinPercentage = (homeWins / totalMatches) * 100
  const drawPercentage = (draws / totalMatches) * 100
  const awayWinPercentage = (awayWins / totalMatches) * 100

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Head to Head</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">{homeWins}</div>
            <div className="text-xs text-muted-foreground">{homeTeam} Wins</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-muted-foreground">{draws}</div>
            <div className="text-xs text-muted-foreground">Draws</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">{awayWins}</div>
            <div className="text-xs text-muted-foreground">{awayTeam} Wins</div>
          </div>
        </div>

        {/* Visual Bar */}
        <div className="space-y-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className="bg-success transition-all" 
              style={{ width: `${homeWinPercentage}%` }}
            />
            <div 
              className="bg-muted-foreground/30 transition-all" 
              style={{ width: `${drawPercentage}%` }}
            />
            <div 
              className="bg-primary transition-all" 
              style={{ width: `${awayWinPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(homeWinPercentage)}%</span>
            <span>{Math.round(drawPercentage)}%</span>
            <span>{Math.round(awayWinPercentage)}%</span>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Recent Meetings</h4>
          <div className="space-y-2">
            {recentMatches.map((match, index) => {
              const isHomeWin = match.homeScore > match.awayScore
              const isAwayWin = match.awayScore > match.homeScore
              const isDraw = match.homeScore === match.awayScore

              return (
                <div 
                  key={index}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(match.date).toLocaleDateString("en-US", { 
                        month: "short", 
                        day: "numeric",
                        year: "numeric"
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">{match.competition}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-sm font-medium",
                      isHomeWin && "text-success"
                    )}>
                      {match.homeTeam}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "rounded bg-muted px-2 py-1 text-sm font-bold",
                        isHomeWin && "bg-success/20 text-success",
                        isAwayWin && "bg-muted"
                      )}>
                        {match.homeScore}
                      </span>
                      <span className="text-muted-foreground">-</span>
                      <span className={cn(
                        "rounded bg-muted px-2 py-1 text-sm font-bold",
                        isAwayWin && "bg-success/20 text-success",
                        isHomeWin && "bg-muted"
                      )}>
                        {match.awayScore}
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      isAwayWin && "text-success"
                    )}>
                      {match.awayTeam}
                    </span>
                  </div>

                  <Badge variant={isDraw ? "secondary" : "outline"} className={cn(
                    "text-xs",
                    isHomeWin && "bg-success/10 text-success border-success/30",
                    isAwayWin && "bg-primary/10 text-primary border-primary/30"
                  )}>
                    {isDraw ? "D" : isHomeWin ? "H" : "A"}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Based on {totalMatches} matches
        </p>
      </CardContent>
    </Card>
  )
}
