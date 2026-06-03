'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Edit2, ImageIcon, ArrowUp, ArrowDown,
  Check, X, GripVertical, Eye, EyeOff, ExternalLink,
} from 'lucide-react';
import type { Banner } from '@/lib/banner-store';

const GRADIENTS = [
  { label: 'Amber → Orange', value: 'from-amber-500 to-orange-600' },
  { label: 'Blue → Indigo', value: 'from-blue-600 to-indigo-700' },
  { label: 'Emerald → Teal', value: 'from-emerald-500 to-teal-600' },
  { label: 'Purple → Pink', value: 'from-purple-600 to-pink-600' },
  { label: 'Red → Rose', value: 'from-red-500 to-rose-600' },
  { label: 'Cyan → Blue', value: 'from-cyan-500 to-blue-600' },
  { label: 'Lime → Green', value: 'from-lime-500 to-green-600' },
  { label: 'Fuchsia → Purple', value: 'from-fuchsia-500 to-purple-700' },
];

const SECTIONS = [
  { label: '🏆 Competitions', value: 'competitions' },
  { label: '📊 Daily Tips', value: 'daily-tips' },
  { label: '⭐ General', value: 'general' },
];

const POSITIONS = [
  { label: 'Sidebar + Mobile', value: 'both' },
  { label: 'Sidebar Only', value: 'sidebar' },
  { label: 'Mobile Only', value: 'mobile' },
];

const EMPTY_FORM: Omit<Banner, 'id' | 'order'> = {
  title: '',
  description: '',
  imageUrl: '',
  linkUrl: '/',
  active: true,
  section: 'general',
  position: 'both',
  gradient: 'from-blue-600 to-indigo-700',
  ctaText: 'Learn More',
};

function BannerPreview({ banner }: { banner: Partial<Banner> }) {
  const gradient = banner.gradient ?? 'from-blue-600 to-indigo-700';
  const hasImage = !!banner.imageUrl;
  return (
    <div className={cn(
      'relative h-28 w-full overflow-hidden rounded-xl border border-white/10',
      !hasImage && `bg-gradient-to-br ${gradient}`,
    )}>
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {hasImage && <div className="absolute inset-0 bg-black/45" />}
      {!hasImage && (
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_white_0%,_transparent_60%)]" />
      )}
      <div className="absolute inset-0 flex flex-col justify-between p-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-0.5">
            {banner.section === 'competitions' ? '🏆 Competition'
              : banner.section === 'daily-tips' ? '📊 Daily Tips'
              : '⭐ Featured'}
          </p>
          <h3 className="text-sm font-bold text-white leading-tight">{banner.title || 'Banner Title'}</h3>
          <p className="mt-0.5 text-[11px] text-white/80 line-clamp-2 leading-snug">
            {banner.description || 'Banner description goes here.'}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm border border-white/30 px-2.5 py-1 text-xs text-white font-semibold w-fit">
          {banner.ctaText || 'Learn More'} →
        </span>
      </div>
    </div>
  );
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Banner, 'id' | 'order'>>(EMPTY_FORM);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Omit<Banner, 'id' | 'order'>>(EMPTY_FORM);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const addFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/banners')
      .then((r) => r.json())
      .then((data) => { setBanners(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function save(updated: Banner[]) {
    setSaving(true);
    try {
      await fetch('/api/admin/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setBanners(updated);
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File, folder = 'banners'): Promise<string | null> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url as string;
  }

  async function handleEditUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId('edit');
    const url = await uploadImage(file);
    if (url) setForm((f) => ({ ...f, imageUrl: url }));
    setUploadingId(null);
    e.target.value = '';
  }

  async function handleAddUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId('add');
    const url = await uploadImage(file);
    if (url) setAddForm((f) => ({ ...f, imageUrl: url }));
    setUploadingId(null);
    e.target.value = '';
  }

  function startEdit(banner: Banner) {
    setEditingId(banner.id);
    setForm({
      title: banner.title, description: banner.description,
      imageUrl: banner.imageUrl, linkUrl: banner.linkUrl,
      active: banner.active, section: banner.section,
      position: banner.position, gradient: banner.gradient,
      ctaText: banner.ctaText,
    });
    setShowAdd(false);
  }

  function cancelEdit() { setEditingId(null); }

  function applyEdit() {
    const updated = banners.map((b) =>
      b.id === editingId ? { ...b, ...form } : b,
    );
    save(updated);
    setEditingId(null);
  }

  async function addBanner() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const created = await res.json();
      setBanners((prev) => [...prev, created]);
      setAddForm(EMPTY_FORM);
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBanner(id: string) {
    if (!confirm('Delete this banner?')) return;
    const updated = banners.filter((b) => b.id !== id);
    await save(updated);
    await fetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' });
  }

  function toggleActive(id: string) {
    const updated = banners.map((b) => b.id === id ? { ...b, active: !b.active } : b);
    save(updated);
  }

  function move(id: string, dir: -1 | 1) {
    const idx = banners.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= banners.length) return;
    const updated = [...banners];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    save(updated.map((b, i) => ({ ...b, order: i })));
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Site Banners</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage promotional banners shown on the homepage sidebar and mobile strip.
          </p>
        </div>
        <Button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); }}
          size="sm"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Banner
        </Button>
      </div>

      {/* Add Banner Form */}
      {showAdd && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="font-semibold text-sm">New Banner</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <FormField label="Title">
                <Input value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} placeholder="Win KES 50,000" />
              </FormField>
              <FormField label="Description">
                <Input value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description…" />
              </FormField>
              <FormField label="Link URL">
                <Input value={addForm.linkUrl} onChange={(e) => setAddForm((f) => ({ ...f, linkUrl: e.target.value }))} placeholder="/competitions" />
              </FormField>
              <FormField label="CTA Button Text">
                <Input value={addForm.ctaText} onChange={(e) => setAddForm((f) => ({ ...f, ctaText: e.target.value }))} placeholder="Enter Now" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Section">
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={addForm.section}
                    onChange={(e) => setAddForm((f) => ({ ...f, section: e.target.value as Banner['section'] }))}
                  >
                    {SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </FormField>
                <FormField label="Display On">
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={addForm.position}
                    onChange={(e) => setAddForm((f) => ({ ...f, position: e.target.value as Banner['position'] }))}
                  >
                    {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Background Gradient (if no image)">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={addForm.gradient}
                  onChange={(e) => setAddForm((f) => ({ ...f, gradient: e.target.value }))}
                >
                  {GRADIENTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </FormField>
              <FormField label="Banner Image (optional, replaces gradient)">
                <div className="flex items-center gap-2">
                  <Input
                    value={addForm.imageUrl}
                    onChange={(e) => setAddForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="/uploads/banners/…"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => addFileRef.current?.click()} disabled={uploadingId === 'add'}>
                    <ImageIcon className="h-3.5 w-3.5" />
                  </Button>
                  <input ref={addFileRef} type="file" accept="image/*" className="hidden" onChange={handleAddUpload} />
                </div>
              </FormField>
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <BannerPreview banner={addForm} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={addBanner} size="sm" disabled={saving || !addForm.title}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> Create Banner
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Banner List */}
      {banners.length === 0 && !showAdd && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">No banners yet. Click <strong>Add Banner</strong> to create your first one.</p>
        </div>
      )}

      <div className="space-y-3">
        {banners.map((banner, idx) => (
          <div key={banner.id} className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Banner row */}
            <div className="flex items-center gap-3 p-3">
              {/* Order controls */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => move(banner.id, -1)}
                  disabled={idx === 0 || saving}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
                <button
                  onClick={() => move(banner.id, 1)}
                  disabled={idx === banners.length - 1 || saving}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Mini preview */}
              <div className={cn(
                'relative h-14 w-24 shrink-0 rounded-lg overflow-hidden',
                !banner.imageUrl && `bg-gradient-to-br ${banner.gradient}`,
              )}>
                {banner.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {banner.imageUrl && <div className="absolute inset-0 bg-black/40" />}
                <div className="absolute inset-0 flex items-end p-1.5">
                  <span className="text-[9px] font-bold text-white leading-tight line-clamp-2">
                    {banner.title}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold truncate">{banner.title}</span>
                  <Badge variant={banner.active ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                    {banner.active ? 'Live' : 'Hidden'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {banner.position === 'both' ? 'All' : banner.position}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{banner.description}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground/70 truncate">{banner.linkUrl}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleActive(banner.id)}
                  className={cn(
                    'rounded-full p-1.5 transition-colors',
                    banner.active
                      ? 'text-green-500 hover:bg-green-500/10'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                  title={banner.active ? 'Hide banner' : 'Show banner'}
                >
                  {banner.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => editingId === banner.id ? cancelEdit() : startEdit(banner)}
                  className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit banner"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteBanner(banner.id)}
                  className="rounded-full p-1.5 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete banner"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Edit form (inline) */}
            {editingId === banner.id && (
              <div className="border-t border-border bg-muted/20 p-4 space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Banner</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <FormField label="Title">
                      <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    </FormField>
                    <FormField label="Description">
                      <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                    </FormField>
                    <FormField label="Link URL">
                      <Input value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} />
                    </FormField>
                    <FormField label="CTA Button Text">
                      <Input value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Section">
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={form.section}
                          onChange={(e) => setForm((f) => ({ ...f, section: e.target.value as Banner['section'] }))}
                        >
                          {SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Display On">
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={form.position}
                          onChange={(e) => setForm((f) => ({ ...f, position: e.target.value as Banner['position'] }))}
                        >
                          {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </FormField>
                    </div>
                    <FormField label="Background Gradient">
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.gradient}
                        onChange={(e) => setForm((f) => ({ ...f, gradient: e.target.value }))}
                      >
                        {GRADIENTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Banner Image">
                      <div className="flex items-center gap-2">
                        <Input
                          value={form.imageUrl}
                          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                          placeholder="/uploads/banners/…"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => editFileRef.current?.click()}
                          disabled={uploadingId === 'edit'}
                        >
                          {uploadingId === 'edit' ? '…' : <ImageIcon className="h-3.5 w-3.5" />}
                        </Button>
                        <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={handleEditUpload} />
                      </div>
                      {form.imageUrl && (
                        <button
                          type="button"
                          className="mt-1 text-[11px] text-destructive hover:underline"
                          onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                        >
                          Remove image (use gradient instead)
                        </button>
                      )}
                    </FormField>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Live Preview</Label>
                    <BannerPreview banner={form} />
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={form.active}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                        id="edit-active"
                      />
                      <Label htmlFor="edit-active" className="text-sm cursor-pointer">
                        {form.active ? 'Visible on site' : 'Hidden from site'}
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button onClick={applyEdit} size="sm" disabled={saving || !form.title}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Save Changes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {banners.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {banners.filter((b) => b.active).length} of {banners.length} banners active · changes save immediately
        </p>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
