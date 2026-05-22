'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Search, MoreHorizontal, UserPlus, Download, Mail, Ban,
  CheckCircle2, Shield, Bot, X, Send, Users, Clock, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ROLE_LABELS, ROLE_COLORS, type Role } from '@/lib/permissions';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  avatar: string;
  role: Role;
  status: 'active' | 'banned' | 'pending';
  isFake: boolean;
  joined: string;
  predictions: number;
  winRate: number;
  followers: number;
  lastActive: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());
const ROLES: Role[] = ['admin', 'moderator', 'editor', 'tipster', 'user'];

// ─── Add User Modal ───────────────────────────────────────────────────────────
function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '', role: 'user' as Role });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to create user'); setSaving(false); return; }
      onCreated();
      onClose();
    } catch {
      setError('Network error');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold">Add New User</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-4">
          {error && <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Email *</label>
              <Input className="h-8 text-xs" type="email" placeholder="user@email.com" required
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Username *</label>
              <Input className="h-8 text-xs" placeholder="john_doe" required minLength={3}
                value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Display Name</label>
            <Input className="h-8 text-xs" placeholder="John Doe"
              value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Password *</label>
            <Input className="h-8 text-xs" type="password" placeholder="Min 8 characters" required minLength={8}
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Role</label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={saving}>
              {saving ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
              Create User
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Email / Batch Email Modal ────────────────────────────────────────────────
function EmailModal({
  userIds,
  targetUser,
  onClose,
}: {
  userIds: number[];
  targetUser?: AdminUser;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [batchSize, setBatchSize] = useState(50);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [status, setStatus] = useState<'idle' | 'sending' | 'waiting' | 'done'>('idle');
  const [progress, setProgress] = useState({ batchIndex: 0, totalBatches: 1, sent: 0, failed: 0 });
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isBulk = !targetUser;

  const sendBatch = useCallback(async (batchIndex: number) => {
    setStatus('sending');
    const res = await fetch('/api/admin/users/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds,
        subject,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">${body.replace(/\n/g, '<br/>')}</div>`,
        text: body,
        batchIndex,
        batchSize,
      }),
    });
    const data = await res.json();
    setProgress(prev => ({
      batchIndex: data.batchIndex ?? batchIndex,
      totalBatches: data.totalBatches ?? prev.totalBatches,
      sent: prev.sent + (data.sent ?? 0),
      failed: prev.failed + (data.failed ?? 0),
    }));
    if (data.done) {
      setStatus('done');
    } else if (delayMinutes > 0) {
      setStatus('waiting');
      setCountdown(delayMinutes * 60);
    } else {
      await sendBatch(batchIndex + 1);
    }
  }, [userIds, subject, body, batchSize, delayMinutes]);

  useEffect(() => {
    if (status === 'waiting' && countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timerRef.current!);
            const nextBatch = progress.batchIndex + 1;
            sendBatch(nextBatch);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, countdown, progress.batchIndex, sendBatch]);

  function fmtCountdown(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    setProgress({ batchIndex: 0, totalBatches: Math.ceil(userIds.length / batchSize), sent: 0, failed: 0 });
    await sendBatch(0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">
              {targetUser ? `Email ${targetUser.displayName}` : `Email ${userIds.length} Users`}
            </h2>
            {isBulk && (
              <p className="text-[11px] text-muted-foreground">
                {userIds.length} recipient{userIds.length !== 1 ? 's' : ''} · batch size {batchSize}
                {delayMinutes > 0 ? ` · ${delayMinutes}m delay between batches` : ' · no delay'}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} disabled={status === 'sending'}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3 p-4">
          {status === 'idle' && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Subject *</label>
                <Input className="h-8 text-xs" placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Message *</label>
                <Textarea className="min-h-[120px] text-xs" placeholder="Write your message here..." value={body} onChange={e => setBody(e.target.value)} />
              </div>
              {isBulk && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Batch size</label>
                    <Input className="h-8 text-xs" type="number" min={1} max={500} value={batchSize}
                      onChange={e => setBatchSize(Math.max(1, parseInt(e.target.value) || 50))} />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {Math.ceil(userIds.length / batchSize)} batch{Math.ceil(userIds.length / batchSize) !== 1 ? 'es' : ''} total
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Delay between batches</label>
                    <div className="flex items-center gap-1">
                      <Input className="h-8 text-xs" type="number" min={0} max={1440} value={delayMinutes}
                        onChange={e => setDelayMinutes(Math.max(0, parseInt(e.target.value) || 0))} />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {delayMinutes === 0 ? 'Sends all batches immediately' : `Waits ${delayMinutes}m then auto-sends next batch`}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={onClose}>Cancel</Button>
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSend}
                  disabled={!subject.trim() || !body.trim()}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {isBulk ? `Send to ${userIds.length} users` : 'Send Email'}
                </Button>
              </div>
            </>
          )}

          {(status === 'sending' || status === 'waiting' || status === 'done') && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                {status === 'sending' && <Spinner className="h-5 w-5 shrink-0" />}
                {status === 'waiting' && <Clock className="h-5 w-5 shrink-0 text-amber-500" />}
                {status === 'done' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
                <div>
                  <p className="text-sm font-medium">
                    {status === 'sending' && `Sending batch ${progress.batchIndex + 1} of ${progress.totalBatches}…`}
                    {status === 'waiting' && `Waiting ${fmtCountdown(countdown)} before next batch`}
                    {status === 'done' && 'All done!'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {progress.sent} sent · {progress.failed} failed
                    {isBulk && ` · batch ${progress.batchIndex + 1} / ${progress.totalBatches}`}
                  </p>
                </div>
              </div>
              {isBulk && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.round(((progress.batchIndex + (status === 'done' ? 1 : 0)) / progress.totalBatches) * 100)}%` }}
                  />
                </div>
              )}
              {status === 'waiting' && (
                <p className="text-[11px] text-muted-foreground">
                  Next batch will send automatically in {fmtCountdown(countdown)}. You can leave this window open.
                </p>
              )}
              {status === 'done' && (
                <Button size="sm" className="h-8 w-full text-xs" onClick={onClose}>Close</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'real' | 'fake'>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [emailTarget, setEmailTarget] = useState<AdminUser | null>(null);
  const [showBulkEmail, setShowBulkEmail] = useState(false);

  const params = new URLSearchParams();
  if (searchQuery) params.set('search', searchQuery);
  if (roleFilter !== 'all') params.set('role', roleFilter);
  if (sourceFilter !== 'all') params.set('source', sourceFilter);

  const url = `/api/admin/users?${params.toString()}`;
  const { data, isLoading } = useSWR<{
    users: AdminUser[];
    counts: { total: number; byRole: Record<Role, number> };
  }>(url, fetcher);

  const users = data?.users ?? [];
  const counts = data?.counts ?? { total: 0, byRole: { admin: 0, moderator: 0, editor: 0, tipster: 0, user: 0 } };

  // Compute selectable IDs from the currently filtered view (real users only for email)
  const selectableIds = users.filter(u => !u.isFake).map(u => u.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));
  const someSelected = selectableIds.some(id => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        selectableIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => new Set([...prev, ...selectableIds]));
    }
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function changeRole(id: number, role: Role) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    });
    mutate(url);
  }

  function exportCsv() {
    const rows = [['ID', 'Username', 'Display Name', 'Email', 'Role', 'Source', 'Joined', 'Tips', 'Win %']];
    for (const u of users) {
      rows.push([String(u.id), u.username, u.displayName, u.email, u.role, u.isFake ? 'Seeded' : 'Real', u.joined, String(u.predictions), `${u.winRate}%`]);
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'users.csv';
    a.click();
  }

  // Selected user IDs for bulk email
  const selectedIds = Array.from(selected);

  return (
    <div className="space-y-3">
      {/* Modals */}
      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} onCreated={() => mutate(url)} />
      )}
      {emailTarget && (
        <EmailModal
          userIds={[emailTarget.id]}
          targetUser={emailTarget}
          onClose={() => setEmailTarget(null)}
        />
      )}
      {showBulkEmail && selectedIds.length > 0 && (
        <EmailModal
          userIds={selectedIds}
          onClose={() => setShowBulkEmail(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold">Users Management</h1>
          <p className="text-xs text-muted-foreground">
            Manage users and roles. Moderators &amp; Editors get scoped access.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-2.5" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />Export
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5 px-2.5" onClick={() => setShowAddModal(true)}>
            <UserPlus className="h-3.5 w-3.5" />Add user
          </Button>
        </div>
      </div>

      {/* Role counts */}
      <div className="grid gap-2 md:grid-cols-5">
        {ROLES.map(role => (
          <Card key={role}>
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-muted-foreground leading-none">{ROLE_LABELS[role]}</span>
                <Badge variant="outline" className={cn('h-4 text-[9px] px-1', ROLE_COLORS[role])}>
                  {role === 'admin' ? <Shield className="mr-0.5 h-2 w-2" /> : null}
                  {counts.byRole[role] ?? 0}
                </Badge>
              </div>
              <div className="mt-1 text-xl font-bold leading-none">{counts.byRole[role] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search users by name, handle or email..."
                     value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                     className="h-8 pl-8 text-xs" />
            </div>
            <div className="flex gap-1.5">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | Role)}>
                <SelectTrigger className="h-8 w-32 text-xs px-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All roles</SelectItem>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as 'all' | 'real' | 'fake')}>
                <SelectTrigger className="h-8 w-32 text-xs px-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All sources</SelectItem>
                  <SelectItem value="real" className="text-xs">Real signups</SelectItem>
                  <SelectItem value="fake" className="text-xs">Seeded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection banner */}
      {someSelected && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <Users className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="flex-1 text-xs font-medium">{selectedIds.length} user{selectedIds.length !== 1 ? 's' : ''} selected</span>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
            onClick={() => setShowBulkEmail(true)}>
            <Mail className="h-3 w-3" />Email selected
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => setSelected(new Set())}>
            <X className="h-3 w-3" />Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6" /></div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground">No users match those filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-[11px] uppercase text-muted-foreground">
                    <th className="p-2 px-3 font-medium w-8">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 cursor-pointer accent-primary"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = !allSelected && someSelected; }}
                        onChange={toggleAll}
                        title="Select all real users"
                      />
                    </th>
                    <th className="p-2 px-3 font-medium">User</th>
                    <th className="p-2 px-3 font-medium">Role</th>
                    <th className="p-2 px-3 font-medium">Source</th>
                    <th className="p-2 px-3 font-medium text-right">Tips</th>
                    <th className="p-2 px-3 font-medium text-right">Win&nbsp;%</th>
                    <th className="p-2 px-3 font-medium">Joined</th>
                    <th className="p-2 px-3 font-medium">Last seen</th>
                    <th className="p-2 px-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {users.map(user => (
                    <tr key={user.id} className={cn(
                      "border-b last:border-0 hover:bg-muted/30 transition-colors",
                      selected.has(user.id) && "bg-primary/5",
                    )}>
                      <td className="p-1.5 px-3">
                        {!user.isFake ? (
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 cursor-pointer accent-primary"
                            checked={selected.has(user.id)}
                            onChange={() => toggleOne(user.id)}
                          />
                        ) : (
                          <span className="block h-3.5 w-3.5" />
                        )}
                      </td>
                      <td className="p-1.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={user.avatar} alt="" className="h-8 w-8 rounded-full bg-muted shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{user.displayName}</p>
                            <p className="truncate text-[10px] text-muted-foreground">@{user.username} · {user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-1.5 px-3">
                        <Select value={user.role} onValueChange={(v) => changeRole(user.id, v as Role)}>
                          <SelectTrigger className={cn('h-7 w-28 px-2 text-[10px]', ROLE_COLORS[user.role])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1.5 px-3">
                        <Badge variant="outline" className={cn(
                          'text-[9px] h-4 px-1',
                          user.isFake ? 'border-purple-500/30 text-purple-500' : 'border-emerald-500/30 text-emerald-500',
                        )}>
                          {user.isFake ? <><Bot className="mr-0.5 h-2.5 w-2.5" />Seeded</> : 'Real'}
                        </Badge>
                      </td>
                      <td className="p-1.5 px-3 text-right tabular-nums">{user.predictions}</td>
                      <td className="p-1.5 px-3 text-right">
                        <span className={cn("font-medium tabular-nums", user.winRate >= 60 ? 'text-emerald-500' : user.winRate >= 50 ? 'text-amber-500' : 'text-red-500')}>
                          {user.winRate}%
                        </span>
                      </td>
                      <td className="p-1.5 px-3 text-[10px] text-muted-foreground">{user.joined}</td>
                      <td className="p-1.5 px-3 text-[10px]">
                        <span className={user.lastActive === 'Online' ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}>
                          {user.lastActive}
                        </span>
                      </td>
                      <td className="p-1.5 px-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!user.isFake && (
                              <DropdownMenuItem className="text-xs" onClick={() => setEmailTarget(user)}>
                                <Mail className="mr-2 h-3.5 w-3.5" />Email user
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-xs"><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Verify</DropdownMenuItem>
                            {!user.isFake && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-500 text-xs"><Ban className="mr-2 h-3.5 w-3.5" />Ban user</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Footer summary */}
              <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                <span>{users.filter(u => !u.isFake).length} real · {users.filter(u => u.isFake).length} seeded · {users.length} total</span>
                {someSelected && (
                  <button className="flex items-center gap-1 text-primary hover:underline" onClick={() => setShowBulkEmail(true)}>
                    <ChevronRight className="h-3 w-3" />Email {selectedIds.length} selected
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
