'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, Smartphone, CreditCard,
  Building2, Bitcoin, Loader2, CheckCircle2, AlertTriangle,
  ArrowDownLeft, ArrowUpRight, Trophy, Gift, RotateCcw, Clock, Medal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

type DepositMethod = 'mpesa' | 'mpesa_till' | 'card' | 'bank' | 'crypto';
type WithdrawMethod = 'mpesa' | 'bank' | 'paypal' | 'crypto';

interface Txn {
  id: string;
  type: 'deposit' | 'withdraw' | 'competition_entry' | 'prize_payout' | 'refund' | 'adjustment';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  method?: string;
  description?: string;
  createdAt: string;
}

interface WalletResponse {
  success: boolean;
  balances: Record<string, number>;
  transactions: Txn[];
  referralBalance?: number;
}

interface Prize {
  id: string;
  amount: number;
  currency: string;
  createdAt: string;
  competitionId: number | null;
  competitionName: string;
  place: string | null;
  rank: number | null;
  description: string | null;
}

interface PrizesResponse {
  success: boolean;
  prizes: Prize[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TXN_ICON: Record<Txn['type'], { icon: typeof ArrowDownLeft; color: string; label: string }> = {
  deposit: { icon: ArrowDownLeft, color: 'text-emerald-500', label: 'Deposit' },
  withdraw: { icon: ArrowUpRight, color: 'text-rose-500', label: 'Withdraw' },
  competition_entry: { icon: Trophy, color: 'text-amber-500', label: 'Competition Entry' },
  prize_payout: { icon: Gift, color: 'text-violet-500', label: 'Prize' },
  refund: { icon: RotateCcw, color: 'text-blue-500', label: 'Refund' },
  adjustment: { icon: Wallet, color: 'text-muted-foreground', label: 'Adjustment' },
};

const MPESA_TILL_NUMBER = '9867233';

const DEPOSIT_METHODS: Array<{ id: DepositMethod; label: string; icon: typeof Smartphone; help: string }> = [
  { id: 'mpesa',      label: 'M-Pesa STK', icon: Smartphone, help: 'Instant prompt to phone' },
  { id: 'mpesa_till', label: 'M-Pesa Till', icon: Smartphone, help: `Pay to Till ${MPESA_TILL_NUMBER}` },
  { id: 'card',       label: 'Card',        icon: CreditCard, help: 'Visa / Mastercard / Verve' },
  { id: 'bank',       label: 'Bank',        icon: Building2,  help: 'Bank transfer / SWIFT / SEPA' },
  { id: 'crypto',     label: 'Crypto',      icon: Bitcoin,    help: 'USDT / BTC / ETH' },
];

const WITHDRAW_METHODS: Array<{ id: WithdrawMethod; label: string; icon: typeof Smartphone; help: string }> = [
  { id: 'mpesa',  label: 'M-Pesa',  icon: Smartphone, help: 'Send to your M-Pesa number' },
  { id: 'bank',   label: 'Bank',    icon: Building2,  help: 'Direct bank deposit' },
  { id: 'paypal', label: 'PayPal',  icon: CreditCard, help: 'Send to PayPal email' },
  { id: 'crypto', label: 'Crypto',  icon: Bitcoin,    help: 'Send to USDT/BTC wallet' },
];

function fmtMoney(n: number, currency = 'KES') {
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function timeago(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function WalletPage() {
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const { data, mutate, isLoading } = useSWR<WalletResponse>(
    user ? '/api/wallet' : null,
    fetcher,
    { refreshInterval: 0 },
  );
  const { data: prizesData, isLoading: prizesLoading } = useSWR<PrizesResponse>(
    user ? '/api/wallet/prizes' : null,
    fetcher,
    { refreshInterval: 0 },
  );

  const balance = data?.balances?.KES ?? user?.balance ?? 0;
  const referralBalance = data?.referralBalance ?? 0;
  const txns = data?.transactions ?? [];
  const prizes = prizesData?.prizes ?? [];

  if (authLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-bold">Sign in to access your wallet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Deposit, withdraw and pay competition entries.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4">
      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> Available Balance
                </div>
                <div className="mt-1 text-3xl font-extrabold tracking-tight">
                  {isLoading ? <Spinner className="h-6 w-6" /> : fmtMoney(balance)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Logged in as <span className="font-medium text-foreground">{user.displayName || user.username}</span>
                </div>
              </div>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Verified
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/5">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Gift className="h-3.5 w-3.5" /> Referral Credit
                </div>
                <div className="mt-1 text-3xl font-extrabold tracking-tight text-amber-500">
                  {isLoading ? <Spinner className="h-6 w-6" /> : fmtMoney(referralBalance)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  In-platform only · <span className="font-medium text-foreground">Not withdrawable</span>
                </div>
              </div>
              <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/40 text-amber-600">
                <Gift className="h-3 w-3" /> Bonus
              </Badge>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
              Earned from referrals &amp; welcome bonus. Use for competition entries and platform spend — cannot be transferred to M-Pesa or bank.
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deposit" className="space-y-3">
        <TabsList className="h-9 p-1">
          <TabsTrigger value="deposit" className="text-xs gap-1"><ArrowDownToLine className="h-3.5 w-3.5" /> Deposit</TabsTrigger>
          <TabsTrigger value="withdraw" className="text-xs gap-1"><ArrowUpFromLine className="h-3.5 w-3.5" /> Withdraw</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          <TabsTrigger value="prizes" className="text-xs gap-1">
            <Medal className="h-3.5 w-3.5" /> My Prizes
            {prizes.length > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">
                {prizes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <DepositForm onDone={async () => { await mutate(); await refreshUser(); }} />
        </TabsContent>

        <TabsContent value="withdraw">
          <WithdrawForm balance={balance} onDone={async () => { await mutate(); await refreshUser(); }} />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Recent transactions</CardTitle>
              <CardDescription className="text-xs">Your last 50 wallet movements.</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              {isLoading ? (
                <div className="flex h-24 items-center justify-center"><Spinner /></div>
              ) : txns.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No transactions yet. Deposit to get started.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {txns.map((t) => {
                    const meta = TXN_ICON[t.type];
                    const Icon = meta.icon;
                    const positive = t.amount > 0;
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted', meta.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{meta.label}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {t.description || (t.method ? `via ${t.method}` : '—')} · {timeago(t.createdAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-sm font-bold', positive ? 'text-emerald-500' : 'text-rose-500')}>
                            {positive ? '+' : ''}{fmtMoney(t.amount, t.currency)}
                          </p>
                          <p className="text-[10px] uppercase text-muted-foreground">{t.status}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prizes">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Medal className="h-4 w-4 text-violet-500" /> My Prizes
              </CardTitle>
              <CardDescription className="text-xs">Competition prizes you have won.</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              {prizesLoading ? (
                <div className="flex h-24 items-center justify-center"><Spinner /></div>
              ) : prizes.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
                  <Trophy className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No prizes yet</p>
                  <p className="text-xs text-muted-foreground">
                    Join a competition and post tips to compete for cash prizes.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {prizes.map((prize) => {
                    const placeLabel = prize.place ?? (prize.rank ? `${prize.rank}${prize.rank === 1 ? 'st' : prize.rank === 2 ? 'nd' : prize.rank === 3 ? 'rd' : 'th'}` : null);
                    const placeColors: Record<string, string> = { '1st': 'text-yellow-500', '2nd': 'text-slate-400', '3rd': 'text-amber-600' };
                    const placeColor = placeLabel ? (placeColors[placeLabel] ?? 'text-violet-500') : 'text-violet-500';
                    return (
                      <li key={prize.id} className="flex items-center gap-3 px-3 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                          <Medal className="h-5 w-5 text-violet-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{prize.competitionName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {placeLabel && (
                              <span className={cn('text-xs font-bold', placeColor)}>{placeLabel} Place</span>
                            )}
                            <span className="text-[11px] text-muted-foreground">{timeago(prize.createdAt)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-emerald-500">+{fmtMoney(prize.amount, prize.currency)}</p>
                          <p className="text-[10px] text-muted-foreground">Prize</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DepositForm({ onDone }: { onDone: () => void | Promise<void> }) {
  const [method, setMethod] = useState<DepositMethod>('mpesa_till');
  const [amount, setAmount] = useState<string>('500');
  const [phone, setPhone] = useState('');
  const [tillRef, setTillRef] = useState('');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '' });
  const [bank, setBank] = useState('');
  const [crypto, setCrypto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'pending'; msg: string } | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch active admin-configured gateways to know which methods to surface.
  // Falls back to the default DEPOSIT_METHODS list when none are configured.
  interface ActiveGateway { id: string; name: string; type: string; supportsPayouts: boolean }
  const { data: methodsData } = useSWR<{ gateways: ActiveGateway[] }>(
    '/api/wallet/methods',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  );
  const activeGateways = methodsData?.gateways ?? [];

  // Map gateway types → deposit method IDs. Multiple gateways of the same
  // type (e.g. "mpesa-payhero" and "mpesa-pesapal") collapse to one tile.
  const visibleMethods: typeof DEPOSIT_METHODS = (() => {
    if (activeGateways.length === 0) return DEPOSIT_METHODS;
    const seenIds = new Set<DepositMethod>();
    const result: typeof DEPOSIT_METHODS = [];
    for (const gw of activeGateways) {
      let id: DepositMethod | null = null;
      if (gw.type === 'mobile_money' || gw.id.startsWith('mpesa')) id = 'mpesa';
      else if (gw.type === 'card') id = 'card';
      else if (gw.type === 'bank') id = 'bank';
      else if (gw.type === 'crypto') id = 'crypto';
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        result.push(DEPOSIT_METHODS.find(m => m.id === id)!);
      }
    }
    const base = result.length > 0 ? result : DEPOSIT_METHODS;
    // Always include mpesa_till (manual Till Number payment) if not already present
    const mpesaTillEntry = DEPOSIT_METHODS.find(m => m.id === 'mpesa_till')!;
    return base.some(m => m.id === 'mpesa_till') ? base : [mpesaTillEntry, ...base];
  })();

  // Poll PayHero status while an STK push is pending
  // Times out after 3 minutes (45 × 4 s) — user can retry if needed
  useEffect(() => {
    if (!pendingRef) return;
    let pollCount = 0;
    const MAX_POLLS = 45; // 45 × 4 s = 3 minutes
    const interval = setInterval(async () => {
      pollCount++;
      try {
        const res = await fetch(`/api/payhero/status?reference=${encodeURIComponent(pendingRef)}`);
        const data = await res.json().catch(() => ({}));
        if (data.status === 'completed') {
          clearInterval(interval);
          pollRef.current = null;
          setPendingRef(null);
          setStatus({ kind: 'ok', msg: 'Payment confirmed! Your balance has been updated.' });
          await onDone();
          return;
        } else if (data.status === 'failed') {
          clearInterval(interval);
          pollRef.current = null;
          setPendingRef(null);
          setStatus({ kind: 'err', msg: 'M-Pesa payment failed or was cancelled. Please try again.' });
          return;
        }
      } catch {}
      // Timeout after MAX_POLLS
      if (pollCount >= MAX_POLLS) {
        clearInterval(interval);
        pollRef.current = null;
        setPendingRef(null);
        setStatus({ kind: 'err', msg: 'Confirmation timed out. If you entered your PIN the payment may still complete — check your balance in a moment or try again.' });
      }
    }, 4000);
    pollRef.current = interval;
    return () => clearInterval(interval);
  }, [pendingRef, onDone]);

  const submit = useCallback(async () => {
    setStatus(null);
    setPendingRef(null);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setStatus({ kind: 'err', msg: 'Enter a positive amount.' }); return; }
    if (method === 'mpesa' && !/^(\+?254|0)?[17]\d{8}$/.test(phone.replace(/\s/g, ''))) {
      setStatus({ kind: 'err', msg: 'Enter a valid M-Pesa phone (e.g. 0712345678).' });
      return;
    }
    if (method === 'mpesa_till' && !tillRef.trim()) {
      setStatus({ kind: 'err', msg: 'Enter your M-Pesa transaction reference (e.g. SJ12A3B4CD).' });
      return;
    }
    if (method === 'card') {
      if (card.number.replace(/\s/g, '').length < 13) { setStatus({ kind: 'err', msg: 'Enter a valid card number.' }); return; }
      if (!/^\d{2}\/\d{2}$/.test(card.exp)) { setStatus({ kind: 'err', msg: 'Expiry must be MM/YY.' }); return; }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          currency: 'KES',
          method,
          phone: method === 'mpesa' ? phone : undefined,
          cardLast4: method === 'card' ? card.number.replace(/\s/g, '').slice(-4) : undefined,
          reference: method === 'bank' ? bank : method === 'crypto' ? crypto : method === 'mpesa_till' ? tillRef.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setStatus({ kind: 'err', msg: data.error || 'Deposit failed.' });
      } else if (data.pending) {
        if (method === 'mpesa_till') {
          setStatus({ kind: 'pending', msg: data.message || 'Payment reference received. Your wallet will be credited after admin confirmation (usually within 15 minutes).' });
        } else {
          setPendingRef(data.reference);
          setStatus({ kind: 'pending', msg: `M-Pesa prompt sent to ${phone}. Enter your PIN on your phone to complete.` });
        }
      } else {
        setStatus({ kind: 'ok', msg: `Deposited ${amt.toLocaleString()} KES — balance updated.` });
        await onDone();
      }
    } catch {
      setStatus({ kind: 'err', msg: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  }, [amount, method, phone, card, bank, crypto, onDone]);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Top up your wallet</CardTitle>
        <CardDescription className="text-xs">Funds settle instantly for in-platform spend.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        {/* Method picker — derived from admin-active gateways or default list */}
        <div className={`grid gap-2 ${visibleMethods.length <= 2 ? 'grid-cols-2' : visibleMethods.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
          {visibleMethods.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors',
                  active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{m.label}</span>
                <span className="text-center text-[10px] text-muted-foreground">{m.help}</span>
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide">Amount (KES)</Label>
          <Input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9"
          />
          <div className="flex flex-wrap gap-1.5">
            {[100, 500, 1000, 2500, 5000, 10000].map((v) => (
              <Button key={v} type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2"
                onClick={() => setAmount(String(v))}>
                {v.toLocaleString()}
              </Button>
            ))}
          </div>
        </div>

        {/* Method-specific fields */}
        {method === 'mpesa_till' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-2">
              <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">How to pay via M-Pesa Till</p>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-foreground/80">
                <li>Open <strong>M-Pesa</strong> on your phone</li>
                <li>Select <strong>Lipa na M-Pesa</strong> → <strong>Buy Goods and Services</strong></li>
                <li>Enter Till Number: <span className="font-mono font-bold text-green-700 dark:text-green-400 text-sm">{MPESA_TILL_NUMBER}</span></li>
                <li>Enter the amount: <strong>KES {amount || '0'}</strong></li>
                <li>Enter your M-Pesa PIN and confirm</li>
                <li>Copy the <strong>M-Pesa confirmation message reference</strong> (e.g. SJ12A3B4CD) and paste it below</li>
              </ol>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide">M-Pesa Transaction Reference</Label>
              <Input
                value={tillRef}
                onChange={(e) => setTillRef(e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="e.g. SJ12A3B4CD"
                className="h-9 font-mono uppercase"
              />
              <p className="text-[10px] text-muted-foreground">Found in the SMS confirmation from M-Pesa after payment.</p>
            </div>
          </div>
        )}
        {method === 'mpesa' && (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide">M-Pesa phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" className="h-9" />
          </div>
        )}
        {method === 'card' && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide">Card number</Label>
              <Input
                value={card.number}
                onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 19) })}
                placeholder="1234 5678 9012 3456"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide">Expiry</Label>
                <Input
                  value={card.exp}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                    setCard({ ...card, exp: v });
                  }}
                  placeholder="MM/YY"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide">CVC</Label>
                <Input
                  value={card.cvc}
                  onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="123"
                  className="h-9"
                />
              </div>
            </div>
          </div>
        )}
        {method === 'bank' && (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide">Bank reference</Label>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Your transfer reference" className="h-9" />
          </div>
        )}
        {method === 'crypto' && (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide">Wallet / TX hash</Label>
            <Input value={crypto} onChange={(e) => setCrypto(e.target.value)} placeholder="USDT / BTC tx hash" className="h-9" />
          </div>
        )}

        {status && (
          <div className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-xs',
            status.kind === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : status.kind === 'pending'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
          )}>
            {status.kind === 'ok'
              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-px" />
              : status.kind === 'pending'
                ? <Clock className="h-3.5 w-3.5 shrink-0 mt-px animate-pulse" />
                : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />}
            <span>{status.msg}</span>
          </div>
        )}

        {pendingRef && (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Waiting for M-Pesa confirmation…</span>
            </div>
            <ol className="ml-1 list-decimal list-inside space-y-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
              <li>Check your phone — an M-Pesa prompt should appear.</li>
              <li>Enter your M-Pesa PIN and press <strong>OK</strong>.</li>
              <li>Your wallet will be credited automatically once confirmed.</li>
            </ol>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-500/60">
              Didn&apos;t get a prompt? Ensure your phone has a signal and try again. Times out after 3 minutes.
            </p>
          </div>
        )}

        <Button onClick={submit} disabled={submitting || !!pendingRef} className="w-full h-9 text-xs">
          {submitting ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Processing…</> : <>Deposit KES {amount || '0'}</>}
        </Button>
      </CardContent>
    </Card>
  );
}

function WithdrawForm({ balance, onDone }: { balance: number; onDone: () => void | Promise<void> }) {
  const [method, setMethod] = useState<WithdrawMethod>('mpesa');
  const [amount, setAmount] = useState('500');
  const [destination, setDestination] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const placeholders: Record<WithdrawMethod, string> = {
    mpesa: '07XX XXX XXX',
    bank: 'Bank account number',
    paypal: 'you@example.com',
    crypto: 'USDT / BTC address',
  };

  const submit = useCallback(async () => {
    setStatus(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setStatus({ kind: 'err', msg: 'Enter a positive amount.' }); return; }
    if (amt > balance) { setStatus({ kind: 'err', msg: `Insufficient balance. You have KES ${balance.toLocaleString()}.` }); return; }
    if (!destination.trim()) { setStatus({ kind: 'err', msg: 'Enter a payout destination.' }); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, currency: 'KES', method, destination }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setStatus({ kind: 'err', msg: data.error || 'Withdrawal failed.' });
      } else {
        setStatus({ kind: 'ok', msg: `Withdrew ${amt.toLocaleString()} KES — balance updated.` });
        await onDone();
      }
    } catch {
      setStatus({ kind: 'err', msg: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  }, [amount, balance, method, destination, onDone]);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Withdraw funds</CardTitle>
        <CardDescription className="text-xs">Available: <span className="font-semibold text-foreground">{fmtMoney(balance)}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WITHDRAW_METHODS.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors',
                  active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{m.label}</span>
                <span className="text-center text-[10px] text-muted-foreground">{m.help}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide">Amount (KES)</Label>
          <Input type="number" min="1" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" />
          <div className="flex flex-wrap gap-1.5">
            {[100, 500, 1000, 2500, 5000].map((v) => (
              <Button key={v} type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2"
                disabled={v > balance}
                onClick={() => setAmount(String(v))}>
                {v.toLocaleString()}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setAmount(String(balance))}>
              MAX
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide">Send to</Label>
          <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={placeholders[method]} className="h-9" />
        </div>

        {status && (
          <div className={cn(
            'flex items-center gap-2 rounded-lg border p-2 text-xs',
            status.kind === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
          )}>
            {status.kind === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {status.msg}
          </div>
        )}

        <Button onClick={submit} disabled={submitting || balance <= 0} className="w-full h-9 text-xs">
          {submitting ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Processing…</> : <>Withdraw KES {amount || '0'}</>}
        </Button>
      </CardContent>
    </Card>
  );
}
