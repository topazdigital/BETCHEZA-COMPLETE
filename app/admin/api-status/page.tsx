'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, MinusCircle, RefreshCw,
  Database, Globe, ShieldCheck, Mail, CreditCard, Bell, Zap, Users, Lock, Wifi,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type IntegrationStatus = 'ok' | 'error' | 'missing' | 'quota' | 'disabled';

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  message: string;
  detail?: string;
  configLink?: string;
}

interface ApiStatusResponse {
  items: IntegrationItem[];
  summary: Record<string, number>;
  checkedAt: string;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Infrastructure: Database,
  'Sports Data': Globe,
  AI: Zap,
  Payments: CreditCard,
  Notifications: Bell,
  Security: ShieldCheck,
  'Social Login': Users,
};

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string; dot: string }> = {
  ok:       { label: 'OK',       icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  error:    { label: 'Error',    icon: XCircle,        color: 'text-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    dot: 'bg-rose-500' },
  missing:  { label: 'Missing',  icon: MinusCircle,    color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  quota:    { label: 'Quota',    icon: AlertTriangle,  color: 'text-orange-500',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  dot: 'bg-orange-500' },
  disabled: { label: 'Disabled', icon: MinusCircle,    color: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/20',    dot: 'bg-zinc-400' },
};

function StatusDot({ status }: { status: IntegrationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', cfg.dot, status === 'ok' && 'animate-pulse')} />
  );
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Badge className={cn('h-5 gap-1 px-1.5 text-[10px] font-semibold border', cfg.color, cfg.bg, cfg.border)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function IntegrationCard({ item }: { item: IntegrationItem }) {
  const cfg = STATUS_CONFIG[item.status];
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3 transition-all', cfg.border, cfg.bg)}>
      <StatusDot status={item.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold truncate">{item.name}</span>
          <StatusBadge status={item.status} />
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{item.message}</p>
        {item.detail && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/70 font-mono truncate">{item.detail}</p>
        )}
      </div>
      {item.configLink && item.status !== 'ok' && (
        <Link
          href={item.configLink}
          className="shrink-0 text-[10px] font-semibold text-primary hover:underline whitespace-nowrap"
        >
          Configure →
        </Link>
      )}
    </div>
  );
}

function SummaryCard({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div className="rounded-lg bg-card border p-3 text-center">
      <div className={cn('text-2xl font-black', colorClass)}>{count}</div>
      <div className="text-[10px] uppercase text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export default function ApiStatusPage() {
  const [data, setData] = useState<ApiStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/api-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = data?.items.reduce<Record<string, IntegrationItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {}) ?? {};

  const categories = Object.keys(grouped);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Integration &amp; API Status</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live health check of all connected services, API keys, and social logins.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs h-8">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {loading ? 'Checking…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          Failed to load: {error}
        </div>
      )}

      {/* Summary bar */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="OK" count={data.summary.ok ?? 0} colorClass="text-emerald-500" />
          <SummaryCard label="Missing" count={data.summary.missing ?? 0} colorClass="text-amber-500" />
          <SummaryCard label="Error" count={data.summary.error ?? 0} colorClass="text-rose-500" />
          <SummaryCard label="Quota / Off" count={(data.summary.quota ?? 0) + (data.summary.disabled ?? 0)} colorClass="text-orange-500" />
        </div>
      )}

      {/* Quick health banner */}
      {data && (
        <div className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-3',
          (data.summary.error ?? 0) > 0
            ? 'border-rose-500/40 bg-rose-500/8'
            : (data.summary.missing ?? 0) > 0
              ? 'border-amber-500/40 bg-amber-500/8'
              : 'border-emerald-500/40 bg-emerald-500/8',
        )}>
          {(data.summary.error ?? 0) > 0
            ? <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
            : (data.summary.missing ?? 0) > 0
              ? <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              : <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          }
          <div>
            <p className="text-sm font-semibold">
              {(data.summary.error ?? 0) > 0
                ? `${data.summary.error} integration${(data.summary.error ?? 0) > 1 ? 's' : ''} need attention`
                : (data.summary.missing ?? 0) > 0
                  ? `${data.summary.missing} integration${(data.summary.missing ?? 0) > 1 ? 's' : ''} not yet configured`
                  : 'All configured integrations are healthy'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Last checked: {data.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category cards */}
      {!loading || data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat] ?? Wifi;
            const items = grouped[cat];
            const hasIssue = items.some(i => i.status === 'error' || i.status === 'missing');
            const allOk = items.every(i => i.status === 'ok');
            return (
              <Card key={cat} className={cn(
                'border-border/60',
                hasIssue && 'border-amber-500/30',
                allOk && 'border-emerald-500/20',
              )}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <Icon className={cn('h-4 w-4', allOk ? 'text-emerald-500' : hasIssue ? 'text-amber-500' : 'text-muted-foreground')} />
                    {cat}
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                      {items.filter(i => i.status === 'ok').length}/{items.length} ok
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {items.map(item => (
                    <IntegrationCard key={item.id} item={item} />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Footer hint */}
      {data && (
        <p className="text-[11px] text-muted-foreground text-center pb-2">
          Keys are read from environment variables and admin settings. Configure them at{' '}
          <Link href="/admin/settings" className="text-primary hover:underline">Settings → API Keys</Link>.
        </p>
      )}
    </div>
  );
}
