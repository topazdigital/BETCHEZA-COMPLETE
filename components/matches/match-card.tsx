'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUserSettings } from '@/contexts/user-settings-context';
import { formatTime } from '@/lib/utils/timezone';
import { formatOdds } from '@/lib/utils/odds-converter';
import type { MatchWithDetails } from '@/lib/types';
import { LiveIndicator } from './live-indicator';
import { matchToSlug } from '@/lib/utils/match-url';

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

  const href = `/matches/${match.api_id ? matchToSlug(match.api_id, match.home_team.name, match.away_team.name) : match.id}`;

  return (
    <Link href={href} className="block">
      <div
        className={cn(
          'group flex items-center gap-2 rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:bg-accent/30',
          isLive && 'border-live/30 bg-live/5',
          compact ? 'px-3 py-2' : 'px-3 py-2.5'
        )}
      >
        {/* Time / Status column */}
        <div className="flex w-12 shrink-0 flex-col items-center justify-center text-center">
          {isLive ? (
            <LiveIndicator
              minute={match.minute}
              status={match.status}
              sportSlug={match.league?.slug || 'soccer'}
              className="text-xs"
            />
          ) : isFinished ? (
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">FT</span>
          ) : (
            <>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {formatTime(kickoffTime, settings.timezone)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {kickoffTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </>
          )}
        </div>

        {/* Teams column */}
        <div className="min-w-0 flex-1">
          {/* League name - tiny */}
          <div className="mb-0.5 truncate text-[10px] text-muted-foreground">
            {match.league.name}
          </div>
          {/* Home team */}
          <div className="flex items-center justify-between gap-1">
            <span className={cn(
              'truncate text-[13px] font-semibold leading-tight',
              isFinished && match.home_score !== null && match.away_score !== null &&
              match.home_score > match.away_score && 'text-emerald-500'
            )}>
              {match.home_team.name}
            </span>
            {(isLive || isFinished) && match.home_score !== null && (
              <span className={cn(
                'shrink-0 font-mono text-sm font-bold tabular-nums',
                isLive && 'text-live'
              )}>
                {match.home_score}
              </span>
            )}
          </div>
          {/* Away team */}
          <div className="flex items-center justify-between gap-1">
            <span className={cn(
              'truncate text-[13px] font-semibold leading-tight',
              isFinished && match.home_score !== null && match.away_score !== null &&
              match.away_score > match.home_score && 'text-emerald-500'
            )}>
              {match.away_team.name}
            </span>
            {(isLive || isFinished) && match.away_score !== null && (
              <span className={cn(
                'shrink-0 font-mono text-sm font-bold tabular-nums',
                isLive && 'text-live'
              )}>
                {match.away_score}
              </span>
            )}
          </div>
        </div>

        {/* Odds column — 3 compact boxes */}
        {odds && !isFinished && (
          <div className="flex shrink-0 gap-1">
            {[
              { label: '1', value: odds.home },
              { label: 'X', value: odds.draw },
              { label: '2', value: odds.away },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex w-11 flex-col items-center justify-center rounded-md bg-muted/70 py-1 text-center transition-colors group-hover:bg-muted"
              >
                <span className="text-[9px] font-medium text-muted-foreground">{label}</span>
                <span className="text-[12px] font-bold tabular-nums text-foreground">
                  {formatOdds(value, settings.oddsFormat)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Score only (finished, no odds) */}
        {isFinished && match.home_score !== null && match.away_score !== null && !odds && (
          <div className="shrink-0 text-center">
            <span className="font-mono text-base font-bold">
              {match.home_score} - {match.away_score}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
