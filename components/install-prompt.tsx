"use client"

import { useEffect, useState } from "react"
import { Download, Share, X, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "bcz_install_dismiss_v1"
const DISMISS_DAYS = 7

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Already installed?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      // @ts-expect-error - iOS only field
      window.navigator.standalone === true
    if (standalone) {
      setInstalled(true)
      return
    }

    // Recently dismissed?
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const ts = parseInt(dismissed, 10)
      if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000) return
    }

    // iOS path (Safari has no beforeinstallprompt)
    const ua = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua) && !/crios|fxios|edgios/.test(ua)
    if (ios) {
      setIsIOS(true)
      const t = setTimeout(() => setShow(true), 4000)
      return () => clearTimeout(t)
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    const onInstalled = () => {
      setInstalled(true)
      setShow(false)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  const install = async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === "accepted") {
        setInstalled(true)
      }
    } finally {
      setDeferred(null)
      setShow(false)
    }
  }

  if (installed || !show) return null

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md",
        // Sit above the bottom nav on mobile
        "bottom-20 md:bottom-6"
      )}
    >
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-background to-background backdrop-blur-xl shadow-2xl p-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-foreground">Install Betcheza</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isIOS
                    ? "Add to home screen for live tips & faster access."
                    : "Install the app for live tips, instant alerts and offline access."}
                </p>
              </div>
              <button
                onClick={dismiss}
                aria-label="Dismiss install prompt"
                className="-mt-1 -mr-1 p-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">1.</span>
                  Tap <Share className="inline h-3.5 w-3.5 text-sky-400" />
                  in Safari's toolbar
                </p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">2.</span> Choose <strong>Add to Home Screen</strong>
                </p>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 h-8 px-3"
                  onClick={install}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Install
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={dismiss}>
                  Not now
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
