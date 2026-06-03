'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import {
  Swords, Trophy, Crown, Flame, Clock, Plus, Users, ChevronRight,
  CheckCircle2, X, Search, Loader2, AlertCircle, Calendar, Target,
  TrendingUp, Star, ThumbsUp, HelpCircle, Zap, BarChart2, Award,
  BookOpen, Shield, ChevronDown, Wallet, Info, DollarSign,
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
];

const SCORING = [
  { value: 'win_rate', label: 'Win Rate', desc: 'Most correct picks wins' },
  { value: 'roi', label: 'ROI', desc: 'Best return on investment wins' },
  { value: 'streak', label: 'Streak', desc: 'Longest consecutive win streak wins' },
];

const HOW_IT_WORKS = [
  { icon: <Target className="h-4 w-4 text-primary" />, title: 'Pick a Battle', desc: 'Choose your sport, a date window, and scoring method — win rate, ROI, or streak.' },
  { icon: <Swords className="h-4 w-4 text-red-500" />, title: 'Challenge or Go Open', desc: 'Name a specific tipster as opponent, or open it so anyone can accept.' },
  { icon: <BarChart2 className="h-4 w-4 text-blue-500" />, title: 'Post Tips Live', desc: 'Both tipsters post picks during the challenge window. Scores update in real-time.' },
  { icon: <Trophy className="h-4 w-4 text-amber-500" />, title: 'Best Tipster Wins', desc: 'Top performer wins the stake. Platform takes 10% from the winning pot. Draw = full refund, no fee.' },
];

function AvatarCircle({ displayName, avatar, size = 'md' }: { displayName: string; avatar?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-14 w-14 text-xl' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs';
  if (avatar) return <img src={avatar} alt={displayName} className={cn('shrink-0 rounded-full object-cover', s)} />;
  return (
    <div className={cn('shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary', s)}>
      {(displayName || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function CommunityVoteBar({ challengeId, initialVotesChallenger, initialVotesOpponent, challengerName, opponentName }: {
  challengeId: number; initialVotesChallenger: number; initialVotesOpponent: number;
  challengerName: string; opponentName: string | null;
}) {
  const { isAuthenticated } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [vc, setVc] = useState(initialVotesChallenger);
  const [vo, setVo] = useState(initialVotesOpponent);
  const [myVote, setMyVote] = useState<'challenger' | 'opponent' | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    fetch(`/api/challenges/${challengeId}/vote`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setVc(d.votesChallenger ?? initialVotesChallenger); setVo(d.votesOpponent ?? initialVotesOpponent); setMyVote(d.myVote ?? null); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  const vote = async (side: 'challenger' | 'opponent') => {
    if (!isAuthenticated) { openAuthModal('login'); return; }
    if (voting) return;
    setVoting(true);
    const optimisticVc = side === 'challenger' ? (myVote === 'opponent' ? vc + 1 : myVote ? vc : vc + 1) : (myVote === 'challenger' ? vc - 1 : vc);
    const optimisticVo = side === 'opponent' ? (myVote === 'challenger' ? vo + 1 : myVote ? vo : vo + 1) : (myVote === 'opponent' ? vo - 1 : vo);
    setVc(optimisticVc); setVo(optimisticVo); setMyVote(side);
    try {
      const r = await fetch(`/api/challenges/${challengeId}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side }) });
      if (r.ok) { const d = await r.json(); setVc(d.votesChallenger ?? optimisticVc); setVo(d.votesOpponent ?? optimisticVo); setMyVote(d.myVote ?? side); }
    } catch {}
    setVoting(false);
  };

  const total = vc + vo;
  const vcPct = total > 0 ? Math.round((vc / total) * 100) : 50;
  const voPct = total > 0 ? 100 - vcPct : 50;

  return (
    <div className="mx-4 mb-3 space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-semibold">Community Vote</span>
        <span>{total} vote{total !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => vote('challenger')} className={cn('flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-all', myVote === 'challenger' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600' : 'border-border bg-muted/30 text-muted-foreground hover:border-emerald-400/50 hover:bg-emerald-500/5 hover:text-emerald-600')}>
          <ThumbsUp className="h-3 w-3" /><span className="truncate max-w-[70px]">{challengerName}</span><span className="shrink-0">({vcPct}%)</span>
        </button>
        <button onClick={() => vote('opponent')} disabled={!opponentName} className={cn('flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-all', !opponentName ? 'cursor-default opacity-40 border-border bg-muted/20 text-muted-foreground' : myVote === 'opponent' ? 'border-blue-500 bg-blue-500/15 text-blue-600' : 'border-border bg-muted/30 text-muted-foreground hover:border-blue-400/50 hover:bg-blue-500/5 hover:text-blue-600')}>
          <ThumbsUp className="h-3 w-3 scale-x-[-1]" /><span className="truncate max-w-[70px]">{opponentName || 'Open'}</span><span className="shrink-0">({voPct}%)</span>
        </button>
      </div>
      {total > 0 && (
        <div className="flex h-1 gap-0.5 overflow-hidden rounded-full">
          <div className="bg-emerald-500 transition-all rounded-full" style={{ width: `${vcPct}%` }} />
          <div className="bg-blue-500 transition-all rounded-full flex-1" />
        </div>
      )}
    </div>
  );
}

function ChallengeCard({ c, onWatch, onAccept, isAuthenticated }: {
  c: Challenge; onWatch?: (id: number) => void;
  onAccept?: (id: number) => void; isAuthenticated?: boolean;
}) {
  const p1 = c.challenger;
  const p2 = c.opponent;
  const statusColor = c.status === 'active' ? 'bg-red-500' : c.status === 'pending' ? 'bg-amber-500' : 'bg-muted-foreground';
  const statusLabel = c.status === 'active' ? 'LIVE' : c.status === 'pending' ? 'UPCOMING' : c.status === 'finished' ? 'FINISHED' : 'CANCELLED';
  const statusText = c.status === 'active' ? 'text-red-600' : c.status === 'pending' ? 'text-amber-600' : 'text-muted-foreground';
  const p1Rate = p1 && p1.tips > 0 ? Math.round((p1.won / p1.tips) * 100) : 0;
  const p2Rate = p2 && p2.tips > 0 ? Math.round((p2.won / p2.tips) * 100) : 0;
  const sport = SPORTS.find(s => s.value === c.sport)?.label || '⚽ Football';

  const winnerGets = c.stakeKes > 0 ? Math.round(c.stakeKes * 2 * 0.9) : 0;
  const isDraw = c.status === 'finished' && c.drawRefunded;

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
            {isDraw && <span className="text-[10px] font-bold text-blue-500">· 🤝 Draw (refunded)</span>}
          </div>
          <h3 className="mt-0.5 text-sm font-bold leading-snug">{c.title}</h3>
          {c.description && <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{c.description}</p>}
          {c.matchScope && <p className="mt-0.5 text-[10px] text-primary/80 font-medium">📅 {c.matchScope}</p>}
        </div>
        {c.stakeKes > 0 && (
          <div className="shrink-0 text-right">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Prize Pool</div>
            <div className="text-sm font-bold text-amber-600 flex items-center gap-1">
              <Crown className="h-3 w-3" />KES {winnerGets.toLocaleString()}
            </div>
            <div className="text-[9px] text-muted-foreground">Each stakes {c.stakeKes.toLocaleString()}</div>
          </div>
        )}
      </div>

      <div className="mx-4 my-2 rounded-xl bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <AvatarCircle displayName={p1?.displayName || '?'} avatar={p1?.avatar} />
            <div className="text-center">
              <div className="text-xs font-bold">{p1?.displayName || 'Open Slot'}</div>
              {p1 && c.status !== 'pending' && <div className="text-[10px] text-muted-foreground">{p1.won}/{p1.tips} · {p1Rate}%</div>}
              {p1 && p1.streak > 2 && <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600"><Flame className="h-2.5 w-2.5" />{p1.streak}</div>}
            </div>
            {c.winnerId === c.challengerId && !isDraw && <Badge className="text-[9px] bg-amber-500 text-white">Winner 🏆</Badge>}
          </div>

          <div className="flex flex-col items-center shrink-0">
            {c.status !== 'pending' && p1 && p2
              ? <div className="text-2xl font-black tabular-nums">{p1.won} – {p2.won}</div>
              : <div className="flex items-center gap-1 text-muted-foreground font-bold"><Swords className="h-5 w-5" /></div>}
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
                  {c.status !== 'pending' && <div className="text-[10px] text-muted-foreground">{p2.won}/{p2.tips} · {p2Rate}%</div>}
                  {p2.streak > 2 && <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600"><Flame className="h-2.5 w-2.5" />{p2.streak}</div>}
                </div>
                {c.winnerId === c.opponentId && !isDraw && <Badge className="text-[9px] bg-amber-500 text-white">Winner 🏆</Badge>}
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

      <CommunityVoteBar challengeId={c.id} initialVotesChallenger={c.votesChallenger} initialVotesOpponent={c.votesOpponent} challengerName={p1?.displayName || 'Challenger'} opponentName={p2?.displayName || null} />

      <div className="flex items-center justify-between px-4 pb-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.watchers} watching</span>
          {c.stakeKes > 0 && <span className="flex items-center gap-1 text-amber-600 font-semibold"><Trophy className="h-3 w-3" />KES {c.stakeKes.toLocaleString()} stake</span>}
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(c.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
        {onWatch && c.status === 'active' && (
          <button onClick={() => onWatch(c.id)} className="text-primary text-[10px] font-semibold hover:underline flex items-center gap-0.5">
            Watch <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

interface TipsterResult {
  id: number; username: string; displayName: string; avatar: string | null;
  winRate: number; totalTips: number; isOnline?: boolean;
}

function TipsterSearchInput({ value, onChange, excludeId }: {
  value: TipsterResult | null; onChange: (t: TipsterResult | null) => void; excludeId?: number;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TipsterResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/tipsters?q=${encodeURIComponent(q)}&limit=10`);
        const data = await r.json();
        const tipsters = (data.tipsters || []).filter((t: TipsterResult) => t.id !== excludeId);
        // Sort: online first
        tipsters.sort((a: TipsterResult, b: TipsterResult) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
        setResults(tipsters);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, excludeId]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
        <AvatarCircle displayName={value.displayName} avatar={value.avatar} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{value.displayName}</div>
          <div className="text-[10px] text-muted-foreground">@{value.username} · {value.winRate}% win rate</div>
        </div>
        <button onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search tipster by name..." value={q} onChange={e => setQ(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)} className="pl-8 text-sm" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {results.map(t => (
            <button key={t.id} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left" onClick={() => { onChange(t); setQ(''); setOpen(false); }}>
              <AvatarCircle displayName={t.displayName} avatar={t.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{t.displayName}</span>
                  {t.isOnline && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Online" />}
                </div>
                <div className="text-[10px] text-muted-foreground">@{t.username} · {t.winRate}% win rate</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MpesaTopUpPrompt({
  stakeKes, walletBalance, onTopUpComplete, onClose,
}: {
  stakeKes: number; walletBalance: number; onTopUpComplete: () => void; onClose: () => void;
}) {
  const topUpNeeded = stakeKes - walletBalance;
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function initiateDeposit() {
    if (!phone.trim()) { setError('Enter your M-Pesa phone number'); return; }
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: topUpNeeded, phone: phone.trim() }),
      });
      const d = await r.json();
      if (r.ok) { setReference(d.reference || 'pending'); }
      else { setError(d.error || 'Failed to initiate payment'); }
    } catch { setError('Network error'); }
    setLoading(false);
  }

  async function checkPayment() {
    if (!reference) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/wallet/deposit/status?reference=${reference}`);
      const d = await r.json();
      if (d.status === 'completed') { onTopUpComplete(); }
      else { setError('Payment not yet confirmed. Please wait a moment and try again.'); }
    } catch { setError('Could not check payment status'); }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />Top up wallet</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Challenge stake</span><span className="font-bold">KES {stakeKes.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Your wallet</span><span className="font-bold text-emerald-600">KES {walletBalance.toLocaleString()}</span></div>
          <div className="border-t border-border pt-1 flex justify-between"><span className="text-muted-foreground font-semibold">Top-up via M-Pesa</span><span className="font-bold text-amber-600">KES {topUpNeeded.toLocaleString()}</span></div>
        </div>

        {!reference ? (
          <>
            <div className="mb-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">M-Pesa Phone Number</label>
              <Input placeholder="e.g. 0712345678" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
            </div>
            {error && <div className="mb-3 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</div>}
            <Button className="w-full gap-2" onClick={initiateDeposit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send KES {topUpNeeded.toLocaleString()} STK Push
            </Button>
          </>
        ) : (
          <>
            <div className="text-center py-3">
              <div className="text-2xl mb-2">📱</div>
              <p className="text-sm font-semibold">Check your phone!</p>
              <p className="text-xs text-muted-foreground mt-1">An M-Pesa prompt has been sent. Enter your PIN to complete the top-up, then click confirm below.</p>
            </div>
            {error && <div className="mb-3 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</div>}
            <Button className="w-full gap-2" onClick={checkPayment} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              I've paid — Confirm
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ChallengeRulesPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-3 text-xs font-bold text-muted-foreground uppercase tracking-wide hover:bg-muted/30 transition-colors">
        <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Challenge Rules & Payouts</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 text-xs text-muted-foreground border-t border-border">
          <div className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-foreground">Stakes locked immediately</strong> — your KES stake is held in escrow the moment you create or accept a challenge.</span></div>
          <div className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-foreground">Winner takes 90%</strong> of the total pot. Platform fee is 10% from the winning pot only.</span></div>
          <div className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span><span><strong className="text-foreground">Draw = full refund</strong> — if scores are tied, both parties get their full stake back. No fee charged on draws.</span></div>
          <div className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span><strong className="text-foreground">No opponent = full refund</strong> — if no one accepts before the start date, you're refunded in full.</span></div>
          <div className="flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span><span><strong className="text-foreground">Free challenges (KES 0)</strong> — purely for community bragging rights. No money moves.</span></div>
          <div className="flex items-start gap-2"><span className="text-muted-foreground mt-0.5">•</span><span>Auto-settlement runs when the window ends, based on your chosen scoring method.</span></div>

          <div className="mt-3 rounded-lg bg-muted/40 p-2.5">
            <div className="font-semibold text-foreground mb-1 text-[11px]">Example (KES 1,000 stake each):</div>
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span>Total pot</span><span className="font-mono">KES 2,000</span></div>
              <div className="flex justify-between"><span>Platform fee (10%)</span><span className="font-mono text-red-500">– KES 200</span></div>
              <div className="flex justify-between font-semibold text-emerald-600"><span>Winner receives</span><span className="font-mono">KES 1,800</span></div>
              <div className="flex justify-between text-blue-500"><span>Draw → each gets back</span><span className="font-mono">KES 1,000</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateChallengeModal({ onClose, onCreated, userId }: { onClose: () => void; onCreated: () => void; userId?: number }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [opponent, setOpponent] = useState<TipsterResult | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [topUpStake, setTopUpStake] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    title: '', description: '', sport: 'football', scoringMethod: 'win_rate',
    startDate: today, endDate: nextWeek, stakeKes: 0, maxTips: 10, isPublic: true, matchScope: '',
  });

  useEffect(() => {
    fetch('/api/wallet/balance').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.balance !== undefined) setWalletBalance(d.balance);
    }).catch(() => {});
  }, []);

  function set(key: string, val: unknown) { setForm(prev => ({ ...prev, [key]: val })); }

  async function submit() {
    if (!form.title.trim()) { setError('Please enter a challenge title.'); return; }
    if (form.endDate <= form.startDate) { setError('End date must be after start date.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, opponentId: opponent?.id || null }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.insufficientBalance) {
          setTopUpStake(d.stakeKes);
          setWalletBalance(d.walletBalance);
          setShowTopUp(true);
          setLoading(false);
          return;
        }
        setError(d.error || 'Failed to create challenge');
        setLoading(false);
        return;
      }
      onCreated();
      onClose();
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  }

  async function handleTopUpComplete() {
    setShowTopUp(false);
    const r = await fetch('/api/wallet/balance');
    const d = await r.json();
    if (d?.balance !== undefined) setWalletBalance(d.balance);
    await submit();
  }

  return (
    <>
      {showTopUp && (
        <MpesaTopUpPrompt
          stakeKes={topUpStake}
          walletBalance={walletBalance}
          onTopUpComplete={handleTopUpComplete}
          onClose={() => setShowTopUp(false)}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-3" onClick={onClose}>
        <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><Swords className="h-5 w-5 text-primary" />Create a Challenge</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-4">
            {[1, 2].map(s => (
              <div key={s} className={cn('flex items-center gap-1.5', s > 1 && 'flex-1')}>
                <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{s}</div>
                <span className={cn('text-[11px]', step >= s ? 'text-foreground font-medium' : 'text-muted-foreground')}>{s === 1 ? 'Setup' : 'Opponent & Stake'}</span>
                {s < 2 && <div className="flex-1 h-px bg-border ml-2" />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Challenge Title *</label>
                <Input placeholder="e.g. Weekend Premier League Showdown" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea placeholder="What are the rules? E.g. 'All EPL matches this weekend — highest win rate wins'" value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Match Scope (optional)</label>
                <Input placeholder="e.g. All EPL matches, or Arsenal vs Man City (Jun 15)" value={form.matchScope} onChange={e => set('matchScope', e.target.value)} />
                <p className="text-[10px] text-muted-foreground mt-0.5">Specify a fixture, league, or date window for the tips that count.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sport</label>
                  <select value={form.sport} onChange={e => set('sport', e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Scoring</label>
                  <select value={form.scoringMethod} onChange={e => set('scoringMethod', e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
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
              <Button className="w-full" onClick={() => setStep(2)}>
                Next: Opponent & Stake <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Challenge a Specific Tipster (optional)</label>
                <TipsterSearchInput value={opponent} onChange={setOpponent} excludeId={userId} />
                <p className="text-[10px] text-muted-foreground mt-1">Leave empty for an open challenge. Online tipsters appear first. They'll get a notification to accept or decline.</p>
              </div>

              {/* Stake section */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Stake Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">KES</span>
                  <Input type="number" min={0} max={50000} step={100} value={form.stakeKes} onChange={e => set('stakeKes', Number(e.target.value))} className="pl-12" placeholder="0" />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground">Set to 0 for a free/glory-only challenge.</p>
                  {walletBalance > 0 && <p className="text-[10px] text-emerald-600 font-medium">Wallet: KES {walletBalance.toLocaleString()}</p>}
                </div>
                {form.stakeKes > 0 && (
                  <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs space-y-0.5">
                    <div className="flex justify-between"><span className="text-muted-foreground">Your stake (locked now)</span><span className="font-bold">KES {form.stakeKes.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Opponent's stake</span><span className="font-bold">KES {form.stakeKes.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total pot</span><span className="font-bold">KES {(form.stakeKes * 2).toLocaleString()}</span></div>
                    <div className="flex justify-between text-amber-600"><span>Winner receives (90%)</span><span className="font-bold">KES {Math.round(form.stakeKes * 2 * 0.9).toLocaleString()}</span></div>
                    <div className="flex justify-between text-blue-500 text-[10px]"><span>Draw → full refund, no fee</span></div>
                  </div>
                )}
              </div>

              {/* Quick stake presets */}
              {form.stakeKes === 0 && (
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Quick presets:</label>
                  <div className="flex gap-2 flex-wrap">
                    {[0, 200, 500, 1000, 2000, 5000].map(amt => (
                      <button key={amt} onClick={() => set('stakeKes', amt)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', form.stakeKes === amt ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                        {amt === 0 ? 'Free' : `KES ${amt.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ChallengeRulesPanel />

              {/* Summary */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <p className="font-semibold text-foreground mb-1">Summary</p>
                <div className="space-y-0.5 text-muted-foreground">
                  <div className="flex justify-between"><span>Title</span><span className="text-foreground font-medium truncate max-w-[60%] text-right">{form.title}</span></div>
                  <div className="flex justify-between"><span>Sport</span><span className="text-foreground">{SPORTS.find(s => s.value === form.sport)?.label}</span></div>
                  <div className="flex justify-between"><span>Scoring</span><span className="text-foreground">{SCORING.find(s => s.value === form.scoringMethod)?.label}</span></div>
                  <div className="flex justify-between"><span>Window</span><span className="text-foreground">{form.startDate} → {form.endDate}</span></div>
                  <div className="flex justify-between"><span>Stake</span><span className="text-foreground font-semibold">{form.stakeKes > 0 ? `KES ${form.stakeKes.toLocaleString()} per side` : 'Free (glory only)'}</span></div>
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
                  {loading ? 'Creating...' : form.stakeKes > 0 ? `Lock KES ${form.stakeKes.toLocaleString()} & Launch` : 'Launch Challenge'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function LeftSidebar({ challenges, isLoading }: { challenges: Challenge[]; isLoading: boolean }) {
  const live = challenges.filter(c => c.status === 'active');
  const pending = challenges.filter(c => c.status === 'pending');
  const finished = challenges.filter(c => c.status === 'finished');
  const totalStaked = challenges.filter(c => c.stakeKes > 0 && c.escrowStatus !== 'refunded').reduce((s, c) => s + c.stakeKes * 2, 0);

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Arena Stats</h3>
        <div className="space-y-2.5">
          {[
            { icon: <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />, label: 'Live Battles', value: live.length },
            { icon: <Clock className="h-3 w-3 text-amber-500" />, label: 'Upcoming', value: pending.length },
            { icon: <Trophy className="h-3 w-3 text-primary" />, label: 'Completed', value: finished.length },
            { icon: <Users className="h-3 w-3 text-blue-500" />, label: 'Total Watchers', value: challenges.reduce((a, c) => a + c.watchers, 0) },
          ].map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">{s.icon}{s.label}</div>
              <span className="text-sm font-bold">{isLoading ? '–' : s.value}</span>
            </div>
          ))}
          {totalStaked > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-amber-600 font-semibold"><Crown className="h-3 w-3" />KES in play</div>
              <span className="text-sm font-bold text-amber-600">KES {totalStaked.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><BookOpen className="h-3.5 w-3.5" />How It Works</h3>
        <div className="space-y-3">
          {HOW_IT_WORKS.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</div>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold">{s.icon}{s.title}</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Shield className="h-3.5 w-3.5" />Scoring</h3>
        <div className="space-y-2.5">
          {[
            { label: 'Win Rate', color: 'text-emerald-600', desc: 'Most correct predictions out of total tips.' },
            { label: 'ROI', color: 'text-blue-600', desc: 'Best return based on odds. Rewards value picks.' },
            { label: 'Streak', color: 'text-amber-600', desc: 'Longest consecutive wins. One miss ends your run.' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg bg-muted/40 p-2.5">
              <div className={cn('text-[11px] font-bold', s.color)}>{s.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function RightSidebar({ challenges, isLoading, onCreateChallenge }: { challenges: Challenge[]; isLoading: boolean; onCreateChallenge: () => void }) {
  const topByWatchers = [...challenges].sort((a, b) => b.watchers - a.watchers).slice(0, 4);
  const highStake = [...challenges].filter(c => c.stakeKes > 0 && c.status !== 'cancelled').sort((a, b) => b.stakeKes - a.stakeKes).slice(0, 4);

  const topChallengers = challenges
    .flatMap(c => [c.challenger, c.opponent])
    .filter((p): p is NonNullable<typeof p> => !!p && p.tips > 0)
    .map(p => ({ name: p.displayName, winRate: Math.round((p.won / p.tips) * 100), streak: p.streak, tips: p.tips }))
    .sort((a, b) => b.winRate - a.winRate)
    .reduce((acc, cur) => { if (!acc.find(x => x.name === cur.name)) acc.push(cur); return acc; }, [] as { name: string; winRate: number; streak: number; tips: number }[])
    .slice(0, 5);

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2"><Swords className="h-4 w-4 text-primary" /><h3 className="text-sm font-bold">Ready to Compete?</h3></div>
        <p className="text-[11px] text-muted-foreground mb-3">Challenge any tipster or open a battle for anyone. Stake KES and let the tips decide. Platform takes 10% — draw means full refund.</p>
        <Button size="sm" className="w-full gap-1.5" onClick={onCreateChallenge}><Plus className="h-3.5 w-3.5" />Create Challenge</Button>
      </div>

      {topChallengers.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Award className="h-3.5 w-3.5 text-amber-500" />Top Challengers</h3>
          <div className="space-y-2">
            {topChallengers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black', i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-zinc-400 text-white' : i === 2 ? 'bg-amber-700/70 text-white' : 'bg-muted text-muted-foreground')}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground">{t.tips} tips</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-xs font-bold tabular-nums', t.winRate >= 60 ? 'text-emerald-600' : t.winRate >= 50 ? 'text-blue-600' : 'text-muted-foreground')}>{t.winRate}%</div>
                  {t.streak > 2 && <div className="flex items-center justify-end gap-0.5 text-[10px] text-amber-600"><Flame className="h-2.5 w-2.5" />{t.streak}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {highStake.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400"><Crown className="h-3.5 w-3.5" />High Stakes</h3>
          <div className="space-y-1.5">
            {highStake.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate pr-2 flex-1 leading-tight">{c.title}</span>
                <span className="font-bold text-amber-600 shrink-0">KES {c.stakeKes.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topByWatchers.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-blue-500" />Most Watched</h3>
          <div className="space-y-2.5">
            {topByWatchers.map(c => (
              <div key={c.id} className="rounded-lg bg-muted/30 p-2.5">
                <div className="text-[11px] font-bold leading-tight line-clamp-1">{c.title}</div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground">{c.challenger?.displayName || '?'} vs {c.opponent?.displayName || 'Open'}</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Users className="h-2.5 w-2.5" />{c.watchers}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default function ChallengesPage() {
  const { isAuthenticated, user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [showCreate, setShowCreate] = useState(false);
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [acceptError, setAcceptError] = useState('');

  const { data, isLoading, mutate: refetch } = useSWR('/api/challenges', fetcher, {
    refreshInterval: 120_000, revalidateOnFocus: false, dedupingInterval: 60_000,
  });

  const challenges: Challenge[] = data?.challenges || [];
  const filtered = sportFilter === 'all' ? challenges : challenges.filter(c => c.sport === sportFilter);
  const live = filtered.filter(c => c.status === 'active');
  const pending = filtered.filter(c => c.status === 'pending');
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
    setAcceptingId(id);
    setAcceptError('');
    try {
      const res = await fetch(`/api/challenges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      const d = await res.json();
      if (!res.ok) { setAcceptError(d.error || 'Could not accept challenge'); }
      else { refetch(); }
    } catch { setAcceptError('Network error'); }
    setAcceptingId(null);
  }

  return (
    <div className="px-3 py-5 md:px-5">
      {showCreate && (
        <CreateChallengeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => refetch()}
          userId={user?.id}
        />
      )}

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Swords className="h-6 w-6 text-primary" />Tipster Challenges</h1>
          <p className="mt-1 text-sm text-muted-foreground">Head-to-head prediction battles with real KES stakes. Platform takes 10% — draw means full refund.</p>
        </div>
        <Button onClick={handleCreate} className="shrink-0 gap-1.5"><Plus className="h-4 w-4" />Challenge</Button>
      </div>

      {acceptError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />{acceptError}
          <button onClick={() => setAcceptError('')} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex gap-5">
        <div className="hidden lg:block w-60 shrink-0"><LeftSidebar challenges={challenges} isLoading={isLoading} /></div>

        <div className="flex-1 min-w-0">
          {/* Sport filter */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[{ value: 'all', label: 'All Sports' }, ...SPORTS.slice(0, 8)].map(s => (
              <button key={s.value} onClick={() => setSportFilter(s.value)}
                className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors', sportFilter === s.value ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground')}>
                {s.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Tabs defaultValue="live" className="space-y-4">
              <TabsList className="w-full">
                <TabsTrigger value="live" className="flex-1">
                  Live{live.length > 0 && <span className="ml-1.5 rounded-full bg-red-500/20 px-1.5 text-red-600 text-[10px] font-bold">{live.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="flex-1">
                  Upcoming{pending.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-amber-600 text-[10px] font-bold">{pending.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="finished" className="flex-1">Finished</TabsTrigger>
              </TabsList>

              <TabsContent value="live" className="space-y-3">
                {live.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                    <Swords className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-semibold">No live challenges right now</p>
                    <p className="mt-1 text-xs text-muted-foreground">Check back on match days or create one yourself.</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={handleCreate}><Plus className="h-3.5 w-3.5" />Create one</Button>
                  </div>
                ) : live.map(c => <ChallengeCard key={c.id} c={c} onWatch={handleWatch} isAuthenticated={isAuthenticated} />)}
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-3">
                {pending.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                    <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-semibold">No upcoming challenges</p>
                    <p className="mt-1 text-xs text-muted-foreground">Be the first to kick one off.</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={handleCreate}><Plus className="h-3.5 w-3.5" />Create challenge</Button>
                  </div>
                ) : (
                  <>
                    {pending.map(c => (
                      <div key={c.id} className="space-y-2">
                        <ChallengeCard c={c} isAuthenticated={isAuthenticated} />
                        {!c.opponentId && isAuthenticated && c.challengerId !== user?.id && !c.isFakeChallenge && (
                          <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" disabled={acceptingId === c.id} onClick={() => handleAccept(c.id)}>
                            {acceptingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Swords className="h-3.5 w-3.5" />}
                            {c.stakeKes > 0 ? `Accept & Stake KES ${c.stakeKes.toLocaleString()}` : 'Accept this Challenge'}
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="rounded-xl border border-dashed border-border bg-card p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="text-xs text-muted-foreground">Want to run your own challenge? Hit <strong>Challenge</strong> above to set one up in minutes.</div>
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

          <div className="mt-6 lg:hidden rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold">How Challenges Work</h2>
            <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
              {HOW_IT_WORKS.map((s, i) => (
                <div key={i} className="rounded-lg bg-muted/40 p-3">
                  <div className="mb-1">{s.icon}</div>
                  <div className="font-semibold text-foreground text-[11px] mb-0.5">{s.title}</div>
                  <div>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden xl:block w-60 shrink-0"><RightSidebar challenges={challenges} isLoading={isLoading} onCreateChallenge={handleCreate} /></div>
      </div>
    </div>
  );
}
