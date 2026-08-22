'use client'

import { useCallback, useEffect, useState } from 'react'

/** Reloading in a loop is worse than a stale page, so each recovery fires once. */
const RECOVERY_KEY = 'tj-reloaded-for-update'

/**
 * A page becomes "fresh" again after this long in the background. Reloading a
 * page someone is actively typing into would lose their work; reloading one
 * they have just come back to after a coffee loses nothing.
 */
const RESUME_AFTER_MS = 5_000

function isStaleAssetError(message: string): boolean {
  // What a browser says when the JS bundle a page asks for is no longer on the
  // server — the signature of a deploy landing under a still-open tab.
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  )
}

/**
 * Keeps an installed app on the current version.
 *
 * A home-screen app on iOS is rarely closed — it is suspended and resumed for
 * weeks. So when a deploy lands, the copy on the phone keeps running the code
 * it started with, and the first thing it asks the server for that it does not
 * already have is a script file that no longer exists. The app breaks, and the
 * only obvious fix from the phone is to delete it and add it again.
 *
 * Three things prevent that, in order of how early they catch it:
 *
 *  1. `updateViaCache: 'none'` — the worker script itself is never served from
 *     the HTTP cache, so a new version is always noticed.
 *  2. A check whenever the app comes back to the foreground, which is exactly
 *     when a suspended app rejoins the world. If it has been in the background
 *     long enough to count as a fresh visit, the reload is silent; if the user
 *     is mid-sentence, they get a button instead of losing the sentence.
 *  3. A last resort: if a script does fail to load, reload once. Recovering
 *     from a broken page beats sitting on one.
 */
export function ServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false)

  const reload = useCallback(() => {
    try {
      sessionStorage.setItem(RECOVERY_KEY, '1')
    } catch {
      // Private mode or blocked storage: the reload still helps, it just
      // cannot promise not to repeat.
    }
    window.location.reload()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // --- 3. Recover from a bundle that is no longer on the server ----------
    let recovered = false
    try {
      recovered = sessionStorage.getItem(RECOVERY_KEY) === '1'
    } catch {
      recovered = false
    }

    const onError = (event: ErrorEvent) => {
      if (recovered || !isStaleAssetError(event.message ?? '')) return
      recovered = true
      reload()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = typeof reason === 'string' ? reason : (reason?.message ?? '')
      if (recovered || !isStaleAssetError(message)) return
      recovered = true
      reload()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    // A page that loaded cleanly is on the current version, so the one-shot
    // recovery guard can be handed back for next time.
    if (recovered) {
      try {
        sessionStorage.removeItem(RECOVERY_KEY)
      } catch {
        // Nothing to do — the guard simply stays spent for this session.
      }
    }

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('error', onError)
        window.removeEventListener('unhandledrejection', onRejection)
      }
    }

    // --- 1 & 2. Register, then watch for a newer worker -------------------
    let registration: ServiceWorkerRegistration | undefined
    // A first install also fires controllerchange, and there is nothing stale
    // to reload for — only a *replacement* means the code on screen is old.
    let hadController = Boolean(navigator.serviceWorker.controller)
    let hiddenAt: number | null = null

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          registration = reg
        })
        .catch(() => {
          // A failed registration costs the offline shell and this update
          // check, nothing else; the app works as it did before.
        })
    }

    const onControllerChange = () => {
      if (!hadController) {
        hadController = true
        return
      }
      // Fresh from the background counts as a new visit: nothing is half-typed,
      // so take the update without asking.
      const resumed = hiddenAt !== null && Date.now() - hiddenAt > RESUME_AFTER_MS
      if (resumed || document.visibilityState !== 'visible') reload()
      else setUpdateReady(true)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      registration?.update().catch(() => {
        // Offline, most likely. The next resume tries again.
      })
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', onVisibility)

    // Registration is deferred until after load: a service worker competing
    // with the first render for bandwidth slows down the thing it speeds up.
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('load', register)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reload])

  if (!updateReady) return null

  return (
    <button
      type="button"
      onClick={reload}
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white shadow-lg"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      A new version is ready — tap to reload
    </button>
  )
}
