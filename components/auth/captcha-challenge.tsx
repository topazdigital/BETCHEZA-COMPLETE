'use client'

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { Loader2, RefreshCcw, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CaptchaResult = { token: string; id?: string }

export interface CaptchaChallengeHandle {
  /** Returns the current captcha solution, or null when missing/incomplete. */
  getResult: () => CaptchaResult | null
  /** Force a fresh challenge (e.g. after a failed login attempt). */
  refresh: () => Promise<void>
}

type CaptchaConfig = {
  provider: 'turnstile' | 'recaptcha' | 'math' | 'none'
  siteKey: string | null
  math: { id: string; question: string } | null
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement | string,
        opts: { sitekey: string; callback: (token: string) => void; theme?: string },
      ) => string
      reset: (id?: string) => void
    }
    grecaptcha?: {
      ready: (cb: () => void) => void
      render: (
        el: HTMLElement | string,
        opts: { sitekey: string; callback: (token: string) => void; theme?: string },
      ) => number
      reset: (id?: number) => void
    }
  }
}

/**
 * Renders the active captcha widget: Cloudflare Turnstile or Google reCAPTCHA
 * if their secrets are configured, otherwise a simple math challenge issued by
 * /api/captcha/challenge. The auth modal places this inside the form and calls
 * `getResult()` right before submitting credentials.
 */
export const CaptchaChallenge = forwardRef<CaptchaChallengeHandle, {
  /** Show the widget. We keep it always-mounted but hide it until needed. */
  visible: boolean
  className?: string
}>(function CaptchaChallenge({ visible, className }, ref) {
  const [config, setConfig] = useState<CaptchaConfig | null>(null)
  const [mathAnswer, setMathAnswer] = useState('')
  const [tokenFromWidget, setTokenFromWidget] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const widgetHostRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | number | null>(null)

  const loadChallenge = async () => {
    setLoading(true)
    setMathAnswer('')
    setTokenFromWidget(null)
    try {
      const res = await fetch('/api/captcha/challenge', { cache: 'no-store' })
      if (res.ok) setConfig(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible && !config) loadChallenge()
  }, [visible, config])

  useEffect(() => {
    if (!visible || !config) return
    if (config.provider === 'turnstile' && config.siteKey) {
      ensureScript('turnstile-script', 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
        .then(() => {
          if (!widgetHostRef.current || !window.turnstile) return
          widgetHostRef.current.innerHTML = ''
          widgetIdRef.current = window.turnstile.render(widgetHostRef.current, {
            sitekey: config.siteKey!,
            callback: (token) => setTokenFromWidget(token),
            theme: 'auto',
          })
        })
        .catch(() => undefined)
    }
    if (config.provider === 'recaptcha' && config.siteKey) {
      ensureScript('recaptcha-script', 'https://www.google.com/recaptcha/api.js?render=explicit')
        .then(() => {
          if (!widgetHostRef.current || !window.grecaptcha) return
          widgetHostRef.current.innerHTML = ''
          window.grecaptcha.ready(() => {
            widgetIdRef.current = window.grecaptcha!.render(widgetHostRef.current!, {
              sitekey: config.siteKey!,
              callback: (token) => setTokenFromWidget(token),
              theme: 'light',
            })
          })
        })
        .catch(() => undefined)
    }
  }, [visible, config])

  useImperativeHandle(ref, () => ({
    getResult: () => {
      if (!config) return null
      if (config.provider === 'math') {
        if (!mathAnswer.trim() || !config.math) return null
        return { token: mathAnswer.trim(), id: config.math.id }
      }
      if (!tokenFromWidget) return null
      return { token: tokenFromWidget }
    },
    refresh: async () => {
      if (config?.provider === 'turnstile' && window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(String(widgetIdRef.current))
        setTokenFromWidget(null)
        return
      }
      if (config?.provider === 'recaptcha' && window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(Number(widgetIdRef.current))
        setTokenFromWidget(null)
        return
      }
      await loadChallenge()
    },
  }))

  if (!visible) return null

  return (
    <div className={cn('rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Quick security check
        </span>
        <button
          type="button"
          onClick={() => loadChallenge()}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="New captcha"
        >
          <RefreshCcw className="h-3 w-3" /> New
        </button>
      </div>

      {loading || !config ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading challenge…
        </div>
      ) : config.provider === 'math' && config.math ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums">
            {config.math.question} =
          </span>
          <Input
            type="text"
            inputMode="numeric"
            pattern="-?[0-9]*"
            autoComplete="off"
            placeholder="?"
            className="h-8 w-16"
            value={mathAnswer}
            onChange={(e) => setMathAnswer(e.target.value)}
          />
        </div>
      ) : (config.provider === 'turnstile' || config.provider === 'recaptcha') && config.siteKey ? (
        <div ref={widgetHostRef} className="min-h-[70px]" />
      ) : (
        <p className="text-xs text-muted-foreground">No challenge required.</p>
      )}
      <p className="text-[10px] text-muted-foreground/80">
        Helps us keep bots out without slowing you down.
      </p>
    </div>
  )
})

const SCRIPT_PROMISES = new Map<string, Promise<void>>()
function ensureScript(id: string, src: string): Promise<void> {
  if (SCRIPT_PROMISES.has(id)) return SCRIPT_PROMISES.get(id)!
  const p = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('no document'))
    if (document.getElementById(id)) return resolve()
    const s = document.createElement('script')
    s.id = id
    s.src = src
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
  SCRIPT_PROMISES.set(id, p)
  return p
}
