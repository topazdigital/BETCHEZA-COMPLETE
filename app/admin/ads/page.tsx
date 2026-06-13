"use client"

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react"
import { Save, Loader2, CheckCircle2, AlertCircle, ToggleLeft, Globe, Code, Plus, Trash2, Eye, EyeOff, Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AdsConfig, AdSlot } from "@/app/api/admin/ads/route"

const SLOT_META: { key: string; label: string; description: string; example: string }[] = [
  { key: 'header', label: 'Header Banner', description: 'Displayed at the top of every page (leaderboard, 728×90 or responsive).', example: '728x90' },
  { key: 'sidebar', label: 'Sidebar Rectangle', description: 'Shown in the right sidebar on desktop (medium rectangle, 300×250).', example: '300x250' },
  { key: 'betweenMatches', label: 'In-Feed / Between Matches', description: 'Injected between match groups in the matches list.', example: '320x100' },
  { key: 'matchDetail', label: 'Match Detail Page', description: 'Shown on individual match pages below the scoreboard.', example: '300x250' },
  { key: 'footer', label: 'Footer Banner', description: 'Displayed at the bottom of every page above the footer links.', example: '728x90' },
]

const DEFAULT_CONFIG: AdsConfig = {
  enabled: false,
  adsense: { publisherId: '', autoAds: false },
  slots: {
    header: { enabled: false, type: 'adsense', slotId: '', label: 'Header Banner (728×90)' },
    sidebar: { enabled: false, type: 'adsense', slotId: '', label: 'Sidebar (300×250)' },
    betweenMatches: { enabled: false, type: 'adsense', slotId: '', label: 'In-Feed / Between Matches (320×100)' },
    matchDetail: { enabled: false, type: 'adsense', slotId: '', label: 'Match Detail Page (300×250)' },
    footer: { enabled: false, type: 'adsense', slotId: '', label: 'Footer Banner (728×90)' },
  },
}

function SlotCard({
  slotKey, meta, slot,
  publisherId,
  onChange,
}: {
  slotKey: string
  meta: typeof SLOT_META[0]
  slot: AdSlot
  publisherId: string
  onChange: (key: string, updated: AdSlot) => void
}) {
  const [showHtml, setShowHtml] = useState(false)

  return (
    <Card className={cn("transition-all", slot.enabled ? "border-primary/40" : "border-border opacity-80")}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("h-2 w-2 rounded-full shrink-0", slot.enabled ? "bg-green-500" : "bg-muted-foreground/40")} />
            <CardTitle className="text-sm">{meta.label}</CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{meta.example}</Badge>
          </div>
          <Switch
            checked={slot.enabled}
            onCheckedChange={(v) => onChange(slotKey, { ...slot, enabled: v })}
          />
        </div>
        <CardDescription className="text-xs mt-0.5">{meta.description}</CardDescription>
      </CardHeader>

      {slot.enabled && (
        <CardContent className="px-4 pb-3 space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={slot.type === 'adsense' ? 'default' : 'outline'}
              className="h-7 text-xs gap-1.5"
              onClick={() => onChange(slotKey, { ...slot, type: 'adsense' })}
            >
              <Globe className="h-3 w-3" /> Google AdSense
            </Button>
            <Button
              size="sm"
              variant={slot.type === 'custom' ? 'default' : 'outline'}
              className="h-7 text-xs gap-1.5"
              onClick={() => onChange(slotKey, { ...slot, type: 'custom' })}
            >
              <Code className="h-3 w-3" /> Custom HTML
            </Button>
          </div>

          {slot.type === 'adsense' && (
            <div className="space-y-1.5">
              <Label className="text-xs">AdSense Ad Slot ID</Label>
              <Input
                value={slot.slotId || ''}
                onChange={(e) => onChange(slotKey, { ...slot, slotId: e.target.value })}
                placeholder="e.g. 1234567890"
                className="h-8 text-sm font-mono"
              />
              {publisherId && slot.slotId && (
                <p className="text-[10px] text-muted-foreground font-mono">
                  Will render: data-ad-client="{publisherId}" data-ad-slot="{slot.slotId}"
                </p>
              )}
              {!publisherId && (
                <p className="text-[10px] text-yellow-600 dark:text-yellow-400">
                  Set your Publisher ID above first.
                </p>
              )}
            </div>
          )}

          {slot.type === 'custom' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Custom Ad HTML</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1"
                  onClick={() => setShowHtml(v => !v)}
                >
                  {showHtml ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showHtml ? 'Hide' : 'Show'}
                </Button>
              </div>
              {showHtml && (
                <Textarea
                  value={slot.customHtml || ''}
                  onChange={(e) => onChange(slotKey, { ...slot, customHtml: e.target.value })}
                  placeholder={'<!-- Paste your ad tag HTML here -->\n<ins class="adsbygoogle" ...></ins>\n<script>...</script>'}
                  className="font-mono text-[11px] min-h-[100px] resize-y"
                />
              )}
              {!showHtml && (
                <p className="text-[11px] text-muted-foreground">
                  {slot.customHtml ? `${slot.customHtml.slice(0, 60).trim()}…` : 'No HTML set — click Show to edit.'}
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default function AdminAdsPage() {
  const [config, setConfig] = useState<AdsConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/ads')
      .then(r => r.json())
      .then(data => { setConfig(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSlotChange = (key: string, updated: AdSlot) => {
    setConfig(prev => ({
      ...prev,
      slots: { ...prev.slots, [key]: updated },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = Object.values(config.slots).filter(s => s.enabled).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading ads config…
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Megaphone className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Ads Management</h1>
            <p className="text-xs text-muted-foreground">
              Configure Google AdSense and custom ad placements across the site.
              {enabledCount > 0 && <span className="ml-1 text-green-600 dark:text-green-400">{enabledCount} slot{enabledCount > 1 ? 's' : ''} active</span>}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Global Toggle */}
      <Card>
        <CardContent className="pt-4 pb-4 px-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">Enable Ads Globally</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master switch. When off, no ads are shown even if individual slots are enabled.
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => setConfig(prev => ({ ...prev, enabled: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Google AdSense Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-primary" /> Google AdSense
          </CardTitle>
          <CardDescription className="text-xs">
            Your publisher ID from the AdSense dashboard. Format: ca-pub-XXXXXXXXXXXXXXXX
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Publisher ID</Label>
            <Input
              value={config.adsense.publisherId}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                adsense: { ...prev.adsense, publisherId: e.target.value }
              }))}
              placeholder="ca-pub-XXXXXXXXXXXXXXXX"
              className="h-9 text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Find this in your AdSense account under Account → Account information.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Auto Ads</p>
              <p className="text-xs text-muted-foreground">Let Google automatically place and optimize ads across your pages.</p>
            </div>
            <Switch
              checked={config.adsense.autoAds}
              onCheckedChange={(v) => setConfig(prev => ({
                ...prev,
                adsense: { ...prev.adsense, autoAds: v }
              }))}
            />
          </div>

          {config.adsense.publisherId && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground">
              {'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='}
              <span className="text-primary">{config.adsense.publisherId}</span>
              {'" crossorigin="anonymous"></script>'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad Slots */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ad Slots</h2>
          <p className="text-xs text-muted-foreground">{enabledCount}/{SLOT_META.length} enabled</p>
        </div>

        {SLOT_META.map(meta => (
          <SlotCard
            key={meta.key}
            slotKey={meta.key}
            meta={meta}
            slot={config.slots[meta.key] || { enabled: false, type: 'adsense' }}
            publisherId={config.adsense.publisherId}
            onChange={handleSlotChange}
          />
        ))}
      </div>

      {/* How It Works */}
      <Card className="border-muted/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">How ads are served</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5 pb-4">
          <p>1. Enable the global toggle and add your AdSense Publisher ID.</p>
          <p>2. Turn on individual slots. For AdSense slots, add the slot ID from your AdSense "Ads" page.</p>
          <p>3. Alternatively select "Custom HTML" to paste any third-party ad tag (e.g. Media.net, Ezoic, direct banners).</p>
          <p>4. The site injects the ad code automatically — no code changes needed after saving.</p>
          <p className="text-yellow-600 dark:text-yellow-400 pt-1">Note: AdSense must approve your site before ads show. New publishers may see blank slots during review.</p>
        </CardContent>
      </Card>

      {/* Save button (bottom) */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
