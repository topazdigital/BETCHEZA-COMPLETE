"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Brain, Send, X, Sparkles, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ChatMsg {
  role: "user" | "assistant"
  content: string
  ts: number
}

// ───────────────────────────────────────────────────────────────────────
// Dynamic suggestion engine
// ───────────────────────────────────────────────────────────────────────
// We never want the same 4 canned chips on every page load — feels stale and
// makes the AI look dumb. Instead we keep a large POOL split into general
// betting questions and per-page contextual questions, then pick 4 fresh
// suggestions for each chat session that:
//   1. Are relevant to the user's current page (match / tipster / dashboard…)
//   2. Rotate randomly so opening the chat twice in a row feels different
//   3. Always include at least one "discoverable feature" prompt so users
//      learn what the app can do (compare odds, AI prediction, etc.)
const SUGGESTION_POOL = {
  generic: [
    "What's a value bet?",
    "How big should my stake be?",
    "Explain Over 2.5 goals",
    "Explain BTTS in plain English",
    "Help — I lost 3 in a row",
    "What's a safe accumulator?",
    "How does your AI Prediction work?",
    "Best market for low-scoring matches?",
    "How do I read American vs Decimal odds?",
    "What's the Kelly criterion?",
    "How do I compare bookmaker odds here?",
    "What's the difference between 1X2 and Double Chance?",
    "Tips for live (in-play) betting?",
    "How do I follow my favourite team?",
    "Where do I see today's best picks?",
  ],
  match: [
    "Who do you fancy in this match?",
    "What's the value bet here?",
    "Will both teams score?",
    "Over 2.5 goals — yes or no?",
    "Read me the H2H — any pattern?",
    "Best market for this fixture?",
    "Is the home team good value?",
    "Suggest a safe Double Chance pick",
    "What confidence would you give this pick?",
    "Any injury concerns I should know?",
    "How does the AI Prediction widget see this?",
  ],
  tipster: [
    "Is this tipster worth following?",
    "How is their ROI calculated?",
    "What does their streak mean?",
    "Compare them to the leaderboard average",
    "Explain win-rate vs ROI — which matters more?",
    "Should I copy a tipster's stake size?",
  ],
  league: [
    "Which team is in best form here?",
    "Show me the top scorers in this league",
    "Any upsets brewing this round?",
    "Best Over 2.5 league for tonight?",
    "Which fixtures have the sharpest odds?",
  ],
  live: [
    "Any value in the live odds right now?",
    "Best live market for late goals?",
    "Should I cash out a winning bet?",
    "How do you read momentum from the live timer?",
  ],
  dashboard: [
    "Help me set a daily loss limit",
    "How do I track my ROI?",
    "Suggest a 7-day strategy",
    "What's healthy bankroll discipline?",
    "How do I add a new payout method?",
  ],
} as const

type SuggestionContext = keyof typeof SUGGESTION_POOL

function pickContextFromPath(pathname: string | null): SuggestionContext {
  if (!pathname) return 'generic'
  if (/^\/matches\/[^/]+/.test(pathname)) return 'match'
  if (/^\/tipsters\/[^/]+/.test(pathname)) return 'tipster'
  if (/^\/leagues\/[^/]+/.test(pathname)) return 'league'
  if (pathname.startsWith('/live')) return 'live'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  return 'generic'
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildSuggestions(pathname: string | null, count = 4): string[] {
  const ctx = pickContextFromPath(pathname)
  const contextual = ctx === 'generic' ? [] : shuffle(SUGGESTION_POOL[ctx])
  const generic = shuffle(SUGGESTION_POOL.generic)
  // Mix: roughly 60% contextual + 40% generic so the chips feel grounded in
  // what the user is looking at but still surface app-wide tricks.
  const contextualCount = Math.min(contextual.length, Math.ceil(count * 0.6))
  const merged = [
    ...contextual.slice(0, contextualCount),
    ...generic.slice(0, count - contextualCount),
  ]
  // De-duplicate and trim
  return Array.from(new Set(merged)).slice(0, count)
}

const STORAGE_KEY = "bcz_ai_chat_v1"
const SESSION_KEY = "bcz_ai_session_v1"

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "anon"
  try {
    const existing = localStorage.getItem(SESSION_KEY)
    if (existing && existing.length >= 8) return existing
    const fresh = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    return "anon"
  }
}
const WELCOME: ChatMsg = {
  role: "assistant",
  content: "Hey 👋 I'm Betcheza AI — your betting copilot. Ask me about picks, markets, value, bankroll, or anything on the app.",
  ts: Date.now(),
}

export function AIChatButton() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([WELCOME])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [unread, setUnread] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()

  // Refresh the suggestion chips every time the user opens the chat OR the
  // page changes underneath them. This guarantees the prompts feel fresh and
  // contextual ("Who do you fancy?" on a match page, "Help me set a loss
  // limit" on the dashboard, etc.) — not the same 4 stale placeholders.
  useEffect(() => {
    if (open) setSuggestions(buildSuggestions(pathname))
  }, [open, pathname])

  // Also seed an initial set on mount so the chips are ready instantly when
  // the user pops open the chat for the first time.
  useEffect(() => {
    setSuggestions(buildSuggestions(pathname))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build a small "what page am I on" hint so the LLM can answer
  // questions like "explain this match" with the right context.
  const buildPageContext = (): string => {
    if (typeof window === "undefined") return `Path: ${pathname || "/"}`
    const lines: string[] = [`Path: ${pathname || "/"}`]
    const matchId = pathname?.match(/^\/matches\/([^/]+)/)?.[1]
    if (matchId) lines.push(`Viewing match id: ${matchId}`)
    const tipsterId = pathname?.match(/^\/tipsters\/([^/]+)/)?.[1]
    if (tipsterId) lines.push(`Viewing tipster id: ${tipsterId}`)
    // Best-effort: pull the page title (e.g. "Arsenal vs Chelsea — Betcheza")
    if (document?.title) lines.push(`Page title: ${document.title}`)
    // First visible <h1> often holds the match heading
    const h1 = document?.querySelector("h1")?.textContent?.trim()
    if (h1 && h1.length < 200) lines.push(`Top heading: ${h1}`)
    return lines.join("\n")
  }

  // Restore chat history on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMsg[]
        if (Array.isArray(parsed) && parsed.length > 0) setMsgs(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50))) } catch { /* ignore */ }
  }, [msgs])

  // Auto-scroll on new messages
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [msgs, open])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || busy) return
    const userMsg: ChatMsg = { role: "user", content, ts: Date.now() }
    setMsgs((m) => [...m, userMsg])
    setInput("")
    setBusy(true)
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...msgs, userMsg].map(({ role, content }) => ({ role, content })),
          context: buildPageContext(),
          sessionId: getOrCreateSessionId(),
        }),
      })
      let reply = "I'm here — give me a second and try again."
      try {
        const j = (await res.json()) as { reply?: string }
        if (j?.reply) reply = j.reply
      } catch {
        /* non-JSON response — keep default reply */
      }
      setMsgs((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }])
      if (!open) setUnread(true)
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Lost connection for a moment. Check your internet and tap send again — I'll pick up right where we left off.",
          ts: Date.now(),
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  const toggle = () => {
    setOpen((v) => !v)
    if (!open) setUnread(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={toggle}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        className={cn(
          "fixed z-40 right-4 md:right-6 transition-all duration-300",
          // Sit above the bottom mobile nav
          "bottom-20 md:bottom-6",
          "h-14 w-14 rounded-full shadow-2xl",
          "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500",
          "hover:scale-110 active:scale-95",
          "flex items-center justify-center group",
          open && "scale-90 opacity-90"
        )}
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <>
            <Brain className="h-6 w-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black ring-2 ring-background animate-pulse">
              AI
            </span>
            {unread && (
              <span className="absolute top-0 right-0 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-40 right-3 md:right-6 bottom-36 md:bottom-24",
            "w-[calc(100vw-1.5rem)] max-w-sm md:max-w-md",
            "h-[70vh] max-h-[600px]",
            "rounded-2xl border border-violet-500/30 bg-background/95 backdrop-blur-xl shadow-2xl",
            "flex flex-col overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Brain className="h-4.5 w-4.5 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-foreground">Betcheza AI</h3>
                <span className="text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-1.5 py-0.5 rounded">AI</span>
              </div>
              <p className="text-[10px] text-emerald-400">Online · always available</p>
            </div>
            <button onClick={toggle} className="p-1.5 rounded-md hover:bg-muted/50">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex gap-2 justify-start">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
                  <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2.5 flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:240ms]" />
                </div>
              </div>
            )}
          </div>

          {/* Suggestions — contextual & rotated each time you open the chat */}
          {msgs.length <= 2 && suggestions.length > 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 items-center">
              {suggestions.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  onClick={() => send(s)}
                  disabled={busy}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted/50 transition-colors disabled:opacity-50 text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => setSuggestions(buildSuggestions(pathname))}
                disabled={busy}
                title="Show different suggestions"
                aria-label="Refresh suggestions"
                className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                <MessageSquare className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="p-3 border-t border-border flex gap-2 bg-background/80"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={busy}
              className="flex-1 h-10 rounded-full border border-border bg-muted/30 px-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
            />
            <Button
              type="submit"
              disabled={!input.trim() || busy}
              size="icon"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 border-0 shrink-0"
            >
              <Send className="h-4 w-4 text-white" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
