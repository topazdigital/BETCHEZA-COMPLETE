'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Loader2, Save, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface Room {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  postCount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const EMPTY: Omit<Room, 'id' | 'postCount' | 'createdAt'> = {
  name: '', slug: '', description: '', icon: '💬',
  color: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  sortOrder: 10, isActive: true,
};

const COLOR_PRESETS = [
  { label: 'Blue',   value: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  { label: 'Green',  value: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  { label: 'Amber',  value: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  { label: 'Red',    value: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
  { label: 'Purple', value: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  { label: 'Orange', value: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  { label: 'Yellow', value: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
  { label: 'Pink',   value: 'bg-pink-500/15 text-pink-500 border-pink-500/30' },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/rooms', { cache: 'no-store' });
      const j = await r.json();
      setRooms(j.rooms || []);
    } catch { setError('Failed to load rooms'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function startNew() {
    setEditing({ ...EMPTY, id: 0, postCount: 0, createdAt: '' });
    setIsNew(true);
    setError(null);
  }

  function startEdit(room: Room) {
    setEditing({ ...room });
    setIsNew(false);
    setError(null);
  }

  function cancelEdit() { setEditing(null); setError(null); }

  function handleNameChange(name: string) {
    setEditing(prev => {
      if (!prev) return prev;
      const shouldAutoSlug = isNew || prev.slug === slugify(prev.name ?? '');
      return { ...prev, name, slug: shouldAutoSlug ? slugify(name) : prev.slug };
    });
  }

  async function save() {
    if (!editing?.name || !editing?.slug) { setError('Name and slug are required'); return; }
    setSaving(true);
    setError(null);
    try {
      const url = isNew ? '/api/admin/rooms' : `/api/admin/rooms/${editing.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name, slug: editing.slug,
          description: editing.description || null,
          icon: editing.icon || null,
          color: editing.color || null,
          sortOrder: editing.sortOrder ?? 10,
          isActive: editing.isActive !== false,
        }),
      });
      if (!r.ok) { const j = await r.json(); setError(j.error || 'Failed to save'); return; }
      setEditing(null);
      await load();
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this room permanently? Posts in this room will not be deleted but will no longer be grouped.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/rooms/${id}`, { method: 'DELETE' });
      setRooms(prev => prev.filter(r => r.id !== id));
    } finally { setDeletingId(null); }
  }

  async function toggleActive(room: Room) {
    await fetch(`/api/admin/rooms/${room.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...room, isActive: !room.isActive }),
    });
    setRooms(prev => prev.map(r => r.id === room.id ? { ...r, isActive: !r.isActive } : r));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Community Rooms</h1>
          <p className="text-xs text-muted-foreground">Manage topic channels shown on the Community Feed sidebar</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" size="sm" className="h-7 text-xs px-2.5">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={startNew} size="sm" className="h-7 text-xs px-2.5">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Room
          </Button>
        </div>
      </div>

      {/* Edit / Create form */}
      {editing && (
        <Card className="border-primary/40">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">{isNew ? 'Create New Room' : `Edit: ${editing.name}`}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {error && <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  className="h-8 text-xs"
                  value={editing.name ?? ''}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Football Tips"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug * <span className="text-muted-foreground">(URL-safe, auto-generated)</span></Label>
                <Input
                  className="h-8 text-xs font-mono"
                  value={editing.slug ?? ''}
                  onChange={e => setEditing(prev => prev ? { ...prev, slug: slugify(e.target.value) } : prev)}
                  placeholder="e.g. football-tips"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                className="text-xs min-h-0 resize-none"
                rows={2}
                value={editing.description ?? ''}
                onChange={e => setEditing(prev => prev ? { ...prev, description: e.target.value } : prev)}
                placeholder="Short description shown as tooltip"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Icon (emoji)</Label>
                <Input
                  className="h-8 text-lg text-center"
                  maxLength={4}
                  value={editing.icon ?? ''}
                  onChange={e => setEditing(prev => prev ? { ...prev, icon: e.target.value } : prev)}
                  placeholder="💬"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sort Order</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  value={editing.sortOrder ?? 10}
                  onChange={e => setEditing(prev => prev ? { ...prev, sortOrder: Number(e.target.value) } : prev)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Active</Label>
                <div className="flex items-center h-8">
                  <Switch
                    checked={editing.isActive !== false}
                    onCheckedChange={v => setEditing(prev => prev ? { ...prev, isActive: v } : prev)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Colour theme</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEditing(prev => prev ? { ...prev, color: c.value } : prev)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium border transition-all ${c.value} ${editing.color === c.value ? 'ring-2 ring-offset-1 ring-primary' : 'opacity-70 hover:opacity-100'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                {isNew ? 'Create' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rooms table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">{rooms.length} Room{rooms.length !== 1 ? 's' : ''}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rooms.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No rooms yet. Run the SQL migration then click <strong>New Room</strong> to add rooms.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rooms.map(room => (
                <div key={room.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xl w-7 text-center shrink-0">{room.icon ?? '💬'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{room.name}</span>
                      <span className={`hidden sm:inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${room.color ?? ''}`}>
                        {room.slug}
                      </span>
                      {!room.isActive && <Badge variant="secondary" className="text-[10px] h-4 px-1">Hidden</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{room.description ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">{room.postCount} posts</span>
                    <button
                      title={room.isActive ? 'Hide room' : 'Show room'}
                      onClick={() => void toggleActive(room)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {room.isActive
                        ? <ToggleRight className="h-4 w-4 text-primary" />
                        : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button
                      title="Edit room"
                      onClick={() => startEdit(room)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Delete room"
                      onClick={() => void remove(room.id)}
                      disabled={deletingId === room.id}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      {deletingId === room.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="px-4 py-3">
          <p className="text-xs font-semibold text-amber-600 mb-1">⚠️ Database setup required</p>
          <p className="text-xs text-muted-foreground">
            If you haven't already, run the SQL from <code className="bg-muted px-1 rounded text-[11px]">migrations/add_community_rooms.sql</code> in your MySQL database first.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
