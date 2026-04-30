'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Smartphone, CreditCard, Wallet, ShieldCheck, ArrowDownToLine } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  competitionName: string;
  amount: number;
  currency: string;
  onSuccess: (paymentRef: string) => void;
}

type Method = 'mpesa' | 'card' | 'wallet';

export function CompetitionPaymentModal({
  open,
  onClose,
  competitionName,
  amount,
  currency,
  onSuccess,
}: Props) {
  const [method, setMethod] = useState<Method>('mpesa');
  const [phone, setPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stkSent, setStkSent] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Fetch wallet balance whenever the modal opens or method switches to wallet,
  // so the user can see whether they have enough before clicking Pay.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/payments/competition-entry')
      .then((r) => r.ok ? r.json() : { balance: 0 })
      .then((d) => { if (!cancelled) setWalletBalance(typeof d.balance === 'number' ? d.balance : 0); })
      .catch(() => { if (!cancelled) setWalletBalance(0); });
    return () => { cancelled = true; };
  }, [open]);

  const reset = () => {
    setError(null);
    setSubmitting(false);
    setStkSent(false);
  };

  const handlePay = async () => {
    setError(null);
    if (method === 'mpesa') {
      if (!/^(\+?254|0)?7\d{8}$/.test(phone.replace(/\s/g, ''))) {
        setError('Enter a valid M-Pesa number (e.g. 0712345678).');
        return;
      }
    } else if (method === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 13) { setError('Enter a valid card number.'); return; }
      if (!/^\d{2}\/\d{2}$/.test(cardExp)) { setError('Expiry must be MM/YY.'); return; }
      if (cardCvc.length < 3) { setError('CVC must be 3 digits.'); return; }
    }

    // Block wallet payments before we even hit the server when the user
    // clearly doesn't have enough — saves a roundtrip and the confusion of
    // a 402 from the API.
    if (method === 'wallet' && walletBalance !== null && walletBalance < amount) {
      setError(`Insufficient wallet balance. You have ${currency} ${walletBalance.toLocaleString()}. Top up first.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/payments/competition-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          amount,
          currency,
          competitionName,
          phone: method === 'mpesa' ? phone : undefined,
          cardLast4: method === 'card' ? cardNumber.replace(/\s/g, '').slice(-4) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || 'Payment failed. Please try again.');
        // If the server returned the latest balance, sync it.
        if (typeof data.balance === 'number') setWalletBalance(data.balance);
        setSubmitting(false);
        return;
      }
      if (method === 'mpesa') {
        setStkSent(true);
        // Simulate STK push delay then complete
        setTimeout(() => {
          onSuccess(data.reference);
        }, 1800);
      } else {
        onSuccess(data.reference);
      }
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-base">Pay entry fee</DialogTitle>
          <DialogDescription className="text-xs">
            {competitionName} · <span className="font-semibold text-foreground">{currency} {amount.toLocaleString()}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Method tabs */}
        <div className="px-5 pt-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setMethod('mpesa')}
              className={`flex flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors ${method === 'mpesa' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              <Smartphone className="h-3.5 w-3.5" /> M-Pesa
            </button>
            <button
              onClick={() => setMethod('card')}
              className={`flex flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors ${method === 'card' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              <CreditCard className="h-3.5 w-3.5" /> Card
            </button>
            <button
              onClick={() => setMethod('wallet')}
              className={`flex flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors ${method === 'wallet' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              <Wallet className="h-3.5 w-3.5" /> Wallet
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 pt-3 pb-4 space-y-2">
          {method === 'mpesa' && !stkSent && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide">M-Pesa phone number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                className="h-9 text-sm"
                inputMode="tel"
              />
              <p className="text-[10px] text-muted-foreground">
                You will receive an STK push prompt to confirm <span className="font-semibold text-foreground">{currency} {amount}</span>.
              </p>
            </div>
          )}
          {method === 'mpesa' && stkSent && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-center space-y-2">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
              <p className="text-xs font-semibold">STK push sent to {phone}</p>
              <p className="text-[10px] text-muted-foreground">Enter your M-Pesa PIN on your phone to complete payment…</p>
            </div>
          )}

          {method === 'card' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide">Card number</Label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/[^\d ]/g, '').slice(0, 19))}
                  placeholder="1234 5678 9012 3456"
                  className="h-9 text-sm"
                  inputMode="numeric"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wide">Expiry</Label>
                  <Input
                    value={cardExp}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                      setCardExp(v);
                    }}
                    placeholder="MM/YY"
                    className="h-9 text-sm"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wide">CVC</Label>
                  <Input
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    className="h-9 text-sm"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
          )}

          {method === 'wallet' && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Pay from Betcheza wallet</p>
                  <p className="text-[10px] text-muted-foreground">
                    {walletBalance === null
                      ? 'Loading balance…'
                      : <>Available <span className="font-semibold text-foreground">{currency} {walletBalance.toLocaleString()}</span> · Charge <span className="font-semibold text-foreground">{currency} {amount.toLocaleString()}</span></>
                    }
                  </p>
                </div>
                {walletBalance !== null && walletBalance < amount && (
                  <Link href="/dashboard/wallet" className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                    <ArrowDownToLine className="h-3 w-3" /> Top up
                  </Link>
                )}
              </div>
              {walletBalance !== null && walletBalance < amount && (
                <p className="text-[10px] text-rose-500">
                  Insufficient balance — short by {currency} {(amount - walletBalance).toLocaleString()}.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-[11px] text-rose-500 bg-rose-500/5 border border-rose-500/20 rounded p-2">{error}</p>
          )}

          {!stkSent && (
            <Button
              onClick={handlePay}
              disabled={submitting || (method === 'wallet' && walletBalance !== null && walletBalance < amount)}
              className="w-full h-9 text-xs"
              size="sm"
            >
              {submitting ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Processing…</>
              ) : method === 'wallet' && walletBalance !== null && walletBalance < amount ? (
                <>Insufficient wallet balance</>
              ) : (
                <>Pay {currency} {amount.toLocaleString()}</>
              )}
            </Button>
          )}

          <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground pt-1">
            <ShieldCheck className="h-3 w-3" /> Secured by Betcheza Payments
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
