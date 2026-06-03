'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Swords, Trophy, Crown, Loader2, CheckCircle2, X, AlertCircle, Settings, TrendingUp, Users, DollarSign, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Challenge } from '@/lib/challenges-store';
import type { ChallengeRules } from '@/app/api/admin/challenges/route';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function StatusBadge({ status }: { status: string }) {
  const color = status === 'active' ? 'bg-red-500/20 text-red-600 border-red-500/30'
    : status === 'pending' ? 'bg-amber-500/20 text-amber-600 border-amber-500/30'
    : status === 'finished' ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
    : 'bg-muted text-muted-foreground border-border';
  return <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', color)}>{status}</span>;
}

function ChallengeRow({ c, onSettle, onCancel }: {
  c: Challenge;
  onSettle: (id: number, winnerId: number | null) => void;
  onCancel: (id: number) => void;
}) {
  const [settling, setSettling] = useState(false);
  const pot = c.stakeKes * 2;
  const fee = c.drawRefunded ? 0 : Math.round(pot * (c.platformFeePct / 100));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={c.status} />
            {c.isFakeChallenge && <span className="rounded-full bg-purple-500/20 text-purple-600 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold">FAKE</span>}
            {c.stakeKes > 0 && <span className="rounded-full bg-amber-500/20 text-amber-600 px-2 py-0.5 text-[10px] font-bold">KES {c.stakeKes.toLocaleString()} stake</span>}
          </div>
          <h3 className="mt-1 font-semibold text-sm">{c.title}</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {c.challenger?.displayName || `#${c.challengerId}`}
            {' vs '}
            {c.opponent?.displayName || (c.opponentId ? `#${c.opponentId}` : 'Open')}
            {' · '}
            {c.startDate} → {c.endDate}
            {' · '}
            {c.scoringMethod.replace('_', ' ')}
          </div>
          {c.stakeKes > 0 && (
            <div className="mt-1 text-xs">
              <span className="text-muted-foreground">Pot: </span><span className="font-bold text-amber-600">KES {pot.toLocaleString()}</span>
              <span className="text-muted-foreground ml-2">Fee (10%): </span><span className="font-bold">KES {fee.toLocaleString()}</span>
              <span className="text-muted-foreground ml-2">Winner gets: </span><span className="font-bold text-emerald-600">KES {(pot - fee).toLocaleString()}</span>
              {c.drawRefunded && <span className="ml-2 text-blue-500 font-bold">· Draw — Refunded</span>}
            </div>
          )}
          <div className="mt-1 text-[10px] text-muted-foreground">Escrow: {c.escrowStatus} · ID: {c.id}</div>
        </div>

        {(c.status === 'active' || c.status === 'pending') && (
          <div className="flex gap-2 flex-wrap shrink-0">
            {c.status === 'active' && !c.isFakeChallenge && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1"
                  disabled={settling}
                  onClick={() => { setSettling(true); onSettle(c.id, c.challengerId); }}
                >
                  <Trophy className="h-3 w-3" /> {c.challenger?.displayName || 'Challenger'} wins
                </Button>
                {c.opponentId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 gap-1"
                    disabled={settling}
                    onClick={() => { setSettling(true); onSettle(c.id, c.opponentId!); }}
                  >
                    <Trophy className="h-3 w-3" /> {c.opponent?.displayName || 'Opponent'} wins
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 text-blue-600 border-blue-500/30"
                  disabled={settling}
                  onClick={() => { setSettling(true); onSettle(c.id, null); }}
                >
                  🤝 Draw
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1 text-red-600 border-red-500/30"
              onClick={() => onCancel(c.id)}
            >
              <X className="h-3 w-3" /> Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RulesEditor({ rules, onSave }: { rules: ChallengeRules; onSave: (r: Partial<ChallengeRules>) => Promise<void> }) {
  const [form, setForm] = useState(rules);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Platform Fee %</label>
          <Input type="number" min={0} max={50} value={form.platformFeePct}
            onChange={e => setForm(f => ({ ...f, platformFeePct: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Min Stake (KES)</label>
          <Input type="number" min={0} value={form.minStakeKes}
            onChange={e => setForm(f => ({ ...f, minStakeKes: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Max Stake (KES)</label>
          <Input type="number" min={0} value={form.maxStakeKes}
            onChange={e => setForm(f => ({ ...f, maxStakeKes: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.allowFreeChallenge} onChange={e => setForm(f => ({ ...f, allowFreeChallenge: e.target.checked }))} className="rounded" />
          Allow free challenges (KES 0 stake)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.autoSettleEnabled} onChange={e => setForm(f => ({ ...f, autoSettleEnabled: e.target.checked }))} className="rounded" />
          Auto-settle challenges when window ends
        </label>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Draw Policy</label>
        <select value={form.drawPolicy} onChange={e => setForm(f => ({ ...f, drawPolicy: e.target.value as 'full_refund' | 'half_fee' }))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="full_refund">Full refund on draw (no fee) — Recommended</option>
          <option value="half_fee">Charge half fee even on draws</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Rules Text (shown to users)</label>
        <textarea value={form.rulesText} onChange={e => setForm(f => ({ ...f, rulesText: e.target.value }))} rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
      </div>
      <Button onClick={save} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Settings className="h-4 w-4" />}
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Rules'}
      </Button>
    </div>
  );
}

export default function AdminChallengesPage() {
  const { data, isLoading, mutate: refresh } = useSWR('/api/admin/challenges', fetcher);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const challenges: Challenge[] = data?.challenges || [];
  const stats = data?.stats || {};
  const rules: ChallengeRules = data?.rules || { platformFeePct: 10, drawPolicy: 'full_refund', minStakeKes: 0, maxStakeKes: 50000, allowFreeChallenge: true, autoSettleEnabled: true, rulesText: '' };

  async function handleSettle(challengeId: number, winnerId: number | null) {
    setActionLoading(true);
    await fetch('/api/admin/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'settle', challengeId, winnerId }),
    });
    await refresh();
    setMsg(`Challenge #${challengeId} settled.`);
    setActionLoading(false);
    setTimeout(() => setMsg(''), 3000);
  }

  async function handleCancel(challengeId: number) {
    setActionLoading(true);
    await fetch('/api/admin/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', challengeId }),
    });
    await refresh();
    setMsg(`Challenge #${challengeId} cancelled.`);
    setActionLoading(false);
    setTimeout(() => setMsg(''), 3000);
  }

  async function handleSaveRules(r: Partial<ChallengeRules>) {
    await fetch('/api/admin/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_rules', rules: r }),
    });
    await refresh();
  }

  async function handleAutoSettle() {
    setActionLoading(true);
    await fetch('/api/challenges/settle');
    await refresh();
    setMsg('Auto-settle run complete.');
    setActionLoading(false);
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" /> Challenges Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage tipster challenges, settle results, configure rules and fees.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleAutoSettle} disabled={actionLoading} className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Run Auto-Settle
          </Button>
        </div>
      </div>

      {msg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Swords className="h-4 w-4 text-primary" />, label: 'Total', value: stats.total || 0 },
          { icon: <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />, label: 'Active', value: stats.active || 0 },
          { icon: <DollarSign className="h-4 w-4 text-amber-500" />, label: 'Total Staked', value: `KES ${(stats.totalStakedKes || 0).toLocaleString()}` },
          { icon: <Crown className="h-4 w-4 text-emerald-500" />, label: 'Fees Collected', value: `KES ${(stats.totalFeesCollectedKes || 0).toLocaleString()}` },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{s.icon}{s.label}</div>
            <div className="text-xl font-bold">{isLoading ? '–' : s.value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="challenges">
        <TabsList>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
          <TabsTrigger value="rules"><Settings className="h-3.5 w-3.5 mr-1" />Rules & Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="challenges" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : challenges.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <Swords className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No challenges yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {challenges.map(c => (
                <ChallengeRow key={c.id} c={c} onSettle={handleSettle} onCancel={handleCancel} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4" /> Challenge Rules & Fee Configuration
            </h2>
            <RulesEditor rules={rules} onSave={handleSaveRules} />
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">📐 Payout Logic</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• Both tipsters stake equal amounts (e.g. KES 500 each → pot = KES 1,000)</div>
              <div>• Platform fee ({rules.platformFeePct}%) is deducted from the pot: KES {Math.round(1000 * rules.platformFeePct / 100)}</div>
              <div>• Winner receives: KES {1000 - Math.round(1000 * rules.platformFeePct / 100)}</div>
              <div>• Draw: both receive full refund — platform earns KES 0 (fairest policy)</div>
              <div>• If opponent never accepts: challenger refunded in full, no fee</div>
              <div>• Platform fee credits to admin wallet (ID 0)</div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
