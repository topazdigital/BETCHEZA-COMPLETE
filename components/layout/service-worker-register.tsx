"use client"

import { useEffect } from 'react'
import { toast } from 'sonner'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        /* When a new SW version is waiting, offer a refresh */
        const handleUpdate = (worker: ServiceWorker) => {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') {
              toast('New version available', {
                description: 'Reload to get the latest Betcheza update.',
                action: {
                  label: 'Reload',
                  onClick: () => window.location.reload(),
                },
                duration: 10000,
              })
            }
          })
        }

        if (registration.waiting) handleUpdate(registration.waiting)

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) handleUpdate(newWorker)
        })

        /* Periodically check for SW updates (every 60 min) */
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000)
      })
      .catch(() => {
        /* SW registration failed — not critical, app still works online */
      })

    /* When we come back online after being offline, reload stale pages */
    const handleOnline = () => {
      toast.success('Back online!', {
        description: 'Refreshing to get the latest data…',
        duration: 3000,
      })
      setTimeout(() => window.location.reload(), 1500)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return null
}
