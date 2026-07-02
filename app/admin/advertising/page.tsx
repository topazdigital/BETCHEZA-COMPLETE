"use client"

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Copy, Check, Mail, Eye, Megaphone, Code2, Wand2, Info, Clock, Trash2,
  RefreshCw, Building2, ChevronDown, BarChart2, MousePointerClick, TrendingUp,
  Send, Inbox,
} from "lucide-react"

const TIERS = [
  { id: "banner",   label: "Banner Ads",      price: "KES 25k/mo", description: "728×90 + 300×250 on all match & league pages", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { id: "odds",     label: "Odds Integration", price: "KES 40k/mo", description: "Live odds on every match page with Bet Now links",  color: "bg-green-500/10 text-green-500 border-green-500/30" },
  { id: "homepage", label: "Homepage Feature", price: "KES 35k/mo", description: "Above-fold featured bookmaker slot + promo banner",  color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  { id: "package",  label: "Full Package",     price: "KES 80k/mo", description: "Banners + odds + homepage + email campaigns",        color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
] as const

type TierId = typeof TIERS[number]["id"]

const TARGET_BOOKMAKERS = [
  { name: "SportPesa",     contact: "Marketing Team" },
  { name: "Betika",        contact: "Partnerships Team" },
  { name: "Odibets",       contact: "Advertising Team" },
  { name: "Betin Kenya",   contact: "Marketing Team" },
  { name: "22Bet Kenya",   contact: "Affiliate Team" },
  { name: "Mozzart Bet",   contact: "Marketing Team" },
  { name: "Dafabet Kenya", contact: "Partnerships Team" },
  { name: "MelBet Kenya",  contact: "Affiliate Team" },
]

const TOKENS = [
  { token: "{{company_name}}", label: "Company name" },
  { token: "{{contact_name}}", label: "Contact name" },
  { token: "{{custom_note}}",  label: "Custom note" },
]

const PLACEHOLDER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 8px; max-width: 600px; margin: 0 auto; padding: 40px; }
    h1 { color: #1a1a1a; }
    p { color: #555; line-height: 1.6; }
    .cta { display: inline-block; background: #6d28d9; color: #fff; padding: 14px 28px;
           border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Partnership Proposal for {{company_name}}</h1>
    <p>Hi {{contact_name}},</p>
    <p>We'd love to partner with {{company_name}} to reach Kenya's most engaged bettors on Betcheza.</p>
    <p>{{custom_note}}</p>
    <a class="cta" href="https://betcheza.co.ke/partner">View Partnership Info</a>
  </div>
</body>
</html>`

interface HistoryEntry {
  id: string
  sentAt: string
  company: string
  contactName?: string
  email: string
  subject: string
  tier?: string
  mode: "template" | "custom"
}

interface AnalyticsEntry extends HistoryEntry {
  opens: number
  clicks: number
  lastOpenAt?: string
  lastClickAt?: string
}

interface CompanyStats { sent: number; opens: number; clicks: number }

const TIER_LABELS: Record<string, string> = {
  banner: "Banner", odds: "Odds", homepage: "Homepage", package: "Full Pkg",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function applyTokens(html: string, bookmakerName: string, contactName: string, customNote: string): string {
  return html
    .replaceAll("{{company_name}}", bookmakerName || "")
    .replaceAll("{{contact_name}}", contactName || "")
    .replaceAll("{{custom_note}}", customNote || "")
}

function pct(num: number, denom: number) {
  if (!denom) return "—"
  return `${Math.round((num / denom) * 100)}%`
}

type Tab = "compose" | "performance"

export default function AdvertisingAdminPage() {
  const [tab, setTab] = useState<Tab>("compose")
  const [mode, setMode] = useState<"template" | "custom">("template")

  const [activeTier, setActiveTier] = useState<TierId>("package")
  const [bookmakerName, setBookmakerName] = useState("SportPesa")
  const [contactName, setContactName] = useState("Marketing Team")
  const [customNote, setCustomNote] = useState("")
  const [previewHtml, setPreviewHtml] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [customHtml, setCustomHtml] = useState(PLACEHOLDER_HTML)
  const [customSubject, setCustomSubject] = useState("Partnership Proposal for {{company_name}} — Betcheza.co.ke")

  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Performance tab
  const [analytics, setAnalytics] = useState<AnalyticsEntry[]>([])
  const [byCompany, setByCompany] = useState<Record<string, CompanyStats>>({})
  const [totals, setTotals] = useState({ sent: 0, opens: 0, clicks: 0 })
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const activePreviewHtml = mode === "custom"
    ? applyTokens(customHtml, bookmakerName, contactName, customNote)
    : previewHtml

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/admin/advertising/history")
      const d = await res.json()
      if (d.history) setHistory(d.history)
    } catch {}
    setHistoryLoading(false)
  }, [])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const res = await fetch("/api/admin/advertising/analytics")
      const d = await res.json()
      if (d.entries)    setAnalytics(d.entries)
      if (d.byCompany)  setByCompany(d.byCompany)
      if (d.totals)     setTotals(d.totals)
    } catch {}
    setAnalyticsLoading(false)
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])
  useEffect(() => { if (tab === "performance") loadAnalytics() }, [tab, loadAnalytics])

  async function generateTemplatePreview() {
    setLoadingPreview(true)
    try {
      const res = await fetch("/api/admin/advertising/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: activeTier, bookmakerName, contactName, customNote }),
      })
      const d = await res.json()
      if (d.html) setPreviewHtml(d.html)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function copyHtml() {
    const html = activePreviewHtml
    if (!html && mode === "template") { await generateTemplatePreview(); return }
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  async function sendEmail() {
    if (!recipientEmail) return
    setSending(true)
    setSentTo("")
    try {
      const body = mode === "custom"
        ? {
            email: recipientEmail, bookmakerName, contactName, customNote,
            customHtml: applyTokens(customHtml, bookmakerName, contactName, customNote),
            customSubject: applyTokens(customSubject, bookmakerName, contactName, customNote),
          }
        : { tier: activeTier, bookmakerName, contactName, customNote, email: recipientEmail }

      const res = await fetch("/api/admin/advertising/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (d.success) {
        setSentTo(recipientEmail)
        setHistoryOpen(true)
        await loadHistory()
      }
    } finally {
      setSending(false)
    }
  }

  async function deleteEntry(id: string) {
    setDeletingId(id)
    try {
      await fetch("/api/admin/advertising/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setHistory(h => h.filter(e => e.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  function insertToken(token: string) {
    const ta = document.getElementById("custom-html-area") as HTMLTextAreaElement | null
    if (!ta) { setCustomHtml(h => h + token); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = customHtml.slice(0, start) + token + customHtml.slice(end)
    setCustomHtml(next)
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + token.length; ta.focus() }, 0)
  }

  const sortedCompanies = Object.entries(byCompany)
    .sort((a, b) => b[1].opens - a[1].opens)

  return (
    <div className="space-y-3 max-w-7xl">
      {/* Header + tab switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            Bookmaker Advertising
          </h1>
          <p className="text-[11px] text-muted-foreground">Generate, send, and track partnership emails</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Page tabs */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setTab("compose")} className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${tab === "compose" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
              <Send className="h-3 w-3" /> Compose
            </button>
            <button onClick={() => setTab("performance")} className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${tab === "performance" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
              <BarChart2 className="h-3 w-3" /> Performance
            </button>
          </div>
          {/* Mode toggle (compose only) */}
          {tab === "compose" && (
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setMode("template")} className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${mode === "template" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                <Wand2 className="h-3 w-3" /> Template
              </button>
              <button onClick={() => setMode("custom")} className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${mode === "custom" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                <Code2 className="h-3 w-3" /> Custom HTML
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ COMPOSE TAB */}
      {tab === "compose" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Left */}
            <div className="md:col-span-2 space-y-3">
              {mode === "template" ? (
                <Card>
                  <CardHeader className="py-2 px-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Package Tier</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-3 pt-0 grid grid-cols-2 gap-1.5">
                    {TIERS.map(t => (
                      <button key={t.id} onClick={() => setActiveTier(t.id)}
                        className={`text-left rounded-lg border p-2 transition-all text-[11px] leading-snug ${activeTier === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}
                      >
                        <div className="font-semibold text-foreground mb-0.5">{t.label}</div>
                        <div className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold mb-1 ${t.color}`}>{t.price}</div>
                        <div className="text-muted-foreground leading-relaxed hidden sm:block">{t.description}</div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="py-2 px-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Subject</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-3 pt-0 space-y-2">
                    <Input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="Partnership Proposal for {{company_name}}" className="h-7 text-xs" />
                    <div className="rounded-md bg-muted/40 border border-border px-2.5 py-2 space-y-1.5">
                      <p className="text-[10px] font-semibold text-foreground flex items-center gap-1"><Info className="h-3 w-3 text-primary" /> Available tokens</p>
                      <div className="flex flex-wrap gap-1">
                        {TOKENS.map(({ token, label }) => (
                          <button key={token} onClick={() => insertToken(token)} className="rounded border border-primary/30 bg-primary/5 px-1.5 py-px text-[10px] font-mono text-primary hover:bg-primary/15 transition-colors" title={`Insert ${label}`}>{token}</button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recipient Details</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 pt-0 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {TARGET_BOOKMAKERS.map(b => (
                      <button key={b.name} onClick={() => { setBookmakerName(b.name); setContactName(b.contact) }}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${bookmakerName === b.name ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"}`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Company Name</Label>
                      <Input value={bookmakerName} onChange={e => setBookmakerName(e.target.value)} placeholder="e.g. SportPesa" className="mt-0.5 h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Contact (optional)</Label>
                      <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. John Doe" className="mt-0.5 h-7 text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Custom Note (optional)</Label>
                    <textarea value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="e.g. We're offering a 3-month bundle at a 20% discount…" className="mt-0.5 w-full min-h-[52px] rounded-md border border-input bg-background px-2.5 py-1.5 text-xs resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </div>
                  {mode === "template" && (
                    <Button onClick={generateTemplatePreview} disabled={loadingPreview} className="w-full h-7 text-xs" size="sm">
                      <Eye className="h-3 w-3 mr-1.5" />
                      {loadingPreview ? "Generating…" : "Preview Email"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {mode === "template" && (
                <Card>
                  <CardHeader className="py-2 px-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sample Subject Lines</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    <ul className="space-y-1">
                      {[
                        `Partnership Proposal for ${bookmakerName || "Bookmaker"} — Betcheza.co.ke`,
                        "Reach 50,000+ Kenyan Bettors Monthly — Betcheza.co.ke",
                        "Display Your Odds on Kenya's #1 Tipster Platform",
                        "Exclusive Advertising Slots Now Available — Betcheza 2026",
                      ].map(s => (
                        <li key={s} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                          <span className="text-primary font-bold shrink-0 mt-px">→</span>{s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right */}
            <div className="md:col-span-3 space-y-3">
              <Card>
                <CardContent className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-36">
                      <Label className="text-[10px] text-muted-foreground">Send to Email Address</Label>
                      <Input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="marketing@bookmaker.com" type="email" className="mt-0.5 h-7 text-xs" />
                    </div>
                    <Button onClick={sendEmail} disabled={!recipientEmail || sending} size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white px-3">
                      <Mail className="h-3 w-3 mr-1.5" />
                      {sending ? "Sending…" : "Send Email"}
                    </Button>
                    <Button onClick={copyHtml} variant="outline" size="sm" className="h-7 text-xs px-3">
                      {copied ? <Check className="h-3 w-3 mr-1.5 text-green-500" /> : <Copy className="h-3 w-3 mr-1.5" />}
                      {copied ? "Copied!" : "Copy HTML"}
                    </Button>
                  </div>
                  {sentTo && <p className="text-[11px] text-green-500 mt-1.5">✅ Email sent to {sentTo} — logged in Sent History below</p>}
                </CardContent>
              </Card>

              {mode === "custom" && (
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Code2 className="h-3 w-3" /> HTML Editor
                      <span className="text-[10px] font-normal normal-case">— preview updates live</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <textarea id="custom-html-area" value={customHtml} onChange={e => setCustomHtml(e.target.value)} spellCheck={false}
                      className="w-full h-44 px-3 py-2.5 font-mono text-[11px] leading-relaxed bg-muted/30 border-0 border-t border-border resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-b-lg"
                      placeholder="Paste your full HTML email here…" />
                  </CardContent>
                </Card>
              )}

              <Card className="overflow-hidden">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <Eye className="h-3 w-3" /> Email Preview
                    {mode === "custom" && <span className="text-[10px] font-normal normal-case text-muted-foreground">— tokens replaced with recipient details</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {activePreviewHtml ? (
                    <div className="border-t">
                      <iframe srcDoc={activePreviewHtml} className="w-full h-80 sm:h-[420px] border-0" title="Email preview" sandbox="allow-same-origin" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                      <Megaphone className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-xs font-medium">No preview yet</p>
                      <p className="text-[11px] mt-0.5 text-muted-foreground/70">{mode === "template" ? 'Click "Preview Email" to generate' : "Start typing HTML above"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sent History (collapsible) */}
          <Card>
            <button
              onClick={() => setHistoryOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Sent History</span>
                {history.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{history.length}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); loadHistory() }} disabled={historyLoading}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/50">
                  <RefreshCw className={`h-2.5 w-2.5 ${historyLoading ? "animate-spin" : ""}`} />Refresh
                </button>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
            {historyOpen && (
              <div className="border-t border-border">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-16 text-muted-foreground text-xs">Loading…</div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                    <Building2 className="h-6 w-6 mb-1.5 opacity-20" />
                    <p className="text-xs font-medium">No emails sent yet</p>
                    <p className="text-[11px] mt-0.5 opacity-60">Every email you send will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {history.map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors group">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-primary">{entry.company.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-foreground">{entry.company}</span>
                            {entry.contactName && <span className="text-[10px] text-muted-foreground">· {entry.contactName}</span>}
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 ${entry.mode === "custom" ? "border-violet-400/40 text-violet-500 bg-violet-500/5" : "border-border text-muted-foreground"}`}>
                              {entry.mode === "custom" ? "Custom" : entry.tier ? TIER_LABELS[entry.tier] ?? entry.tier : "Template"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{entry.email}</span>
                            <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />{timeAgo(entry.sentAt)}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 truncate hidden md:inline max-w-[260px]">{entry.subject}</span>
                          </div>
                        </div>
                        <button onClick={() => deleteEntry(entry.id)} disabled={deletingId === entry.id}
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ PERFORMANCE TAB */}
      {tab === "performance" && (
        <div className="space-y-3">
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Emails Sent",   value: totals.sent,   icon: Send,              color: "text-primary" },
              { label: "Total Opens",   value: totals.opens,  icon: Inbox,             color: "text-blue-500" },
              { label: "Total Clicks",  value: totals.clicks, icon: MousePointerClick, color: "text-green-500" },
              { label: "Avg Open Rate", value: pct(totals.opens, totals.sent), icon: TrendingUp, color: "text-amber-500", isText: true },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${stat.color}`}>
                    {stat.isText ? stat.value : (stat.value as number).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Per-bookmaker breakdown */}
            <Card className="md:col-span-2">
              <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">By Bookmaker</CardTitle>
                <button onClick={loadAnalytics} disabled={analyticsLoading} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className={`h-2.5 w-2.5 ${analyticsLoading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">Loading…</div>
                ) : sortedCompanies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                    <BarChart2 className="h-7 w-7 mb-2 opacity-20" />
                    <p className="text-xs">No data yet — send your first email</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {sortedCompanies.map(([company, stats]) => {
                      const openRate = stats.sent ? Math.round((stats.opens / stats.sent) * 100) : 0
                      return (
                        <div key={company} className="rounded-lg border border-border px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold truncate">{company}</span>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-[10px] text-muted-foreground">{stats.sent} sent</span>
                              <Badge variant="outline" className={`text-[9px] px-1.5 h-4 ${openRate >= 50 ? "border-green-500/40 text-green-500 bg-green-500/5" : openRate >= 25 ? "border-amber-500/40 text-amber-500 bg-amber-500/5" : "border-border text-muted-foreground"}`}>
                                {openRate}% open
                              </Badge>
                            </div>
                          </div>
                          {/* Open rate bar */}
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(openRate, 100)}%` }} />
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Inbox className="h-2.5 w-2.5 text-blue-400" /> {stats.opens} opens
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <MousePointerClick className="h-2.5 w-2.5 text-green-400" /> {stats.clicks} clicks
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Per-email breakdown */}
            <Card className="md:col-span-3">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Log with Engagement</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">Loading…</div>
                ) : analytics.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                    <Building2 className="h-7 w-7 mb-2 opacity-20" />
                    <p className="text-xs">No emails logged yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                    {analytics.map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">
                          {entry.company.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs">{entry.company}</span>
                            <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[140px]">{entry.email}</span>
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{timeAgo(entry.sentAt)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{entry.subject}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${entry.opens > 0 ? "bg-blue-500/10 text-blue-500 border-blue-500/30" : "bg-muted text-muted-foreground border-border"}`}>
                            <Inbox className="h-2.5 w-2.5" /> {entry.opens}
                          </div>
                          <div className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${entry.clicks > 0 ? "bg-green-500/10 text-green-500 border-green-500/30" : "bg-muted text-muted-foreground border-border"}`}>
                            <MousePointerClick className="h-2.5 w-2.5" /> {entry.clicks}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-[10px] text-muted-foreground/60 text-center">
            Opens tracked via pixel — some email clients block image loading. Clicks tracked via redirect link.
          </p>
        </div>
      )}
    </div>
  )
}
