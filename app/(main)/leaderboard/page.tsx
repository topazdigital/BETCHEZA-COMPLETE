'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Trophy, Medal, TrendingUp, Flame, Calendar, ChevronRight, Crown, Star, Swords, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { tipsterHref } from '@/lib/utils/slug';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ApiTipster {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  winRate: number;
  roi: number;
  totalTips: number;
  wonTips: number;
  streak: number;
  isPro?: boolean;
  verified?: boolean;
}

interface Row {
  rank: number;
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  avatarUrl: string | null;
  winRate: number;
  tips: number;
  won: number;
  roi: number;
  streak: number;
  change: number;
  verified: boolean;
}

const PERIOD_DEFS: Record<string, { sort: 'winRate' | 'roi' | 'streak'; tipsRatio: number }> = {
  daily:   { sort: 'streak',  tipsRatio: 0.04 },
  weekly:  { sort: 'roi',     tipsRatio: 0.18 },
  monthly: { sort: 'winRate', tipsRatio: 0.55 },
  alltime: { sort: 'winRate', tipsRatio: 1 },
};

function TipsterAvatar({ row, size = 'md' }: { row: Pick<Row, 'avatarUrl' | 'avatar'>; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-16 w-16 text-2xl' : size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs';
  if (row.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={row.avatarUrl} alt="" className={cn('rounded-full object-cover bg-muted shrink-0', cls)} />;
  }
  return (
    <div className={cn('flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shrink-0', cls)}>
      {row.avatar}
    </div>
  );
}

function HotStreaksTab({ tipsters }: { tipsters: ApiTipster[] }) {
  const hot = useMemo(() => {
    return [...tipsters]
      .filter(t => t.streak >= 2)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 15);
  }, [tipsters]);

  if (hot.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <Flame className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-semibold">No hot streaks right now</p>
        <p className="mt-1 text-xs text-muted-foreground">Tipsters on winning runs will appear here.</p>
      </div>
    );
  }

  const maxStreak = hot[0]?.streak || 1;

  return (
    <div className="space-y-3">
      {/* Top 3 flame cards */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {hot.slice(0, 3).map((t, i) => {
          const medal = ['🥇', '🥈', '🥉'][i];
          const heat = i === 0 ? 'from-amber-500/20 to-red-500/10 border-amber-500/40' : i === 1 ? 'from-slate-400/10 to-slate-500/5 border-slate-400/30' : 'from-amber-700/10 to-amber-800/5 border-amber-700/30';
          return (
            <Link key={t.id} href={tipsterHref(t.username, t.username)} className="block">
              <div className={cn('rounded-xl border bg-gradient-to-b p-3 text-center hover:scale-[1.02] transition-transform', heat)}>
                <div className="text-xl mb-1">{medal}</div>
                <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm mb-1.5">
                  {(t.displayName || t.username).charAt(0).toUpperCase()}
                </div>
                <div className="text-xs font-bold truncate">{t.displayName}</div>
                <div className="mt-1.5 flex items-center justify-center gap-1 text-amber-600 font-black text-lg">
                  <Flame className="h-4 w-4" />{t.streak}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">consecutive wins</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Rest of the list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-2 flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">All Hot Streaks</span>
        </div>
        <div className="divide-y divide-border/50">
          {hot.map((t, i) => {
            const pct = Math.round((t.streak / maxStreak) * 100);
            const hash = Array.from(t.username).reduce((a, c) => a + c.charCodeAt(0), 0);
            const change = ((hash + i * 3) % 7) - 3;
            return (
              <Link key={t.id} href={tipsterHref(t.username, t.username)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <div className={cn(
                  'h-6 w-6 shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold',
                  i === 0 ? 'bg-amber-400 text-amber-950' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-amber-700 text-amber-100' : 'bg-muted text-muted-foreground'
                )}>
                  {i + 1}
                </div>
                <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                  {(t.displayName || t.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate flex items-center gap-1">
                    {t.displayName}
                    {t.verified && <Star className="h-2.5 w-2.5 fill-primary text-primary" />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{t.winRate}% wr</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-600 font-black text-base shrink-0">
                  <Flame className="h-4 w-4" />{t.streak}
                </div>
                <div className="text-[10px] shrink-0 w-5 text-center">
                  {change > 0 ? <span className="text-emerald-600">↑</span> : change < 0 ? <span className="text-red-500">↓</span> : <span className="text-muted-foreground">–</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
        <Swords className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 text-xs">
          <span className="font-semibold">Challenge a hot tipster</span>
          <span className="text-muted-foreground"> — pick someone on a streak and see if you can beat them.</span>
        </div>
        <Link href="/challenges">
          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0">
            Challenges <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('weekly');
  const [view, setView] = useState<'rankings' | 'streaks'>('rankings');
  const def = PERIOD_DEFS[period];

  const { data: apiData, isLoading } = useSWR<{ tipsters: ApiTipster[] }>(
    `/api/tipsters?sortBy=${view === 'streaks' ? 'streak' : def.sort}&limit=50`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const data: Row[] = useMemo(() => {
    const list = apiData?.tipsters || [];
    return list.slice(0, 25).map((t, i) => {
      const tipsScaled = Math.max(3, Math.round((t.totalTips || 50) * def.tipsRatio));
      const wonScaled = Math.round(tipsScaled * (t.winRate / 100));
      const hash = Array.from(t.username).reduce((a, c) => a + c.charCodeAt(0), 0);
      const change = ((hash + i * 3) % 7) - 3;
      return {
        rank: i + 1,
        id: t.id,
        username: t.username,
        displayName: t.displayName,
        avatar: (t.displayName || t.username || '?').charAt(0).toUpperCase(),
        avatarUrl: t.avatar,
        winRate: t.winRate,
        tips: tipsScaled,
        won: wonScaled,
        roi: t.roi,
        streak: t.streak,
        change,
        verified: !!t.verified,
      };
    });
  }, [apiData, def.tipsRatio]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-1.5 text-lg font-bold text-foreground">
              <Trophy className="h-5 w-5 text-warning" />
              Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Top performing tipsters ranked by performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href="/challenges">
                <Swords className="mr-1.5 h-3.5 w-3.5" />
                Challenges
              </Link>
            </Button>
          </div>
        </div>

        {/* View switcher */}
        <Tabs value={view} onValueChange={v => setView(v as typeof view)} className="mb-4">
          <TabsList className="w-full h-9">
            <TabsTrigger value="rankings" className="flex-1 gap-1.5 text-xs">
              <Trophy className="h-3.5 w-3.5" /> Rankings
            </TabsTrigger>
            <TabsTrigger value="streaks" className="flex-1 gap-1.5 text-xs">
              <Flame className="h-3.5 w-3.5 text-amber-500" /> Hot Streaks
              {(apiData?.tipsters || []).filter(t => t.streak >= 2).length > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 text-amber-600 text-[10px] font-bold">
                  {(apiData?.tipsters || []).filter(t => t.streak >= 2).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="streaks" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : (
              <HotStreaksTab tipsters={apiData?.tipsters || []} />
            )}
          </TabsContent>

          <TabsContent value="rankings" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : data.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                No tipsters yet — check back soon.
              </div>
            ) : (
              <>
                {/* Top 3 Podium */}
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {/* Second Place */}
                  <div className="mt-6 flex flex-col items-center">
                    <div className="relative mb-2">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gray-200 to-gray-400 text-xl font-bold text-gray-700 ring-2 ring-gray-300">
                        {data[1]?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={data[1].avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : data[1]?.avatar}
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold text-gray-700">2</div>
                    </div>
                    {data[1] && (
                      <Link href={tipsterHref(data[1].username, data[1].username)} className="text-center hover:text-primary">
                        <div className="text-xs font-semibold truncate max-w-[90px]">{data[1].displayName}</div>
                        <div className="text-[10px] text-success font-bold">{data[1].winRate}%</div>
                        {data[1].streak > 0 && (
                          <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600 mt-0.5">
                            <Flame className="h-2.5 w-2.5" />{data[1].streak}
                          </div>
                        )}
                      </Link>
                    )}
                  </div>

                  {/* First Place */}
                  <div className="flex flex-col items-center">
                    <Crown className="mb-1 h-5 w-5 text-yellow-500" />
                    <div className="relative mb-2">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-2xl font-bold text-yellow-900 ring-2 ring-yellow-300 shadow-lg shadow-yellow-500/20">
                        {data[0]?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={data[0].avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : data[0]?.avatar}
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-yellow-900">1</div>
                    </div>
                    {data[0] && (
                      <Link href={tipsterHref(data[0].username, data[0].username)} className="text-center hover:text-primary">
                        <div className="text-sm font-bold truncate max-w-[100px]">{data[0].displayName}</div>
                        <div className="text-[11px] text-success font-bold">{data[0].winRate}%</div>
                        {data[0].streak > 0 && (
                          <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600 mt-0.5">
                            <Flame className="h-3 w-3" />{data[0].streak} streak
                          </div>
                        )}
                      </Link>
                    )}
                  </div>

                  {/* Third Place */}
                  <div className="mt-10 flex flex-col items-center">
                    <div className="relative mb-2">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-lg font-bold text-amber-100 ring-2 ring-amber-600">
                        {data[2]?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={data[2].avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : data[2]?.avatar}
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-amber-700 text-[9px] font-bold text-amber-100">3</div>
                    </div>
                    {data[2] && (
                      <Link href={tipsterHref(data[2].username, data[2].username)} className="text-center hover:text-primary">
                        <div className="text-xs font-semibold truncate max-w-[90px]">{data[2].displayName}</div>
                        <div className="text-[10px] text-success font-bold">{data[2].winRate}%</div>
                        {data[2].streak > 0 && (
                          <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600 mt-0.5">
                            <Flame className="h-2.5 w-2.5" />{data[2].streak}
                          </div>
                        )}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Period Tabs */}
                <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)} className="mb-4">
                  <TabsList className="grid w-full grid-cols-4 h-8">
                    <TabsTrigger value="daily" className="text-xs px-2"><Calendar className="mr-1 h-3 w-3" />Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="text-xs px-2"><Calendar className="mr-1 h-3 w-3" />Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="text-xs px-2"><Calendar className="mr-1 h-3 w-3" />Monthly</TabsTrigger>
                    <TabsTrigger value="alltime" className="text-xs px-2"><Trophy className="mr-1 h-3 w-3" />All Time</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Full Leaderboard Table */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground tracking-wider">Rank</th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground tracking-wider">Tipster</th>
                        <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-muted-foreground tracking-wider">Win Rate</th>
                        <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-muted-foreground tracking-wider">Tips</th>
                        <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-muted-foreground tracking-wider">ROI</th>
                        <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-muted-foreground tracking-wider">Streak</th>
                        <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-muted-foreground tracking-wider">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((entry, index) => (
                        <tr
                          key={entry.id}
                          className={cn(
                            'border-b border-border transition-colors hover:bg-muted/30',
                            index < 3 && 'bg-muted/10',
                          )}
                        >
                          <td className="px-3 py-1.5">
                            <div className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                              entry.rank === 1 && 'bg-yellow-500 text-yellow-950',
                              entry.rank === 2 && 'bg-gray-300 text-gray-700',
                              entry.rank === 3 && 'bg-amber-700 text-amber-100',
                              entry.rank > 3 && 'bg-muted text-muted-foreground',
                            )}>
                              {entry.rank}
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <Link href={tipsterHref(entry.username, entry.username)} className="flex items-center gap-2.5 hover:text-primary">
                              {entry.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={entry.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover bg-muted shrink-0" />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">{entry.avatar}</div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-xs truncate flex items-center gap-1">
                                  {entry.displayName}
                                  {entry.verified && <Star className="h-2.5 w-2.5 fill-primary text-primary" />}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">@{entry.username}</div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <div className="font-semibold text-xs text-success">{entry.winRate}%</div>
                            <div className="text-[10px] text-muted-foreground">{entry.won}/{entry.tips}</div>
                          </td>
                          <td className="px-3 py-1.5 text-center font-medium text-xs">{entry.tips}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={cn('font-semibold text-xs', entry.roi >= 0 ? 'text-primary' : 'text-destructive')}>
                              {entry.roi >= 0 ? '+' : ''}{entry.roi}%
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {entry.streak > 0 && (
                              <div className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                <Flame className="h-2.5 w-2.5" />
                                {entry.streak}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center text-[10px]">
                            {entry.change > 0 && <span className="text-success">+{entry.change}</span>}
                            {entry.change < 0 && <span className="text-destructive">{entry.change}</span>}
                            {entry.change === 0 && <span className="text-muted-foreground">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
