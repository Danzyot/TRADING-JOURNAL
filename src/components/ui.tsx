import Link from 'next/link'
import { moneyCompact, percent, pnlClass, signed } from '@/lib/format'
import { Editable } from './site-text'

export function clsx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

/**
 * Every page's title and standfirst — and, because both go through `Editable`,
 * every page's title and standfirst can be rewritten by the person using it.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <Editable as="h1" scope="page.title" className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
          {title}
        </Editable>
        {subtitle && (
          <Editable as="p" scope="page.subtitle" className="mt-1 block max-w-2xl text-sm text-[var(--ink-secondary)]">
            {subtitle}
          </Editable>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={clsx('card overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            {title && (
              <Editable as="h2" scope="card.title" className="text-sm font-semibold text-[var(--ink)]">
                {title}
              </Editable>
            )}
            {description && (
              <Editable as="p" scope="card.description" className="mt-0.5 block text-xs text-[var(--ink-secondary)]">
                {description}
              </Editable>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName ?? 'p-4'}>{children}</div>
    </section>
  )
}

/**
 * A card that folds away behind its own heading.
 *
 * Reference material earns its place on a page but not the whole page: the tax
 * screen carries six long sections that are read once and then scrolled past
 * every day afterwards. Folded, the numbers are visible without scrolling and
 * the prose is one click away.
 *
 * `<details>` rather than React state, so it works before hydration, keeps the
 * open/closed state out of the component tree, and stays keyboard-operable
 * without any of that being written here.
 */
export function CollapsibleCard({
  title,
  description,
  summary,
  defaultOpen = false,
  children,
  className,
  bodyClassName,
}: {
  title: string
  description?: string
  /**
   * The one figure this section is about, shown on the closed header.
   *
   * A folded card is a promise with nothing behind it until you open it. A
   * heading that reads "R distribution · avg 1.4R" answers the question most
   * of the time, and tells you whether opening it is worth the click.
   */
  summary?: React.ReactNode
  /** Sections worth reading every time start open. */
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <details
      // `self-start` because a folded card sitting in a grid row would
      // otherwise stretch to the height of whatever is beside it, leaving a
      // tall empty box under its own heading.
      className={clsx('card card-fold self-start overflow-hidden', className)}
      open={defaultOpen}
    >
      <summary className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <Editable as="h2" scope="card.title" className="text-sm font-semibold text-[var(--ink)]">
            {title}
          </Editable>
          {description && (
            <Editable
              as="p"
              scope="card.description"
              className="mt-0.5 block text-xs text-[var(--ink-secondary)]"
            >
              {description}
            </Editable>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-2.5">
          {summary !== undefined && summary !== null && (
            <span className="tabular text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)]">
              {summary}
            </span>
          )}
          <span aria-hidden className="fold-chevron text-lg leading-none text-[var(--ink-muted)]">
            ›
          </span>
        </span>
      </summary>
      {/* The divider lives on the body, so a closed card is not left with a
          line under its heading and nothing beneath it. */}
      <div className={clsx('border-t border-[var(--line)]', bodyClassName ?? 'p-4')}>{children}</div>
    </details>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Editable as="p" scope="empty.title" className="text-sm font-medium text-[var(--ink)]">
        {title}
      </Editable>
      <Editable as="p" scope="empty.body" className="block max-w-md text-sm text-[var(--ink-secondary)]">
        {body}
      </Editable>
      {action && (
        <Link href={action.href} className="btn btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * A single figure with its label.
 *
 * `tone="pnl"` colours by sign — always alongside an explicit +/- so the meaning
 * never rests on colour alone.
 */
export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  size = 'md',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'pnl' | 'good' | 'warn' | 'critical'
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  const toneClass =
    tone === 'pnl'
      ? pnlClass(value.startsWith('-') ? -1 : value.startsWith('+') ? 1 : 0)
      : tone === 'good'
        ? 'text-[var(--good-text)]'
        : tone === 'warn'
          ? 'text-[var(--serious)]'
          : tone === 'critical'
            ? 'text-[var(--critical)]'
            : 'text-[var(--ink)]'

  return (
    <div>
      <Editable
        as="p"
        scope="stat.label"
        className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--ink-muted)]"
      >
        {label}
      </Editable>
      <p className={clsx('mt-1 font-semibold tabular', sizeClass, toneClass)}>{value}</p>
      {hint && (
        <Editable as="p" scope="stat.hint" className="mt-0.5 block text-xs text-[var(--ink-secondary)]">
          {hint}
        </Editable>
      )}
    </div>
  )
}

export function StatGrid({ children, columns = 4 }: { children: React.ReactNode; columns?: number }) {
  const template =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : columns === 5
          ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
          : 'sm:grid-cols-2 lg:grid-cols-4'
  return <div className={clsx('grid grid-cols-1 gap-4', template)}>{children}</div>
}

export function Pnl({ value, currency = 'USD' }: { value: number | null | undefined; currency?: string }) {
  return <span className={clsx('tabular font-medium', pnlClass(value))}>{signed(value, currency)}</span>
}

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'critical' | 'accent'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--surface-sunken)] text-[var(--ink-secondary)] border-[var(--line)]',
    good: 'bg-[color-mix(in_srgb,var(--good)_14%,transparent)] text-[var(--good-text)] border-[color-mix(in_srgb,var(--good)_30%,transparent)]',
    warn: 'bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--serious)] border-[color-mix(in_srgb,var(--warning)_35%,transparent)]',
    critical:
      'bg-[color-mix(in_srgb,var(--critical)_14%,transparent)] text-[var(--critical)] border-[color-mix(in_srgb,var(--critical)_32%,transparent)]',
    accent:
      'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_srgb,var(--accent)_30%,transparent)]',
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

/**
 * Severity icon.
 *
 * Status colour is never the only signal — the glyph carries the same meaning
 * for anyone who cannot separate the hues, and in print.
 */
export function SeverityIcon({ severity }: { severity: 'info' | 'good' | 'warn' | 'critical' }) {
  const map = {
    info: { glyph: 'i', color: 'var(--accent)' },
    good: { glyph: '✓', color: 'var(--good)' },
    warn: { glyph: '!', color: 'var(--warning)' },
    critical: { glyph: '!', color: 'var(--critical)' },
  }[severity]

  return (
    <span
      aria-hidden
      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold"
      style={{ background: `color-mix(in srgb, ${map.color} 18%, transparent)`, color: map.color }}
    >
      {map.glyph}
    </span>
  )
}

/** Horizontal progress meter with the value written beside it. */
export function Meter({
  value,
  tone = 'accent',
  label,
}: {
  value: number
  tone?: 'accent' | 'good' | 'warn' | 'critical'
  label?: string
}) {
  const width = Math.max(0, Math.min(1, value)) * 100
  const color =
    tone === 'good'
      ? 'var(--good)'
      : tone === 'warn'
        ? 'var(--warning)'
        : tone === 'critical'
          ? 'var(--critical)'
          : 'var(--accent)'

  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: color }} />
      </div>
      {label && (
        <Editable as="p" scope="meter.label" className="mt-1 block text-xs text-[var(--ink-secondary)]">
          {label}
        </Editable>
      )}
    </div>
  )
}

/**
 * A ranked bar row — the workhorse for "which symbol / session / setup".
 * The value is always written out, which is also the relief the light-mode
 * contrast warning requires.
 */
export function BarRow({
  label,
  value,
  max,
  currency = 'USD',
  sublabel,
}: {
  label: string
  value: number
  max: number
  currency?: string
  sublabel?: string
}) {
  const magnitude = max > 0 ? Math.min(1, Math.abs(value) / max) : 0
  const positive = value >= 0

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 truncate text-xs text-[var(--ink-secondary)]" title={label}>
        {label}
      </div>
      <div className="flex h-4 flex-1 items-center">
        <div className="flex h-full w-1/2 justify-end">
          {!positive && (
            <div
              className="h-2.5 self-center rounded-l"
              style={{ width: `${magnitude * 100}%`, background: 'var(--critical)' }}
            />
          )}
        </div>
        <div className="h-full w-px bg-[var(--line-strong)]" />
        <div className="flex h-full w-1/2">
          {positive && (
            <div
              className="h-2.5 self-center rounded-r"
              style={{ width: `${magnitude * 100}%`, background: 'var(--good)' }}
            />
          )}
        </div>
      </div>
      <div className="w-24 shrink-0 text-right">
        <span className={clsx('tabular text-xs font-medium', pnlClass(value))}>{signed(value, currency, 0)}</span>
        {sublabel && <p className="text-[0.6875rem] text-[var(--ink-muted)]">{sublabel}</p>}
      </div>
    </div>
  )
}

export function KeyValue({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2 last:border-b-0">
      <div>
        <Editable scope="keyvalue.label" className="text-xs text-[var(--ink-secondary)]">
          {label}
        </Editable>
        {hint && (
          <Editable as="p" scope="keyvalue.hint" className="block text-[0.6875rem] text-[var(--ink-muted)]">
            {hint}
          </Editable>
        )}
      </div>
      <span className="tabular text-sm font-medium text-[var(--ink)]">{value}</span>
    </div>
  )
}

export { moneyCompact, percent, signed }
