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
    const id = setInterval(tick, 1_000);
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
  const isFinished = match.status === 'finished';
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
      ? computeSmartPick(match.odds, match.homeTeam.name, match.awayTeam.name, match.markets)
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

      {/* SmartBet AI pick — default/featured variant, only for scheduled matches with odds */}
      {match.odds && !isFinished && !isLive && (
        <div className="mt-2">
          <SmartBetBadge
            odds={match.odds}
            homeTeam={match.homeTeam.name}
            awayTeam={match.awayTeam.name}
            matchSlug={slug}
            markets={match.markets}
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
}

/**
 * Evaluate ALL available markets and return the single highest-confidence pick.
 * Considers: 1X2, BTTS, Over/Under 2.5, Double Chance.
 * Confidence = margin-removed implied probability × 100.
 */
function computeSmartPick(
  odds: { home: number; draw?: number; away: number },
  homeTeam: string,
  awayTeam: string,
  markets?: MatchMarket[],
): SmartPick | null {
  const candidates: SmartPick[] = [];

  // ── 1X2 ──────────────────────────────────────────────────────────────────
  {
    const hp = 1 / Math.max(odds.home, 1.01);
    const dp = odds.draw ? 1 / Math.max(odds.draw, 1.01) : 0;
    const ap = 1 / Math.max(odds.away, 1.01);
    const total = hp + dp + ap;
    if (total > 0) {
      const h = hp / total;
      const d = dp / total;
      const a = ap / total;
      const max = Math.max(h, d, a);
      const conf = Math.round(max * 100);
      if (h === max) {
        candidates.push({ pick: '1', label: homeTeam.split(' ')[0], market: '1X2', confidence: conf });
      } else if (d === max && odds.draw) {
        candidates.push({ pick: 'X', label: 'Draw', market: '1X2', confidence: conf });
      } else {
        candidates.push({ pick: '2', label: awayTeam.split(' ')[0], market: '1X2', confidence: conf });
      }
    }
  }

  // ── Additional markets from the API ──────────────────────────────────────
  if (markets && markets.length > 0) {
    for (const mkt of markets) {
      const key = (mkt.key || '').toLowerCase();
      const outcomes = mkt.outcomes || [];
      if (outcomes.length < 2) continue;

      // BTTS
      if (key === 'btts' || key.includes('both_teams') || mkt.name.toLowerCase().includes('both teams')) {
        const yesOut = outcomes.find(o => o.name.toLowerCase().includes('yes'));
        const noOut = outcomes.find(o => o.name.toLowerCase().includes('no'));
        if (yesOut && noOut && yesOut.price > 1 && noOut.price > 1) {
          const yp = 1 / yesOut.price;
          const np = 1 / noOut.price;
          const tot = yp + np;
          const best = yp > np ? { name: 'Yes', prob: yp / tot } : { name: 'No', prob: np / tot };
          const conf = Math.round(best.prob * 100);
          candidates.push({ pick: best.name, label: `BTTS ${best.name}`, market: 'BTTS', confidence: conf });
        }
      }

      // Over/Under 2.5 goals
      if ((key === 'totals' || key.includes('totals_2_5') || key.includes('over_under')) &&
          mkt.name.toLowerCase().includes('2.5')) {
        const overOut = outcomes.find(o => o.name.toLowerCase().includes('over'));
        const underOut = outcomes.find(o => o.name.toLowerCase().includes('under'));
        if (overOut && underOut && overOut.price > 1 && underOut.price > 1) {
          const op = 1 / overOut.price;
          const up = 1 / underOut.price;
          const tot = op + up;
          const best = op > up
            ? { name: 'Over 2.5', prob: op / tot }
            : { name: 'Under 2.5', prob: up / tot };
          const conf = Math.round(best.prob * 100);
          candidates.push({ pick: best.name, label: best.name, market: 'O/U 2.5', confidence: conf });
        }
      }

      // Double Chance
      if (key === 'dc' || key === 'double_chance' || mkt.name.toLowerCase().includes('double chance')) {
        const sorted = [...outcomes].sort((a, b) => (1 / a.price) - (1 / b.price)).reverse();
        if (sorted[0] && sorted[0].price > 1) {
          const probs = outcomes.map(o => 1 / o.price);
          const tot = probs.reduce((s, p) => s + p, 0);
          const best = sorted[0];
          const conf = Math.round((1 / best.price) / tot * 100);
          candidates.push({ pick: best.name, label: best.name, market: 'DC', confidence: conf });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Return the highest-confidence pick; break ties by preferring non-1X2 variety
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.market === '1X2' ? 1 : -1; // prefer alternative markets when tied
  });
  return candidates[0];
}

function SmartBetBadge({
  odds,
  homeTeam,
  awayTeam,
  matchSlug,
  markets,
}: {
  odds: { home: number; draw?: number; away: number };
  homeTeam: string;
  awayTeam: string;
  matchSlug: string;
  markets?: MatchMarket[];
}) {
  const sp = computeSmartPick(odds, homeTeam, awayTeam, markets);
  if (!sp) return null;
  return (
    <Link
      href={`/matches/${matchSlug}#prediction`}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5 rounded-md bg-primary/8 px-2 py-1 text-[10px] hover:bg-primary/15 transition-colors"
    >
      <Sparkles className="h-3 w-3 shrink-0 text-primary" />
      <span className="font-semibold text-primary">AI Pick</span>
      {sp.market !== '1X2' && (
        <span className="rounded bg-primary/15 px-1 py-px font-bold text-primary">{sp.market}</span>
      )}
      <span className="text-muted-foreground">·</span>
      <span className="font-bold text-foreground">{sp.pick}</span>
      <span className="truncate text-muted-foreground">{sp.label}</span>
      <span className="ml-auto font-semibold text-primary">{sp.confidence}%</span>
    </Link>
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
