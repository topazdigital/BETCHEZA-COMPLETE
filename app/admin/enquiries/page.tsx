"use client"

export const dynamic = 'force-dynamic';

import { useState } from "react"
import useSWR from "swr"
import { format, parseISO } from "date-fns"
import {
  Mail, MailOpen, RefreshCw, Send, Reply,
  AlertCircle, Loader2, ChevronLeft, Inbox, X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { InboxEmail } from "@/lib/imap-client"

interface InboxData {
  emails: InboxEmail[]
  accounts: { name: string; email: string; active: boolean }[]
  errors: { account: string; message: string }[]
  error?: string
}

const ACCOUNT_COLORS: Record<string, string> = {
  partnerships: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  support:      'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  info:         'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}
function accountColor(name: string) {
  return ACCOUNT_COLORS[name] ?? 'bg-muted text-muted-foreground'
}

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
          className="rounded-md bg-white border p-3 text-sm overflow-auto"
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
      <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap leading-relaxed overflow-auto">
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

function ReplyComposer({ email, onSent, onCancel }: { email: InboxEmail; onSent: () => void; onCancel: () => void }) {
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
        body: JSON.stringify({ to: email.fromEmail, subject, body, inReplyTo: email.messageId }),
      })
      const data = await r.json()
      if (!r.ok || !data.ok) { setError(data.error || 'Failed to send'); return }
      setSent(true); onSent()
    } catch (e: any) { setError(e.message || 'Network error') }
    finally { setSending(false) }
  }

  if (sent) return (
    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
      <Send className="h-4 w-4 shrink-0" /> Reply sent to {email.fromEmail}
    </div>
  )

  return (
    <div className="border-t pt-3 mt-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Reply to {email.fromEmail}
        </p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Subject</Label>
        <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-7 text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Message</Label>
        <Textarea value={body} onChange={e => setBody(e.target.value)}
          placeholder={`Hi ${email.from.split(' ')[0]},\n\nThank you for reaching out...`}
          rows={5} className="text-sm resize-none" />
      </div>
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
      <Button onClick={send} disabled={sending} size="sm" className="w-full">
        {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
        {sending ? 'Sending…' : 'Send Reply'}
      </Button>
    </div>
  )
}

export default function InboxPage() {
  const { data, isLoading, mutate } = useSWR<InboxData>(
    '/api/admin/inbox', fetcher,
    { refreshInterval: 2 * 60 * 1000, revalidateOnFocus: false }
  )

  const [selected, setSelected] = useState<InboxEmail | null>(null)
  const [activeAccount, setActiveAccount] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [replying, setReplying] = useState(false)

  const allEmails = data?.emails ?? []
  const accounts = data?.accounts ?? []
  // Only show errors that aren't expected auth failures (already removed admin account)
  const errors = (data?.errors ?? []).filter(e => !e.message.toLowerCase().includes('command failed'))
  const serverError = data?.error

  const filtered = activeAccount === 'all'
    ? allEmails
    : allEmails.filter(e => e.account === activeAccount)

  const unreadAll = allEmails.filter(e => !e.seen).length
  const unreadFor = (acc: string) => allEmails.filter(e => e.account === acc && !e.seen).length

  async function open(email: InboxEmail) {
    setSelected(email); setReplying(false)
    if (!email.seen) {
      mutate(prev => prev
        ? { ...prev, emails: prev.emails.map(e => e.uid === email.uid && e.account === email.account ? { ...e, seen: true } : e) }
        : prev, false)
      await fetch('/api/admin/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: email.uid, account: email.account }),
      })
    }
  }

  async function forceRefresh() {
    setRefreshing(true)
    await fetch('/api/admin/inbox', { method: 'DELETE' })
    await mutate()
    setRefreshing(false)
  }

  const configuredAccounts = accounts.length > 0 ? accounts : []
  const emailListHeight = "h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)]"

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden -m-4 sm:-m-6">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Inbox className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">Inbox</span>
          {unreadAll > 0 && (
            <Badge className="h-4.5 text-[10px] px-1.5 shrink-0">{unreadAll}</Badge>
          )}
          {configuredAccounts.length > 0 && (
            <span className="hidden sm:block text-xs text-muted-foreground truncate">
              {configuredAccounts.map(a => a.email).join(' · ')}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={forceRefresh} disabled={refreshing} className="h-7 px-2 shrink-0">
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline ml-1.5 text-xs">Refresh</span>
        </Button>
      </div>

      {/* ── Account filter tabs ──────────────────────────────────────────────── */}
      {configuredAccounts.length > 1 && (
        <div className="flex gap-1 px-3 sm:px-4 py-1.5 border-b bg-background shrink-0 overflow-x-auto scrollbar-none">
          {(['all', ...configuredAccounts.map(a => a.name)] as string[]).map(name => {
            const isAll = name === 'all'
            const count = isAll ? unreadAll : unreadFor(name)
            const active = activeAccount === name
            return (
              <button
                key={name}
                onClick={() => setActiveAccount(name)}
                className={cn(
                  "shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                {isAll ? 'All' : name}
                {count > 0 && <span className="ml-1 opacity-75">({count})</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Error banners ────────────────────────────────────────────────────── */}
      {serverError && (
        <div className="mx-3 sm:mx-4 mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 flex items-start gap-2 text-xs text-destructive shrink-0">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span><strong>Mail server error:</strong> {serverError}</span>
        </div>
      )}
      {errors.map((e, i) => (
        <div key={i} className="mx-3 sm:mx-4 mt-1 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2 text-[11px] text-amber-800 dark:text-amber-400 flex items-center gap-1.5 shrink-0">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {e.account}: {e.message}
        </div>
      ))}

      {/* ── Loading skeletons ────────────────────────────────────────────────── */}
      {isLoading && !data && (
        <div className="p-3 space-y-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 rounded-md bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!isLoading && configuredAccounts.length === 0 && !serverError && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
          <Mail className="h-10 w-10 mb-3 opacity-25" />
          <p className="font-medium text-sm">No email accounts configured</p>
          <p className="text-xs mt-1">Set <code className="bg-muted px-1 rounded">IMAP_PASSWORD</code> as a Replit Secret.</p>
        </div>
      )}

      {!isLoading && configuredAccounts.length > 0 && filtered.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
          <Inbox className="h-8 w-8 mb-2 opacity-25" />
          <p className="text-sm">No emails</p>
        </div>
      )}

      {/* ── Split pane ───────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Email list */}
          <div className={cn(
            "flex flex-col w-full lg:w-[300px] xl:w-[340px] shrink-0 border-r overflow-y-auto",
            selected && "hidden lg:flex"
          )}>
            {filtered.map(email => (
              <button
                key={`${email.account}-${email.uid}`}
                onClick={() => open(email)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b transition-colors",
                  selected?.uid === email.uid && selected?.account === email.account
                    ? "bg-primary/5 border-l-2 border-l-primary"
                    : "hover:bg-muted/50",
                  !email.seen && "border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide",
                        accountColor(email.account)
                      )}>
                        {email.account}
                      </span>
                    </div>
                    <p className={cn(
                      "text-[11px] truncate leading-tight",
                      !email.seen ? "font-semibold" : "text-muted-foreground"
                    )}>
                      {email.from || email.fromEmail}
                    </p>
                    <p className={cn(
                      "text-xs truncate leading-tight mt-0.5",
                      !email.seen ? "font-semibold" : "text-foreground"
                    )}>
                      {email.subject}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {(email.bodyText || stripHtml(email.bodyHtml || '')).slice(0, 70)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                    {!email.seen
                      ? <Mail className="h-3 w-3 text-primary" />
                      : <MailOpen className="h-3 w-3 text-muted-foreground/30" />}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(parseISO(email.date), 'dd MMM')}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail pane */}
          {selected ? (
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Detail header */}
              <div className="flex items-start justify-between gap-2 px-3 sm:px-4 py-2.5 border-b bg-background shrink-0">
                <div className="flex items-start gap-2 min-w-0">
                  <button
                    onClick={() => { setSelected(null); setReplying(false) }}
                    className="lg:hidden mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide",
                        accountColor(selected.account)
                      )}>
                        {selected.account}
                      </span>
                      <span className="text-[10px] text-muted-foreground">→ {selected.accountEmail}</span>
                    </div>
                    <p className="text-sm font-semibold leading-snug line-clamp-2">{selected.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground">{selected.from}</span>
                      {' '}<span className="opacity-70">&lt;{selected.fromEmail}&gt;</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(parseISO(selected.date), "d MMM yyyy 'at' HH:mm")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={replying ? "secondary" : "outline"}
                  onClick={() => setReplying(r => !r)}
                  className="h-7 px-2.5 text-xs shrink-0"
                >
                  <Reply className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{replying ? 'Cancel' : 'Reply'}</span>
                </Button>
              </div>

              {/* Email body — scrollable */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                <EmailBody email={selected} />
                {replying && (
                  <ReplyComposer
                    email={selected}
                    onSent={() => setReplying(false)}
                    onCancel={() => setReplying(false)}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground text-sm border-dashed">
              <div className="text-center">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>Select an email to read it</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
