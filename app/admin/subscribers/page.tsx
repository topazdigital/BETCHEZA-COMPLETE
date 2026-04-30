'use client';

import useSWR from 'swr';
import { Mail, Download, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
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

export default function AdminSubscribersPage() {
  const { data, isLoading, mutate } = useSWR<{ subscribers: Subscriber[] }>(
    '/api/admin/subscribers',
    fetcher,
    { refreshInterval: 60000 }
  );

  const subscribers = data?.subscribers ?? [];
  const active = subscribers.filter((s) => !s.unsubscribedAt);
  const unsubscribed = subscribers.filter((s) => s.unsubscribedAt);

  function exportCsv() {
    const rows = [
      ['email', 'source', 'verified', 'topics', 'created_at', 'unsubscribed_at'],
      ...subscribers.map((s) => [
        s.email,
        s.source ?? '',
        s.isVerified ? 'yes' : 'no',
        (s.topics ?? []).join('|'),
        s.createdAt ?? '',
        s.unsubscribedAt ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Email Subscribers</h1>
          <p className="text-xs text-muted-foreground">
            Newsletter signups and event notification opt-ins.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => mutate()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" className="h-7 text-xs px-2" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-3">
        <StatItem label="Total" value={subscribers.length} />
        <StatItem label="Active" value={active.length} color="text-emerald-500" />
        <StatItem label="Unsubscribed" value={unsubscribed.length} color="text-muted-foreground" />
      </div>

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
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Topics</th>
                    <th className="px-3 py-2 font-medium">Verified</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subscribers.map((s) => (
                    <tr key={String(s.id) + s.email} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-1.5 font-medium">{s.email}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{s.source ?? '—'}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(s.topics ?? []).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[9px] h-4 px-1.5">
                              {t}
                            </Badge>
                          ))}
                          {(s.topics ?? []).length === 0 && (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        {s.isVerified ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {s.unsubscribedAt ? (
                          <Badge variant="destructive" className="h-4 text-[9px] px-1.5">Unsubscribed</Badge>
                        ) : (
                          <Badge variant="default" className="h-4 text-[9px] px-1.5 bg-emerald-500 hover:bg-emerald-600">Active</Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase text-muted-foreground leading-none">{label}</p>
        <p className={cn("text-xl font-bold mt-1", color)}>{value}</p>
      </CardContent>
    </Card>
  )
}
