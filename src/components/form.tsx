'use client'

import { useRouter } from 'next/navigation'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionResult } from '@/server/actions'
import { clsx } from './ui'
import { Editable } from './site-text'

/**
 * A form bound to a Server Action that reports back.
 *
 * Every mutation in this app returns an `ActionResult` rather than throwing, so
 * the user always gets a sentence explaining what happened — including which
 * field was rejected. A silent form is the fastest way to lose trust in a tool
 * that is recording your money.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  children: React.ReactNode
  className?: string
  resetOnSuccess?: boolean
  onSuccess?: () => void
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  // What was submitted, kept so a rejected save can be handed back.
  const submitted = useRef<Record<string, string> | null>(null)

  const [state, formAction] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => {
      submitted.current = Object.fromEntries(
        [...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
      return action(formData)
    },
    null,
  )

  useEffect(() => {
    if (!state) return

    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset()
      onSuccess?.()
      submitted.current = null
      // The server action revalidated its paths, but the tree on screen was
      // rendered before that and does not re-fetch on its own: applying an
      // email suggestion left the suggestion sitting there, which reads as a
      // button that did nothing. One refresh, and only after a success.
      router.refresh()
      return
    }

    /**
     * Put the rejected values back.
     *
     * React clears an uncontrolled form after a form action runs — on failure
     * as well as success. So a validation error did not just refuse the save,
     * it deleted what had been typed: a trading model written out in full,
     * gone to one bad field. Restoring is a DOM write because these inputs are
     * uncontrolled by design; making every field controlled to survive an
     * error would be a much larger change for the same outcome.
     *
     * Only fields that hold typed work are restored. A file input cannot be
     * set from script at all, and re-checking boxes from a stale snapshot is
     * more likely to be wrong than useful.
     */
    const values = submitted.current
    const form = formRef.current
    if (!values || !form) return

    for (const element of Array.from(form.elements)) {
      if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement) &&
        !(element instanceof HTMLSelectElement)
      ) {
        continue
      }
      if (element instanceof HTMLInputElement && ['file', 'checkbox', 'radio'].includes(element.type)) {
        continue
      }
      const previous = values[element.name]
      if (previous !== undefined && element.value !== previous) element.value = previous
    }
    // `onSuccess` is intentionally excluded: callers pass inline closures, and
    // depending on it would re-fire the effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, resetOnSuccess])

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {state && <FormMessage result={state} />}
    </form>
  )
}

export function FormMessage({ result }: { result: ActionResult }) {
  return (
    <p
      role="status"
      className={clsx(
        'mt-3 flex items-start gap-1.5 text-xs',
        result.ok ? 'text-[var(--good-text)]' : 'text-[var(--critical)]',
      )}
    >
      <span aria-hidden>{result.ok ? '✓' : '!'}</span>
      <span>{result.message}</span>
    </p>
  )
}

export function SubmitButton({
  children,
  className = 'btn btn-primary',
  pendingLabel,
}: {
  children: React.ReactNode
  className?: string
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingLabel ?? 'Working…') : children}
    </button>
  )
}

/**
 * A button that runs an action with no form fields — sync, rebuild, refresh.
 * Destructive ones ask first; an accidental click should not delete an account.
 */
export function ActionButton({
  action,
  children,
  className = 'btn',
  confirm,
  pendingLabel,
}: {
  action: () => Promise<ActionResult>
  children: React.ReactNode
  className?: string
  confirm?: string
  pendingLabel?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)

  async function run() {
    if (confirm && !window.confirm(confirm)) return
    setPending(true)
    setResult(null)
    try {
      const outcome = await action()
      setResult(outcome)
      // Same reason as ActionForm: the page has to be told to re-read what the
      // action just changed underneath it.
      if (outcome.ok) router.refresh()
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : 'Something went wrong.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={run} className={className} disabled={pending}>
        {pending ? (pendingLabel ?? 'Working…') : children}
      </button>
      {result && (
        <span
          className={clsx('text-xs', result.ok ? 'text-[var(--good-text)]' : 'text-[var(--critical)]')}
          role="status"
        >
          {result.message}
        </span>
      )}
    </span>
  )
}

/** A section that starts collapsed — used for "add new" forms. */
export function Disclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="btn">
        <span aria-hidden>{open ? '−' : '+'}</span> {label}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {/* Editable, so every form label in the app can be reworded. In normal
          use it renders as plain text — the affordance only appears in edit
          mode, so clicking a label still focuses its input. */}
      <label className="label">
        <Editable scope="field.label">{label}</Editable>
      </label>
      {children}
      {hint && (
        <Editable as="p" scope="field.hint" className="mt-1 block text-[0.6875rem] leading-snug text-[var(--ink-muted)]">
          {hint}
        </Editable>
      )}
    </div>
  )
}
