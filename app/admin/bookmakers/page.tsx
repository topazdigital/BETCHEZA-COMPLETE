'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import {
  ArrowUpDown, EyeOff, ExternalLink, Loader2, Plus, Save, Star, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  id: 0, name: '', slug: '', logo: '', affiliateUrl: '', bonus: '',
  rating: 4.0, regions: [], features: [], minDeposit: 10,
  paymentMethods: [], pros: [], cons: [], featured: true, updatedAt: '',
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
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function startNew() { setEditing({ ...EMPTY, sortOrder: 1000 }); setError(null); }
  function startEdit(r: BookmakerRow) { setEditing({ ...r }); setError(null); }

  async function save() {
    if (!editing) return;
    setSaving(true); setError(null);
    try {
      const isNew = !editing.id;
      const url = isNew ? '/api/admin/bookmakers' : `/api/admin/bookmakers/${editing.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      const j = await r.json();
      if (!r.ok) { setError(j?.error || 'Save failed'); }
      else { setEditing(null); await load(); }
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this bookmaker?')) return;
    await fetch(`/api/admin/bookmakers/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-3 p-3 md:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Bookmakers & affiliate links</h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
            The affiliate URL you paste here powers every "Bet Now" / "Sign Up" button across the whole site — odds strips, tips, jackpots, and the public bookmakers page.
          </p>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add bookmaker
        </Button>
      </div>

      {/* Compact grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(r => (
            <div
              key={r.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30',
                r.archived && 'opacity-50'
              )}
            >
              {/* Logo */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {r.logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={r.logoUrl} alt={r.name} className="h-8 w-8 object-contain rounded" />
                  : r.logo}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-sm font-semibold">{r.name}</span>
                  {r.featured && (
                    <Badge className="h-3.5 px-1 text-[8px] bg-primary/15 text-primary hover:bg-primary/15">
                      Featured
                    </Badge>
                  )}
                  {r.archived && (
                    <Badge variant="secondary" className="h-3.5 px-1 text-[8px]">
                      <EyeOff className="mr-0.5 h-2.5 w-2.5" />Hidden
                    </Badge>
                  )}
                  <span className="flex items-center text-[10px] text-muted-foreground ml-auto">
                    <Star className="h-2.5 w-2.5 fill-warning text-warning mr-0.5" />
                    {r.rating.toFixed(1)}
                  </span>
                </div>
                <a
                  href={r.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 flex items-center gap-0.5 text-[10px] text-primary hover:underline truncate max-w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{r.affiliateUrl || <em className="text-muted-foreground">No affiliate URL set</em>}</span>
                </a>
                {r.bonus && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{r.bonus}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => startEdit(r)}>Edit</Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => remove(r.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-background p-4 shadow-2xl sm:rounded-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">{editing.id ? `Edit ${editing.name}` : 'New bookmaker'}</h2>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>✕</Button>
            </div>

            <div className="grid gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <F label="Name *">
                  <Input className="h-8 text-xs" value={editing.name} onChange={e => setEditing(s => s && { ...s, name: e.target.value })} />
                </F>
                <F label="Slug *">
                  <Input className="h-8 text-xs" value={editing.slug} onChange={e => setEditing(s => s && { ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
                </F>
              </div>

              <F label="Affiliate URL *">
                <Input
                  className="h-8 text-xs font-mono"
                  placeholder="https://affiliate-network.com/clk/12345"
                  value={editing.affiliateUrl}
                  onChange={e => setEditing(s => s && { ...s, affiliateUrl: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">All "Bet Now" / "Sign Up" buttons site-wide route through this URL.</p>
              </F>

              <div className="grid grid-cols-3 gap-2.5">
                <F label="Logo text">
                  <Input className="h-8 text-xs" maxLength={4} value={editing.logo} onChange={e => setEditing(s => s && { ...s, logo: e.target.value.toUpperCase() })} />
                </F>
                <F label="Rating (0–5)">
                  <Input className="h-8 text-xs" type="number" step="0.1" min="0" max="5" value={editing.rating} onChange={e => setEditing(s => s && { ...s, rating: Number(e.target.value) })} />
                </F>
                <F label="Min deposit">
                  <Input className="h-8 text-xs" type="number" min="0" value={editing.minDeposit} onChange={e => setEditing(s => s && { ...s, minDeposit: Number(e.target.value) })} />
                </F>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <F label="Bonus text">
                  <Input className="h-8 text-xs" value={editing.bonus} onChange={e => setEditing(s => s && { ...s, bonus: e.target.value })} />
                </F>
                <F label="Bonus code">
                  <Input className="h-8 text-xs" value={editing.bonusCode || ''} onChange={e => setEditing(s => s && { ...s, bonusCode: e.target.value })} />
                </F>
              </div>

              <F label="Logo image URL (optional)">
                <Input className="h-8 text-xs" value={editing.logoUrl || ''} onChange={e => setEditing(s => s && { ...s, logoUrl: e.target.value })} />
              </F>

              <div className="grid grid-cols-2 gap-2.5">
                <F label="Regions (e.g. KE, NG, UK)">
                  <Input className="h-8 text-xs" value={editing.regions.join(', ')} onChange={e => setEditing(s => s && { ...s, regions: e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean) })} />
                </F>
                <F label="Established year">
                  <Input className="h-8 text-xs" type="number" value={editing.established || ''} onChange={e => setEditing(s => s && { ...s, established: Number(e.target.value) || undefined })} />
                </F>
              </div>

              <F label="Features (comma-separated)">
                <Input className="h-8 text-xs" value={editing.features.join(', ')} onChange={e => setEditing(s => s && { ...s, features: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
              </F>
              <F label="Payment methods (comma-separated)">
                <Input className="h-8 text-xs" value={editing.paymentMethods.join(', ')} onChange={e => setEditing(s => s && { ...s, paymentMethods: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
              </F>

              <div className="grid grid-cols-2 gap-2.5">
                <F label="Pros (one per line)">
                  <Textarea className="text-xs" rows={2} value={editing.pros.join('\n')} onChange={e => setEditing(s => s && { ...s, pros: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} />
                </F>
                <F label="Cons (one per line)">
                  <Textarea className="text-xs" rows={2} value={editing.cons.join('\n')} onChange={e => setEditing(s => s && { ...s, cons: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} />
                </F>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <F label={<>Sort order <ArrowUpDown className="ml-1 inline h-3 w-3" /></>}>
                  <Input className="h-8 text-xs" type="number" value={editing.sortOrder ?? 100} onChange={e => setEditing(s => s && { ...s, sortOrder: Number(e.target.value) })} />
                </F>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Toggle
                  label="Featured"
                  desc="Shown in match Bet Now buttons"
                  checked={editing.featured}
                  onChange={v => setEditing(s => s && { ...s, featured: v })}
                />
                <Toggle
                  label="Archived"
                  desc="Hidden from public list"
                  checked={!!editing.archived}
                  onChange={v => setEditing(s => s && { ...s, archived: v })}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">{error}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
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

function F({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 p-2.5 gap-2">
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
