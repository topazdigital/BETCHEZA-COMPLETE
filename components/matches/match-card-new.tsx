'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUserSettings } from '@/contexts/user-settings-context';
import { formatOdds } from '@/lib/utils/odds-converter';
import { TeamLogo, SportIcon, LeagueFlag } from '@/components/ui/team-logo';
import { getBrowserTimezone, formatTime, formatDate, isToday, isTomorrow } from '@/lib/utils/timezone';
import { liveStatusLabel } from '@/lib/utils/live-status';
import { matchToSlug } from '@/lib/utils/match-url';
import { getTeamCategoryBadge } from '@/lib/utils/team-category';

// Match type from our API
interface Match {
  id: string;
  sportId: number;
  leagueId: number;
  homeTeam: {
    id: number | string;
    name: string;
    shortName: string;
    logo?: string;
    form?: string;
    record?: string;
  };
  awayTeam: {
    id: number | string;
    name: string;
    shortName: string;
    logo?: string;
    form?: string;
    record?: string;
  };
  kickoffTime: string | Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  minute?: number;
  league: {
    id: number;
    name: string;
    slug?: string;
    country: string;
    countryCode: string;
    tier: number;
    logo?: string;
  };
  sport: {
    id: number;
    name: string;
    slug: string;
    icon: string;
  };
  odds?: {
    home: number;
    draw?: number;
    away: number;
  };
  tipsCount: number;
}

interface MatchCardNewProps {
  match: Match;
  variant?: 'default' | 'compact' | 'featured';
  showLeague?: boolean;
  showSport?: boolean;
}

// Sports that don't have draws (use 2-way odds)
const NO_DRAW_SPORTS = new Set([
  'basketball', 'baseball', 'tennis', 'mma', 'boxing', 'golf',
  'formula-1', 'racing', 'horse-racing', 'darts', 'snooker',
  'american-football', 'ice-hockey', // OT means binary outcome for betting markets
]);

// Tiny inline badge for women's / youth fixtures
function CategoryBadge({ label }: { label: string }) {
  return (
    <span className="ml-1 inline-flex shrink-0 items-center rounded bg-primary/10 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
      {label}
    </span>
  );
}

export function MatchCardNew({ 
  match, 
  variant = 'default',
  showLeague = true,
  showSport = false 
}: MatchCardNewProps) {
  const { settings } = useUserSettings();
  const isLive = match.status === 'live' || match.status === 'halftime' || match.status === 'extra_time' || match.status === 'penalties';
  const isHalftime = match.status === 'halftime';
  const isFinished = match.status === 'finished';
  const isTwoWay = NO_DRAW_SPORTS.has(match.sport.slug);

  // Detect women's / age-group league — compute once for both teams
  const homeBadge = getTeamCategoryBadge(match.homeTeam.name, match.league.name, match.league.slug);
  const awayBadge = getTeamCategoryBadge(match.awayTeam.name, match.league.name, match.league.slug);
  const homeBadgeLabel = homeBadge.youthLabel || (homeBadge.isWomens ? 'W' : null);
  const awayBadgeLabel = awayBadge.youthLabel || (awayBadge.isWomens ? 'W' : null);

  // Use browser timezone for display
  const timezone = getBrowserTimezone();
  const kickoffTime = new Date(match.kickoffTime);
  const timeStr = formatTime(kickoffTime, timezone);
  
  // Smart date display: Today, Tomorrow, or date
  let dateStr: string;
  if (isToday(kickoffTime, timezone)) {
    dateStr = 'Today';
  } else if (isTomorrow(kickoffTime, timezone)) {
    dateStr = 'Tomorrow';
  } else {
    dateStr = formatDate(kickoffTime, timezone);
  }

  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:bg-card/80',
        isLive && 'border-live/30 bg-live/5'
      )}>
        {/* Time / Status */}
        <div className="w-14 shrink-0 text-center">
          {isLive ? (
            <div className="flex flex-col items-center">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-live"></span>
              </span>
              <span className="mt-1 text-[10px] font-bold text-live">
                {liveStatusLabel(match.sport.slug, match.status, match.minute)}
              </span>
            </div>
          ) : isFinished ? (
            <div className="text-xs text-muted-foreground">
              <div className="font-bold text-foreground/80">FT</div>
              <div className="text-[10px]">{dateStr}</div>
              <div className="text-[10px]">{timeStr}</div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              <div className="font-medium">{timeStr}</div>
              <div>{dateStr}</div>
            </div>
          )}
        </div>

        {/* Teams with logos */}
        <Link href={`/matches/${matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name)}`} className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} sportSlug={match.sport.slug} size="xs" />
              <span className={cn(
                'truncate text-sm font-medium',
                isFinished && match.homeScore !== null && match.awayScore !== null && 
                match.homeScore > match.awayScore && 'text-success'
              )}>
                {match.homeTeam.name}
              </span>
              {homeBadgeLabel && <CategoryBadge label={homeBadgeLabel} />}
            </div>
            {(isLive || isFinished) && match.homeScore !== null && (
              <span className={cn('font-mono text-sm font-bold', isLive && 'text-live')}>
                {match.homeScore}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} sportSlug={match.sport.slug} size="xs" />
              <span className={cn(
                'truncate text-sm font-medium',
                isFinished && match.homeScore !== null && match.awayScore !== null && 
                match.awayScore > match.homeScore && 'text-success'
              )}>
                {match.awayTeam.name}
              </span>
              {awayBadgeLabel && <CategoryBadge label={awayBadgeLabel} />}
            </div>
            {(isLive || isFinished) && match.awayScore !== null && (
              <span className={cn('font-mono text-sm font-bold', isLive && 'text-live')}>
                {match.awayScore}
              </span>
            )}
          </div>
        </Link>

        {/* League link */}
        {showLeague && (
          <Link 
            href={`/leagues/${match.league.slug || match.league.name.toLowerCase().replace(/\s+/g, '-')}`}
            className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary sm:flex"
            onClick={(e) => e.stopPropagation()}
          >
            <LeagueFlag countryCode={match.league.countryCode} size="xs" />
          </Link>
        )}

        {/* Odds — sport-aware */}
        {match.odds && !isFinished && (
          <div className="hidden shrink-0 gap-1 sm:flex">
            <OddsButton value={match.odds.home} label={isTwoWay ? 'H' : '1'} format={settings.oddsFormat} />
            {!isTwoWay && match.odds.draw !== undefined && (
              <OddsButton value={match.odds.draw} label="X" format={settings.oddsFormat} />
            )}
            <OddsButton value={match.odds.away} label={isTwoWay ? 'A' : '2'} format={settings.oddsFormat} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      'group rounded-lg border border-border bg-card px-3 py-2.5 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5',
      isLive && 'border-live/30 bg-gradient-to-br from-live/5 to-transparent',
      variant === 'featured' && 'bg-gradient-to-br from-card to-muted/30'
    )}>
      {/* Header with clickable league */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showSport && (
            <SportIcon sportSlug={match.sport.slug} size="md" />
          )}
          {showLeague && (
            <Link 
              href={`/leagues/${match.league.slug || match.league.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="flex items-center gap-1.5 hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <LeagueFlag countryCode={match.league.countryCode} size="sm" />
              <span className="text-xs text-muted-foreground hover:text-primary hover:underline">
                {match.league.name}
              </span>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="flex items-center gap-1.5 rounded-full bg-live/10 px-2 py-0.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-live"></span>
              </span>
              <span className="text-xs font-bold text-live">
                {liveStatusLabel(match.sport.slug, match.status, match.minute)}
              </span>
            </div>
          ) : isFinished ? (
            <div className="text-right text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">FT</span>
              <div className="mt-1 font-medium text-muted-foreground">{dateStr}</div>
              <div>{timeStr}</div>
            </div>
          ) : (
            <div className="text-right text-xs text-muted-foreground">
              <div className="font-medium">{dateStr}</div>
              <div>{timeStr}</div>
            </div>
          )}
        </div>
      </div>

      {/* Teams and Score with logos */}
      <Link href={`/matches/${matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name)}`} className="block">
        <div className="mb-2 space-y-1.5">
          {/* Home Team */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} sportSlug={match.sport.slug} size="sm" />
              <div className="min-w-0 flex-1">
                <span className={cn(
                  'inline-flex items-center truncate text-sm font-semibold',
                  isFinished && match.homeScore !== null && match.awayScore !== null && 
                  match.homeScore > match.awayScore && 'text-success'
                )}>
                  {match.homeTeam.name}
                  {homeBadgeLabel && <CategoryBadge label={homeBadgeLabel} />}
                </span>
                {match.homeTeam.form && !isLive && !isFinished && (
                  <FormDots form={match.homeTeam.form} />
                )}
              </div>
            </div>
            {(isLive || isFinished) && match.homeScore !== null && (
              <span className={cn(
                'font-mono text-xl font-bold',
                isLive && 'text-live'
              )}>
                {match.homeScore}
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} sportSlug={match.sport.slug} size="sm" />
              <div className="min-w-0 flex-1">
                <span className={cn(
                  'inline-flex items-center truncate text-sm font-semibold',
                  isFinished && match.homeScore !== null && match.awayScore !== null && 
                  match.awayScore > match.homeScore && 'text-success'
                )}>
                  {match.awayTeam.name}
                  {awayBadgeLabel && <CategoryBadge label={awayBadgeLabel} />}
                </span>
                {match.awayTeam.form && !isLive && !isFinished && (
                  <FormDots form={match.awayTeam.form} />
                )}
              </div>
            </div>
            {(isLive || isFinished) && match.awayScore !== null && (
              <span className={cn(
                'font-mono text-xl font-bold',
                isLive && 'text-live'
              )}>
                {match.awayScore}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Odds — sport-aware (no draw for basketball/tennis/MMA/etc) */}
      {match.odds && !isFinished && (
        <div className={cn(
          'grid gap-1.5',
          isTwoWay || match.odds.draw === undefined ? 'grid-cols-2' : 'grid-cols-3'
        )}>
          <OddsButton value={match.odds.home} label={isTwoWay ? match.homeTeam.shortName || 'Home' : '1'} format={settings.oddsFormat} size="lg" />
          {!isTwoWay && match.odds.draw !== undefined && (
            <OddsButton value={match.odds.draw} label="X" format={settings.oddsFormat} size="lg" />
          )}
          <OddsButton value={match.odds.away} label={isTwoWay ? match.awayTeam.shortName || 'Away' : '2'} format={settings.oddsFormat} size="lg" />
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{match.tipsCount} tips</span>
        <Link href={`/matches/${matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name)}`} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary">
          View details
        </Link>
      </div>
    </div>
  );
}

// Form Dots Component — shows last 5 results as tiny colored dots
function FormDots({ form }: { form: string }) {
  const results = form.split('').slice(-5);
  return (
    <div className="mt-0.5 flex items-center gap-0.5">
      {results.map((r, i) => (
        <span
          key={i}
          title={r === 'W' ? 'Win' : r === 'D' ? 'Draw' : 'Loss'}
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-yellow-500' : 'bg-red-500'
          )}
        />
      ))}
    </div>
  );
}

// Odds Button Component
function OddsButton({ 
  value, 
  label, 
  format,
  size = 'sm' 
}: { 
  value: number; 
  label: string; 
  format: 'decimal' | 'fractional' | 'american';
  size?: 'sm' | 'lg';
}) {
  return (
    <button className={cn(
      'flex flex-col items-center rounded-md bg-secondary transition-colors hover:bg-primary hover:text-primary-foreground',
      size === 'sm' ? 'px-2 py-1' : 'px-3 py-2'
    )}>
      <span className={cn(
        'text-muted-foreground',
        size === 'sm' ? 'text-[10px]' : 'text-xs'
      )}>{label}</span>
      <span className={cn(
        'font-mono font-semibold',
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}>{formatOdds(value, format)}</span>
    </button>
  );
}
