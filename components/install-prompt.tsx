"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY   = "bcz_install_dismiss_perm_v1"
const INSTALLED_KEY = "bcz_app_installed_v1"

function isPermanentlyDismissed() {
  try { return !!localStorage.getItem(DISMISS_KEY); } catch { return false; }
}
function markDismissed() {
  try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
}
function markInstalled() {
  try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
}
function wasInstalled() {
  try { return !!localStorage.getItem(INSTALLED_KEY); } catch { return false; }
}

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua) && window.innerWidth <= 820;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow]         = useState(false)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS]       = useState(false)
  const [showMini, setShowMini] = useState(false)
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS only
      window.navigator.standalone === true

    if (standalone || wasInstalled()) {
      setInstalled(true)
      return
    }

    const ua = navigator.userAgent.toLowerCase()
    const mobile = isMobileDevice()
    const ios    = /iphone|ipad|ipod/.test(ua) && !/crios|fxios|edgios/.test(ua) && mobile
    const dismissed = isPermanentlyDismissed()

    if (ios) {
      setIsIOS(true)
      if (!dismissed) {
        const t = setTimeout(() => setShow(true), 5000)
        return () => clearTimeout(t)
      }
      return
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      setDeferred(evt)
      deferredRef.current = evt
      if (!dismissed) {
        setShow(true)
      } else {
        setShowMini(true)
      }
    }

    const onInstalled = () => {
      markInstalled()
      setInstalled(true)
      setShow(false)
      setShowMini(false)
      setDeferred(null)
      deferredRef.current = null
    }

    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    markDismissed()
    setShow(false)
    if (deferredRef.current) setShowMini(true)
  }

  const install = async () => {
    const evt = deferredRef.current
    if (!evt) return
    try {
      await evt.prompt()
      const { outcome } = await evt.userChoice
      if (outcome === "accepted") {
        markInstalled()
        setInstalled(true)
        setShowMini(false)
      }
    } finally {
      setDeferred(null)
      deferredRef.current = null
      setShow(false)
      setShowMini(false)
    }
  }

  if (installed) return null

  return (
    <>
      {showMini && !show && (
        <button
          onClick={install}
          className={cn(
            "fixed z-40 flex items-center gap-1.5 rounded-full border border-emerald-500/40",
            "bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 shadow-lg",
            "backdrop-blur-sm hover:bg-emerald-500/20 transition-all duration-300",
            "hover:scale-105 active:scale-95",
            "bottom-24 left-4 md:bottom-6 md:left-6",
            "group relative animate-sonar"
          )}
          title="Install Betcheza App"
        >
          <span className="absolute inset-0 rounded-full border border-emerald-500/30 animate-orbit" />
          <Download className="h-3.5 w-3.5 relative z-10" />
          <span className="hidden sm:inline relative z-10">Install App</span>
        </button>
      )}

      {show && (
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm",
            "bottom-20 md:bottom-6"
          )}
        >
          <div
            onClick={!isIOS ? install : undefined}
            className={cn(
              "rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-background to-background backdrop-blur-xl shadow-2xl p-4",
              !isIOS && "cursor-pointer active:scale-[0.98] transition-transform"
            )}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg overflow-hidden">
                <img src="/favicon.png" alt="Betcheza" className="h-8 w-8 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Get the Betcheza App</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isIOS
                        ? "Add to your home screen for live tips, instant alerts and offline access."
                        : "Live tips, instant alerts and offline access — free."}
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
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      To install on iPhone/iPad, use <strong>Safari</strong> then:
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">1.</span>
                      Tap <Share className="inline h-3.5 w-3.5 text-sky-400 mx-0.5" />
                      in the toolbar
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">2.</span> Tap <strong>Add to Home Screen</strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">3.</span> Tap <strong>Add</strong> — done!
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 h-8 px-3 text-xs"
                      onClick={(e) => { e.stopPropagation(); install(); }}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Install App — it&apos;s free
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={dismiss}>
                      Later
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
