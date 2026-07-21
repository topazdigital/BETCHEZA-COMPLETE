'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { TrendingUp, Calendar, Trophy, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Circle, Info, Coins, Lock, Loader2, Phone, ShieldCheck, RefreshCw, X, CreditCard, Bell, BellOff, BarChart2 } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { WeeklyStrategy, DayPrediction, StrategyPick } from '@/app/api/strategy/predictions/route';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { isPushSupported, getPushPermission, ensurePushSubscribed } from '@/lib/push-client';
import { useCurrency } from '@/contexts/currency-context';

/* ────────────────────────────────────────────────────────── */
/* Strategy Result Notification Toggle                      */
/* ────────────────────────────────────────────────────────── */
function StrategyNotifBell() {
  const [state, setState] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) { setState('unsupported'); return; }
    const perm = getPushPermission();
    if (perm === 'denied') { setState('denied'); return; }
    // Check if browser already has a push subscription
    navigator.serviceWorker.getRegistration('/sw.js').then(reg => {
      if (!reg) { setState('unsubscribed'); return; }
      reg.pushManager.getSubscription().then(sub => {
        setState(sub ? 'subscribed' : 'unsubscribed');
      }).catch(() => setState('unsubscribed'));
    }).catch(() => setState('unsubscribed'));
  }, []);

  async function toggle() {
    if (busy || state === 'unsupported') return;
    if (state === 'denied') {
      alert('Notifications are blocked in your browser settings. Open your browser settings and allow notifications for this site, then try again.');
      return;
    }
    if (state === 'subscribed') {
      // Unsubscribe from push entirely at the browser level
      setBusy(true);
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch('/api/notifications/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setState('unsubscribed');
      } catch { /* ignore */ } finally { setBusy(false); }
      return;
    }
    // Subscribe
    setBusy(true);
    const result = await ensurePushSubscribed({ topics: ['strategy_results', 'general'] });
    setBusy(false);
    if (result.ok) {
      setState('subscribed');
    } else if (result.error?.includes('blocked') || result.error?.includes('denied')) {
      setState('denied');
    }
  }

  if (state === 'unsupported' || state === 'loading') return null;

  const isOn = state === 'subscribed';
  const isDenied = state === 'denied';

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={
        isDenied ? 'Notifications blocked — check browser settings' :
        isOn ? 'Receiving result notifications — click to mute' :
        'Get notified when today\'s picks are settled'
      }
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
        isOn
          ? 'border-green-500/40 bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400'
          : isDenied
          ? 'border-red-500/30 bg-red-500/8 text-red-500 cursor-not-allowed'
          : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isDenied ? (
        <BellOff className="h-3.5 w-3.5" />
      ) : (
        <Bell className={cn('h-3.5 w-3.5', isOn && 'fill-green-500')} />
      )}
      <span className="hidden sm:inline">
        {isDenied ? 'Blocked' : isOn ? 'Notifying' : 'Notify me'}
      </span>
    </button>
  );
}

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
  const isLive = pick.liveStatus === 'live' && pick.result === 'pending';
  const scoreDisplay = pick.actualScore || (pick.liveStatus === 'finished' ? pick.liveScore : undefined);

  return (
    <div className={cn(
      'rounded-lg border p-3 text-sm transition-colors',
      pick.result === 'win' ? 'border-green-500/30 bg-green-500/5' :
      pick.result === 'loss' ? 'border-red-500/30 bg-red-500/5' :
      isLive ? 'border-red-500/20 bg-red-500/3' :
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
          {isLive && pick.liveScore ? (
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-bold text-red-600">{pick.liveScore}</span>
            </div>
          ) : scoreDisplay ? (
            <p className="text-[10px] text-muted-foreground">{scoreDisplay}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{pick.market}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{pick.pick}</span>
        {isLive && pick.result === 'pending' && (
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600 animate-pulse">
            🔴 LIVE
          </span>
        )}
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
  isSettled,
  isBrowserFuture,
  isAdmin,
  onSubscribe,
  fmt = (n: number) => `KES ${n.toLocaleString()}`,
}: {
  day: DayPrediction;
  planItem: typeof WEEK_PLAN[0];
  isLocked?: boolean;
  isYesterday?: boolean;
  isSettled?: boolean;
  isBrowserFuture?: boolean;
  isAdmin?: boolean;
  onSubscribe?: () => void;
  fmt?: (n: number) => string;
}) {
  const [open, setOpen] = useState(day.status === 'active' || isYesterday === true || isSettled === true);
  const isActive = day.status === 'active';
  const isCompleted = day.status === 'completed';

  // Detect picks whose match dates don't belong to this strategy day.
  // Uses the browser's own timezone so a user in EAT (UTC+3) gets the correct
  // local date — catches the edge case where the server stored tomorrow's games
  // in today's slot (e.g. at 23:xx EAT when UTC has already rolled over).
  const picksDateMismatch = day.picks.length > 0 && day.picks.every(pick => {
    if (!pick.matchTime) return false;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const pickLocalDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz })
        .format(new Date(pick.matchTime));
      return pickLocalDate !== day.date;
    } catch {
      return false;
    }
  });

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
        <span className="text-muted-foreground">Stake: <span className="font-mono font-bold text-foreground">{fmt(planItem.stake)}</span></span>
        {planItem.save > 0 && <span className="text-muted-foreground">Save: <span className="font-mono font-bold text-blue-500">{fmt(planItem.save)}</span></span>}
        <span className="text-muted-foreground">Win: <span className="font-mono font-bold text-green-500">{fmt(planItem.targetWin)}</span></span>
      </div>

      {open && (
        <div className="border-t border-border px-3 pb-3 pt-3 sm:px-4 space-y-2">
          {/* Browser hasn't hit midnight for this day yet — hide from non-admins */}
          {isBrowserFuture && !isAdmin ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <Clock className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">Available at midnight your time</p>
              <p className="text-xs">Picks for this day unlock once your clock reaches {new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}.</p>
            </div>
          ) : isLocked ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center text-muted-foreground">
              <Lock className="h-6 w-6 opacity-40" />
              {day.status === 'active' ? (
                <>
                  <p className="text-sm font-medium">Today&apos;s picks are for subscribers only</p>
                  <p className="text-xs">Subscribe to unlock all current &amp; upcoming days instantly.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Picks for this day are reserved for subscribers</p>
                  <p className="text-xs">Subscribe now — your 7-day plan starts today and covers all upcoming days.</p>
                </>
              )}
              <button
                onClick={onSubscribe}
                className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Subscribe — {fmt(5000)}
              </button>
            </div>
          ) : picksDateMismatch ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <Clock className="h-8 w-8 opacity-30" />
              <p className="text-sm">Today&apos;s picks are being prepared.</p>
              <p className="text-xs">Our AI publishes picks for each day&apos;s matches — check back shortly.</p>
            </div>
          ) : day.pendingApproval ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <ShieldCheck className="h-8 w-8 opacity-40 text-amber-500" />
              <p className="text-sm font-medium">Picks are being reviewed</p>
              <p className="text-xs">Our team is verifying today&apos;s AI selections before publishing. Check back shortly.</p>
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
  balanceLoading = false,
}: {
  open: boolean;
  onClose: () => void;
  onUnlocked: (data: { daysRemaining: number; startDayOffset: number }) => void;
  walletBalance?: number;
  balanceLoading?: boolean;
}) {
  const COST_KES = 5000;
  const { fmt, countryCode } = useCurrency();
  const isMpesaCountry = countryCode === 'KE' || countryCode === 'TZ';
  const { isAuthenticated } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  const [walletContrib, setWalletContrib] = useState(0);
  const [step, setStep] = useState<'choose' | 'mpesa-form' | 'topup-form' | 'pending' | 'card-form' | 'card-otp'>('choose');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardOtp, setCardOtp] = useState('');
  const [cardRef, setCardRef] = useState<string | null>(null);
  const [cardOtpPrompt, setCardOtpPrompt] = useState('');
  const autoAdvancedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canPayFull = walletBalance >= COST_KES;
  const canPayPartial = walletBalance > 0 && walletBalance < COST_KES;

  useEffect(() => {
    if (!open) {
      setStep('choose');
      setError('');
      setReference(null);
      setTopUpAmount(null);
      setWalletContrib(0);
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setCardOtp('');
      setCardRef(null);
      setCardOtpPrompt('');
      autoAdvancedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    // Auto-route to topup-form as soon as balance is loaded and user has partial balance
    if (!balanceLoading && isAuthenticated && canPayPartial && !autoAdvancedRef.current) {
      autoAdvancedRef.current = true;
      setTopUpAmount(COST_KES - walletBalance);
      setWalletContrib(walletBalance);
      setStep('topup-form');
    }
  }, [open, balanceLoading, canPayPartial, walletBalance, isAuthenticated]);

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

  // Pay via card (Paystack Direct Charge)
  const handleCardPay = async () => {
    const rawNum = cardNumber.replace(/\s/g, '');
    if (rawNum.length < 13) { setError('Enter a valid card number.'); return; }
    const [expM, expY] = cardExpiry.split('/');
    if (!expM || !expY || expM.length !== 2 || expY.length < 2) { setError('Enter expiry as MM/YY.'); return; }
    if (!cardCvv || cardCvv.length < 3) { setError('Enter your card security code.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/paystack/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card: { number: rawNum, cvv: cardCvv, expiry_month: expM, expiry_year: expY.slice(-2) },
          amount: COST_KES,
          purpose: 'strategy',
          currency: 'KES',
        }),
      });
      const data = await res.json() as { success?: boolean; needsOtp?: boolean; reference?: string; displayText?: string; error?: string; daysRemaining?: number; startDayOffset?: number };
      if (data.success) {
        onUnlocked({ daysRemaining: data.daysRemaining || 7, startDayOffset: data.startDayOffset || 0 });
        onClose();
        return;
      }
      if (data.needsOtp && data.reference) {
        setCardRef(data.reference);
        setCardOtpPrompt(data.displayText || 'Enter the OTP sent to your phone or email.');
        setStep('card-otp');
        return;
      }
      setError(data.error || 'Card payment failed. Please try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Submit OTP for card payment
  const handleCardOtpSubmit = async () => {
    if (!cardOtp.trim() || !cardRef) { setError('Enter the OTP code.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/paystack/submit-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: cardOtp.trim(), reference: cardRef }),
      });
      const data = await res.json() as { success?: boolean; error?: string; daysRemaining?: number; startDayOffset?: number };
      if (data.success) {
        onUnlocked({ daysRemaining: data.daysRemaining || 7, startDayOffset: data.startDayOffset || 0 });
        onClose();
        return;
      }
      setError(data.error || 'OTP verification failed. Please try again.');
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

  const pendingMpesaAmount = topUpAmount ?? COST_KES;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pb-16 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* flex flex-col so header + content + footer stack correctly; max-h prevents overflow */}
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl flex flex-col" style={{ maxHeight: 'min(95vh, 640px)' }}>
        {/* Header — never scrolls away */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
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

        {/* ── Scrollable info + form area ── */}
        <div className="px-5 pt-1 pb-3 space-y-3 flex-1 min-h-0 overflow-y-auto">

          {/* Price banner — always shown except on pending step */}
          {step !== 'pending' && (
            <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/8 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">{fmt(COST_KES)} / week</p>
                  <p className="text-[11px] text-muted-foreground">7-day access, starts today</p>
                </div>
              </div>
              {isAuthenticated && walletBalance > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Wallet</p>
                  <p className="text-sm font-mono font-bold text-primary">{fmt(walletBalance)}</p>
                </div>
              )}
            </div>
          )}

          {/* Benefits — shown for not-auth and choose steps */}
          {(!isAuthenticated || step === 'choose') && step !== 'pending' && (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 space-y-1.5">
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
          )}

          {/* ── Not signed in: prompt text only ── */}
          {!isAuthenticated && (
            <p className="text-sm text-muted-foreground text-center">Sign in to continue with your subscription</p>
          )}

          {/* ── Choose: error + balance loading indicator only ── */}
          {isAuthenticated && step === 'choose' && (
            <>
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
              {balanceLoading && (
                <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking wallet balance…
                </div>
              )}
            </>
          )}

          {/* ── M-Pesa form: back + inputs + disclaimer ── */}
          {isAuthenticated && step === 'mpesa-form' && (
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
              <p className="text-[11px] text-muted-foreground text-center">M-Pesa payment goes to Betcheza — this does NOT affect your wallet balance.</p>
            </div>
          )}

          {/* ── Top-up form: back + breakdown + inputs ── */}
          {isAuthenticated && step === 'topup-form' && (
            <div className="space-y-3">
              <button onClick={() => { setStep('choose'); setError(''); setTopUpAmount(null); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 px-4 py-3 space-y-1 text-xs">
                <p className="font-semibold text-blue-600 dark:text-blue-400">Split payment breakdown</p>
                <p className="text-muted-foreground">✓ {fmt(walletBalance)} — deducted from your wallet automatically</p>
                <p className="text-muted-foreground">📱 {fmt(topUpAmount ?? COST_KES - walletBalance)} — you will receive an M-Pesa STK push</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">M-Pesa number for {fmt(topUpAmount ?? COST_KES - walletBalance)} top-up</label>
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
            </div>
          )}

          {/* ── Card form ── */}
          {isAuthenticated && step === 'card-form' && (
            <div className="space-y-3">
              <button onClick={() => { setStep('choose'); setError(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Card Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, '').slice(0, 16);
                    v = v.replace(/(.{4})/g, '$1 ').trim();
                    setCardNumber(v);
                  }}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Expiry</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={e => {
                      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                      setCardExpiry(v);
                    }}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Security Code</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="•••"
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            </div>
          )}

          {/* ── Card OTP ── */}
          {isAuthenticated && step === 'card-otp' && (
            <div className="space-y-3">
              <button onClick={() => { setStep('card-form'); setError(''); setCardOtp(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-center space-y-1">
                <p className="font-semibold text-primary">Verification Required</p>
                <p className="text-muted-foreground">{cardOtpPrompt}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">OTP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter code"
                  value={cardOtp}
                  onChange={e => setCardOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && handleCardOtpSubmit()}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-center tracking-widest"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            </div>
          )}

          {/* ── Pending: full content (no footer button needed) ── */}
          {isAuthenticated && step === 'pending' && (
            <div className="text-center space-y-4 py-4">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/30">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Check your phone!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your M-Pesa PIN to confirm the {fmt(pendingMpesaAmount)} payment
                    {walletContrib > 0 && <span className="block text-primary font-medium">{fmt(walletContrib)} already deducted from your wallet</span>}
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

        {/* ── Sticky CTA footer — always visible, never scrolls away ── */}
        {step !== 'pending' && (
          <div className="shrink-0 px-5 pb-5 pt-3 border-t border-border/40">
            {!isAuthenticated ? (
              <button
                onClick={() => { onClose(); openAuthModal('login'); }}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                Sign In / Register
              </button>
            ) : step === 'choose' ? (
              !balanceLoading && (
                <div className="space-y-2.5">
                  {canPayFull && (
                    <button
                      onClick={handleWalletPay}
                      disabled={loading}
                      className="w-full rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 py-3 text-sm font-bold text-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                      Pay {fmt(COST_KES)} from Wallet
                    </button>
                  )}
                  {canPayFull && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[11px] text-muted-foreground">or pay via</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  {/* M-Pesa — KE / TZ only */}
                  {isMpesaCountry && !canPayPartial && (
                    <button
                      onClick={() => setStep('mpesa-form')}
                      className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Phone className="h-4 w-4" /> Pay {fmt(COST_KES)} via M-Pesa
                    </button>
                  )}
                  {/* Card payment — available everywhere */}
                  <button
                    onClick={() => { setStep('card-form'); setError(''); }}
                    className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" /> Pay {fmt(COST_KES)} via Card
                  </button>
                </div>
              )
            ) : step === 'mpesa-form' ? (
              <button
                onClick={handleMpesaPay}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><CreditCard className="h-4 w-4" /> Pay {fmt(COST_KES)} &amp; Unlock</>}
              </button>
            ) : step === 'topup-form' ? (
              <button
                onClick={handleTopUpPay}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><CreditCard className="h-4 w-4" /> Confirm &amp; Top Up {fmt(topUpAmount ?? COST_KES - walletBalance)}</>}
              </button>
            ) : step === 'card-form' ? (
              <button
                onClick={handleCardPay}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><CreditCard className="h-4 w-4" /> Pay {fmt(COST_KES)} &amp; Unlock</>}
              </button>
            ) : step === 'card-otp' ? (
              <button
                onClick={handleCardOtpSubmit}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : 'Confirm Payment'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

const PAST_WEEKS_INITIAL = 3;

function PastWeeksSection({ past }: { past: WeeklyStrategy[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? past : past.slice(0, PAST_WEEKS_INITIAL);
  const hidden = past.length - PAST_WEEKS_INITIAL;
  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        <Coins className="h-4 w-4" /> Past Weeks
      </h2>
      <div className="space-y-3">
        {visible.map((week) => {
          const wins = week.days.filter((d) => d.result === 'win').length;
          const losses = week.days.filter((d) => d.result === 'loss').length;
          const pending = week.days.filter((d) => !d.result).length;
          return (
            <PastWeekCard key={week.weekId} week={week} wins={wins} losses={losses} pending={pending} />
          );
        })}
      </div>
      {!showAll && hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-lg border border-border bg-muted/30 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          Show {hidden} older week{hidden !== 1 ? 's' : ''}
        </button>
      )}
      {showAll && past.length > PAST_WEEKS_INITIAL && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-3 w-full rounded-lg border border-border bg-muted/30 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function PastWeekCard({ week, wins, losses, pending }: {
  week: WeeklyStrategy;
  wins: number;
  losses: number;
  pending: number;
}) {
  const [open, setOpen] = useState(false);
  const hasSettled = wins + losses > 0;
  const pl = week.weeklyProfit;
  const plPositive = pl >= 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="font-semibold text-sm">
              Week of {new Date(week.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground">
                {wins} wins · {losses} losses{pending > 0 ? ` · ${pending} pending` : ''}
              </p>
              {hasSettled && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  plPositive ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
                )}>
                  {plPositive ? '+' : ''}KES {Math.abs(pl).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {week.days.map((d) => (
              <div
                key={d.day}
                className={cn(
                  'h-2 w-2 rounded-full',
                  d.result === 'win' ? 'bg-green-500' : d.result === 'loss' ? 'bg-red-500' : 'bg-muted'
                )}
                title={`Day ${d.day}: ${d.result || 'pending'}`}
              />
            ))}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          {week.days.map((day, i) => {
            const planItem = WEEK_PLAN[i] || WEEK_PLAN[0];
            return (
              <div
                key={day.day}
                className={cn(
                  'rounded-lg border p-2.5',
                  day.result === 'win' ? 'border-green-500/30 bg-green-500/5' :
                  day.result === 'loss' ? 'border-red-500/30 bg-red-500/5' :
                  'border-border bg-muted/20'
                )}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      day.result === 'win' ? 'bg-green-500 text-white' :
                      day.result === 'loss' ? 'bg-red-500 text-white' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {day.result === 'win' ? '✓' : day.result === 'loss' ? '✗' : `D${day.day}`}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Day {day.day}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right text-[11px]">
                    <span className="text-muted-foreground">Stake: <span className="font-mono font-bold text-foreground">{formatKES(planItem.stake)}</span></span>
                    <span className="text-muted-foreground">Win: <span className="font-mono font-bold text-green-500">{formatKES(planItem.targetWin)}</span></span>
                  </div>
                </div>

                {/* Picks */}
                {day.picks.length > 0 ? (
                  <div className="space-y-1.5 mt-1">
                    {day.picks.map((pick) => (
                      <div
                        key={pick.id}
                        className={cn(
                          'rounded-md border px-2.5 py-2 text-xs',
                          pick.result === 'win' ? 'border-green-500/20 bg-green-500/5' :
                          pick.result === 'loss' ? 'border-red-500/20 bg-red-500/5' :
                          'border-border bg-card'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <PickResultIcon result={pick.result} />
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{pick.homeTeam} vs {pick.awayTeam}</p>
                              <p className="text-[10px] text-muted-foreground">{pick.league}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="font-mono font-bold text-primary">@{pick.odds.toFixed(2)}</span>
                            {pick.actualScore && (
                              <p className="text-[10px] text-muted-foreground">{pick.actualScore}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{pick.market}</span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{pick.pick}</span>
                          {pick.result === 'win' && <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-bold text-green-600">WON ✓</span>}
                          {pick.result === 'loss' && <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-600">LOST ✗</span>}
                        </div>
                      </div>
                    ))}
                    {day.combinedOdds > 0 && (
                      <p className="text-[11px] text-right text-muted-foreground pt-0.5">
                        Combined: <span className="font-mono font-bold text-primary">{day.combinedOdds.toFixed(2)}x</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-2">No picks recorded for this day.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Compact right-sidebar past weeks list                    */
/* ────────────────────────────────────────────────────────── */
function PastWeeksSidebar({ past }: { past: WeeklyStrategy[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const INITIAL = 4;
  const visible = showAll ? past : past.slice(0, INITIAL);

  return (
    <div className="space-y-2">
      {visible.map((week) => {
        const wins = week.days.filter(d => d.result === 'win').length;
        const losses = week.days.filter(d => d.result === 'loss').length;
        const isOpen = expanded === week.weekId;
        const allSettled = week.days.every(d => d.result === 'win' || d.result === 'loss');
        const successRate = allSettled && week.days.length > 0
          ? Math.round((wins / week.days.length) * 100) : null;

        const pl = week.weeklyProfit;
        const plPositive = pl >= 0;
        const plAbs = Math.abs(pl);
        const plLabel = plAbs >= 1000
          ? `${plPositive ? '+' : '-'}${(plAbs / 1000).toFixed(plAbs % 1000 === 0 ? 0 : 1)}K`
          : `${plPositive ? '+' : '-'}${plAbs}`;
        const hasSettled = wins + losses > 0;

        return (
          <div key={week.weekId} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : week.weekId)}
              className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">
                  {new Date(week.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {week.days.map(d => (
                    <div
                      key={d.day}
                      className={cn('h-2 w-2 rounded-full shrink-0',
                        d.result === 'win' ? 'bg-green-500' :
                        d.result === 'loss' ? 'bg-red-500' : 'bg-muted')}
                      title={`Day ${d.day}: ${d.result || 'pending'}`}
                    />
                  ))}
                  {successRate !== null && (
                    <span className={cn('text-[10px] font-bold ml-0.5',
                      successRate >= 70 ? 'text-green-600' :
                      successRate >= 50 ? 'text-amber-600' : 'text-red-500')}>
                      {successRate}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-[10px] text-muted-foreground">{wins}W/{losses}L</span>
                {hasSettled && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    plPositive ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
                  )}>
                    {plLabel}
                  </span>
                )}
                {isOpen
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5">
                {week.days.map((day, i) => {
                  const planItem = WEEK_PLAN[i] || WEEK_PLAN[0];
                  return (
                    <div key={day.day} className={cn(
                      'rounded-lg border px-2.5 py-2',
                      day.result === 'win' ? 'border-green-500/30 bg-green-500/5' :
                      day.result === 'loss' ? 'border-red-500/30 bg-red-500/5' :
                      'border-border bg-muted/20'
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                            day.result === 'win' ? 'bg-green-500 text-white' :
                            day.result === 'loss' ? 'bg-red-500 text-white' :
                            'bg-muted text-muted-foreground')}>
                            {day.result === 'win' ? '✓' : day.result === 'loss' ? '✗' : `${day.day}`}
                          </div>
                          <span className="text-[11px] font-semibold">D{day.day}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(day.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <span className="text-[10px] font-mono text-green-500">{planItem.targetWin.toLocaleString()}</span>
                      </div>
                      {day.picks.length > 0 && (
                        <div className="space-y-1 mt-1">
                          {day.picks.map(pick => (
                            <div key={pick.id} className={cn(
                              'rounded border px-2 py-1 text-[10px]',
                              pick.result === 'win' ? 'border-green-500/20 bg-green-500/5' :
                              pick.result === 'loss' ? 'border-red-500/20 bg-red-500/5' :
                              'border-border'
                            )}>
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  <PickResultIcon result={pick.result} />
                                  <span className="truncate font-medium">{pick.homeTeam} vs {pick.awayTeam}</span>
                                </div>
                                <span className="font-mono font-bold text-primary shrink-0">@{pick.odds.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 pl-5">
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">{pick.market}</span>
                                <span className="text-muted-foreground">{pick.pick}</span>
                              </div>
                            </div>
                          ))}
                          {day.combinedOdds > 0 && (
                            <p className="text-right text-[10px] text-muted-foreground pt-0.5">
                              Combined: <span className="font-mono font-bold text-primary">{day.combinedOdds.toFixed(2)}x</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!showAll && past.length > INITIAL && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full rounded-lg border border-border bg-muted/20 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          Show {past.length - INITIAL} more week{past.length - INITIAL !== 1 ? 's' : ''}
        </button>
      )}
      {showAll && past.length > INITIAL && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full rounded-lg border border-border bg-muted/20 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Cumulative P&L Line Chart                                */
/* ────────────────────────────────────────────────────────── */
interface ChartPoint {
  weekId: string;
  weekStart: string;
  weekLabel: string;
  weekProfit: number;
  cumulativePnL: number;
  wins: number;
  losses: number;
}

interface HistoryData {
  chartPoints: ChartPoint[];
  totalPnL: number;
  totalWins: number;
  totalLosses: number;
  bestWeekProfit: number;
  weeksTracked: number;
}

function CustomPnLTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isPosWeek = d.weekProfit >= 0;
  const isTotalPos = d.cumulativePnL >= 0;
  return (
    <div className="rounded-xl border border-border bg-background/95 backdrop-blur p-3 shadow-lg text-xs min-w-[160px]">
      <p className="font-bold text-foreground mb-2">Week of {d.weekLabel}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Week P&L</span>
          <span className={cn('font-mono font-bold', isPosWeek ? 'text-emerald-600' : 'text-red-500')}>
            {isPosWeek ? '+' : ''}KES {d.weekProfit.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cumulative</span>
          <span className={cn('font-mono font-bold', isTotalPos ? 'text-emerald-600' : 'text-red-500')}>
            {isTotalPos ? '+' : ''}KES {d.cumulativePnL.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-border">
          <span className="text-muted-foreground">Days</span>
          <span className="font-semibold">
            <span className="text-emerald-600">{d.wins}W</span>
            {' / '}
            <span className="text-red-500">{d.losses}L</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function CumulativePnLChart() {
  const { data, isLoading } = useSWR<HistoryData>('/api/strategy/history', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading performance history…</span>
      </div>
    );
  }

  const points = data?.chartPoints || [];
  const totalPnL = data?.totalPnL || 0;
  const totalWins = data?.totalWins || 0;
  const totalLosses = data?.totalLosses || 0;
  const bestWeek = data?.bestWeekProfit || 0;
  const weeksTracked = data?.weeksTracked || 0;

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <BarChart2 className="h-8 w-8 opacity-30" />
        <p className="text-sm">No historical data yet. Performance chart will appear after the first settled week.</p>
      </div>
    );
  }

  const isPosTotal = totalPnL >= 0;
  const lineColor = isPosTotal ? '#22c55e' : '#ef4444';
  const gradientId = 'pnlGradient';

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total P&L',
            value: `${isPosTotal ? '+' : ''}KES ${Math.abs(totalPnL).toLocaleString()}`,
            color: isPosTotal ? 'text-emerald-600' : 'text-red-500',
            sub: `${weeksTracked} week${weeksTracked !== 1 ? 's' : ''} tracked`,
          },
          {
            label: 'Days Won',
            value: String(totalWins),
            color: 'text-emerald-600',
            sub: `${totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0}% success rate`,
          },
          {
            label: 'Days Lost',
            value: String(totalLosses),
            color: 'text-red-500',
            sub: `across all weeks`,
          },
          {
            label: 'Best Week',
            value: `+KES ${bestWeek.toLocaleString()}`,
            color: 'text-amber-600',
            sub: 'single week profit',
          },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{s.label}</div>
            <div className={cn('text-base font-bold font-mono', s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Line chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cumulative P&L (KES)</span>
          <span className={cn('text-xs font-bold font-mono', isPosTotal ? 'text-emerald-600' : 'text-red-500')}>
            {isPosTotal ? '▲' : '▼'} KES {Math.abs(totalPnL).toLocaleString()} all-time
          </span>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(0)}K`}
                width={38}
              />
              <Tooltip content={<CustomPnLTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 2' }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" opacity={0.5} />
              <Line
                type="monotone"
                dataKey="cumulativePnL"
                stroke={lineColor}
                strokeWidth={2.5}
                dot={(props: { cx: number; cy: number; payload: ChartPoint; index: number }) => {
                  const isLast = props.index === points.length - 1;
                  if (!isLast) return <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={2.5} fill={lineColor} fillOpacity={0.7} />;
                  return (
                    <circle
                      key={`dot-last-${props.index}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={5}
                      fill={lineColor}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 6, fill: lineColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-in-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          P&L based on the 7-day compound strategy outcomes. Each point = one week. Win day: +KES (target − stake). Loss day: −KES (stake).
        </p>
      </div>
    </div>
  );
}

interface AccessInfo {
  hasAccess: boolean;
  isExpired?: boolean;
  expiredAt?: string;
  expiresAt?: string;
  startDayOffset?: number;
  daysRemaining?: number;
  walletBalance?: number;
  pendingReference?: string;
  pendingAt?: string;
  autoResolved?: boolean;
}

export default function StrategyPage() {
  const { data, isLoading, mutate } = useSWR<{ current: WeeklyStrategy; past: WeeklyStrategy[] }>(
    '/api/strategy/predictions',
    fetcher,
    {
      revalidateOnFocus: false,
      // Poll every 30 s when today has pending picks — shows live scores and catches
      // early settlements (e.g. Under blown mid-game) without a page reload.
      refreshInterval: () => {
        const todayDay = (window as { __strategyData?: { current?: WeeklyStrategy } }).__strategyData?.current?.days?.find(
          (d) => d.status === 'active'
        );
        return todayDay?.picks.some((p) => p.result === 'pending') ? 30_000 : 0;
      },
    }
  );

  // Expose data to the refreshInterval closure
  useEffect(() => {
    if (data) {
      (window as { __strategyData?: unknown }).__strategyData = data;
    }
  }, [data]);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { fmt } = useCurrency();

  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [resettling, setResettling] = useState(false);
  const [resettleResult, setResettleResult] = useState<{ totalFixed: number; daysUpdated: number } | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const pendingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAccess = () =>
    fetch('/api/strategy/access')
      .then(r => r.json())
      .then((d: AccessInfo) => {
        setAccess(d);
        return d;
      })
      .catch(() => { setAccess({ hasAccess: false }); return { hasAccess: false } as AccessInfo; });

  useEffect(() => {
    fetchAccess().then((d) => {
      // If user has a pending payment on page load, auto-start polling to detect it
      if (!d.hasAccess && d.pendingReference) {
        startPendingPoll(d.pendingReference);
      }
    });
    return () => { if (pendingPollRef.current) clearInterval(pendingPollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPendingPoll = (ref: string) => {
    if (pendingPollRef.current) clearInterval(pendingPollRef.current);
    let attempts = 0;
    pendingPollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/strategy/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check', reference: ref }),
        });
        const d = await res.json() as AccessInfo & { status?: string };
        if (d.hasAccess) {
          clearInterval(pendingPollRef.current!);
          setAccess(d);
          return;
        }
        if (d.status === 'failed' || attempts >= 36) {
          clearInterval(pendingPollRef.current!);
        }
      } catch { /* silent */ }
    }, 5000);
  };

  const handleCheckPayment = async () => {
    setCheckingPayment(true);
    try {
      const d = await fetchAccess();
      if (!d.hasAccess && d.pendingReference) {
        startPendingPoll(d.pendingReference);
      }
    } finally {
      setCheckingPayment(false);
    }
  };

  async function handleResettle() {
    setResettling(true);
    setResettleResult(null);
    try {
      const res = await fetch('/api/admin/strategy/resettle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const json = await res.json();
      setResettleResult(json.summary ?? { totalFixed: 0, daysUpdated: 0 });
      mutate();
    } catch {
      setResettleResult({ totalFixed: 0, daysUpdated: 0 });
    } finally {
      setResettling(false);
    }
  }

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
    <div className="w-full px-3 py-4 sm:px-4 sm:py-6">
      {/* Subscribe Modal */}
      <SubscribeModal
        open={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        onUnlocked={(d) => setAccess({ hasAccess: true, ...d })}
        walletBalance={access?.walletBalance ?? 0}
        balanceLoading={access === null}
      />

      {/* ── Expired subscription banner ── */}
      {!hasAccess && access?.isExpired && !access?.pendingReference && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/8 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Your subscription has expired</p>
                <p className="text-xs text-muted-foreground">
                  {access.expiredAt
                    ? `Expired ${new Date(access.expiredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
                    : 'Your 7-day access period ended.'}{' '}
                  Re-subscribe to unlock today's picks instantly.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-sm"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Re-subscribe — {fmt(5000)}
            </button>
          </div>
          {/* Compact wallet hint if they have balance */}
          {(access?.walletBalance ?? 0) >= 5000 && (
            <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-2 flex items-center justify-between gap-2">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <Coins className="inline h-3 w-3 mr-1" />
                You have {fmt(access?.walletBalance ?? 0)} in your wallet — enough to pay instantly.
              </p>
              <button
                onClick={async () => {
                  const res = await fetch('/api/strategy/access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'wallet' }),
                  });
                  const d = await res.json() as AccessInfo;
                  if (d.hasAccess) {
                    setAccess(d);
                  } else {
                    setShowSubscribeModal(true);
                  }
                }}
                className="shrink-0 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5"
              >
                <Coins className="h-3 w-3" /> Pay from wallet
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Pending payment banner ── */}
      {!hasAccess && access?.pendingReference && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Payment in progress</p>
              <p className="text-xs text-muted-foreground">Checking for your M-Pesa payment automatically…</p>
            </div>
          </div>
          <button
            onClick={handleCheckPayment}
            disabled={checkingPayment}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {checkingPayment ? <><Loader2 className="h-3 w-3 animate-spin" /> Checking…</> : <><RefreshCw className="h-3 w-3" /> Check now</>}
          </button>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold">3 Daily Odds Winning Strategy</h1>
          </div>
          <div className="flex items-center gap-2">
            <StrategyNotifBell />
            {isAdmin && (
              <button
                onClick={handleResettle}
                disabled={resettling}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
                title="Re-settle all pending picks from past matches"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resettling ? 'animate-spin' : ''}`} />
                {resettling ? 'Settling…' : 'Resettle Picks'}
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          A 7-day compounding football bet strategy. Each day we publish picks whose <strong>combined odds land between 3.0–4.0</strong>. Subscribe weekly — your personal 7-day plan starts the day you join.
        </p>
        {resettleResult !== null && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${resettleResult.totalFixed > 0 ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-muted text-muted-foreground'}`}>
            {resettleResult.totalFixed > 0
              ? `✓ Settled ${resettleResult.totalFixed} pick${resettleResult.totalFixed !== 1 ? 's' : ''} across ${resettleResult.daysUpdated} day${resettleResult.daysUpdated !== 1 ? 's' : ''}`
              : 'All picks already up to date — no changes needed'}
          </div>
        )}
      </div>

      {/* ── 3-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr_minmax(220px,280px)] gap-5 items-start">

        {/* ═══════════════════════════════════════════════
            LEFT SIDEBAR — Plan overview + subscription
            ═══════════════════════════════════════════════ */}
        <aside className="lg:sticky lg:top-4 space-y-3">

          {/* Active subscription badge */}
          {hasAccess && expiresDate && (
            <div className="flex flex-col gap-1 rounded-xl border border-green-500/30 bg-green-500/8 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="font-semibold">Active subscription</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pl-6">
                <span>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</span>
                <span>Renews {expiresDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          )}

          {/* How it works — non-subscribers */}
          {!hasAccess && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><Info className="h-3.5 w-3.5 shrink-0" /> How it works</p>
              <p>Pay {fmt(5000)} and your <strong>personal 7-day plan starts immediately</strong>. Yesterday&apos;s picks are always free.</p>
            </div>
          )}

          {/* Subscribe CTA */}
          {!hasAccess && (
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <CreditCard className="h-4 w-4" />
              Subscribe — {fmt(5000)}
            </button>
          )}

          {/* Weekly Plan Overview table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Weekly Plan</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wide">
                    <th className="px-3 py-2.5 text-left font-medium">Day</th>
                    <th className="px-3 py-2.5 text-right font-medium">Stake</th>
                    <th className="px-3 py-2.5 text-right font-medium text-blue-500">Save</th>
                    <th className="px-3 py-2.5 text-right font-medium text-green-500">Win</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEK_PLAN.map((p) => {
                    const dayData = current?.days?.find(d => d.day === p.day);
                    const todayDayNum = current?.days?.find(d => d.status === 'active')?.day;
                    const isCurrentDay = todayDayNum === p.day;
                    const result = dayData?.result;
                    return (
                      <tr key={p.day} className={cn(
                        'border-b border-border/50 last:border-0 transition-colors',
                        isCurrentDay ? 'bg-primary/8' :
                        result === 'win' ? 'bg-green-500/5' :
                        result === 'loss' ? 'bg-red-500/5' :
                        'hover:bg-muted/20'
                      )}>
                        <td className="px-3 py-2.5 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                              isCurrentDay ? 'bg-primary text-primary-foreground' :
                              result === 'win' ? 'bg-green-500 text-white' :
                              result === 'loss' ? 'bg-red-500 text-white' :
                              'bg-muted text-muted-foreground'
                            )}>
                              {result === 'win' ? '✓' : result === 'loss' ? '✗' : p.day}
                            </span>
                            <span className={cn('font-semibold', isCurrentDay ? 'text-primary' : '')}>D{p.day}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmt(p.stake)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-blue-500 font-semibold">{p.save > 0 ? fmt(p.save) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-green-500">{fmt(p.targetWin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 text-[10px] font-semibold border-t border-border">
                    <td className="px-3 py-2.5 text-muted-foreground">Total</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmt(WEEK_PLAN.reduce((s, p) => s + p.stake, 0))}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-500">{fmt(WEEK_PLAN.reduce((s, p) => s + p.save, 0))}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-green-600">{fmt(WEEK_PLAN.reduce((s, p) => s + p.targetWin, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-3 pb-2.5 pt-1.5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Save a portion each day — total savings {fmt(WEEK_PLAN.reduce((s, p) => s + p.save, 0))}. Stake only what you can afford to lose.
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>Strategy guide only — not a guarantee. AI-assisted, not financial advice.</span>
          </div>

          {/* Renewal notice */}
          {hasAccess && daysRemaining !== undefined && daysRemaining <= 2 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span>Expires in <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</strong>. Renew to keep access.</span>
            </div>
          )}
        </aside>

        {/* ═══════════════════════════════════════════════
            CENTER — Current week daily picks
            ═══════════════════════════════════════════════ */}
        <main className="min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading picks…</span>
            </div>
          ) : current ? (
            <div>
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
                {(current?.days || WEEK_PLAN.map((p) => ({
                  day: p.day, date: '', picks: [], combinedOdds: 0,
                  status: 'upcoming' as const,
                  stake: p.stake, save: p.save, targetWin: p.targetWin,
                }))).map((day, i) => {
                  const browserTodayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
                  const isToday = day.status === 'active' && (!day.date || day.date === browserTodayStr);
                  const isYesterday = i === yesterdayPlanIndex;
                  const isBrowserFuture = day.date > browserTodayStr;
                  const isSettled = (day.result === 'win' || day.result === 'loss') &&
                    day.picks.length > 0 && day.picks.every(p => p.result === 'win' || p.result === 'loss');
                  const nowUTC = Date.now();
                  const eatHour = Math.floor(((nowUTC % 86400000) + 3 * 3600000) / 3600000) % 24;
                  const pastEveningCutoff = eatHour >= 21;
                  const todayFreeAfterCutoff = isToday && pastEveningCutoff;
                  const isLocked = !isSettled && !hasAccess && !isYesterday &&
                    !todayFreeAfterCutoff && (day.status === 'upcoming' || isToday);

                  return (
                    <DayCard
                      key={day.day}
                      day={day}
                      planItem={WEEK_PLAN[i]}
                      isLocked={isLocked}
                      isYesterday={!hasAccess && isYesterday}
                      isSettled={isSettled}
                      isBrowserFuture={isBrowserFuture && !isSettled}
                      isAdmin={isAdmin}
                      onSubscribe={() => setShowSubscribeModal(true)}
                      fmt={fmt}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <Circle className="h-10 w-10 opacity-20" />
              <p className="text-sm">No picks available yet. Check back shortly.</p>
            </div>
          )}
        </main>

        {/* ═══════════════════════════════════════════════
            RIGHT SIDEBAR — Past weeks
            ═══════════════════════════════════════════════ */}
        <aside className="min-w-0">
          {past.length > 0 ? (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <Coins className="h-4 w-4" /> Past Weeks
              </h2>
              <PastWeeksSidebar past={past} />
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center gap-2 py-10 text-center text-muted-foreground/40">
              <Coins className="h-8 w-8" />
              <p className="text-xs">Past weeks will appear here</p>
            </div>
          )}
        </aside>

      </div>

      {/* ═══════════════════════════════════════════════
          CUMULATIVE P&L CHART — Full-width below grid
          ═══════════════════════════════════════════════ */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Cumulative Performance</h2>
          <span className="text-xs text-muted-foreground">— all-time P&amp;L across every settled week</span>
        </div>
        <CumulativePnLChart />
      </div>

    </div>
  );
}
