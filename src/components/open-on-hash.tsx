'use client'

import { useEffect } from 'react'

/**
 * Opens a folded section when the page is linked to it.
 *
 * "Import a CSV instead" on the settings page, and the empty states elsewhere,
 * send you to the journal — where the import form is a closed `<details>` most
 * of a page down. Landing there looked exactly like clicking a button that does
 * nothing, which is what it was reported as.
 *
 * A `<details>` cannot be opened by CSS, and browsers disagree about whether a
 * fragment inside a closed one auto-expands it, so this does it explicitly: on
 * arrival and on any later hash change, open the target and scroll it into
 * view.
 */
export function OpenOnHash() {
  useEffect(() => {
    const reveal = () => {
      const id = window.location.hash.slice(1)
      if (!id) return
      const target = document.getElementById(id)
      if (!(target instanceof HTMLDetailsElement)) return
      target.open = true
      // After the open, so the browser scrolls to where the section ends up
      // rather than to where its closed header used to be.
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'smooth' }))
    }

    reveal()
    window.addEventListener('hashchange', reveal)
    return () => window.removeEventListener('hashchange', reveal)
  }, [])

  return null
}
