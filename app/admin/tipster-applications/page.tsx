'use client';

import { useEffect, useState } from 'react';
import {
  BadgeCheck, CheckCircle2, Clock, Loader2, XCircle,
  Mail, RefreshCw, Sparkles, Search, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface AdminApplication {
  id: string;
  userId: number;
  username: string;
  displayName: string;
  email?: string;
  pitch: string;
  specialties: string;
  experience?: string;
  socialProof?: string;
  requestVerified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewerNote?: string;
  verifiedGranted?: boolean;
}

interface ApiResp {
  applications: AdminApplication[];
  stats: { pending: number; approved: number; rejected: number; total: number };
}

interface Toast { id: number; msg: string; type: 'success' | 'error' }

export default function AdminTipsterApplicationsPage() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [grantVerified, setGrantVerified] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(msg: string, type: 'success' | 'error' = 'success') {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/tipster-applications', { cache: 'no-store' });
      const json = (await r.json()) as ApiResp;
      setData(json);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function review(app: AdminApplication, decision: 'approve' | 'reject') {
    setBusyId(app.id);
    try {
      const r = await fetch(`/api/admin/tipster-applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          note: notes[app.id] || undefined,
          grantVerified: decision === 'approve' && (grantVerified[app.id] ?? app.requestVerified),
        }),
      });
      if (r.ok) {
        if (decision === 'approve') {
          addToast(
            app.email
              ? `✅ ${app.displayName} promoted to tipster — confirmation email sent to ${app.email}`
              : `✅ ${app.displayName} promoted to tipster`,
            'success'
          );
        } else {
          addToast(`${app.displayName}'s application rejected${app.email ? ' — notification sent' : ''}.`, 'error');
        }
        await load();
      } else {
        const e = await r.json().catch(() => ({}));
        addToast(e?.error || 'Action failed', 'error');
      }
    } finally {
      setBusyId(null);
    }
  }

  const filtered = (data?.applications || []).filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        a.displayName.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        a.pitch.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg text-xs font-medium max-w-xs pointer-events-auto',
              t.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-950 text-emerald-300'
                : 'border-red-500/30 bg-red-950 text-red-300'
            )}
          >
            {t.type === 'success'
              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
              : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
            }
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Tipster Applications</h1>
          <p className="text-xs text-muted-foreground">Review and promote users to the tipster role.</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 self-start sm:self-auto" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, username, or email…"
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Total" value={data.stats.total} />
          <StatTile label="Pending" value={data.stats.pending} tone="warning" />
          <StatTile label="Approved" value={data.stats.approved} tone="success" />
          <StatTile label="Rejected" value={data.stats.rejected} tone="destructive" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="h-7 text-xs capitalize px-3"
          >
            {f}
            {data && f !== 'all' && (
              <span className="ml-1.5 rounded-full bg-current/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                {data.stats[f]}
              </span>
            )}
          </Button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No applications in this filter.
          </CardContent>
        </Card>
      )}

      {!loading && filtered.map(app => (
        <Card key={app.id} className={cn(
          'overflow-hidden',
          app.status === 'approved' && 'border-emerald-500/20',
          app.status === 'rejected' && 'border-red-500/20 opacity-75',
        )}>
          {/* Card header */}
          <div className="flex items-start justify-between gap-3 border-b px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                {app.displayName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">
                  {app.displayName}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">@{app.username}</span>
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {app.email && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Mail className="h-3 w-3" />{app.email}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <StatusBadge status={app.status} verifiedGranted={app.verifiedGranted} />
          </div>

          <div className="p-3 space-y-2.5">
            {/* Fields */}
            <Field label="Pitch" value={app.pitch} />
            <Field label="Specialties" value={app.specialties} />
            {app.experience && <Field label="Experience" value={app.experience} />}
            {app.socialProof && <Field label="Social proof" value={app.socialProof} />}

            {app.requestVerified && app.status === 'pending' && (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Applicant has requested the verified badge.
              </div>
            )}

            {app.reviewerNote && app.status !== 'pending' && (
              <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Reviewer note</p>
                <p className="text-xs whitespace-pre-wrap">{app.reviewerNote}</p>
              </div>
            )}

            {app.status === 'approved' && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Approved{app.verifiedGranted ? ' with verified badge' : ''} · role updated in DB
                {app.email && <span className="ml-1 opacity-70">· email sent</span>}
              </div>
            )}

            {/* Pending actions */}
            {app.status === 'pending' && (
              <div className="space-y-2.5 rounded-md border border-border bg-muted/20 p-2.5">
                <Textarea
                  rows={2}
                  className="text-xs resize-none"
                  placeholder="Optional note to applicant (included in email)…"
                  value={notes[app.id] || ''}
                  onChange={(e) => setNotes(s => ({ ...s, [app.id]: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <Checkbox
                    checked={grantVerified[app.id] ?? app.requestVerified}
                    onCheckedChange={(v) => setGrantVerified(s => ({ ...s, [app.id]: !!v }))}
                  />
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Grant verified badge on approval
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => review(app, 'approve')}
                    disabled={busyId === app.id}
                  >
                    {busyId === app.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle2 className="h-3.5 w-3.5" />
                    }
                    Approve & promote
                    {app.email && <Mail className="h-3 w-3 opacity-60" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/10"
                    onClick={() => review(app, 'reject')}
                    disabled={busyId === app.id}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
                {app.email && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    A notification email will be sent to {app.email}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className="whitespace-pre-wrap text-xs leading-relaxed">{value}</p>
    </div>
  );
}

function StatTile({ label, value, tone = 'muted' }: {
  label: string; value: number;
  tone?: 'muted' | 'success' | 'warning' | 'destructive'
}) {
  const valueClass =
    tone === 'success' ? 'text-emerald-500' :
    tone === 'warning' ? 'text-amber-500' :
    tone === 'destructive' ? 'text-red-500' :
    'text-foreground';
  return (
    <Card>
      <CardContent className="p-2.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn('text-xl font-bold tabular-nums mt-0.5', valueClass)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, verifiedGranted }: { status: string; verifiedGranted?: boolean }) {
  const cls =
    status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
    status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  const Icon = status === 'approved' ? CheckCircle2 : status === 'rejected' ? XCircle : Clock;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
        cls
      )}>
        <Icon className="h-3 w-3" /> {status}
      </span>
      {verifiedGranted && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
          <BadgeCheck className="h-3 w-3" /> VERIFIED
        </span>
      )}
    </div>
  );
}
