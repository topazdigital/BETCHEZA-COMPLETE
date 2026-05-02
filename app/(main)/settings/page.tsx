'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserSettings } from '@/contexts/user-settings-context';
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
  Settings as SettingsIcon, User, Bell, Shield, Wallet, ArrowRight, LogOut, Save, CheckCircle2, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, isLoading: loading, logout } = useAuth();
  const { open } = useAuthModal();
  // Use the global settings context — changing odds format here updates the whole app instantly
  const { settings: globalSettings, setOddsFormat: setGlobalOddsFormat, setTimezone: setGlobalTimezone } = useUserSettings();

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Display prefs — mirror from global context so they start populated correctly
  const [oddsFormat, setOddsFormat] = useState<'decimal' | 'fractional' | 'american'>(globalSettings.oddsFormat);
  const [timezone, setTimezone] = useState(globalSettings.timezone || 'Africa/Nairobi');
  const [notifMatches, setNotifMatches] = useState(true);
  const [notifTipsters, setNotifTipsters] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Load saved profile + prefs on mount
  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? '');

    // Load profile overrides from server
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => {
        if (d.profile) {
          if (d.profile.displayName) setDisplayName(d.profile.displayName);
          if (d.profile.phone) setPhone(d.profile.phone);
          if (d.profile.bio) setBio(d.profile.bio);
        }
      })
      .catch(() => {});

    // Sync local prefs state from global context + bz_prefs for notification flags only
    setOddsFormat(globalSettings.oddsFormat);
    setTimezone(globalSettings.timezone);
    try {
      const raw = localStorage.getItem('bz_prefs');
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.notifMatches === 'boolean') setNotifMatches(p.notifMatches);
        if (typeof p.notifTipsters === 'boolean') setNotifTipsters(p.notifTipsters);
        if (typeof p.notifPromos === 'boolean') setNotifPromos(p.notifPromos);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim(), phone: phone.trim(), bio: bio.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save profile');
        return;
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePreferences = () => {
    try {
      // Push odds format + timezone into the global context — this syncs the header and all match displays
      setGlobalOddsFormat(oddsFormat);
      setGlobalTimezone(timezone);
      // Save notification flags to bz_prefs (not yet server-synced)
      const raw = localStorage.getItem('bz_prefs');
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem('bz_prefs', JSON.stringify({
        ...prev,
        oddsFormat, timezone, notifMatches, notifTipsters, notifPromos,
      }));
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2000);
      toast.success('Preferences saved');
    } catch {}
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to change password');
        return;
      }
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setPwSaving(false);
    }
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
          <CardDescription>Update your display name, phone and bio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="display-name" className="text-xs">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="username" className="text-xs">Username</Label>
              <Input
                id="username"
                value={user.username ?? ''}
                readOnly
                disabled
                className="opacity-60 cursor-not-allowed"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Username cannot be changed. Contact support if needed.</p>
            </div>
            <div>
              <Label htmlFor="phone" className="text-xs">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+254 700 000 000"
                maxLength={30}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" defaultValue={user.email ?? ''} disabled className="opacity-60" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Contact support to change your email address</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="bio" className="text-xs">Bio</Label>
              <Input
                id="bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                maxLength={500}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleSaveProfile} disabled={profileSaving}>
              {profileSaving ? <Spinner className="h-3.5 w-3.5 mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save profile
            </Button>
            {profileSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Change Password
          </CardTitle>
          <CardDescription>Set a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="current-pw" className="text-xs">Current password</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrent(v => !v)}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="new-pw" className="text-xs">New password</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew(v => !v)}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm-pw" className="text-xs">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
          </div>
          <Button size="sm" onClick={handleChangePassword} disabled={pwSaving}>
            {pwSaving ? <Spinner className="h-3.5 w-3.5 mr-1" /> : <KeyRound className="h-3.5 w-3.5 mr-1" />}
            Change password
          </Button>
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

      {/* Save preferences + sign out */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={handleSavePreferences}>
            <Save className="h-3.5 w-3.5 mr-1" />
            Save preferences
          </Button>
          {prefSaved && <span className="text-xs text-emerald-600">Saved</span>}
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
