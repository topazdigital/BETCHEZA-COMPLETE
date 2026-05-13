'use client';

import { useState, useEffect } from 'react';
import { Phone, User, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';

const COUNTRY_CODES = [
  { code: '+254', label: '🇰🇪 Kenya (+254)' },
  { code: '+255', label: '🇹🇿 Tanzania (+255)' },
  { code: '+256', label: '🇺🇬 Uganda (+256)' },
  { code: '+234', label: '🇳🇬 Nigeria (+234)' },
  { code: '+233', label: '🇬🇭 Ghana (+233)' },
  { code: '+27', label: '🇿🇦 South Africa (+27)' },
  { code: '+1', label: '🇺🇸 USA (+1)' },
  { code: '+44', label: '🇬🇧 UK (+44)' },
];

const STORAGE_KEY = 'bz_social_onboarding_done';

export function SocialOnboardingModal() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'phone' | 'done'>('phone');
  const [countryCode, setCountryCode] = useState('+254');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === String(user.id)) return;
    } catch {}
    const needsPhone = !(user as unknown as { phone?: string | null }).phone;
    if (needsPhone) setVisible(true);
  }, [isAuthenticated, user]);

  if (!visible || !user) return null;

  async function handleSave() {
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `${countryCode}${phone.trim().replace(/^0/, '')}` }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to save. Please try again.');
        return;
      }
      await refreshUser();
      try { localStorage.setItem(STORAGE_KEY, String(user!.id)); } catch {}
      setVisible(false);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    try { localStorage.setItem(STORAGE_KEY, String(user!.id)); } catch {}
    setVisible(false);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary/20 to-emerald-500/10 p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Phone className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">One last step</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your phone number to get M-Pesa deposit access and match alerts.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <Label className="text-xs mb-1 block">Country</Label>
            <select
              value={countryCode}
              onChange={e => setCountryCode(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="ob-phone" className="text-xs mb-1 block">Phone number</Label>
            <div className="flex gap-2">
              <span className="flex items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {countryCode}
              </span>
              <Input
                id="ob-phone"
                type="tel"
                placeholder="712 345 678"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(''); }}
                className="flex-1"
                autoFocus
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save & Continue'}
          </Button>

          <button
            onClick={handleSkip}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
