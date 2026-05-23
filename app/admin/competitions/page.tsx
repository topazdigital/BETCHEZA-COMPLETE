"use client"

import React, { useState, useEffect, useRef } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import Link from "next/link"
import { Trophy, Users, Gift, Timer, ChevronRight, ExternalLink, Plus, Trash2, Loader2, X, Info, CheckCircle, AlertTriangle, ShieldAlert, Zap } from "lucide-react"
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
  startDate: string
  prizePool: number
  currency: string
  entryFee: number
  maxParticipants: number
  currentParticipants: number
  sportFocus: string
  leagueId?: number | null
  leagueName?: string | null
  roundBased?: boolean
  matchKickoffFrom?: string | null
  matchKickoffTo?: string | null
}

interface CompResponse {
  competitions: AdminCompetition[]
  stats: { active: number; upcoming: number; totalParticipants: number; totalPrizePool: number }
}

interface LeagueValidation {
  valid: boolean
  warning: string | null
  detected: { leagueId: number; leagueName: string; sportFocus: string; espnKey: string } | null
  sportFocus: string
  isGeneral: boolean
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

type CompScope = 'gameweek' | 'weekly' | 'monthly' | 'season'

interface NewCompForm {
  name: string
  description: string
  scope: CompScope
  status: 'upcoming' | 'active' | 'completed'
  sportFocus: string
  startDate: string
  endDate: string
  prizePool: string
  currency: string
  entryFee: string
  maxParticipants: string
  matchKickoffFrom: string
  matchKickoffTo: string
}

const SCOPE_OPTIONS: { value: CompScope; label: string; description: string; color: string }[] = [
  { value: 'gameweek', label: 'Gameweek / Round', description: 'Only tips on matches in a specific kickoff window count (e.g. EPL Final Day, GW38)', color: 'amber' },
  { value: 'weekly',   label: 'Weekly',           description: 'Tips on any qualifying match within a 7-day window count', color: 'blue' },
  { value: 'monthly',  label: 'Monthly',          description: 'Tips on any qualifying match within a full calendar month count', color: 'purple' },
  { value: 'season',   label: 'Full Season',      description: 'Tips on any qualifying match from start date to end date count', color: 'emerald' },
]

// Map scope → DB type
function scopeToType(scope: CompScope): 'daily' | 'weekly' | 'monthly' | 'special' {
  if (scope === 'weekly') return 'weekly'
  if (scope === 'monthly') return 'monthly'
  return 'special'
}

interface RuleItem {
  type: string
  label: string
  value?: number
  enforceable: boolean
}

interface RuleTemplate {
  type: string
  label: string
  hasValue: boolean
  defaultValue?: number
  unit?: string
  enforceable: boolean
}

const RULE_TEMPLATES: RuleTemplate[] = [
  { type: 'min_tips',    label: 'Minimum tips required',              hasValue: true,  defaultValue: 3,    unit: 'tips',   enforceable: true },
  { type: 'min_avg_odds',label: 'Minimum average odds',               hasValue: true,  defaultValue: 1.5,  unit: '',       enforceable: true },
  { type: 'max_losses',  label: 'Maximum losses allowed',             hasValue: true,  defaultValue: 10,   unit: 'losses', enforceable: true },
  { type: 'kickoff_only',label: 'Tips must be placed before kickoff', hasValue: false,                                     enforceable: false },
  { type: 'score_formula',label: 'Score = wins × 10 + odds bonus − losses × 5', hasValue: false,          enforceable: false },
  { type: 'tiebreaker',  label: 'Tie-breaker: win rate then ROI',     hasValue: false,                                     enforceable: false },
]

const blankForm = (): NewCompForm => {
  const now = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const iso = (d: Date) => d.toISOString().slice(0, 16)
  return {
    name: '',
    description: '',
    scope: 'weekly',
    status: 'upcoming',
    sportFocus: 'multi-sport',
    startDate: iso(start),
    endDate: iso(end),
    prizePool: '10000',
    currency: 'KES',
    entryFee: '0',
    maxParticipants: '100',
    matchKickoffFrom: '',
    matchKickoffTo: '',
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
  const [validation, setValidation] = useState<LeagueValidation | null>(null)
  const [validating, setValidating] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Kickoff window editor ───────────────────────────────────────────
  const [editKickoffId, setEditKickoffId] = useState<number | null>(null)
  const [kickoffForm, setKickoffForm] = useState({ from: '', to: '' })
  const [savingKickoff, setSavingKickoff] = useState(false)

  const openKickoffEdit = (c: AdminCompetition) => {
    const toLocal = (iso: string | null | undefined) =>
      iso ? new Date(iso).toISOString().slice(0, 16) : ''
    setKickoffForm({ from: toLocal(c.matchKickoffFrom), to: toLocal(c.matchKickoffTo) })
    setEditKickoffId(c.id)
  }

  const saveKickoff = async (id: number) => {
    setSavingKickoff(true)
    try {
      const r = await fetch('/api/admin/competitions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          matchKickoffFrom: kickoffForm.from ? new Date(kickoffForm.from).toISOString() : null,
          matchKickoffTo: kickoffForm.to ? new Date(kickoffForm.to).toISOString() : null,
        }),
      })
      if (r.ok) {
        setEditKickoffId(null)
        mutate()
        globalMutate('/api/competitions')
      } else {
        const d = await r.json().catch(() => ({}))
        alert(d.error || 'Save failed')
      }
    } catch { alert('Network error') }
    setSavingKickoff(false)
  }

  // ── Rule builder state ─────────────────────────────────────────────
  const [ruleConfig, setRuleConfig] = useState<RuleItem[]>([])
  const [selectedRuleType, setSelectedRuleType] = useState('min_tips')
  const [ruleValue, setRuleValue] = useState('3')

  const addRule = () => {
    const tpl = RULE_TEMPLATES.find(t => t.type === selectedRuleType)
    if (!tpl) return
    if (ruleConfig.some(r => r.type === selectedRuleType)) return // no duplicates
    const val = tpl.hasValue ? Number(ruleValue) : undefined
    const labelSuffix = tpl.hasValue ? `: ${ruleValue}${tpl.unit ? ' ' + tpl.unit : ''}` : ''
    setRuleConfig(prev => [...prev, {
      type: selectedRuleType,
      label: tpl.label + labelSuffix,
      value: val,
      enforceable: tpl.enforceable,
    }])
  }

  const removeRule = (type: string) => setRuleConfig(prev => prev.filter(r => r.type !== type))

  // ── Live league detection as admin types the name ──────────────────
  useEffect(() => {
    const name = form.name.trim()
    if (!name) { setValidation(null); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setValidating(true)
      try {
        const r = await fetch('/api/admin/competitions/validate-league', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (r.ok) {
          const v = await r.json()
          setValidation(v)
          // Auto-fill sportFocus from detected league
          if (v.sportFocus && v.sportFocus !== form.sportFocus) {
            setForm(f => ({ ...f, sportFocus: v.sportFocus }))
          }
        }
      } catch { /* ignore */ } finally {
        setValidating(false)
      }
    }, 400)
  }, [form.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setError(null)
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (form.scope === 'gameweek' && (!form.matchKickoffFrom || !form.matchKickoffTo)) {
      setError('Gameweek/Round competitions require a kickoff window (From and To dates).')
      return
    }
    if (validation && !validation.valid) {
      setError(validation.warning || 'Invalid league name.')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          type: scopeToType(form.scope),
          status: form.status,
          sportFocus: validation?.sportFocus || form.sportFocus,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          prizePool: Number(form.prizePool),
          currency: form.currency,
          entryFee: Number(form.entryFee),
          maxParticipants: Number(form.maxParticipants),
          ruleConfig: ruleConfig.length > 0 ? ruleConfig : undefined,
          rules: ruleConfig.length > 0 ? ruleConfig.map(r => r.label) : undefined,
          roundBased: form.scope === 'gameweek',
          matchKickoffFrom: form.matchKickoffFrom ? new Date(form.matchKickoffFrom).toISOString() : null,
          matchKickoffTo: form.matchKickoffTo ? new Date(form.matchKickoffTo).toISOString() : null,
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(data.error || 'Could not create competition.')
        return
      }
      setShowForm(false)
      setForm(blankForm())
      setRuleConfig([])
      setValidation(null)
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

  // ── Manual settle ────────────────────────────────────────────────────
  const [settlingId, setSettlingId] = useState<number | null>(null)
  const [settleMsg, setSettleMsg] = useState<string | null>(null)

  const settleComp = async (c: AdminCompetition) => {
    if (!confirm(`Settle "${c.name}" now? This will distribute prizes to top finishers' wallets and close the competition.`)) return
    setSettlingId(c.id)
    setSettleMsg(null)
    try {
      const r = await fetch(`/api/admin/competitions/${c.slug}/settle`, { method: 'POST' })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setSettleMsg(`Error: ${data.error || 'Settlement failed'}`)
        return
      }
      if (data.alreadySettled) {
        setSettleMsg(`"${c.name}" was already settled.`)
      } else {
        const n = (data.credited ?? []).length
        setSettleMsg(`"${c.name}" settled — ${n} prize${n !== 1 ? 's' : ''} credited to wallets.`)
      }
      mutate()
      globalMutate('/api/competitions')
    } catch {
      setSettleMsg('Network error — settlement may have failed.')
    } finally {
      setSettlingId(null)
      setTimeout(() => setSettleMsg(null), 6000)
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

      {/* Settle result toast */}
      {settleMsg && (
        <div className={cn(
          'rounded-lg border px-3 py-2 text-xs flex items-center gap-2',
          settleMsg.startsWith('Error') ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        )}>
          {settleMsg.startsWith('Error') ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
          {settleMsg}
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-3 space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Create competition</h2>

            {/* ── Competition Scope ─────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide">Competition Scope</Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {SCOPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, scope: opt.value }))}
                    className={cn(
                      'rounded-md border p-2 text-left transition-all',
                      form.scope === opt.value
                        ? opt.value === 'gameweek' ? 'border-amber-500/60 bg-amber-500/10'
                          : opt.value === 'weekly' ? 'border-blue-500/60 bg-blue-500/10'
                          : opt.value === 'monthly' ? 'border-purple-500/60 bg-purple-500/10'
                          : 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-border bg-muted/20 hover:bg-muted/40'
                    )}
                  >
                    <div className={cn(
                      'text-[11px] font-semibold',
                      form.scope === opt.value
                        ? opt.value === 'gameweek' ? 'text-amber-400'
                          : opt.value === 'weekly' ? 'text-blue-400'
                          : opt.value === 'monthly' ? 'text-purple-400'
                          : 'text-emerald-400'
                        : 'text-foreground'
                    )}>{opt.label}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Gameweek Kickoff Window (required when scope = gameweek) ── */}
            {form.scope === 'gameweek' && (
              <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                <div className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-amber-400">Match Kickoff Window</span>
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-amber-500/40 text-amber-400">required</Badge>
                </div>
                <p className="text-[10px] text-amber-300/80">
                  Only tips on matches whose kickoff falls within this window will count — perfect for a single gameweek or Final Day.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide">Kickoff from (local time)</Label>
                    <Input
                      type="datetime-local"
                      value={form.matchKickoffFrom}
                      onChange={e => setForm({ ...form, matchKickoffFrom: e.target.value })}
                      className="h-8 text-xs border-amber-500/30"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide">Kickoff to (local time)</Label>
                    <Input
                      type="datetime-local"
                      value={form.matchKickoffTo}
                      onChange={e => setForm({ ...form, matchKickoffTo: e.target.value })}
                      className="h-8 text-xs border-amber-500/30"
                    />
                  </div>
                </div>
                {form.matchKickoffFrom && form.matchKickoffTo && (
                  <p className="text-[9px] text-emerald-400">
                    Window: {new Date(form.matchKickoffFrom).toLocaleString()} → {new Date(form.matchKickoffTo).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-wide">Name</Label>
                <div className="relative">
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Premier League GW38 · Weekly Tipster Challenge · NBA January"
                    className="h-8 text-xs pr-6"
                  />
                  {validating && <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>

                {/* League detection result */}
                {validation && form.name.trim() && (
                  <div className="mt-1">
                    {validation.detected ? (
                      <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-400">
                        <CheckCircle className="h-3 w-3 shrink-0" />
                        <span>Detected league: <strong>{validation.detected.leagueName}</strong> — only these tips will count</span>
                      </div>
                    ) : validation.warning ? (
                      <div className="flex items-start gap-1 rounded-md border border-amber-500/20 bg-amber-500/5 p-1.5 text-[10px] text-amber-400">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{validation.warning}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[10px] text-blue-400">
                        <Info className="h-3 w-3 shrink-0" />
                        <span>General competition — all sports and leagues accepted</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wide">Sport focus</Label>
                <Input
                  value={form.sportFocus}
                  onChange={e => setForm({ ...form, sportFocus: e.target.value })}
                  placeholder="football, multi-sport, basketball…"
                  className="h-8 text-xs"
                  readOnly={!!validation?.detected}
                  title={validation?.detected ? `Auto-set from detected league: ${validation.detected.leagueName}` : ''}
                />
                {validation?.detected && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">Auto-detected from league name</p>
                )}
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wide">Status</Label>
                <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as NewCompForm['status'] })}>
                  <option value="upcoming">upcoming</option>
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-wide">Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short summary shown on the public page." className="min-h-[52px] text-xs" />
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wide">Currency</Label>
                <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="h-8 text-xs" />
              </div>

              <div />

              <div>
                <Label className="text-[10px] uppercase tracking-wide">
                  Start (local){form.scope === 'gameweek' ? ' — competition opens for entries' : ''}
                </Label>
                <Input type="datetime-local" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide">
                  End (local){form.scope === 'gameweek' ? ' — after last match finishes' : ''}
                </Label>
                <Input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={e => setForm({ ...form, endDate: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wide">Prize pool</Label>
                <Input type="number" value={form.prizePool} onChange={e => setForm({ ...form, prizePool: e.target.value })} className="h-8 text-xs" />
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

            {/* ── Rules Builder ────────────────────────────────────── */}
            <div className="space-y-1.5 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldAlert className="h-3 w-3 text-muted-foreground" />
                <Label className="text-[10px] uppercase tracking-wide">Competition Rules</Label>
                <span className="text-[9px] text-muted-foreground">(optional — auto-enforced hourly)</span>
              </div>
              <div className="flex gap-1.5 items-center">
                <select
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                  value={selectedRuleType}
                  onChange={e => {
                    setSelectedRuleType(e.target.value)
                    const tpl = RULE_TEMPLATES.find(t => t.type === e.target.value)
                    if (tpl?.hasValue) setRuleValue(String(tpl.defaultValue ?? ''))
                  }}
                >
                  {RULE_TEMPLATES.map(t => (
                    <option key={t.type} value={t.type}>{t.label}</option>
                  ))}
                </select>
                {RULE_TEMPLATES.find(t => t.type === selectedRuleType)?.hasValue && (
                  <Input
                    type="number"
                    value={ruleValue}
                    onChange={e => setRuleValue(e.target.value)}
                    className="h-8 w-20 text-xs"
                    step="0.1"
                    min="0"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  onClick={addRule}
                  disabled={ruleConfig.some(r => r.type === selectedRuleType)}
                >
                  <Plus className="h-3 w-3 mr-1" />Add
                </Button>
              </div>
              {ruleConfig.length > 0 && (
                <div className="space-y-1 mt-1">
                  {ruleConfig.map(r => (
                    <div key={r.type} className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", r.enforceable ? "bg-rose-500" : "bg-muted-foreground/50")} />
                        <span className="text-[10px]">{r.label}</span>
                        {r.enforceable && (
                          <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-rose-500/40 text-rose-500 shrink-0">enforce</Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeRule(r.type)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                    enforce = users kicked &amp; emailed on violation (checked hourly)
                  </p>
                </div>
              )}
            </div>

            {error && <p className="text-[11px] text-rose-500">{error}</p>}

            <div className="flex justify-end gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setForm(blankForm()); setRuleConfig([]); setError(null); setValidation(null) }}>Cancel</Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={submit}
                disabled={submitting || (!!validation && !validation.valid)}
              >
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
        <StatCard label="Prize Pool" value={`${Math.round((stats?.totalPrizePool ?? 0) / 1000)}K`} icon={Gift} tone="warning" />
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
                <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">Scope</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tipsters</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Prize</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ends</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {comps.map(c => (
                <React.Fragment key={c.id}>
                <tr className="border-b border-border hover:bg-muted/30">
                  <td className="px-2.5 py-1.5 max-w-[180px]">
                    <div className="truncate font-medium">{c.name}</div>
                    {c.leagueName && (
                      <div className="text-[9px] text-emerald-500 truncate">{c.leagueName} only</div>
                    )}
                    {c.roundBased && (
                      <div className="text-[9px] text-blue-400">Round-based end</div>
                    )}
                    {c.matchKickoffFrom && c.matchKickoffTo && (
                      <div className="text-[9px] text-amber-400 truncate" title={`Kickoff: ${new Date(c.matchKickoffFrom).toLocaleString()} – ${new Date(c.matchKickoffTo).toLocaleString()}`}>
                        ⏱ Round filter active
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 capitalize text-muted-foreground">{c.type}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className={cn(
                      'h-4 text-[9px] px-1.5 capitalize',
                      c.status === 'active' && 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10',
                      c.status === 'upcoming' && 'border-blue-500/30 text-blue-500 bg-blue-500/10',
                      c.status === 'completed' && 'border-muted-foreground/30 text-muted-foreground',
                    )}>{c.status}</Badge>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell">
                    {c.leagueName ? (
                      <span className="text-[10px] text-emerald-500 font-medium">{c.leagueName}</span>
                    ) : (
                      <span className="text-[10px] capitalize">{c.sportFocus || 'all sports'}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">{c.currentParticipants}/{c.maxParticipants}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-warning">{c.currency} {(c.prizePool / 1000).toFixed(0)}K</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtTimeLeft(c.endDate)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      {/* Settle Now — shown for active competitions */}
                      {c.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-emerald-500 hover:bg-emerald-500/10"
                          title="Settle now — distribute prizes to winners' wallets"
                          onClick={() => settleComp(c)}
                          disabled={settlingId === c.id}
                        >
                          {settlingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-6 w-6', editKickoffId === c.id ? 'text-amber-400' : 'text-muted-foreground')}
                        title="Set match round / kickoff window filter"
                        onClick={() => editKickoffId === c.id ? setEditKickoffId(null) : openKickoffEdit(c)}
                      >
                        <Timer className="h-3.5 w-3.5" />
                      </Button>
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
                        title="Delete competition"
                      >
                        {deleting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
                {editKickoffId === c.id && (
                  <tr className="bg-amber-500/5 border-b border-amber-500/20">
                    <td colSpan={8} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <p className="text-[10px] text-amber-400 font-semibold mb-1 flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            Match Round / Kickoff Window — only tips on matches kicking off in this window will count
                          </p>
                          <div className="flex flex-wrap gap-2 items-center">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">From (local time)</Label>
                              <Input type="datetime-local" value={kickoffForm.from} onChange={e => setKickoffForm(f => ({ ...f, from: e.target.value }))} className="h-7 text-xs w-44 mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">To (local time)</Label>
                              <Input type="datetime-local" value={kickoffForm.to} onChange={e => setKickoffForm(f => ({ ...f, to: e.target.value }))} className="h-7 text-xs w-44 mt-0.5" />
                            </div>
                            <div className="flex gap-1.5 self-end">
                              <Button size="sm" className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={() => saveKickoff(c.id)} disabled={savingKickoff}>
                                {savingKickoff ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Saving…</> : 'Save Filter'}
                              </Button>
                              {(kickoffForm.from || kickoffForm.to) && (
                                <Button size="sm" variant="outline" className="h-7 text-xs text-rose-500 border-rose-500/30" onClick={() => { setKickoffForm({ from: '', to: '' }); saveKickoff(c.id); }}>
                                  Clear
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditKickoffId(null)}>Cancel</Button>
                            </div>
                          </div>
                          {kickoffForm.from && kickoffForm.to && (
                            <p className="text-[9px] text-amber-300 mt-1">
                              Window: {new Date(kickoffForm.from).toLocaleString()} → {new Date(kickoffForm.to).toLocaleString()} (your local timezone)
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
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
