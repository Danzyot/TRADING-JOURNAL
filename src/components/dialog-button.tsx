'use client'

import { useEffect, useState } from 'react'
import { clsx } from './ui'

/**
 * A button that opens its content in a dialog.
 *
 * The content is passed in as children, which means it can be server-rendered:
 * the overview's forty figures are computed on the server exactly as they were
 * when they sat in a folded card, and this only decides when they are on
 * screen. Nothing about them is fetched or recomputed on the client.
 */
export function DialogButton({
  label,
  title,
  description,
  className,
  children,
}: {
  label: string
  title: string
  description?: string
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={clsx('btn', className)}>
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div className="card w-full max-w-3xl shadow-lg">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
                {description && <p className="text-xs text-[var(--ink-secondary)]">{description}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn px-2.5" aria-label="Close">
                ✕
              </button>
            </header>
            <div className="p-4">{children}</div>
          </div>
        </div>
      )}
    </>
  )
}
