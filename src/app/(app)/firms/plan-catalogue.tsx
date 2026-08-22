'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Badge, Card, EmptyState, clsx } from '@/components/ui'
import type { ActionResult } from '@/server/actions'
import type { FirmCatalogue } from '@/lib/propfirm/catalogue'
import type { FirmPlan } from '@/db/schema'

const DRAWDOWN_LABELS: Record<FirmPlan['drawdownType'], string> = {
  trailing_intraday: 'Intraday trail',
  trailing_eod: 'End-of-day trail',
  static: 'Static',
  none: 'None',
}

/**
 * A colour per firm, assigned by position so a firm keeps the same one.
 *
 * Recognising the firm you want by its colour before you have read its name is
 * most of what makes a wall of cards navigable rather than a list to scan.
 */
const ACCENTS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--accent)',
]

function usd(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  })
}

function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`
}

function sizeLabel(size: number): string {
  return `$${Math.round(size / 1000)}K`
}

/**
 * The generator builds every label as `family [option] $Nk`, so stripping the
 * size leaves exactly the account type — no separate field to keep in sync.
 */
function familyOf(plan: FirmPlan): string {
  return plan.label.replace(/\s+\$[\d.]+k$/i, '')
}

type Family = { name: string; plans: FirmPlan[] }

function familiesOf(firm: FirmCatalogue): Family[] {
  const byName = new Map<string, FirmPlan[]>()
  for (const plan of firm.plans) {
    const name = familyOf(plan)
    byName.set(name, [...(byName.get(name) ?? []), plan])
  }
  return [...byName.entries()]
    .map(([name, plans]) => ({ name, plans: [...plans].sort((a, b) => a.size - b.size) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Splits a family's notes into the part every size shares and the part that
 * does not.
 *
 * Notes are built as ` · `-joined clauses, and within a family they agree for
 * most of their length — the rules belong to the account type, not the size.
 * Printing the whole string on four cards side by side is the wall of repeated
 * text this page exists to avoid, so the shared clauses are lifted out and
 * shown once, leaving each card only what is true of that size alone.
 */
function splitNotes(plans: FirmPlan[]): { shared: string | null; rest: Map<string, string> } {
  const parts = plans.map((plan) => (plan.notes ?? '').split(' · ').filter(Boolean))
  let common = 0
  while (parts.every((clauses) => clauses.length > common && clauses[common] === parts[0][common])) {
    common += 1
  }

  const rest = new Map<string, string>()
  plans.forEach((plan, index) => {
    const tail = parts[index].slice(common).join(' · ')
    if (tail) rest.set(plan.label, tail)
  })

  return { shared: common > 0 ? parts[0].slice(0, common).join(' · ') : null, rest }
}

/** The values a whole family shares, which is most of them. */
function sharedRules(plans: FirmPlan[]) {
  const same = <T,>(pick: (plan: FirmPlan) => T): T | null => {
    const first = pick(plans[0])
    return plans.every((plan) => pick(plan) === first) ? first : null
  }
  return {
    drawdownType: same((plan) => plan.drawdownType),
    consistencyPercent: same((plan) => plan.consistencyPercent),
    profitSplit: same((plan) => plan.profitSplit),
    payoutFrequency: same((plan) => plan.payoutFrequency),
    minPayout: same((plan) => plan.minPayout),
    minTradingDays: same((plan) => plan.minTradingDays),
    notes: same((plan) => plan.notes),
  }
}

/**
 * The plan catalogue, three levels deep: firms, then account types, then sizes.
 *
 * Eighty-nine plans laid out flat is a wall of numbers nobody reads — the rules
 * that matter repeat across every size of an account type, so showing them once
 * per type and only the size-specific figures below is both shorter and closer
 * to how the firms actually sell them.
 *
 * Search cuts across all three levels and jumps straight to matches, so the
 * drill-down never gets in the way of someone who already knows what they want.
 */
export function PlanCatalogue({
  catalogues,
  yours = {},
  panels = {},
  addAction,
}: {
  catalogues: FirmCatalogue[]
  /** Firms you hold a record with, by slug, valued by how many accounts. */
  yours?: Record<string, number>
  /**
   * Server-rendered editing panel per owned firm, shown once that firm is open.
   *
   * This is what keeps the page to a single list: the prices you paid and the
   * firm record itself live inside the firm they belong to, rather than in a
   * second list of the same firms above the first.
   */
  panels?: Record<string, ReactNode>
  addAction: (formData: FormData) => Promise<ActionResult>
}) {
  const [query, setQuery] = useState('')
  const [firmSlug, setFirmSlug] = useState<string | null>(null)
  const [familyName, setFamilyName] = useState<string | null>(null)
  const [picked, setPicked] = useState<{ slug: string; label: string } | null>(null)

  const searching = query.trim() !== ''
  const needle = query.trim().toLowerCase()

  // Your own firms sort to the front. Everything else keeps catalogue order, so
  // a firm never moves around underneath you for any other reason.
  const ordered = useMemo(
    () => [...catalogues].sort((a, b) => Number(b.slug in yours) - Number(a.slug in yours)),
    [catalogues, yours],
  )

  const matches = useMemo(() => {
    if (!searching) return []
    return ordered
      .map((firm) => ({
        firm,
        plans: firm.plans.filter((plan) =>
          `${firm.name} ${plan.label} ${sizeLabel(plan.size)}`.toLowerCase().includes(needle),
        ),
      }))
      .filter((entry) => entry.plans.length > 0)
  }, [ordered, needle, searching])

  const firm = firmSlug ? (catalogues.find((entry) => entry.slug === firmSlug) ?? null) : null
  const families = firm ? familiesOf(firm) : []
  const family = familyName ? (families.find((entry) => entry.name === familyName) ?? null) : null

  const pickedFirm = picked ? catalogues.find((entry) => entry.slug === picked.slug) : undefined
  const pickedPlan = pickedFirm?.plans.find((plan) => plan.label === picked?.label)

  const accentFor = (slug: string) =>
    ACCENTS[Math.max(0, catalogues.findIndex((entry) => entry.slug === slug)) % ACCENTS.length]

  const open = (slug: string, label: string) => setPicked({ slug, label })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search every plan — “apex 100”, “rapid”, “50K”…"
            className="input w-full pl-9"
            aria-label="Search plans"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-[var(--ink-muted)]"
          >
            ⌕
          </span>
        </div>
        {!searching && (firm || family) && (
          <Breadcrumb
            firm={firm}
            family={family}
            accent={firm ? accentFor(firm.slug) : undefined}
            onHome={() => {
              setFirmSlug(null)
              setFamilyName(null)
            }}
            onFirm={() => setFamilyName(null)}
          />
        )}
      </div>

      {picked && pickedPlan && pickedFirm && (
        <Card
          title={`Add ${pickedFirm.name} ${pickedPlan.label}`}
          description="Every rule below is copied onto the account. You can change any of them afterwards — an account is allowed to differ from the plan it came from."
          actions={
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Cancel
            </button>
          }
        >
          <AddForm
            slug={picked.slug}
            plan={pickedPlan}
            firmName={pickedFirm.name}
            action={addAction}
            onDone={() => setPicked(null)}
          />
        </Card>
      )}

      {searching ? (
        <SearchResults
          matches={matches}
          accentFor={accentFor}
          onPick={open}
          onClear={() => setQuery('')}
        />
      ) : family && firm ? (
        <SizeGrid firm={firm} family={family} accent={accentFor(firm.slug)} onPick={open} />
      ) : firm ? (
        <div className="space-y-4">
          {panels[firm.slug]}
          <FamilyGrid
            families={families}
            accent={accentFor(firm.slug)}
            onOpen={(name) => setFamilyName(name)}
          />
        </div>
      ) : (
        <FirmGrid
          catalogues={ordered}
          yours={yours}
          accentFor={accentFor}
          onOpen={(slug) => {
            setFirmSlug(slug)
            setFamilyName(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Level 1 — firms

function FirmGrid({
  catalogues,
  yours,
  accentFor,
  onOpen,
}: {
  catalogues: FirmCatalogue[]
  yours: Record<string, number>
  accentFor: (slug: string) => string
  onOpen: (slug: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {catalogues.map((firm) => {
        const accent = accentFor(firm.slug)
        const families = familiesOf(firm)
        const sizes = [...new Set(firm.plans.map((plan) => plan.size))].sort((a, b) => a - b)
        const splits = firm.plans
          .map((plan) => plan.profitSplit)
          .filter((split): split is number => split !== null && split !== undefined)
        const bestSplit = splits.length ? Math.max(...splits) : null

        return (
          <button
            key={firm.slug}
            type="button"
            onClick={() => onOpen(firm.slug)}
            className="group card relative overflow-hidden p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: accent }}
            />
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-semibold text-white"
                style={{ background: accent }}
              >
                {firm.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
                  {firm.name}
                </p>
                <p className="truncate text-[0.6875rem] text-[var(--ink-muted)]">
                  {firm.website.replace(/^https?:\/\//, '') || 'No website saved'}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {firm.slug in yours && (
                <Bubble tone={accent}>
                  {yours[firm.slug] > 0
                    ? `Yours · ${yours[firm.slug]} account${yours[firm.slug] === 1 ? '' : 's'}`
                    : 'Yours · no accounts'}
                </Bubble>
              )}
              {firm.plans.length === 0 ? (
                <Bubble>No plans yet</Bubble>
              ) : (
                <>
                  <Bubble>{families.length} account types</Bubble>
                  <Bubble>{firm.plans.length} plans</Bubble>
                  {bestSplit !== null && <Bubble tone={accent}>up to {pct(bestSplit)}</Bubble>}
                </>
              )}
            </div>

            <p className="mt-3 text-[0.6875rem] text-[var(--ink-secondary)]">
              {sizes.map(sizeLabel).join(' · ')}
            </p>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Level 2 — account types

function FamilyGrid({
  families,
  accent,
  onOpen,
}: {
  families: Family[]
  accent: string
  onOpen: (name: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {families.map((family) => {
        const shared = sharedRules(family.plans)
        const prices = family.plans
          .map((plan) => plan.cost)
          .filter((cost): cost is number => cost !== null && cost !== undefined)

        return (
          <button
            key={family.name}
            type="button"
            onClick={() => onOpen(family.name)}
            className="group card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
                  {family.name}
                </p>
                <p className="mt-0.5 text-[0.6875rem] text-[var(--ink-muted)]">
                  {family.plans.length} size{family.plans.length === 1 ? '' : 's'}
                  {prices.length > 0 && ` · from ${usd(Math.min(...prices), 2)}`}
                </p>
              </div>
              <span
                aria-hidden
                className="text-lg text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
              >
                ›
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {family.plans.map((plan) => (
                <Bubble key={plan.label}>{sizeLabel(plan.size)}</Bubble>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {shared.drawdownType && (
                <Bubble tone={accent}>{DRAWDOWN_LABELS[shared.drawdownType]}</Bubble>
              )}
              {shared.profitSplit != null && <Bubble tone={accent}>{pct(shared.profitSplit)} split</Bubble>}
              {shared.consistencyPercent != null && (
                <Bubble>{pct(shared.consistencyPercent)} consistency</Bubble>
              )}
              {shared.payoutFrequency && <Bubble>Payouts: {shared.payoutFrequency}</Bubble>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Level 3 — sizes and prices

function SizeGrid({
  firm,
  family,
  accent,
  onPick,
}: {
  firm: FirmCatalogue
  family: Family
  accent: string
  onPick: (slug: string, label: string) => void
}) {
  const { shared: sharedNote, rest } = splitNotes(family.plans)

  return (
    <div className="space-y-3">
      {sharedNote && (
        <Card>
          <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">{sharedNote}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {family.plans.map((plan) => (
          <article key={plan.label} className="card flex flex-col p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-semibold tracking-tight text-[var(--ink)]">
                {sizeLabel(plan.size)}
              </span>
              <span className="tabular text-sm font-semibold" style={{ color: accent }}>
                {plan.cost == null ? '—' : usd(plan.cost, 2)}
              </span>
            </div>

            <dl className="mt-3 space-y-1.5 text-xs">
              <Row label="Profit target" value={usd(plan.profitTarget)} />
              <Row label="Max loss" value={usd(plan.maxDrawdown)} />
              <Row label="Daily loss" value={usd(plan.dailyLossLimit)} />
              <Row
                label="Contracts"
                value={
                  plan.maxContracts == null
                    ? '—'
                    : `${plan.maxContracts}${plan.maxMicroContracts ? ` / ${plan.maxMicroContracts} micro` : ''}`
                }
              />
              <Row label="Buffer" value={usd(plan.buffer)} />
              {plan.minPayout && <Row label="Min payout" value={plan.minPayout} />}
              {plan.activationFee ? (
                <Row label="Activation" value={usd(plan.activationFee, 2)} />
              ) : null}
              {plan.resetFee ? <Row label="Reset" value={usd(plan.resetFee, 2)} /> : null}
            </dl>

            {rest.get(plan.label) && (
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-[var(--ink-muted)]">
                {rest.get(plan.label)}
              </p>
            )}

            <button
              type="button"
              onClick={() => onPick(firm.slug, plan.label)}
              className="btn mt-3 w-full justify-center"
            >
              Add as account
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[var(--ink-muted)]">{label}</dt>
      <dd className="tabular font-medium text-[var(--ink-secondary)]">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search — flat, because someone searching has already decided

function SearchResults({
  matches,
  accentFor,
  onPick,
  onClear,
}: {
  matches: { firm: FirmCatalogue; plans: FirmPlan[] }[]
  accentFor: (slug: string) => string
  onPick: (slug: string, label: string) => void
  onClear: () => void
}) {
  const total = matches.reduce((sum, entry) => sum + entry.plans.length, 0)

  if (total === 0) {
    return (
      <Card>
        <EmptyState
          title="Nothing matches"
          body="No plan in the catalogue matches that search. Try the firm name, or a size like “50K”."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--ink-muted)]">
        {total} plan{total === 1 ? '' : 's'} match ·{' '}
        <button type="button" onClick={onClear} className="text-[var(--accent)] hover:underline">
          clear
        </button>
      </p>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {matches.flatMap(({ firm, plans }) =>
          plans.map((plan) => (
            <button
              key={`${firm.slug}-${plan.label}`}
              type="button"
              onClick={() => onPick(firm.slug, plan.label)}
              className="card flex items-center gap-3 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                aria-hidden
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ background: accentFor(firm.slug) }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-[var(--ink)]">
                  {plan.label}
                </span>
                <span className="block truncate text-[0.6875rem] text-[var(--ink-muted)]">
                  {firm.name} · {usd(plan.maxDrawdown)} max loss · {pct(plan.profitSplit)} split
                </span>
              </span>
              <span className="tabular shrink-0 text-xs font-semibold text-[var(--ink-secondary)]">
                {plan.cost == null ? '' : usd(plan.cost, 0)}
              </span>
            </button>
          )),
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Breadcrumb({
  firm,
  family,
  accent,
  onHome,
  onFirm,
}: {
  firm: FirmCatalogue | null
  family: Family | null
  accent?: string
  onHome: () => void
  onFirm: () => void
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="Catalogue">
      <button type="button" onClick={onHome} className="text-[var(--accent)] hover:underline">
        All firms
      </button>
      {firm && (
        <>
          <span aria-hidden className="text-[var(--ink-muted)]">
            ›
          </span>
          {family ? (
            <button type="button" onClick={onFirm} className="text-[var(--accent)] hover:underline">
              {firm.name}
            </button>
          ) : (
            <span className="font-medium text-[var(--ink)]">{firm.name}</span>
          )}
        </>
      )}
      {family && (
        <>
          <span aria-hidden className="text-[var(--ink-muted)]">
            ›
          </span>
          <span
            className="rounded-full px-2 py-0.5 font-medium text-white"
            style={{ background: accent }}
          >
            {family.name}
          </span>
        </>
      )}
    </nav>
  )
}

function Bubble({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap',
        tone
          ? 'border-transparent text-white'
          : 'border-[var(--line)] bg-[var(--surface-sunken)] text-[var(--ink-secondary)]',
      )}
      style={tone ? { background: tone } : undefined}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------

function AddForm({
  slug,
  plan,
  firmName,
  action,
  onDone,
}: {
  slug: string
  plan: FirmPlan
  firmName: string
  action: (formData: FormData) => Promise<ActionResult>
  onDone: () => void
}) {
  const [phase, setPhase] = useState('eval')
  const [known, setKnown] = useState(false)

  return (
    <ActionForm
      action={async (formData) => {
        const result = await action(formData)
        if (result.ok) onDone()
        return result
      }}
      className="space-y-3"
    >
      <input type="hidden" name="firmSlug" value={slug} />
      <input type="hidden" name="planLabel" value={plan.label} />

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="accent">{sizeLabel(plan.size)}</Badge>
        {plan.maxDrawdown != null && <Badge>{usd(plan.maxDrawdown)} max loss</Badge>}
        {phase === 'eval' && plan.profitTarget != null && (
          <Badge>{usd(plan.profitTarget)} target</Badge>
        )}
        {plan.profitSplit != null && <Badge>{pct(plan.profitSplit)} split</Badge>}
        {plan.buffer != null && <Badge>{usd(plan.buffer)} buffer</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Label" hint="How you refer to it">
          <input name="label" className="input" required defaultValue={`${firmName} ${plan.label}`} />
        </Field>
        <Field label="Stage" hint="A funded account carries no profit target">
          <select
            name="phase"
            className="select"
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          >
            <option value="eval">Evaluation</option>
            <option value="funded">Funded</option>
            <option value="live">Live</option>
            <option value="demo">Demo</option>
          </select>
        </Field>
        <Field label="Broker account id" hint="How synced fills find this account">
          <input name="externalId" className="input" />
        </Field>
        <Field label="Data source">
          <select name="platform" className="select" defaultValue="tradovate">
            <option value="tradovate">Tradovate</option>
            <option value="rithmic">Rithmic</option>
            <option value="projectx">ProjectX</option>
            <option value="manual">Manual</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Started on">
          <input name="startedOn" type="date" className="input" />
        </Field>
        <Field
          label="What it cost"
          hint={
            plan.cost != null
              ? `Blank uses the plan's ${usd(plan.cost, 2)}`
              : 'Evaluation fee, resets, activation'
          }
        >
          <input name="costBase" type="number" step="any" className="input" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
        <input type="checkbox" checked={known} onChange={(event) => setKnown(event.target.checked)} />
        This account is already running — I know its current balance
      </label>

      {known && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Balance now" hint="What the account is worth today">
            <input name="openingBalance" type="number" step="any" className="input" required />
          </Field>
          <Field
            label="…at the close of"
            hint="Trades before this day are treated as already inside that balance; everything after it moves it"
          >
            <input name="openingBalanceAt" type="date" className="input" required />
          </Field>
        </div>
      )}

      <SubmitButton>Add account</SubmitButton>
    </ActionForm>
  )
}
