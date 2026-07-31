"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Cookie, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSiteSettings } from "@/lib/hooks/use-site-settings"

const STORAGE_KEY = "betcheza_cookie_consent_v1"

/**
 * Footer cookie consent banner. Uses the shared useSiteSettings hook so it
 * reuses the already-cached SWR response — zero extra HTTP requests.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [consented, setConsented] = useState(true)
  const { data } = useSiteSettings()

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
    if (stored === "accept" || stored === "decline") return
    setConsented(false)
  }, [])

  useEffect(() => {
    if (consented || !data) return
    if (data.cookieBannerEnabled === false) return
    setVisible(true)
  }, [data, consented])

  const persist = (choice: "accept" | "decline") => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      // Ignore quota / privacy-mode errors.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 md:bottom-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:px-0">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            {data?.cookieBannerMessage || "We use cookies to improve your experience, analyse site traffic and personalise content."}{" "}
            <Link href="/cookies" className="text-primary underline-offset-2 hover:underline">
              Learn more
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
          <Button variant="ghost" size="sm" onClick={() => persist("decline")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => persist("accept")}>
            Accept
          </Button>
          <button
            aria-label="Dismiss"
            className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => persist("decline")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
