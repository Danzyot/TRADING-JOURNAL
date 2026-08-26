'use client'

import { useCallback, useEffect, useState } from 'react'
import { CRITERIA, type CriterionKey } from '@/lib/abroad/criteria'
import {
  DEFAULT_PRIORITIES,
  STORAGE_KEY,
  move,
  normalise,
  toggleIgnored,
  weightsFrom,
  type Priorities,
} from '@/lib/abroad/priorities'
import { IRRELEVANT_ON_A_TEST_RUN, STAYS, type StayKey } from '@/lib/abroad/stay'
import { clsx } from '@/components/ui'

const STAY_KEY = 'tj-abroad-stay'
const LABEL = new Map(CRITERIA.map((criterion) => [criterion.key, criterion.label]))
const MEANING = new Map(CRITERIA.map((criterion) => [criterion.key, criterion.meaning]))

export type Plan = {
  priorities: Priorities
  stay: StayKey
}

/**
 * One plan, shared by every page in this section.
 *
 * The ranking you set on the countries page is the ranking the towns are sorted
 * by and the order their detail is laid out in — otherwise you would be telling
 * the same thing to three different screens.
 */
export function usePlan(): Plan & {
  setPriorities: (next: Priorities) => void
  setStay: (next: StayKey) => void
  ready: boolean
} {
  const [priorities, setStored] = useState<Priorities>(DEFAULT_PRIORITIES)
  const [stay, setStayState] = useState<StayKey>('test')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setStored(normalise(JSON.parse(raw)))
      const savedStay = localStorage.getItem(STAY_KEY)
      if (savedStay === 'test' || savedStay === 'move') setStayState(savedStay)
    } catch {
      // A blocked or stale store just means the defaults.
    }
    setReady(true)
  }, [])

  const setPriorities = useCallback((next: Priorities) => {
    setStored(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Not worth reporting; the session still works.
    }
  }, [])

  const setStay = useCallback((next: StayKey) => {
    setStayState(next)
    try {
      localStorage.setItem(STAY_KEY, next)
    } catch {
      // Same.
    }
  }, [])

  return { priorities, stay, setPriorities, setStay, ready }
}

export function planWeights(plan: Plan) {
  const weights = weightsFrom(plan.priorities)
  if (plan.stay === 'move') return weights
  const adjusted = { ...weights }
  for (const key of IRRELEVANT_ON_A_TEST_RUN) adjusted[key] = 0
  return adjusted
}

/** The criteria that still count, in the order they count, for laying out detail. */
export function activeOrder(plan: Plan): CriterionKey[] {
  const dropped = new Set([
    ...plan.priorities.ignored,
    ...(plan.stay === 'test' ? IRRELEVANT_ON_A_TEST_RUN : []),
  ])
  return plan.priorities.order.filter((key) => !dropped.has(key))
}

export function StayToggle({
  stay,
  setStay,
}: {
  stay: StayKey
  setStay: (next: StayKey) => void
}) {
  const current = STAYS.find((option) => option.key === stay) ?? STAYS[0]
  return (
    <div>
      <div className="flex rounded-lg border border-[var(--line)] p-0.5">
        {STAYS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setStay(option.key)}
            aria-pressed={stay === option.key}
            className={clsx(
              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              stay === option.key
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-[var(--ink-muted)]">
        {current.detail}
      </p>
    </div>
  )
}

/**
 * The ranking, as a list you reorder rather than ten sliders you guess at.
 *
 * Nobody knows whether beaches are a 4 or a 5. Everybody knows whether beaches
 * matter more than tax.
 */
export function PriorityList({
  plan,
  setPriorities,
}: {
  plan: Plan
  setPriorities: (next: Priorities) => void
}) {
  const { priorities, stay } = plan
  const muted = new Set(stay === 'test' ? IRRELEVANT_ON_A_TEST_RUN : [])

  return (
    <ol className="space-y-1">
      {priorities.order.map((key, index) => {
        const ignored = priorities.ignored.includes(key)
        const offForStay = muted.has(key)
        const dimmed = ignored || offForStay
        return (
          <li
            key={key}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg border px-2 py-1.5',
              dimmed
                ? 'border-dashed border-[var(--line)] opacity-55'
                : 'border-[var(--line)] bg-[var(--surface-sunken)]',
            )}
          >
            <span className="tabular w-5 text-center text-[0.6875rem] font-semibold text-[var(--ink-muted)]">
              {dimmed ? '—' : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-[var(--ink)]">{LABEL.get(key)}</div>
              <div className="truncate text-[0.625rem] text-[var(--ink-muted)]">
                {offForStay ? 'Does not apply on a three-month trip' : MEANING.get(key)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Step
                label={`Move ${LABEL.get(key)} up`}
                disabled={index === 0 || dimmed}
                onClick={() => setPriorities(move(priorities, key, -1))}
              >
                ↑
              </Step>
              <Step
                label={`Move ${LABEL.get(key)} down`}
                disabled={index === priorities.order.length - 1 || dimmed}
                onClick={() => setPriorities(move(priorities, key, 1))}
              >
                ↓
              </Step>
              <button
                type="button"
                aria-pressed={ignored}
                title={ignored ? 'Put it back in the comparison' : 'Take it out of the comparison'}
                onClick={() => setPriorities(toggleIgnored(priorities, key))}
                disabled={offForStay}
                className="ml-1 rounded px-1.5 py-0.5 text-[0.625rem] text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-40"
              >
                {ignored ? 'add' : 'drop'}
              </button>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[0.625rem] leading-none text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-muted)] disabled:opacity-30"
    >
      {children}
    </button>
  )
}
