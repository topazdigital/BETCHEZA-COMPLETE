"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CreditCard, Smartphone, Building2, Bitcoin, Globe, Wallet,
  ChevronDown, ChevronUp, Save, ToggleLeft, ToggleRight,
  Percent, DollarSign, AlertCircle, CheckCircle2, RefreshCw, Settings
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type GatewayType = 'card' | 'mobile_money' | 'bank' | 'crypto' | 'ewallet' | 'regional'

interface PaymentGateway {
  id: string
  name: string
  provider: string
  enabled: boolean
  countries: string[]
  currencies: string[]
  type: GatewayType
  credentials: Record<string, string>
  fees?: { percent: number; fixed: number; currency: string }
  minAmount?: number
  maxAmount?: number
  supportsPayouts: boolean
}

interface PayoutSettings {
  minimumPayoutAmount: number
  payoutSchedule: 'instant' | 'daily' | 'weekly' | 'monthly'
  payoutCurrency: string
  platformFeePercent: number
  tipsterSharePercent: number
  autoPayouts: boolean
  payoutMethods: string[]
}

const TYPE_META: Record<GatewayType, { label: string; icon: React.ElementType; color: string }> = {
  card: { label: 'Credit / Debit Card', icon: CreditCard, color: 'text-blue-500' },
  mobile_money: { label: 'Mobile Money', icon: Smartphone, color: 'text-emerald-500' },
  bank: { label: 'Bank Transfer', icon: Building2, color: 'text-violet-500' },
  crypto: { label: 'Cryptocurrency', icon: Bitcoin, color: 'text-amber-500' },
  ewallet: { label: 'E-Wallet', icon: Wallet, color: 'text-rose-500' },
  regional: { label: 'Regional Gateway', icon: Globe, color: 'text-cyan-500' },
}

const CREDENTIAL_LABELS: Record<string, string> = {
  publishable_key: 'Publishable Key',
  secret_key: 'Secret Key',
  webhook_secret: 'Webhook Secret',
  client_id: 'Client ID',
  client_secret: 'Client Secret',
  mode: 'Mode (sandbox / live)',
  consumer_key: 'Consumer Key',
  consumer_secret: 'Consumer Secret',
  passkey: 'Passkey',
  shortcode: 'Business Shortcode',
  initiator_name: 'Initiator Name',
  security_credential: 'Security Credential',
  subscription_key: 'Subscription Key',
  api_user: 'API User',
  api_key: 'API Key',
  collection_primary_key: 'Collection Primary Key',
  disbursement_primary_key: 'Disbursement Primary Key',
  merchant_key: 'Merchant Key',
  merchant_id: 'Merchant ID',
  public_key: 'Public Key',
  encryption_key: 'Encryption Key',
  ipn_secret: 'IPN Secret',
  bank_name: 'Bank Name',
  account_number: 'Account Number',
  routing_number: 'Routing Number (USA)',
  iban: 'IBAN',
  swift: 'SWIFT / BIC',
  gateway_merchant_id: 'Gateway Merchant ID',
  gateway: 'Underlying Gateway (stripe / adyen / braintree)',
}

function GatewayCard({
  gateway,
  onToggle,
  onSave,
}: {
  gateway: PaymentGateway
  onToggle: (id: string, enabled: boolean) => void
  onSave: (gateway: PaymentGateway) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState<PaymentGateway>(gateway)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const meta = TYPE_META[gateway.type]
  const Icon = meta.icon

  const handleCredentialChange = (key: string, value: string) => {
    setDraft((d) => ({ ...d, credentials: { ...d.credentials, [key]: value } }))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      gateway.enabled ? "border-primary/40 bg-primary/2" : "border-border"
    )}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted", meta.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{gateway.name}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", meta.color)}>
                {meta.label}
              </Badge>
              {gateway.supportsPayouts && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Payouts</Badge>
              )}
              {gateway.fees && (
                <span className="text-[10px] text-muted-foreground">
                  {gateway.fees.percent}% + {gateway.fees.fixed} {gateway.fees.currency}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Switch
            checked={gateway.enabled}
            onCheckedChange={(v) => onToggle(gateway.id, v)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-4 space-y-4">
          {/* Countries */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Supported Countries</Label>
            <div className="flex flex-wrap gap-1">
              {gateway.countries.map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
              ))}
            </div>
          </div>

          {/* Currencies */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Supported Currencies</Label>
            <div className="flex flex-wrap gap-1">
              {gateway.currencies.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Credentials */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              API Credentials
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(draft.credentials).map(([key, value]) => (
                <div key={key}>
                  <Label htmlFor={`${gateway.id}-${key}`} className="text-xs mb-1 block text-muted-foreground">
                    {CREDENTIAL_LABELS[key] || key.replace(/_/g, ' ')}
                  </Label>
                  <Input
                    id={`${gateway.id}-${key}`}
                    type={key.includes('secret') || key.includes('key') || key.includes('credential') ? 'password' : 'text'}
                    value={value}
                    onChange={(e) => handleCredentialChange(key, e.target.value)}
                    placeholder={`Enter ${CREDENTIAL_LABELS[key] || key}`}
                    className="font-mono text-sm h-9"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Credentials are stored securely and never exposed to clients.
            </p>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saved ? 'Saved!' : 'Save Credentials'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function PaymentGatewaysPage() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([])
  const [payoutSettings, setPayoutSettings] = useState<PayoutSettings>({
    minimumPayoutAmount: 10,
    payoutSchedule: 'weekly',
    payoutCurrency: 'USD',
    platformFeePercent: 20,
    tipsterSharePercent: 80,
    autoPayouts: false,
    payoutMethods: [],
  })
  const [loading, setLoading] = useState(true)
  const [savingPayout, setSavingPayout] = useState(false)
  const [payoutSaved, setPayoutSaved] = useState(false)

  const fetchGateways = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-gateways')
      if (res.ok) {
        const data = await res.json()
        setGateways(data.gateways || [])
        setPayoutSettings(data.payoutSettings || payoutSettings)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGateways() }, [fetchGateways])

  const handleToggle = async (id: string, enabled: boolean) => {
    setGateways((prev) => prev.map((g) => g.id === id ? { ...g, enabled } : g))
    await fetch('/api/admin/payment-gateways', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
  }

  const handleSave = async (gateway: PaymentGateway) => {
    await fetch('/api/admin/payment-gateways', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gateways: [gateway] }),
    })
    setGateways((prev) => prev.map((g) => g.id === gateway.id ? gateway : g))
  }

  const handleSavePayoutSettings = async () => {
    setSavingPayout(true)
    await fetch('/api/admin/payment-gateways', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payoutSettings }),
    })
    setSavingPayout(false)
    setPayoutSaved(true)
    setTimeout(() => setPayoutSaved(false), 2000)
  }

  const byType = (type: GatewayType) => gateways.filter((g) => g.type === type)
  const enabledCount = gateways.filter((g) => g.enabled).length

  const groupedTypes: { types: GatewayType[]; label: string }[] = [
    { types: ['card', 'ewallet'], label: 'Cards & E-Wallets' },
    { types: ['mobile_money', 'regional'], label: 'Africa & Mobile Money' },
    { types: ['bank', 'crypto'], label: 'Bank & Crypto' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold">Payment Gateways</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure payment methods by region. Enable gateways and enter API credentials to accept payments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={enabledCount > 0 ? "default" : "secondary"} className="text-xs px-2 py-0.5">
            {enabledCount} Active
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const Icon = meta.icon
          const count = byType(type as GatewayType).length
          const enabled = byType(type as GatewayType).filter((g) => g.enabled).length
          return (
            <Card key={type}>
              <CardContent className="p-2.5 flex items-center gap-2.5">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted", meta.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground leading-none">{meta.label}</p>
                  <p className="font-bold text-base mt-0.5">{enabled}/{count} active</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="gateways" className="space-y-3">
        <TabsList className="h-8 p-1">
          <TabsTrigger value="gateways" className="h-6 text-xs px-3">Payment Methods</TabsTrigger>
          <TabsTrigger value="payouts" className="h-6 text-xs px-3">Tipster Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="gateways" className="space-y-4 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading gateways...
            </div>
          ) : (
            groupedTypes.map(({ types, label }) => {
              const items = types.flatMap((t) => byType(t))
              if (items.length === 0) return null
              return (
                <div key={label} className="space-y-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">{label}</h2>
                  <div className="space-y-2">
                    {items.map((gw) => (
                      <GatewayCard
                        key={gw.id}
                        gateway={gw}
                        onToggle={handleToggle}
                        onSave={handleSave}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="payouts" className="mt-2">
          <Card>
            <CardHeader className="py-2 pb-1.5 px-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings className="h-3.5 w-3.5" />
                Tipster Payout Settings
              </CardTitle>
              <CardDescription className="text-xs">
                Configure how and when tipsters receive their earnings from subscriptions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-3 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Minimum Payout Amount (USD)</Label>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    min={1}
                    value={payoutSettings.minimumPayoutAmount}
                    onChange={(e) => setPayoutSettings((s) => ({
                      ...s, minimumPayoutAmount: parseFloat(e.target.value) || 0
                    }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tipsters must earn at least this amount before a payout is issued.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Default Payout Currency</Label>
                  <Select
                    value={payoutSettings.payoutCurrency}
                    onValueChange={(v) => setPayoutSettings((s) => ({ ...s, payoutCurrency: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs px-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['USD', 'EUR', 'GBP', 'KES', 'NGN', 'GHS', 'ZAR', 'USDT'].map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Payout Schedule</Label>
                  <Select
                    value={payoutSettings.payoutSchedule}
                    onValueChange={(v) => setPayoutSettings((s) => ({
                      ...s, payoutSchedule: v as PayoutSettings['payoutSchedule']
                    }))}
                  >
                    <SelectTrigger className="h-8 text-xs px-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant" className="text-xs">Instant (on request)</SelectItem>
                      <SelectItem value="daily" className="text-xs">Daily (auto)</SelectItem>
                      <SelectItem value="weekly" className="text-xs">Weekly (every Monday)</SelectItem>
                      <SelectItem value="monthly" className="text-xs">Monthly (1st of month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Platform Fee</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        className="h-8 text-xs pl-8"
                        value={payoutSettings.platformFeePercent}
                        onChange={(e) => {
                          const pct = Math.min(99, Math.max(0, parseFloat(e.target.value) || 0))
                          setPayoutSettings((s) => ({
                            ...s,
                            platformFeePercent: pct,
                            tipsterSharePercent: 100 - pct,
                          }))
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                    <div className="relative w-24">
                      <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
                      <Input
                        readOnly
                        className="h-8 text-xs pl-8 bg-muted font-bold text-emerald-600"
                        value={payoutSettings.tipsterSharePercent}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-xs">Automatic Payouts</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    When enabled, payouts are automatically processed on schedule without manual approval.
                  </p>
                </div>
                <Switch
                  checked={payoutSettings.autoPayouts}
                  onCheckedChange={(v) => setPayoutSettings((s) => ({ ...s, autoPayouts: v }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Allowed Payout Methods</Label>
                <p className="text-[10px] text-muted-foreground">
                  Which of your active payment gateways tipsters can use to receive payouts.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {gateways.filter((g) => g.supportsPayouts).map((gw) => {
                    const selected = payoutSettings.payoutMethods.includes(gw.id)
                    return (
                      <button
                        key={gw.id}
                        onClick={() =>
                          setPayoutSettings((s) => ({
                            ...s,
                            payoutMethods: selected
                              ? s.payoutMethods.filter((m) => m !== gw.id)
                              : [...s.payoutMethods, gw.id],
                          }))
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-xs text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {selected ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-border shrink-0" />
                        )}
                        <span className="truncate font-medium">{gw.name}</span>
                        {!gw.enabled && (
                          <Badge variant="outline" className="text-[8px] px-1 h-3.5 ml-auto shrink-0">Inactive</Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button onClick={handleSavePayoutSettings} disabled={savingPayout} size="sm" className="h-8 text-xs gap-1.5">
                  {savingPayout ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : payoutSaved ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {payoutSaved ? 'Saved!' : 'Save Payout Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
