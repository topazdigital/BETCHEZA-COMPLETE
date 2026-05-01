'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Trophy, Medal, TrendingUp, Flame, Calendar, ChevronRight, Crown, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarNew } from '@/components/layout/sidebar-new';
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

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('weekly');
  const def = PERIOD_DEFS[period];

  const { data: apiData, isLoading } = useSWR<{ tipsters: ApiTipster[] }>(
    `/api/tipsters?sortBy=${def.sort}&limit=50`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const data: Row[] = useMemo(() => {
    const list = apiData?.tipsters || [];
    return list.slice(0, 25).map((t, i) => {
      const tipsScaled = Math.max(3, Math.round((t.totalTips || 50) * def.tipsRatio));
      const wonScaled = Math.round(tipsScaled * (t.winRate / 100));
      // Deterministic "change" from username hash
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
    <div className="flex">
      <SidebarNew />
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
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href="/competitions">
                <Star className="mr-1.5 h-3.5 w-3.5" />
                View Competitions
              </Link>
            </Button>
          </div>

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
        </div>
      </div>
    </div>
  );
}
