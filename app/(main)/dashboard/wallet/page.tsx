'use client';

import { useEffect, useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, Smartphone, CreditCard,
  Building2, Bitcoin, Loader2, CheckCircle2, AlertTriangle,
  ArrowDownLeft, ArrowUpRight, Trophy, Gift, RotateCcw,
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

type DepositMethod = 'mpesa' | 'card' | 'bank' | 'crypto';
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

const DEPOSIT_METHODS: Array<{ id: DepositMethod; label: string; icon: typeof Smartphone; help: string }> = [
  { id: 'mpesa', label: 'M-Pesa', icon: Smartphone, help: 'Pay via Safaricom STK push' },
  { id: 'card',  label: 'Card',   icon: CreditCard, help: 'Visa / Mastercard / Verve' },
  { id: 'bank',  label: 'Bank',   icon: Building2,  help: 'Bank transfer / SWIFT / SEPA' },
  { id: 'crypto', label: 'Crypto', icon: Bitcoin,   help: 'USDT / BTC / ETH' },
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

  const balance = data?.balances?.KES ?? user?.balance ?? 0;
  const txns = data?.transactions ?? [];

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
      {/* Balance card */}
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

      <Tabs defaultValue="deposit" className="space-y-3">
        <TabsList className="h-9 p-1">
          <TabsTrigger value="deposit" className="text-xs gap-1"><ArrowDownToLine className="h-3.5 w-3.5" /> Deposit</TabsTrigger>
          <TabsTrigger value="withdraw" className="text-xs gap-1"><ArrowUpFromLine className="h-3.5 w-3.5" /> Withdraw</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
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
      </Tabs>
    </div>
  );
}

function DepositForm({ onDone }: { onDone: () => void | Promise<void> }) {
  const [method, setMethod] = useState<DepositMethod>('mpesa');
  const [amount, setAmount] = useState<string>('500');
  const [phone, setPhone] = useState('');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '' });
  const [bank, setBank] = useState('');
  const [crypto, setCrypto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

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
    // Always show fallback tile set if mapping produced nothing
    return result.length > 0 ? result : DEPOSIT_METHODS;
  })();

  const submit = useCallback(async () => {
    setStatus(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setStatus({ kind: 'err', msg: 'Enter a positive amount.' }); return; }
    if (method === 'mpesa' && !/^(\+?254|0)?7\d{8}$/.test(phone.replace(/\s/g, ''))) {
      setStatus({ kind: 'err', msg: 'Enter a valid M-Pesa phone (e.g. 0712345678).' });
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
          reference: method === 'bank' ? bank : method === 'crypto' ? crypto : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setStatus({ kind: 'err', msg: data.error || 'Deposit failed.' });
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
        <div className={`grid grid-cols-2 gap-2 ${visibleMethods.length > 2 ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
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
            'flex items-center gap-2 rounded-lg border p-2 text-xs',
            status.kind === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
          )}>
            {status.kind === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {status.msg}
          </div>
        )}

        <Button onClick={submit} disabled={submitting} className="w-full h-9 text-xs">
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
