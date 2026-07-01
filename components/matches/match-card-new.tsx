'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ExternalLink, Lightbulb, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserSettings } from '@/contexts/user-settings-context';
import { useBetSlip } from '@/contexts/bet-slip-context';
import { formatOdds } from '@/lib/utils/odds-converter';
import { TeamLogo, SportIcon, LeagueFlag } from '@/components/ui/team-logo';
import { getBrowserTimezone, formatTime, formatDate, isToday, isTomorrow } from '@/lib/utils/timezone';
import { liveStatusLabel, isMinuteTickingSport } from '@/lib/utils/live-status';
import { matchToSlug } from '@/lib/utils/match-url';
import { getTeamCategoryBadge } from '@/lib/utils/team-category';
import { BookmakerOddsStrip } from '@/components/matches/bookmaker-odds-strip';

/**
 * Ticking live-minute hook for match cards.
 * - Uses storedMinute (from API) as the authoritative base.
 * - Records the wall-clock time when that minute was received.
 * - Ticks every 10 s and advances the display by the real elapsed time.
 * - This way the displayed minute stays in sync with the API rather than
 *   drifting behind between 10-second polls.
 */
function useLiveCardMinute(
  storedMinute: number | undefined,
  status: string,
  sportSlug: string,
  kickoffTime: string | Date,
  period?: string,
): number {
  const [minute, setMinute] = useState(storedMinute ?? 0);

  // Always sync to the API minute — no local interpolation.
  // The live hook refreshes every 10s so the API minute is authoritative.
  useEffect(() => {
    if (status === 'halftime' || status === 'ht') {
      setMinute(45);
    } else {
      setMinute(storedMinute ?? 0);
    }
  }, [storedMinute, status]);

  return minute;
}

interface MarketOutcome {
  name: string;
  price: number;
}
interface MatchMarket {
  key?: string;
  name: string;
  outcomes: MarketOutcome[];
}

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
  period?: string;
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
  markets?: MatchMarket[];
  tipsCount: number;
  legInfo?: string | null;
  roundName?: string | null;
}

interface MatchCardNewProps {
  match: Match;
  variant?: 'default' | 'compact' | 'featured';
  showLeague?: boolean;
  showSport?: boolean;
}

const NO_DRAW_SPORTS = new Set([
  'basketball', 'baseball', 'tennis', 'mma', 'boxing', 'golf',
  'formula-1', 'racing', 'horse-racing', 'darts', 'snooker',
  'american-football', 'ice-hockey',
]);

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
  showSport = false,
}: MatchCardNewProps) {
  const { settings } = useUserSettings();
  const isLive = match.status === 'live' || match.status === 'halftime' || match.status === 'extra_time' || match.status === 'penalties';
  const FINISHED_STATUSES = new Set(['finished', 'ft', 'full-time', 'fulltime', 'ended', 'complete', 'completed', 'final', 'post', 'after_et', 'after_pens']);
  const isFinished = FINISHED_STATUSES.has(match.status);

  // Infer "likely ended" when the API hasn't updated the status yet but the match
  // is well past its expected end time. Sport-specific duration estimates:
  const SPORT_DURATION_MS: Record<string, number> = {
    soccer: 115 * 60 * 1000,
    rugby: 115 * 60 * 1000,
    basketball: 150 * 60 * 1000,
    'ice-hockey': 140 * 60 * 1000,
    hockey: 140 * 60 * 1000,
    tennis: 240 * 60 * 1000,
    baseball: 240 * 60 * 1000,
    cricket: 600 * 60 * 1000,
    'american-football': 240 * 60 * 1000,
    mma: 90 * 60 * 1000,
    boxing: 90 * 60 * 1000,
  };
  const durationMs = SPORT_DURATION_MS[match.sport.slug] ?? 130 * 60 * 1000;
  // Time-based fallback: if kickoff + expected duration has passed, the match
  // has almost certainly ended regardless of what the API status says.
  // We intentionally do NOT gate on match.minute > 0 — ESPN sometimes keeps
  // status='scheduled' with minute > 0 for matches that have actually finished,
  // which previously blocked this heuristic from triggering.
  const isLikelyEnded =
    !isLive && !isFinished &&
    new Date(match.kickoffTime).getTime() + durationMs < Date.now();

  const statusForLabel = match.status === 'halftime' ? 'halftime' : match.status;
  const isTwoWay = NO_DRAW_SPORTS.has(match.sport.slug);

  // mounted guard: render UTC on server/first-paint, then switch to user timezone
  // This prevents a React hydration mismatch when the server renders UTC
  // but the browser has a different timezone.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Locally ticking live minute — updates every 15 s without waiting for API refresh
  const liveMinute = useLiveCardMinute(
    match.minute,
    match.status,
    match.sport.slug,
    match.kickoffTime,
    match.period,
  );

  const homeBadge = getTeamCategoryBadge(match.homeTeam.name, match.league.name, match.league.slug);
  const awayBadge = getTeamCategoryBadge(match.awayTeam.name, match.league.name, match.league.slug);
  const homeBadgeLabel = homeBadge.youthLabel || (homeBadge.isWomens ? 'W' : null);
  const awayBadgeLabel = awayBadge.youthLabel || (awayBadge.isWomens ? 'W' : null);

  // Use 'UTC' until after hydration, then switch to the user's detected timezone
  const timezone = mounted ? (settings.timezone || getBrowserTimezone()) : 'UTC';
  const kickoffTime = new Date(match.kickoffTime);
  const timeStr = formatTime(kickoffTime, timezone);

  let dateStr: string;
  if (isToday(kickoffTime, timezone)) {
    dateStr = 'Today';
  } else if (isTomorrow(kickoffTime, timezone)) {
    dateStr = 'Tomorrow';
  } else {
    dateStr = formatDate(kickoffTime, timezone);
  }

  const slug = matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name);
  const matchName = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const marketName = isTwoWay ? 'Match Winner' : '1X2';

  if (variant === 'compact') {
    const aiPickArr = (match.odds && !isFinished && !isLive && !isLikelyEnded)
      ? computeSmartPick(match.odds, match.homeTeam.name, match.awayTeam.name, match.markets, match.homeTeam.form, match.awayTeam.form, match.sport.slug)
      : [];
    const aiPick = aiPickArr[0] ?? null;

    return (
      <div className={cn(
        'rounded-lg border border-border bg-card px-2.5 py-2 transition-all hover:border-primary/50 hover:bg-card/80',
        isLive && 'border-live/30 bg-live/5'
      )}>
        {/* Main row */}
        <div className="flex items-center gap-2">
          {/* Time / Status — fixed narrow column, never grows */}
          <div className="w-[42px] shrink-0 text-center">
            {isLive ? (
              <div className="flex flex-col items-center gap-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live"></span>
                </span>
                <span className="text-[10px] font-bold leading-none text-live">
                  {liveStatusLabel(match.sport.slug, statusForLabel, liveMinute)}
                </span>
              </div>
            ) : (isFinished || isLikelyEnded) ? (
              <div className="leading-tight text-muted-foreground">
                <div className={cn("text-[10px] font-bold uppercase", isLikelyEnded && !isFinished ? "text-muted-foreground" : "text-foreground/70")}>{isLikelyEnded && !isFinished ? 'Ended' : 'FT'}</div>
                <div className="text-[9px]">{timeStr}</div>
              </div>
            ) : (
              <div className="leading-tight text-muted-foreground">
                <div className="text-[11px] font-semibold tabular-nums text-foreground">{timeStr}</div>
                {dateStr !== 'Today' && (
                  <div className={cn('text-[9px]', dateStr === 'Tomorrow' && 'font-medium text-primary/70')}>{dateStr}</div>
                )}
              </div>
            )}
          </div>

          {/* Teams — takes all remaining space, truncates names */}
          <Link href={`/matches/${slug}`} className="min-w-0 flex-1">
            {/* Home */}
            <div className="flex min-w-0 items-center justify-between gap-1">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} sportSlug={match.sport.slug} size="xs" />
                <span className={cn(
                  'min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight',
                  isFinished && match.homeScore !== null && match.awayScore !== null &&
                  match.homeScore > match.awayScore && 'text-success'
                )}>
                  {match.homeTeam.name}
                  {homeBadgeLabel && <CategoryBadge label={homeBadgeLabel} />}
                </span>
              </div>
              {(isLive || isFinished) && match.homeScore !== null && (
                <span className={cn('shrink-0 font-mono text-sm font-bold tabular-nums', isLive && 'text-live')}>
                  {match.homeScore}
                </span>
              )}
            </div>
            {/* Away */}
            <div className="flex min-w-0 items-center justify-between gap-1">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} sportSlug={match.sport.slug} size="xs" />
                <span className={cn(
                  'min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight',
                  isFinished && match.homeScore !== null && match.awayScore !== null &&
                  match.awayScore > match.homeScore && 'text-success'
                )}>
                  {match.awayTeam.name}
                  {awayBadgeLabel && <CategoryBadge label={awayBadgeLabel} />}
                </span>
              </div>
              {(isLive || isFinished) && match.awayScore !== null && (
                <span className={cn('shrink-0 font-mono text-sm font-bold tabular-nums', isLive && 'text-live')}>
                  {match.awayScore}
                </span>
              )}
            </div>
          </Link>

          {/* AI Pick inline chip — desktop: between teams & odds; hidden on mobile */}
          {aiPick && (
            <Link
              href={`/matches/${slug}#prediction`}
              onClick={(e) => e.stopPropagation()}
              className="hidden sm:flex shrink-0 flex-col items-center gap-0.5 rounded-md bg-primary/8 px-1.5 py-1 hover:bg-primary/15 transition-colors"
            >
              <span className="flex items-center gap-0.5">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
                <span className="text-[9px] font-bold text-primary uppercase tracking-wide">AI</span>
              </span>
              {aiPick.market !== '1X2' && (
                <span className="text-[8px] font-bold text-primary/70 leading-none">{aiPick.market}</span>
              )}
              <span className="text-[13px] font-black text-foreground leading-none">{aiPick.pick}</span>
              <span className="text-[9px] font-semibold text-primary leading-none">{aiPick.confidence}%</span>
            </Link>
          )}

          {/* League flag — desktop only */}
          {showLeague && (
            <Link
              href={`/leagues/${match.league.slug || match.league.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary lg:flex"
              onClick={(e) => e.stopPropagation()}
            >
              <LeagueFlag countryCode={match.league.countryCode} size="xs" />
            </Link>
          )}

          {/* Odds — 1X2 always first, then O/U 2.5 and BTTS on xl screens (all clickable) */}
          {match.odds && !isFinished && !isLikelyEnded && (() => {
            const ouMkt = !isLive && match.markets ? match.markets.find(m =>
              (m.key ?? '').toLowerCase().includes('total') ||
              m.name.toLowerCase().includes('over') ||
              m.name.toLowerCase().includes('total goals')
            ) : undefined;
            const bttsMkt = !isLive && match.markets ? match.markets.find(m =>
              (m.key ?? '').toLowerCase().includes('btts') ||
              m.name.toLowerCase().includes('both teams')
            ) : undefined;
            const ouOver  = ouMkt?.outcomes.find(o => o.name.toLowerCase().includes('over'));
            const ouUnder = ouMkt?.outcomes.find(o => o.name.toLowerCase().includes('under'));
            const bttsYes = bttsMkt?.outcomes.find(o => o.name.toLowerCase() === 'yes');
            const bttsNo  = bttsMkt?.outcomes.find(o => o.name.toLowerCase() === 'no');
            const hasExtra = !!(ouOver || ouUnder || bttsYes || bttsNo);
            return (
              <div className="flex shrink-0 items-end gap-2">
                {/* 1X2 group */}
                <div className="flex flex-col items-center gap-0.5">
                  {hasExtra && (
                    <span className="hidden xl:block text-[8px] font-bold uppercase tracking-wide text-muted-foreground leading-none">1X2</span>
                  )}
                  <div className="flex gap-0.5">
                    <OddsButton
                      value={match.odds.home}
                      label={isTwoWay ? 'H' : '1'}
                      format={settings.oddsFormat}
                      matchId={match.id}
                      matchSlug={slug}
                      matchName={matchName}
                      outcomeName={match.homeTeam.name}
                      marketKey="h2h"
                      marketName={marketName}
                    />
                    {!isTwoWay && match.odds.draw !== undefined && (
                      <OddsButton
                        value={match.odds.draw}
                        label="X"
                        format={settings.oddsFormat}
                        matchId={match.id}
                        matchSlug={slug}
                        matchName={matchName}
                        outcomeName="Draw"
                        marketKey="h2h"
                        marketName={marketName}
                      />
                    )}
                    <OddsButton
                      value={match.odds.away}
                      label={isTwoWay ? 'A' : '2'}
                      format={settings.oddsFormat}
                      matchId={match.id}
                      matchSlug={slug}
                      matchName={matchName}
                      outcomeName={match.awayTeam.name}
                      marketKey="h2h"
                      marketName={marketName}
                    />
                  </div>
                </div>
                {/* O/U 2.5 group — xl screens, clickable OddsButton */}
                {(ouOver || ouUnder) && (
                  <div className="hidden xl:flex flex-col items-center gap-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground leading-none">O/U 2.5</span>
                    <div className="flex gap-0.5">
                      {ouOver && (
                        <OddsButton
                          value={ouOver.price}
                          label="Ov"
                          format={settings.oddsFormat}
                          matchId={match.id}
                          matchSlug={slug}
                          matchName={matchName}
                          outcomeName="Over 2.5"
                          marketKey="totals"
                          marketName="Over/Under 2.5"
                        />
                      )}
                      {ouUnder && (
                        <OddsButton
                          value={ouUnder.price}
                          label="Un"
                          format={settings.oddsFormat}
                          matchId={match.id}
                          matchSlug={slug}
                          matchName={matchName}
                          outcomeName="Under 2.5"
                          marketKey="totals"
                          marketName="Over/Under 2.5"
                        />
                      )}
                    </div>
                  </div>
                )}
                {/* BTTS group — xl screens, clickable OddsButton */}
                {(bttsYes || bttsNo) && (
                  <div className="hidden xl:flex flex-col items-center gap-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground leading-none">BTTS</span>
                    <div className="flex gap-0.5">
                      {bttsYes && (
                        <OddsButton
                          value={bttsYes.price}
                          label="Yes"
                          format={settings.oddsFormat}
                          matchId={match.id}
                          matchSlug={slug}
                          matchName={matchName}
                          outcomeName="Yes"
                          marketKey="btts"
                          marketName="Both Teams to Score"
                        />
                      )}
                      {bttsNo && (
                        <OddsButton
                          value={bttsNo.price}
                          label="No"
                          format={settings.oddsFormat}
                          matchId={match.id}
                          matchSlug={slug}
                          matchName={matchName}
                          outcomeName="No"
                          marketKey="btts"
                          marketName="Both Teams to Score"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* AI Pick row — mobile only, below main row */}
        {aiPick && (
          <Link
            href={`/matches/${slug}#prediction`}
            onClick={(e) => e.stopPropagation()}
            className="sm:hidden mt-1.5 ml-[50px] flex items-center gap-1.5 rounded-md bg-primary/8 px-2 py-1 text-[10px] hover:bg-primary/15 transition-colors"
          >
            <Sparkles className="h-3 w-3 shrink-0 text-primary" />
            <span className="font-semibold text-primary">AI Pick</span>
            {aiPick.market !== '1X2' && (
              <span className="rounded bg-primary/15 px-1 py-px font-bold text-primary">{aiPick.market}</span>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="font-black text-foreground">{aiPick.pick}</span>
            <span className="truncate text-muted-foreground">{aiPick.label}</span>
            <span className="ml-auto font-semibold text-primary">{aiPick.confidence}%</span>
          </Link>
        )}

        {/* Bookmaker odds comparison strip */}
        {match.odds && !isFinished && !isLive && (
          <BookmakerOddsStrip
            matchId={match.id}
            matchSlug={slug}
            hasDraw={!isTwoWay}
          />
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
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showSport && (
            <SportIcon sportSlug={match.sport.slug} size="md" />
          )}
          {showLeague && (
            <Link
              href={`/leagues/${match.league.slug || match.league.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="flex min-w-0 items-center gap-1.5 hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <LeagueFlag countryCode={match.league.countryCode} size="sm" />
              <span className="truncate text-xs text-muted-foreground hover:text-primary hover:underline">
                {match.league.name}
              </span>
            </Link>
          )}
          {(match.roundName || match.legInfo) && (
            <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              {match.roundName && match.legInfo
                ? `${match.roundName} · ${match.legInfo}`
                : match.roundName || match.legInfo}
            </span>
          )}
        </div>
        <div className="shrink-0">
          {isLive ? (
            <div className="flex items-center gap-1.5 rounded-full bg-live/10 px-2 py-0.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-live"></span>
              </span>
              <span className="text-xs font-bold text-live">
                {liveStatusLabel(match.sport.slug, statusForLabel, liveMinute)}
              </span>
            </div>
          ) : (isFinished || isLikelyEnded) ? (
            <div className="text-right text-xs text-muted-foreground">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", isLikelyEnded && !isFinished ? "bg-muted/50 text-muted-foreground" : "bg-muted")}>{isLikelyEnded && !isFinished ? 'Ended' : 'FT'}</span>
              <div className="mt-0.5">{formatDate(kickoffTime, timezone)} · {timeStr}</div>
            </div>
          ) : (
            <div className="text-right text-xs text-muted-foreground">
              {dateStr !== 'Today' && (
                <div className={cn('font-medium', dateStr === 'Tomorrow' && 'text-primary/70')}>{dateStr}</div>
              )}
              <div>{timeStr}</div>
            </div>
          )}
        </div>
      </div>

      {/* Teams */}
      <Link href={`/matches/${slug}`} className="block">
        <div className="mb-2 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} sportSlug={match.sport.slug} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  <span className={cn(
                    'truncate text-sm font-semibold',
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.homeScore > match.awayScore && 'text-success'
                  )}>
                    {match.homeTeam.name}
                  </span>
                  {homeBadgeLabel && <CategoryBadge label={homeBadgeLabel} />}
                </div>
                {match.homeTeam.form && !isLive && !isFinished && (
                  <FormDots form={match.homeTeam.form} />
                )}
              </div>
            </div>
            {(isLive || isFinished) && match.homeScore !== null && (
              <span className={cn('font-mono text-xl font-bold shrink-0', isLive && 'text-live')}>
                {match.homeScore}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} sportSlug={match.sport.slug} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  <span className={cn(
                    'truncate text-sm font-semibold',
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.awayScore > match.homeScore && 'text-success'
                  )}>
                    {match.awayTeam.name}
                  </span>
                  {awayBadgeLabel && <CategoryBadge label={awayBadgeLabel} />}
                </div>
                {match.awayTeam.form && !isLive && !isFinished && (
                  <FormDots form={match.awayTeam.form} />
                )}
              </div>
            </div>
            {(isLive || isFinished) && match.awayScore !== null && (
              <span className={cn('font-mono text-xl font-bold shrink-0', isLive && 'text-live')}>
                {match.awayScore}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Odds */}
      {match.odds && !isFinished && (
        <div className={cn(
          'grid gap-1.5',
          isTwoWay || match.odds.draw === undefined ? 'grid-cols-2' : 'grid-cols-3'
        )}>
          <OddsButton
            value={match.odds.home}
            label={isTwoWay ? match.homeTeam.shortName || 'Home' : '1'}
            format={settings.oddsFormat}
            size="lg"
            matchId={match.id}
            matchSlug={slug}
            matchName={matchName}
            outcomeName={match.homeTeam.name}
            marketKey="h2h"
            marketName={marketName}
          />
          {!isTwoWay && match.odds.draw !== undefined && (
            <OddsButton
              value={match.odds.draw}
              label="X"
              format={settings.oddsFormat}
              size="lg"
              matchId={match.id}
              matchSlug={slug}
              matchName={matchName}
              outcomeName="Draw"
              marketKey="h2h"
              marketName={marketName}
            />
          )}
          <OddsButton
            value={match.odds.away}
            label={isTwoWay ? match.awayTeam.shortName || 'Away' : '2'}
            format={settings.oddsFormat}
            size="lg"
            matchId={match.id}
            matchSlug={slug}
            matchName={matchName}
            outcomeName={match.awayTeam.name}
            marketKey="h2h"
            marketName={marketName}
          />
        </div>
      )}

      {/* Secondary markets row — visible on md+ when markets are available */}
      {match.odds && !isFinished && !isLive && match.markets && match.markets.length > 0 && (() => {
        // Pick best secondary markets to show: prefer BTTS, O/U 2.5, then any 2-outcome market
        const PREFER = ['btts', 'totals_2_5', 'totals', 'double_chance', 'dnb', 'draw_no_bet'];
        const sorted = [...match.markets].sort((a, b) => {
          const ak = (a.key || a.name || '').toLowerCase();
          const bk = (b.key || b.name || '').toLowerCase();
          const ai = PREFER.findIndex(p => ak.includes(p));
          const bi = PREFER.findIndex(p => bk.includes(p));
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        const secondary = sorted.slice(0, 2).filter(m => m.outcomes && m.outcomes.length >= 2);
        if (secondary.length === 0) return null;
        return (
          <div className="hidden md:flex gap-2 mt-1.5 flex-wrap">
            {secondary.map((mkt) => {
              const key = mkt.key || mkt.name || '';
              const outcomes = mkt.outcomes.slice(0, 2);
              return (
                <div key={key} className="flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1">
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0 mr-0.5">
                    {mkt.name.length > 8 ? mkt.name.replace('Both Teams to Score', 'BTTS').replace('Over/Under', 'O/U').replace('Goals', '').trim() : mkt.name}
                  </span>
                  {outcomes.map((o, i) => (
                    <Link
                      key={o.name}
                      href={`/matches/${slug}?market=${encodeURIComponent(key)}`}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-primary/10',
                        i === 0 ? 'text-foreground' : 'text-muted-foreground'
                      )}
                      title={`${o.name}: ${o.price}`}
                    >
                      <span className="truncate max-w-[40px]">{o.name.length > 6 ? o.name.slice(0, 4) : o.name}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{o.price.toFixed(2)}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Bookmaker odds comparison strip — only for scheduled (upcoming) matches */}
      {match.odds && !isFinished && !isLive && (
        <BookmakerOddsStrip
          matchId={match.id}
          matchSlug={slug}
          hasDraw={!isTwoWay}
        />
      )}

      {/* SmartBet AI pick — default/featured variant, only for scheduled matches with odds */}
      {match.odds && !isFinished && !isLive && (
        <div className="mt-2">
          <SmartBetBadge
            odds={match.odds}
            homeTeam={match.homeTeam.name}
            awayTeam={match.awayTeam.name}
            matchSlug={slug}
            markets={match.markets}
            homeForm={match.homeTeam.form}
            awayForm={match.awayTeam.form}
            sport={match.sport.slug}
          />
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{match.tipsCount} tips</span>
        <Link href={`/matches/${slug}`} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary">
          View details
        </Link>
      </div>
    </div>
  );
}

interface SmartPick {
  pick: string;
  label: string;
  market: string;
  confidence: number;
  rationale: string;
}


/**
 * Parse a form string like "WWDLW" into a 0–1 score.
 * Most recent result weighted highest. W=3pts, D=1pt, L=0pts.
 */
function parseFormScore(form: string | undefined): number {
  if (!form) return 0.5;
  const chars = form.replace(/[^WwDdLl]/g, '').slice(-5).toUpperCase().split('');
  if (chars.length === 0) return 0.5;
  let pts = 0;
  let maxPts = 0;
  chars.forEach((c, i) => {
    const w = 1 + i * 0.3;
    maxPts += 3 * w;
    if (c === 'W') pts += 3 * w;
    else if (c === 'D') pts += 1 * w;
  });
  return maxPts > 0 ? Math.min(pts / maxPts, 1) : 0.5;
}

/**
 * Evaluate ALL available API markets and return up to 4 ranked picks for THIS
 * specific match profile, best pick first. The algorithm:
 *  1. Scans every market the API provides
 *  2. Computes margin-free implied probabilities for each outcome
 *  3. Applies a match-profile bonus/penalty so the market shown is actually
 *     interesting for the match type (strong fav → Match Winner / Handicap;
 *     low-scoring expectation → Under; high-scoring → BTTS / Over 2.5;
 *     tight match → Corners / HT Result). Over 1.5, DC and generic markets
 *     are demoted so they only appear when genuinely the best choice.
 *  4. Falls back to a form-adjusted 1X2 when no API markets are present.
 */
function computeSmartPick(
  odds: { home: number; draw?: number; away: number },
  homeTeam: string,
  awayTeam: string,
  markets?: MatchMarket[],
  homeForm?: string,
  awayForm?: string,
  sport?: string,
): SmartPick[] {
  // ── Shared probability decomposition ─────────────────────────────────────
  const rawH = 1 / Math.max(odds.home, 1.01);
  const rawD = odds.draw ? 1 / Math.max(odds.draw, 1.01) : 0;
  const rawA = 1 / Math.max(odds.away, 1.01);
  const rawTotal = rawH + rawD + rawA || 1;
  const nH = rawH / rawTotal;
  const nA = rawA / rawTotal;

  // Form-adjusted expected goals — drives the "low/high scoring" profile flag
  const hFS = parseFormScore(homeForm);
  const aFS = parseFormScore(awayForm);
  const homeGoalShare = Math.min(0.80, Math.max(0.35, 0.50 + (nH - 0.33) * 0.65));
  const λH = 2.65 * homeGoalShare * (0.82 + 0.36 * hFS);
  const λA = 2.65 * (1 - homeGoalShare) * (0.82 + 0.36 * aFS);
  const expectedGoals = λH + λA;

  // Match profile flags
  const strongFav    = Math.max(nH, nA) > 0.57;
  const veryStrongFav = Math.max(nH, nA) > 0.66;
  const tightMatch   = Math.abs(nH - nA) < 0.13;
  const lowGoals     = expectedGoals < 2.05;
  const highGoals    = expectedGoals > 3.05;

  const _sportNorm = (sport || '').toLowerCase().replace(/[\s_-]/g, '');
  const noDrawSport = new Set([
    'basketball', 'tennis', 'baseball', 'hockey', 'icehockey', 'mma', 'boxing',
    'americanfootball', 'nfl', 'nba', 'mlb', 'nhl', 'volleyball', 'darts', 'snooker', 'esports',
  ]).has(_sportNorm);
  const isHockey = _sportNorm === 'icehockey' || _sportNorm === 'hockey' || _sportNorm === 'nhl';

  function totalsUnit(): string {
    if (_sportNorm === 'basketball' || _sportNorm === 'nba') return 'Points';
    if (_sportNorm === 'baseball' || _sportNorm === 'mlb') return 'Runs';
    if (_sportNorm === 'americanfootball' || _sportNorm === 'nfl') return 'Points';
    if (_sportNorm === 'tennis') return 'Games';
    if (_sportNorm === 'volleyball') return 'Points';
    return 'Goals';
  }

  // Remove bookmaker margin and return normalised per-outcome probabilities
  function marginFreeProbs(outcomes: MarketOutcome[]): Array<MarketOutcome & { prob: number }> {
    const valid = outcomes.filter(o => o.price > 1.01);
    if (valid.length < 2) return [];
    const vig = valid.reduce((s, o) => s + 1 / o.price, 0);
    return valid.map(o => ({ ...o, prob: (1 / o.price) / vig }));
  }

  // Map API market key → human-readable category label (sport-aware)
  function mktCategory(key: string, name: string): string {
    const k = key.toLowerCase();
    const u = totalsUnit();
    if (k === 'h2h') return 'Match Winner';
    if (k === 'spreads') return noDrawSport && !isHockey ? 'Point Spread' : 'Asian Handicap';
    if (k === 'asian_handicap') return 'Asian Handicap';
    if (k === 'double_chance') return 'Double Chance';
    if (k === 'dnb' || k === 'draw_no_bet') return 'Draw No Bet';
    if (k === 'btts') return 'BTTS';
    if (k === 'btts_and_result') return 'BTTS & Result';
    if (k === 'ht_ft') return 'HT/FT';
    if (k === 'h2h_1h' || k === 'h2h_ht' || k === 'ht_result') return 'HT Result';
    if (k === 'h2h_regulation') return 'Regulation Result';
    if (k === 'odd_even_goals') return 'Odd/Even Goals';
    if (k === 'exact_goals') return 'Exact Goals';
    if (k === 'correct_score') return 'Correct Score';
    if (k === 'win_to_nil') return 'Win to Nil';
    if (k === 'first_team_to_score') return 'First to Score';
    if (k === 'goal_first_half') return '1st Half Goal';
    if (k.startsWith('clean_sheet')) return 'Clean Sheet';
    if (/totals_0[_-]5/.test(k) || (k === 'totals' && name.includes('0.5'))) return `O/U 0.5 ${u}`;
    if (/totals_1[_-]5/.test(k) || (k === 'totals' && name.includes('1.5'))) return `O/U 1.5 ${u}`;
    if (/totals_2[_-]5/.test(k) || (k === 'totals' && name.includes('2.5'))) return `O/U 2.5 ${u}`;
    if (/totals_3[_-]5/.test(k) || (k === 'totals' && name.includes('3.5'))) return `O/U 3.5 ${u}`;
    if (/totals_4[_-]5/.test(k) || (k === 'totals' && name.includes('4.5'))) return `O/U 4.5 ${u}`;
    if (k === 'totals_1h' || k === 'totals_h1') return `1st Half ${u}`;
    if (k === 'totals_2h' || k === 'totals_h2') return `2nd Half ${u}`;
    if (k.startsWith('corners_')) return 'Corners';
    if (k.startsWith('corners_total') || k === 'corners') return 'Corners';
    if (k.startsWith('race_corners')) return 'Corners Race';
    if (k.startsWith('totals_1q')) return `1st Qtr ${u}`;
    if (k.startsWith('totals_')) return `Total ${u}`;
    if (k === 'totals') return `Total ${u}`;
    return name || key;
  }

  // Soccer-only market categories — not valid for no-draw sports (basketball, baseball, tennis…)
  // Ice hockey keeps Goals markets but drops draw-specific ones
  const SOCCER_ONLY_CATS = new Set([
    'Double Chance', 'Draw No Bet', 'BTTS', 'BTTS & Result', 'HT/FT', 'Correct Score',
    'Win to Nil', 'Clean Sheet', 'Odd/Even Goals', '1st Half Goal', 'HT Result',
    'O/U 0.5 Goals', 'O/U 1.5 Goals', 'O/U 2.5 Goals', 'O/U 3.5 Goals', 'O/U 4.5 Goals',
    '1st Half Goals', '2nd Half Goals', 'Total Goals',
  ]);
  const HOCKEY_INVALID_CATS = new Set([
    'Double Chance', 'BTTS & Result', 'HT/FT', 'Correct Score', 'Win to Nil', 'Odd/Even Goals',
  ]);

  // Normalise generic "Home"/"Away" outcome names to team names
  function outcomeLabel(name: string): string {
    const n = name.toLowerCase().trim();
    if (n === 'home') return homeTeam.split(' ')[0];
    if (n === 'away') return awayTeam.split(' ')[0];
    return name;
  }

  interface Candidate extends SmartPick { price: number }
  const candidates: Candidate[] = [];

  // ── 1. Scan EVERY market the API provided ───────────────────────────────
  if (markets && markets.length > 0) {
    for (const mkt of markets) {
      const key = (mkt.key || '').toLowerCase();
      const outcomes = mkt.outcomes || [];
      if (outcomes.length < 2) continue;

      // Skip near-certainty markets (any outcome priced below 1.10 is trivial)
      if (outcomes.some(o => o.price < 1.10)) continue;

      const probs = marginFreeProbs(outcomes);
      if (probs.length < 2) continue;

      // Best outcome = highest margin-free implied probability
      const best = probs.reduce((a, b) => b.prob > a.prob ? b : a);
      const conf = Math.round(best.prob * 100);
      if (conf < 50) continue; // below coin-flip — not a pick

      const category = mktCategory(key, mkt.name);

      // Skip markets that are inappropriate for this sport
      if (noDrawSport) {
        if (!isHockey && SOCCER_ONLY_CATS.has(category)) continue;
        if (isHockey && HOCKEY_INVALID_CATS.has(category)) continue;
      }

      const label = outcomeLabel(best.name);

      // De-duplicate: keep only the highest-confidence candidate per category
      const idx = candidates.findIndex(c => c.market === category);
      const entry: Candidate = { pick: best.name, label, market: category, confidence: conf, price: best.price };
      if (idx >= 0) {
        if (conf > candidates[idx].confidence) candidates[idx] = entry;
      } else {
        candidates.push(entry);
      }
    }
  }

  // ── 2. Form-adjusted 1X2 fallback — always computed from main odds ───────
  {
    const adj = (base: number, fs: number, adv = 0) => (base / rawTotal) * (0.80 + 0.4 * fs) + adv;
    const adjH = adj(rawH, hFS, 0.05);
    const adjA = adj(rawA, aFS);
    const adjD = rawD > 0 ? (rawD / rawTotal) * 0.90 : 0;
    const adjT = adjH + adjA + adjD;
    const h = adjH / adjT, a = adjA / adjT, d = adjD / adjT;
    const max = Math.max(h, d, a);
    const conf = Math.round(max * 100);

    const existing = candidates.findIndex(c => c.market === 'Match Winner');
    if (existing < 0 || candidates[existing].confidence < conf) {
      const entry: Candidate =
        h === max ? { pick: '1', label: `${homeTeam.split(' ')[0]} to Win`, market: 'Match Winner', confidence: conf, price: odds.home }
        : d === max && odds.draw && !noDrawSport ? { pick: 'X', label: 'Draw', market: 'Match Winner', confidence: conf, price: odds.draw ?? 3 }
        : { pick: '2', label: `${awayTeam.split(' ')[0]} to Win`, market: 'Match Winner', confidence: conf, price: odds.away };
      if (existing >= 0) candidates[existing] = entry;
      else candidates.push(entry);
    }
  }

  if (candidates.length === 0) return [];

  // ── 3. Multiplier-based scoring — surfaces the genuinely best market ──────
  //
  // Problem with additive bonuses: OV 1.5 at 80% conf + (-14) = 66, which still
  // beats most interesting markets. A multiplier fixes this: OV 1.5 at 80% × 0.52
  // = 41.6 and can NEVER win. Win to Nil at 55% × 1.25 + 18 (strong fav) + 5
  // (odds) = 91.75, correctly surfacing a match-specific, engaging market.
  //
  // INTEREST multipliers encode "how engaging/specific is this market type?"
  const INTEREST: Record<string, number> = {
    'Win to Nil':     1.28,  // match-specific, compelling
    'Asian Handicap': 1.22,  // shows the handicap line the model chose
    'Clean Sheet':    1.20,  // team-specific proposition
    'Draw No Bet':    1.06,  // useful for moderate favourites only
    'First to Score': 1.12,  // engaging in-game narrative
    'O/U 3.5 Goals':  1.10,  // rarer line — more signal when it fires
    'O/U 2.5 Goals':  1.06,  // standard but match-specific
    'BTTS':           1.04,  // depends on expected goals model
    'Match Winner':   1.00,  // baseline
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
    'Correct Score':  0.74,  // usually low-confidence, but interesting when it isn't
    'Double Chance':  0.70,  // boring — offers no real value over DNB
    'Exact Goals':    0.68,
    '1st Half Goal':  0.65,
    'O/U 1.5 Goals':  0.50,  // true for ~80% of soccer — almost no signal
    'O/U 0.5 Goals':  0.28,  // near-certainty — meaningless as a tip
    'Odd/Even Goals': 0.32,  // permanently ~50/50 — no edge ever
  };

  function pickScore(c: Candidate): number {
    const m = c.market;
    const p = c.pick.toLowerCase();
    const multiplier = INTEREST[m] ?? 1.00;

    // Match-fit bonus: extra points when this market is particularly relevant
    // to what makes this specific game interesting.
    let fit = 0;

    if (m === 'Win to Nil') {
      // Compelling only when a real team wins to nil — not when "Neither" wins
      const isCleanSweep = p !== 'neither' && p !== 'no' && p !== 'neither team';
      if (isCleanSweep && veryStrongFav) fit = 20;
      else if (isCleanSweep && strongFav)  fit = 9;
      else if (!isCleanSweep)              fit = -18; // "Neither" fires in most matches — suppress
      else                                 fit = -18;
    } else if (m === 'Clean Sheet') {
      // "Yes" = specific team keeps a clean sheet — match-specific story
      // "No"  = at least one team concedes — true in ~75% of matches, near useless
      const isYes = p === 'yes';
      if (isYes && veryStrongFav) fit = 20;
      else if (isYes && strongFav)  fit = 9;
      else if (isYes)               fit = 0;
      else                          fit = -20; // "No clean sheet" is as common as Under 3.5
    } else if (m === 'Asian Handicap') {
      // Best when there is a clear favourite; handicap line is already match-specific
      if (veryStrongFav) fit = 16;
      else if (strongFav)  fit = 9;
      else if (tightMatch) fit = -4;
      else                 fit = 4;
    } else if (m === 'Draw No Bet') {
      // Sweet-spot: moderate favourite where draw risk is real (55–65% win prob)
      // For very strong favs, Match Winner / Asian Handicap is the better story
      if (veryStrongFav)   fit = -8; // dominant team — draw risk is small, just back them to win
      else if (strongFav)  fit = 16; // moderate fav (57–66%) — ideal DNB territory
      else if (tightMatch) fit = -4; // too close to call — Corners/BTTS beat DNB here
      else                 fit = 4;
    } else if (m === 'First to Score') {
      // Better signal in high-scoring, open games
      if (highGoals) fit = 10;
      else            fit = 5;
    } else if (m === 'Match Winner') {
      // Stronger for clear results; for tight matches other markets are better
      if (veryStrongFav) fit = 12;
      else if (strongFav)  fit = 7;
    } else if (m === 'BTTS') {
      if (p === 'yes' && highGoals)                 fit = 12;
      else if (p === 'yes')                          fit = 4;
      else if (p === 'no' && (lowGoals || veryStrongFav)) fit = 10;
    } else if (p.startsWith('under')) {
      // Under lines: penalise by how commonly they occur.
      // Under 4.5 fires ~85% of games, Under 3.5 ~70% — near meaningless.
      // Only Under 2.5 (fires ~52%) carries real predictive value.
      if (m === 'O/U 4.5 Goals' || m === 'Total Goals') {
        fit = lowGoals ? 2 : -18; // almost always true — suppress heavily
      } else if (m === 'O/U 3.5 Goals') {
        fit = lowGoals ? 6 : -16; // fires 70% of games — suppress unless genuinely low-scoring
      } else {
        // Under 2.5, Under 1.5, etc. — meaningful lines
        if (lowGoals)        fit = 16;
        else if (!highGoals) fit = 4;
        else                 fit = -4;
      }
    } else if (p.startsWith('over') && (m === 'O/U 2.5 Goals' || m === 'O/U 3.5 Goals')) {
      if (highGoals) fit = 14;
      else            fit = 3;
    } else if (m === 'Corners' || m === 'HT Result') {
      if (tightMatch) fit = 8;
    }

    // Odds bonus: reward picks in the 1.25–2.80 "value" window
    // (not too short to be boring, not so long it's a lottery)
    const oddsBonus = c.price >= 1.25 && c.price <= 2.80 ? 6
                    : c.price > 2.80 && c.price <= 4.00 ? 2
                    : 0;

    return c.confidence * multiplier + fit + oddsBonus;
  }

  candidates.sort((a, b) => {
    const sa = pickScore(a);
    const sb = pickScore(b);
    return sb !== sa ? sb - sa : b.price - a.price;
  });

  // Prefer picks with real betting value (odds ≥ 1.22); return top 4
  const interesting = candidates.filter(c => c.price >= 1.22);
  const ranked = interesting.length > 0 ? interesting : candidates;
  const topCandidates = ranked.slice(0, 4);
  if (topCandidates.length === 0) return [];

  // ── Build "Why this pick?" rationale for each candidate ───────────────────
  const domName  = nH > nA ? homeTeam.split(' ')[0] : awayTeam.split(' ')[0];
  const domProb  = Math.round(Math.max(nH, nA) * 100);
  const eg       = expectedGoals.toFixed(1);

  function buildRationale(picked: Candidate): string {
    const mk = picked.market;
    const pl = picked.pick.toLowerCase();
    if (mk === 'Asian Handicap') {
      return veryStrongFav
        ? `${domName} are heavy favourites (${domProb}%) — the handicap line levels the field while keeping them likely to cover at ${picked.confidence}%.`
        : `The handicap balances the field — ${domName} should cover at ${picked.confidence}% probability.`;
    }
    if (mk === 'Draw No Bet') return `${domName} are the more likely winner but the draw is a real risk. Draw No Bet removes it while keeping solid value.`;
    if (mk === 'BTTS') return highGoals
      ? `Both sides scoring freely — ${eg} goals projected. Both to Score is the smart play.`
      : `Both teams carry a goal threat. Both to Score offers good value here.`;
    if (mk.includes('O/U') && pl.startsWith('under')) return `Defensively disciplined match — only ${eg} goals projected, making the Under the value pick.`;
    if (mk.includes('O/U') && pl.startsWith('over')) return highGoals
      ? `Both attacks in form — ${eg} goals expected, favouring the Over.`
      : `Both teams need a result — expect an open game with ${eg} goals projected.`;
    if (mk === 'Match Winner') {
      if (veryStrongFav) return `${domName} are a heavy favourite at ${domProb}% win probability — clear market edge.`;
      if (strongFav) return `${domName} hold a clear advantage at ${domProb}% — Match Winner is the most efficient pick.`;
      if (tightMatch) return `Closely matched sides — the draw is the most likely single outcome at ${picked.confidence}%.`;
      return `${domName} have a ${domProb}% edge — Match Winner is the best available pick.`;
    }
    if (mk === 'Double Chance') return `Tight contest — Double Chance covers two of three outcomes, protecting against the draw.`;
    if (mk === 'Win to Nil') return `${domName} are dominant with a solid defence — a clean-sheet victory is the pick.`;
    if (mk === 'Clean Sheet') return `${domName} have been keeping clean sheets and face a low-threat attack.`;
    if (mk === 'HT Result') return `Teams are most decisive early — first-half result carries good value for this fixture.`;
    if (mk === 'First to Score') return `${domName} have been opening the scoring consistently — First to Score offers good value.`;
    if (mk === 'Corners') return tightMatch
      ? `Tight match with both sides pressing forward — corners market is live.`
      : `${domName} likely to dominate possession and win the set-piece battle.`;
    return veryStrongFav
      ? `${domName} are heavily favoured (${domProb}%) — this market reflects their clear edge.`
      : `This market offers the best risk-adjusted value at ${picked.confidence}% probability.`;
  }

  return topCandidates.map(picked => ({
    pick: picked.pick,
    label: picked.label,
    market: picked.market,
    confidence: Math.min(picked.confidence, 95),
    rationale: buildRationale(picked),
  }));
}

function SmartBetBadge({
  odds,
  homeTeam,
  awayTeam,
  matchSlug,
  markets,
  homeForm,
  awayForm,
  sport,
}: {
  odds: { home: number; draw?: number; away: number };
  homeTeam: string;
  awayTeam: string;
  matchSlug: string;
  markets?: MatchMarket[];
  homeForm?: string;
  awayForm?: string;
  sport?: string;
}) {
  const [idx, setIdx] = useState(0);
  const picks = computeSmartPick(odds, homeTeam, awayTeam, markets, homeForm, awayForm, sport);
  if (!picks.length) return null;
  const count = picks.length;
  const sp = picks[Math.min(idx, count - 1)];

  function prev(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setIdx(i => (i - 1 + count) % count);
  }
  function next(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setIdx(i => (i + 1) % count);
  }

  return (
    <div className="group/aibadge relative flex items-center gap-0.5">
      {/* Previous market button */}
      {count > 1 && (
        <button
          onClick={prev}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Previous market"
        >‹</button>
      )}

      {/* Main badge — links to match prediction section */}
      <Link
        href={`/matches/${matchSlug}#prediction`}
        onClick={(e) => e.stopPropagation()}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-primary/8 px-2 py-1 text-[10px] hover:bg-primary/15 transition-colors"
      >
        <Sparkles className="h-3 w-3 shrink-0 text-primary" />
        <span className="font-semibold text-primary shrink-0">AI</span>
        <span className="rounded bg-primary/15 px-1 py-px font-bold text-primary shrink-0">{sp.market}</span>
        <span className="text-muted-foreground shrink-0">·</span>
        <span className="truncate font-bold text-foreground">{sp.label}</span>
        <span className="ml-auto shrink-0 font-semibold text-primary">{sp.confidence}%</span>
        {count > 1 && (
          <span className="shrink-0 text-[9px] text-muted-foreground tabular-nums">{idx + 1}/{count}</span>
        )}
      </Link>

      {/* Next market button */}
      {count > 1 && (
        <button
          onClick={next}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Next market"
        >›</button>
      )}

      {/* "Why this pick?" tooltip — appears on hover */}
      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 w-72 opacity-0 scale-95 transition-all duration-150 group-hover/aibadge:opacity-100 group-hover/aibadge:scale-100">
        <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> Why this pick?
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{sp.rationale}</p>
          {count > 1 && (
            <p className="mt-2 text-[10px] text-muted-foreground/60">Use ‹ › to browse {count} ranked markets</p>
          )}
        </div>
      </div>
    </div>
  );
}

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

interface OddsButtonProps {
  value: number;
  label: string;
  format: 'decimal' | 'fractional' | 'american';
  size?: 'sm' | 'lg';
  matchId?: string;
  matchSlug?: string;
  matchName?: string;
  outcomeName?: string;
  marketKey?: string;
  marketName?: string;
}

function OddsButton({
  value,
  label,
  format,
  size = 'sm',
  matchId,
  matchSlug,
  matchName,
  outcomeName,
  marketKey = 'h2h',
  marketName = '1X2',
}: OddsButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { addSelection, isSelected } = useBetSlip();

  const selected = matchId && marketKey && outcomeName
    ? isSelected(matchId, marketKey, outcomeName)
    : false;

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleAddToBetslip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!matchId || !matchName || !outcomeName) return;
    addSelection({
      matchId,
      matchName,
      matchSlug: matchSlug || '',
      marketKey,
      marketName,
      outcomeName,
      price: value,
    });
    setOpen(false);
  };

  const handleGoToBookmaker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (matchSlug) router.push(`/matches/${matchSlug}#bookmakers`);
    setOpen(false);
  };

  const handleCreateTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (matchSlug) router.push(`/matches/${matchSlug}?action=tip&outcome=${encodeURIComponent(outcomeName || '')}&odds=${value}`);
    setOpen(false);
  };

  const buttonClass = cn(
    'flex flex-col items-center rounded-md transition-colors w-full',
    size === 'sm' ? 'px-2 py-1' : 'px-3 py-2',
    selected
      ? 'bg-primary text-primary-foreground'
      : 'bg-secondary hover:bg-primary/10 hover:border-primary border border-transparent',
  );

  if (!matchId) {
    return (
      <button className={buttonClass}>
        <span className={cn('text-muted-foreground', size === 'sm' ? 'text-[10px]' : 'text-xs')}>{label}</span>
        <span className={cn('font-mono font-semibold', size === 'sm' ? 'text-xs' : 'text-sm')}>{formatOdds(value, format)}</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={buttonClass}
      >
        <span className={cn(
          size === 'sm' ? 'text-[10px]' : 'text-xs',
          selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}>{label}</span>
        <span className={cn(
          'font-mono font-semibold',
          size === 'sm' ? 'text-xs' : 'text-sm',
          selected && 'text-primary-foreground'
        )}>{formatOdds(value, format)}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] w-48 rounded-lg border border-border bg-popover shadow-xl">
          {/* Caret */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border" />
          <div className="p-1">
            <div className="px-2 py-1 mb-1 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground truncate">{outcomeName}</p>
              <p className="text-[10px] text-muted-foreground">{formatOdds(value, format)} · {marketName}</p>
            </div>
            <button
              onClick={handleAddToBetslip}
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium hover:bg-accent transition-colors text-left"
            >
              <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
              {selected ? 'Remove from Betslip' : 'Add to Betslip'}
            </button>
            <button
              onClick={handleGoToBookmaker}
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium hover:bg-accent transition-colors text-left"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              Compare Bookmakers
            </button>
            <button
              onClick={handleCreateTip}
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium hover:bg-accent transition-colors text-left"
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              Create New Tip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
