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
        "fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm",
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
                <h4 className="text-sm font-bold text-foreground">Get the Betcheza App</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isIOS
                    ? "Add to your home screen for live tips, instant alerts and offline access."
                    : "Install for live tips, instant alerts and offline access."}
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
                  in Safari&apos;s toolbar
                </p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">2.</span> Choose <strong>Add to Home Screen</strong>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">3.</span> Tap <strong>Add</strong> — it works just like an app!
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 h-8 px-3 text-xs"
                    onClick={install}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Install App
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={dismiss}>
                    Later
                  </Button>
                </div>
                <div className="flex gap-2">
                  <StoreButton
                    href="https://play.google.com/store/apps/details?id=app.betcheza"
                    label="Google Play"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                        <path d="M3.18 23.76c.41.23.88.25 1.31.06l12.34-7.12-2.68-2.68-10.97 9.74zm16.64-10.73a1.97 1.97 0 000-2.06L17.4 8.85l-2.97 2.97 2.97 2.97 2.42-1.76zm-15.33-12L17.4 8.85l-2.68 2.68L2.49.81C2.06.62 1.7.64 1.4.82L14.43 12l-2.58 2.58L.87 3.02A2 2 0 003.49 1.03z"/>
                      </svg>
                    }
                  />
                  <StoreButton
                    href="https://apps.apple.com/app/betcheza"
                    label="App Store"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.18 1.27-2.16 3.8.03 3.02 2.65 4.03 2.68 4.04l-.07.28zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StoreButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-1 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
    >
      {icon}
      <span className="truncate">{label}</span>
    </a>
  )
}
