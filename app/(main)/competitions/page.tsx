'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Trophy, Calendar, Users, Clock, Star, Zap, Gift, ChevronRight, Timer,
  Target, TrendingUp, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlagIcon } from '@/components/ui/flag-icon';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { ALL_LEAGUES, getSportIcon } from '@/lib/sports-data';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface OutrightOutcome { name: string; price: number }
interface OutrightMarket { id: string; name: string; outcomes: OutrightOutcome[] }

interface ApiCompetition {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: string;
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  prizePool: number;
  currency: string;
  entryFee: number;
  maxParticipants: number;
  currentParticipants: number;
  prizes: Array<{ place: string; amount: number }>;
  sportFocus: string;
  topThree: Array<{ rank: number; username: string; displayName: string; avatar: string | null }>;
}

interface CompetitionsResponse {
  success: boolean;
  competitions: ApiCompetition[];
  stats: { active: number; upcoming: number; totalParticipants: number; totalPrizePool: number };
}

const SPORT_PRIORITY: Record<number, number> = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 7: 5,
};

const OUTRIGHT_LEAGUE_IDS = [1, 2, 3, 4, 5, 9, 101, 401, 501, 601, 2701];

const SPORT_ICON_BY_ID: Record<number, string> = {
  1: 'football', 2: 'basketball', 3: 'tennis',
  5: 'american-football', 6: 'baseball', 7: 'ice-hockey',
  27: 'mma',
};

export default function CompetitionsPage() {
  const [activeTab, setActiveTab] = useState('outrights');

  const { data: compsData, isLoading: compsLoading } = useSWR<CompetitionsResponse>(
    '/api/competitions',
    fetcher,
    { revalidateOnFocus: false },
  );

  const outrightLeagues = useMemo(() => {
    return OUTRIGHT_LEAGUE_IDS
      .map(id => ALL_LEAGUES.find(l => l.id === id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l))
      .sort((a, b) => (SPORT_PRIORITY[a.sportId] ?? 99) - (SPORT_PRIORITY[b.sportId] ?? 99));
  }, []);

  const allComps = compsData?.competitions ?? [];
  const activeComps = allComps.filter(c => c.status === 'active');
  const upcomingComps = allComps.filter(c => c.status === 'upcoming');
  const stats = compsData?.stats;

  return (
    <div className="flex-1 overflow-hidden">
        <div className="px-3 py-2.5">
          {/* Header */}
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-1.5 text-lg font-bold text-foreground">
                <Trophy className="h-5 w-5 text-warning" />
                Competitions
              </h1>
              <p className="text-xs text-muted-foreground">
                Outright winners, tipster challenges, and more
              </p>
            </div>
            <Button size="sm" className="h-7 text-xs" asChild>
              <Link href="/leaderboard">
                <Star className="mr-1.5 h-3.5 w-3.5" />
                Leaderboard
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-gradient-to-br from-warning/10 to-transparent p-2 text-center">
              <Target className="mx-auto h-3.5 w-3.5 text-warning" />
              <div className="mt-0.5 text-base font-bold text-warning leading-none">{outrightLeagues.length}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Markets</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2 text-center">
              <Zap className="mx-auto h-3.5 w-3.5 text-primary" />
              <div className="mt-0.5 text-base font-bold leading-none">{stats?.active ?? activeComps.length}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Contests</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2 text-center">
              <Users className="mx-auto h-3.5 w-3.5 text-success" />
              <div className="mt-0.5 text-base font-bold leading-none">{stats?.totalParticipants ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipsters</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2 text-center">
              <Gift className="mx-auto h-3.5 w-3.5 text-live" />
              <div className="mt-0.5 text-base font-bold leading-none">
                KES {Math.round((stats?.totalPrizePool ?? 0) / 1000)}K
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prizes</div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="grid h-8 w-full grid-cols-2 p-0.5">
              <TabsTrigger value="outrights" className="h-7 gap-1.5 text-xs">
                <Target className="h-3 w-3" /> Outrights
              </TabsTrigger>
              <TabsTrigger value="contests" className="h-7 gap-1.5 text-xs">
                <Trophy className="h-3 w-3" /> Contests ({activeComps.length + upcomingComps.length})
              </TabsTrigger>
            </TabsList>

            {/* Outright Winners Tab */}
            <TabsContent value="outrights" className="mt-3">
              <div className="mb-2 text-[11px] text-muted-foreground">
                Real bookmaker odds aggregated from UK / EU / US sportsbooks.
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                {outrightLeagues.map(league => (
                  <OutrightCard key={league.id} league={league} />
                ))}
              </div>
            </TabsContent>

            {/* Tipster Contests Tab */}
            <TabsContent value="contests" className="mt-3">
              {compsLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {[...activeComps, ...upcomingComps].map(comp => (
                    <CompetitionCard key={comp.id} competition={comp} />
                  ))}
                </div>
              )}
              {!compsLoading && activeComps.length === 0 && upcomingComps.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">No active contests</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Check back soon for new tipster competitions</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
  );
}

function formatTimeLeft(end: string): string {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return 'Ending';
}

function CompetitionCard({ competition }: { competition: ApiCompetition }) {
  const fillPct = Math.min(100, Math.round((competition.currentParticipants / competition.maxParticipants) * 100));
  const isActive = competition.status === 'active';
  const isFree = competition.entryFee === 0;

  return (
    <Link
      href={`/competitions/${competition.slug}`}
      className={cn(
        'group block rounded-lg border bg-card p-2.5 transition-all hover:border-primary/50 hover:shadow-md',
        isActive && 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent',
      )}
    >
      {/* Header row */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        {isActive && (
          <Badge variant="destructive" className="bg-live h-4 text-[9px] px-1.5">
            <Timer className="mr-0.5 h-2.5 w-2.5" />{formatTimeLeft(competition.endDate)}
          </Badge>
        )}
        {!isActive && (
          <Badge className="h-4 text-[9px] px-1.5 bg-blue-500/15 text-blue-500 border-blue-500/30">Upcoming</Badge>
        )}
        <Badge variant="outline" className="h-4 text-[9px] px-1.5 capitalize">{competition.type}</Badge>
        {isFree && <Badge className="h-4 text-[9px] px-1.5 bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Free</Badge>}
      </div>

      {/* Title + prize */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight truncate group-hover:text-primary transition-colors">{competition.name}</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2 leading-tight">{competition.description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-warning leading-none">{competition.currency} {(competition.prizePool / 1000).toFixed(0)}K</div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">prize</div>
        </div>
      </div>

      {/* Participation bar */}
      <div className="mb-1.5">
        <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{competition.currentParticipants}/{competition.maxParticipants}</span>
          <span>{fillPct}%</span>
        </div>
        <Progress value={fillPct} className="h-1" />
      </div>

      {/* Top 3 mini */}
      {competition.topThree.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-border pt-1.5">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Top:</span>
          <div className="flex -space-x-1.5">
            {competition.topThree.map(t => (
              <div key={t.username} title={t.displayName} className="relative h-5 w-5 rounded-full border-2 border-card overflow-hidden bg-muted">
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary text-[8px] font-bold text-primary-foreground">
                    {(t.displayName || '?').charAt(0)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground truncate flex-1">{competition.topThree[0]?.displayName}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      )}
    </Link>
  );
}

interface OutrightApiResponse { success: boolean; data: OutrightMarket[] }

function OutrightCard({ league }: { league: typeof ALL_LEAGUES[number] }) {
  const { data, isLoading } = useSWR<OutrightApiResponse>(
    `/api/leagues/${league.id}/outrights`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const outrights = data?.data ?? [];
  const market = outrights[0];
  const sportIcon = getSportIcon(SPORT_ICON_BY_ID[league.sportId] || 'football');
  const favourite = market?.outcomes[0];
  const others = market?.outcomes.slice(1, 4) ?? [];

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent py-2 px-3">
        <CardTitle className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base">{sportIcon}</span>
            <FlagIcon countryCode={league.countryCode} size="sm" />
            <span className="truncate">{league.name}</span>
          </div>
          <Link href={`/leagues/${league.slug}`}>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-2.5 px-3">
        {isLoading ? (
          <div className="flex h-16 items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : favourite ? (
          <>
            <div className="mb-2 flex items-center justify-between rounded-md bg-warning/10 px-2 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Star className="h-3 w-3 text-warning fill-warning shrink-0" />
                <span className="text-xs font-semibold truncate">{favourite.name}</span>
              </div>
              <span className="font-mono text-sm font-bold text-success shrink-0">{favourite.price.toFixed(2)}</span>
            </div>
            <div className="space-y-1">
              {others.map((o, idx) => (
                <div
                  key={`${o.name}-${idx}`}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shrink-0',
                      idx === 0 && 'bg-gray-300 text-gray-700',
                      idx === 1 && 'bg-amber-700 text-amber-100',
                      idx > 1 && 'bg-muted',
                    )}>{idx + 2}</span>
                    <span className="text-[11px] truncate">{o.name}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-primary shrink-0">{o.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5 text-center text-[10px] text-muted-foreground">
            No bookmaker odds yet. Outright markets open closer to the season.
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-2 w-full h-7 text-[11px]" asChild>
          <Link href={`/leagues/${league.slug}`}>
            View All Odds
            <TrendingUp className="ml-1.5 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
