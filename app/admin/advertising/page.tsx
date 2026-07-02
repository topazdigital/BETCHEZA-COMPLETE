"use client"

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Mail, Eye, Megaphone, Code2, Wand2, Info, Clock, Trash2, RefreshCw, Building2, ChevronDown } from "lucide-react"

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

export default function AdvertisingAdminPage() {
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

  useEffect(() => { loadHistory() }, [loadHistory])

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

  return (
    <div className="space-y-3 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            Bookmaker Advertising
          </h1>
          <p className="text-[11px] text-muted-foreground">Generate and send partnership emails to bookmakers</p>
        </div>
        {/* Mode toggle — top-right on all screens */}
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          <button onClick={() => setMode("template")} className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${mode === "template" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
            <Wand2 className="h-3 w-3" /> Template
          </button>
          <button onClick={() => setMode("custom")} className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${mode === "custom" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
            <Code2 className="h-3 w-3" /> Custom HTML
          </button>
        </div>
      </div>

      {/* Main composer grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">

        {/* ── Left column (settings) ── */}
        <div className="md:col-span-2 space-y-3">

          {/* Tier picker (template) OR Subject + tokens (custom) */}
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

          {/* Recipient details */}
          <Card>
            <CardHeader className="py-2 px-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recipient Details</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3 pt-0 space-y-2">
              {/* Quick-select bookmakers */}
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

          {/* Subject suggestions (template) */}
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

        {/* ── Right column (send + editor + preview) ── */}
        <div className="md:col-span-3 space-y-3">

          {/* Send bar */}
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

          {/* HTML editor (custom mode) */}
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

          {/* Preview iframe */}
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

      {/* ── Sent History (collapsible) ── */}
      <Card>
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Sent History</span>
            {history.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{history.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); loadHistory() }}
              disabled={historyLoading}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/50"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${historyLoading ? "animate-spin" : ""}`} />
              Refresh
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
                        <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">·</span>
                        <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{timeAgo(entry.sentAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 truncate hidden md:inline max-w-[260px]">{entry.subject}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      disabled={deletingId === entry.id}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
