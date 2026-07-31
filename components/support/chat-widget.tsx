"use client"

/**
 * SupportChatWidget — floating chat button for users to contact support.
 *
 * Session lifecycle:
 *   1. First open → POST /api/support-chat/session → store { session_id, session_token } in localStorage
 *   2. Every subsequent message → POST /api/support-chat/messages with token
 *   3. Poll for admin replies every 5 s while chat is open
 *
 * The widget lives alongside the AI chat button. Both can be visible at the
 * same time (they're separate bubbles stacked vertically on the right side).
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { MessageCircle, Send, X, Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: number
  sender: "user" | "admin"
  body: string
  created_at: string
}

interface Session {
  session_id: number
  session_token: string
}

const STORAGE_KEY = "betcheza_support_session"

// ─── Helper ───────────────────────────────────────────────────────────────────

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(s: Session) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* noop */ }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso + (iso.includes("Z") || iso.includes("+") ? "" : "Z")).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch { return "" }
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function SupportChatWidget() {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState(false)
  const [status, setStatus] = useState<"open" | "closed">("open")
  const [unread, setUnread] = useState(0)
  const lastIdRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load existing session on mount
  useEffect(() => {
    const s = loadSession()
    if (s) setSession(s)
  }, [])

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages])

  // Track unread when closed
  useEffect(() => {
    if (open) setUnread(0)
  }, [open])

  // Poll for new messages
  const poll = useCallback(async (s: Session) => {
    try {
      const r = await fetch(
        `/api/support-chat/messages?session_id=${s.session_id}&sinceId=${lastIdRef.current}`,
        { headers: { 'X-Support-Token': s.session_token } },
      )
      if (!r.ok) return
      const data = await r.json()
      setStatus(data.status ?? "open")
      const incoming: ChatMsg[] = data.messages ?? []
      if (incoming.length) {
        lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m: ChatMsg) => m.id))
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const fresh = incoming.filter((m: ChatMsg) => !existingIds.has(m.id))
          if (!fresh.length) return prev
          if (!open) setUnread(u => u + fresh.filter(m => m.sender === "admin").length)
          return [...prev, ...fresh]
        })
      }
    } catch { /* network error — ignore */ }
  }, [open])

  // Start/stop polling based on session + open state
  useEffect(() => {
    if (!session) return
    if (pollRef.current) clearInterval(pollRef.current)

    // Immediately load initial messages if session already exists
    if (messages.length === 0) {
      poll(session)
    }

    pollRef.current = setInterval(() => poll(session), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [session, poll]) // eslint-disable-line react-hooks/exhaustive-deps

  async function startSession() {
    setStarting(true)
    try {
      const r = await fetch("/api/support-chat/session", { method: "POST" })
      if (!r.ok) throw new Error("failed")
      const data = await r.json()
      const s: Session = { session_id: data.session_id, session_token: data.session_token }
      saveSession(s)
      setSession(s)
    } catch {
      // silently ignore — user can retry
    } finally {
      setStarting(false)
    }
  }

  async function send() {
    if (!session || !input.trim() || busy) return
    const text = input.trim()
    setInput("")
    setBusy(true)

    // Optimistic local add (temp id = negative)
    const tempId = -Date.now()
    const optimistic: ChatMsg = { id: tempId, sender: "user", body: text, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, optimistic])

    try {
      const r = await fetch("/api/support-chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Support-Token": session.session_token,
        },
        body: JSON.stringify({ session_id: session.session_id, body: text }),
      })
      if (!r.ok) throw new Error("failed")
      const data = await r.json()
      const real: ChatMsg = data.message
      // Replace optimistic with real
      setMessages(prev => prev.map(m => m.id === tempId ? real : m))
      lastIdRef.current = Math.max(lastIdRef.current, real.id)
    } catch {
      // Remove optimistic on failure
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(text) // restore input
    } finally {
      setBusy(false)
    }
  }

  // Determine bottom offset: AI chat button is also bottom-right,
  // so stack the support widget above it (the AI button is ~bottom-6 right-6 / bottom-24 on mobile)
  const btnBottom = "bottom-[5.5rem] md:bottom-24"
  const panelBottom = "bottom-[5.5rem] md:bottom-24"

  return (
    <>
      {/* Floating button — pill shape with label */}
      <button
        onClick={() => {
          setOpen(o => !o)
          if (!open && !session) startSession()
        }}
        className={cn(
          "fixed right-4 z-50 flex items-center gap-2 h-10 pl-3 pr-4 rounded-full shadow-lg transition-all",
          "bg-emerald-600 hover:bg-emerald-700 text-white",
          btnBottom,
          open && "opacity-0 pointer-events-none",
        )}
        aria-label="Open support chat"
      >
        {/* Emerald sonar rings — distinguishes live support from the AI chat */}
        <span className="sonar-ring absolute inset-0 rounded-full bg-emerald-400/45 pointer-events-none" />
        <span className="sonar-ring-delay absolute inset-0 rounded-full bg-emerald-300/30 pointer-events-none" />

        <MessageCircle className="h-4 w-4 shrink-0" />
        <span className="text-xs font-semibold whitespace-nowrap">Support</span>
        {unread > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed right-4 z-50 flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden",
            "w-[min(340px,calc(100vw-2rem))] h-[480px] bg-background",
            panelBottom,
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white shrink-0">
            <MessageCircle className="h-4 w-4" />
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">Support Chat</p>
              <p className="text-[10px] opacity-80">
                {status === "closed" ? "Session closed" : "We reply as soon as possible"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 hover:bg-white/20 transition-colors"
              aria-label="Minimise chat"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth">
            {!session && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Starting chat…"}
              </div>
            )}

            {session && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                <MessageCircle className="h-8 w-8 text-emerald-500/50" />
                <p className="text-sm text-muted-foreground">
                  Hi! How can we help you today?
                </p>
              </div>
            )}

            {messages.map(m => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.sender === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    m.sender === "user"
                      ? "bg-emerald-600 text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cn("mt-1 text-[10px] text-right", m.sender === "user" ? "text-white/60" : "text-muted-foreground/60")}>
                    {fmtTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))}

            {status === "closed" && (
              <p className="text-center text-xs text-muted-foreground py-2">
                This session has been closed by support.
              </p>
            )}
          </div>

          {/* Input */}
          {status !== "closed" && (
            <form
              onSubmit={e => { e.preventDefault(); send() }}
              className="p-2 border-t border-border flex gap-2 shrink-0 bg-background/80"
            >
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message…"
                disabled={busy || !session}
                className="flex-1 h-9 rounded-full border border-border bg-muted/30 px-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <Button
                type="submit"
                disabled={!input.trim() || busy || !session}
                size="icon"
                className="h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-700 border-0 shrink-0"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  )
}
