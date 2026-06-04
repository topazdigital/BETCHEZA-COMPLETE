"use client"

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        /* Silently activate new SW versions — no toast prompt */
        const activateSilently = (worker: ServiceWorker) => {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated' && navigator.serviceWorker.controller) {
              // Silent update — no user prompt
            }
          })
        }

        if (registration.waiting) activateSilently(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) activateSilently(newWorker)
        })

        /* Periodically check for SW updates (every 60 min) */
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000)
      })
      .catch(() => {
        /* SW registration failed — not critical, app still works online */
      })
  }, [])

  return null
}
