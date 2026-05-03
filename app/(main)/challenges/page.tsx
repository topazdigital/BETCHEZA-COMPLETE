'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import {
  Swords, Trophy, Crown, Flame, Clock, Plus, Users, ChevronRight,
  CheckCircle2, X, Search, Loader2, AlertCircle, Calendar, Target,
  TrendingUp, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import type { Challenge } from '@/lib/challenges-store';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const SPORTS = [
  { value: 'football', label: '⚽ Football' },
  { value: 'basketball', label: '🏀 Basketball' },
  { value: 'tennis', label: '🎾 Tennis' },
  { value: 'american-football', label: '🏈 American Football' },
  { value: 'baseball', label: '⚾ Baseball' },
  { value: 'ice-hockey', label: '🏒 Ice Hockey' },
  { value: 'mma', label: '🥋 MMA' },
  { value: 'boxing', label: '🥊 Boxing' },
  { value: 'cricket', label: '🏏 Cricket' },
  { value: 'rugby', label: '🏉 Rugby' },
  { value: 'volleyball', label: '🏐 Volleyball' },
  { value: 'table-tennis', label: '🏓 Table Tennis' },
  { value: 'golf', label: '⛳ Golf' },
  { value: 'cycling', label: '🚴 Cycling' },
  { value: 'esports', label: '🎮 Esports' },
  { value: 'darts', label: '🎯 Darts' },
  { value: 'snooker', label: '🎱 Snooker' },
  { value: 'motorsport', label: '🏎️ Motorsport' },
  { value: 'athletics', label: '🏃 Athletics' },
  { value: 'swimming', label: '🏊 Swimming' },
];

const SCORING = [
  { value: 'win_rate', label: 'Win Rate', desc: 'Most correct picks wins' },
  { value: 'roi', label: 'ROI', desc: 'Best return on investment wins' },
  { value: 'streak', label: 'Streak', desc: 'Longest consecutive win streak wins' },
];

function AvatarCircle({ displayName, avatar, size = 'md' }: { displayName: string; avatar?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-14 w-14 text-xl' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs';
  if (avatar) {
    return <img src={avatar} alt={displayName} className={cn('shrink-0 rounded-full object-cover', s)} />;
  }
  return (
    <div className={cn('shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary', s)}>
      {(displayName || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function ChallengeCard({ c, onWatch }: { c: Challenge; onWatch?: (id: number) => void }) {
  const p1 = c.challenger;
  const p2 = c.opponent;
  const statusColor = c.status === 'active' ? 'bg-red-500' : c.status === 'pending' ? 'bg-amber-500' : 'bg-muted-foreground';
  const statusLabel = c.status === 'active' ? 'LIVE' : c.status === 'pending' ? 'UPCOMING' : c.status === 'finished' ? 'FINISHED' : 'CANCELLED';
  const statusText = c.status === 'active' ? 'text-red-600' : c.status === 'pending' ? 'text-amber-600' : 'text-muted-foreground';
  const p1Rate = p1 && p1.tips > 0 ? Math.round((p1.won / p1.tips) * 100) : 0;
  const p2Rate = p2 && p2.tips > 0 ? Math.round((p2.won / p2.tips) * 100) : 0;
  const sport = SPORTS.find(s => s.value === c.sport)?.label || '⚽ Football';

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium text-muted-foreground">{sport}</span>
            <div className="flex items-center gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', statusColor, c.status === 'active' && 'animate-pulse')} />
              <span className={cn('text-[10px] font-bold uppercase', statusText)}>{statusLabel}</span>
            </div>
            <span className="text-[10px] text-muted-foreground capitalize">· {c.scoringMethod.replace('_', ' ')}</span>
          </div>
          <h3 className="mt-0.5 text-sm font-bold leading-snug">{c.title}</h3>
          {c.description && <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{c.description}</p>}
        </div>
        {(c.prizePool || c.stakePts > 0) && (
          <div className="shrink-0 text-right">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Prize</div>
            <div className="text-sm font-bold text-amber-600 flex items-center gap-1">
              <Crown className="h-3 w-3" />{c.prizePool || `${c.stakePts} pts`}
            </div>
          </div>
        )}
      </div>

      <div className="mx-4 my-2 rounded-xl bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <AvatarCircle displayName={p1?.displayName || '?'} avatar={p1?.avatar} />
            <div className="text-center">
              <div className="text-xs font-bold">{p1?.displayName || 'Open Slot'}</div>
              {p1 && c.status !== 'pending' && (
                <div className="text-[10px] text-muted-foreground">{p1.won}/{p1.tips} · {p1Rate}%</div>
              )}
              {p1 && p1.streak > 2 && (
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600">
                  <Flame className="h-2.5 w-2.5" />{p1.streak}
                </div>
              )}
            </div>
            {c.winnerId === c.challengerId && (
              <Badge className="text-[9px] bg-amber-500 text-white">Winner 🏆</Badge>
            )}
          </div>

          <div className="flex flex-col items-center shrink-0">
            {c.status !== 'pending' && p1 && p2 ? (
              <div className="text-2xl font-black tabular-nums">{p1.won} – {p2.won}</div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground font-bold">
                <Swords className="h-5 w-5" />
              </div>
            )}
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {c.status === 'active' ? 'LIVE' : new Date(c.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 flex-1">
            {p2 ? (
              <>
                <AvatarCircle displayName={p2.displayName} avatar={p2.avatar} />
                <div className="text-center">
                  <div className="text-xs font-bold">{p2.displayName}</div>
                  {c.status !== 'pending' && (
                    <div className="text-[10px] text-muted-foreground">{p2.won}/{p2.tips} · {p2Rate}%</div>
                  )}
                  {p2.streak > 2 && (
                    <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600">
                      <Flame className="h-2.5 w-2.5" />{p2.streak}
                    </div>
                  )}
                </div>
                {c.winnerId === c.opponentId && (
                  <Badge className="text-[9px] bg-amber-500 text-white">Winner 🏆</Badge>
                )}
              </>
            ) : (
              <>
                <div className="h-10 w-10 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-muted-foreground">Open</div>
                  <div className="text-[10px] text-muted-foreground">Waiting for opponent</div>
                </div>
              </>
            )}
          </div>
        </div>

        {c.status === 'active' && p1 && p2 && p1.tips > 0 && (
          <div className="mt-2 flex gap-0.5 rounded-full overflow-hidden h-1.5">
            <div className="bg-emerald-500 transition-all" style={{ width: `${p1Rate}%` }} />
            <div className="flex-1 bg-blue-500" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 pb-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />{c.watchers} watching
          </span>
          {c.stakePts > 0 && (
            <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />Stake: {c.stakePts} pts</span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(c.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
        {onWatch && c.status === 'active' && (
          <button
            onClick={() => onWatch(c.id)}
            className="text-primary text-[10px] font-semibold hover:underline flex items-center gap-0.5"
          >
            Watch <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

interface TipsterResult {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  winRate: number;
  totalTips: number;
}

function TipsterSearchInput({ value, onChange }: { value: TipsterResult | null; onChange: (t: TipsterResult | null) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TipsterResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/tipsters?q=${encodeURIComponent(q)}&limit=8`);
        const data = await r.json();
        setResults(data.tipsters || []);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
        <AvatarCircle displayName={value.displayName} avatar={value.avatar} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{value.displayName}</div>
          <div className="text-[10px] text-muted-foreground">@{value.username} · {value.winRate}% win rate</div>
        </div>
        <button onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tipster by name..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pl-8 text-sm"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {results.map(t => (
            <button
              key={t.id}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
              onClick={() => { onChange(t); setQ(''); setOpen(false); }}
            >
              <AvatarCircle displayName={t.displayName} avatar={t.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.displayName}</div>
                <div className="text-[10px] text-muted-foreground">@{t.username} · {t.winRate}% win rate</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateChallengeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [opponent, setOpponent] = useState<TipsterResult | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    title: '',
    description: '',
    sport: 'football',
    scoringMethod: 'win_rate',
    startDate: today,
    endDate: nextWeek,
    stakePts: 100,
    maxTips: 10,
    isPublic: true,
  });

  function set(key: string, val: unknown) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function submit() {
    if (!form.title.trim()) { setError('Please enter a challenge title.'); return; }
    if (form.endDate <= form.startDate) { setError('End date must be after start date.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, opponentId: opponent?.id || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to create challenge');
        setLoading(false);
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-3" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Create a Challenge</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Challenge Title *</label>
              <Input
                placeholder="e.g. Weekend Premier League Showdown"
                value={form.title}
                onChange={e => set('title', e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Description</label>
              <textarea
                placeholder="What are the rules? What fixture window? First to X correct tips wins?"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sport</label>
                <select
                  value={form.sport}
                  onChange={e => set('sport', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Scoring</label>
                <select
                  value={form.scoringMethod}
                  onChange={e => set('scoringMethod', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {SCORING.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">{SCORING.find(s => s.value === form.scoringMethod)?.desc}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Start Date</label>
                <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} min={today} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">End Date</label>
                <Input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} min={form.startDate} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Stake (pts)</label>
                <Input type="number" min={0} max={10000} value={form.stakePts} onChange={e => set('stakePts', Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Max Tips</label>
                <Input type="number" min={1} max={50} value={form.maxTips} onChange={e => set('maxTips', Number(e.target.value))} />
              </div>
            </div>

            <Button className="w-full" onClick={() => setStep(2)}>
              Next: Choose Opponent <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Challenge a Specific Tipster (optional)</label>
              <TipsterSearchInput value={opponent} onChange={setOpponent} />
              <p className="text-[10px] text-muted-foreground mt-1">
                Leave empty to make it an open challenge anyone can accept.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold text-foreground mb-1">Challenge Summary</p>
              <div className="space-y-0.5 text-muted-foreground">
                <div className="flex justify-between"><span>Title</span><span className="text-foreground font-medium truncate max-w-[60%] text-right">{form.title}</span></div>
                <div className="flex justify-between"><span>Sport</span><span className="text-foreground">{SPORTS.find(s => s.value === form.sport)?.label}</span></div>
                <div className="flex justify-between"><span>Scoring</span><span className="text-foreground">{SCORING.find(s => s.value === form.scoringMethod)?.label}</span></div>
                <div className="flex justify-between"><span>Window</span><span className="text-foreground">{form.startDate} → {form.endDate}</span></div>
                <div className="flex justify-between"><span>Stake</span><span className="text-foreground">{form.stakePts} pts</span></div>
                <div className="flex justify-between"><span>Opponent</span><span className="text-foreground">{opponent?.displayName || 'Open to all'}</span></div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 gap-1.5" onClick={submit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                {loading ? 'Creating...' : 'Launch Challenge'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChallengesPage() {
  const { isAuthenticated } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [showCreate, setShowCreate] = useState(false);
  const [sportFilter, setSportFilter] = useState<string>('all');

  const { data, isLoading, mutate: refetch } = useSWR('/api/challenges', fetcher, {
    refreshInterval: 120_000, revalidateOnFocus: false, dedupingInterval: 60_000,
  });

  const challenges: Challenge[] = data?.challenges || [];

  const filtered = sportFilter === 'all' ? challenges : challenges.filter(c => c.sport === sportFilter);

  const live = filtered.filter(c => c.status === 'active');
  const pending = filtered.filter(c => c.status === 'pending');
  const upcoming = [...live, ...pending];
  const finished = filtered.filter(c => c.status === 'finished');

  function handleCreate() {
    if (!isAuthenticated) { openAuthModal('login'); return; }
    setShowCreate(true);
  }

  async function handleWatch(id: number) {
    try { await fetch(`/api/challenges/${id}/watch`, { method: 'POST' }); } catch {}
  }

  async function handleAccept(id: number) {
    if (!isAuthenticated) { openAuthModal('login'); return; }
    try {
      await fetch(`/api/challenges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      refetch();
    } catch {}
  }

  return (
    <div className="max-w-3xl mx-auto px-3 py-5 md:px-5">
      {showCreate && (
        <CreateChallengeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { refetch(); }}
        />
      )}

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" /> Tipster Challenges
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Head-to-head prediction battles between tipsters. Watch live challenges or create your own.
          </p>
        </div>
        <Button onClick={handleCreate} className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Challenge
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Live Now', value: live.length, icon: <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" /> },
          { label: 'Upcoming', value: pending.length, icon: <Clock className="h-3.5 w-3.5 text-amber-500" /> },
          { label: 'Completed', value: finished.length, icon: <Trophy className="h-3.5 w-3.5 text-primary" /> },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
              {s.icon} {s.label}
            </div>
            <div className="text-xl font-bold">{isLoading ? '–' : s.value}</div>
          </div>
        ))}
      </div>

      {/* Sport filter */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSportFilter('all')}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            sportFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
          )}
        >
          All Sports
        </button>
        {SPORTS.map(s => (
          <button
            key={s.value}
            onClick={() => setSportFilter(s.value)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              sportFilter === s.value
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="live" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="live" className="flex-1">
              Live {live.length > 0 && <span className="ml-1.5 rounded-full bg-red-500/20 px-1.5 text-red-600 text-[10px] font-bold">{live.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1">
              Upcoming {pending.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-amber-600 text-[10px] font-bold">{pending.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="finished" className="flex-1">Finished</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-3">
            {live.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <Swords className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold">No live challenges right now</p>
                <p className="mt-1 text-xs text-muted-foreground">Check back on match days or create one yourself.</p>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={handleCreate}>
                  <Plus className="h-3.5 w-3.5" /> Create one
                </Button>
              </div>
            ) : live.map(c => <ChallengeCard key={c.id} c={c} onWatch={handleWatch} />)}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-3">
            {pending.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold">No upcoming challenges</p>
                <p className="mt-1 text-xs text-muted-foreground">Be the first to kick one off.</p>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={handleCreate}>
                  <Plus className="h-3.5 w-3.5" /> Create challenge
                </Button>
              </div>
            ) : (
              <>
                {pending.map(c => (
                  <div key={c.id} className="space-y-2">
                    <ChallengeCard c={c} />
                    {!c.opponentId && isAuthenticated && (
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => handleAccept(c.id)}>
                        <Swords className="h-3.5 w-3.5" /> Accept this Challenge
                      </Button>
                    )}
                  </div>
                ))}
                <div className="rounded-xl border border-dashed border-border bg-card p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    Want to run your own challenge? Hit <strong>Challenge</strong> above to set one up in minutes.
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="finished" className="space-y-3">
            {finished.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <Trophy className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold">No finished challenges yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Completed challenges will appear here.</p>
              </div>
            ) : finished.map(c => <ChallengeCard key={c.id} c={c} />)}
          </TabsContent>
        </Tabs>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold">How Challenges Work</h2>
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
          {[
            { icon: <Target className="h-5 w-5 text-primary" />, title: 'Pick a Battle', desc: 'Choose a sport, fixture window, and scoring method (win rate, ROI, or streak).' },
            { icon: <Swords className="h-5 w-5 text-red-500" />, title: 'Invite or Open', desc: 'Challenge a specific tipster or open it to all — first to accept joins as opponent.' },
            { icon: <Trophy className="h-5 w-5 text-amber-500" />, title: 'Compete & Win', desc: 'Post your tips live. The score updates in real-time. Top performer wins the stake.' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg bg-muted/40 p-3">
              <div className="mb-1">{s.icon}</div>
              <div className="font-semibold text-foreground text-[11px] mb-0.5">{s.title}</div>
              <div>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
