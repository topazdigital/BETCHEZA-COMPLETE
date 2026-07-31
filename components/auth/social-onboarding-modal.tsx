'use client';

import { useState, useEffect } from 'react';
import { Phone, ArrowRight, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import {
  detectCountryCode,
  getDialCodeForCountry,
  PHONE_COUNTRY_CODES,
  type CountryDialCode,
} from '@/lib/geo-currency';

const STORAGE_KEY = 'bz_social_onboarding_done';

export function SocialOnboardingModal() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<CountryDialCode>(PHONE_COUNTRY_CODES[0]);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Auto-detect country on mount — IP-based first, timezone fallback
  useEffect(() => {
    let cancelled = false;
    async function detect() {
      let cc = '';
      try {
        const res = await fetch('/api/geo', { credentials: 'omit' });
        if (res.ok) {
          const data = await res.json().catch(() => ({})) as { country?: string };
          cc = data.country ?? '';
        }
      } catch {}
      if (!cc) cc = detectCountryCode(); // timezone fallback
      if (!cancelled) setSelected(getDialCodeForCountry(cc));
    }
    detect();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === String(user.id)) return;
    } catch {}
    const needsPhone = !(user as unknown as { phone?: string | null }).phone;
    if (needsPhone) setVisible(true);
  }, [isAuthenticated, user]);

  if (!visible || !user) return null;

  const isKenya = selected.country === 'KE';
  const isTanzania = selected.country === 'TZ';
  const hasMpesa = isKenya || isTanzania;

  const filteredCodes = PHONE_COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dialCode.includes(search) ||
    c.country.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave() {
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `${selected.dialCode}${phone.trim().replace(/^0/, '')}` }),
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
            {hasMpesa
              ? 'Add your phone number to enable M-Pesa deposits and match alerts.'
              : 'Add your phone number to receive match alerts and deposit notifications.'}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {/* Country selector */}
          <div className="relative">
            <Label className="text-xs mb-1 block">Country</Label>
            <button
              type="button"
              onClick={() => { setShowDropdown(v => !v); setSearch(''); }}
              className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
            >
              <span className="text-base">{selected.flag}</span>
              <span className="flex-1 truncate">{selected.name}</span>
              <span className="text-muted-foreground shrink-0">{selected.dialCode}</span>
            </button>

            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search country…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full rounded-sm bg-muted pl-7 pr-2 py-1.5 text-xs outline-none"
                    />
                  </div>
                </div>
                <ul className="max-h-48 overflow-y-auto py-1">
                  {filteredCodes.map(c => (
                    <li key={`${c.country}-${c.dialCode}`}>
                      <button
                        type="button"
                        onClick={() => { setSelected(c); setShowDropdown(false); setSearch(''); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                      >
                        <span className="text-sm">{c.flag}</span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-muted-foreground">{c.dialCode}</span>
                      </button>
                    </li>
                  ))}
                  {filteredCodes.length === 0 && (
                    <li className="px-3 py-4 text-center text-xs text-muted-foreground">No results</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Phone number */}
          <div>
            <Label htmlFor="ob-phone" className="text-xs mb-1 block">Phone number</Label>
            <div className="flex gap-2">
              <span className="flex items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground shrink-0">
                {selected.dialCode}
              </span>
              <Input
                id="ob-phone"
                type="tel"
                placeholder="712 345 678"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(''); }}
                className="flex-1"
                autoFocus={!showDropdown}
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
