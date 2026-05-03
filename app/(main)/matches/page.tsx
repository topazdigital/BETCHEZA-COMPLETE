'use client';
export const dynamic = 'force-dynamic';

import { useState, useMemo, Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Calendar, Search, Clock, ChevronDown, ChevronRight, CalendarDays, CalendarClock,
  Flame, TrendingUp, Star, Trophy, Zap, ChevronUp, Globe, BarChart2, ListFilter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SportsFilter } from '@/components/sports/sports-filter';
import { BestBetsPanel } from '@/components/home/best-bets-panel';
import { MatchCardNew } from '@/components/matches/match-card-new';
import { SportIcon, LeagueFlag } from '@/components/ui/team-logo';
import { Spinner } from '@/components/ui/spinner';
import { useMatches, useMatchStats } from '@/lib/hooks/use-matches';
import { ALL_SPORTS, ALL_LEAGUES } from '@/lib/sports-data';
import type { Match } from '@/lib/api/sports-api';
import { cn } from '@/lib/utils';
import { getBrowserTimezone, isToday as isTodayTz } from '@/lib/utils/timezone';
import { isLiveMatchStatus } from '@/lib/utils/live-status';

type DateTab = 'today' | 'upcoming' | 'calendar';

function toLocalISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalISODate(d);
}

const statusOptions = [
  { value: 'all', label: 'All (Live & Upcoming)' },
  { value: 'live', label: 'Live Now' },
  { value: 'scheduled', label: 'Upcoming Only' },
];

const POPULAR_LEAGUES = [
  { slug: 'eng.1', name: 'Premier League', country: 'England', countryCode: 'GB-ENG' },
  { slug: 'esp.1', name: 'La Liga', country: 'Spain', countryCode: 'ES' },
  { slug: 'ger.1', name: 'Bundesliga', country: 'Germany', countryCode: 'DE' },
  { slug: 'ita.1', name: 'Serie A', country: 'Italy', countryCode: 'IT' },
  { slug: 'fra.1', name: 'Ligue 1', country: 'France', countryCode: 'FR' },
  { slug: 'uefa.champions', name: 'Champions League', country: 'UEFA', countryCode: 'EU' },
  { slug: 'nba', name: 'NBA', country: 'USA', countryCode: 'US' },
  { slug: 'nfl', name: 'NFL', country: 'USA', countryCode: 'US' },
  { slug: 'mlb', name: 'MLB', country: 'USA', countryCode: 'US' },
];

/* ─── Left sidebar panel ─── */
function MatchesLeftSidebar({
  selectedSportId,
  onSelectSport,
  matchCounts,
  liveCount,
  todayCount,
  dateTab,
  onDateTab,
  calendarDate,
  onCalendarDate,
  leagueFilter,
  onLeagueFilter,
  allMatchCount,
}: {
  selectedSportId: number | null;
  onSelectSport: (id: number | null) => void;
  matchCounts: Record<number, number>;
  liveCount: number;
  todayCount: number;
  dateTab: DateTab;
  onDateTab: (t: DateTab) => void;
  calendarDate: string;
  onCalendarDate: (d: string) => void;
  leagueFilter: string;
  onLeagueFilter: (l: string) => void;
  allMatchCount: number;
}) {
  const [sportExpanded, setSportExpanded] = useState(true);
  const [leagueExpanded, setLeagueExpanded] = useState(true);
  const tomorrowKey = toLocalISO(1);
  const in7Key = toLocalISO(7);

  const dateShortcuts = [
    { label: 'Today', icon: Clock, action: () => { onDateTab('today'); } },
    {
      label: 'Tomorrow', icon: CalendarClock, action: () => {
        onDateTab('calendar'); onCalendarDate(tomorrowKey);
      }
    },
    {
      label: 'This Week', icon: CalendarDays, action: () => {
        onDateTab('calendar'); onCalendarDate(in7Key);
      }
    },
    { label: 'Upcoming', icon: TrendingUp, action: () => onDateTab('upcoming') },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-52 xl:w-60 shrink-0 border-r border-border bg-card/30">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500">Live</span>
            </div>
            <div className="text-xl font-black text-rose-500">{liveCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-2.5 text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Today</div>
            <div className="text-xl font-black text-foreground">{todayCount}</div>
          </div>
        </div>

        {/* Date shortcuts */}
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-1.5">Browse By Date</p>
          {dateShortcuts.map(({ label, icon: Icon, action }) => {
            const isActive =
              label === 'Today' ? dateTab === 'today' :
              label === 'Upcoming' ? dateTab === 'upcoming' :
              label === 'Tomorrow' ? (dateTab === 'calendar' && calendarDate === tomorrowKey) :
              label === 'This Week' ? (dateTab === 'calendar' && calendarDate === in7Key) : false;
            return (
              <button
                key={label}
                onClick={action}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            );
          })}
          {/* Custom date picker */}
          <div className="pt-1">
            <Input
              type="date"
              value={calendarDate}
              onChange={(e) => { onCalendarDate(e.target.value); onDateTab('calendar'); }}
              className="h-7 w-full text-[11px]"
            />
          </div>
        </div>

        <div className="border-t border-border/40" />

        {/* Sports filter */}
        <div>
          <button
            onClick={() => setSportExpanded(v => !v)}
            className="flex w-full items-center justify-between px-1 mb-2"
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3 w-3" />Sports
            </p>
            {sportExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </button>
          {sportExpanded && (
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectSport(null)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                  !selectedSportId
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5" />All Sports
                </span>
                <span className={cn(
                  'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                  !selectedSportId ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>{allMatchCount}</span>
              </button>
              {ALL_SPORTS.filter(s => (matchCounts[s.id] || 0) > 0).map(sport => (
                <button
                  key={sport.id}
                  onClick={() => onSelectSport(selectedSportId === sport.id ? null : sport.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                    selectedSportId === sport.id
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <SportIcon sportSlug={sport.slug} size="sm" />
                    {sport.name}
                  </span>
                  <span className={cn(
                    'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                    selectedSportId === sport.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  )}>{matchCounts[sport.id] || 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/40" />

        {/* Popular leagues */}
        <div>
          <button
            onClick={() => setLeagueExpanded(v => !v)}
            className="flex w-full items-center justify-between px-1 mb-2"
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Star className="h-3 w-3" />Top Leagues
            </p>
            {leagueExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </button>
          {leagueExpanded && (
            <div className="space-y-0.5">
              <button
                onClick={() => onLeagueFilter('all')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all',
                  leagueFilter === 'all'
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Trophy className="h-3 w-3 shrink-0" />
                All Leagues
              </button>
              {POPULAR_LEAGUES.map(league => (
                <button
                  key={league.slug}
                  onClick={() => onLeagueFilter(leagueFilter === league.slug ? 'all' : league.slug)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all',
                    leagueFilter === league.slug
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <LeagueFlag countryCode={league.countryCode} size="xs" />
                  <span className="truncate">{league.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Decorative hot matches indicator */}
        <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-amber-600">Hot Today</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {liveCount > 0
              ? `${liveCount} match${liveCount !== 1 ? 'es' : ''} live right now. Don't miss the action!`
              : todayCount > 0
              ? `${todayCount} match${todayCount !== 1 ? 'es' : ''} on the slate today.`
              : 'Check back soon for upcoming fixtures.'}
          </p>
          {liveCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-600">Updated live every 10s</span>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}

function MatchesContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedSportId, setSelectedSportId] = useState<number | null>(
    searchParams.get('sport') ? ALL_SPORTS.find(s => s.slug === searchParams.get('sport'))?.id || null : null
  );
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [leagueFilter, setLeagueFilter] = useState(searchParams.get('league') || 'all');
  const [dateTab, setDateTab] = useState<DateTab>('today');
  const [calendarDate, setCalendarDate] = useState<string>(toLocalISODate(new Date()));

  const { matches, isLoading } = useMatches({
    sportId: selectedSportId || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const { matches: allMatches } = useMatches();
  const stats = useMatchStats();

  const matchCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    allMatches.forEach(m => { counts[m.sportId] = (counts[m.sportId] || 0) + 1; });
    return counts;
  }, [allMatches]);

  const relevantLeagues = useMemo(() => {
    if (!selectedSportId) return ALL_LEAGUES.slice(0, 20);
    return ALL_LEAGUES.filter(l => l.sportId === selectedSportId);
  }, [selectedSportId]);

  const filteredMatches = useMemo(() => {
    let result = matches.filter(m => m.status !== 'finished');
    const todayKey = toLocalISODate(new Date());
    if (statusFilter !== 'live') {
      if (dateTab === 'today') {
        result = result.filter(m => toLocalISODate(new Date(m.kickoffTime)) === todayKey);
      } else if (dateTab === 'upcoming') {
        result = result.filter(m => {
          const k = toLocalISODate(new Date(m.kickoffTime));
          return k > todayKey && m.status === 'scheduled';
        });
      } else if (dateTab === 'calendar' && calendarDate) {
        result = result.filter(m => toLocalISODate(new Date(m.kickoffTime)) === calendarDate);
      }
    }
    void getBrowserTimezone(); void isTodayTz;
    if (leagueFilter !== 'all') {
      const league = ALL_LEAGUES.find(l => l.slug === leagueFilter);
      if (league) {
        result = result.filter(m => m.leagueId === league.id);
      } else {
        result = result.filter(m =>
          (m.league as { slug?: string }).slug === leagueFilter
        );
      }
    }
    if (search) {
      const lo = search.toLowerCase();
      result = result.filter(m =>
        m.homeTeam.name.toLowerCase().includes(lo) ||
        m.awayTeam.name.toLowerCase().includes(lo) ||
        m.league.name.toLowerCase().includes(lo)
      );
    }
    return result;
  }, [matches, leagueFilter, search, dateTab, calendarDate, statusFilter]);

  const PAGE_SIZE = 40;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter, leagueFilter, selectedSportId, dateTab, calendarDate]);

  const visibleMatches = useMemo(() => filteredMatches.slice(0, visibleCount), [filteredMatches, visibleCount]);
  const hasMore = visibleCount < filteredMatches.length;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some(e => e.isIntersecting)) setVisibleCount(c => Math.min(c + PAGE_SIZE, filteredMatches.length)); },
      { rootMargin: '400px 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, filteredMatches.length]);

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, { sport: Match['sport']; league: Match['league']; matches: Match[] }>();
    visibleMatches.forEach(match => {
      const key = `${match.sport.id}-${match.league.id}-${match.league.name}`;
      const existing = groups.get(key);
      if (existing) existing.matches.push(match);
      else groups.set(key, { sport: match.sport, league: match.league, matches: [match] });
    });
    return Array.from(groups.entries()).map(([key, group]) => ({ key, sport: group.sport, league: group.league, matches: group.matches }));
  }, [visibleMatches]);

  return (
    <div className="flex min-h-0 flex-1">

      {/* ── Creative Left Sidebar ── */}
      <MatchesLeftSidebar
        selectedSportId={selectedSportId}
        onSelectSport={setSelectedSportId}
        matchCounts={matchCounts}
        liveCount={stats.live}
        todayCount={stats.today}
        dateTab={dateTab}
        onDateTab={setDateTab}
        calendarDate={calendarDate}
        onCalendarDate={setCalendarDate}
        leagueFilter={leagueFilter}
        onLeagueFilter={setLeagueFilter}
        allMatchCount={allMatches.length}
      />

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-hidden min-w-0 flex flex-col">
        {/* Sports Filter Bar (top scrollable strip) */}
        <div className="border-b border-border bg-card/50 px-4 py-2 shrink-0">
          <SportsFilter
            selectedSportId={selectedSportId}
            onSelectSport={setSelectedSportId}
            matchCounts={matchCounts}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2.5">
          {/* Header */}
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {selectedSportId ? ALL_SPORTS.find(s => s.id === selectedSportId)?.name + ' Matches' : 'All Matches'}
              </h1>
            </div>
            <div className="flex gap-2">
              <Badge
                variant={statusFilter === 'live' ? 'destructive' : 'outline'}
                className="cursor-pointer gap-1 h-6 text-[10px]"
                onClick={() => setStatusFilter(statusFilter === 'live' ? 'all' : 'live')}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
                </span>
                {stats.live} Live
              </Badge>
              <Badge variant="outline" className="gap-1 h-6 text-[10px]">
                <Clock className="h-3 w-3" />{stats.today} Today
              </Badge>
            </div>
          </div>

          {/* Date tabs */}
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              {([
                { v: 'today' as DateTab, label: 'Today', Icon: Clock },
                { v: 'upcoming' as DateTab, label: 'Upcoming', Icon: CalendarClock },
                { v: 'calendar' as DateTab, label: 'Pick Date', Icon: CalendarDays },
              ]).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  onClick={() => setDateTab(v)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    dateTab === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3 w-3" />{label}
                </button>
              ))}
            </div>
            {dateTab === 'calendar' && (
              <Input type="date" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} className="h-7 w-36 text-xs" />
            )}
          </div>

          {/* Filters row */}
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search teams, leagues..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={leagueFilter} onValueChange={setLeagueFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All Leagues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Leagues</SelectItem>
                {relevantLeagues.map(league => (
                  <SelectItem key={league.id} value={league.slug} className="text-xs">{league.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => { setSearch(''); setStatusFilter('all'); setLeagueFilter('all'); setSelectedSportId(null); }}
            >
              <ListFilter className="h-3.5 w-3.5" />Clear
            </Button>
          </div>

          {/* Results count */}
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''} found
            {statusFilter === 'live' && <span className="ml-2 text-live">• Updating every 10s</span>}
          </div>

          {/* Match list */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8" /></div>
          ) : filteredMatches.length > 0 ? (
            <div className="space-y-3">
              {groupedMatches.map(({ key, sport, league, matches: leagueMatches }) => {
                const leagueSlug = league.slug || league.name.toLowerCase().replace(/\s+/g, '-');
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between border-b border-border/60 pb-1">
                      <Link
                        href={`/leagues/${leagueSlug}`}
                        className="group flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <SportIcon sportSlug={sport.slug} size="sm" />
                        <LeagueFlag countryCode={league.countryCode} size="xs" />
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider group-hover:text-primary/70">{league.country}</span>
                        <span className="group-hover:underline underline-offset-4">{league.name}</span>
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] font-bold">{leagueMatches.length}</Badge>
                        <ChevronRight className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </div>
                    <div className="space-y-1">
                      {leagueMatches.map(match => (
                        <MatchCardNew key={match.id} match={match} variant="compact" showLeague={false} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {hasMore ? (
                <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  <span>Loading more… ({visibleCount} of {filteredMatches.length})</span>
                </div>
              ) : filteredMatches.length > PAGE_SIZE ? (
                <div className="py-6 text-center text-[11px] text-muted-foreground">All {filteredMatches.length} matches loaded.</div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 text-base font-semibold text-foreground">No matches found</h3>
              <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters or check back later</p>
              <Button
                className="mt-4 h-8 text-xs"
                onClick={() => { setSearch(''); setStatusFilter('all'); setLeagueFilter('all'); setSelectedSportId(null); }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar — best bets on xl+ */}
      <aside className="hidden xl:block w-72 shrink-0 border-l border-border">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
          <BestBetsPanel matches={filteredMatches.slice(0, 20)} />
        </div>
      </aside>
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>}>
      <MatchesContent />
    </Suspense>
  );
}
