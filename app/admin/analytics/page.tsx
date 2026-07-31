'use client';

export const dynamic = 'force-dynamic';

import useSWR from 'swr';
import { BarChart3, TrendingUp, Eye, ArrowUpRight, ArrowDownRight, Calendar, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DailyPoint { date: string; total: number }
interface TopPage { path: string; total: number }
interface Totals { today: number; yesterday: number; week: number; month: number }
interface AnalyticsData { daily: DailyPoint[]; topPages: TopPage[]; totals: Totals }

const fetcher = (url: string) => fetch(url).then(r => r.json());

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function pct(a: number, b: number) {
  if (b === 0) return null;
  return Math.round(((a - b) / b) * 100);
}

function friendlyPath(path: string) {
  if (path === '/' || path === '') return 'Home';
  return path.replace(/^\//, '').replace(/-/g, ' ').replace(/\//g, ' › ');
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = pct(current, previous);
  if (delta === null) return null;
  const up = delta >= 0;
  return (
    <Badge variant="outline" className={cn('h-5 text-[10px] px-1.5 gap-0.5', up ? 'border-emerald-500 text-emerald-500' : 'border-red-500 text-red-500')}>
      {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(delta)}%
    </Badge>
  );
}

function BarChart({ data }: { data: DailyPoint[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground py-8 text-center">No data yet — pageviews will appear here once visitors start arriving.</p>;

  const max = Math.max(...data.map(d => d.total), 1);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex items-end gap-[3px] h-32 w-full">
      {data.map((d, i) => {
        const heightPct = Math.max((d.total / max) * 100, d.total > 0 ? 4 : 1);
        const isToday = i === data.length - 1;
        return (
          <div key={d.date} className="group flex flex-col items-center gap-1 flex-1 min-w-0">
            <div className="relative w-full flex items-end justify-center" style={{ height: 112 }}>
              <div
                className={cn(
                  'w-full rounded-t transition-all',
                  isToday ? 'bg-primary' : 'bg-primary/30 group-hover:bg-primary/60',
                )}
                style={{ height: `${heightPct}%` }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background shadow z-10 pointer-events-none">
                {d.total.toLocaleString()} views<br />{formatDate(d.date)}
              </div>
            </div>
            {(i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1) && (
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                {isToday ? 'Today' : formatDate(d.date)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, error, mutate } = useSWR<AnalyticsData>('/api/admin/analytics', fetcher, { refreshInterval: 60_000 });

  if (isLoading) {
    return <div className="flex items-center justify-center h-72"><Spinner className="h-7 w-7" /></div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        Could not load analytics. Is the database connected?
      </div>
    );
  }

  const { daily, topPages, totals } = data;
  const maxPage = topPages[0]?.total || 1;

  const statCards = [
    { label: 'Today',          value: totals.today,     compare: totals.yesterday, sub: 'vs yesterday' },
    { label: 'This Week',      value: totals.week,      compare: null,             sub: 'last 7 days'  },
    { label: 'This Month',     value: totals.month,     compare: null,             sub: 'last 30 days' },
    { label: 'Yesterday',      value: totals.yesterday, compare: null,             sub: 'full day'     },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Traffic Analytics
          </h1>
          <p className="text-xs text-muted-foreground">Rolling 30-day pageview data — updates every 60 seconds.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5 text-xs h-8">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, value, compare, sub }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                </div>
                {compare !== null && <DeltaBadge current={value} previous={compare} />}
              </div>
              <p className="text-lg font-bold mt-0.5">{fmt(value)}</p>
              <p className="text-[11px] font-medium text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Chart */}
      <Card>
        <CardHeader className="py-2.5 px-4 pb-0 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Daily Pageviews — last 30 days
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">
            {daily.length} days tracked · hover bar for details
          </span>
        </CardHeader>
        <CardContent className="px-4 pt-4 pb-3">
          <BarChart data={daily} />
        </CardContent>
      </Card>

      {/* Top Pages */}
      <Card>
        <CardHeader className="py-2.5 px-4 pb-1.5 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Top Pages — last 30 days
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">{topPages.length} pages</span>
        </CardHeader>
        <CardContent className="p-0">
          {topPages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No page data yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {topPages.map((p, i) => {
                const barWidth = Math.max((p.total / maxPage) * 100, 2);
                return (
                  <div key={p.path} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40 transition-colors">
                    <span className="text-[11px] font-bold text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate capitalize">{friendlyPath(p.path)}</span>
                        <span className="text-xs font-bold text-foreground ml-2 shrink-0">{p.total.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{p.path || '/'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
