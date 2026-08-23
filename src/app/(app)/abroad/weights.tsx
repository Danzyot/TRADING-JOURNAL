'use client'

import { useEffect, useState } from 'react'
import { CRITERIA, DEFAULT_WEIGHTS, type CriterionKey, type Weights } from '@/lib/abroad/criteria'
import { drivers, rank } from '@/lib/abroad/score'
import { CANDIDATES } from '@/lib/abroad/countries'
import { Card, clsx } from '@/components/ui'

const STORAGE_KEY = 'tj-abroad-weights'

const LABEL = new Map(CRITERIA.map((criterion) => [criterion.key, criterion.label]))

/**
 * The ranking, and the weights that produce it.
 *
 * The point of doing this in the browser rather than printing a table is that
 * the answer is not a fact — it depends entirely on what matters to the person
 * asking. Drag "winter warmth" to zero and Bulgaria climbs; drag tax to zero
 * and Spain does. A ranking you cannot interrogate is just an opinion with a
 * number next to it.
 */
export function WeightedRanking() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setWeights({ ...DEFAULT_WEIGHTS, ...JSON.parse(stored) })
    } catch {
      // A stale or blocked store just means the defaults.
    }
  }, [])

  const set = (key: CriterionKey, value: number) => {
    const next = { ...weights, [key]: value }
    setWeights(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Not worth telling anyone about; the ranking still works this session.
    }
  }

  const ranked = rank(CANDIDATES, weights)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card
        title="What matters to you"
        description="Drag anything to zero to take it out of the comparison entirely."
      >
        <div className="space-y-3">
          {CRITERIA.map((criterion) => (
            <div key={criterion.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={`w-${criterion.key}`} className="text-xs font-medium text-[var(--ink)]">
                  {criterion.label}
                </label>
                <span className="tabular text-[0.6875rem] text-[var(--ink-muted)]">
                  {weights[criterion.key] === 0 ? 'ignored' : `${weights[criterion.key]}/5`}
                </span>
              </div>
              <input
                id={`w-${criterion.key}`}
                type="range"
                min={0}
                max={5}
                step={1}
                value={weights[criterion.key]}
                onChange={(event) => set(criterion.key, Number(event.target.value))}
                className="mt-1 w-full accent-[var(--accent)]"
              />
              <p className="text-[0.625rem] leading-relaxed text-[var(--ink-muted)]">{criterion.meaning}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setWeights(DEFAULT_WEIGHTS)
            try {
              localStorage.removeItem(STORAGE_KEY)
            } catch {
              // Same as above.
            }
          }}
          className="btn mt-3 w-full justify-center py-1 text-xs"
        >
          Reset to the brief
        </button>
      </Card>

      <div className="space-y-3 lg:col-span-2">
        {ranked.map((candidate) => {
          const { best, worst } = drivers(candidate, weights)
          return (
            <div
              key={candidate.slug}
              className={clsx(
                'card p-4',
                candidate.rank === 1 && 'border-[color-mix(in_srgb,var(--good)_45%,transparent)]',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    <span aria-hidden className="mr-1.5">
                      {candidate.flag}
                    </span>
                    {candidate.rank}. {candidate.country}
                    <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">
                      {candidate.spots.slice(0, 2).join(' · ')}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">{candidate.headline}</p>
                </div>
                <span className="tabular text-lg font-semibold text-[var(--ink)]">
                  {candidate.total.toFixed(1)}
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(candidate.total / 5) * 100}%`,
                    background: candidate.rank === 1 ? 'var(--good)' : 'var(--accent)',
                  }}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 text-[0.625rem]">
                {best.map((key) => (
                  <span
                    key={key}
                    className="rounded-full border border-[color-mix(in_srgb,var(--good)_35%,transparent)] px-2 py-0.5 text-[var(--good-text)]"
                  >
                    + {LABEL.get(key)}
                  </span>
                ))}
                {worst.map((key) => (
                  <span
                    key={key}
                    className="rounded-full border border-[color-mix(in_srgb,var(--critical)_35%,transparent)] px-2 py-0.5 text-[var(--critical)]"
                  >
                    − {LABEL.get(key)}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
