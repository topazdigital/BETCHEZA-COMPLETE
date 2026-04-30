'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Settings as SettingsIcon, User, Bell, Shield, Wallet, ArrowRight, LogOut,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, isLoading: loading, logout } = useAuth();
  const { open } = useAuthModal();

  const [oddsFormat, setOddsFormat] = useState<'decimal' | 'fractional' | 'american'>('decimal');
  const [timezone, setTimezone] = useState('Africa/Nairobi');
  const [notifMatches, setNotifMatches] = useState(true);
  const [notifTipsters, setNotifTipsters] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSavePreferences = () => {
    // Persisted client-side only for the stub — real wiring lives in
    // /dashboard/payment-settings and the upcoming /api/users/me PATCH.
    try {
      localStorage.setItem('bz_prefs', JSON.stringify({
        oddsFormat, timezone, notifMatches, notifTipsters, notifPromos,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" /> Settings
            </CardTitle>
            <CardDescription>Sign in to manage your account, preferences and notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => open('login')}>Sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Account, display preferences, notifications and security.
        </p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Account
          </CardTitle>
          <CardDescription>Your basic profile details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="display-name" className="text-xs">Display name</Label>
              <Input id="display-name" defaultValue={user.displayName ?? ''} disabled />
            </div>
            <div>
              <Label htmlFor="username" className="text-xs">Username</Label>
              <Input id="username" defaultValue={user.username ?? ''} disabled />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" defaultValue={user.email ?? ''} disabled />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Profile editing is coming soon. Contact support if you need to change these details urgently.
          </p>
        </CardContent>
      </Card>

      {/* Display preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display preferences</CardTitle>
          <CardDescription>How odds and times are shown across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Odds format</Label>
              <Select value={oddsFormat} onValueChange={(v) => setOddsFormat(v as 'decimal' | 'fractional' | 'american')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="decimal">Decimal (1.85)</SelectItem>
                  <SelectItem value="fractional">Fractional (17/20)</SelectItem>
                  <SelectItem value="american">American (-118)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Nairobi">Nairobi (EAT)</SelectItem>
                  <SelectItem value="Africa/Lagos">Lagos (WAT)</SelectItem>
                  <SelectItem value="Africa/Johannesburg">Johannesburg (SAST)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                  <SelectItem value="America/New_York">New York (ET)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </CardTitle>
          <CardDescription>Choose what you want to hear about.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Followed matches</p>
              <p className="text-xs text-muted-foreground">Goals, kick-off reminders and final scores.</p>
            </div>
            <Switch checked={notifMatches} onCheckedChange={setNotifMatches} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tipsters you follow</p>
              <p className="text-xs text-muted-foreground">When a followed tipster posts a new pick.</p>
            </div>
            <Switch checked={notifTipsters} onCheckedChange={setNotifTipsters} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Promotions &amp; offers</p>
              <p className="text-xs text-muted-foreground">Bookmaker bonuses curated by Betcheza.</p>
            </div>
            <Switch checked={notifPromos} onCheckedChange={setNotifPromos} />
          </div>
        </CardContent>
      </Card>

      {/* Wallet shortcut */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Wallet &amp; payouts
          </CardTitle>
          <CardDescription>Manage deposits, withdrawals and payout methods.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/wallet">Open wallet <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/payment-settings">Payout methods</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Save + sign out */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={handleSavePreferences}>Save preferences</Button>
          {saved && <span className="text-xs text-emerald-600">Saved</span>}
        </div>
        <Button variant="ghost" className="text-destructive" onClick={logout}>
          <LogOut className="mr-1 h-4 w-4" /> Sign out
        </Button>
      </div>

      {/* Security shortcut */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Security &amp; privacy
          </CardTitle>
          <CardDescription>Helpful pages for managing your account safely.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          <Link href="/privacy" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Privacy policy</Link>
          <Link href="/terms" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Terms of service</Link>
          <Link href="/cookies" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Cookie policy</Link>
          <Link href="/responsible-gambling" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Responsible gambling</Link>
        </CardContent>
      </Card>
    </div>
  );
}
