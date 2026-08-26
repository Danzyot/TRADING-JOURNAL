'use client'

import Link from 'next/link'
import { CANDIDATES, shortlistRank } from '@/lib/abroad/countries'
import { CRITERIA, type CriterionKey } from '@/lib/abroad/criteria'
import { countryCosts, CATEGORIES } from '@/lib/abroad/costs'
import { PLACES, placesOf } from '@/lib/abroad/places'
import { drivers, rank } from '@/lib/abroad/score'
import { monthlyForStay } from '@/lib/abroad/stay'
import { countryAutumnScore } from '@/lib/abroad/autumn'
import { Card, clsx } from '@/components/ui'
import { PriorityList, StayToggle, planWeights, usePlan } from './controls'

const LABEL = new Map(CRITERIA.map((criterion) => [criterion.key, criterion.label]))

/**
 * The ranking, and the priorities that produce it.
 *
 * The answer is not a fact — it depends entirely on what matters to the person
 * asking. Put winter warmth first and Greece wins; put tax first and Georgia
 * does. A ranking you cannot interrogate is an opinion with a number next to it,
 * so the order is yours and the result recomputes.
 */
export function WeightedRanking() {
  const plan = usePlan()
  const weights = planWeights(plan)
  // The climate score is the September-to-December one, from each country's
  // best town — an annual average would rank places on months you are not going.
  const scored = CANDIDATES.map((candidate) => ({
    ...candidate,
    scores: { ...candidate.scores, climate: countryAutumnScore(candidate.slug, PLACES) },
  }))
  const ranked = rank(scored, weights)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card title="How long for" description="A test run and a move are different questions.">
          <StayToggle stay={plan.stay} setStay={plan.setStay} />
        </Card>
        <Card
          title="My priorities"
          description="Most important first. Drop anything that does not matter and it leaves the comparison."
        >
          <PriorityList plan={plan} setPriorities={plan.setPriorities} />
        </Card>
      </div>

      <div className="space-y-2">
        {ranked.map((candidate) => {
          const { best, worst } = drivers(candidate, weights)
          const places = placesOf(candidate.slug)
          const costs = countryCosts(candidate.slug, PLACES)
          const cheapest = places.length
            ? Math.min(...places.map((place) => monthlyForStay(place, plan.stay)))
            : null
          return (
            <div key={candidate.slug} className="card p-3">
              <div className="flex items-baseline gap-2">
                <span className="tabular text-xs font-semibold text-[var(--ink-muted)]">
                  {candidate.rank}
                </span>
                <p className="text-sm font-semibold text-[var(--ink)]">{candidate.country}</p>
                {shortlistRank(candidate.slug) ? (
                  <span className="rounded-full border border-[var(--accent)] px-1.5 py-px text-[0.5625rem] text-[var(--accent)]">
                    your #{shortlistRank(candidate.slug)}
                  </span>
                ) : null}
                <span className="truncate text-[0.6875rem] text-[var(--ink-muted)]">
                  {candidate.spots.slice(0, 2).join(' · ')}
                </span>
                <span className="tabular ml-auto text-sm font-semibold text-[var(--ink)]">
                  {candidate.total.toFixed(1)}
                </span>
              </div>

              <p className="mt-1 text-xs text-[var(--ink-secondary)]">{candidate.headline}</p>

              {candidate.hardStop ? (
                <p className="mt-1.5 rounded-md border border-rose-500/40 bg-rose-500/5 px-2 py-1 text-[0.6875rem] leading-relaxed text-rose-700 dark:text-rose-400">
                  <strong className="font-semibold">Ruled out.</strong> {candidate.hardStop}
                </p>
              ) : null}

              <div className="mt-2 h-1 w-full rounded-full bg-[var(--surface-sunken)]">
                <div
                  className="h-1 rounded-full bg-[var(--accent)]"
                  style={{ width: `${(candidate.total / 5) * 100}%` }}
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                {best.map((key) => (
                  <Pill key={key} tone="good">
                    + {LABEL.get(key)}
                  </Pill>
                ))}
                {worst.map((key) => (
                  <Pill key={key} tone="bad">
                    − {LABEL.get(key)}
                  </Pill>
                ))}
                {cheapest != null ? (
                  <span className="tabular ml-auto text-[0.625rem] text-[var(--ink-muted)]">
                    from €{cheapest.toLocaleString()}/mo ·{' '}
                    <Link
                      href={`/abroad/places?country=${candidate.slug}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {places.length} towns →
                    </Link>
                  </span>
                ) : null}
              </div>

              {costs ? <CostStrip slug={candidate.slug} /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The country's month, category by category, against the same month at home.
 *
 * Rent is the median of its towns; everything else is the country's own
 * everyday profile, so the comparison is like for like.
 */
function CostStrip({ slug }: { slug: string }) {
  const costs = countryCosts(slug, PLACES)
  if (!costs) return null
  return (
    <details className="mt-2 border-t border-[var(--line)] pt-2">
      <summary className="cursor-pointer list-none text-[0.625rem] uppercase tracking-wide text-[var(--ink-muted)] hover:text-[var(--ink)]">
        Cost, line by line — €{costs.total.toLocaleString()} a month
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
        {CATEGORIES.map((category) => {
          const value = category.key === 'rent' ? costs.lines.rent : costs.lines[category.key]
          return (
            <div key={category.key} className="flex items-baseline justify-between gap-2 text-[0.625rem]">
              <span className="truncate text-[var(--ink-muted)]">{category.label}</span>
              <span className="tabular shrink-0 text-[var(--ink)]">
                €{value.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-1.5 text-[0.625rem] text-[var(--ink-muted)]">
        Rent is the median of this country&apos;s towns and spans €{costs.rentLow.toLocaleString()}–
        {costs.rentHigh.toLocaleString()} depending on the town.
      </p>
    </details>
  )
}

function Pill({ tone, children }: { tone: 'good' | 'bad'; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        'rounded-full border px-1.5 py-px text-[0.5625rem]',
        tone === 'good'
          ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
          : 'border-rose-500/40 text-rose-600 dark:text-rose-400',
      )}
    >
      {children}
    </span>
  )
}

export type { CriterionKey }
