'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionResult } from '@/server/actions'
import { clsx } from './ui'

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
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) formRef.current?.reset()
      onSuccess?.()
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
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)

  async function run() {
    if (confirm && !window.confirm(confirm)) return
    setPending(true)
    setResult(null)
    try {
      setResult(await action())
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
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[0.6875rem] leading-snug text-[var(--ink-muted)]">{hint}</p>}
    </div>
  )
}
