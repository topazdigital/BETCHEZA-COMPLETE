"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, Target, Timer, Zap, Shield, 
  TrendingUp, Activity, Crosshair 
} from "lucide-react"

interface SportSpecificData {
  // Soccer
  possession?: { home: number; away: number };
  shots?: { home: number; away: number };
  shotsOnTarget?: { home: number; away: number };
  corners?: { home: number; away: number };
  fouls?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
  
  // Basketball
  quarters?: { home: number[]; away: number[] };
  rebounds?: { home: number; away: number };
  assists?: { home: number; away: number };
  steals?: { home: number; away: number };
  blocks?: { home: number; away: number };
  turnovers?: { home: number; away: number };
  fieldGoalPct?: { home: number; away: number };
  threePointPct?: { home: number; away: number };
  freeThrowPct?: { home: number; away: number };
  
  // American Football
  passingYards?: { home: number; away: number };
  rushingYards?: { home: number; away: number };
  totalYards?: { home: number; away: number };
  firstDowns?: { home: number; away: number };
  thirdDownConv?: { home: string; away: string };
  timeOfPossession?: { home: string; away: string };
  sacks?: { home: number; away: number };
  interceptions?: { home: number; away: number };
  fumbles?: { home: number; away: number };
  
  // Tennis
  sets?: { home: number[]; away: number[] };
  aces?: { home: number; away: number };
  doubleFaults?: { home: number; away: number };
  firstServePct?: { home: number; away: number };
  breakPoints?: { home: string; away: string };
  winners?: { home: number; away: number };
  unforcedErrors?: { home: number; away: number };
  
  // MMA
  round?: number;
  totalRounds?: number;
  strikes?: { home: number; away: number };
  takedowns?: { home: number; away: number };
  significantStrikes?: { home: number; away: number };
  
  // Ice Hockey
  powerPlayGoals?: { home: number; away: number };
  penaltyMinutes?: { home: number; away: number };
  faceoffWins?: { home: number; away: number };
  hitsCount?: { home: number; away: number };
  blockedShots?: { home: number; away: number };
  
  // Baseball
  hits?: { home: number; away: number };
  errors?: { home: number; away: number };
  innings?: { home: number[]; away: number[] };
  strikeouts?: { home: number; away: number };
  walks?: { home: number; away: number };
  homeRuns?: { home: number; away: number };
  
  // Cricket
  overs?: { home: string; away: string };
  wickets?: { home: number; away: number };
  runRate?: { home: number; away: number };
  extras?: { home: number; away: number };
}

interface SportSpecificStatsProps {
  sportId: number;
  sportName: string;
  homeTeam: string;
  awayTeam: string;
  data?: SportSpecificData;
  status: string;
}

// Stat comparison bar component
function StatBar({ 
  name, 
  home, 
  away, 
  unit = '',
  format = 'number'
}: { 
  name: string; 
  home: number | string; 
  away: number | string;
  unit?: string;
  format?: 'number' | 'percentage' | 'string';
}) {
  const homeNum = typeof home === 'number' ? home : parseFloat(home) || 0;
  const awayNum = typeof away === 'number' ? away : parseFloat(away) || 0;
  const total = homeNum + awayNum;
  const homePercent = total > 0 ? (homeNum / total) * 100 : 50;
  
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-sm tabular-nums">{home}{unit}</span>
        <span className="text-xs text-muted-foreground font-medium">{name}</span>
        <span className="font-bold text-sm tabular-nums">{away}{unit}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        <div 
          className="bg-primary transition-all duration-500"
          style={{ width: `${homePercent}%` }}
        />
        <div 
          className="bg-muted-foreground/40"
          style={{ width: `${100 - homePercent}%` }}
        />
      </div>
    </div>
  );
}

// Quarter/Period scores display
function PeriodScores({ 
  periods, 
  homeTeam, 
  awayTeam,
  periodName = 'Q'
}: { 
  periods: { home: number[]; away: number[] };
  homeTeam: string;
  awayTeam: string;
  periodName?: string;
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[300px] text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium text-muted-foreground">Team</th>
            {periods.home.map((_, i) => (
              <th key={i} className="text-center py-2 font-medium text-muted-foreground w-10">
                {periodName}{i + 1}
              </th>
            ))}
            <th className="text-center py-2 font-medium w-12">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2 font-medium truncate max-w-[100px]">{homeTeam}</td>
            {periods.home.map((score, i) => (
              <td key={i} className="text-center py-2 tabular-nums">{score}</td>
            ))}
            <td className="text-center py-2 font-bold tabular-nums">
              {periods.home.reduce((a, b) => a + b, 0)}
            </td>
          </tr>
          <tr>
            <td className="py-2 font-medium truncate max-w-[100px]">{awayTeam}</td>
            {periods.away.map((score, i) => (
              <td key={i} className="text-center py-2 tabular-nums">{score}</td>
            ))}
            <td className="text-center py-2 font-bold tabular-nums">
              {periods.away.reduce((a, b) => a + b, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SportSpecificStats({ 
  sportId, 
  sportName,
  homeTeam, 
  awayTeam, 
  data,
  status 
}: SportSpecificStatsProps) {
  if (!data || status === 'scheduled') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold mb-2">Statistics Not Available Yet</h3>
          <p className="text-sm text-muted-foreground">
            Live statistics will be available once the {sportName.toLowerCase()} match begins.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sport-specific rendering
  switch (sportId) {
    case 1: // Soccer
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" />
              Match Statistics
              <Badge variant="outline" className="ml-auto">Soccer</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.possession && (
              <StatBar name="Ball Possession" home={data.possession.home} away={data.possession.away} unit="%" />
            )}
            {data.shots && (
              <StatBar name="Total Shots" home={data.shots.home} away={data.shots.away} />
            )}
            {data.shotsOnTarget && (
              <StatBar name="Shots on Target" home={data.shotsOnTarget.home} away={data.shotsOnTarget.away} />
            )}
            {data.corners && (
              <StatBar name="Corner Kicks" home={data.corners.home} away={data.corners.away} />
            )}
            {data.fouls && (
              <StatBar name="Fouls" home={data.fouls.home} away={data.fouls.away} />
            )}
            {data.yellowCards && (
              <StatBar name="Yellow Cards" home={data.yellowCards.home} away={data.yellowCards.away} />
            )}
            {data.redCards && (
              <StatBar name="Red Cards" home={data.redCards.home} away={data.redCards.away} />
            )}
          </CardContent>
        </Card>
      );

    case 2: // Basketball
      return (
        <div className="space-y-4">
          {data.quarters && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Timer className="h-5 w-5 text-orange-500" />
                  Quarter Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PeriodScores 
                  periods={data.quarters} 
                  homeTeam={homeTeam} 
                  awayTeam={awayTeam}
                  periodName="Q"
                />
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                Game Statistics
                <Badge variant="outline" className="ml-auto">Basketball</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.fieldGoalPct && (
                <StatBar name="Field Goal %" home={data.fieldGoalPct.home} away={data.fieldGoalPct.away} unit="%" />
              )}
              {data.threePointPct && (
                <StatBar name="3-Point %" home={data.threePointPct.home} away={data.threePointPct.away} unit="%" />
              )}
              {data.freeThrowPct && (
                <StatBar name="Free Throw %" home={data.freeThrowPct.home} away={data.freeThrowPct.away} unit="%" />
              )}
              {data.rebounds && (
                <StatBar name="Total Rebounds" home={data.rebounds.home} away={data.rebounds.away} />
              )}
              {data.assists && (
                <StatBar name="Assists" home={data.assists.home} away={data.assists.away} />
              )}
              {data.steals && (
                <StatBar name="Steals" home={data.steals.home} away={data.steals.away} />
              )}
              {data.blocks && (
                <StatBar name="Blocks" home={data.blocks.home} away={data.blocks.away} />
              )}
              {data.turnovers && (
                <StatBar name="Turnovers" home={data.turnovers.home} away={data.turnovers.away} />
              )}
            </CardContent>
          </Card>
        </div>
      );

    case 5: // American Football
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-green-600" />
              Game Statistics
              <Badge variant="outline" className="ml-auto">NFL</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.totalYards && (
              <StatBar name="Total Yards" home={data.totalYards.home} away={data.totalYards.away} />
            )}
            {data.passingYards && (
              <StatBar name="Passing Yards" home={data.passingYards.home} away={data.passingYards.away} />
            )}
            {data.rushingYards && (
              <StatBar name="Rushing Yards" home={data.rushingYards.home} away={data.rushingYards.away} />
            )}
            {data.firstDowns && (
              <StatBar name="First Downs" home={data.firstDowns.home} away={data.firstDowns.away} />
            )}
            {data.thirdDownConv && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm">{data.thirdDownConv.home}</span>
                  <span className="text-xs text-muted-foreground font-medium">3rd Down Conv.</span>
                  <span className="font-bold text-sm">{data.thirdDownConv.away}</span>
                </div>
              </div>
            )}
            {data.timeOfPossession && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm">{data.timeOfPossession.home}</span>
                  <span className="text-xs text-muted-foreground font-medium">Time of Possession</span>
                  <span className="font-bold text-sm">{data.timeOfPossession.away}</span>
                </div>
              </div>
            )}
            {data.sacks && (
              <StatBar name="Sacks" home={data.sacks.home} away={data.sacks.away} />
            )}
            {data.interceptions && (
              <StatBar name="Interceptions" home={data.interceptions.home} away={data.interceptions.away} />
            )}
            {data.fumbles && (
              <StatBar name="Fumbles" home={data.fumbles.home} away={data.fumbles.away} />
            )}
          </CardContent>
        </Card>
      );

    case 3: // Tennis
      return (
        <div className="space-y-4">
          {data.sets && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-lime-500" />
                  Set Scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PeriodScores 
                  periods={data.sets} 
                  homeTeam={homeTeam} 
                  awayTeam={awayTeam}
                  periodName="Set "
                />
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-lime-500" />
                Match Statistics
                <Badge variant="outline" className="ml-auto">Tennis</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.aces && (
                <StatBar name="Aces" home={data.aces.home} away={data.aces.away} />
              )}
              {data.doubleFaults && (
                <StatBar name="Double Faults" home={data.doubleFaults.home} away={data.doubleFaults.away} />
              )}
              {data.firstServePct && (
                <StatBar name="1st Serve %" home={data.firstServePct.home} away={data.firstServePct.away} unit="%" />
              )}
              {data.breakPoints && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm">{data.breakPoints.home}</span>
                    <span className="text-xs text-muted-foreground font-medium">Break Points Won</span>
                    <span className="font-bold text-sm">{data.breakPoints.away}</span>
                  </div>
                </div>
              )}
              {data.winners && (
                <StatBar name="Winners" home={data.winners.home} away={data.winners.away} />
              )}
              {data.unforcedErrors && (
                <StatBar name="Unforced Errors" home={data.unforcedErrors.home} away={data.unforcedErrors.away} />
              )}
            </CardContent>
          </Card>
        </div>
      );

    case 27: // MMA
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crosshair className="h-5 w-5 text-red-500" />
              Fight Statistics
              <Badge variant="outline" className="ml-auto">MMA</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.round && data.totalRounds && (
              <div className="mb-4 text-center">
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  Round {data.round} of {data.totalRounds}
                </Badge>
              </div>
            )}
            <div className="space-y-1">
              {data.significantStrikes && (
                <StatBar name="Significant Strikes" home={data.significantStrikes.home} away={data.significantStrikes.away} />
              )}
              {data.strikes && (
                <StatBar name="Total Strikes" home={data.strikes.home} away={data.strikes.away} />
              )}
              {data.takedowns && (
                <StatBar name="Takedowns" home={data.takedowns.home} away={data.takedowns.away} />
              )}
            </div>
          </CardContent>
        </Card>
      );

    case 7: // Ice Hockey
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Game Statistics
              <Badge variant="outline" className="ml-auto">Hockey</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.shots && (
              <StatBar name="Shots on Goal" home={data.shots.home} away={data.shots.away} />
            )}
            {data.powerPlayGoals && (
              <StatBar name="Power Play Goals" home={data.powerPlayGoals.home} away={data.powerPlayGoals.away} />
            )}
            {data.penaltyMinutes && (
              <StatBar name="Penalty Minutes" home={data.penaltyMinutes.home} away={data.penaltyMinutes.away} />
            )}
            {data.faceoffWins && (
              <StatBar name="Faceoffs Won" home={data.faceoffWins.home} away={data.faceoffWins.away} />
            )}
            {data.hitsCount && (
              <StatBar name="Hits" home={data.hitsCount.home} away={data.hitsCount.away} />
            )}
            {data.blockedShots && (
              <StatBar name="Blocked Shots" home={data.blockedShots.home} away={data.blockedShots.away} />
            )}
          </CardContent>
        </Card>
      );

    case 6: // Baseball
      return (
        <div className="space-y-4">
          {data.innings && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-red-600" />
                  Inning Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PeriodScores 
                  periods={data.innings} 
                  homeTeam={homeTeam} 
                  awayTeam={awayTeam}
                  periodName=""
                />
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-red-600" />
                Game Statistics
                <Badge variant="outline" className="ml-auto">Baseball</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.hits && (
                <StatBar name="Hits" home={data.hits.home} away={data.hits.away} />
              )}
              {data.errors && (
                <StatBar name="Errors" home={data.errors.home} away={data.errors.away} />
              )}
              {data.homeRuns && (
                <StatBar name="Home Runs" home={data.homeRuns.home} away={data.homeRuns.away} />
              )}
              {data.strikeouts && (
                <StatBar name="Strikeouts" home={data.strikeouts.home} away={data.strikeouts.away} />
              )}
              {data.walks && (
                <StatBar name="Walks" home={data.walks.home} away={data.walks.away} />
              )}
            </CardContent>
          </Card>
        </div>
      );

    case 4: // Cricket
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              Match Statistics
              <Badge variant="outline" className="ml-auto">Cricket</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.overs && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm">{data.overs.home}</span>
                  <span className="text-xs text-muted-foreground font-medium">Overs</span>
                  <span className="font-bold text-sm">{data.overs.away}</span>
                </div>
              </div>
            )}
            {data.wickets && (
              <StatBar name="Wickets" home={data.wickets.home} away={data.wickets.away} />
            )}
            {data.runRate && (
              <StatBar name="Run Rate" home={data.runRate.home} away={data.runRate.away} />
            )}
            {data.extras && (
              <StatBar name="Extras" home={data.extras.home} away={data.extras.away} />
            )}
          </CardContent>
        </Card>
      );

    default:
      return null;
  }
}
