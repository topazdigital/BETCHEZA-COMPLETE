'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { TrendingUp, Calendar, Trophy, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Circle, Info, Coins, Lock, Loader2, Phone, ShieldCheck, RefreshCw, X, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeeklyStrategy, DayPrediction, StrategyPick } from '@/app/api/strategy/predictions/route';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';

const WEEK_PLAN = [
  { day: 1, stake: 1000,  save: 0,      targetWin: 3000  },
  { day: 2, stake: 1500,  save: 1500,   targetWin: 4500  },
  { day: 3, stake: 2500,  save: 2000,   targetWin: 7500  },
  { day: 4, stake: 5000,  save: 2500,   targetWin: 15000 },
  { day: 5, stake: 10000, save: 5000,   targetWin: 30000 },
  { day: 6, stake: 15000, save: 15000,  targetWin: 45000 },
  { day: 7, stake: 20000, save: 25000,  targetWin: 60000 },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatKES(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function PickResultIcon({ result }: { result?: string }) {
  if (result === 'win') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (result === 'loss') return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function PickCard({ pick }: { pick: StrategyPick }) {
  return (
    <div className={cn(
      'rounded-lg border p-3 text-sm',
      pick.result === 'win' ? 'border-green-500/30 bg-green-500/5' :
      pick.result === 'loss' ? 'border-red-500/30 bg-red-500/5' :
      'border-border bg-muted/30'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PickResultIcon result={pick.result} />
          <div className="min-w-0">
            <p className="font-semibold truncate">{pick.homeTeam} vs {pick.awayTeam}</p>
            <p className="text-[11px] text-muted-foreground">{pick.league}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono font-bold text-primary">@{pick.odds.toFixed(2)}</span>
          {pick.actualScore && (
            <p className="text-[10px] text-muted-foreground">{pick.actualScore}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{pick.market}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
          {pick.pick}
        </span>
        {pick.result === 'win' && <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-bold text-green-600">WON ✓</span>}
        {pick.result === 'loss' && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-600">LOST ✗</span>}
      </div>
      {pick.reasoning && (
        <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{pick.reasoning}</p>
      )}
    </div>
  );
}

function DayCard({
  day,
  planItem,
  isLocked,
  isYesterday,
  onSubscribe,
}: {
  day: DayPrediction;
  planItem: typeof WEEK_PLAN[0];
  isLocked?: boolean;
  isYesterday?: boolean;
  onSubscribe?: () => void;
}) {
  const [open, setOpen] = useState(day.status === 'active' || isYesterday === true);
  const isActive = day.status === 'active';
  const isCompleted = day.status === 'completed';

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      isActive ? 'border-primary/60 bg-primary/5 shadow-md shadow-primary/10' : 'border-border bg-card',
      isLocked && !isYesterday && 'opacity-70',
    )}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-3 sm:p-4"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm',
            isActive ? 'bg-primary text-primary-foreground' :
            day.result === 'win' ? 'bg-green-500 text-white' :
            day.result === 'loss' ? 'bg-red-500 text-white' :
            isCompleted ? 'bg-muted text-muted-foreground' : 'bg-muted/60 text-muted-foreground'
          )}>
            {isLocked && !isYesterday ? <Lock className="h-4 w-4" /> : day.result === 'win' ? '✓' : day.result === 'loss' ? '✗' : `D${day.day}`}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Day {day.day}</span>
              {isActive && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">Today</span>}
              {isYesterday && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">Yesterday</span>}
              {isLocked && !isYesterday && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onSubscribe?.(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onSubscribe?.(); } }}
                  className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground uppercase hover:bg-primary/80 transition-colors cursor-pointer"
                >
                  Subscribe
                </span>
              )}
              {isCompleted && day.result && !isLocked && (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', day.result === 'win' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600')}>
                  {day.result}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-4 text-right text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Stake</p>
              <p className="font-mono font-bold text-foreground">{formatKES(planItem.stake)}</p>
            </div>
            {planItem.save > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Save</p>
                <p className="font-mono font-bold text-blue-500">{formatKES(planItem.save)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Target Win</p>
              <p className="font-mono font-bold text-green-500">{formatKES(planItem.targetWin)}</p>
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Mobile stake info */}
      <div className="sm:hidden flex items-center gap-3 px-3 pb-2 text-xs">
        <span className="text-muted-foreground">Stake: <span className="font-mono font-bold text-foreground">{formatKES(planItem.stake)}</span></span>
        {planItem.save > 0 && <span className="text-muted-foreground">Save: <span className="font-mono font-bold text-blue-500">{formatKES(planItem.save)}</span></span>}
        <span className="text-muted-foreground">Win: <span className="font-mono font-bold text-green-500">{formatKES(planItem.targetWin)}</span></span>
      </div>

      {open && (
        <div className="border-t border-border px-3 pb-3 pt-3 sm:px-4 space-y-2">
          {isLocked && !isYesterday ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center text-muted-foreground">
              <Lock className="h-6 w-6 opacity-40" />
              <p className="text-sm font-medium">Today&apos;s picks are for subscribers only</p>
              <p className="text-xs">Subscribe to unlock all current &amp; upcoming days instantly.</p>
              <button
                onClick={onSubscribe}
                className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Subscribe — KES 5,000 via M-Pesa
              </button>
            </div>
          ) : day.picks.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isYesterday ? "Yesterday's Picks" : "Today's Picks"}
                </p>
                {day.combinedOdds > 0 && (
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                    Combined: {day.combinedOdds.toFixed(2)}x
                  </span>
                )}
              </div>
              {day.picks.map((pick) => (
                <PickCard key={pick.id} pick={pick} />
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <Circle className="h-8 w-8 opacity-30" />
              <p className="text-sm">Picks not yet published for this day.</p>
              <p className="text-xs">Check back soon — our AI generates picks daily.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Subscribe Modal — Wallet or M-Pesa STK push              */
/* ────────────────────────────────────────────────────────── */
function SubscribeModal({
  open,
  onClose,
  onUnlocked,
  walletBalance = 0,
}: {
  open: boolean;
  onClose: () => void;
  onUnlocked: (data: { daysRemaining: number; startDayOffset: number }) => void;
  walletBalance?: number;
}) {
  const COST = 5000;
  const { isAuthenticated } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  const [walletContrib, setWalletContrib] = useState(0);
  const [step, setStep] = useState<'choose' | 'mpesa-form' | 'topup-form' | 'pending'>('choose');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canPayFull = walletBalance >= COST;
  const canPayPartial = walletBalance > 0 && walletBalance < COST;

  useEffect(() => {
    if (!open) {
      setStep(isAuthenticated ? 'choose' : 'choose');
      setError('');
      setReference(null);
      setTopUpAmount(null);
      setWalletContrib(0);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open, isAuthenticated]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = (ref: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/strategy/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check', reference: ref }),
        });
        const data = await res.json() as { hasAccess?: boolean; status?: string; daysRemaining?: number; startDayOffset?: number };
        if (data.hasAccess) {
          clearInterval(pollRef.current!);
          onUnlocked({ daysRemaining: data.daysRemaining || 7, startDayOffset: data.startDayOffset || 0 });
          onClose();
          return;
        }
        if (data.status === 'failed' || attempts >= 30) {
          clearInterval(pollRef.current!);
          setStep(walletContrib > 0 ? 'topup-form' : 'mpesa-form');
          setError(data.status === 'failed' ? 'Payment was declined. Please try again.' : 'Payment timed out. If you paid, refresh the page.');
        }
      } catch { /* silent */ }
    }, 5000);
  };

  // Pay full amount from wallet
  const handleWalletPay = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/strategy/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wallet' }),
      });
      const data = await res.json() as { hasAccess?: boolean; paidVia?: string; error?: string; needsTopUp?: boolean; topUpAmount?: number; walletBalance?: number; daysRemaining?: number; startDayOffset?: number };
      if (data.hasAccess) {
        onUnlocked({ daysRemaining: data.daysRemaining || 7, startDayOffset: data.startDayOffset || 0 });
        onClose();
        return;
      }
      setError(data.error || 'Wallet payment failed. Please try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Start top-up flow (wallet partial + M-Pesa for the rest)
  const handleTopUpInit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/strategy/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wallet' }),
      });
      const data = await res.json() as { needsTopUp?: boolean; topUpAmount?: number; walletBalance?: number; error?: string };
      if (data.needsTopUp && data.topUpAmount) {
        setTopUpAmount(data.topUpAmount);
        setWalletContrib(data.walletBalance || 0);
        setStep('topup-form');
      } else {
        setError(data.error || 'Could not calculate top-up amount. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pay full via M-Pesa (no wallet used)
  const handleMpesaPay = async () => {
    const cleaned = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!cleaned || cleaned.length < 9) { setError('Enter a valid M-Pesa phone number'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/strategy/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json() as { success?: boolean; hasAccess?: boolean; reference?: string; error?: string; daysRemaining?: number; startDayOffset?: number };
      if (data.hasAccess) {
        onUnlocked({ daysRemaining: data.daysRemaining || 7, startDayOffset: data.startDayOffset || 0 });
        onClose();
        return;
      }
      if (!data.success || !data.reference) {
        setError(data.error || 'Payment initiation failed. Please try again.');
        return;
      }
      setReference(data.reference);
      setStep('pending');
      startPolling(data.reference);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pay top-up amount via M-Pesa (wallet already partially covers)
  const handleTopUpPay = async () => {
    const cleaned = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!cleaned || cleaned.length < 9) { setError('Enter a valid M-Pesa phone number'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/strategy/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wallet', phone: cleaned }),
      });
      const data = await res.json() as { success?: boolean; hasAccess?: boolean; reference?: string; error?: string; topUpAmount?: number; walletContribution?: number; daysRemaining?: number; startDayOffset?: number };
      if (data.hasAccess) {
        onUnlocked({ daysRemaining: data.daysRemaining || 7, startDayOffset: data.startDayOffset || 0 });
        onClose();
        return;
      }
      if (!data.success || !data.reference) {
        setError(data.error || 'Payment initiation failed. Please try again.');
        return;
      }
      setWalletContrib(data.walletContribution || walletContrib);
      setReference(data.reference);
      setStep('pending');
      startPolling(data.reference);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const pendingMpesaAmount = topUpAmount ?? COST;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">3 Daily Odds — Subscribe</h2>
              <p className="text-xs text-muted-foreground">7-day compounding picks plan</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Price banner */}
          <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/8 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">KES 5,000 / week</p>
                <p className="text-[11px] text-muted-foreground">7-day access, starts today</p>
              </div>
            </div>
            {isAuthenticated && walletBalance > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Wallet</p>
                <p className="text-sm font-mono font-bold text-primary">KES {walletBalance.toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5">
            {[
              'Day 1 starts TODAY — no waiting for Monday',
              'All 7 days of compounding picks unlocked instantly',
              'Combined odds 3.0–4.0 every day',
              'Renew weekly to keep the strategy running',
              "Yesterday's picks always free — no subscription needed",
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          {/* ── Not signed in ── */}
          {!isAuthenticated ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Sign in to continue with your subscription</p>
              <button
                onClick={() => { onClose(); openAuthModal('login'); }}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                Sign In / Register
              </button>
            </div>

          /* ── Choose payment method ── */
          ) : step === 'choose' ? (
            <div className="space-y-3">
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}

              {/* Wallet full payment */}
              {canPayFull && (
                <button
                  onClick={handleWalletPay}
                  disabled={loading}
                  className="w-full rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 py-3.5 text-sm font-bold text-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                  Pay KES 5,000 from Wallet
                </button>
              )}

              {/* Wallet partial + M-Pesa top-up */}
              {canPayPartial && (
                <button
                  onClick={handleTopUpInit}
                  disabled={loading}
                  className="w-full rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 py-3 text-sm font-semibold text-primary transition-colors disabled:opacity-60 flex flex-col items-center gap-0.5"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <span className="flex items-center gap-1.5"><Coins className="h-4 w-4" /> Use KES {walletBalance.toLocaleString()} from Wallet + KES {(COST - walletBalance).toLocaleString()} via M-Pesa</span>
                      <span className="text-[11px] font-normal text-muted-foreground">Wallet covers part — top up the rest via M-Pesa</span>
                    </>
                  )}
                </button>
              )}

              {/* Divider */}
              {(canPayFull || canPayPartial) && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground">or pay entirely via</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {/* Full M-Pesa */}
              <button
                onClick={() => setStep('mpesa-form')}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4" /> Pay KES 5,000 via M-Pesa
              </button>
            </div>

          /* ── Full M-Pesa form ── */
          ) : step === 'mpesa-form' ? (
            <div className="space-y-3">
              <button onClick={() => { setStep('choose'); setError(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">M-Pesa Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="0712 345 678 or 254712345678"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleMpesaPay()}
                    className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
              <button
                onClick={handleMpesaPay}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><CreditCard className="h-4 w-4" /> Pay KES 5,000 &amp; Unlock</>}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">M-Pesa payment goes to Betcheza — this does NOT affect your wallet balance.</p>
            </div>

          /* ── Top-up form (partial wallet + remaining M-Pesa) ── */
          ) : step === 'topup-form' ? (
            <div className="space-y-3">
              <button onClick={() => { setStep('choose'); setError(''); setTopUpAmount(null); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 px-4 py-3 space-y-1 text-xs">
                <p className="font-semibold text-blue-600 dark:text-blue-400">Split payment breakdown</p>
                <p className="text-muted-foreground">✓ KES {walletBalance.toLocaleString()} — deducted from your wallet automatically</p>
                <p className="text-muted-foreground">📱 KES {(topUpAmount ?? COST - walletBalance).toLocaleString()} — you will receive an M-Pesa STK push</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">M-Pesa number for KES {(topUpAmount ?? COST - walletBalance).toLocaleString()} top-up</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="0712 345 678"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTopUpPay()}
                    className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
              <button
                onClick={handleTopUpPay}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><CreditCard className="h-4 w-4" /> Confirm &amp; Top Up KES {(topUpAmount ?? COST - walletBalance).toLocaleString()}</>}
              </button>
            </div>

          /* ── Waiting for M-Pesa PIN ── */
          ) : (
            <div className="text-center space-y-4 py-2">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/30">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Check your phone!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your M-Pesa PIN to confirm the KES {pendingMpesaAmount.toLocaleString()} payment
                    {walletContrib > 0 && <span className="block text-primary font-medium">KES {walletContrib.toLocaleString()} already deducted from your wallet</span>}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-primary">This page unlocks automatically</p>
                <p className="text-[11px] text-muted-foreground">No need to refresh — we&apos;ll detect your payment and unlock instantly</p>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              {reference && <p className="text-[10px] text-muted-foreground font-mono">Ref: {reference}</p>}
              <button
                onClick={() => { setStep(walletContrib > 0 ? 'topup-form' : 'mpesa-form'); setError(''); if (pollRef.current) clearInterval(pollRef.current); }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Try a different number
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AccessInfo {
  hasAccess: boolean;
  expiresAt?: string;
  startDayOffset?: number;
  daysRemaining?: number;
  walletBalance?: number;
}

export default function StrategyPage() {
  const { data, isLoading } = useSWR<{ current: WeeklyStrategy; past: WeeklyStrategy[] }>(
    '/api/strategy/predictions',
    fetcher,
    { revalidateOnFocus: false }
  );

  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  useEffect(() => {
    fetch('/api/strategy/access')
      .then(r => r.json())
      .then((d: AccessInfo) => setAccess(d))
      .catch(() => setAccess({ hasAccess: false }));
  }, []);

  const hasAccess = access?.hasAccess ?? false;
  const daysRemaining = access?.daysRemaining;

  const current = data?.current;
  const past = data?.past || [];

  const todayPlanIndex = (() => {
    if (!current?.days) return -1;
    return current.days.findIndex(d => d.status === 'active');
  })();

  const yesterdayPlanIndex = todayPlanIndex > 0 ? todayPlanIndex - 1 : -1;

  const expiresDate = access?.expiresAt ? new Date(access.expiresAt) : null;

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Subscribe Modal */}
      <SubscribeModal
        open={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        onUnlocked={(d) => setAccess({ hasAccess: true, ...d })}
        walletBalance={access?.walletBalance ?? 0}
      />

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold">3 Daily Odds Winning Strategy</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          A 7-day compounding football bet strategy. Each day we publish picks whose <strong>combined odds land between 3.0–4.0</strong>. Subscribe weekly — your personal 7-day plan starts the day you join.
        </p>
      </div>

      {/* Active subscription badge */}
      {hasAccess && expiresDate && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/8 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-semibold">Active subscription</span>
            <span className="text-xs text-muted-foreground">— {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</span>
          </div>
          <span className="text-[11px] text-muted-foreground">Renews by {expiresDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </div>
      )}

      {/* How subscription works — for non-subscribers */}
      {!hasAccess && (
        <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> How the weekly subscription works</p>
          <p>Pay KES 5,000 and your <strong>personal 7-day plan starts immediately</strong> — today becomes Day 1 for you. Renew every 7 days to keep access. Yesterday&apos;s picks are always free below.</p>
        </div>
      )}

      {/* Subscribe CTA — top of page for non-subscribers */}
      {!hasAccess && (
        <button
          onClick={() => setShowSubscribeModal(true)}
          className="mb-5 w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <CreditCard className="h-4 w-4" />
          Subscribe — KES 5,000 / week via M-Pesa
        </button>
      )}

      {/* Weekly plan overview */}
      <div className="mb-3 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Weekly Plan Overview</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-medium">Day</th>
                <th className="px-4 py-2 text-right font-medium">Stake</th>
                <th className="px-4 py-2 text-right font-medium text-blue-500">Save</th>
                <th className="px-4 py-2 text-right font-medium text-green-500">Win</th>
              </tr>
            </thead>
            <tbody>
              {WEEK_PLAN.map((p) => (
                <tr key={p.day} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2 font-medium">Day {p.day}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatKES(p.stake)}</td>
                  <td className="px-4 py-2 text-right font-mono text-blue-500">{p.save > 0 ? formatKES(p.save) : '–'}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-green-500">{formatKES(p.targetWin)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 text-xs font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right font-mono text-muted-foreground">KES 54,000</td>
                <td className="px-4 py-2 text-right font-mono text-blue-500">KES 49,000</td>
                <td className="px-4 py-2 text-right font-mono text-green-600">KES 108,000</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
        <Info className="h-3 w-3 shrink-0" />
        This is a strategy guide, not a guarantee. Betting involves risk — only stake what you can afford to lose. Picks are AI-assisted, not financial advice.
      </div>

      {/* Current week days */}
      {!isLoading && current && (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                Week of {new Date(current.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              </span>
            </div>
            {!hasAccess && (
              <span className="text-[11px] text-muted-foreground italic">Yesterday free · Subscribe for today</span>
            )}
          </div>

          <div className="space-y-2">
            {(current?.days || WEEK_PLAN.map((p, i) => ({
              day: p.day, date: '', picks: [], combinedOdds: 0,
              status: 'upcoming' as const,
              stake: p.stake, save: p.save, targetWin: p.targetWin,
            }))).map((day, i) => {
              const isToday = day.status === 'active';
              const isYesterday = i === yesterdayPlanIndex;
              // Today's picks become free for everyone once ALL matches in the day are finished
              const todayAllSettled = isToday && day.picks.length > 0 && day.picks.every(p => p.result !== 'pending');
              // Non-subscribers: locked for today (until all done) and upcoming; free for yesterday and settled today
              const isLocked = !hasAccess && !isYesterday && (day.status === 'upcoming' || (isToday && !todayAllSettled));

              return (
                <DayCard
                  key={day.day}
                  day={day}
                  planItem={WEEK_PLAN[i]}
                  isLocked={isLocked}
                  isYesterday={!hasAccess && isYesterday}
                  onSubscribe={() => setShowSubscribeModal(true)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Renewal notice */}
      {hasAccess && daysRemaining !== undefined && daysRemaining <= 2 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Your subscription expires in <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</strong>. Renew to keep access to the daily picks.</span>
        </div>
      )}

      {/* Past weeks */}
      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            <Coins className="h-4 w-4" /> Past Weeks
          </h2>
          <div className="space-y-3">
            {past.map((week) => {
              const wins = week.days.filter((d) => d.result === 'win').length;
              const losses = week.days.filter((d) => d.result === 'loss').length;
              return (
                <div key={week.weekId} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        Week of {new Date(week.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-muted-foreground">{wins} wins · {losses} losses · {7 - wins - losses} pending</p>
                    </div>
                    <div className="flex gap-1">
                      {week.days.map((d) => (
                        <div key={d.day} className={cn(
                          'h-2 w-2 rounded-full',
                          d.result === 'win' ? 'bg-green-500' : d.result === 'loss' ? 'bg-red-500' : 'bg-muted'
                        )} title={`Day ${d.day}: ${d.result || 'pending'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
