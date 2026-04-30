'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Mail, Smartphone, Loader2, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { ensurePushSubscribed, isPushSupported, getPushPermission } from '@/lib/push-client';

interface Prefs {
  inappTeamUpdates: boolean;
  inappTipsterUpdates: boolean;
  emailTeamUpdates: boolean;
  emailTipsterUpdates: boolean;
  emailDailyDigest: boolean;
  pushTeamUpdates: boolean;
  pushTipsterUpdates: boolean;
  pushOddsAlerts: boolean;
}

const TOGGLES: Array<{ key: keyof Prefs; label: string; group: 'inapp' | 'email' | 'push'; description: string }> = [
  { key: 'inappTeamUpdates', label: 'Followed team updates', group: 'inapp', description: 'Lineups, kick-offs, results & key moments' },
  { key: 'inappTipsterUpdates', label: 'Tipster activity', group: 'inapp', description: 'New tips and big wins from tipsters you follow' },
  { key: 'emailTeamUpdates', label: 'Team match emails', group: 'email', description: 'A digest 2 hours before each match for your followed teams' },
  { key: 'emailTipsterUpdates', label: 'Tipster tip emails', group: 'email', description: 'Get notified instantly when followed tipsters publish' },
  { key: 'emailDailyDigest', label: 'Daily best-bets digest', group: 'email', description: 'Top AI picks for the day, every morning' },
  { key: 'pushTeamUpdates', label: 'Followed team push', group: 'push', description: 'Real-time browser alerts for your teams' },
  { key: 'pushTipsterUpdates', label: 'Tipster push', group: 'push', description: 'Push for new tipster posts' },
  { key: 'pushOddsAlerts', label: 'Odds movement', group: 'push', description: 'Big odds drops on watched matches' },
];

export default function NotificationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<keyof Prefs | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    setPushSupported(isPushSupported());
    setPushPermission(getPushPermission());
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetch('/api/notifications/preferences')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPrefs(d.preferences); })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  async function togglePref(key: keyof Prefs) {
    if (!prefs) return;
    setBusyKey(key);
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function enablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      const res = await ensurePushSubscribed();
      setPushPermission(getPushPermission());
      if (!res.ok) setPushError(res.error || 'Push could not be enabled');
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Push enable failed');
    } finally {
      setPushBusy(false);
    }
  }

  if (authLoading || loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Spinner className="h-6 w-6" /></div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-lg px-3 py-8">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Bell className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-lg font-bold">Stay in the loop</h1>
          <p className="mt-1 text-xs text-muted-foreground">Sign in to manage your notification preferences.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/login?next=/notifications" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Sign in</Link>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <PushBlock supported={pushSupported} permission={pushPermission} onEnable={enablePush} busy={pushBusy} error={pushError} />
          </div>
        </div>
      </div>
    );
  }

  if (!prefs) return null;

  const groups: Array<{ key: 'inapp' | 'email' | 'push'; title: string; icon: typeof Bell }> = [
    { key: 'inapp', title: 'In-app notifications', icon: Bell },
    { key: 'email', title: 'Email notifications', icon: Mail },
    { key: 'push', title: 'Browser push notifications', icon: Smartphone },
  ];

  return (
    <div className="container mx-auto max-w-xl px-3 py-4">
      <h1 className="text-lg font-bold mb-0.5">Notifications</h1>
      <p className="text-xs text-muted-foreground mb-4">Choose what you want to hear about.</p>

      <PushBlock supported={pushSupported} permission={pushPermission} onEnable={enablePush} busy={pushBusy} error={pushError} compact />

      <div className="mt-4 space-y-4">
        {groups.map(g => {
          const Icon = g.icon;
          return (
            <section key={g.key} className="rounded-lg border border-border bg-card overflow-hidden">
              <header className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-2">
                <Icon className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-xs font-semibold">{g.title}</h2>
              </header>
              <div className="divide-y divide-border">
                {TOGGLES.filter(t => t.group === g.key).map(t => (
                  <label key={t.key} className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{t.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{t.description}</div>
                    </div>
                    <ToggleSwitch
                      checked={prefs[t.key]}
                      busy={busyKey === t.key}
                      onChange={() => togglePref(t.key)}
                    />
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, busy }: { checked: boolean; onChange: () => void; busy?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={busy}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
        busy && 'opacity-60'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
      {busy && <Loader2 className="absolute inset-0 m-auto h-2.5 w-2.5 animate-spin text-foreground/60" />}
    </button>
  );
}

function PushBlock({ supported, permission, onEnable, busy, error, compact }: { supported: boolean; permission: NotificationPermission; onEnable: () => void; busy: boolean; error: string | null; compact?: boolean }) {
  if (!supported) {
    return (
      <div className={cn('rounded-lg border border-border p-3 text-[11px] text-muted-foreground', compact ? '' : 'mt-3')}>
        <div className="flex items-center gap-1.5"><BellOff className="h-3.5 w-3.5" /> Browser push isn’t supported on this device.</div>
      </div>
    );
  }
  if (permission === 'granted') {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px]">
        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold"><Check className="h-3.5 w-3.5" /> Push notifications enabled on this device.</div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Toggle categories below to control what you receive.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2.5">
        <Smartphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold">Enable browser push</h3>
          <p className="text-[10px] text-muted-foreground leading-tight">Get real-time alerts for matches and tips — even with the tab closed.</p>
          {error && (
            <p className="mt-1 text-[10px] text-rose-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {error}</p>
          )}
          {permission === 'denied' && (
            <p className="mt-1 text-[10px] text-amber-600">Push is blocked. Enable in your browser settings.</p>
          )}
        </div>
        <button
          onClick={onEnable}
          disabled={busy || permission === 'denied'}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 h-7"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enable'}
        </button>
      </div>
    </div>
  );
}
