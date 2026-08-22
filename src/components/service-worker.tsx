'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker on every visit.
 *
 * Two reasons it runs for everyone rather than only after notifications are
 * enabled: the cached app shell is what makes a cold open feel instant while
 * the database wakes, and iOS will only deliver a push to a service worker
 * that was already registered when the subscription was made.
 *
 * Registration is deliberately deferred until after load. A service worker
 * competing with the first render for bandwidth would slow down the very thing
 * it exists to speed up.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration costs the offline shell, nothing else; the app
        // works exactly as it did before service workers existed.
      })
    }

    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
