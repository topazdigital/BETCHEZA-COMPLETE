'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy, X, ShieldCheck, Coins, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';

interface Props {
  open: boolean;
  onClose: () => void;
  competitionName: string;
  competitionSlug?: string;
  amount: number;
  currency: string;
  onSuccess: (paymentRef: string) => void;
}

type Step = 'choose' | 'mpesa-form' | 'topup-form' | 'pending';

export function CompetitionPaymentModal({
  open,
  onClose,
  competitionName,
  competitionSlug,
  amount,
  currency,
  onSuccess,
}: Props) {
  const { isAuthenticated } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  const [step, setStep] = useState<Step>('choose');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  const [walletContrib, setWalletContrib] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canPayFull = walletBalance >= amount;
  const canPayPartial = walletBalance > 0 && walletBalance < amount;

  // Fetch wallet balance when modal opens
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    fetch('/api/payments/competition-entry')
      .then(r => r.ok ? r.json() : { balance: 0 })
      .then(d => setWalletBalance(typeof d.balance === 'number' ? d.balance : 0))
      .catch(() => setWalletBalance(0));
  }, [open, isAuthenticated]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep('choose');
      setError('');
      setReference(null);
      setTopUpAmount(null);
      setWalletContrib(0);
      setPhone('');
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = (ref: string, onConfirmed: () => void) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/payments/competition-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check', reference: ref }),
        });
        const data = await res.json() as { success?: boolean; status?: string };
        if (data.success) {
          clearInterval(pollRef.current!);
          onConfirmed();
          return;
        }
        if (data.status === 'failed' || attempts >= 30) {
          clearInterval(pollRef.current!);
          setStep(walletContrib > 0 ? 'topup-form' : 'mpesa-form');
          setError(data.status === 'failed' ? 'Payment was declined. Please try again.' : 'Payment timed out. If you paid, try again.');
        }
      } catch { /* silent */ }
    }, 5000);
  };

  // Full wallet payment
  const handleWalletPay = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payments/competition-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'wallet', amount, currency, competitionName, competitionSlug }),
      });
      const data = await res.json() as { success?: boolean; reference?: string; error?: string; balance?: number };
      if (data.success && data.reference) {
        onSuccess(data.reference);
        return;
      }
      if (typeof data.balance === 'number') setWalletBalance(data.balance);
      setError(data.error || 'Wallet payment failed. Please try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Init partial wallet + M-Pesa top-up (no phone yet — just get the amounts)
  const handleTopUpInit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payments/competition-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'wallet', amount, currency, competitionName, competitionSlug }),
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

  // Full M-Pesa payment
  const handleMpesaPay = async () => {
    const cleaned = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!cleaned || cleaned.length < 9) { setError('Enter a valid M-Pesa phone number'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payments/competition-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'mpesa', phone: cleaned, amount, currency, competitionName, competitionSlug }),
      });
      const data = await res.json() as { success?: boolean; reference?: string; error?: string };
      if (!data.success || !data.reference) {
        setError(data.error || 'Payment initiation failed. Please try again.');
        return;
      }
      setReference(data.reference);
      setStep('pending');
      startPolling(data.reference, () => onSuccess(data.reference!));
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Partial wallet + M-Pesa top-up (phone provided)
  const handleTopUpPay = async () => {
    const cleaned = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!cleaned || cleaned.length < 9) { setError('Enter a valid M-Pesa phone number'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payments/competition-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'wallet', phone: cleaned, amount, currency, competitionName, competitionSlug }),
      });
      const data = await res.json() as { success?: boolean; reference?: string; error?: string; walletContribution?: number };
      if (!data.success || !data.reference) {
        setError(data.error || 'Payment initiation failed. Please try again.');
        return;
      }
      setWalletContrib(data.walletContribution ?? walletContrib);
      setReference(data.reference);
      setStep('pending');
      startPolling(data.reference, () => onSuccess(data.reference!));
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const pendingMpesaAmount = topUpAmount ?? amount;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Join Competition</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{competitionName}</p>
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
                <p className="text-sm font-bold text-green-600 dark:text-green-400">{currency} {amount.toLocaleString()} entry fee</p>
                <p className="text-[11px] text-muted-foreground">One-time payment to join</p>
              </div>
            </div>
            {isAuthenticated && walletBalance > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Wallet</p>
                <p className="text-sm font-mono font-bold text-primary">{currency} {walletBalance.toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* ── Not signed in ── */}
          {!isAuthenticated ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Sign in to continue with payment</p>
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

              {/* Full wallet */}
              {canPayFull && (
                <button
                  onClick={handleWalletPay}
                  disabled={loading}
                  className="w-full rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 py-3.5 text-sm font-bold text-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                  Pay {currency} {amount.toLocaleString()} from Wallet
                </button>
              )}

              {/* Partial wallet + top-up */}
              {canPayPartial && (
                <button
                  onClick={handleTopUpInit}
                  disabled={loading}
                  className="w-full rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 py-3 text-sm font-semibold text-primary transition-colors disabled:opacity-60 flex flex-col items-center gap-0.5"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <span className="flex items-center gap-1.5">
                        <Coins className="h-4 w-4" />
                        Use {currency} {walletBalance.toLocaleString()} from Wallet + {currency} {(amount - walletBalance).toLocaleString()} via M-Pesa
                      </span>
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
                <Phone className="h-4 w-4" /> Pay {currency} {amount.toLocaleString()} via M-Pesa
              </button>
            </div>

          /* ── Full M-Pesa form ── */
          ) : step === 'mpesa-form' ? (
            <div className="space-y-3">
              <button onClick={() => { setStep('choose'); setError(''); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                ← Back
              </button>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">M-Pesa phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  inputMode="tel"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  You will receive an STK push to confirm <span className="font-semibold text-foreground">{currency} {amount.toLocaleString()}</span>.
                </p>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handleMpesaPay}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                Send STK Push — {currency} {amount.toLocaleString()}
              </button>
            </div>

          /* ── Top-up M-Pesa form ── */
          ) : step === 'topup-form' ? (
            <div className="space-y-3">
              <button onClick={() => { setStep('choose'); setError(''); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                ← Back
              </button>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wallet covers</span>
                  <span className="font-bold text-primary">{currency} {walletContrib.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">M-Pesa top-up needed</span>
                  <span className="font-bold text-foreground">{currency} {(topUpAmount ?? (amount - walletContrib)).toLocaleString()}</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">M-Pesa phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  inputMode="tel"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handleTopUpPay}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                Send STK Push — {currency} {(topUpAmount ?? (amount - walletContrib)).toLocaleString()}
              </button>
            </div>

          /* ── Pending M-Pesa confirmation ── */
          ) : step === 'pending' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-5 text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 border border-green-500/30 mx-auto">
                  <Loader2 className="h-6 w-6 text-green-500 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">STK push sent to {phone}</p>
                  <p className="text-xs text-muted-foreground mt-1">Enter your M-Pesa PIN on your phone to complete payment of <span className="font-semibold text-foreground">{currency} {pendingMpesaAmount.toLocaleString()}</span>.</p>
                </div>
                {walletContrib > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="text-primary font-semibold">{currency} {walletContrib.toLocaleString()}</span> already deducted from your wallet.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                Waiting for M-Pesa confirmation — checking every 5 seconds…
              </div>
              {error && (
                <div className="space-y-2">
                  <p className="text-xs text-red-500 text-center">{error}</p>
                  <button
                    onClick={() => { setStep(walletContrib > 0 ? 'topup-form' : 'mpesa-form'); setError(''); }}
                    className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground pt-1">
            <ShieldCheck className="h-3 w-3" /> Secured by Betcheza Payments
          </p>
        </div>
      </div>
    </div>
  );
}
