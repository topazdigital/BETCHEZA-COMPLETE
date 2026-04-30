'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  ChevronRight, 
  Trophy, 
  Calendar, 
  Star, 
  BookOpen, 
  Users, 
  BarChart3, 
  Flame,
  TrendingUp,
  Zap,
  LayoutDashboard,
  Bell,
  MessageCircle,
  Brain,
  Wallet,
  UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_SPORTS, ALL_LEAGUES, BOOKMAKERS, getSportIcon } from '@/lib/sports-data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMatchStats, useUserCountry, useMatches } from '@/lib/hooks/use-matches';
import { FlagIcon } from '@/components/ui/flag-icon';

// Europe's "Top 5" — these are always shown in the sidebar regardless of
// whether they have matches today, because they're the most-followed.
const EUROPE_TOP5_IDS = new Set<number>([1, 2, 3, 4, 5]);

// Continental / international competitions to surface ONLY when they have
// matches today. IDs match ESPN_LEAGUES (see lib/sports-data.ts header note).
const INTERNATIONAL_IDS = new Set<number>([
  9,   // UEFA Champions League
  10,  // UEFA Europa League
  26,  // UEFA Conference League
  24,  // AFCON
  102, // CAF Champions League
  103, // CAF Confederation Cup
  25,  // Copa Libertadores
  104, // AFC Champions League
  111, // UEFA Nations League
  109, // FIFA Club World Cup
  80,  // CONCACAF Champions Cup
]);

interface SidebarNewProps {
  selectedSportId?: number | null;
  onSelectSport?: (sportId: number | null) => void;
}

export function SidebarNew({ selectedSportId, onSelectSport }: SidebarNewProps) {
  const pathname = usePathname();
  const stats = useMatchStats();
  const userCountry = useUserCountry();
  const { matches: allMatches } = useMatches();

  // The country/international groups depend on browser-only signals
  // (timezone-detected country + SWR-loaded matches). We gate them behind
  // a `mounted` flag so the SSR HTML and the first client render match —
  // otherwise React throws a hydration mismatch when those groups appear.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Group sports by category
  const popularSports = ALL_SPORTS.filter(s => s.category === 'popular');
  const teamSports = ALL_SPORTS.filter(s => s.category === 'team');
  const individualSports = ALL_SPORTS.filter(s => s.category === 'individual');
  const combatSports = ALL_SPORTS.filter(s => s.category === 'combat');
  const racingSports = ALL_SPORTS.filter(s => s.category === 'racing');
  const otherSports = ALL_SPORTS.filter(s => s.category === 'other');

  // Build the set of league IDs that have at least one match in the next ~24h
  // (or are currently live). Used to gate Country + International groups so
  // the sidebar only shows things actually playing today.
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const leaguesPlayingToday = new Set<number>();
  for (const m of allMatches) {
    if (!m?.league?.id) continue;
    if (m.status === 'live' || m.status === 'halftime') {
      leaguesPlayingToday.add(m.league.id);
      continue;
    }
    const t = new Date(m.kickoffTime).getTime();
    if (!Number.isNaN(t) && t >= now - 6 * 60 * 60 * 1000 && t <= now + dayMs) {
      leaguesPlayingToday.add(m.league.id);
    }
  }

  // Pool of candidate leagues (respect selected sport when one is chosen).
  const candidatePool = selectedSportId
    ? ALL_LEAGUES.filter(l => l.sportId === selectedSportId)
    : ALL_LEAGUES;

  const dedupe = (arr: typeof ALL_LEAGUES) => {
    const seen = new Set<number>();
    return arr.filter(l => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  };

  // 1. User's home country leagues — only those with matches today.
  const countryLeagues = dedupe(
    candidatePool
      .filter(l => l.countryCode === userCountry && leaguesPlayingToday.has(l.id))
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)),
  );

  // 2. International / continental — only when matches today.
  const internationalLeagues = dedupe(
    candidatePool
      .filter(l => INTERNATIONAL_IDS.has(l.id) && leaguesPlayingToday.has(l.id))
      .sort((a, b) => a.id - b.id),
  );

  // 3. Europe Top 5 — always shown. Sport filter still applies (so basketball
  //    selection won't show football leagues).
  const europeTop5Leagues = dedupe(
    candidatePool
      .filter(l => EUROPE_TOP5_IDS.has(l.id))
      .sort((a, b) => a.id - b.id),
  );

  const renderLeagueLink = (league: (typeof ALL_LEAGUES)[number]) => (
    <Link
      key={league.id}
      href={`/leagues/${league.slug}`}
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
    >
      <div className="flex items-center gap-2 min-w-0">
        <FlagIcon countryCode={league.countryCode} size="xs" />
        <span className="truncate">{league.name}</span>
      </div>
      <ChevronRight className="h-3 w-3 shrink-0 text-sidebar-foreground/40" />
    </Link>
  );

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar lg:block">
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="p-4">
          {/* Quick Stats */}
          <div className="mb-6 grid grid-cols-2 gap-2">
            <Link 
              href="/matches?status=live"
              className="rounded-lg bg-live/10 p-3 text-center transition-colors hover:bg-live/20"
            >
              <Flame className="mx-auto h-5 w-5 text-live" />
              <div className="mt-1 text-sm font-semibold text-live">Live</div>
              <div className="text-xs text-muted-foreground">
                {stats.live > 0 ? `${stats.live} matches` : 'No live'}
              </div>
            </Link>
            <Link 
              href="/leaderboard"
              className="rounded-lg bg-primary/10 p-3 text-center transition-colors hover:bg-primary/20"
            >
              <TrendingUp className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-1 text-sm font-semibold text-primary">Today</div>
              <div className="text-xs text-muted-foreground">
                {stats.today > 0 ? `${stats.today} matches` : 'No matches'}
              </div>
            </Link>
          </div>

          {/* Popular Sports */}
          <div className="mb-6">
            <h3 className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              <Zap className="h-3 w-3" />
              Popular Sports
            </h3>
            <nav className="space-y-0.5">
              {popularSports.map((sport) => (
                <Link
                  key={sport.id}
                  href={`/matches?sport=${sport.slug}`}
                  onClick={() => onSelectSport?.(sport.id)}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors',
                    selectedSportId === sport.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getSportIcon(sport.slug)}</span>
                    <span>{sport.name}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-sidebar-foreground/40" />
                </Link>
              ))}
            </nav>
          </div>

          {/* All Sports Expandable */}
          <div className="mb-6">
            <details className="group">
              <summary className="mb-2 flex cursor-pointer items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                <span>All Sports ({ALL_SPORTS.length})</span>
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              </summary>
              <nav className="space-y-0.5">
                {/* Team Sports */}
                <div className="mb-3">
                  <div className="mb-1 px-2 text-[10px] font-medium uppercase text-sidebar-foreground/40">Team Sports</div>
                  {teamSports.map((sport) => (
                    <Link
                      key={sport.id}
                      href={`/matches?sport=${sport.slug}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
                    >
                      <span>{getSportIcon(sport.slug)}</span>
                      <span>{sport.name}</span>
                    </Link>
                  ))}
                </div>
                {/* Individual Sports */}
                <div className="mb-3">
                  <div className="mb-1 px-2 text-[10px] font-medium uppercase text-sidebar-foreground/40">Individual</div>
                  {individualSports.map((sport) => (
                    <Link
                      key={sport.id}
                      href={`/matches?sport=${sport.slug}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
                    >
                      <span>{getSportIcon(sport.slug)}</span>
                      <span>{sport.name}</span>
                    </Link>
                  ))}
                </div>
                {/* Combat Sports */}
                <div className="mb-3">
                  <div className="mb-1 px-2 text-[10px] font-medium uppercase text-sidebar-foreground/40">Combat</div>
                  {combatSports.map((sport) => (
                    <Link
                      key={sport.id}
                      href={`/matches?sport=${sport.slug}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
                    >
                      <span>{getSportIcon(sport.slug)}</span>
                      <span>{sport.name}</span>
                    </Link>
                  ))}
                </div>
                {/* Racing */}
                <div className="mb-3">
                  <div className="mb-1 px-2 text-[10px] font-medium uppercase text-sidebar-foreground/40">Racing</div>
                  {racingSports.map((sport) => (
                    <Link
                      key={sport.id}
                      href={`/matches?sport=${sport.slug}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
                    >
                      <span>{getSportIcon(sport.slug)}</span>
                      <span>{sport.name}</span>
                    </Link>
                  ))}
                </div>
                {/* Other */}
                <div>
                  <div className="mb-1 px-2 text-[10px] font-medium uppercase text-sidebar-foreground/40">Other</div>
                  {otherSports.map((sport) => (
                    <Link
                      key={sport.id}
                      href={`/matches?sport=${sport.slug}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
                    >
                      <span>{getSportIcon(sport.slug)}</span>
                      <span>{sport.name}</span>
                    </Link>
                  ))}
                </div>
              </nav>
            </details>
          </div>

          {/* Country leagues — only when matches today */}
          {mounted && countryLeagues.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                <FlagIcon countryCode={userCountry} size="xs" />
                <span>Your Country • Today</span>
              </h3>
              <nav className="space-y-0.5">{countryLeagues.map(renderLeagueLink)}</nav>
            </div>
          )}

          {/* International / continental — only when matches today */}
          {mounted && internationalLeagues.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                International • Today
              </h3>
              <nav className="space-y-0.5">{internationalLeagues.map(renderLeagueLink)}</nav>
            </div>
          )}

          {/* Europe Top 5 — always visible */}
          {europeTop5Leagues.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                Popular Leagues
              </h3>
              <nav className="space-y-0.5">{europeTop5Leagues.map(renderLeagueLink)}</nav>
            </div>
          )}

          {/* Quick Links */}
          <div className="mb-6">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              Quick Links
            </h3>
            <nav className="space-y-0.5">
              <Link
                href="/results"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/results'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Calendar className="h-4 w-4" />
                <span>Results</span>
              </Link>
              <Link
                href="/tipsters"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/tipsters'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Users className="h-4 w-4" />
                <span>Tipsters</span>
              </Link>
              <Link
                href="/become-tipster"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/become-tipster'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <UserPlus className="h-4 w-4 text-primary" />
                <span>Become a Tipster</span>
              </Link>
              <Link
                href="/predictor"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/predictor'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Brain className="h-4 w-4 text-primary" />
                <span>Betcheza AI</span>
                <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">AI</span>
              </Link>
              <Link
                href="/dashboard"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/dashboard'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>My Dashboard</span>
              </Link>
              <Link
                href="/dashboard/wallet"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/dashboard/wallet'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Wallet className="h-4 w-4" />
                <span>Wallet</span>
              </Link>
              <Link
                href="/feed"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/feed'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <MessageCircle className="h-4 w-4" />
                <span>Community Feed</span>
                <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">NEW</span>
              </Link>
              <Link
                href="/notifications"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/notifications'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </Link>
              <Link
                href="/leaderboard"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/leaderboard'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Trophy className="h-4 w-4" />
                <span>Leaderboard</span>
              </Link>
              <Link
                href="/competitions"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/competitions'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Star className="h-4 w-4" />
                <span>Competitions</span>
              </Link>
              <Link
                href="/bookmakers"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/bookmakers'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <BookOpen className="h-4 w-4" />
                <span>Bookmakers</span>
              </Link>
              <Link
                href="/stats"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                  pathname === '/stats'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Statistics</span>
              </Link>
            </nav>
          </div>

          {/* Featured Bookmakers */}
          <div>
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              Top Bookmakers
            </h3>
            <div className="space-y-2">
              {BOOKMAKERS.filter(b => b.featured).slice(0, 4).map((bookmaker) => (
                <a
                  key={bookmaker.id}
                  href={`/api/r/bookmaker/${encodeURIComponent(bookmaker.slug)}?placement=sidebar`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-background text-xs font-bold">
                    {bookmaker.name.charAt(0)}
                  </div>
                  <span className="font-medium text-sidebar-foreground">{bookmaker.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

