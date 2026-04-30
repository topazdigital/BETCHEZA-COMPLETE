'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Save,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type Provider =
  | 'google'
  | 'facebook'
  | 'apple'
  | 'github'
  | 'twitter'
  | 'discord'
  | 'linkedin'
  | 'microsoft';

interface ProviderState {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  secretSet: boolean;
  extra?: { teamId?: string; keyId?: string; privateKey?: string };
}

const PROVIDER_META: Record<Provider, { label: string; emoji: string; docs: string; helper: string }> = {
  google:    { label: 'Google',    emoji: '🟦', docs: 'https://console.cloud.google.com/apis/credentials',                       helper: 'Add the callback URL below as an authorized redirect URI.' },
  facebook:  { label: 'Facebook',  emoji: '🟦', docs: 'https://developers.facebook.com/apps/',                                   helper: 'Add the callback URL under Facebook Login → Valid OAuth Redirect URIs.' },
  apple:     { label: 'Apple',     emoji: '⚪', docs: 'https://developer.apple.com/account/resources/identifiers/list/serviceId', helper: 'You also need a Team ID, Key ID and a private key (.p8).' },
  github:    { label: 'GitHub',    emoji: '⚫', docs: 'https://github.com/settings/developers',                                  helper: 'Set the Authorization callback URL to the one shown below.' },
  twitter:   { label: 'X (Twitter)', emoji: '⚫', docs: 'https://developer.twitter.com/en/portal/projects-and-apps',             helper: 'Use OAuth 2.0 (Confidential client). Enable users.read & tweet.read scopes.' },
  discord:   { label: 'Discord',   emoji: '🟣', docs: 'https://discord.com/developers/applications',                             helper: 'Add the callback URL under OAuth2 → Redirects.' },
  linkedin:  { label: 'LinkedIn',  emoji: '🟦', docs: 'https://www.linkedin.com/developers/apps',                                helper: 'Add the callback URL and request the OpenID + email scopes.' },
  microsoft: { label: 'Microsoft', emoji: '🟦', docs: 'https://entra.microsoft.com',                                             helper: 'Register an app and add the callback URL as a Web redirect URI.' },
};

const ORDER: Provider[] = ['google', 'facebook', 'github', 'apple', 'microsoft', 'discord', 'linkedin', 'twitter'];

function emptyState(): Record<Provider, ProviderState> {
  return ORDER.reduce<Record<Provider, ProviderState>>((acc, p) => {
    acc[p] = {
      enabled: false,
      clientId: '',
      clientSecret: '',
      secretSet: false,
      extra: p === 'apple' ? { teamId: '', keyId: '', privateKey: '' } : undefined,
    };
    return acc;
  }, {} as Record<Provider, ProviderState>);
}

export default function AdminSocialLoginPage() {
  const [state, setState] = useState<Record<Provider, ProviderState>>(emptyState);
  const [revealed, setRevealed] = useState<Partial<Record<Provider, boolean>>>({});
  const [siteUrl, setSiteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // Falls back to the current browser origin so the admin can copy a working
  // callback URL even before they configure a permanent Site URL.
  const browserOrigin = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    [],
  );
  const baseUrl = (siteUrl.trim() || browserOrigin).replace(/\/+$/, '');
  const callbackUrl = (p: Provider) => `${baseUrl}/api/auth/oauth/${p}/callback`;

  useEffect(() => {
    fetch('/api/admin/social-login')
      .then((r) => r.json())
      .then((d) => {
        const cfg = d?.config as Record<Provider, { enabled: boolean; clientId: string; secretSet: boolean }> | undefined;
        if (typeof d?.siteUrl === 'string') setSiteUrl(d.siteUrl);
        if (!cfg) return;
        setState((prev) => {
          const next = { ...prev };
          (Object.keys(cfg) as Provider[]).forEach((p) => {
            if (!next[p]) return;
            next[p].enabled = !!cfg[p].enabled;
            next[p].clientId = cfg[p].clientId || '';
            next[p].secretSet = !!cfg[p].secretSet;
          });
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(p: Provider, patch: Partial<ProviderState>) {
    setState((s) => ({ ...s, [p]: { ...s[p], ...patch } }));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const payload: Record<string, unknown> = { siteUrl: siteUrl.trim() };
      ORDER.forEach((p) => {
        const s = state[p];
        payload[p] = {
          enabled: s.enabled,
          clientId: s.clientId.trim(),
          // Empty secret means "keep what's stored" — server-side respects this.
          clientSecret: s.clientSecret,
          extra: p === 'apple' ? { ...(s.extra || {}) } : undefined,
        };
      });
      const res = await fetch('/api/admin/social-login', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      const j = await res.json();
      if (typeof j?.siteUrl === 'string') setSiteUrl(j.siteUrl);
      const cfg = j?.config as Record<Provider, { enabled: boolean; clientId: string; secretSet: boolean }> | undefined;
      if (cfg) {
        setState((prev) => {
          const next = { ...prev };
          (Object.keys(cfg) as Provider[]).forEach((p) => {
            if (!next[p]) return;
            next[p].enabled = !!cfg[p].enabled;
            next[p].clientId = cfg[p].clientId || '';
            next[p].clientSecret = '';
            next[p].secretSet = !!cfg[p].secretSet;
          });
          return next;
        });
      }
      setStatus({ kind: 'ok', msg: 'Saved. Social login providers are live.' });
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-72 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <KeyRound className="h-5 w-5 text-primary" />
            Social Login
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add your own OAuth credentials so users can sign in with their existing accounts.
            Nothing is shared — keys are stored on this server only.
          </p>
        </div>
        <Button onClick={save} disabled={saving} size="sm" className="h-8 text-xs px-3">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {status && (
        <div
          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
            status.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          {status.kind === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {status.msg}
        </div>
      )}

      {/* Site URL — drives every callback URL shown below */}
      <Card>
        <CardHeader className="py-2 pb-1.5 px-3">
          <CardTitle className="text-sm font-semibold">Site URL (used for all callback URLs)</CardTitle>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Set to your domain (e.g. <code className="rounded bg-muted px-1">https://betcheza.com</code>)
            so redirects stay constant. Leave blank for browser origin.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-[11px] font-mono"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://your-domain.com"
            />
            {siteUrl && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => setSiteUrl('')}>
                Clear
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground px-1">
            Currently using:{' '}
            <code className="rounded bg-muted px-1 font-mono">{baseUrl || '(none)'}</code>
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {ORDER.map((p) => {
          const meta = PROVIDER_META[p];
          const s = state[p];
          const cb = callbackUrl(p);
          return (
            <Card key={p}>
              <CardHeader className="py-2 pb-1.5 px-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="text-base">{meta.emoji}</span>
                      {meta.label}
                    </CardTitle>
                    <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">{meta.helper}</p>
                  </div>
                  <Switch checked={s.enabled} onCheckedChange={(v) => update(p, { enabled: v })} className="scale-75" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-medium uppercase text-muted-foreground px-0.5">Callback URL</Label>
                  <div className="flex items-center gap-1">
                    <Input value={cb} readOnly className="h-7 text-[10px] font-mono" />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => copy(cb)} title="Copy">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-medium uppercase text-muted-foreground px-0.5">Client ID</Label>
                  <Input
                    className="h-8 text-xs"
                    value={s.clientId}
                    onChange={(e) => update(p, { clientId: e.target.value })}
                    placeholder="id from dev console"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-medium uppercase text-muted-foreground px-0.5">
                    Client Secret {s.secretSet && <span className="text-emerald-500">· stored</span>}
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 text-xs"
                      type={revealed[p] ? 'text' : 'password'}
                      value={s.clientSecret}
                      onChange={(e) => update(p, { clientSecret: e.target.value })}
                      placeholder={s.secretSet ? '•••••••• (leave blank to keep)' : 'paste secret'}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRevealed((r) => ({ ...r, [p]: !r[p] }))}
                      title={revealed[p] ? 'Hide' : 'Show'}
                    >
                      {revealed[p] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {p === 'apple' && (
                  <div className="grid gap-2 sm:grid-cols-2 pt-0.5">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-medium uppercase text-muted-foreground px-0.5">Team ID</Label>
                      <Input
                        className="h-8 text-xs"
                        value={s.extra?.teamId || ''}
                        onChange={(e) => update(p, { extra: { ...(s.extra || {}), teamId: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-medium uppercase text-muted-foreground px-0.5">Key ID</Label>
                      <Input
                        className="h-8 text-xs"
                        value={s.extra?.keyId || ''}
                        onChange={(e) => update(p, { extra: { ...(s.extra || {}), keyId: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-0.5 sm:col-span-2">
                      <Label className="text-[10px] font-medium uppercase text-muted-foreground px-0.5">Private Key (.p8)</Label>
                      <textarea
                        value={s.extra?.privateKey || ''}
                        onChange={(e) => update(p, { extra: { ...(s.extra || {}), privateKey: e.target.value } })}
                        rows={3}
                        className="w-full rounded-md border border-border bg-background p-1.5 font-mono text-[10px]"
                        placeholder="-----BEGIN PRIVATE KEY-----"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-0.5">
                  <a
                    href={meta.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    Dev console
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  {s.enabled && !s.clientId && (
                    <span className="text-[10px] text-amber-500">Needs ID</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-[11px] text-muted-foreground p-3 pt-0">
          <p>1. Create an OAuth app in the provider's console using the callback URL shown above.</p>
          <p>2. Toggle enabled and Save. The button on login modal becomes active instantly.</p>
          <p>3. Emails link to existing accounts; otherwise a new user is created automatically.</p>
        </CardContent>
      </Card>
    </div>
  );
}
