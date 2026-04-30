'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpDown, EyeOff, ExternalLink, Loader2, Plus, Save, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface BookmakerRow {
  id: number;
  name: string;
  slug: string;
  logo: string;
  logoUrl?: string;
  affiliateUrl: string;
  bonus: string;
  bonusCode?: string;
  rating: number;
  regions: string[];
  features: string[];
  minDeposit: number;
  paymentMethods: string[];
  pros: string[];
  cons: string[];
  established?: number;
  featured: boolean;
  archived?: boolean;
  sortOrder?: number;
  updatedAt: string;
}

const EMPTY: BookmakerRow = {
  id: 0,
  name: '',
  slug: '',
  logo: '',
  affiliateUrl: '',
  bonus: '',
  rating: 4.0,
  regions: [],
  features: [],
  minDeposit: 10,
  paymentMethods: [],
  pros: [],
  cons: [],
  featured: true,
  updatedAt: '',
};

export default function AdminBookmakersPage() {
  const [rows, setRows] = useState<BookmakerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BookmakerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/bookmakers', { cache: 'no-store' });
      const j = await r.json();
      setRows(j.bookmakers || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function startNew() { setEditing({ ...EMPTY, sortOrder: 1000 }); setError(null); }
  function startEdit(r: BookmakerRow) { setEditing({ ...r }); setError(null); }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const isNew = !editing.id;
      const url = isNew ? '/api/admin/bookmakers' : `/api/admin/bookmakers/${editing.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error || 'Save failed');
      } else {
        setEditing(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this bookmaker? It will be removed from the public list and all affiliate links.')) return;
    await fetch(`/api/admin/bookmakers/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Bookmakers & affiliate links</h1>
          <p className="text-sm text-muted-foreground">
            Manage the bookmakers shown on /bookmakers and the affiliate URLs used in match-detail
            "Bet Now" buttons. The URL field is the link earnings flow through — paste your affiliate tracker.
          </p>
        </div>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" /> Add bookmaker</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map(r => (
            <Card key={r.id} className={r.archived ? 'opacity-60' : ''}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {r.logo}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-xs text-muted-foreground">@{r.slug}</span>
                    {r.featured && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Featured</span>
                    )}
                    {r.archived && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        <EyeOff className="h-3 w-3" /> Archived
                      </span>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">⭐ {r.rating.toFixed(1)}</span>
                  </div>
                  <a
                    href={r.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {r.affiliateUrl} <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {r.bonus} {r.bonusCode && <span>· code <strong>{r.bonusCode}</strong></span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit drawer (inline modal) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-xl bg-background p-5 shadow-2xl sm:rounded-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? `Edit ${editing.name}` : 'New bookmaker'}</h2>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Close</Button>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name *">
                  <Input value={editing.name} onChange={(e) => setEditing(s => s && { ...s, name: e.target.value })} />
                </Field>
                <Field label="Slug *">
                  <Input value={editing.slug} onChange={(e) => setEditing(s => s && { ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
                </Field>
              </div>

              <Field label="Affiliate URL *">
                <Input
                  placeholder="https://affiliate-network.com/clk/12345"
                  value={editing.affiliateUrl}
                  onChange={(e) => setEditing(s => s && { ...s, affiliateUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">All "Bet Now" buttons across Betcheza will route through this URL.</p>
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Logo initials"><Input maxLength={4} value={editing.logo} onChange={(e) => setEditing(s => s && { ...s, logo: e.target.value.toUpperCase() })} /></Field>
                <Field label="Rating (0–5)"><Input type="number" step="0.1" min="0" max="5" value={editing.rating} onChange={(e) => setEditing(s => s && { ...s, rating: Number(e.target.value) })} /></Field>
                <Field label="Min deposit"><Input type="number" min="0" value={editing.minDeposit} onChange={(e) => setEditing(s => s && { ...s, minDeposit: Number(e.target.value) })} /></Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Bonus"><Input value={editing.bonus} onChange={(e) => setEditing(s => s && { ...s, bonus: e.target.value })} /></Field>
                <Field label="Bonus code"><Input value={editing.bonusCode || ''} onChange={(e) => setEditing(s => s && { ...s, bonusCode: e.target.value })} /></Field>
              </div>

              <Field label="Logo image URL (optional)">
                <Input value={editing.logoUrl || ''} onChange={(e) => setEditing(s => s && { ...s, logoUrl: e.target.value })} />
              </Field>

              <Field label="Regions (comma-separated, e.g. KE, NG, UK)">
                <Input value={editing.regions.join(', ')} onChange={(e) => setEditing(s => s && { ...s, regions: e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean) })} />
              </Field>
              <Field label="Features (comma-separated)">
                <Input value={editing.features.join(', ')} onChange={(e) => setEditing(s => s && { ...s, features: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
              </Field>
              <Field label="Payment methods (comma-separated)">
                <Input value={editing.paymentMethods.join(', ')} onChange={(e) => setEditing(s => s && { ...s, paymentMethods: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
              </Field>
              <Field label="Pros (one per line)">
                <Textarea rows={2} value={editing.pros.join('\n')} onChange={(e) => setEditing(s => s && { ...s, pros: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} />
              </Field>
              <Field label="Cons (one per line)">
                <Textarea rows={2} value={editing.cons.join('\n')} onChange={(e) => setEditing(s => s && { ...s, cons: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Established (year)"><Input type="number" value={editing.established || ''} onChange={(e) => setEditing(s => s && { ...s, established: Number(e.target.value) || undefined })} /></Field>
                <Field label={<>Sort order <ArrowUpDown className="ml-1 inline h-3 w-3" /></>}>
                  <Input type="number" value={editing.sortOrder ?? 100} onChange={(e) => setEditing(s => s && { ...s, sortOrder: Number(e.target.value) })} />
                </Field>
                <div />
              </div>

              <label className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <div className="text-sm font-semibold">Featured</div>
                  <p className="text-xs text-muted-foreground">Pinned to the top of the public list and shown in match-detail Bet Now buttons.</p>
                </div>
                <Switch checked={editing.featured} onCheckedChange={(v) => setEditing(s => s && { ...s, featured: !!v })} />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <div className="text-sm font-semibold">Archived</div>
                  <p className="text-xs text-muted-foreground">Hidden from the public list but kept in the admin store.</p>
                </div>
                <Switch checked={!!editing.archived} onCheckedChange={(v) => setEditing(s => s && { ...s, archived: !!v })} />
              </label>

              {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
