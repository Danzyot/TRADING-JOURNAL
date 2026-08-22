'use client'

import { useMemo, useState } from 'react'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Badge, Card, EmptyState, clsx } from '@/components/ui'
import type { ActionResult } from '@/server/actions'
import type { FirmCatalogue } from '@/lib/propfirm/catalogue'
import type { FirmPlan } from '@/db/schema'

const DRAWDOWN_LABELS: Record<FirmPlan['drawdownType'], string> = {
  trailing_intraday: 'Trailing — intraday',
  trailing_eod: 'Trailing — end of day',
  static: 'Static',
  none: 'None',
}

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

/**
 * Every plan every firm sells, and one click from any of them to an account.
 *
 * The catalogue is the reference half of this app — eighty-five plans whose
 * rules the trader otherwise has to hold in their head or go and re-read on
 * eight different websites. Showing them is only half the value; the other
 * half is that a plan already knows the eighteen numbers the account form asks
 * for, so picking one fills them all in.
 *
 * Searching happens here rather than on the server: the whole catalogue is a
 * few kilobytes, so a round trip per keystroke would be slower and would lose
 * the open form.
 */
export function PlanCatalogue({
  catalogues,
  addAction,
  compact = false,
}: {
  catalogues: FirmCatalogue[]
  addAction: (formData: FormData) => Promise<ActionResult>
  /** Picker mode: skip the reference tables and go straight to choosing. */
  compact?: boolean
}) {
  const [query, setQuery] = useState('')
  const [firm, setFirm] = useState<string>('')
  const [picked, setPicked] = useState<{ slug: string; label: string } | null>(null)

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return catalogues
      .filter((entry) => firm === '' || entry.slug === firm)
      .map((entry) => ({
        ...entry,
        plans: entry.plans.filter((plan) => {
          if (needle === '') return true
          // Matching the firm name too means "apex 100" works, which is how
          // someone actually looks for a plan they already have in mind.
          return `${entry.name} ${plan.label}`.toLowerCase().includes(needle)
        }),
      }))
      .filter((entry) => entry.plans.length > 0)
  }, [catalogues, firm, query])

  const total = results.reduce((sum, entry) => sum + entry.plans.length, 0)
  const pickedPlan = picked
    ? catalogues
        .find((entry) => entry.slug === picked.slug)
        ?.plans.find((plan) => plan.label === picked.label)
    : undefined
  const pickedFirm = picked ? catalogues.find((entry) => entry.slug === picked.slug) : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search plans — “apex 100”, “rapid”, “builder”…"
          className="input max-w-xs"
          aria-label="Search plans"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={firm === ''} onClick={() => setFirm('')} label="All firms" />
          {catalogues.map((entry) => (
            <FilterChip
              key={entry.slug}
              active={firm === entry.slug}
              onClick={() => setFirm(entry.slug)}
              label={entry.name}
            />
          ))}
        </div>
        <span className="ml-auto text-xs text-[var(--ink-muted)]">
          {total} plan{total === 1 ? '' : 's'}
        </span>
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

      {total === 0 ? (
        <Card>
          <EmptyState
            title="Nothing matches"
            body="No plan in the catalogue matches that search. Try the firm name, or a size like “50k”."
          />
        </Card>
      ) : (
        results.map((entry) => (
          <Card
            key={entry.slug}
            title={entry.name}
            description={entry.website}
            bodyClassName="p-0"
          >
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th className="text-right">Size</th>
                    <th className="text-right">Target</th>
                    <th className="text-right">Max loss</th>
                    <th>Drawdown</th>
                    <th className="text-right">Daily loss</th>
                    <th className="text-right">Contracts</th>
                    <th className="text-right">Consistency</th>
                    <th className="text-right">Buffer</th>
                    <th className="text-right">Split</th>
                    {!compact && <th className="text-right">Cost</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {entry.plans.map((plan) => (
                    <PlanRow
                      key={plan.label}
                      plan={plan}
                      compact={compact}
                      onPick={() => setPicked({ slug: entry.slug, label: plan.label })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

function PlanRow({
  plan,
  compact,
  onPick,
}: {
  plan: FirmPlan
  compact: boolean
  onPick: () => void
}) {
  const [open, setOpen] = useState(false)
  // Columns before the notes row, so the detail spans the full width whatever
  // mode the table is in.
  const span = compact ? 11 : 12

  return (
    <>
      <tr>
        <td className="font-medium text-[var(--ink)]">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-left hover:text-[var(--accent)]"
            title={plan.notes ? 'Show the rules that are not numbers' : undefined}
          >
            {plan.label}
            {plan.notes && <span className="ml-1 text-[var(--ink-muted)]">{open ? '−' : '+'}</span>}
          </button>
        </td>
        <td className="tabular text-right">{usd(plan.size)}</td>
        <td className="tabular text-right">{usd(plan.profitTarget)}</td>
        <td className="tabular text-right">{usd(plan.maxDrawdown)}</td>
        <td className="whitespace-nowrap text-xs">{DRAWDOWN_LABELS[plan.drawdownType]}</td>
        <td className="tabular text-right">{usd(plan.dailyLossLimit)}</td>
        <td className="tabular whitespace-nowrap text-right">
          {plan.maxContracts == null
            ? '—'
            : `${plan.maxContracts}${plan.maxMicroContracts ? ` / ${plan.maxMicroContracts}` : ''}`}
        </td>
        <td className="tabular text-right">{pct(plan.consistencyPercent)}</td>
        <td className="tabular text-right">{usd(plan.buffer)}</td>
        <td className="tabular text-right">{pct(plan.profitSplit)}</td>
        {!compact && <td className="tabular text-right">{usd(plan.cost, 2)}</td>}
        <td className="text-right">
          <button type="button" onClick={onPick} className="btn px-2 py-1 text-xs">
            Add
          </button>
        </td>
      </tr>
      {open && plan.notes && (
        <tr>
          <td colSpan={span} className="bg-[var(--surface-sunken)] text-xs leading-relaxed">
            <div className="space-y-1 px-1 py-1.5">
              <p className="text-[var(--ink-secondary)]">{plan.notes}</p>
              <p className="text-[var(--ink-muted)]">
                {[
                  plan.payoutFrequency ? `Payouts: ${plan.payoutFrequency}` : null,
                  plan.minPayout ? `Minimum payout: ${plan.minPayout}` : null,
                  plan.minTradingDays ? `Minimum ${plan.minTradingDays} trading days` : null,
                  plan.minWinningDays ? `${plan.minWinningDays} winning days required` : null,
                  plan.activationFee ? `Activation fee: ${usd(plan.activationFee, 2)}` : null,
                  plan.resetFee ? `Reset fee: ${usd(plan.resetFee, 2)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No extra rules recorded.'}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

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
        <Badge tone="accent">{usd(plan.size)}</Badge>
        {plan.maxDrawdown != null && <Badge>{usd(plan.maxDrawdown)} max loss</Badge>}
        {phase === 'eval' && plan.profitTarget != null && (
          <Badge>{usd(plan.profitTarget)} target</Badge>
        )}
        {plan.profitSplit != null && <Badge>{pct(plan.profitSplit)} split</Badge>}
        {plan.buffer != null && <Badge>{usd(plan.buffer)} buffer</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Label" hint="How you refer to it">
          <input
            name="label"
            className="input"
            required
            defaultValue={`${firmName} ${plan.label}`}
          />
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
        <Field label="What it cost" hint={plan.cost != null ? `Blank uses the plan's ${usd(plan.cost, 2)}` : 'Evaluation fee, resets, activation'}>
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

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-transparent bg-[var(--accent)] font-medium text-white'
          : 'border-[var(--line)] text-[var(--ink-secondary)] hover:border-[var(--line-strong)]',
      )}
    >
      {label}
    </button>
  )
}
