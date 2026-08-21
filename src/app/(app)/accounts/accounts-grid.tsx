'use client'

/**
 * The accounts table — the page's centrepiece.
 *
 * Modelled on the copier-platform pattern the user actually works in all day:
 * a dense row per account, an Edit toggle that turns the visible rows into an
 * inline-editable grid with an Apply-to-All header, and one Save. At sixty-plus
 * accounts, a card per account is unusable and a form per edit is worse; a grid
 * with bulk apply is the only shape that keeps up with buying five evaluations
 * in an afternoon.
 *
 * The "catalogue" select applies a firm's plan template to the row — size,
 * drawdown, consistency, target, cost in one pick. Values are copied, never
 * referenced, so editing a plan later cannot silently rewrite an account.
 */

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { FirmPlan } from '@/db/schema'
import type { ActionResult } from '@/server/actions'
import { money, moneyCompact, titleCase } from '@/lib/format'
import { clsx } from '@/components/ui'

export type GridFirm = {
  id: number
  name: string
  plans: FirmPlan[]
}

export type GridRow = {
  id: number
  label: string
  platform: string
  firmId: number | null
  planLabel: string | null
  phase: string
  status: string
  size: number
  maxDrawdown: number | null
  drawdownType: string
  /** Whole percent, 0..100, or null. */
  consistencyPct: number | null
  profitTarget: number | null
  costBase: number
  equity: number
  netPnl: number
  /** Equity at which the account is breached; null when no drawdown is set. */
  line: number | null
  roomPct: number | null
  /** Evaluation: dollars still needed to hit the target. */
  toTarget: number | null
  /** Best day as a share of profit, whole percent, when measurable. */
  bestDayPct: number | null
  payout: { state: 'eligible' | 'blocked'; text: string } | null
  /** Size, drawdown or target missing — progress cannot be tracked yet. */
  needsSetup: boolean
}

type Edits = {
  firmId: string
  planLabel: string | null
  phase: string
  size: string
  drawdownType: string
  maxDrawdown: string
  consistencyPct: string
  profitTarget: string
  costBase: string
}

const DD_LABELS: Record<string, string> = {
  trailing_intraday: 'Intraday trail',
  trailing_eod: 'EOD trail',
  static: 'Static',
  none: 'None',
}

function toEdits(row: GridRow): Edits {
  return {
    firmId: row.firmId === null ? '' : String(row.firmId),
    planLabel: row.planLabel,
    phase: row.phase,
    size: String(row.size),
    drawdownType: row.drawdownType,
    maxDrawdown: row.maxDrawdown === null ? '' : String(row.maxDrawdown),
    consistencyPct: row.consistencyPct === null ? '' : String(row.consistencyPct),
    profitTarget: row.profitTarget === null ? '' : String(row.profitTarget),
    costBase: String(row.costBase),
  }
}

function applyPlan(edits: Edits, plan: FirmPlan): Edits {
  return {
    ...edits,
    planLabel: plan.label,
    phase: plan.phase,
    size: String(plan.size),
    drawdownType: plan.drawdownType,
    maxDrawdown: plan.maxDrawdown === null ? edits.maxDrawdown : String(plan.maxDrawdown),
    consistencyPct:
      plan.consistencyPercent === null ? '' : String(Math.round(plan.consistencyPercent * 100)),
    profitTarget: plan.profitTarget === null ? '' : String(plan.profitTarget),
    costBase: plan.cost === null ? edits.costBase : String(plan.cost),
  }
}

const num = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The state chips over the table — the copier platform's filter popover, but
 * inline and honest: every chip shows its count so a zero is visible, not a
 * dead end you discover after clicking.
 */
type StateKey = 'active' | 'nearBust' | 'payoutReady' | 'netLoss' | 'eval' | 'funded'

const STATE_FILTERS: { key: StateKey; label: string; match: (row: GridRow) => boolean }[] = [
  { key: 'active', label: 'Active', match: (row) => row.status === 'active' },
  {
    key: 'nearBust',
    label: 'Near bust',
    match: (row) => row.status === 'active' && row.roomPct !== null && row.roomPct < 0.25,
  },
  { key: 'payoutReady', label: 'Payout-ready', match: (row) => row.payout?.state === 'eligible' },
  { key: 'netLoss', label: 'Net loss', match: (row) => row.equity < row.size },
  { key: 'eval', label: 'Evaluation', match: (row) => row.phase === 'eval' },
  { key: 'funded', label: 'Funded', match: (row) => row.phase === 'funded' || row.phase === 'live' },
]

export function AccountsGrid({
  rows,
  firms,
  ccy,
  bulkAction,
  deleteAction,
}: {
  rows: GridRow[]
  firms: GridFirm[]
  ccy: string
  bulkAction: (rows: unknown) => Promise<ActionResult>
  deleteAction: (id: number) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [view, setView] = useState<'table' | 'cards'>('table')
  // On a phone the dense table only works with sideways scrolling; cards are
  // the native fit. Applied after mount so server and client render the same.
  useEffect(() => {
    if (window.innerWidth < 768) setView('cards')
  }, [])
  const [stateFilter, setStateFilter] = useState<StateKey | ''>('')
  const [edits, setEdits] = useState<Record<number, Edits>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // The Apply-to-All header row's staged values. Empty string = leave as is.
  const [apply, setApply] = useState({
    firmId: '',
    planLabel: '',
    phase: '',
    size: '',
    drawdownType: '',
    maxDrawdown: '',
    consistencyPct: '',
  })

  const firmById = useMemo(() => new Map(firms.map((firm) => [firm.id, firm])), [firms])
  const changedCount = Object.keys(edits).length

  const activeFilter = STATE_FILTERS.find((filter) => filter.key === stateFilter)
  const visible = activeFilter ? rows.filter(activeFilter.match) : rows

  const current = (row: GridRow): Edits => edits[row.id] ?? toEdits(row)

  function setField(row: GridRow, patch: Partial<Edits>) {
    setEdits((previous) => ({ ...previous, [row.id]: { ...current(row), ...patch } }))
  }

  function pickPlan(row: GridRow, planLabel: string) {
    const base = current(row)
    if (!planLabel) {
      setField(row, { planLabel: null })
      return
    }
    const firm = firmById.get(Number(base.firmId))
    const plan = firm?.plans.find((entry) => entry.label === planLabel)
    if (plan) setEdits((previous) => ({ ...previous, [row.id]: applyPlan(base, plan) }))
  }

  function applyToRows() {
    const targets = rows.filter((row) => selected.size === 0 || selected.has(row.id))
    const applyFirm = apply.firmId ? firmById.get(Number(apply.firmId)) : null
    const applyPlanEntry = applyFirm?.plans.find((entry) => entry.label === apply.planLabel) ?? null

    setEdits((previous) => {
      const next = { ...previous }
      for (const row of targets) {
        let value = next[row.id] ?? toEdits(row)
        if (apply.firmId) value = { ...value, firmId: apply.firmId }
        if (applyPlanEntry) value = applyPlan(value, applyPlanEntry)
        if (apply.phase) value = { ...value, phase: apply.phase }
        if (apply.size) value = { ...value, size: apply.size }
        if (apply.drawdownType) value = { ...value, drawdownType: apply.drawdownType }
        if (apply.maxDrawdown) value = { ...value, maxDrawdown: apply.maxDrawdown }
        if (apply.consistencyPct) value = { ...value, consistencyPct: apply.consistencyPct }
        next[row.id] = value
      }
      return next
    })
  }

  function save() {
    const payload = Object.entries(edits).map(([id, value]) => ({
      id: Number(id),
      firmId: value.firmId === '' ? null : Number(value.firmId),
      planLabel: value.planLabel,
      phase: value.phase,
      startingBalance: num(value.size) ?? 0,
      drawdownType: value.drawdownType,
      maxDrawdown: num(value.maxDrawdown),
      consistencyPct: undefined, // never sent; kept explicit below
      consistencyPercent: num(value.consistencyPct),
      profitTarget: num(value.profitTarget),
      costBase: num(value.costBase) ?? 0,
    }))

    startTransition(async () => {
      const result = await bulkAction(payload.map(({ consistencyPct: _drop, ...rest }) => rest))
      setMessage(result.message)
      if (result.ok) {
        setEdits({})
        setSelected(new Set())
        setEditMode(false)
        router.refresh()
      }
    })
  }

  function remove(row: GridRow) {
    if (!window.confirm(`Delete "${row.label}" and every trade and fill on it? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteAction(row.id)
      setMessage(result.message)
      if (result.ok) router.refresh()
    })
  }

  return (
    <div className="card overflow-hidden">
      {/* ------------------------------------------------ toolbar ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Accounts</h2>
          <span className="text-xs text-[var(--ink-muted)]">
            {visible.length} shown
            {editMode && changedCount > 0 && (
              <span className="ml-2 text-[var(--accent)]">{changedCount} changed</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span className="text-xs text-[var(--ink-secondary)]" role="status">
              {message}
            </span>
          )}
          {!editMode && (
            <div className="flex overflow-hidden rounded-md border border-[var(--line)]" role="group" aria-label="View">
              <button
                type="button"
                className={clsx(
                  'px-2 py-1 text-xs',
                  view === 'table' ? 'bg-[var(--surface-sunken)] font-medium text-[var(--ink)]' : 'text-[var(--ink-muted)]',
                )}
                onClick={() => setView('table')}
              >
                Table
              </button>
              <button
                type="button"
                className={clsx(
                  'border-l border-[var(--line)] px-2 py-1 text-xs',
                  view === 'cards' ? 'bg-[var(--surface-sunken)] font-medium text-[var(--ink)]' : 'text-[var(--ink-muted)]',
                )}
                onClick={() => setView('cards')}
              >
                Cards
              </button>
            </div>
          )}
          {editMode ? (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditMode(false)
                  setEdits({})
                  setSelected(new Set())
                  setMessage(null)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending || changedCount === 0}
                onClick={save}
              >
                {pending ? 'Saving…' : `Save${changedCount > 0 ? ` (${changedCount})` : ''}`}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setEditMode(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      {!editMode && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] px-4 py-2">
          {STATE_FILTERS.map((filter) => {
            const count = rows.filter(filter.match).length
            const active = stateFilter === filter.key
            return (
              <button
                key={filter.key}
                type="button"
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-[0.6875rem] transition-colors',
                  active
                    ? 'border-transparent bg-[var(--accent)] font-medium text-white'
                    : 'border-[var(--line)] text-[var(--ink-secondary)] hover:border-[var(--line-strong)]',
                  count === 0 && !active && 'opacity-45',
                )}
                onClick={() => setStateFilter(active ? '' : filter.key)}
              >
                {filter.label} <span className="tabular">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {!editMode && view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => {
            const firm = row.firmId === null ? null : firmById.get(row.firmId)
            return (
              <div
                key={row.id}
                className={clsx(
                  'rounded-lg border border-[var(--line)] p-3',
                  row.status !== 'active' && 'opacity-55',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">{row.label}</p>
                    <p className="text-[0.6875rem] text-[var(--ink-muted)]">
                      {firm?.name ?? 'No firm'} · {titleCase(row.phase)}
                      {row.planLabel ? ` · ${row.planLabel}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/accounts?edit=${row.id}#full-edit`}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      className="text-xs text-[var(--critical)] hover:underline"
                      aria-label={`Delete ${row.label}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <span
                  className={clsx(
                    'mt-2 inline-block rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium',
                    row.status === 'active'
                      ? 'border-[var(--good)] text-[var(--good-text)]'
                      : row.status === 'failed'
                        ? 'border-[var(--critical)] text-[var(--critical)]'
                        : 'border-[var(--line-strong)] text-[var(--ink-secondary)]',
                  )}
                >
                  {titleCase(row.status)}
                </span>

                <div className="mt-3">
                  {row.needsSetup ? (
                    <Link
                      href={`/accounts?edit=${row.id}#full-edit`}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Finish setup — add size, max loss and target to track progress
                    </Link>
                  ) : (
                    <JourneyBar row={row} ccy={ccy} labels />
                  )}
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <span className="text-[0.6875rem] text-[var(--ink-muted)]">
                    {row.consistencyPct === null
                      ? '—'
                      : row.bestDayPct === null
                        ? 'No trades'
                        : `Best day ${row.bestDayPct}% / ${row.consistencyPct}%`}
                  </span>
                  {row.payout ? (
                    <span
                      title={row.payout.text}
                      className={clsx(
                        'text-right text-sm font-semibold',
                        row.payout.state === 'eligible' ? 'text-[var(--good-text)]' : 'text-[var(--serious)]',
                      )}
                    >
                      {row.payout.state === 'eligible' ? 'Payout ready' : row.payout.text}
                    </span>
                  ) : row.toTarget !== null ? (
                    <span className="text-right">
                      <span className="block text-[0.625rem] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                        To target
                      </span>
                      <span className="tabular text-base font-semibold text-[var(--good-text)]">
                        {money(row.toTarget, ccy, 0)}
                      </span>
                      <span className="block text-[0.6875rem] text-[var(--ink-muted)]">to pass</span>
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
      <div className="scroll-x">
        <table className="data">
          <thead>
            {editMode ? (
              <>
                <tr>
                  <th className="w-8" />
                  <th>Account</th>
                  <th>Firm</th>
                  <th>Catalogue</th>
                  <th>Type</th>
                  <th className="text-right">Size</th>
                  <th>Drawdown</th>
                  <th className="text-right">Max loss</th>
                  <th className="text-right">Consist. %</th>
                  <th className="text-right">Target</th>
                  <th className="text-right">Cost</th>
                </tr>
                {/* ------------------------- apply-to-all row ---------------- */}
                <tr className="bg-[var(--surface-sunken)]">
                  <td />
                  <td className="text-xs font-medium text-[var(--ink)]">
                    Apply to {selected.size > 0 ? `${selected.size} selected` : 'all'}
                    <button type="button" className="btn ml-2 px-2 py-0.5 text-[0.6875rem]" onClick={applyToRows}>
                      Apply
                    </button>
                  </td>
                  <td>
                    <select
                      className="select py-1 text-xs"
                      value={apply.firmId}
                      onChange={(event) =>
                        setApply({ ...apply, firmId: event.target.value, planLabel: '' })
                      }
                    >
                      <option value="">—</option>
                      {firms.map((firm) => (
                        <option key={firm.id} value={firm.id}>
                          {firm.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="select py-1 text-xs"
                      value={apply.planLabel}
                      onChange={(event) => setApply({ ...apply, planLabel: event.target.value })}
                      disabled={!apply.firmId}
                    >
                      <option value="">Pick preset…</option>
                      {(firmById.get(Number(apply.firmId))?.plans ?? []).map((plan) => (
                        <option key={plan.label} value={plan.label}>
                          {plan.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="select py-1 text-xs"
                      value={apply.phase}
                      onChange={(event) => setApply({ ...apply, phase: event.target.value })}
                    >
                      <option value="">—</option>
                      <option value="eval">Evaluation</option>
                      <option value="funded">Funded</option>
                      <option value="live">Live</option>
                      <option value="personal">Personal</option>
                      <option value="demo">Demo</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="input py-1 text-right text-xs"
                      placeholder="Size"
                      value={apply.size}
                      onChange={(event) => setApply({ ...apply, size: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="select py-1 text-xs"
                      value={apply.drawdownType}
                      onChange={(event) => setApply({ ...apply, drawdownType: event.target.value })}
                    >
                      <option value="">—</option>
                      <option value="trailing_intraday">Intraday trail</option>
                      <option value="trailing_eod">EOD trail</option>
                      <option value="static">Static</option>
                      <option value="none">None</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="input py-1 text-right text-xs"
                      placeholder="Max loss"
                      value={apply.maxDrawdown}
                      onChange={(event) => setApply({ ...apply, maxDrawdown: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input py-1 text-right text-xs"
                      placeholder="%"
                      value={apply.consistencyPct}
                      onChange={(event) => setApply({ ...apply, consistencyPct: event.target.value })}
                    />
                  </td>
                  <td />
                  <td />
                </tr>
              </>
            ) : (
              <tr>
                <th>Firm</th>
                <th>Account</th>
                <th>Type</th>
                <th className="min-w-[220px]">Progress</th>
                <th className="text-right">To target / payout</th>
                <th className="text-right">Consistency</th>
                <th className="text-right">Size</th>
                <th className="text-right">Cost</th>
                <th className="w-20" />
              </tr>
            )}
          </thead>

          <tbody>
            {visible.map((row) => {
              const value = current(row)
              const changed = row.id in edits
              const firm = row.firmId === null ? null : firmById.get(row.firmId)

              if (editMode) {
                const rowFirm = firmById.get(Number(value.firmId))
                return (
                  <tr key={row.id} className={changed ? 'bg-[var(--accent-soft)]' : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={(event) => {
                          const next = new Set(selected)
                          if (event.target.checked) next.add(row.id)
                          else next.delete(row.id)
                          setSelected(next)
                        }}
                        aria-label={`Select ${row.label}`}
                      />
                    </td>
                    <td className="max-w-[220px]">
                      <span className="block truncate font-medium text-[var(--ink)]">{row.label}</span>
                      <span className="text-[0.6875rem] text-[var(--ink-muted)]">{row.platform}</span>
                    </td>
                    <td>
                      <select
                        className="select py-1 text-xs"
                        value={value.firmId}
                        onChange={(event) =>
                          setField(row, { firmId: event.target.value, planLabel: null })
                        }
                      >
                        <option value="">No firm</option>
                        {firms.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="select py-1 text-xs"
                        value={value.planLabel ?? ''}
                        onChange={(event) => pickPlan(row, event.target.value)}
                        disabled={!rowFirm || rowFirm.plans.length === 0}
                      >
                        <option value="">
                          {rowFirm && rowFirm.plans.length === 0 ? 'No plans defined' : 'Pick preset…'}
                        </option>
                        {(rowFirm?.plans ?? []).map((plan) => (
                          <option key={plan.label} value={plan.label}>
                            {plan.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="select py-1 text-xs"
                        value={value.phase}
                        onChange={(event) => setField(row, { phase: event.target.value })}
                      >
                        <option value="eval">Evaluation</option>
                        <option value="funded">Funded</option>
                        <option value="live">Live</option>
                        <option value="personal">Personal</option>
                        <option value="demo">Demo</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input py-1 text-right text-xs tabular"
                        value={value.size}
                        onChange={(event) => setField(row, { size: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="select py-1 text-xs"
                        value={value.drawdownType}
                        onChange={(event) => setField(row, { drawdownType: event.target.value })}
                      >
                        <option value="trailing_intraday">Intraday trail</option>
                        <option value="trailing_eod">EOD trail</option>
                        <option value="static">Static</option>
                        <option value="none">None</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input py-1 text-right text-xs tabular"
                        placeholder="—"
                        value={value.maxDrawdown}
                        onChange={(event) => setField(row, { maxDrawdown: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input w-16 py-1 text-right text-xs tabular"
                        placeholder="—"
                        value={value.consistencyPct}
                        onChange={(event) => setField(row, { consistencyPct: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input py-1 text-right text-xs tabular"
                        placeholder="—"
                        value={value.profitTarget}
                        onChange={(event) => setField(row, { profitTarget: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input w-20 py-1 text-right text-xs tabular"
                        value={value.costBase}
                        onChange={(event) => setField(row, { costBase: event.target.value })}
                      />
                    </td>
                  </tr>
                )
              }

              // ------------------------------------------ view mode row ----
              return (
                <tr key={row.id} className={row.status !== 'active' ? 'opacity-55' : undefined}>
                  <td className="max-w-[140px] truncate text-xs">{firm?.name ?? '—'}</td>
                  <td className="max-w-[220px]">
                    <span className="block truncate font-medium text-[var(--ink)]">{row.label}</span>
                    <span className="text-[0.6875rem] text-[var(--ink-muted)]">
                      {row.platform}
                      {row.planLabel ? ` · ${row.planLabel}` : ''}
                      {row.status !== 'active' ? ` · ${titleCase(row.status)}` : ''}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-xs">{titleCase(row.phase)}</td>
                  <td>
                    {row.needsSetup ? (
                      <Link
                        href={`/accounts?edit=${row.id}#full-edit`}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        Finish setup — add size, max loss and target to track progress
                      </Link>
                    ) : (
                      <JourneyBar row={row} ccy={ccy} />
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {row.payout ? (
                      <span
                        title={row.payout.text}
                        className={clsx(
                          'tabular text-xs font-medium',
                          row.payout.state === 'eligible' ? 'text-[var(--good-text)]' : 'text-[var(--serious)]',
                        )}
                      >
                        {row.payout.state === 'eligible' ? 'Payout ready' : row.payout.text}
                      </span>
                    ) : row.toTarget !== null ? (
                      <span className="tabular text-xs">
                        <span className="font-semibold text-[var(--good-text)]">{money(row.toTarget, ccy, 0)}</span>
                        <span className="block text-[0.6875rem] text-[var(--ink-muted)]">to pass</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--ink-muted)]">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {row.consistencyPct === null ? (
                      <span className="text-xs text-[var(--ink-muted)]">—</span>
                    ) : row.bestDayPct === null ? (
                      <span className="text-xs text-[var(--ink-muted)]">No trades</span>
                    ) : (
                      <span
                        className={clsx(
                          'tabular text-xs font-medium',
                          row.bestDayPct > row.consistencyPct
                            ? 'text-[var(--critical)]'
                            : 'text-[var(--ink-secondary)]',
                        )}
                      >
                        {row.bestDayPct}% / {row.consistencyPct}%
                      </span>
                    )}
                  </td>
                  <td className="tabular whitespace-nowrap text-right text-xs">
                    {moneyCompact(row.size, ccy)}
                  </td>
                  <td className="tabular whitespace-nowrap text-right text-xs">{money(row.costBase, ccy, 0)}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link
                      href={`/accounts?edit=${row.id}#full-edit`}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      className="ml-2 text-xs text-[var(--critical)] hover:underline"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {editMode && (
        <p className="border-t border-[var(--line)] px-4 py-2 text-[0.6875rem] text-[var(--ink-muted)]">
          The grid edits the fields firms define per plan. Commission rate, broker id, status and
          winning-day payout gates live in each account&apos;s full edit form.
        </p>
      )}
    </div>
  )
}

/**
 * One line per account: the bust floor on the left, the target on the right,
 * the starting balance as a mid tick, and a live marker for current equity.
 * Colour follows how much of the drawdown allowance remains — the number that
 * actually ends accounts.
 */
function JourneyBar({ row, ccy, labels = false }: { row: GridRow; ccy: string; labels?: boolean }) {
  const lo = row.line ?? row.size - (row.maxDrawdown ?? 0)
  const hi = row.size + (row.profitTarget ?? Math.max(row.maxDrawdown ?? 0, row.size * 0.02))
  const span = Math.max(1, hi - lo)
  const position = Math.min(1, Math.max(0, (row.equity - lo) / span))
  const startTick = Math.min(1, Math.max(0, (row.size - lo) / span))

  const tone =
    row.roomPct === null
      ? 'var(--accent)'
      : row.roomPct <= 0
        ? 'var(--critical)'
        : row.roomPct < 0.25
          ? 'var(--critical)'
          : row.roomPct < 0.5
            ? 'var(--warning)'
            : 'var(--good)'

  const tooltip = [
    `Floor (breach) ${money(lo, ccy, 0)}`,
    `Size ${money(row.size, ccy, 0)}`,
    `Now ${money(row.equity, ccy, 0)}`,
    `Target ${money(hi, ccy, 0)}`,
    `P&L ${money(row.netPnl, ccy, 0)}`,
  ].join('\n')

  return (
    <div title={tooltip}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-3 w-0.5 rounded bg-[var(--critical)]" />
        <div className="relative h-1.5 min-w-[140px] flex-1 rounded-full bg-[var(--surface-sunken)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-60"
            style={{ width: `${position * 100}%`, background: tone }}
          />
          {/* Starting balance tick */}
          <span
            aria-hidden
            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--line-strong)]"
            style={{ left: `${startTick * 100}%` }}
          />
          {/* Live equity marker */}
          <span
            aria-hidden
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: `${position * 100}%`, background: tone, borderColor: 'var(--surface)' }}
          />
        </div>
        <span aria-hidden className="h-3 w-0.5 rounded bg-[var(--good)]" />
      </div>
      {labels && (
        <div className="mt-1 flex items-center justify-between text-[0.6875rem]">
          <span className="text-[var(--ink-muted)]">Floor {money(lo, ccy, 0)}</span>
          <span className="tabular font-medium" style={{ color: tone }}>
            Now {money(row.equity, ccy, 0)}
          </span>
          <span className="text-[var(--ink-muted)]">Target {money(hi, ccy, 0)}</span>
        </div>
      )}
    </div>
  )
}
