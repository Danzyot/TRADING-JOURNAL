'use client'

import { useEffect } from 'react'

/**
 * Safety net for frozen client-side navigation.
 *
 * Next's app router occasionally swallows a Link click without moving: the
 * click is preventDefault-ed, the RSC fetch aborts, and nothing happens. The
 * documented trigger is a tab left open across a deployment (its build id no
 * longer exists on the server) — exactly what a phone tab does to this app —
 * and we have reproduced the same freeze under CPU-starved conditions locally.
 *
 * The net: watch link clicks the router claimed (defaultPrevented). If the URL
 * has not changed shortly after, fall back to a full browser navigation to the
 * same href. A slow soft navigation can also trip this, which is fine — the
 * hard navigation lands on the same page, just without the SPA transition.
 */
export function NavigationFallback() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!event.defaultPrevented) return // browser is handling it natively
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest?.('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href.startsWith('/')) return
      if (anchor.hasAttribute('download') || anchor.getAttribute('target') === '_blank') return

      const destination = new URL(href, window.location.origin).href
      if (destination === window.location.href) return
      const before = window.location.href

      window.setTimeout(() => {
        if (window.location.href === before) window.location.assign(destination)
      }, 1600)
    }

    // Bubble phase, so React's own handlers have already run.
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return null
}
