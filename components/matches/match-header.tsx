'use client';

import { cn } from '@/lib/utils';
import { useUserSettings } from '@/contexts/user-settings-context';
import { formatTime, formatDateTime, getDayLabel } from '@/lib/utils/timezone';
import { LiveIndicator } from './live-indicator';
import type { MatchWithDetails } from '@/lib/types';

interface MatchHeaderProps {
  match: MatchWithDetails;
}

export function MatchHeader({ match }: MatchHeaderProps) {
  const { settings } = useUserSettings();
  const isLive = match.status === 'live' || match.status === 'halftime';
  const isFinished = match.status === 'finished';

  const kickoffTime = new Date(match.kickoff_time);

  return (
    <div className={cn(
      'rounded-lg border border-border bg-card p-6',
      isLive && 'border-live/30 bg-live/5'
    )}>
      {/* League & Status */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-semibold">
            {match.league.name.charAt(0)}
          </div>
          <span>{match.league.name}</span>
        </div>
        {isLive ? (
          <LiveIndicator
            minute={match.minute}
            status={match.status}
            sportSlug={match.league?.slug || 'soccer'}
          />
        ) : isFinished ? (
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
            Full Time
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {getDayLabel(kickoffTime, settings.timezone)} at {formatTime(kickoffTime, settings.timezone)}
          </span>
        )}
      </div>

      {/* Teams & Score */}
      <div className="flex items-center justify-between gap-4">
        {/* Home Team */}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-bold">
            {match.home_team.name.substring(0, 3).toUpperCase()}
          </div>
          <span className="mt-2 truncate text-center text-lg font-semibold text-foreground">
            {match.home_team.name}
          </span>
        </div>

        {/* Score / Time */}
        <div className="flex flex-col items-center px-4">
          {isLive || isFinished ? (
            <>
              <div className="flex items-center gap-3">
                <span className={cn(
                  'text-4xl font-bold',
                  isLive && 'text-live'
                )}>
                  {match.home_score ?? 0}
                </span>
                <span className="text-2xl text-muted-foreground">-</span>
                <span className={cn(
                  'text-4xl font-bold',
                  isLive && 'text-live'
                )}>
                  {match.away_score ?? 0}
                </span>
              </div>
              {match.ht_score && (
                <span className="mt-1 text-xs text-muted-foreground">
                  HT: {match.ht_score}
                </span>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">
                {formatTime(kickoffTime, settings.timezone)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {getDayLabel(kickoffTime, settings.timezone)}
              </div>
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-bold">
            {match.away_team.name.substring(0, 3).toUpperCase()}
          </div>
          <span className="mt-2 truncate text-center text-lg font-semibold text-foreground">
            {match.away_team.name}
          </span>
        </div>
      </div>

      {/* Match Info */}
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span>{match.country?.name || 'International'}</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground"></span>
        <span>{formatDateTime(kickoffTime, settings.timezone)}</span>
      </div>
    </div>
  );
}
