'use client'

import { useEffect, useMemo, useState } from 'react'
import { CANDIDATES } from '@/lib/abroad/countries'
import { CATEGORIES, HOME, HOME_TOTAL } from '@/lib/abroad/costs'
import { PLACES, type Place } from '@/lib/abroad/places'
import { sceneryFor } from '@/lib/abroad/scenery'
import {
  ENTRY,
  FLIGHT_HOME,
  KEEP_IN_MIND_ON_A_TEST_RUN,
  SHORT_STAY_TAX,
  SKIPPED_ON_A_TEST_RUN,
  costsForStay,
  monthlyForStay,
} from '@/lib/abroad/stay'
import { TRAINING_CLIMATE } from '@/lib/abroad/training'
import { PlaceScene } from '@/components/abroad/scene'
import { clsx } from '@/components/ui'

const COUNTRY = new Map(CANDIDATES.map((candidate) => [candidate.slug, candidate]))
const STORAGE_KEY = 'tj-abroad-trip'

/** One-off costs that are not a monthly line and always get forgotten. */
const EXTRAS = [
  { key: 'flights', label: 'Flights', hint: 'Return from Tel Aviv, from the country table.' },
  { key: 'deposit', label: 'Deposit', hint: 'Usually one month on a short let, and usually returned.' },
  { key: 'insurance', label: 'Kit and insurance', hint: 'Gloves, a gi, and a policy that covers combat sports.' },
  { key: 'setup', label: 'Landing costs', hint: 'A data SIM, a UPS for the router, a month of transport up front.' },
] as const

type Extras = Record<(typeof EXTRAS)[number]['key'], number>

type Trip = {
  placeId: string
  weeks: number
  extras: Extras
}

function defaultTrip(placeId: string): Trip {
  const place = PLACES.find((candidate) => candidate.id === placeId) ?? PLACES[0]
  return {
    placeId: place.id,
    weeks: 12,
    extras: {
      flights: FLIGHT_HOME[place.country] ?? 0,
      deposit: costsForStay(place, 'test').rent,
      insurance: 250,
      setup: 200,
    },
  }
}

/**
 * The trip, priced end to end.
 *
 * A monthly figure is not a decision — "what does three months in Chania
 * actually cost me, flights and deposit and gloves included, against staying
 * where I am" is. So this adds the one-off costs nobody budgets for, multiplies
 * the monthly lines by the weeks, and puts the same period at home next to it.
 *
 * It lives in the browser for now rather than the database: this is a sketchpad
 * you change ten times before you book anything, not a record of something that
 * happened.
 */
export function TripBuilder({ initialPlace }: { initialPlace?: string }) {
  const [trip, setTrip] = useState<Trip>(() => defaultTrip(initialPlace ?? 'chania'))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw && !initialPlace) {
        const stored = JSON.parse(raw) as Partial<Trip>
        if (stored.placeId && PLACES.some((place) => place.id === stored.placeId)) {
          const base = defaultTrip(stored.placeId)
          setTrip({ ...base, ...stored, extras: { ...base.extras, ...stored.extras } })
        }
      }
    } catch {
      // A blocked store just means the defaults.
    }
    setReady(true)
  }, [initialPlace])

  const update = (next: Trip) => {
    setTrip(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Fine — the numbers still add up this session.
    }
  }

  const place = PLACES.find((candidate) => candidate.id === trip.placeId) ?? PLACES[0]
  const country = COUNTRY.get(place.country)
  const months = trip.weeks / 4.345
  const stay = trip.weeks <= 26 ? 'test' : 'move'

  const totals = useMemo(() => {
    const lines = costsForStay(place, stay)
    const monthly = monthlyForStay(place, stay)
    const flights = trip.extras.flights || FLIGHT_HOME[place.country] || 0
    const deposit = trip.extras.deposit || lines.rent
    const oneOff = flights + deposit + trip.extras.insurance + trip.extras.setup
    const living = Math.round(monthly * months)
    return {
      lines,
      monthly,
      flights,
      deposit,
      oneOff,
      living,
      grand: living + oneOff,
      atHome: Math.round(HOME_TOTAL * months),
    }
  }, [place, stay, months, trip.extras])

  if (!ready) return null

  const entry = ENTRY[place.country]
  const climate = TRAINING_CLIMATE[place.country]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="card p-3">
            <label className="label" htmlFor="trip-place">
              Where
            </label>
            <select
              id="trip-place"
              className="select"
              value={trip.placeId}
              onChange={(event) => {
                const next = defaultTrip(event.target.value)
                update({ ...next, weeks: trip.weeks, extras: { ...next.extras, insurance: trip.extras.insurance, setup: trip.extras.setup } })
              }}
            >
              {CANDIDATES.map((candidate) => (
                <optgroup key={candidate.slug} label={candidate.country}>
                  {PLACES.filter((item) => item.country === candidate.slug).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.where}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <label className="label mt-3" htmlFor="trip-weeks">
              How long — {trip.weeks} weeks
            </label>
            <input
              id="trip-weeks"
              type="range"
              min={1}
              max={52}
              value={trip.weeks}
              onChange={(event) => update({ ...trip, weeks: Number(event.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-[0.625rem] text-[var(--ink-muted)]">
              <span>a week</span>
              <span>{stay === 'test' ? 'still a visit' : 'this is a move'}</span>
              <span>a year</span>
            </div>

            <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
              {EXTRAS.map((extra) => (
                <div key={extra.key}>
                  <label className="label" htmlFor={`trip-${extra.key}`}>
                    {extra.label}
                  </label>
                  <input
                    id={`trip-${extra.key}`}
                    className="input"
                    type="number"
                    min={0}
                    value={trip.extras[extra.key]}
                    placeholder={
                      extra.key === 'flights'
                        ? String(FLIGHT_HOME[place.country] ?? 0)
                        : extra.key === 'deposit'
                          ? String(totals.lines.rent)
                          : '0'
                    }
                    onChange={(event) =>
                      update({
                        ...trip,
                        extras: { ...trip.extras, [extra.key]: Number(event.target.value) || 0 },
                      })
                    }
                  />
                  <p className="mt-0.5 text-[0.625rem] text-[var(--ink-muted)]">{extra.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card overflow-hidden">
            <PlaceScene
              scenery={sceneryFor(place)}
              alt={`${place.name}, ${place.where}`}
              className="h-28 w-full object-cover"
            />
            <div className="p-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-base font-semibold text-[var(--ink)]">{place.name}</h3>
                <span className="text-xs text-[var(--ink-muted)]">
                  {place.where} · {country?.country}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Figure label={`${trip.weeks} weeks, all in`} value={totals.grand} strong />
                <Figure label="Living costs" value={totals.living} />
                <Figure label="One-off costs" value={totals.oneOff} />
                <Figure
                  label={`The same weeks in ${HOME.label}`}
                  value={totals.atHome}
                  tone={totals.atHome > totals.grand ? 'dearer' : 'cheaper'}
                />
              </div>

              <p className="mt-2 text-xs text-[var(--ink-secondary)]">
                {totals.grand < totals.atHome ? (
                  <>
                    Going costs{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      €{(totals.atHome - totals.grand).toLocaleString()} less
                    </strong>{' '}
                    than staying for the same {trip.weeks} weeks, flights and deposit included.
                  </>
                ) : (
                  <>
                    Going costs{' '}
                    <strong className="text-rose-600 dark:text-rose-400">
                      €{(totals.grand - totals.atHome).toLocaleString()} more
                    </strong>{' '}
                    than staying for the same {trip.weeks} weeks.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="card p-3">
            <h4 className="mb-2 text-[0.625rem] uppercase tracking-wide text-[var(--ink-muted)]">
              Month by month, line by line
            </h4>
            <table className="w-full text-xs">
              <tbody>
                {CATEGORIES.map((category) => (
                  <tr key={category.key}>
                    <td className="py-0.5 pr-2 text-[var(--ink-secondary)]">{category.label}</td>
                    <td className="tabular py-0.5 text-right text-[var(--ink)]">
                      €{totals.lines[category.key].toLocaleString()}
                    </td>
                    <td className="tabular py-0.5 pl-3 text-right text-[var(--ink-muted)]">
                      €{Math.round(totals.lines[category.key] * months).toLocaleString()} over the trip
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--line)]">
                  <td className="pt-1 font-semibold text-[var(--ink)]">Every month</td>
                  <td className="tabular pt-1 text-right font-semibold text-[var(--ink)]">
                    €{totals.monthly.toLocaleString()}
                  </td>
                  <td className="tabular pt-1 pl-3 text-right font-semibold text-[var(--ink)]">
                    €{totals.living.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Panel title="Getting in">
              <Line label="Polish passport">{entry?.polish}</Line>
              <Line label="Israeli passport">{entry?.israeli}</Line>
              <Line label="Past that">{entry?.limit}</Line>
            </Panel>
            <Panel title="Training, week one">
              <Line label="A month">{climate?.price}</Line>
              <Line label="Taught in">{climate?.language}</Line>
              <Line label="Joining">{climate?.joining}</Line>
            </Panel>
            <Panel title="Tax on a stay this short" tone="good">
              <p className="font-medium text-[var(--ink)]">{SHORT_STAY_TAX.headline}</p>
              <ul className="mt-1 space-y-1">
                {SHORT_STAY_TAX.points.map((point) => (
                  <li key={point} className="flex gap-1.5">
                    <span className="text-[var(--ink-muted)]">·</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[0.625rem] text-[var(--ink-muted)]">{SHORT_STAY_TAX.caveat}</p>
            </Panel>
            <Panel title="What you skip, and what you do not">
              <ul className="space-y-1">
                {SKIPPED_ON_A_TEST_RUN.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
                {KEEP_IN_MIND_ON_A_TEST_RUN.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span className="text-amber-600 dark:text-amber-400">!</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: number
  strong?: boolean
  /** About the number shown, not about the decision: red is the dearer option. */
  tone?: 'dearer' | 'cheaper'
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-2">
      <div className="text-[0.625rem] leading-tight text-[var(--ink-muted)]">{label}</div>
      <div
        className={clsx(
          'tabular mt-0.5 font-semibold',
          strong ? 'text-lg' : 'text-sm',
          tone === 'dearer'
            ? 'text-rose-600 dark:text-rose-400'
            : tone === 'cheaper'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-[var(--ink)]',
        )}
      >
        €{value.toLocaleString()}
      </div>
    </div>
  )
}

function Panel({
  title,
  children,
  tone,
}: {
  title: string
  children: React.ReactNode
  tone?: 'good'
}) {
  return (
    <section
      className={clsx(
        'rounded-lg border p-2.5',
        tone === 'good' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-[var(--line)]',
      )}
    >
      <h4 className="mb-1.5 text-[0.625rem] uppercase tracking-wide text-[var(--ink-muted)]">{title}</h4>
      <div className="space-y-1 text-xs leading-relaxed text-[var(--ink-secondary)]">{children}</div>
    </section>
  )
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="font-semibold text-[var(--ink)]">{label}.</span> {children}
    </p>
  )
}
