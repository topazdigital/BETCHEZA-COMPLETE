"use client"

import { useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import Link from "next/link"
import { Trophy, Users, Gift, Timer, ChevronRight, ExternalLink, Plus, Trash2, Loader2, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface AdminCompetition {
  id: number
  slug: string
  name: string
  type: string
  status: 'upcoming' | 'active' | 'completed'
  endDate: string
  prizePool: number
  currency: string
  entryFee: number
  maxParticipants: number
  currentParticipants: number
  sportFocus: string
}

interface CompResponse {
  competitions: AdminCompetition[]
  stats: { active: number; upcoming: number; totalParticipants: number; totalPrizePool: number }
}

function fmtTimeLeft(end: string): string {
  const diff = new Date(end).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`
  return '<1h'
}

interface NewCompForm {
  name: string
  description: string
  type: 'daily' | 'weekly' | 'monthly' | 'special'
  status: 'upcoming' | 'active' | 'completed'
  sportFocus: string
  startDate: string
  endDate: string
  prizePool: string
  currency: string
  entryFee: string
  maxParticipants: string
}

const blankForm = (): NewCompForm => {
  const now = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const iso = (d: Date) => d.toISOString().slice(0, 16)
  return {
    name: '',
    description: '',
    type: 'weekly',
    status: 'upcoming',
    sportFocus: 'football',
    startDate: iso(start),
    endDate: iso(end),
    prizePool: '10000',
    currency: 'KES',
    entryFee: '0',
    maxParticipants: '100',
  }
}

export default function AdminCompetitionsPage() {
  const { data, isLoading, mutate } = useSWR<CompResponse>('/api/competitions', fetcher, { revalidateOnFocus: false })
  const comps = data?.competitions ?? []
  const stats = data?.stats

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewCompForm>(blankForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const submit = async () => {
    setError(null)
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          type: form.type,
          status: form.status,
          sportFocus: form.sportFocus,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          prizePool: Number(form.prizePool),
          currency: form.currency,
          entryFee: Number(form.entryFee),
          maxParticipants: Number(form.maxParticipants),
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(data.error || 'Could not create competition.')
        return
      }
      setShowForm(false)
      setForm(blankForm())
      mutate()
      globalMutate('/api/competitions')
    } catch {
      setError('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteComp = async (id: number) => {
    if (!confirm('Delete this competition? Built-in competitions cannot be deleted.')) return
    setDeleting(id)
    try {
      const r = await fetch(`/api/admin/competitions?id=${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        alert(data.error || 'Could not delete competition.')
        return
      }
      mutate()
      globalMutate('/api/competitions')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-base font-bold">
            <Trophy className="h-4 w-4 text-warning" />
            Competitions
          </h1>
          <p className="text-[11px] text-muted-foreground">Prediction competitions and tipster tournaments</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-7 text-xs" onClick={() => setShowForm(v => !v)}>
            {showForm ? <><X className="mr-1 h-3 w-3" />Cancel</> : <><Plus className="mr-1 h-3 w-3" />New competition</>}
          </Button>
          <Button asChild variant="outline" size="sm" className="h-7 text-xs">
            <Link href="/competitions" target="_blank">
              View public<ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-3 space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Create competition</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Weekly Tipster Cup" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Sport focus</Label>
                <Input value={form.sportFocus} onChange={e => setForm({ ...form, sportFocus: e.target.value })} placeholder="football, multi-sport, tennis…" className="h-8 text-xs" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-wide">Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short summary shown on the public page." className="min-h-[60px] text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Type</Label>
                <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as NewCompForm['type'] })}>
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                  <option value="special">special</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Status</Label>
                <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as NewCompForm['status'] })}>
                  <option value="upcoming">upcoming</option>
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Start (local)</Label>
                <Input type="datetime-local" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">End (local)</Label>
                <Input type="datetime-local" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Prize pool</Label>
                <Input type="number" value={form.prizePool} onChange={e => setForm({ ...form, prizePool: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Currency</Label>
                <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Entry fee</Label>
                <Input type="number" value={form.entryFee} onChange={e => setForm({ ...form, entryFee: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Max participants</Label>
                <Input type="number" value={form.maxParticipants} onChange={e => setForm({ ...form, maxParticipants: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
            {error && <p className="text-[11px] text-rose-500">{error}</p>}
            <div className="flex justify-end gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setForm(blankForm()); setError(null) }}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={submit} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Creating…</> : <><Plus className="mr-1 h-3 w-3" />Create</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <StatCard label="Active" value={stats?.active ?? 0} icon={Trophy} tone="primary" />
        <StatCard label="Upcoming" value={stats?.upcoming ?? 0} icon={Timer} tone="info" />
        <StatCard label="Tipsters" value={stats?.totalParticipants ?? 0} icon={Users} tone="success" />
        <StatCard label={`Prizes (K ${(stats?.totalPrizePool ?? 0) >= 1000 ? 'KES' : ''})`} value={`${Math.round((stats?.totalPrizePool ?? 0) / 1000)}K`} icon={Gift} tone="warning" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : comps.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="mx-auto h-8 w-8 text-amber-500/60" />
            <p className="mt-2 text-xs text-muted-foreground">No competitions yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">Sport</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tipsters</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Prize</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ends</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {comps.map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-2.5 py-1.5 font-medium truncate max-w-[200px]">{c.name}</td>
                  <td className="px-2 py-1.5 capitalize text-muted-foreground">{c.type}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className={cn(
                      'h-4 text-[9px] px-1.5 capitalize',
                      c.status === 'active' && 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10',
                      c.status === 'upcoming' && 'border-blue-500/30 text-blue-500 bg-blue-500/10',
                      c.status === 'completed' && 'border-muted-foreground/30 text-muted-foreground',
                    )}>{c.status}</Badge>
                  </td>
                  <td className="px-2 py-1.5 capitalize text-muted-foreground hidden md:table-cell">{c.sportFocus}</td>
                  <td className="px-2 py-1.5 text-center">{c.currentParticipants}/{c.maxParticipants}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-warning">{c.currency} {(c.prizePool / 1000).toFixed(0)}K</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtTimeLeft(c.endDate)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button asChild variant="ghost" size="icon" className="h-6 w-6">
                        <Link href={`/competitions/${c.slug}`} target="_blank">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-rose-500 hover:bg-rose-500/10"
                        onClick={() => deleteComp(c.id)}
                        disabled={deleting === c.id}
                        title="Delete (built-ins cannot be deleted)"
                      >
                        {deleting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, tone }: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  tone: 'primary' | 'info' | 'success' | 'warning'
}) {
  return (
    <div className={cn(
      'rounded-lg border p-2',
      tone === 'primary' && 'border-primary/30 bg-primary/5',
      tone === 'info' && 'border-blue-500/30 bg-blue-500/5',
      tone === 'success' && 'border-emerald-500/30 bg-emerald-500/5',
      tone === 'warning' && 'border-amber-500/30 bg-amber-500/5',
    )}>
      <div className="flex items-center justify-between">
        <Icon className={cn(
          'h-3.5 w-3.5',
          tone === 'primary' && 'text-primary',
          tone === 'info' && 'text-blue-500',
          tone === 'success' && 'text-emerald-500',
          tone === 'warning' && 'text-amber-500',
        )} />
        <span className="text-base font-bold leading-none">{value}</span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}
