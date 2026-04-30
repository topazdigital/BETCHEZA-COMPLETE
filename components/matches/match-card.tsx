'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserSettings } from '@/contexts/user-settings-context';
import { formatTime, formatRelativeTime } from '@/lib/utils/timezone';
import { formatOdds } from '@/lib/utils/odds-converter';
import type { MatchWithDetails } from '@/lib/types';
import { LiveIndicator } from './live-indicator';
import { LeagueFlag } from '@/components/ui/team-logo';
import { matchIdToSlug } from '@/lib/utils/match-url';

interface MatchCardProps {
  match: MatchWithDetails;
  odds?: { home: number; draw: number; away: number };
  compact?: boolean;
}

export function MatchCard({ match, odds, compact = false }: MatchCardProps) {
  const { settings } = useUserSettings();
  const isLive = match.status === 'live' || match.status === 'halftime';
  const isFinished = match.status === 'finished';

  const kickoffTime = new Date(match.kickoff_time);

  return (
    <Link href={`/matches/${matchIdToSlug(match.id)}`} className="block">
      <div
        className={cn(
          'group rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:shadow-sm',
          isLive && 'border-live/30 bg-live/5',
          compact ? 'p-3' : 'p-4'
        )}
      >
        {/* Header */}
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            {match.country?.code && (
              <LeagueFlag countryCode={match.country.code} size="xs" />
            )}
            <span className="truncate">{match.league.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <LiveIndicator
                minute={match.minute}
                status={match.status}
                sportSlug={match.league?.slug || 'soccer'}
              />
            ) : isFinished ? (
              <span className="font-medium text-foreground">FT</span>
            ) : (
              <span>{formatTime(kickoffTime, settings.timezone)}</span>
            )}
          </div>
        </div>

        {/* Teams and Score */}
        <div className="space-y-2">
          {/* Home Team */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold">
                {match.home_team.name.charAt(0)}
              </div>
              <span className={cn(
                'truncate text-sm font-medium',
                isFinished && match.home_score !== null && match.away_score !== null && 
                match.home_score > match.away_score && 'text-success'
              )}>
                {match.home_team.name}
              </span>
            </div>
            {(isLive || isFinished) && match.home_score !== null && (
              <span className={cn(
                'font-mono text-lg font-bold',
                isLive && 'text-live'
              )}>
                {match.home_score}
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold">
                {match.away_team.name.charAt(0)}
              </div>
              <span className={cn(
                'truncate text-sm font-medium',
                isFinished && match.home_score !== null && match.away_score !== null && 
                match.away_score > match.home_score && 'text-success'
              )}>
                {match.away_team.name}
              </span>
            </div>
            {(isLive || isFinished) && match.away_score !== null && (
              <span className={cn(
                'font-mono text-lg font-bold',
                isLive && 'text-live'
              )}>
                {match.away_score}
              </span>
            )}
          </div>
        </div>

        {/* Odds */}
        {odds && !isFinished && (
          <div className="mt-3 grid grid-cols-3 gap-1">
            <button className="rounded bg-secondary px-2 py-1.5 text-center transition-colors hover:bg-primary hover:text-primary-foreground">
              <div className="text-[10px] text-muted-foreground">1</div>
              <div className="font-mono text-sm font-semibold">
                {formatOdds(odds.home, settings.oddsFormat)}
              </div>
            </button>
            <button className="rounded bg-secondary px-2 py-1.5 text-center transition-colors hover:bg-primary hover:text-primary-foreground">
              <div className="text-[10px] text-muted-foreground">X</div>
              <div className="font-mono text-sm font-semibold">
                {formatOdds(odds.draw, settings.oddsFormat)}
              </div>
            </button>
            <button className="rounded bg-secondary px-2 py-1.5 text-center transition-colors hover:bg-primary hover:text-primary-foreground">
              <div className="text-[10px] text-muted-foreground">2</div>
              <div className="font-mono text-sm font-semibold">
                {formatOdds(odds.away, settings.oddsFormat)}
              </div>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>{match.tips_count || 0} tips</span>
          </div>
          {!isLive && !isFinished && (
            <span>{formatRelativeTime(kickoffTime)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
