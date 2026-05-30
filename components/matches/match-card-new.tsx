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
  // Track when we last received a fresh minute from the API
  const baseRef = useRef<{ minute: number; receivedAt: number } | null>(null);

  // When storedMinute changes (fresh API data), record it with the current timestamp
  useEffect(() => {
    const m = storedMinute ?? 0;
    setMinute(m);
    baseRef.current = { minute: m, receivedAt: Date.now() };
  }, [storedMinute]);

  useEffect(() => {
    const isLive = status === 'live' || status === 'extra_time' || status === 'penalties';
    const isHalftime = status === 'halftime';

    if (isHalftime) { setMinute(45); return; }
    if (!isLive || !isMinuteTickingSport(sportSlug)) return;

    // Tick every 10 s: advance display by elapsed real seconds ÷ 60
    const tick = () => {
      if (baseRef.current) {
        const elapsedMs = Date.now() - baseRef.current.receivedAt;
        const advance = Math.floor(elapsedMs / 60000);
        setMinute(Math.min(baseRef.current.minute + advance, 120));
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [status, sportSlug, kickoffTime, period, storedMinute]);

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
    const aiPick = (match.odds && !isFinished && !isLive)
      ? computeSmartPick(match.odds, match.homeTeam.name, match.awayTeam.name, match.markets, match.homeTeam.form, match.awayTeam.form)
      : null;

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
            ) : isFinished ? (
              <div className="leading-tight text-muted-foreground">
                <div className="text-[10px] font-bold uppercase text-foreground/70">FT</div>
                <div className="text-[9px]">{timeStr}</div>
              </div>
            ) : (
              <div className="leading-tight text-muted-foreground">
                <div className="text-[11px] font-semibold tabular-nums text-foreground">{timeStr}</div>
                <div className="text-[9px]">{dateStr === 'Today' ? '' : dateStr}</div>
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

          {/* Odds — fixed-width boxes so they never push team names off-screen */}
          {match.odds && !isFinished && (
            <div className="flex shrink-0 gap-0.5">
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
          )}
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
          ) : isFinished ? (
            <div className="text-right text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">FT</span>
              <div className="mt-0.5">{dateStr} · {timeStr}</div>
            </div>
          ) : (
            <div className="text-right text-xs text-muted-foreground">
              <div className="font-medium">{dateStr}</div>
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
 * Evaluate ALL available API markets and return the best pick for THIS specific
 * match profile. The algorithm:
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
): SmartPick | null {
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

  // Remove bookmaker margin and return normalised per-outcome probabilities
  function marginFreeProbs(outcomes: MarketOutcome[]): Array<MarketOutcome & { prob: number }> {
    const valid = outcomes.filter(o => o.price > 1.01);
    if (valid.length < 2) return [];
    const vig = valid.reduce((s, o) => s + 1 / o.price, 0);
    return valid.map(o => ({ ...o, prob: (1 / o.price) / vig }));
  }

  // Map API market key → human-readable category label
  function mktCategory(key: string, name: string): string {
    const k = key.toLowerCase();
    if (k === 'h2h') return 'Match Winner';
    if (k === 'spreads' || k === 'asian_handicap') return 'Asian Handicap';
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
    if (/totals_0[_-]5/.test(k) || (k === 'totals' && name.includes('0.5'))) return 'O/U 0.5 Goals';
    if (/totals_1[_-]5/.test(k) || (k === 'totals' && name.includes('1.5'))) return 'O/U 1.5 Goals';
    if (/totals_2[_-]5/.test(k) || (k === 'totals' && name.includes('2.5'))) return 'O/U 2.5 Goals';
    if (/totals_3[_-]5/.test(k) || (k === 'totals' && name.includes('3.5'))) return 'O/U 3.5 Goals';
    if (/totals_4[_-]5/.test(k) || (k === 'totals' && name.includes('4.5'))) return 'O/U 4.5 Goals';
    if (k === 'totals_1h' || k === 'totals_h1') return '1st Half Goals';
    if (k === 'totals_2h' || k === 'totals_h2') return '2nd Half Goals';
    if (k.startsWith('corners_')) return 'Corners';
    if (k.startsWith('corners_total') || k === 'corners') return 'Corners';
    if (k.startsWith('race_corners')) return 'Corners Race';
    if (k.startsWith('totals_1q')) return '1st Qtr Goals';
    if (k.startsWith('totals_')) return 'Total Goals';
    if (k === 'totals') return 'Total Goals';
    return name || key;
  }

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
        : d === max && odds.draw ? { pick: 'X', label: 'Draw', market: 'Match Winner', confidence: conf, price: odds.draw ?? 3 }
        : { pick: '2', label: `${awayTeam.split(' ')[0]} to Win`, market: 'Match Winner', confidence: conf, price: odds.away };
      if (existing >= 0) candidates[existing] = entry;
      else candidates.push(entry);
    }
  }

  if (candidates.length === 0) return null;

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
    'Draw No Bet':    1.16,  // protects against draw — better than DC
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
      // Useful in any match with a meaningful favourite
      if (strongFav) fit = 9;
      else           fit = 6;
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

  // Prefer picks with real betting value (odds ≥ 1.22)
  const interesting = candidates.filter(c => c.price >= 1.22);
  const picked = interesting.length > 0 ? interesting[0] : candidates[0];

  // ── Build "Why this pick?" rationale ─────────────────────────────────────
  const domName  = nH > nA ? homeTeam.split(' ')[0] : awayTeam.split(' ')[0];
  const domProb  = Math.round(Math.max(nH, nA) * 100);
  const eg       = expectedGoals.toFixed(1);
  const m        = picked.market;
  let rationale: string;

  if (m === 'Asian Handicap') {
    rationale = veryStrongFav
      ? `${domName} are heavy favourites (${domProb}%) — the handicap line levels the field while keeping them likely to cover at ${picked.confidence}%.`
      : `The handicap balances the field — ${domName} should cover at ${picked.confidence}% probability.`;
  } else if (m === 'Draw No Bet') {
    rationale = `${domName} are the more likely winner but the game is competitive enough to risk a draw. Draw No Bet removes that risk while keeping solid value.`;
  } else if (m === 'BTTS') {
    rationale = highGoals
      ? `Both sides have been scoring freely — ${eg} goals projected in this one. Both to Score is the smart play.`
      : `Both teams carry a goal threat and have been finding the net recently. Both to Score offers good value.`;
  } else if (m.includes('O/U') && picked.pick.toLowerCase().startsWith('under')) {
    rationale = `Defensively disciplined teams on both sides — only ${eg} goals projected, making the Under the value pick here.`;
  } else if (m.includes('O/U') && picked.pick.toLowerCase().startsWith('over')) {
    rationale = highGoals
      ? `Both attacks are in form — ${eg} goals expected, favouring the Over.`
      : `Both teams need a result — expect an open game with ${eg} goals projected.`;
  } else if (m === 'Match Winner') {
    if (veryStrongFav)  rationale = `${domName} are a heavy favourite at ${domProb}% win probability — clear market edge.`;
    else if (strongFav) rationale = `${domName} hold a clear advantage at ${domProb}% — Match Winner is the most efficient market here.`;
    else if (tightMatch) rationale = `Closely matched sides — the draw is the most likely single outcome at ${picked.confidence}%.`;
    else                rationale = `${domName} have a ${domProb}% edge — Match Winner is the best available pick.`;
  } else if (m === 'Double Chance') {
    rationale = `Tight contest — Double Chance covers two of the three outcomes, giving protection on the draw.`;
  } else if (m === 'Win to Nil') {
    rationale = `${domName} are dominant with a solid defence — a clean-sheet victory is the pick.`;
  } else if (m === 'Clean Sheet') {
    rationale = `${domName} have been keeping clean sheets recently and face a low-threat attack.`;
  } else if (m === 'HT Result') {
    rationale = `Teams tend to be most active early — first-half result carries good value for this fixture.`;
  } else if (m === 'Corners') {
    rationale = tightMatch
      ? `Tight match with both sides pressing forward — corners market is live.`
      : `${domName} likely to dominate possession and win the set-piece battle.`;
  } else {
    rationale = veryStrongFav
      ? `${domName} are heavily favoured (${domProb}%) — this market reflects their clear edge.`
      : `This market offers the best risk-adjusted value at ${picked.confidence}% probability.`;
  }

  return { pick: picked.pick, label: picked.label, market: picked.market, confidence: Math.min(picked.confidence, 95), rationale };
}

function SmartBetBadge({
  odds,
  homeTeam,
  awayTeam,
  matchSlug,
  markets,
  homeForm,
  awayForm,
}: {
  odds: { home: number; draw?: number; away: number };
  homeTeam: string;
  awayTeam: string;
  matchSlug: string;
  markets?: MatchMarket[];
  homeForm?: string;
  awayForm?: string;
}) {
  const sp = computeSmartPick(odds, homeTeam, awayTeam, markets, homeForm, awayForm);
  if (!sp) return null;
  return (
    <div className="group/aibadge relative">
      <Link
        href={`/matches/${matchSlug}#prediction`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 rounded-md bg-primary/8 px-2 py-1 text-[10px] hover:bg-primary/15 transition-colors"
      >
        <Sparkles className="h-3 w-3 shrink-0 text-primary" />
        <span className="font-semibold text-primary">AI Pick</span>
        <span className="rounded bg-primary/15 px-1 py-px font-bold text-primary">{sp.market}</span>
        <span className="text-muted-foreground">·</span>
        <span className="truncate font-bold text-foreground">{sp.label}</span>
        <span className="ml-auto font-semibold text-primary">{sp.confidence}%</span>
      </Link>
      {/* "Why this pick?" tooltip — appears on hover */}
      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 w-64 opacity-0 scale-95 transition-all duration-150 group-hover/aibadge:opacity-100 group-hover/aibadge:scale-100">
        <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> Why this pick?
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{sp.rationale}</p>
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
