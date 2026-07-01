'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { Mail, Download, RefreshCw, CheckCircle2, XCircle, Send, X, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Subscriber {
  id: number | string;
  email: string;
  userId?: number | null;
  source?: string;
  topics?: string[];
  isVerified?: boolean;
  unsubscribedAt?: string | null;
  createdAt?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─── Email Modal ──────────────────────────────────────────────────── */
function EmailModal({
  recipientEmails,
  label,
  onClose,
}: {
  recipientEmails: string[];
  label: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [batchSize, setBatchSize] = useState(50);
  const [delayMin, setDelayMin] = useState(2);
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<'compose' | 'sending' | 'done'>('compose');
  const [progress, setProgress] = useState({ sent: 0, failed: 0, batch: 0, total: 0 });
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBatchRef = useRef<number>(0);

  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  useEffect(() => () => clearTimer(), []);

  async function sendBatch(batchIndex: number, totalSent: number, totalFailed: number) {
    try {
      const start = batchIndex * batchSize;
      const slice = recipientEmails.slice(start, start + batchSize);
      if (slice.length === 0) {
        setPhase('done'); setSending(false); return;
      }
      const res = await fetch('/api/admin/subscribers/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, html: body.replace(/\n/g, '<br>'), emails: slice }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Send failed'); setSending(false); return; }

      const newSent = totalSent + (data.sent || 0);
      const newFailed = totalFailed + (data.failed || 0);
      nextBatchRef.current = batchIndex + 1;
      const nextStart = (batchIndex + 1) * batchSize;
      setProgress({ sent: newSent, failed: newFailed, batch: batchIndex + 1, total: recipientEmails.length });

      if (nextStart >= recipientEmails.length) {
        clearTimer(); setPhase('done'); setSending(false); return;
      }

      let secs = delayMin * 60;
      setCountdown(secs);
      timerRef.current = setInterval(() => {
        secs--;
        setCountdown(secs);
        if (secs <= 0) { clearTimer(); sendBatch(nextBatchRef.current, newSent, newFailed); }
      }, 1000);
    } catch {
      setError('Network error. Please try again.');
      setSending(false);
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) { setError('Subject and message body are required.'); return; }
    setError('');
    setSending(true);
    setPhase('sending');
    setProgress({ sent: 0, failed: 0, batch: 0, total: recipientEmails.length });
    nextBatchRef.current = 0;
    await sendBatch(0, 0, 0);
  }

  const pct = progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-bold">{label}</p>
            <p className="text-[11px] text-muted-foreground">{recipientEmails.length} recipient{recipientEmails.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          {phase === 'compose' && (
            <>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="space-y-1">
                <label className="text-xs font-medium">Subject</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Email subject…"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Message</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={6}
                  placeholder="Write your message here. Newlines become line breaks."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              </div>
              {recipientEmails.length > batchSize && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Batch size</label>
                    <input type="number" min={1} max={200}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Delay between batches (min)</label>
                    <input type="number" min={0} max={60}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={delayMin} onChange={e => setDelayMin(Number(e.target.value))} />
                  </div>
                </div>
              )}
              {recipientEmails.length > batchSize && (
                <p className="text-[10px] text-muted-foreground">
                  Sent in batches of {batchSize} with {delayMin}m delay between each.
                </p>
              )}
            </>
          )}

          {phase === 'sending' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                {countdown > 0 ? (
                  <div className="text-xs text-muted-foreground">Next batch in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Sending batch {progress.batch + 1}…</div>
                )}
              </div>
              <div className="rounded-full bg-muted h-2 overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">{progress.sent} sent · {progress.failed} failed · {progress.total} total</p>
              {countdown > 0 && (
                <Button size="sm" className="w-full h-7 text-xs" variant="secondary"
                  onClick={() => { clearTimer(); sendBatch(nextBatchRef.current, progress.sent, progress.failed); }}>
                  Send next batch now
                </Button>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="py-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold">Done!</p>
              <p className="text-xs text-muted-foreground">{progress.sent} sent · {progress.failed} failed</p>
            </div>
          )}
        </div>

        {(phase === 'compose' || phase === 'done') && (
          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>Close</Button>
            {phase === 'compose' && (
              <Button size="sm" className="h-7 text-xs" onClick={handleSend} disabled={sending}>
                <Send className="mr-1.5 h-3 w-3" /> Send
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface TipsterSub {
  id: number;
  subscriber_name: string;
  subscriber_username: string;
  subscriber_email: string;
  tipster_name: string;
  tipster_username: string;
  price: number;
  currency: string;
  status: string;
  created_at: string;
  expires_at: string;
}

/* ─── Tipster Subscriptions Panel ──────────────────────────────────── */
function TipsterSubscriptionsPanel() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const params = new URLSearchParams({ status: statusFilter });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data, isLoading, mutate } = useSWR<{ subscriptions: TipsterSub[]; total: number }>(
    `/api/admin/tipster-subscriptions?${params}`,
    fetcher,
    { refreshInterval: 30000 },
  );

  const subs = data?.subscriptions ?? [];

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="h-7 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-48"
          placeholder="Search subscriber or tipster…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {['all', 'active', 'expired', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'h-7 rounded-md px-3 text-xs font-medium capitalize border transition-colors',
              statusFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {s}
          </button>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs px-2 ml-auto" onClick={() => mutate()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-8 text-center">Loading…</p>
          ) : subs.length === 0 ? (
            <p className="text-xs text-muted-foreground p-8 text-center">No tipster subscriptions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[11px] uppercase text-muted-foreground border-b bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 font-medium">Subscriber</th>
                    <th className="px-3 py-2 font-medium">Tipster</th>
                    <th className="px-3 py-2 font-medium text-right">Paid</th>
                    <th className="px-3 py-2 font-medium">Subscribed</th>
                    <th className="px-3 py-2 font-medium">Expires</th>
                    <th className="px-3 py-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subs.map(s => {
                    const now = Date.now();
                    const expires = new Date(s.expires_at).getTime();
                    const daysLeft = Math.ceil((expires - now) / 86400000);
                    const isActive = s.status === 'active' && daysLeft > 0;
                    return (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{s.subscriber_name}</div>
                          <div className="text-[10px] text-muted-foreground">@{s.subscriber_username}</div>
                          <div className="text-[10px] text-muted-foreground">{s.subscriber_email}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{s.tipster_name}</div>
                          <div className="text-[10px] text-muted-foreground">@{s.tipster_username}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                          {s.currency} {Number(s.price).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(s.created_at)}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(s.expires_at)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {isActive ? (
                            <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/15 text-emerald-600 border-0">
                              {daysLeft}d left
                            </Badge>
                          ) : s.status === 'cancelled' ? (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Cancelled</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 bg-destructive/10 text-destructive border-0">Expired</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data && data.total > subs.length && (
                <p className="text-[10px] text-muted-foreground text-center py-2">
                  Showing {subs.length} of {data.total} records
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────── */
export default function AdminSubscribersPage() {
  const [tab, setTab] = useState<'newsletter' | 'tipsters'>('newsletter');

  const { data, isLoading, mutate } = useSWR<{ subscribers: Subscriber[] }>(
    '/api/admin/subscribers',
    fetcher,
    { refreshInterval: 60000 }
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailTarget, setEmailTarget] = useState<{ emails: string[]; label: string } | null>(null);

  const subscribers = data?.subscribers ?? [];
  const active = subscribers.filter((s) => !s.unsubscribedAt);
  const unsubscribed = subscribers.filter((s) => s.unsubscribedAt);

  const activeIds = active.map(s => String(s.id));
  const allActiveSelected = activeIds.length > 0 && activeIds.every(id => selected.has(id));
  const someSelected = selected.size > 0 && !allActiveSelected;

  const toggleAll = useCallback(() => {
    if (allActiveSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeIds));
    }
  }, [allActiveSelected, activeIds]);

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedEmails = subscribers
    .filter(s => selected.has(String(s.id)))
    .map(s => s.email);

  function exportCsv() {
    const rows = [
      ['email', 'source', 'verified', 'topics', 'created_at', 'unsubscribed_at'],
      ...subscribers.map((s) => [
        s.email, s.source ?? '', s.isVerified ? 'yes' : 'no',
        (s.topics ?? []).join('|'), s.createdAt ?? '', s.unsubscribedAt ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const activeEmails = active.map(s => s.email);

  return (
    <div className="space-y-3">
      {emailTarget && (
        <EmailModal
          recipientEmails={emailTarget.emails}
          label={emailTarget.label}
          onClose={() => setEmailTarget(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">Subscribers</h1>
          <p className="text-xs text-muted-foreground">Newsletter signups and paid tipster subscriptions.</p>
        </div>
        {tab === 'newsletter' && (
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => mutate()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={exportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" className="h-7 text-xs px-2"
              onClick={() => setEmailTarget({ emails: activeEmails, label: 'Email All Active Subscribers' })}
              disabled={active.length === 0}>
              <Mail className="mr-1.5 h-3.5 w-3.5" /> Email All Active
            </Button>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'newsletter', label: 'Newsletter', icon: <Mail className="h-3.5 w-3.5" /> },
          { key: 'tipsters',   label: 'Tipster Subscriptions', icon: <Users className="h-3.5 w-3.5" /> },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tipster subscriptions panel */}
      {tab === 'tipsters' && <TipsterSubscriptionsPanel />}

      {/* Newsletter section (hidden when tipsters tab active) */}
      {tab === 'newsletter' && <>
      {/* Stats */}
      <div className="grid gap-2.5 md:grid-cols-3">
        <StatItem label="Total" value={subscribers.length} />
        <StatItem label="Active" value={active.length} color="text-emerald-500" />
        <StatItem label="Unsubscribed" value={unsubscribed.length} color="text-muted-foreground" />
      </div>

      {/* Selection banner */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/8 px-3 py-2">
          <span className="text-xs font-semibold text-primary flex-1">{selected.size} subscriber{selected.size !== 1 ? 's' : ''} selected</span>
          <Button size="sm" className="h-6 text-[11px] px-2"
            onClick={() => setEmailTarget({ emails: selectedEmails, label: `Email ${selected.size} selected subscriber${selected.size !== 1 ? 's' : ''}` })}>
            <Mail className="mr-1 h-3 w-3" /> Email selected
          </Button>
          <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="py-2 pb-1.5 px-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4" /> Subscribers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-8 text-center">Loading…</p>
          ) : subscribers.length === 0 ? (
            <p className="text-xs text-muted-foreground p-8 text-center">No subscribers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[11px] uppercase text-muted-foreground border-b bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={allActiveSelected}
                        ref={el => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded cursor-pointer"
                        title="Select all active"
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Topics</th>
                    <th className="px-3 py-2 font-medium">Verified</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subscribers.map((s) => {
                    const sid = String(s.id);
                    const isActive = !s.unsubscribedAt;
                    return (
                      <tr key={sid + s.email}
                        className={cn('hover:bg-muted/30 transition-colors', selected.has(sid) && 'bg-primary/5')}>
                        <td className="px-3 py-1.5">
                          {isActive && (
                            <input type="checkbox" checked={selected.has(sid)} onChange={() => toggleOne(sid)}
                              className="h-3.5 w-3.5 rounded cursor-pointer" />
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-medium">{s.email}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{s.source ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {(s.topics ?? []).map((t) => (
                              <Badge key={t} variant="secondary" className="text-[9px] h-4 px-1.5">{t}</Badge>
                            ))}
                            {(s.topics ?? []).length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          {s.isVerified
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                        </td>
                        <td className="px-3 py-1.5">
                          {s.unsubscribedAt
                            ? <Badge variant="destructive" className="h-4 text-[9px] px-1.5">Unsubscribed</Badge>
                            : <Badge variant="default" className="h-4 text-[9px] px-1.5 bg-emerald-500 hover:bg-emerald-600">Active</Badge>}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                          {s.createdAt ? (
                            <span title={new Date(s.createdAt).toLocaleString()}>
                              {new Date(s.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                              <span className="block text-[10px]">
                                {new Date(s.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          {isActive && (
                            <button
                              className="text-[10px] text-primary hover:underline font-medium"
                              onClick={() => setEmailTarget({ emails: [s.email], label: `Email ${s.email}` })}
                            >
                              Email
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </>}
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase text-muted-foreground leading-none">{label}</p>
        <p className={cn('text-base font-bold mt-1', color)}>{value}</p>
      </CardContent>
    </Card>
  );
}
