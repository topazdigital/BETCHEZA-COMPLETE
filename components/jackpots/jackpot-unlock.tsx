'use client';

import { useEffect, useState } from 'react';
import { Lock, Loader2, Phone, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';

export function useJackpotAccess() {
  const [access, setAccess] = useState<{ hasAccess: boolean; walletBalance?: number; pendingReference?: string }>({ hasAccess: false });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/jackpot/access').then(r => r.json()).then(setAccess).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return { ...access, loading, openUnlock: () => setOpen(true), closeUnlock: () => setOpen(false), setAccess, unlockOpen: open };
}

export function JackpotUnlockModal({ open, onClose, walletBalance = 0, onUnlocked }: {
  open: boolean; onClose: () => void; walletBalance?: number; onUnlocked: () => void;
}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  useEffect(() => {
    if (!open || !pending) return;
    const timer = setInterval(async () => {
      const res = await fetch('/api/jackpot/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', reference: pending }) });
      const data = await res.json();
      if (data.hasAccess) { clearInterval(timer); onUnlocked(); onClose(); }
    }, 4000);
    return () => clearInterval(timer);
  }, [open, pending, onClose, onUnlocked]);
  if (!open) return null;
  async function pay(action: 'wallet' | 'mpesa') {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/jackpot/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'wallet' ? { action } : { phone }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      if (data.hasAccess) { onUnlocked(); onClose(); } else if (data.reference) setPending(data.reference);
    } catch (e) { setError(e instanceof Error ? e.message : 'Payment failed'); } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
    <div className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-xl" onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Unlock all jackpot games</h2><p className="mt-1 text-xs text-muted-foreground">Get the final five predictions for 7 days.</p></div><button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></div>
      {authLoading ? <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /><span className="text-sm">Checking your sign-in…</span></div> :
       !isAuthenticated ? <div className="space-y-4 py-4"><p className="text-center text-sm text-muted-foreground">Sign in to continue with your jackpot unlock.</p><Button className="w-full" onClick={() => { onClose(); openAuthModal('login'); }}>Sign In / Register</Button></div> :
       pending ? <div className="py-7 text-center space-y-2"><Phone className="mx-auto h-8 w-8 text-primary animate-pulse" /><p className="font-semibold">Check your phone</p><p className="text-xs text-muted-foreground">Enter your M-Pesa PIN. We’ll unlock the games automatically after confirmation.</p></div> :
        <div className="mt-5 space-y-3">
          {walletBalance >= 100 && <Button className="w-full gap-2" disabled={busy} onClick={() => pay('wallet')}><Wallet className="h-4 w-4" />Pay KES 100 from wallet</Button>}
          <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><span className="relative mx-auto block w-fit bg-background px-2 text-[10px] text-muted-foreground">OR M-PESA</span></div>
          <Input placeholder="0712 345 678" value={phone} onChange={e => setPhone(e.target.value)} />
          <Button variant="outline" className="w-full gap-2" disabled={busy || !phone} onClick={() => pay('mpesa')}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}Pay KES 100 & unlock</Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-center text-[10px] text-muted-foreground">Secure M-Pesa payment · Access lasts 7 days</p>
        </div>}
    </div>
  </div>;
}

export function JackpotLockedGames({ count, onUnlock }: { count: number; onUnlock: () => void }) {
  return <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-center"><Lock className="mx-auto h-5 w-5 text-primary" /><p className="mt-1 text-xs font-semibold">{count} more games are locked</p><p className="mt-1 text-[11px] text-muted-foreground">Pay KES 100 once to see all jackpot predictions for 7 days.</p><Button size="sm" className="mt-3 h-8 text-xs" onClick={onUnlock}>Unlock all games</Button></div>;
}