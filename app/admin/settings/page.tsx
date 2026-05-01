"use client"

import { useState, useEffect, useRef } from "react"
import { Save, Globe, Bell, Shield, Palette, Database, Loader2, CheckCircle2, AlertCircle, Search, ImageIcon, Link2, KeyRound, Plus, Trash2, Share2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Settings {
  site_name: string
  site_description: string
  maintenance_mode: string
  registration_enabled: string
  email_verification: string
  tipsters_auto_approval: string
  comments_moderation: string
  max_predictions_per_day: string
  min_odds_allowed: string
  max_odds_allowed: string
  notify_new_user: string
  notify_new_prediction: string
  notify_new_comment: string
  primary_color: string
  default_theme: string
  google_analytics_id: string
  facebook_pixel_id: string
  logo_url: string
  logo_dark_url: string
  favicon_url: string
  twofa_enabled: string
  twofa_method: string
  url_rewrites: string
  seo_pages: string
  social_links: string
  cookie_banner_enabled: string
  cookie_banner_message: string
  // API keys (stored in site_settings; env vars take precedence at read time
  // unless overridden by the dedicated *_override flag).
  the_odds_api_key: string
  sportsgameodds_api_key: string
  openai_api_key: string
  football_data_api_key: string
  vapid_public_key: string
  vapid_private_key: string
  vapid_subject: string
  // Captcha — wired into login/signup. Provider can be 'turnstile',
  // 'recaptcha', 'math' (built-in), 'none' or '' (auto from env).
  captcha_provider: string
  turnstile_site_key: string
  turnstile_secret_key: string
  recaptcha_site_key: string
  recaptcha_secret_key: string
}

interface SocialLink {
  platform: string
  url: string
  handle?: string
  enabled: boolean
}

const SOCIAL_PLATFORMS: { key: string; label: string; placeholder: string }[] = [
  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/your-handle' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/your-page' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/your-handle' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@your-channel' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@your-handle' },
  { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/your-channel' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/254700000000' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/your-co' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/invite-code' },
]

function safeParseSocials(raw: string): Record<string, SocialLink> {
  const out: Record<string, SocialLink> = {}
  try {
    const arr = JSON.parse(raw || '[]')
    if (Array.isArray(arr)) {
      for (const e of arr) {
        if (e && typeof e.platform === 'string') {
          out[e.platform] = {
            platform: e.platform,
            url: typeof e.url === 'string' ? e.url : '',
            handle: typeof e.handle === 'string' ? e.handle : '',
            enabled: e.enabled !== false,
          }
        }
      }
    }
  } catch {}
  return out
}

const defaultSettings: Settings = {
  site_name: "Betcheza",
  site_description: "Your trusted betting tips community",
  maintenance_mode: "false",
  registration_enabled: "true",
  email_verification: "true",
  tipsters_auto_approval: "false",
  comments_moderation: "true",
  max_predictions_per_day: "10",
  min_odds_allowed: "1.2",
  max_odds_allowed: "50",
  notify_new_user: "true",
  notify_new_prediction: "true",
  notify_new_comment: "false",
  primary_color: "#10B981",
  default_theme: "light",
  google_analytics_id: "",
  facebook_pixel_id: "",
  logo_url: "",
  logo_dark_url: "",
  favicon_url: "",
  twofa_enabled: "false",
  twofa_method: "email",
  url_rewrites: "[]",
  seo_pages: "[]",
  social_links: "[]",
  cookie_banner_enabled: "true",
  cookie_banner_message:
    'We use cookies to improve your experience, analyse site traffic and personalise content. By clicking "Accept", you consent to our use of cookies.',
  the_odds_api_key: "",
  sportsgameodds_api_key: "",
  openai_api_key: "",
  football_data_api_key: "",
  vapid_public_key: "",
  vapid_private_key: "",
  vapid_subject: "",
  captcha_provider: "",
  turnstile_site_key: "",
  turnstile_secret_key: "",
  recaptcha_site_key: "",
  recaptcha_secret_key: "",
}

interface SeoPageEntry { path: string; title?: string; description?: string; keywords?: string; ogImage?: string; noIndex?: boolean }
interface RewriteEntry { source: string; destination: string; permanent?: boolean }

function safeParse<T>(raw: string, fallback: T): T {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? (v as unknown as T) : fallback; } catch { return fallback; }
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState("")

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/admin/settings')
        if (response.ok) {
          const data = await response.json()
          setSettings({ ...defaultSettings, ...data.settings })
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSettings()
  }, [])

  // Save settings
  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    setErrorMessage("")
    
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })
      
      if (response.ok) {
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      setSaveStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const toggleSetting = (key: keyof Settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: prev[key] === 'true' ? 'false' : 'true'
    }))
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground">Manage your application settings</p>
        </div>
        <Button 
          size="sm"
          className="h-8 text-xs gap-1.5 px-3" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isSaving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save Changes'}
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
          {errorMessage}
        </div>
      )}

      <Tabs defaultValue="general" className="space-y-3">
        <TabsList className="h-auto flex flex-wrap gap-1 p-1 bg-muted/50">
          <TabsTrigger value="general" className="h-7 text-xs px-2.5 gap-1.5">
            <Globe className="h-3.5 w-3.5" /> General
          </TabsTrigger>
          <TabsTrigger value="security" className="h-7 text-xs px-2.5 gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="h-7 text-xs px-2.5 gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="predictions" className="h-7 text-xs px-2.5 gap-1.5">
            <Database className="h-3.5 w-3.5" /> Predictions
          </TabsTrigger>
          <TabsTrigger value="appearance" className="h-7 text-xs px-2.5 gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="branding" className="h-7 text-xs px-2.5 gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> Branding
          </TabsTrigger>
          <TabsTrigger value="rewrites" className="h-7 text-xs px-2.5 gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Rewrites
          </TabsTrigger>
          <TabsTrigger value="twofa" className="h-7 text-xs px-2.5 gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> 2FA
          </TabsTrigger>
          <TabsTrigger value="seo" className="h-7 text-xs px-2.5 gap-1.5">
            <Search className="h-3.5 w-3.5" /> SEO
          </TabsTrigger>
          <TabsTrigger value="social" className="h-7 text-xs px-2.5 gap-1.5">
            <Share2 className="h-3.5 w-3.5" /> Social
          </TabsTrigger>
          <TabsTrigger value="apikeys" className="h-7 text-xs px-2.5 gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Keys
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-0">
          <Card>
            <CardHeader className="py-2 pb-1.5 px-3">
              <CardTitle className="text-sm font-semibold">General Settings</CardTitle>
              <CardDescription className="text-xs">Configure basic site information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="siteName" className="text-xs">Site Name</Label>
                  <Input 
                    id="siteName" 
                    className="h-8 text-xs"
                    value={settings.site_name}
                    onChange={(e) => updateSetting('site_name', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="siteDescription" className="text-xs">Site Description</Label>
                  <Input 
                    id="siteDescription" 
                    className="h-8 text-xs"
                    value={settings.site_description}
                    onChange={(e) => updateSetting('site_description', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-xs">Maintenance Mode</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Put the site in maintenance mode</p>
                </div>
                <Switch 
                  checked={settings.maintenance_mode === 'true'}
                  onCheckedChange={() => toggleSetting('maintenance_mode')}
                  className="scale-75"
                />
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-xs">Cookie Consent Banner</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Show a GDPR-style banner.</p>
                  </div>
                  <Switch
                    checked={settings.cookie_banner_enabled === 'true'}
                    onCheckedChange={() => toggleSetting('cookie_banner_enabled')}
                    className="scale-75"
                  />
                </div>
                {settings.cookie_banner_enabled === 'true' && (
                  <div className="pt-1">
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase px-0.5">Banner message</label>
                    <textarea
                      className="w-full rounded-md border border-border bg-background p-2 text-xs leading-normal"
                      rows={2}
                      value={settings.cookie_banner_message}
                      onChange={(e) => updateSetting('cookie_banner_message', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure security and authentication options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">User Registration</p>
                  <p className="text-sm text-muted-foreground">Allow new users to register</p>
                </div>
                <Switch 
                  checked={settings.registration_enabled === 'true'}
                  onCheckedChange={() => toggleSetting('registration_enabled')}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Email Verification</p>
                  <p className="text-sm text-muted-foreground">Require email verification for new accounts</p>
                </div>
                <Switch 
                  checked={settings.email_verification === 'true'}
                  onCheckedChange={() => toggleSetting('email_verification')}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Tipsters Auto-Approval</p>
                  <p className="text-sm text-muted-foreground">Automatically approve new tipster applications</p>
                </div>
                <Switch 
                  checked={settings.tipsters_auto_approval === 'true'}
                  onCheckedChange={() => toggleSetting('tipsters_auto_approval')}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Comments Moderation</p>
                  <p className="text-sm text-muted-foreground">Moderate comments before publishing</p>
                </div>
                <Switch 
                  checked={settings.comments_moderation === 'true'}
                  onCheckedChange={() => toggleSetting('comments_moderation')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Captcha — protects login & signup from bots. */}
          <Card className="mt-3">
            <CardHeader>
              <CardTitle>Login Captcha</CardTitle>
              <CardDescription>
                Choose how Betcheza challenges suspicious sign-ins. Math is built-in
                and works out of the box. Turnstile (Cloudflare) and reCAPTCHA (Google)
                are stronger but need keys you create in their dashboards.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="captchaProvider">Provider</Label>
                <select
                  id="captchaProvider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings.captcha_provider || ''}
                  onChange={(e) => updateSetting('captcha_provider', e.target.value)}
                >
                  <option value="">Auto (use env vars, else math)</option>
                  <option value="math">Math (built-in)</option>
                  <option value="turnstile">Cloudflare Turnstile</option>
                  <option value="recaptcha">Google reCAPTCHA</option>
                  <option value="none">Disabled (not recommended)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Login still triggers a captcha after 3 failed attempts even if disabled here.
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-primary" />
                  Cloudflare Turnstile
                </div>
                <p className="text-xs text-muted-foreground">
                  Get free keys at{' '}
                  <a
                    href="https://dash.cloudflare.com/?to=/:account/turnstile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    dash.cloudflare.com → Turnstile
                  </a>.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="turnstileSiteKey" className="text-xs">Site Key (public)</Label>
                    <Input
                      id="turnstileSiteKey"
                      placeholder="0x4AAA…"
                      value={settings.turnstile_site_key}
                      onChange={(e) => updateSetting('turnstile_site_key', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="turnstileSecretKey" className="text-xs">Secret Key</Label>
                    <Input
                      id="turnstileSecretKey"
                      type="password"
                      placeholder="0x4AAA…"
                      value={settings.turnstile_secret_key}
                      onChange={(e) => updateSetting('turnstile_secret_key', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-primary" />
                  Google reCAPTCHA
                </div>
                <p className="text-xs text-muted-foreground">
                  Get keys at{' '}
                  <a
                    href="https://www.google.com/recaptcha/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    google.com/recaptcha/admin
                  </a>.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="recaptchaSiteKey" className="text-xs">Site Key (public)</Label>
                    <Input
                      id="recaptchaSiteKey"
                      placeholder="6Lc…"
                      value={settings.recaptcha_site_key}
                      onChange={(e) => updateSetting('recaptcha_site_key', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="recaptchaSecretKey" className="text-xs">Secret Key</Label>
                    <Input
                      id="recaptchaSecretKey"
                      type="password"
                      placeholder="6Lc…"
                      value={settings.recaptcha_secret_key}
                      onChange={(e) => updateSetting('recaptcha_secret_key', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure admin notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">New User Notifications</p>
                  <p className="text-sm text-muted-foreground">Get notified when a new user registers</p>
                </div>
                <Switch 
                  checked={settings.notify_new_user === 'true'}
                  onCheckedChange={() => toggleSetting('notify_new_user')}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">New Prediction Notifications</p>
                  <p className="text-sm text-muted-foreground">Get notified when a prediction is posted</p>
                </div>
                <Switch 
                  checked={settings.notify_new_prediction === 'true'}
                  onCheckedChange={() => toggleSetting('notify_new_prediction')}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">New Comment Notifications</p>
                  <p className="text-sm text-muted-foreground">Get notified when a comment is posted</p>
                </div>
                <Switch 
                  checked={settings.notify_new_comment === 'true'}
                  onCheckedChange={() => toggleSetting('notify_new_comment')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Predictions Settings */}
        <TabsContent value="predictions">
          <Card>
            <CardHeader>
              <CardTitle>Predictions Settings</CardTitle>
              <CardDescription>Configure prediction rules and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="maxPredictions">Max Predictions Per Day</Label>
                  <Input 
                    id="maxPredictions" 
                    type="number"
                    value={settings.max_predictions_per_day}
                    onChange={(e) => updateSetting('max_predictions_per_day', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minOdds">Minimum Odds Allowed</Label>
                  <Input 
                    id="minOdds" 
                    type="number"
                    step="0.1"
                    value={settings.min_odds_allowed}
                    onChange={(e) => updateSetting('min_odds_allowed', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxOdds">Maximum Odds Allowed</Label>
                  <Input 
                    id="maxOdds" 
                    type="number"
                    step="0.1"
                    value={settings.max_odds_allowed}
                    onChange={(e) => updateSetting('max_odds_allowed', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input 
                    id="primaryColor" 
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="h-10 w-20 cursor-pointer p-1"
                  />
                  <Input 
                    value={settings.primary_color}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Dark Mode Default</p>
                  <p className="text-sm text-muted-foreground">Use dark mode as the default theme</p>
                </div>
                <Switch 
                  checked={settings.default_theme === 'dark'}
                  onCheckedChange={(checked) => updateSetting('default_theme', checked ? 'dark' : 'light')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Logo and favicon shown across the site and in browser tabs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo (light theme)</Label>
                  <Input id="logoUrl" placeholder="https://… or /uploads/logo.png" value={settings.logo_url} onChange={(e) => updateSetting('logo_url', e.target.value)} />
                  <BrandingFileUpload
                    label="Upload light logo"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onUploaded={(url) => updateSetting('logo_url', url)}
                  />
                  {settings.logo_url && (
                    <div className="rounded-md border border-border bg-muted/40 p-3"><img src={settings.logo_url} alt="logo preview" className="h-10 object-contain" /></div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoDarkUrl">Logo (dark theme — optional)</Label>
                  <Input id="logoDarkUrl" placeholder="https://… or /uploads/logo-dark.png" value={settings.logo_dark_url} onChange={(e) => updateSetting('logo_dark_url', e.target.value)} />
                  <BrandingFileUpload
                    label="Upload dark logo"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onUploaded={(url) => updateSetting('logo_dark_url', url)}
                  />
                  {settings.logo_dark_url && (
                    <div className="rounded-md border border-border bg-slate-900 p-3"><img src={settings.logo_dark_url} alt="dark logo preview" className="h-10 object-contain" /></div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="faviconUrl">Favicon (PNG, ICO or SVG)</Label>
                <Input id="faviconUrl" placeholder="https://… or /uploads/favicon.png" value={settings.favicon_url} onChange={(e) => updateSetting('favicon_url', e.target.value)} />
                <BrandingFileUpload
                  label="Upload favicon"
                  accept="image/png,image/x-icon,image/svg+xml,image/vnd.microsoft.icon"
                  onUploaded={(url) => updateSetting('favicon_url', url)}
                />
                {settings.favicon_url && (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
                    <img src={settings.favicon_url} alt="favicon preview" className="h-8 w-8 rounded" />
                    <span className="text-xs text-muted-foreground">Saved favicons take effect after a hard refresh.</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: you can paste a public image URL or upload a file directly. Don&apos;t forget to click <strong>Save changes</strong> after uploading.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* URL Rewrites */}
        <TabsContent value="rewrites">
          <RewritesEditor
            value={safeParse<RewriteEntry[]>(settings.url_rewrites, [])}
            onChange={(next) => updateSetting('url_rewrites', JSON.stringify(next))}
          />
        </TabsContent>

        {/* 2FA */}
        <TabsContent value="twofa">
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Require a one-time code at every sign-in. Codes are sent over the free email-to-SMS gateway or by email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="twofaForceAll" className="text-sm font-medium">Enforce 2FA for everyone</Label>
                  <p className="text-xs text-muted-foreground mt-1">When on, every user must enter a verification code after their password.</p>
                </div>
                <Switch id="twofaForceAll" checked={settings.twofa_enabled === 'true'} onCheckedChange={(c) => updateSetting('twofa_enabled', c ? 'true' : 'false')} />
              </div>
              <div className="space-y-2">
                <Label>Default delivery method</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={settings.twofa_method === 'email' ? 'default' : 'outline'} onClick={() => updateSetting('twofa_method', 'email')}>Email</Button>
                  <Button type="button" variant={settings.twofa_method === 'sms' ? 'default' : 'outline'} onClick={() => updateSetting('twofa_method', 'sms')}>Email-to-SMS gateway</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email-to-SMS uses your existing SMTP credentials and free carrier gateways (no Twilio account needed). Each user picks their carrier from their account page.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Settings */}
        <TabsContent value="seo">
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Tracking</CardTitle>
                <CardDescription>Site-wide analytics IDs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="googleAnalytics">Google Analytics ID</Label>
                  <Input id="googleAnalytics" placeholder="G-XXXXXXXXXX" value={settings.google_analytics_id} onChange={(e) => updateSetting('google_analytics_id', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebookPixel">Facebook Pixel ID</Label>
                  <Input id="facebookPixel" placeholder="XXXXXXXXXXXXXXXX" value={settings.facebook_pixel_id} onChange={(e) => updateSetting('facebook_pixel_id', e.target.value)} />
                </div>
              </CardContent>
            </Card>
            <SeoPagesEditor
              value={safeParse<SeoPageEntry[]>(settings.seo_pages, [])}
              onChange={(next) => updateSetting('seo_pages', JSON.stringify(next))}
            />
          </div>
        </TabsContent>

        {/* Social Links */}
        <TabsContent value="social">
          <SocialLinksEditor
            value={settings.social_links}
            onChange={(next) => updateSetting('social_links', next)}
          />
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="apikeys">
          <Card>
            <CardHeader>
              <CardTitle>External API keys</CardTitle>
              <CardDescription>
                Stored securely in the site settings table. When set here, these keys override the matching environment variables — leave blank to use the env var instead. Click Save at the top of the page to apply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ApiKeyField
                label="The Odds API key"
                hint="Powers outright winners and US/EU bookmaker odds. Get one at the-odds-api.com."
                value={settings.the_odds_api_key}
                onChange={(v) => updateSetting('the_odds_api_key', v)}
              />
              <ApiKeyField
                label="SportsGameOdds API key"
                hint="Optional. Adds extra bookmakers (FanDuel, DraftKings, Bet365, William Hill...) and deeplinks to the odds comparison panel."
                value={settings.sportsgameodds_api_key}
                onChange={(v) => updateSetting('sportsgameodds_api_key', v)}
              />
              <ApiKeyField
                label="OpenAI API key"
                hint="Used by the AI tip-generation features. Falls back to OPENAI_API_KEY when blank."
                value={settings.openai_api_key}
                onChange={(v) => updateSetting('openai_api_key', v)}
              />
              <ApiKeyField
                label="Football-Data.org API key"
                hint="Powers live scores and fixtures from football-data.org. Falls back to FOOTBALL_DATA_API_KEY env var when blank."
                value={settings.football_data_api_key || ''}
                onChange={(v) => updateSetting('football_data_api_key', v)}
              />
              <div className="border-t pt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold">Web push (VAPID)</h4>
                  <p className="text-xs text-muted-foreground">
                    Required to send browser push notifications. Generate a VAPID key pair with <code className="rounded bg-muted px-1">npx web-push generate-vapid-keys</code>.
                  </p>
                </div>
                <ApiKeyField
                  label="VAPID public key"
                  hint="Shared with browsers when they subscribe."
                  value={settings.vapid_public_key}
                  onChange={(v) => updateSetting('vapid_public_key', v)}
                  reveal
                />
                <ApiKeyField
                  label="VAPID private key"
                  hint="Used by the server to sign push messages. Keep this secret."
                  value={settings.vapid_private_key}
                  onChange={(v) => updateSetting('vapid_private_key', v)}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">VAPID subject (email or URL)</Label>
                  <Input
                    placeholder="mailto:admin@betcheza.com"
                    value={settings.vapid_subject}
                    onChange={(e) => updateSetting('vapid_subject', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BrandingFileUpload({
  label,
  accept,
  onUploaded,
}: {
  label: string;
  accept: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'branding');
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onUploaded(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? 'Uploading…' : label}
      </Button>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

function SocialLinksEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const current = safeParseSocials(value);

  const update = (platform: string, patch: Partial<SocialLink>) => {
    const next: Record<string, SocialLink> = { ...current };
    const existing = next[platform] || { platform, url: '', handle: '', enabled: true };
    next[platform] = { ...existing, ...patch, platform };
    // Persist as compact array — only entries with a URL or that are explicitly enabled.
    const arr = Object.values(next).filter((e) => e.url || e.enabled);
    onChange(JSON.stringify(arr));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Links</CardTitle>
        <CardDescription>
          Toggle each platform on or off and paste the public URL. Enabled icons appear in the site footer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {SOCIAL_PLATFORMS.map((p) => {
          const entry = current[p.key] || { platform: p.key, url: '', handle: '', enabled: false };
          return (
            <div
              key={p.key}
              className="grid items-end gap-2 rounded-lg border border-border p-3 md:grid-cols-[auto_1fr_220px]"
            >
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <Switch
                  checked={entry.enabled}
                  onCheckedChange={(c) => update(p.key, { enabled: c })}
                />
                <Label className="text-sm font-medium">{p.label}</Label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">URL</Label>
                <Input
                  value={entry.url}
                  placeholder={p.placeholder}
                  onChange={(e) => update(p.key, { url: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Handle (optional)</Label>
                <Input
                  value={entry.handle || ''}
                  placeholder="@betcheza"
                  onChange={(e) => update(p.key, { handle: e.target.value })}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SeoPagesEditor({ value, onChange }: { value: SeoPageEntry[]; onChange: (next: SeoPageEntry[]) => void }) {
  const update = (i: number, patch: Partial<SeoPageEntry>) => {
    const next = value.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { path: '/', title: '', description: '' }]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Per-page SEO</CardTitle>
            <CardDescription>Override the title and description for any path. Use <code className="rounded bg-muted px-1">/leagues/*</code> to match a section.</CardDescription>
          </div>
          <Button size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" />Add page</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {value.length === 0 && (
          <p className="text-sm text-muted-foreground">No custom SEO yet — defaults are applied. Click "Add page" to start.</p>
        )}
        {value.map((entry, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs">Path</Label>
                <Input value={entry.path} onChange={(e) => update(i, { path: e.target.value })} placeholder="/, /matches, /leagues/*" />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => remove(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title (≤ 60 chars recommended)</Label>
              <Input value={entry.title || ''} onChange={(e) => update(i, { title: e.target.value })} placeholder="Today's free betting tips — Betcheza" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meta description (≤ 160 chars recommended)</Label>
              <Textarea rows={2} value={entry.description || ''} onChange={(e) => update(i, { description: e.target.value })} placeholder="Browse expert betting tips and predictions for today's matches." />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Keywords (comma separated)</Label>
                <Input value={entry.keywords || ''} onChange={(e) => update(i, { keywords: e.target.value })} placeholder="betting tips, predictions, EPL" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Open Graph image URL</Label>
                <Input value={entry.ogImage || ''} onChange={(e) => update(i, { ogImage: e.target.value })} placeholder="https://…/og.png" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={!!entry.noIndex} onCheckedChange={(c) => update(i, { noIndex: c })} />
              <span className="text-xs text-muted-foreground">Hide from search engines (noindex)</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RewritesEditor({ value, onChange }: { value: RewriteEntry[]; onChange: (next: RewriteEntry[]) => void }) {
  const update = (i: number, patch: Partial<RewriteEntry>) => {
    const next = value.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { source: '/old-path', destination: '/new-path', permanent: false }]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>URL Rewrites</CardTitle>
            <CardDescription>Send visitors from an old URL to a new one. Append <code className="rounded bg-muted px-1">*</code> to the source for prefix matching, e.g. <code className="rounded bg-muted px-1">/blog/*</code> → <code className="rounded bg-muted px-1">/news/*</code>.</CardDescription>
          </div>
          <Button size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" />Add rule</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {value.length === 0 && (
          <p className="text-sm text-muted-foreground">No rewrite rules yet.</p>
        )}
        {value.map((entry, i) => (
          <div key={i} className="rounded-lg border border-border p-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto] items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">From (source)</Label>
              <Input value={entry.source} onChange={(e) => update(i, { source: e.target.value })} placeholder="/old-path" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To (destination)</Label>
              <Input value={entry.destination} onChange={(e) => update(i, { destination: e.target.value })} placeholder="/new-path" />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={!!entry.permanent} onCheckedChange={(c) => update(i, { permanent: c })} />
              <span className="text-xs text-muted-foreground whitespace-nowrap">Permanent (308)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ApiKeyField({
  label,
  hint,
  value,
  onChange,
  reveal: initialReveal = false,
}: {
  label: string
  hint?: string
  value: string
  onChange: (next: string) => void
  reveal?: boolean
}) {
  const [reveal, setReveal] = useState(initialReveal)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          {reveal ? 'Hide' : 'Show'}
        </button>
      </div>
      <Input
        type={reveal ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={value ? '' : 'Leave blank to use environment variable'}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
