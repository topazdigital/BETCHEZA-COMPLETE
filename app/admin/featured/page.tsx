"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Loader2, Save, Star, Trash2, Plus, CheckCircle2, AlertCircle, Eye,
  Pin, EyeOff, RefreshCw, ListChecks, Settings as SettingsIcon, ExternalLink,
} from "lucide-react"

interface FeaturedConfig {
  enabled: boolean
  minConfidence: number
  minOdds: number
  maxOdds: number
  topTipsterOnly: boolean
  sport: string
  pinnedMatchIds: string[]
  hiddenMatchIds: string[]
  limit: number
  updatedAt: string
}

interface TipItem {
  matchId: string
  pinned: boolean
  hidden: boolean
  qualifies: boolean
  skipReasons: string[]
  match: {
    id: string
    homeTeam: { name: string; shortName?: string; logo?: string }
    awayTeam: { name: string; shortName?: string; logo?: string }
    kickoffTime: string
    status: string
    league: { name: string; country?: string; countryCode?: string }
    sport: { name: string; slug: string }
  }
  tip: {
    tipster: { id: string; displayName: string; rank: number }
    prediction: string
    market: string
    odds: number
    confidence: number
  }
}

const DEFAULTS: FeaturedConfig = {
  enabled: true,
  minConfidence: 60,
  minOdds: 1.5,
  maxOdds: 4.0,
  topTipsterOnly: false,
  sport: "",
  pinnedMatchIds: [],
  hiddenMatchIds: [],
  limit: 6,
  updatedAt: "",
}

export default function AdminFeaturedPage() {
  const [config, setConfig] = useState<FeaturedConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [pinnedInput, setPinnedInput] = useState("")
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Tips browser state
  const [tipsLoading, setTipsLoading] = useState(false)
  const [pinnedItems, setPinnedItems] = useState<TipItem[]>([])
  const [todayItems, setTodayItems] = useState<TipItem[]>([])
  const [tipFilter, setTipFilter] = useState<"all" | "qualifying" | "skipped" | "hidden">("all")
  const [tipsErr, setTipsErr] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/featured")
      .then(r => r.json())
      .then(data => {
        if (data?.config) setConfig({ ...DEFAULTS, ...data.config })
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load configuration." }))
      .finally(() => setLoading(false))
  }, [])

  const reloadTips = useCallback(async () => {
    setTipsLoading(true)
    setTipsErr(null)
    try {
      const res = await fetch("/api/admin/featured/tips", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load tips")
      setPinnedItems(Array.isArray(data?.pinned) ? data.pinned : [])
      setTodayItems(Array.isArray(data?.today) ? data.today : [])
      if (data?.config) setConfig({ ...DEFAULTS, ...data.config })
    } catch (e) {
      setTipsErr(e instanceof Error ? e.message : "Failed to load tips")
    } finally {
      setTipsLoading(false)
    }
  }, [])

  useEffect(() => { void reloadTips() }, [reloadTips])

  async function persistConfig(patch: Partial<FeaturedConfig>) {
    const next: FeaturedConfig = { ...config, ...patch }
    setConfig(next)
    try {
      const res = await fetch("/api/admin/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: patch }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || "Save failed")
      if (data.config) setConfig({ ...DEFAULTS, ...data.config })
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed"
      setMessage({ type: "error", text: msg })
      setTimeout(() => setMessage(null), 4000)
      return false
    }
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || "Save failed")
      setConfig({ ...DEFAULTS, ...data.config })
      setMessage({ type: "success", text: "Featured configuration saved." })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed"
      setMessage({ type: "error", text: msg })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  function addPin() {
    const id = pinnedInput.trim()
    if (!id) return
    if (config.pinnedMatchIds.includes(id)) {
      setMessage({ type: "error", text: "Match ID already pinned." })
      return
    }
    setConfig(c => ({ ...c, pinnedMatchIds: [...c.pinnedMatchIds, id] }))
    setPinnedInput("")
  }

  function removePin(id: string) {
    setConfig(c => ({ ...c, pinnedMatchIds: c.pinnedMatchIds.filter(x => x !== id) }))
  }

  async function preview() {
    setPreviewLoading(true)
    try {
      const res = await fetch("/api/featured", { cache: "no-store" })
      const data = await res.json()
      setPreviewCount(Array.isArray(data?.items) ? data.items.length : 0)
    } catch {
      setPreviewCount(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Inline pin/hide actions used by the Tips tab.
  async function togglePin(id: string, currentlyPinned: boolean) {
    const nextPinned = currentlyPinned
      ? config.pinnedMatchIds.filter(x => x !== id)
      : [...config.pinnedMatchIds, id]
    const nextHidden = currentlyPinned ? config.hiddenMatchIds : config.hiddenMatchIds.filter(x => x !== id)
    const ok = await persistConfig({ pinnedMatchIds: nextPinned, hiddenMatchIds: nextHidden })
    if (ok) await reloadTips()
  }

  async function toggleHide(id: string, currentlyHidden: boolean) {
    const nextHidden = currentlyHidden
      ? config.hiddenMatchIds.filter(x => x !== id)
      : [...config.hiddenMatchIds, id]
    // Hiding also un-pins to avoid contradictory state.
    const nextPinned = currentlyHidden ? config.pinnedMatchIds : config.pinnedMatchIds.filter(x => x !== id)
    const ok = await persistConfig({ hiddenMatchIds: nextHidden, pinnedMatchIds: nextPinned })
    if (ok) await reloadTips()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const visibleToday = todayItems.filter(it => {
    if (tipFilter === "qualifying") return it.qualifies
    if (tipFilter === "skipped") return !it.qualifies && !it.hidden
    if (tipFilter === "hidden") return it.hidden
    return true
  })

  const qualifyingCount = todayItems.filter(i => i.qualifies).length
  const hiddenCount = todayItems.filter(i => i.hidden).length

  return (
    <div className="space-y-4 p-3 md:p-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Featured Tips
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Controls the &quot;Favorited Tips&quot; panel that appears on the homepage when there
            are 3 or fewer live games. Pin or hide individual matches inline, or tune the
            auto-fill criteria from the Settings tab.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
            message.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {message.text}
        </div>
      )}

      <Tabs defaultValue="tips" className="space-y-3">
        <TabsList className="h-8 p-1">
          <TabsTrigger value="tips" className="h-6 text-xs px-2 gap-1.5">
            <ListChecks className="h-3.5 w-3.5" />
            Tips ({todayItems.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="h-6 text-xs px-2 gap-1.5">
            <SettingsIcon className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ──────────────── TIPS TAB ──────────────── */}
        <TabsContent value="tips" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="h-5 gap-1 text-[10px] px-1.5">
                <Pin className="h-2.5 w-2.5 text-amber-500" /> Pinned: {pinnedItems.length}
              </Badge>
              <Badge variant="outline" className="h-5 gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5">
                <CheckCircle2 className="h-2.5 w-2.5" /> Qualifying: {qualifyingCount}
              </Badge>
              <Badge variant="outline" className="h-5 gap-1 border-rose-500/40 text-rose-600 dark:text-rose-400 text-[10px] px-1.5">
                <EyeOff className="h-2.5 w-2.5" /> Hidden: {hiddenCount}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={reloadTips} disabled={tipsLoading}>
                {tipsLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Refresh
              </Button>
            </div>
          </div>

          {tipsErr && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300">
              {tipsErr}
            </div>
          )}

          {/* Pinned section */}
          {pinnedItems.length > 0 && (
            <Card>
              <CardHeader className="py-2 pb-1.5 px-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Pin className="h-3.5 w-3.5 text-amber-500" /> Pinned tips
                </CardTitle>
                <CardDescription className="text-xs">
                  Always shown first on the homepage panel, in order, regardless of criteria.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 p-3 pt-0">
                {pinnedItems.map(it => (
                  <TipRow
                    key={it.matchId}
                    item={it}
                    onPinToggle={togglePin}
                    onHideToggle={toggleHide}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Today's potential picks */}
          <Card>
            <CardHeader className="py-2 pb-1.5 px-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">Today&apos;s auto-generated tips</CardTitle>
                  <CardDescription className="text-xs">
                    Every upcoming match today and whether the auto-fill rule would surface it.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(["all", "qualifying", "skipped", "hidden"] as const).map(f => (
                    <Button
                      key={f}
                      size="sm"
                      variant={tipFilter === f ? "default" : "outline"}
                      onClick={() => setTipFilter(f)}
                      className="capitalize h-7 text-xs px-2"
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 p-3 pt-0">
              {tipsLoading && todayItems.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : visibleToday.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {todayItems.length === 0
                    ? "No upcoming matches today."
                    : "No tips match this filter."}
                </p>
              ) : (
                visibleToday.map(it => (
                  <TipRow
                    key={it.matchId}
                    item={it}
                    onPinToggle={togglePin}
                    onHideToggle={toggleHide}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────────── SETTINGS TAB ──────────────── */}
        <TabsContent value="settings" className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={preview} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
              Preview
            </Button>
            <Button size="sm" className="h-8 text-xs px-3" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save
            </Button>
          </div>

          {previewCount !== null && (
            <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs">
              Live preview: <span className="font-bold">{previewCount}</span> tip{previewCount === 1 ? "" : "s"} would be shown right now.
            </div>
          )}

          <Card>
            <CardHeader className="py-2 pb-1.5 px-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Panel Status</CardTitle>
                  <CardDescription className="text-xs">Master switch for the Favorited Tips panel.</CardDescription>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={v => setConfig(c => ({ ...c, enabled: v }))}
                />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-2 pb-1.5 px-3">
              <CardTitle className="text-sm font-semibold">Auto-fill Criteria</CardTitle>
              <CardDescription className="text-xs">
                When the panel needs more picks beyond pinned matches, it pulls from today&apos;s upcoming games using these rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="minConfidence" className="text-xs">Minimum confidence (%)</Label>
                  <Input
                    id="minConfidence"
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 text-xs"
                    value={config.minConfidence}
                    onChange={e => setConfig(c => ({ ...c, minConfidence: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="limit" className="text-xs">Max tips shown</Label>
                  <Input
                    id="limit"
                    type="number"
                    min={1}
                    max={24}
                    className="h-8 text-xs"
                    value={config.limit}
                    onChange={e => setConfig(c => ({ ...c, limit: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="minOdds" className="text-xs">Minimum odds</Label>
                  <Input
                    id="minOdds"
                    type="number"
                    step="0.01"
                    min={1}
                    className="h-8 text-xs"
                    value={config.minOdds}
                    onChange={e => setConfig(c => ({ ...c, minOdds: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maxOdds" className="text-xs">Maximum odds</Label>
                  <Input
                    id="maxOdds"
                    type="number"
                    step="0.01"
                    min={1}
                    className="h-8 text-xs"
                    value={config.maxOdds}
                    onChange={e => setConfig(c => ({ ...c, maxOdds: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="sport" className="text-xs">Sport filter (slug)</Label>
                  <Input
                    id="sport"
                    placeholder="e.g. football  (leave blank for all sports)"
                    className="h-8 text-xs"
                    value={config.sport}
                    onChange={e => setConfig(c => ({ ...c, sport: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <div>
                  <p className="text-xs font-semibold">Top tipsters only</p>
                  <p className="text-[10px] text-muted-foreground">
                    Restrict auto-picks to leaderboard rank ≤ 5.
                  </p>
                </div>
                <Switch
                  checked={config.topTipsterOnly}
                  onCheckedChange={v => setConfig(c => ({ ...c, topTipsterOnly: v }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 pb-1.5 px-3">
              <CardTitle className="text-sm font-semibold">Manually Pinned Matches (advanced)</CardTitle>
              <CardDescription className="text-xs">
                Prefer using the Tips tab. You can also paste raw match IDs here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Enter match ID and press Add"
                  className="h-8 text-xs"
                  value={pinnedInput}
                  onChange={e => setPinnedInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPin() } }}
                />
                <Button type="button" onClick={addPin} variant="outline" size="sm" className="h-8 text-xs px-3">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              {config.pinnedMatchIds.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">No matches pinned.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {config.pinnedMatchIds.map((id, i) => (
                    <li key={id} className="flex items-center justify-between px-2 py-1 bg-muted/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="shrink-0 h-4 px-1 text-[9px]">#{i + 1}</Badge>
                        <code className="text-[10px] font-mono truncate">{id}</code>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removePin(id)}>
                        <Trash2 className="h-3 w-3 text-rose-500" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {config.hiddenMatchIds.length > 0 && (
            <Card>
              <CardHeader className="py-2 pb-1.5 px-3">
                <CardTitle className="text-sm font-semibold">Hidden matches</CardTitle>
                <CardDescription className="text-xs">
                  These matches will never surface in the panel until un-hidden.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {config.hiddenMatchIds.map(id => (
                    <li key={id} className="flex items-center justify-between px-2 py-1 bg-muted/20">
                      <code className="text-[10px] font-mono truncate">{id}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-1.5"
                        onClick={() => setConfig(c => ({ ...c, hiddenMatchIds: c.hiddenMatchIds.filter(x => x !== id) }))}
                      >
                        Un-hide
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground px-1">
            Last updated: {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "never"}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TipRow({
  item,
  onPinToggle,
  onHideToggle,
}: {
  item: TipItem
  onPinToggle: (id: string, pinned: boolean) => void
  onHideToggle: (id: string, hidden: boolean) => void
}) {
  const t = new Date(item.match.kickoffTime)
  const time = isNaN(t.getTime())
    ? "—"
    : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${
        item.hidden
          ? "border-rose-500/30 bg-rose-500/5 opacity-70"
          : item.pinned
            ? "border-amber-500/40 bg-amber-500/5"
            : item.qualifies
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-border bg-muted/20"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
            {item.match.league.name || item.match.sport.name}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">{time}</span>
          {item.pinned && (
            <Badge className="h-5 gap-1 bg-amber-500/15 text-amber-600 border-0 dark:text-amber-400 hover:bg-amber-500/15 px-1.5 text-[10px]">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </Badge>
          )}
          {item.hidden && (
            <Badge className="h-5 gap-1 bg-rose-500/15 text-rose-600 border-0 dark:text-rose-400 hover:bg-rose-500/15 px-1.5 text-[10px]">
              <EyeOff className="h-2.5 w-2.5" /> Hidden
            </Badge>
          )}
          {!item.hidden && !item.pinned && (
            item.qualifies ? (
              <Badge className="h-5 bg-emerald-500/15 text-emerald-600 border-0 dark:text-emerald-400 hover:bg-emerald-500/15 px-1.5 text-[10px]">
                Qualifies
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                Skipped
              </Badge>
            )
          )}
        </div>
        <p className="text-sm font-semibold text-foreground truncate">
          {item.match.homeTeam.name} <span className="text-muted-foreground">vs</span> {item.match.awayTeam.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span><span className="text-muted-foreground/70">Pick:</span> <span className="font-semibold text-foreground">{item.tip.prediction}</span></span>
          <span><span className="text-muted-foreground/70">Odds:</span> <span className="font-mono font-bold text-foreground">{item.tip.odds.toFixed(2)}</span></span>
          <span><span className="text-muted-foreground/70">Conf:</span> <span className="font-bold text-foreground">{item.tip.confidence}%</span></span>
          <span><span className="text-muted-foreground/70">By:</span> {item.tip.tipster.displayName} <span className="text-muted-foreground/60">#{item.tip.tipster.rank}</span></span>
        </div>
        {!item.qualifies && item.skipReasons.length > 0 && (
          <p className="mt-1 text-[11px] text-rose-500">
            Skipped: {item.skipReasons.join(" · ")}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant={item.pinned ? "default" : "outline"}
          className={item.pinned ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
          onClick={() => onPinToggle(item.matchId, item.pinned)}
        >
          <Pin className="h-3.5 w-3.5 mr-1" />
          {item.pinned ? "Unpin" : "Pin"}
        </Button>
        <Button
          size="sm"
          variant={item.hidden ? "default" : "outline"}
          className={item.hidden ? "bg-rose-500 hover:bg-rose-600 text-white" : ""}
          onClick={() => onHideToggle(item.matchId, item.hidden)}
        >
          <EyeOff className="h-3.5 w-3.5 mr-1" />
          {item.hidden ? "Unhide" : "Hide"}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <a href={`/matches/${item.matchId}`} target="_blank" rel="noreferrer" title="Open match">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  )
}
