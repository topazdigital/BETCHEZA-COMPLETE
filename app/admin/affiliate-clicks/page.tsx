'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { MousePointerClick, RefreshCw, Trash2, Globe, Trophy, Calendar, Smartphone, Layers, TrendingUp, UserPlus, DollarSign, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface FunnelRow {
  bookmakerId: number;
  bookmakerName: string;
  bookmakerSlug: string;
  clicks: number;
  signups: number;
  conversionRate: number;
  deposits: number;
  uniqueDepositors: number;
  revenue: number;
  revenuePerClick: number;
  arpu: number;
}

interface ConversionEvent {
  id: number;
  ts: number;
  type: 'signup' | 'deposit';
  userId: number;
  bookmakerName: string;
  amount?: number;
  currency?: string;
}

interface ClickStats {
  total: number;
  last24h: number;
  last7d: number;
  byBookmaker: Array<{ bookmakerId: number; bookmakerName: string; bookmakerSlug: string; clicks: number; last24h: number }>;
  bySport: Array<{ sport: string; clicks: number }>;
  byLeague: Array<{ league: string; clicks: number }>;
  byMatch: Array<{ matchId: string; matchLabel: string; clicks: number }>;
  byPlacement: Array<{ placement: string; clicks: number }>;
  byDevice: Array<{ device: string; clicks: number }>;
  byDay: Array<{ date: string; clicks: number }>;
  recent: Array<{
    id: number; ts: number; bookmakerName: string; placement: string;
    sport?: string; league?: string; matchLabel?: string; market?: string;
    selection?: string; device: string; country?: string;
  }>;
  funnel: FunnelRow[];
  funnelTotals: {
    clicks: number;
    signups: number;
    conversionRate: number;
    deposits: number;
    uniqueDepositors: number;
    revenue: number;
    revenuePerClick: number;
  };
  recentConversions: ConversionEvent[];
}

function formatMoney(n: number, currency = 'KES'): string {
  if (!n) return `${currency} 0`;
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Failed');
  return r.json();
});

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function AffiliateClicksPage() {
  const [days, setDays] = useState('30');
  const { data, isLoading, error, mutate } = useSWR<ClickStats>(
    `/api/admin/affiliate-clicks?days=${days}`,
    fetcher,
    { refreshInterval: 30_000 },
  );

  const handleClear = async () => {
    if (!confirm('Clear ALL affiliate click history? This cannot be undone.')) return;
    await fetch('/api/admin/affiliate-clicks', { method: 'DELETE' });
    mutate();
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        Could not load click stats.
      </div>
    );
  }

  const peak = Math.max(1, ...data.byDay.map(d => d.clicks));
  const topBookClicks = Math.max(1, ...data.byBookmaker.map(b => b.clicks));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold">Affiliate Clicks</h1>
          <p className="text-xs text-muted-foreground">
            Per-bookmaker click attribution with sport, league, match and placement context.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => mutate()} className="h-8 text-xs">
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClear} className="h-8 text-xs text-destructive">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">All time clicks</p>
                <p className="text-2xl font-bold">{data.total.toLocaleString()}</p>
              </div>
              <MousePointerClick className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Last 24 hours</p>
            <p className="text-2xl font-bold">{data.last24h.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Last 7 days</p>
            <p className="text-2xl font-bold">{data.last7d.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Top bookmaker</p>
            <p className="text-sm font-bold truncate">{data.byBookmaker[0]?.bookmakerName ?? '—'}</p>
            <p className="text-[10px] text-muted-foreground">
              {data.byBookmaker[0]?.clicks.toLocaleString() ?? 0} clicks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart (sparkline-ish bars) */}
      <Card>
        <CardHeader className="py-2 pb-1.5 px-3">
          <CardTitle className="text-sm font-semibold">Daily clicks ({days}d)</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {data.byDay.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex h-24 items-end gap-1">
              {data.byDay.map(d => (
                <div key={d.date} className="group flex flex-1 flex-col items-center justify-end" title={`${d.date} — ${d.clicks} clicks`}>
                  <div
                    className="w-full rounded-t bg-primary/70 transition-all group-hover:bg-primary"
                    style={{ height: `${(d.clicks / peak) * 100}%`, minHeight: d.clicks > 0 ? 2 : 0 }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per bookmaker */}
      <Card>
        <CardHeader className="py-2 pb-1.5 px-3">
          <CardTitle className="text-sm font-semibold">Clicks by bookmaker</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {data.byBookmaker.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No clicks recorded yet. Once users click an outbound bookmaker link, attribution will land here.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">Bookmaker</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Last 24h</th>
                  <th className="pb-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.byBookmaker.map(b => (
                  <tr key={b.bookmakerId} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="py-1.5 font-medium">{b.bookmakerName}</td>
                    <td className="py-1.5">{b.clicks.toLocaleString()}</td>
                    <td className="py-1.5">{b.last24h.toLocaleString()}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${(b.clicks / topBookClicks) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round((b.clicks / Math.max(1, data.total)) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ─── Conversion Funnel ─── */}
      <Card className="border-primary/30">
        <CardHeader className="py-2 pb-1.5 px-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          {/* Funnel summary stats */}
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase text-muted-foreground">Sign-ups</p>
                <UserPlus className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xl font-bold">{data.funnelTotals.signups.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">
                CR {data.funnelTotals.conversionRate.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase text-muted-foreground">Deposits</p>
                <DollarSign className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xl font-bold">{data.funnelTotals.deposits.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">
                {data.funnelTotals.uniqueDepositors.toLocaleString()} unique
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase text-muted-foreground">Revenue</p>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="text-xl font-bold">{formatMoney(data.funnelTotals.revenue)}</p>
              <p className="text-[10px] text-muted-foreground">across all books</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase text-muted-foreground">Revenue / Click</p>
                <MousePointerClick className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xl font-bold">{formatMoney(data.funnelTotals.revenuePerClick)}</p>
              <p className="text-[10px] text-muted-foreground">RPC blended</p>
            </div>
          </div>

          {/* Per-bookmaker funnel table */}
          {data.funnel.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No conversions yet. As users sign up after clicking a bookmaker link, the funnel will populate here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[11px] uppercase text-muted-foreground">
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium">Bookmaker</th>
                    <th className="pb-2 font-medium text-right">Clicks</th>
                    <th className="pb-2 font-medium text-right">Sign-ups</th>
                    <th className="pb-2 font-medium text-right">CR%</th>
                    <th className="pb-2 font-medium text-right">Deposits</th>
                    <th className="pb-2 font-medium text-right">Depositors</th>
                    <th className="pb-2 font-medium text-right">Revenue</th>
                    <th className="pb-2 font-medium text-right">RPC</th>
                    <th className="pb-2 font-medium text-right">ARPU</th>
                  </tr>
                </thead>
                <tbody>
                  {data.funnel.map(f => (
                    <tr key={f.bookmakerId} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-1.5 font-medium">{f.bookmakerName}</td>
                      <td className="py-1.5 text-right tabular-nums">{f.clicks.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums">{f.signups.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        <span className={f.conversionRate >= 5 ? 'text-emerald-600 font-medium' : f.conversionRate > 0 ? '' : 'text-muted-foreground'}>
                          {f.conversionRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{f.deposits.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums">{f.uniqueDepositors.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{formatMoney(f.revenue)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatMoney(f.revenuePerClick)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatMoney(f.arpu)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent conversions feed */}
          {data.recentConversions.length > 0 && (
            <div>
              <p className="text-[11px] uppercase text-muted-foreground mb-1.5">Recent conversions</p>
              <div className="space-y-1">
                {data.recentConversions.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 bg-muted/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant={c.type === 'deposit' ? 'default' : 'secondary'}
                        className="h-4 text-[9px] px-1 capitalize"
                      >
                        {c.type}
                      </Badge>
                      <span className="text-xs font-medium truncate">{c.bookmakerName}</span>
                      <span className="text-[10px] text-muted-foreground">user #{c.userId}</span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      {c.type === 'deposit' && c.amount && (
                        <span className="text-xs font-medium text-emerald-600 mr-2">
                          +{formatMoney(c.amount, c.currency)}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{formatTime(c.ts)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdowns by context */}
      <Tabs defaultValue="placement" className="w-full">
        <TabsList className="h-8">
          <TabsTrigger value="placement" className="text-xs"><Layers className="mr-1 h-3 w-3" />Placement</TabsTrigger>
          <TabsTrigger value="sport" className="text-xs"><Trophy className="mr-1 h-3 w-3" />Sport</TabsTrigger>
          <TabsTrigger value="league" className="text-xs"><Globe className="mr-1 h-3 w-3" />League</TabsTrigger>
          <TabsTrigger value="match" className="text-xs"><Calendar className="mr-1 h-3 w-3" />Match</TabsTrigger>
          <TabsTrigger value="device" className="text-xs"><Smartphone className="mr-1 h-3 w-3" />Device</TabsTrigger>
        </TabsList>
        <TabsContent value="placement"><BreakdownTable rows={data.byPlacement} keyName="placement" /></TabsContent>
        <TabsContent value="sport"><BreakdownTable rows={data.bySport} keyName="sport" /></TabsContent>
        <TabsContent value="league"><BreakdownTable rows={data.byLeague} keyName="league" /></TabsContent>
        <TabsContent value="match">
          <Card>
            <CardContent className="p-3">
              {data.byMatch.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No match-attributed clicks yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-[11px] uppercase text-muted-foreground">
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium">Match</th>
                      <th className="pb-2 font-medium">Match ID</th>
                      <th className="pb-2 font-medium">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMatch.map(m => (
                      <tr key={m.matchId} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="py-1.5 font-medium">{m.matchLabel}</td>
                        <td className="py-1.5 text-muted-foreground">{m.matchId}</td>
                        <td className="py-1.5">{m.clicks.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="device"><BreakdownTable rows={data.byDevice} keyName="device" /></TabsContent>
      </Tabs>

      {/* Recent clicks */}
      <Card>
        <CardHeader className="py-2 pb-1.5 px-3">
          <CardTitle className="text-sm font-semibold">Recent clicks</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {data.recent.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No clicks yet.</p>
          ) : (
            <div className="space-y-1">
              {data.recent.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium">{c.bookmakerName}</span>
                      <Badge variant="outline" className="h-4 text-[9px] px-1">{c.placement}</Badge>
                      {c.country && <Badge variant="secondary" className="h-4 text-[9px] px-1">{c.country}</Badge>}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {[c.matchLabel, c.market && `${c.market}${c.selection ? ` · ${c.selection}` : ''}`, c.league, c.sport].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">{formatTime(c.ts)}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{c.device}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownTable<T extends Record<string, string | number>>({
  rows, keyName,
}: { rows: T[]; keyName: keyof T }) {
  const total = Math.max(1, rows.reduce((sum, r) => sum + Number(r.clicks), 0));
  return (
    <Card>
      <CardContent className="p-3">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No data yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium capitalize">{String(keyName)}</th>
                <th className="pb-2 font-medium">Clicks</th>
                <th className="pb-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={String(r[keyName]) || i} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-1.5 font-medium">{String(r[keyName])}</td>
                  <td className="py-1.5">{Number(r.clicks).toLocaleString()}</td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${(Number(r.clicks) / total) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{Math.round((Number(r.clicks) / total) * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
