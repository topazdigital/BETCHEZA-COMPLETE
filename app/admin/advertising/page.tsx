"use client"

export const dynamic = 'force-dynamic';

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Mail, Eye, Download, Megaphone } from "lucide-react"

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

export default function AdvertisingAdminPage() {
  // Auth is already handled server-side by the admin layout — no client redirect needed

  const [activeTier, setActiveTier] = useState<TierId>("package")
  const [bookmakerName, setBookmakerName] = useState("SportPesa")
  const [contactName, setContactName] = useState("Marketing Team")
  const [customNote, setCustomNote] = useState("")
  const [previewHtml, setPreviewHtml] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")

  async function generatePreview() {
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
    if (!previewHtml) await generatePreview()
    try {
      await navigator.clipboard.writeText(previewHtml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  async function sendEmail() {
    if (!recipientEmail) return
    setSending(true)
    try {
      const res = await fetch("/api/admin/advertising/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: activeTier, bookmakerName, contactName, customNote, email: recipientEmail }),
      })
      const d = await res.json()
      if (d.success) setSentTo(recipientEmail)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
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
        {/* Left: Configuration */}
        <div className="lg:col-span-1 space-y-3">
          {/* Tier selection */}
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

          {/* Customise */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Customise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Bookmaker Name</Label>
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
                  className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <Button onClick={generatePreview} disabled={loadingPreview} className="w-full" size="sm">
                <Eye className="h-3.5 w-3.5 mr-2" />
                {loadingPreview ? "Generating…" : "Preview Email"}
              </Button>
            </CardContent>
          </Card>

          {/* Quick select bookmakers */}
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

        {/* Right: Preview + Actions */}
        <div className="lg:col-span-2 space-y-3">
          {/* Actions */}
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

          {/* Email preview */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-3.5 w-3.5" />
                Email Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {previewHtml ? (
                <div className="border-t">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-[600px] border-0"
                    title="Email preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Megaphone className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No preview yet</p>
                  <p className="text-xs mt-1">Click "Preview Email" to generate</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sample subjects */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sample Subject Lines</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">→</span>
                  Partnership Opportunity — Advertise on Betcheza · {bookmakerName || "Bookmaker"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">→</span>
                  Reach 50,000+ Kenyan Bettors Monthly — Betcheza.co.ke
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">→</span>
                  Display Your Odds on Kenya's #1 Tipster Platform
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">→</span>
                  Exclusive Advertising Slots Now Available — Betcheza 2026
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
