'use client';

import { useState } from 'react';
import { Bell, Check, Loader2, Mail, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';

const TOPICS = [
  { id: 'jackpot_alerts', label: 'All Jackpots', description: 'Every bookmaker', color: '#7c3aed' },
  ...SUPPORTED_BOOKMAKERS.map(b => ({ id: b.slug + '_jackpot', label: b.name, description: b.jackpotTypes[0], color: b.color })),
];

export default function JackpotSubscribeWidget() {
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>(['jackpot_alerts']);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  function toggle(id: string) {
    if (id === 'jackpot_alerts') { setSelected(s => s.includes('jackpot_alerts') ? [] : ['jackpot_alerts']); return; }
    setSelected(s => { const next = s.includes(id) ? s.filter(x => x !== id) : [...s.filter(x => x !== 'jackpot_alerts'), id]; return next.length === 0 ? [] : next; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || selected.length === 0) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/email/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, topics: selected }) });
      const data = await res.json() as { ok?: boolean; error?: string; message?: string };
      if (res.ok && data.ok !== false) { setStatus('success'); setMessage("You're subscribed! We'll email you when predictions are ready."); }
      else { setStatus('error'); setMessage(data.error || data.message || 'Something went wrong.'); }
    } catch { setStatus('error'); setMessage('Network error. Please try again.'); }
  }

  if (status === 'success') {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
        <CardContent className="p-5 flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0"><Check className="h-5 w-5 text-green-600" /></div>
          <div><p className="font-semibold text-sm text-green-700 dark:text-green-400">Subscribed!</p><p className="text-xs text-muted-foreground mt-0.5">{message}</p></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Bell className="h-4 w-4 text-primary" /></div>
          <div><p className="font-bold text-sm">Get Jackpot Alerts by Email</p><p className="text-xs text-muted-foreground mt-0.5">We'll email you AI predictions as soon as they're ready — before the deadline.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map(t => {
            const active = selected.includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => toggle(t.id)}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all', active ? 'border-transparent text-white shadow-sm' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground')}
                style={active ? { background: t.color } : {}}>
                {active && <Check className="h-3 w-3" />}
                <Trophy className={cn('h-3 w-3', !active && 'opacity-40')} />
                {t.label}
              </button>
            );
          })}
        </div>
        {selected.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">Select at least one bookmaker above.</p>}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="pl-8 h-9 text-sm" />
          </div>
          <Button type="submit" size="sm" className="h-9 gap-1.5 shrink-0" disabled={status === 'loading' || selected.length === 0 || !email}>
            {status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            {status === 'loading' ? 'Subscribing…' : 'Alert Me'}
          </Button>
        </form>
        {status === 'error' && <p className="text-xs text-destructive">{message}</p>}
        <p className="text-[10px] text-muted-foreground">No spam. Unsubscribe anytime. We only email when predictions are published.</p>
      </CardContent>
    </Card>
  );
}
