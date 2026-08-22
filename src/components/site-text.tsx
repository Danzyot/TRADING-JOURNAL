'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'

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
    return (
      <Tag className={className} data-tj-wrapped="">
        {current}
      </Tag>
    )
  }

  if (!open) {
    return (
      <Tag className={className} data-tj-wrapped="">
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

// ---------------------------------------------------------------------------
// The sweep

/**
 * Text this layer must never touch.
 *
 * Form controls hold values, not wording — rewriting the selected option of a
 * `<select>` would change what a form submits. Script and style content is not
 * prose at all. And anything already inside an `Editable` has its own
 * affordance; handling it twice would give it two.
 */
const SKIP = 'script, style, noscript, textarea, input, select, option, svg, code, pre, [data-no-edit], [data-tj-wrapped]'

/** Marker left on spans this layer creates, so a re-sweep can find them. */
const MARK = 'data-tj-key'

function keyForNode(text: string): string {
  return textKey('dom', text.trim())
}

/**
 * Every text node on the page that is prose rather than data.
 *
 * A tree walker rather than a query, because the unit being edited is the text
 * node — an element can hold several, and rewriting the element would take the
 * others with it.
 */
function walkText(root: HTMLElement, visit: (node: Text) => void): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue ?? ''
      // Two characters is the shortest thing worth a click; below that it is
      // punctuation and layout glyphs.
      if (text.trim().length < 2) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent || parent.closest(SKIP)) return NodeFilter.FILTER_REJECT
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  // Collected first: visiting mutates the tree, and a live walker would then
  // either skip nodes or revisit the ones just inserted.
  const found: Text[] = []
  let node = walker.nextNode()
  while (node) {
    found.push(node as Text)
    node = walker.nextNode()
  }
  found.forEach(visit)
}

/**
 * Makes every word on the page editable, including the ones nobody wrapped.
 *
 * `Editable` only reaches text a developer remembered to wrap, which left a
 * long tail — table headers, list items, hints, the prose inside cards — fixed
 * in code. Tagging those one at a time is work that is never finished, and the
 * next page added starts the tail again.
 *
 * So this sweeps the rendered DOM instead. Overrides are applied on every
 * render, and in edit mode each text node is wrapped in a clickable span. The
 * key is a slug of the original wording, exactly as `Editable` computes it, so
 * the two mechanisms share one store and a phrase rewritten in one place
 * changes wherever else it appears.
 *
 * Deliberately not touched: anything inside a form control, since that is a
 * value and not a label — a rewritten `<option>` would change what the form
 * submits, and a number rewritten this way would disagree with the database
 * that produced it.
 */
export function TextLayer() {
  const context = useSiteText()
  const pathname = usePathname()
  const router = useRouter()
  const [target, setTarget] = useState<{ key: string; text: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const overridesRef = useRef<Record<string, string>>({})

  const editing = context?.editing ?? false
  overridesRef.current = context?.overrides ?? {}

  const sweep = useCallback(() => {
    // The whole shell, not just <main>: the sidebar's own labels are wording
    // too, and "Earnings" was renamed from "Money" exactly this way.
    const root = document.body
    if (!(root instanceof HTMLElement)) return

    // Unwrap anything from a previous pass so a re-sweep starts from the DOM
    // React actually rendered, rather than nesting spans on every keystroke.
    root.querySelectorAll(`span[${MARK}]`).forEach((span) => {
      span.replaceWith(document.createTextNode(span.textContent ?? ''))
    })
    root.normalize()

    walkText(root, (node) => {
      const raw = node.nodeValue ?? ''
      const trimmed = raw.trim()
      const key = keyForNode(trimmed)
      const override = overridesRef.current[key]

      if (override !== undefined && override !== trimmed) {
        // Whitespace is layout: "Add " and "Add" sit differently in a flex row.
        const lead = raw.slice(0, raw.indexOf(trimmed[0]))
        const tail = raw.slice(lead.length + trimmed.length)
        node.nodeValue = `${lead}${override}${tail}`
      }

      if (!editing) return

      const span = document.createElement('span')
      span.setAttribute(MARK, key)
      span.setAttribute('title', 'Click to rewrite')
      span.className =
        'cursor-text rounded-sm underline decoration-dashed decoration-[var(--accent)] underline-offset-4'
      span.textContent = node.nodeValue
      node.replaceWith(span)
    })
  }, [editing])

  /**
   * A value that changes only when the wording does.
   *
   * The merged override map is a fresh object on every render, so depending on
   * it re-swept the DOM continuously — tearing out the spans it had just
   * created, which made a click land on an element that no longer existed.
   */
  const signature = JSON.stringify(context?.overrides ?? {})

  /**
   * Re-applies the wording whenever React changes the page.
   *
   * Two problems make a one-shot pass wrong. React owns this DOM: any re-render
   * writes the original text straight back over an override. And the app
   * streams, so parts of a page hydrate after the first pass has already run —
   * mutating a subtree React has not hydrated yet is what produced hydration
   * errors in the console.
   *
   * So the first pass waits for the page to finish loading, and a mutation
   * observer re-runs it after every subsequent change. The observer is
   * disconnected around its own work, or each rewrite would trigger the next.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let observer: MutationObserver | undefined
    let stopped = false

    const run = () => {
      if (stopped) return
      observer?.disconnect()
      sweep()
      if (!stopped) observer?.observe(document.body, { childList: true, subtree: true, characterData: true })
    }

    // Debounced: React commits in bursts, and one pass per burst is enough.
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(run, 60)
    }

    /**
     * Waits for the page to stop changing before touching it.
     *
     * `load` fires once the document has arrived, but this app streams: React
     * hydrates the late boundaries after that, and rewriting text inside a
     * subtree it has not reconciled yet is a hydration mismatch — React then
     * throws the tree away and re-renders it, undoing the rewrite and logging
     * an error on every load.
     *
     * Streaming and hydration both mutate the DOM, so a quiet spell is the
     * signal that both have finished. It is a heuristic rather than a promise —
     * React exposes nothing better — which is why the observer keeps running
     * afterwards and re-applies the wording if a later render overwrites it.
     */
    const QUIET_MS = 400

    const start = () => {
      if (stopped) return
      let settle: ReturnType<typeof setTimeout>
      const waitForQuiet = new MutationObserver(() => {
        clearTimeout(settle)
        settle = setTimeout(begin, QUIET_MS)
      })
      const begin = () => {
        waitForQuiet.disconnect()
        if (stopped) return
        observer = new MutationObserver(schedule)
        run()
      }
      waitForQuiet.observe(document.body, { childList: true, subtree: true, characterData: true })
      settle = setTimeout(begin, QUIET_MS)
    }

    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })

    return () => {
      stopped = true
      window.removeEventListener('load', start)
      clearTimeout(timer)
      observer?.disconnect()
    }
  }, [sweep, pathname, signature])

  useEffect(() => {
    if (!editing) return
    const onClick = (event: MouseEvent) => {
      const el = event.target
      if (!(el instanceof HTMLElement)) return
      const span = el.closest(`span[${MARK}]`)
      if (!span) return
      event.preventDefault()
      event.stopPropagation()
      const text = (span.textContent ?? '').trim()
      setTarget({ key: span.getAttribute(MARK)!, text })
      setDraft(text)
      setError(null)
    }
    // Capture, so a click on wording inside a button edits the wording rather
    // than pressing the button.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [editing])

  if (!context || !editing || !target) return null

  const commit = () => {
    setError(null)
    startTransition(async () => {
      const result = await context.save(target.key, draft)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setTarget(null)
      router.refresh()
    })
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--surface)] p-3 shadow-lg"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      data-no-edit=""
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        <p className="text-[0.6875rem] text-[var(--ink-muted)]">
          Rewriting “{target.text.slice(0, 80)}” — everywhere it appears.
        </p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') setTarget(null)
          }}
          rows={Math.min(4, Math.ceil(draft.length / 60) || 1)}
          autoFocus
          className="textarea text-sm"
          disabled={pending}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" onClick={commit} className="btn btn-primary px-2 py-0.5" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => setTarget(null)} className="btn px-2 py-0.5" disabled={pending}>
            Cancel
          </button>
          <span className="text-[var(--ink-muted)]">Empty it to restore the original wording.</span>
          {error && <span className="text-[var(--critical)]">{error}</span>}
        </div>
      </div>
    </div>
  )
}
