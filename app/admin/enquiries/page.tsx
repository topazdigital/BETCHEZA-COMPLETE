"use client"

export const dynamic = 'force-dynamic';

import { useState, useRef } from "react"
import useSWR from "swr"
import { format, parseISO } from "date-fns"
import {
  Mail, MailOpen, RefreshCw, Send, Reply,
  AlertCircle, Loader2, ChevronLeft, Inbox,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { InboxEmail } from "@/lib/imap-client"

const fetcher = (url: string) => fetch(url).then(r => r.json())

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function EmailBody({ email }: { email: InboxEmail }) {
  const [showHtml, setShowHtml] = useState(false)
  const body = email.bodyText || (email.bodyHtml ? stripHtml(email.bodyHtml) : '(no body)')

  if (email.bodyHtml && showHtml) {
    return (
      <div>
        <div
          className="rounded-lg bg-white border p-4 text-sm overflow-auto max-h-[400px]"
          dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
        />
        <button onClick={() => setShowHtml(false)} className="text-xs text-muted-foreground hover:underline mt-1">
          Show plain text
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="rounded-lg bg-muted/40 p-4 text-sm whitespace-pre-wrap leading-relaxed font-mono max-h-[400px] overflow-auto">
        {body}
      </div>
      {email.bodyHtml && (
        <button onClick={() => setShowHtml(true)} className="text-xs text-muted-foreground hover:underline mt-1">
          Show formatted HTML
        </button>
      )}
    </div>
  )
}

function ReplyComposer({
  email,
  onSent,
}: {
  email: InboxEmail
  onSent: () => void
}) {
  const [subject, setSubject] = useState(`Re: ${email.subject.replace(/^Re:\s*/i, '')}`)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function send() {
    if (!body.trim()) { setError('Message body is required'); return }
    setSending(true); setError('')
    try {
      const r = await fetch('/api/admin/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email.fromEmail,
          subject,
          body,
          inReplyTo: email.messageId,
        }),
      })
      const data = await r.json()
      if (!r.ok || !data.ok) { setError(data.error || 'Failed to send'); return }
      setSent(true)
      onSent()
    } catch (e: any) {
      setError(e.message || 'Network error')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
        <Send className="h-4 w-4" /> Reply sent to {email.fromEmail}
      </div>
    )
  }

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-card">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Reply to {email.from} &lt;{email.fromEmail}&gt;
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Subject</Label>
        <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Message</Label>
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={`Hi ${email.from.split(' ')[0]},\n\nThank you for reaching out...`}
          rows={6}
          className="text-sm resize-none"
        />
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      )}
      <Button onClick={send} disabled={sending} size="sm" className="w-full">
        {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
        {sending ? 'Sending…' : 'Send Reply'}
      </Button>
    </div>
  )
}

export default function InboxPage() {
  const { data, isLoading, error, mutate } = useSWR<{ emails: InboxEmail[]; error?: string }>(
    '/api/admin/inbox',
    fetcher,
    { refreshInterval: 2 * 60 * 1000, revalidateOnFocus: false }
  )

  const [selected, setSelected] = useState<InboxEmail | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [replying, setReplying] = useState(false)

  const emails = data?.emails ?? []
  const unread = emails.filter(e => !e.seen).length
  const imapError = data?.error

  async function open(email: InboxEmail) {
    setSelected(email)
    setReplying(false)
    if (!email.seen) {
      // Optimistically mark read
      mutate(
        prev => prev
          ? { ...prev, emails: prev.emails.map(e => e.uid === email.uid ? { ...e, seen: true } : e) }
          : prev,
        false
      )
      await fetch('/api/admin/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: email.uid }),
      })
    }
  }

  async function forceRefresh() {
    setRefreshing(true)
    await fetch('/api/admin/inbox', { method: 'DELETE' }) // invalidate cache
    await mutate()
    setRefreshing(false)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Inbox</h1>
            {unread > 0 && (
              <Badge className="h-5 text-[10px] px-1.5">{unread} unread</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            partnerships@betcheza.co.ke — all emails, newest first
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={forceRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {/* IMAP error */}
      {imapError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Could not connect to mail server</p>
            <p className="text-xs mt-0.5 opacity-80">{imapError}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !data && (
        <div className="space-y-1.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !imapError && emails.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Inbox className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No emails yet</p>
          </CardContent>
        </Card>
      )}

      {/* Split view */}
      {emails.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Email list */}
          <div className="space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
            {emails.map(email => (
              <button
                key={email.uid}
                onClick={() => open(email)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                  selected?.uid === email.uid
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50",
                  !email.seen && "border-l-[3px] border-l-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs truncate", !email.seen ? "font-semibold" : "text-muted-foreground")}>
                      {email.from || email.fromEmail}
                    </p>
                    <p className={cn("text-[13px] truncate leading-tight mt-0.5", !email.seen && "font-semibold")}>
                      {email.subject}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!email.seen
                      ? <Mail className="h-3 w-3 text-primary" />
                      : <MailOpen className="h-3 w-3 text-muted-foreground/40" />
                    }
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(parseISO(email.date), 'dd MMM')}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
                  {(email.bodyText || stripHtml(email.bodyHtml)).slice(0, 80)}
                </p>
              </button>
            ))}
          </div>

          {/* Detail pane */}
          {selected ? (
            <div className="space-y-4 min-w-0">
              {/* Back on mobile */}
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-snug">{selected.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">{selected.from}</span>
                        {' '}&lt;{selected.fromEmail}&gt;
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(selected.date), "d MMMM yyyy 'at' HH:mm")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={replying ? "secondary" : "outline"}
                      onClick={() => setReplying(r => !r)}
                    >
                      <Reply className="h-3.5 w-3.5 mr-1.5" />
                      {replying ? 'Cancel' : 'Reply'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <EmailBody email={selected} />
                </CardContent>
              </Card>

              {replying && (
                <ReplyComposer
                  email={selected}
                  onSent={() => setReplying(false)}
                />
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center justify-center rounded-lg border border-dashed h-64 text-muted-foreground text-sm">
              Select an email to read it
            </div>
          )}
        </div>
      )}
    </div>
  )
}
