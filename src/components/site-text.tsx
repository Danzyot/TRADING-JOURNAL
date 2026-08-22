'use client'

import { createContext, useContext, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Editing the words on the page.
 *
 * Values in this journal were always editable through forms; the wording was
 * not — headings and descriptions were fixed in code, which meant a label that
 * did not match how its owner thinks about his own trading stayed wrong.
 *
 * Edit mode is off by default and lives behind the pencil in the sidebar. With
 * it on, any heading or description can be clicked and rewritten. Clearing the
 * box restores the built-in wording, so there is no separate reset to find.
 *
 * The key for each piece of text is derived from the text itself rather than
 * assigned by hand — that is what makes every heading in the app editable
 * without tagging hundreds of call sites one at a time.
 */

type SiteTextValue = {
  overrides: Record<string, string>
  editing: boolean
  setEditing: (value: boolean) => void
  save: (key: string, value: string) => Promise<{ ok: boolean; message: string }>
}

const SiteTextContext = createContext<SiteTextValue | null>(null)

export function SiteTextProvider({
  overrides,
  save,
  children,
}: {
  overrides: Record<string, string>
  save: (key: string, value: string) => Promise<{ ok: boolean; message: string }>
  children: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  // Saved edits are held here as well as sent to the server. The server render
  // is the source of truth, but waiting for it to come back means the words
  // you just typed sit unchanged on screen for a moment, which reads as the
  // save having failed.
  //
  // `null` records a *cleared* override rather than absence. Dropping the key
  // instead would let the server's copy — still the old wording until the next
  // render arrives — show through, so restoring a default appeared to do
  // nothing at all.
  const [local, setLocal] = useState<Record<string, string | null>>({})

  const saveAndKeep = async (key: string, value: string) => {
    const result = await save(key, value)
    if (result.ok) {
      setLocal((current) => ({ ...current, [key]: value.trim() === '' ? null : value.trim() }))
    }
    return result
  }

  const merged: Record<string, string> = { ...overrides }
  for (const [key, value] of Object.entries(local)) {
    if (value === null) delete merged[key]
    else merged[key] = value
  }

  return (
    <SiteTextContext.Provider value={{ overrides: merged, editing, setEditing, save: saveAndKeep }}>
      {children}
    </SiteTextContext.Provider>
  )
}

export function useSiteText() {
  return useContext(SiteTextContext)
}

/** A stable key from the wording itself, so nothing has to be tagged by hand. */
export function textKey(scope: string, value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${scope}:${slug}`
}

/**
 * One piece of rewritable text.
 *
 * Renders as plain text until edit mode is on, so nothing about the normal
 * reading experience changes — no extra markup in the way of a screen reader,
 * no stray affordances on a phone.
 */
export function Editable({
  scope,
  children,
  className,
  as: Tag = 'span',
}: {
  scope: string
  children: string
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'p'
}) {
  const context = useSiteText()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const key = textKey(scope, children)
  const current = context?.overrides[key] ?? children

  if (!context?.editing) {
    return <Tag className={className}>{current}</Tag>
  }

  if (!open) {
    return (
      <Tag className={className}>
        <button
          type="button"
          onClick={() => {
            setDraft(current)
            setError(null)
            setOpen(true)
          }}
          className="cursor-text rounded-sm text-left underline decoration-dashed decoration-[var(--accent)] underline-offset-4 hover:bg-[var(--surface-sunken)]"
          title="Click to rewrite"
        >
          {current}
        </button>
      </Tag>
    )
  }

  const commit = () => {
    setError(null)
    startTransition(async () => {
      const result = await context.save(key, draft)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setOpen(false)
      // The text lives on the server, so the page has to re-render to show it
      // — including everywhere else the same wording appears.
      router.refresh()
    })
  }

  return (
    <span className="inline-flex w-full max-w-2xl flex-col gap-1 align-top">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Enter saves, Shift+Enter makes a new line, Escape abandons.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') setOpen(false)
        }}
        rows={Math.min(4, Math.ceil(draft.length / 60) || 1)}
        autoFocus
        className="textarea text-sm"
        disabled={pending}
      />
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={commit} className="btn btn-primary px-2 py-0.5" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn px-2 py-0.5" disabled={pending}>
          Cancel
        </button>
        <span className="text-[var(--ink-muted)]">Empty it to restore the original wording.</span>
        {error && <span className="text-[var(--critical)]">{error}</span>}
      </span>
    </span>
  )
}

/** The pencil. Shown in the sidebar, and the only way into edit mode. */
export function EditModeToggle() {
  const context = useSiteText()
  if (!context) return null

  return (
    <button
      type="button"
      onClick={() => context.setEditing(!context.editing)}
      aria-pressed={context.editing}
      title={context.editing ? 'Finish editing text' : 'Edit the wording on this page'}
      className={
        context.editing
          ? 'flex w-full items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-2 py-1.5 text-xs font-medium text-white'
          : 'flex w-full items-center gap-2 rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--line-strong)]'
      }
    >
      <span aria-hidden>✎</span>
      {context.editing ? 'Done editing' : 'Edit text'}
    </button>
  )
}
