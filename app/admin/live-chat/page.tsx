"use client"

/**
 * Admin live chat inbox — /admin/live-chat
 *
 * Left panel: list of sessions sorted by most recent message.
 * Right panel: message thread + reply box for the selected session.
 * Polls both panels every 5 s for new activity.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { MessageCircle, Send, X, Loader2, RefreshCw, Clock, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  id: number
  user_id: number | null
  visitor_name: string | null
  visitor_email: string | null
  status: "open" | "closed"
  last_message_at: string | null
  created_at: string
}

interface ChatMsg {
  id: number
  session_id: number
  sender: "user" | "admin"
  body: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null) {
  if (!iso) return ""
  try {
    const d = new Date(iso + (iso.includes("Z") || iso.includes("+") ? "" : "Z"))
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60_000) return "just now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
  } catch { return "" }
}

function sessionLabel(s: Session) {
  return s.visitor_name || s.visitor_email || `Visitor #${s.id}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LiveChatPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const lastMsgIdRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages])

  // ── Fetch sessions ──────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/support-chat")
      if (!r.ok) return
      const data = await r.json()
      setSessions(data.sessions ?? [])
    } catch { /* ignore */ } finally {
      setLoadingSessions(false)
    }
  }, [])

  // ── Fetch messages for selected session ─────────────────────────────────────
  const fetchMessages = useCallback(async (sessionId: number, sinceId: number) => {
    try {
      const r = await fetch(`/api/admin/support-chat?session_id=${sessionId}&sinceId=${sinceId}`)
      if (!r.ok) return
      const data = await r.json()
      const incoming: ChatMsg[] = data.messages ?? []
      if (incoming.length) {
        lastMsgIdRef.current = Math.max(lastMsgIdRef.current, ...incoming.map(m => m.id))
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          return [...prev, ...incoming.filter(m => !existingIds.has(m.id))]
        })
      }
    } catch { /* ignore */ }
  }, [])

  // ── Polling ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSessions()
    const id = setInterval(fetchSessions, 10_000)
    return () => clearInterval(id)
  }, [fetchSessions])

  useEffect(() => {
    if (!selectedId) return
    lastMsgIdRef.current = 0
    setMessages([])
    fetchMessages(selectedId, 0)
    const id = setInterval(() => fetchMessages(selectedId, lastMsgIdRef.current), 5_000)
    return () => clearInterval(id)
  }, [selectedId, fetchMessages])

  // ── Send reply ───────────────────────────────────────────────────────────────
  async function sendReply() {
    if (!selectedId || !reply.trim() || sending) return
    const text = reply.trim()
    setReply("")
    setSending(true)

    // Optimistic
    const tempId = -Date.now()
    setMessages(prev => [...prev, { id: tempId, session_id: selectedId, sender: "admin", body: text, created_at: new Date().toISOString() }])

    try {
      const r = await fetch("/api/admin/support-chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: selectedId, body: text }),
      })
      if (!r.ok) throw new Error("failed")
      const data = await r.json()
      const real: ChatMsg = data.message
      setMessages(prev => prev.map(m => m.id === tempId ? real : m))
      lastMsgIdRef.current = Math.max(lastMsgIdRef.current, real.id)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setReply(text)
    } finally {
      setSending(false)
    }
  }

  // ── Close session ─────────────────────────────────────────────────────────────
  async function closeSession(sessionId: number) {
    await fetch("/api/admin/support-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, action: "close" }),
    }).catch(() => {})
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: "closed" as const } : s))
  }

  const selected = sessions.find(s => s.id === selectedId) ?? null

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-border bg-card">
      {/* ── Session list ─────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-border">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-sm font-semibold">Live Chat</h2>
          <button
            onClick={fetchSessions}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingSessions && (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loadingSessions && sessions.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-10">No chats yet</p>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors",
                selectedId === s.id && "bg-muted",
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-medium truncate flex-1">{sessionLabel(s)}</span>
                <span
                  className={cn(
                    "shrink-0 h-1.5 w-1.5 rounded-full",
                    s.status === "open" ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )}
                />
              </div>
              {s.visitor_email && (
                <p className="text-[10px] text-muted-foreground truncate">{s.visitor_email}</p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/70">{fmtTime(s.last_message_at ?? s.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Message panel ────────────────────────────────────────────────────── */}
      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm">Select a conversation</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selected ? sessionLabel(selected) : ""}</p>
              {selected?.visitor_email && (
                <p className="text-xs text-muted-foreground truncate">{selected.visitor_email}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {selected?.status === "open" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => closeSession(selectedId)}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Close
                </Button>
              )}
              {selected?.status === "closed" && (
                <span className="text-xs text-muted-foreground px-2">Closed</span>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground pt-10">No messages yet</p>
            )}
            {messages.map(m => (
              <div
                key={m.id}
                className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    m.sender === "admin"
                      ? "bg-emerald-600 text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cn("mt-1 text-[10px] text-right", m.sender === "admin" ? "text-white/60" : "text-muted-foreground/60")}>
                    {fmtTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply box */}
          {selected?.status !== "closed" && (
            <form
              onSubmit={e => { e.preventDefault(); sendReply() }}
              className="p-3 border-t border-border flex gap-2 shrink-0 bg-background/80"
            >
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply() }
                }}
                placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                rows={2}
                disabled={sending}
                className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
              />
              <Button
                type="submit"
                disabled={!reply.trim() || sending}
                size="icon"
                className="h-10 w-10 self-end rounded-full bg-emerald-600 hover:bg-emerald-700 border-0 shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
          {selected?.status === "closed" && (
            <p className="text-center text-xs text-muted-foreground py-3 border-t border-border">Session closed</p>
          )}
        </div>
      )}
    </div>
  )
}
