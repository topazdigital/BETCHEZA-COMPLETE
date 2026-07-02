"use client"

export const dynamic = 'force-dynamic';

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Mail, Eye, Megaphone, Code2, Wand2, Info } from "lucide-react"

const TIERS = [
  {
    id: "banner",
    label: "Banner Ads",
    price: "KES 25,000/mo",
    description: "728×90 leaderboard + 300×250 sidebar on all match & league pages",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  {
    id: "odds",
    label: "Odds Integration",
    price: "KES 40,000/mo",
    description: "Live odds shown on every match page with Bet Now deeplinks",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
  },
  {
    id: "homepage",
    label: "Homepage Feature",
    price: "KES 35,000/mo",
    description: "Above-the-fold featured bookmaker slot with promo banner",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  {
    id: "package",
    label: "Full Package",
    price: "KES 80,000/mo",
    description: "Everything — banners, odds, homepage + email campaigns",
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
] as const

type TierId = typeof TIERS[number]["id"]

const TARGET_BOOKMAKERS = [
  { name: "SportPesa", contact: "Marketing Team" },
  { name: "Betika", contact: "Partnerships Team" },
  { name: "Odibets", contact: "Advertising Team" },
  { name: "Betin Kenya", contact: "Marketing Team" },
  { name: "22Bet Kenya", contact: "Affiliate Team" },
  { name: "Mozzart Bet", contact: "Marketing Team" },
  { name: "Dafabet Kenya", contact: "Partnerships Team" },
  { name: "MelBet Kenya", contact: "Affiliate Team" },
]

const TOKENS = [
  { token: "{{company_name}}", label: "Company name" },
  { token: "{{contact_name}}", label: "Contact name" },
  { token: "{{custom_note}}", label: "Custom note" },
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

function applyTokens(html: string, bookmakerName: string, contactName: string, customNote: string): string {
  return html
    .replaceAll("{{company_name}}", bookmakerName || "")
    .replaceAll("{{contact_name}}", contactName || "")
    .replaceAll("{{custom_note}}", customNote || "")
}

export default function AdvertisingAdminPage() {
  const [mode, setMode] = useState<"template" | "custom">("template")

  // Template mode state
  const [activeTier, setActiveTier] = useState<TierId>("package")
  const [bookmakerName, setBookmakerName] = useState("SportPesa")
  const [contactName, setContactName] = useState("Marketing Team")
  const [customNote, setCustomNote] = useState("")
  const [previewHtml, setPreviewHtml] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Custom HTML state
  const [customHtml, setCustomHtml] = useState(PLACEHOLDER_HTML)
  const [customSubject, setCustomSubject] = useState("Partnership Proposal for {{company_name}} — Betcheza.co.ke")

  // Shared
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")

  // Derive what's currently shown in the preview iframe
  const activePreviewHtml = mode === "custom"
    ? applyTokens(customHtml, bookmakerName, contactName, customNote)
    : previewHtml

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
    const html = activePreviewHtml || (mode === "template" ? "" : applyTokens(customHtml, bookmakerName, contactName, customNote))
    if (!html && mode === "template") {
      await generateTemplatePreview()
      return
    }
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
            email: recipientEmail,
            bookmakerName,
            contactName,
            customNote,
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
      if (d.success) setSentTo(recipientEmail)
    } finally {
      setSending(false)
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            Bookmaker Advertising
          </h1>
          <p className="text-xs text-muted-foreground">
            Generate and send partnership emails to bookmakers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-3">

          {/* Mode toggle */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setMode("template")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                    mode === "template" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Wand2 className="h-3 w-3" />
                  Template
                </button>
                <button
                  onClick={() => setMode("custom")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                    mode === "custom" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Code2 className="h-3 w-3" />
                  Custom HTML
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Template mode: tier selection */}
          {mode === "template" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Package Tier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {TIERS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTier(t.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      activeTier === t.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{t.label}</span>
                      <Badge variant="outline" className={`text-[10px] ${t.color}`}>
                        {t.price}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Custom HTML mode: subject + token help */}
          {mode === "custom" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Email Subject</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  placeholder="Partnership Proposal for {{company_name}}"
                  className="h-8 text-sm"
                />
                <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 text-primary" />
                    Available tokens
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    These are replaced automatically when you send or preview. Click to insert at cursor.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {TOKENS.map(({ token, label }) => (
                      <button
                        key={token}
                        onClick={() => insertToken(token)}
                        className="rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-mono text-primary hover:bg-primary/15 transition-colors"
                        title={`Insert ${label}`}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customise — shown in both modes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recipient Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Bookmaker / Company Name</Label>
                <Input
                  value={bookmakerName}
                  onChange={e => setBookmakerName(e.target.value)}
                  placeholder="e.g. SportPesa"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Contact Name (optional)</Label>
                <Input
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Custom Note (optional)</Label>
                <textarea
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="e.g. We're offering a 3-month bundle at a 20% discount…"
                  className="mt-1 w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              {mode === "template" && (
                <Button onClick={generateTemplatePreview} disabled={loadingPreview} className="w-full" size="sm">
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  {loadingPreview ? "Generating…" : "Preview Email"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Quick-select bookmakers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Target Bookmakers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_BOOKMAKERS.map(b => (
                  <button
                    key={b.name}
                    onClick={() => { setBookmakerName(b.name); setContactName(b.contact) }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      bookmakerName === b.name
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-3">

          {/* Send bar */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-40">
                  <Label className="text-xs">Send to Email Address</Label>
                  <Input
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder="marketing@bookmaker.com"
                    type="email"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <Button
                  onClick={sendEmail}
                  disabled={!recipientEmail || sending}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Mail className="h-3.5 w-3.5 mr-2" />
                  {sending ? "Sending…" : "Send Email"}
                </Button>
                <Button onClick={copyHtml} variant="outline" size="sm">
                  {copied ? <Check className="h-3.5 w-3.5 mr-2 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                  {copied ? "Copied!" : "Copy HTML"}
                </Button>
              </div>
              {sentTo && (
                <p className="text-xs text-green-500 mt-2">✅ Email sent to {sentTo}</p>
              )}
            </CardContent>
          </Card>

          {/* Custom HTML editor (only in custom mode) */}
          {mode === "custom" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5" />
                  HTML Editor
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">— preview updates live as you type</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <textarea
                  id="custom-html-area"
                  value={customHtml}
                  onChange={e => setCustomHtml(e.target.value)}
                  spellCheck={false}
                  className="w-full h-56 px-3 py-3 font-mono text-[11px] leading-relaxed bg-muted/30 border-0 border-t border-border resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-b-lg"
                  placeholder="Paste your full HTML email here…"
                />
              </CardContent>
            </Card>
          )}

          {/* Preview iframe */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-3.5 w-3.5" />
                Email Preview
                {mode === "custom" && (
                  <span className="text-[10px] font-normal text-muted-foreground">— tokens replaced with current recipient details</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activePreviewHtml ? (
                <div className="border-t">
                  <iframe
                    srcDoc={activePreviewHtml}
                    className="w-full h-[600px] border-0"
                    title="Email preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Megaphone className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No preview yet</p>
                  <p className="text-xs mt-1">
                    {mode === "template" ? 'Click "Preview Email" to generate' : "Start typing HTML above — preview appears here"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subject line suggestions (template mode only) */}
          {mode === "template" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sample Subject Lines</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {[
                    `Partnership Proposal for ${bookmakerName || "Bookmaker"} — Betcheza.co.ke`,
                    "Reach 50,000+ Kenyan Bettors Monthly — Betcheza.co.ke",
                    "Display Your Odds on Kenya's #1 Tipster Platform",
                    "Exclusive Advertising Slots Now Available — Betcheza 2026",
                  ].map(s => (
                    <li key={s} className="flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
