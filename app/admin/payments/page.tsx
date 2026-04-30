"use client"

import useSWR from "swr"
import Link from "next/link"
import { Wallet, CreditCard, Settings, ExternalLink, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Gateway {
  id: string
  name: string
  provider: string
  enabled: boolean
  type: string
  countries?: string[]
  currencies?: string[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function AdminPaymentsPage() {
  const { data, isLoading } = useSWR<{ gateways: Gateway[] }>('/api/admin/payment-gateways', fetcher)
  const gateways = data?.gateways || []
  const enabled = gateways.filter(g => g.enabled)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Payments</h1>
          <p className="text-xs text-muted-foreground">Connected payment gateways and routing</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/payment-gateways" className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Configure gateways
          </Link>
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Gateways</div><div className="text-base font-bold tabular-nums">{gateways.length}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Enabled</div><div className="text-base font-bold tabular-nums text-emerald-600">{enabled.length}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Card</div><div className="text-base font-bold tabular-nums">{gateways.filter(g => g.type === 'card').length}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Mobile money</div><div className="text-base font-bold tabular-nums">{gateways.filter(g => g.type === 'mobile_money').length}</div></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] uppercase text-muted-foreground">
                    <th className="p-2">Gateway</th>
                    <th className="p-2">Provider</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Currencies</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {gateways.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                      <Wallet className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No payment gateways configured. <Link href="/admin/payment-gateways" className="text-primary hover:underline">Set one up</Link>.
                    </td></tr>
                  )}
                  {gateways.map(g => (
                    <tr key={g.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-semibold flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" />{g.name}</td>
                      <td className="p-2 text-muted-foreground">{g.provider}</td>
                      <td className="p-2 text-muted-foreground capitalize">{g.type.replace('_', ' ')}</td>
                      <td className="p-2">
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${g.enabled ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                          {g.enabled ? 'Live' : 'Off'}
                        </span>
                      </td>
                      <td className="p-2 text-[10px] text-muted-foreground truncate max-w-[180px]">{(g.currencies || []).join(', ') || '—'}</td>
                      <td className="p-2">
                        <Link href="/admin/payment-gateways" className="text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground">
            Detailed transaction history will appear here once your gateway webhooks are connected and processing payments.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
