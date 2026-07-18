"use client"

export const dynamic = 'force-dynamic';

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { format, parseISO } from "date-fns"
import { Mail, MailOpen, Trash2, Building2, Phone, Globe, DollarSign, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Enquiry } from "@/lib/enquiry-store"

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function EnquiriesPage() {
  const { data, isLoading, mutate: refresh } = useSWR<{ enquiries: Enquiry[] }>(
    '/api/admin/enquiries', fetcher, { refreshInterval: 60_000 }
  )
  const [selected, setSelected] = useState<Enquiry | null>(null)

  const enquiries = data?.enquiries ?? []
  const unread = enquiries.filter(e => !e.read).length

  async function open(e: Enquiry) {
    setSelected(e)
    if (!e.read) {
      await fetch('/api/admin/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e.id }),
      })
      refresh()
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this enquiry?')) return
    await fetch('/api/admin/enquiries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (selected?.id === id) setSelected(null)
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Partnership Enquiries</h1>
          <p className="text-sm text-muted-foreground">
            Messages from /advertise — {unread > 0 ? <strong>{unread} unread</strong> : 'all read'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && enquiries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No enquiries yet</p>
            <p className="text-sm mt-1">Messages from the Advertise page will appear here.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* List */}
        {enquiries.length > 0 && (
          <div className="space-y-1.5">
            {enquiries.map(e => (
              <button
                key={e.id}
                onClick={() => open(e)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                  selected?.id === e.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50",
                  !e.read && "border-l-4 border-l-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn("text-sm truncate", !e.read && "font-semibold")}>{e.company}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.name} · {e.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!e.read
                      ? <Mail className="h-3.5 w-3.5 text-primary" />
                      : <MailOpen className="h-3.5 w-3.5 text-muted-foreground/50" />
                    }
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(parseISO(e.createdAt), 'dd MMM, HH:mm')}
                    </span>
                  </div>
                </div>
                {e.model && (
                  <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">{e.model}</Badge>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Detail */}
        {selected ? (
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{selected.company}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {format(parseISO(selected.createdAt), "d MMMM yyyy 'at' HH:mm")}
                  </p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => remove(selected.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Contact</p>
                  <p className="font-medium">{selected.name}</p>
                  <a href={`mailto:${selected.email}`} className="text-primary hover:underline text-xs">
                    {selected.email}
                  </a>
                </div>
                {selected.phone && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Phone / WhatsApp</p>
                    <p className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{selected.phone}</p>
                  </div>
                )}
                {selected.website && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Website</p>
                    <a href={selected.website} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs flex items-center gap-1">
                      <Globe className="h-3 w-3" />{selected.website}
                    </a>
                  </div>
                )}
                {selected.budget && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Monthly Budget</p>
                    <p className="flex items-center gap-1 text-xs"><DollarSign className="h-3 w-3" />{selected.budget}</p>
                  </div>
                )}
                {selected.model && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Preferred Model</p>
                    <Badge variant="outline" className="text-xs">{selected.model}</Badge>
                  </div>
                )}
              </div>

              {/* Message */}
              {selected.message && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">Message</p>
                  <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-line leading-relaxed">
                    {selected.message}
                  </div>
                </div>
              )}

              {/* Reply button */}
              <a href={`mailto:${selected.email}?subject=Re: Partnership with Betcheza`}>
                <Button className="w-full" size="sm">
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Reply to {selected.name}
                </Button>
              </a>
            </CardContent>
          </Card>
        ) : enquiries.length > 0 ? (
          <div className="hidden lg:flex items-center justify-center rounded-lg border border-dashed border-border h-64 text-muted-foreground text-sm">
            Select an enquiry to read it
          </div>
        ) : null}
      </div>
    </div>
  )
}
