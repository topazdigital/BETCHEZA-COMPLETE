'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Bell, UserPlus, LogIn, CreditCard, Mail, Rss, MousePointerClick,
  FileText, ShieldAlert, TrendingUp, Trash2, CheckCheck, RefreshCw, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AdminEvent, AdminEventType } from '@/lib/admin-events-store';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const EVENT_META: Record<AdminEventType, { icon: React.ElementType; color: string; label: string }> = {
  user_register:        { icon: UserPlus,           color: 'text-blue-500',    label: 'Registration' },
  user_login:           { icon: LogIn,              color: 'text-slate-500',   label: 'Login' },
  payment_received:     { icon: CreditCard,         color: 'text-emerald-500', label: 'Payment' },
  email_sent:           { icon: Mail,               color: 'text-violet-500',  label: 'Email' },
  newsletter_subscribe: { icon: Rss,                color: 'text-sky-500',     label: 'Subscribe' },
  affiliate_click:      { icon: MousePointerClick,  color: 'text-orange-500',  label: 'Affiliate' },
  tipster_application:  { icon: FileText,           color: 'text-amber-500',   label: 'Application' },
  subscription_purchase:{ icon: TrendingUp,         color: 'text-green-500',   label: 'Subscription' },
  tip_posted:           { icon: TrendingUp,         color: 'text-indigo-500',  label: 'Tip' },
  user_banned:          { icon: ShieldAlert,        color: 'text-red-500',     label: 'Ban' },
};

const TYPE_FILTERS: Array<{ value: 'all' | AdminEventType; label: string }> = [
  { value: 'all',                 label: 'All' },
  { value: 'user_register',       label: 'Registrations' },
  { value: 'payment_received',    label: 'Payments' },
  { value: 'affiliate_click',     label: 'Affiliate' },
  { value: 'email_sent',          label: 'Emails' },
  { value: 'newsletter_subscribe',label: 'Subscribers' },
  { value: 'user_login',          label: 'Logins' },
  { value: 'tipster_application', label: 'Applications' },
];

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminAlertsPage() {
  const [filter, setFilter] = useState<'all' | AdminEventType>('all');
  const { data, isLoading, mutate } = useSWR<{ events: AdminEvent[]; unread: number }>(
    `/api/admin/events${filter !== 'all' ? `?type=${filter}` : ''}`,
    fetcher,
    { refreshInterval: 30_000 },
  );

  const events = data?.events ?? [];
  const unread = data?.unread ?? 0;

  async function markRead() {
    await fetch('/api/admin/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read' }) });
    mutate();
  }

  async function clearAll() {
    if (!confirm('Clear all alerts? This cannot be undone.')) return;
    await fetch('/api/admin/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) });
    mutate();
  }

  const countByType = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3 p-3 md:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight">Alerts</h1>
            {unread > 0 && (
              <Badge className="h-5 min-w-5 bg-destructive px-1.5 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Real-time feed of registrations, payments, clicks, and more</p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => mutate()}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          {unread > 0 && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={markRead}>
              <CheckCheck className="h-3 w-3" /> Mark read
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive" onClick={clearAll}>
            <Trash2 className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {([
          { type: 'user_register', label: 'New Users' },
          { type: 'payment_received', label: 'Payments' },
          { type: 'affiliate_click', label: 'Aff. Clicks' },
          { type: 'newsletter_subscribe', label: 'Subscribers' },
          { type: 'tipster_application', label: 'Applications' },
        ] as const).map(({ type, label }) => {
          const meta = EVENT_META[type];
          const Icon = meta.icon;
          return (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? 'all' : type)}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all hover:border-primary/40',
                filter === type ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', meta.color)} />
              <div>
                <div className="text-lg font-bold tabular-nums leading-none">{countByType[type] ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <Filter className="h-3.5 w-3.5 self-center text-muted-foreground" />
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f.label}
            {f.value !== 'all' && countByType[f.value] ? ` · ${countByType[f.value]}` : ''}
          </button>
        ))}
      </div>

      {/* Event feed */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Bell className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No events yet</p>
          <p className="text-xs text-muted-foreground/60">Events will appear here as users interact with the site</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {events.map((ev, i) => {
            const meta = EVENT_META[ev.type] ?? { icon: Bell, color: 'text-muted-foreground', label: ev.type };
            const Icon = meta.icon;
            return (
              <div
                key={ev.id}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 transition-colors',
                  i !== 0 && 'border-t border-border',
                  !ev.read && 'bg-primary/3'
                )}
              >
                <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted', meta.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{ev.title}</span>
                    {!ev.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    <Badge variant="outline" className="ml-auto h-4 px-1 text-[9px]">{meta.label}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{ev.detail}</p>
                  {ev.meta && Object.keys(ev.meta).length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {Object.entries(ev.meta).map(([k, v]) => v != null && (
                        <span key={k} className="text-[10px] text-muted-foreground/70">
                          <span className="font-medium">{k}:</span> {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(ev.ts)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
