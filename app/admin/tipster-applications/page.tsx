'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

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

export default function AdminTipsterApplicationsPage() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [grantVerified, setGrantVerified] = useState<Record<string, boolean>>({});

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
        await load();
      } else {
        const e = await r.json().catch(() => ({}));
        alert(e?.error || 'Action failed');
      }
    } finally {
      setBusyId(null);
    }
  }

  const filtered = data?.applications.filter(a => filter === 'all' || a.status === filter) || [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Tipster applications</h1>
          <p className="text-sm text-muted-foreground">
            Review applications and promote users to the tipster role.
          </p>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatTile label="Total" value={data.stats.total} />
          <StatTile label="Pending" value={data.stats.pending} tone="warning" />
          <StatTile label="Approved" value={data.stats.approved} tone="success" />
          <StatTile label="Rejected" value={data.stats.rejected} tone="destructive" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No applications in this filter.
          </CardContent>
        </Card>
      )}

      {!loading && filtered.map(app => (
        <Card key={app.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-base">
                {app.displayName}{' '}
                <span className="text-sm font-normal text-muted-foreground">@{app.username}</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {app.email && <span>{app.email} · </span>}
                Submitted {new Date(app.createdAt).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={app.status} verifiedGranted={app.verifiedGranted} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Pitch" value={app.pitch} />
            <Field label="Specialties" value={app.specialties} />
            {app.experience && <Field label="Experience" value={app.experience} />}
            {app.socialProof && <Field label="Social proof" value={app.socialProof} />}

            {app.requestVerified && app.status === 'pending' && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-primary">
                Applicant has requested the verified badge.
              </div>
            )}
            {app.reviewerNote && app.status !== 'pending' && (
              <Field label="Reviewer note" value={app.reviewerNote} />
            )}

            {app.status === 'pending' && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <Textarea
                  rows={2}
                  placeholder="Optional reviewer note (visible to applicant)…"
                  value={notes[app.id] || ''}
                  onChange={(e) => setNotes(s => ({ ...s, [app.id]: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={grantVerified[app.id] ?? app.requestVerified}
                    onCheckedChange={(v) => setGrantVerified(s => ({ ...s, [app.id]: !!v }))}
                  />
                  Grant verified badge on approval
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => review(app, 'approve')}
                    disabled={busyId === app.id}
                  >
                    {busyId === app.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Approve & promote to tipster
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => review(app, 'reject')}
                    disabled={busyId === app.id}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function StatTile({ label, value, tone = 'muted' }: { label: string; value: number; tone?: 'muted' | 'success' | 'warning' | 'destructive' }) {
  const toneClass =
    tone === 'success' ? 'text-success' :
    tone === 'warning' ? 'text-warning' :
    tone === 'destructive' ? 'text-destructive' :
    'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, verifiedGranted }: { status: string; verifiedGranted?: boolean }) {
  const cls =
    status === 'approved' ? 'bg-success/10 text-success' :
    status === 'rejected' ? 'bg-destructive/10 text-destructive' :
    'bg-warning/10 text-warning';
  const Icon = status === 'approved' ? CheckCircle2 : status === 'rejected' ? XCircle : Clock;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${cls}`}>
        <Icon className="h-3 w-3" /> {status}
      </span>
      {verifiedGranted && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          <BadgeCheck className="h-3 w-3" /> VERIFIED
        </span>
      )}
    </div>
  );
}
