'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clsx } from './ui'
import { EditModeToggle } from './site-text'

const NAV = [
  { href: '/', label: 'Dashboard', glyph: '◧' },
  { href: '/trades', label: 'Trades', glyph: '≡' },
  { href: '/analytics', label: 'Analytics', glyph: '◔' },
  { href: '/accounts', label: 'Accounts', glyph: '▤' },
  { href: '/firms', label: 'Prop firms', glyph: '⌂' },
  { href: '/models', label: 'Models', glyph: '◇' },
  { href: '/money', label: 'Earnings and expenses', glyph: '$' },
  { href: '/tax', label: 'Tax', glyph: '%' },
  { href: '/journal', label: 'Journal', glyph: '✎' },
  { href: '/documents', label: 'Documents', glyph: '🗎' },
  { href: '/import', label: 'Import', glyph: '↥' },
  { href: '/settings', label: 'Settings', glyph: '⚙' },
]

export function Shell({ children, logo }: { children: React.ReactNode; logo: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Navigating on a phone should close the drawer; leaving it open hides the
  // page the user just asked for.
  useEffect(() => setOpen(false), [pathname])

  return (
    <div className="flex min-h-screen">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
        >
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a 64px
                static mark; the optimiser adds a round trip for no gain. */}
            <img src={logo} alt="" width={28} height={28} className="rounded-md" />
            <span className="text-sm font-semibold text-[var(--ink)]">Trading Journal</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="text-[var(--ink-muted)] lg:hidden"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                    : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]',
                )}
              >
                <span aria-hidden className="w-4 text-center text-[0.8125rem]">
                  {item.glyph}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div
          className="border-t border-[var(--line)] p-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mb-2">
            <EditModeToggle />
          </div>
          <ThemeToggle />
          <form action="/api/logout" method="post" className="mt-2">
            <button type="submit" className="btn w-full text-[var(--ink-secondary)]">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The safe-area inset keeps the bar clear of the notch and the
            rounded corners when the app runs full screen; it is zero in a
            normal browser tab. */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--plane)]/90 px-4 py-3 backdrop-blur lg:hidden"
          style={{
            paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
            paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
            paddingRight: 'calc(1rem + env(safe-area-inset-right))',
          }}
        >
          <button onClick={() => setOpen(true)} className="text-[var(--ink)]" aria-label="Open navigation">
            ☰
          </button>
          <span className="text-sm font-semibold">Trading Journal</span>
          {/* On a phone the sidebar is a drawer, so the pencil also sits here
              where it is reachable without opening navigation first. */}
          <div className="ml-auto w-auto">
            <EditModeToggle />
          </div>
        </header>

        <main
          className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  useEffect(() => {
    const stored = localStorage.getItem('tj-theme')
    if (stored === 'light' || stored === 'dark') setTheme(stored)
  }, [])

  function apply(next: 'light' | 'dark' | 'system') {
    setTheme(next)
    if (next === 'system') {
      localStorage.removeItem('tj-theme')
      document.documentElement.removeAttribute('data-theme')
    } else {
      localStorage.setItem('tj-theme', next)
      document.documentElement.setAttribute('data-theme', next)
    }
  }

  return (
    <div className="flex rounded-lg border border-[var(--line)] p-0.5">
      {(['light', 'system', 'dark'] as const).map((option) => (
        <button
          key={option}
          onClick={() => apply(option)}
          className={clsx(
            'flex-1 rounded-md px-2 py-1 text-[0.6875rem] capitalize transition-colors',
            theme === option
              ? 'bg-[var(--surface-sunken)] font-medium text-[var(--ink)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
