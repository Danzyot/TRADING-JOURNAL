'use client'

/**
 * A firm's plan catalogue editor.
 *
 * Plans are what the accounts grid's "Catalogue" select offers — define
 * "Pro — $50k" once here, apply it to fifteen accounts in one click there.
 * Edited as a local list with a single Save so adding a firm's whole lineup is
 * one round trip, not one per plan.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { FirmPlan } from '@/db/schema'
import type { ActionResult } from '@/server/actions'
import { clsx } from '@/components/ui'

type Draft = {
  label: string
  phase: 'eval' | 'funded'
  size: string
  maxDrawdown: string
  drawdownType: FirmPlan['drawdownType']
  consistencyPct: string
  profitTarget: string
  cost: string
}

const blank: Draft = {
  label: '',
  phase: 'eval',
  size: '',
  maxDrawdown: '',
  drawdownType: 'trailing_eod',
  consistencyPct: '',
  profitTarget: '',
  cost: '',
}

function fromPlan(plan: FirmPlan): Draft {
  return {
    label: plan.label,
    phase: plan.phase,
    size: String(plan.size),
    maxDrawdown: plan.maxDrawdown === null ? '' : String(plan.maxDrawdown),
    drawdownType: plan.drawdownType,
    consistencyPct:
      plan.consistencyPercent === null ? '' : String(Math.round(plan.consistencyPercent * 100)),
    profitTarget: plan.profitTarget === null ? '' : String(plan.profitTarget),
    cost: plan.cost === null ? '' : String(plan.cost),
  }
}

const num = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function FirmPlans({
  plans,
  saveAction,
}: {
  plans: FirmPlan[]
  saveAction: (plans: unknown) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>(plans.map(fromPlan))
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((previous) => previous.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)))
    setDirty(true)
  }

  function save() {
    const payload = drafts
      .filter((draft) => draft.label.trim() !== '' && num(draft.size) !== null)
      .map((draft) => ({
        label: draft.label.trim(),
        phase: draft.phase,
        size: num(draft.size)!,
        maxDrawdown: num(draft.maxDrawdown),
        drawdownType: draft.drawdownType,
        consistencyPercent: num(draft.consistencyPct) === null ? null : num(draft.consistencyPct)! / 100,
        profitTarget: num(draft.profitTarget),
        dailyLossLimit: null,
        minWinningDays: null,
        winningDayMinProfit: null,
        cost: num(draft.cost),
      }))

    startTransition(async () => {
      const result = await saveAction(payload)
      setMessage(result.message)
      if (result.ok) {
        setDirty(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--line)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--ink)]">Plan catalogue</p>
        <div className="flex items-center gap-2">
          {message && (
            <span className="text-[0.6875rem] text-[var(--ink-secondary)]" role="status">
              {message}
            </span>
          )}
          <button
            type="button"
            className="btn px-2 py-1 text-[0.6875rem]"
            onClick={() => {
              setDrafts([...drafts, { ...blank }])
              setDirty(true)
            }}
          >
            + Plan
          </button>
          <button
            type="button"
            className={clsx('btn px-2 py-1 text-[0.6875rem]', dirty && 'btn-primary')}
            disabled={pending || !dirty}
            onClick={save}
          >
            {pending ? 'Saving…' : 'Save plans'}
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--ink-muted)]">
          No plans yet. A plan is a template — &quot;Pro — $50k&quot; with its size, max loss,
          drawdown type and consistency — that the accounts grid can apply in one pick.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {drafts.map((draft, index) => (
            <div key={index} className="grid grid-cols-2 gap-1.5 rounded-md bg-[var(--surface-sunken)] p-2 sm:grid-cols-4 lg:grid-cols-8">
              <input
                className="input col-span-2 py-1 text-xs"
                placeholder="Label, e.g. Pro — $50k"
                value={draft.label}
                onChange={(event) => update(index, { label: event.target.value })}
              />
              <select
                className="select py-1 text-xs"
                value={draft.phase}
                onChange={(event) => update(index, { phase: event.target.value as Draft['phase'] })}
              >
                <option value="eval">Evaluation</option>
                <option value="funded">Funded</option>
              </select>
              <input
                className="input py-1 text-right text-xs tabular"
                placeholder="Size"
                value={draft.size}
                onChange={(event) => update(index, { size: event.target.value })}
              />
              <select
                className="select py-1 text-xs"
                value={draft.drawdownType}
                onChange={(event) =>
                  update(index, { drawdownType: event.target.value as Draft['drawdownType'] })
                }
              >
                <option value="trailing_intraday">Intraday trail</option>
                <option value="trailing_eod">EOD trail</option>
                <option value="static">Static</option>
                <option value="none">None</option>
              </select>
              <input
                className="input py-1 text-right text-xs tabular"
                placeholder="Max loss"
                value={draft.maxDrawdown}
                onChange={(event) => update(index, { maxDrawdown: event.target.value })}
              />
              <input
                className="input py-1 text-right text-xs tabular"
                placeholder="Cons. %"
                value={draft.consistencyPct}
                onChange={(event) => update(index, { consistencyPct: event.target.value })}
              />
              <div className="flex items-center gap-1.5">
                <input
                  className="input py-1 text-right text-xs tabular"
                  placeholder="Target"
                  value={draft.profitTarget}
                  onChange={(event) => update(index, { profitTarget: event.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Remove ${draft.label || 'plan'}`}
                  className="text-xs text-[var(--critical)] hover:underline"
                  onClick={() => {
                    setDrafts(drafts.filter((_, i) => i !== index))
                    setDirty(true)
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
