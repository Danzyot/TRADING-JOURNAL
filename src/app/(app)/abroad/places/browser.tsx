'use client'

import { useMemo, useState } from 'react'
import { CANDIDATES, SHORTLIST, shortlistRank } from '@/lib/abroad/countries'
import { CATEGORIES, type CostLines } from '@/lib/abroad/costs'
import { MONTHS, autumnFor, autumnScore } from '@/lib/abroad/autumn'
import { spotsFor } from '@/lib/abroad/stays'
import { SpotCard } from '@/components/abroad/spot-card'
import { CONNECTIVITY } from '@/lib/abroad/connectivity'
import type { CriterionKey } from '@/lib/abroad/criteria'
import { PLACES, filterPlaces, tierOf, type Place, type SortKey } from '@/lib/abroad/places'
import { sceneryFor } from '@/lib/abroad/scenery'
import { SAFETY } from '@/lib/abroad/safety'
import { ENTRY, FLIGHT_HOME, costsForStay, monthlyForStay, shortLetFactor, type StayKey } from '@/lib/abroad/stay'
import { BEGINNER, TRAINING_CLIMATE } from '@/lib/abroad/training'
import { GymTile, HouseTile, ShoreTile } from '@/components/abroad/scene'
import { PlacePhoto } from '@/components/abroad/photo'
import { clsx } from '@/components/ui'
import { PriorityList, StayToggle, activeOrder, usePlan } from '../controls'

const COUNTRY = new Map(CANDIDATES.map((candidate) => [candidate.slug, candidate]))

const BUDGETS = [
  { label: 'Any', value: Infinity },
  { label: '≤ €1,500', value: 1500 },
  { label: '≤ €2,200', value: 2200 },
  { label: '≤ €3,000', value: 3000 },
] as const

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'fit', label: 'Best fit for me' },
  { key: 'cost', label: 'Cheapest' },
  { key: 'name', label: 'A–Z' },
]

const HOUSE_LABEL: Record<Place['house'], string> = {
  normal: 'Whole house normal',
  possible: 'House possible',
  rare: 'Flats only',
}

export function PlacesBrowser({ initialCountry }: { initialCountry?: string }) {
  const plan = usePlan()
  const [budget, setBudget] = useState<number>(Infinity)
  const [mmaOnly, setMmaOnly] = useState(false)
  const [houseOnly, setHouseOnly] = useState(false)
  const [countries, setCountries] = useState<string[]>(
    initialCountry && COUNTRY.has(initialCountry) ? [initialCountry] : [],
  )
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('fit')
  const [showPriorities, setShowPriorities] = useState(false)

  const order = activeOrder(plan)

  const shown = useMemo(() => {
    const matched = filterPlaces(PLACES, {
      budget: budget === Infinity ? undefined : budget,
      mmaOnly,
      houseOnly,
      countries,
      query,
    })
    const cost = (place: Place) => monthlyForStay(place, plan.stay)
    if (sort === 'cost') return [...matched].sort((a, b) => cost(a) - cost(b) || b.fit - a.fit)
    if (sort === 'name') return [...matched].sort((a, b) => a.name.localeCompare(b.name))
    return [...matched].sort((a, b) => scoreFor(b, order) - scoreFor(a, order) || cost(a) - cost(b))
  }, [budget, mmaOnly, houseOnly, countries, query, sort, plan.stay, order])

  const toggleCountry = (slug: string) =>
    setCountries((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    )

  const clear = () => {
    setBudget(Infinity)
    setMmaOnly(false)
    setHouseOnly(false)
    setCountries([])
    setQuery('')
  }

  const filtered = shown.length !== PLACES.length

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Group label="A month costs at most">
                {BUDGETS.map((option) => (
                  <Chip key={option.label} on={budget === option.value} onClick={() => setBudget(option.value)}>
                    {option.label}
                  </Chip>
                ))}
              </Group>

              <Group label="Shortlist">
                <Chip
                  on={countries.length === SHORTLIST.length && SHORTLIST.every((slug) => countries.includes(slug))}
                  onClick={() =>
                    setCountries((current) =>
                      SHORTLIST.every((slug) => current.includes(slug)) && current.length === SHORTLIST.length
                        ? []
                        : [...SHORTLIST],
                    )
                  }
                >
                  My five
                </Chip>
              </Group>

              <Group label="Must have">
                <Chip on={mmaOnly} onClick={() => setMmaOnly(!mmaOnly)}>
                  Beginner classes
                </Chip>
                <Chip on={houseOnly} onClick={() => setHouseOnly(!houseOnly)}>
                  A whole house
                </Chip>
              </Group>

              <Group label="Order by">
                {SORTS.map((option) => (
                  <Chip key={option.key} on={sort === option.key} onClick={() => setSort(option.key)}>
                    {option.label}
                  </Chip>
                ))}
              </Group>

              <div className="ml-auto flex items-center gap-2">
                <input
                  className="input h-8 w-40 text-xs"
                  placeholder="beach, gym, town…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search the places"
                />
                {filtered ? (
                  <button type="button" className="btn h-8 px-2 text-xs" onClick={clear}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 border-t border-[var(--line)] pt-2">
              {CANDIDATES.map((candidate) => (
                <Chip
                  key={candidate.slug}
                  on={countries.includes(candidate.slug)}
                  onClick={() => toggleCountry(candidate.slug)}
                >
                  {candidate.country}
                  {shortlistRank(candidate.slug) ? ' ★' : ''}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2 lg:border-l lg:border-[var(--line)] lg:pl-3">
            <StayToggle stay={plan.stay} setStay={plan.setStay} />
            <button
              type="button"
              className="btn h-8 w-full justify-between px-2 text-xs"
              onClick={() => setShowPriorities((open) => !open)}
              aria-expanded={showPriorities}
            >
              <span>My priorities</span>
              <span className="truncate text-[0.625rem] text-[var(--ink-muted)]">
                {order.slice(0, 2).map(labelOf).join(' · ')}…
              </span>
            </button>
            {showPriorities ? (
              <PriorityList plan={plan} setPriorities={plan.setPriorities} />
            ) : null}
          </div>
        </div>

        <p className="text-[0.6875rem] text-[var(--ink-muted)]">
          {shown.length} of {PLACES.length} places, priced for late September to December
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="card p-6 text-center text-sm text-[var(--ink-muted)]">
          Nothing matches all of that. Loosen the budget or drop one of the must-haves.
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
          {shown.map((place) => (
            <PlaceCard key={place.id} place={place} order={order} stay={plan.stay} />
          ))}
        </div>
      )}
    </div>
  )
}

function labelOf(key: CriterionKey): string {
  return TILE[key]?.label ?? key
}

/** How well a town serves the order you put the criteria in. */
function scoreFor(place: Place, order: CriterionKey[]): number {
  const country = COUNTRY.get(place.country)
  if (!country) return place.fit
  const span = Math.max(1, order.length - 1)
  let weighted = 0
  let total = 0
  order.forEach((key, index) => {
    const weight = 5 - (index / span) * 3.5
    // The climate score is this town's own late-September-to-December score,
    // not the country's annual average — Chania and Thessaloniki are not alike.
    const score = key === 'climate' ? autumnScore(place) : (country.scores[key] ?? 0)
    weighted += score * weight
    total += weight
  })
  // The town's own fit carries half the answer; the country carries the rest.
  return total === 0 ? place.fit : (place.fit + (weighted / total)) / 2
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[0.625rem] uppercase tracking-wide text-[var(--ink-muted)]">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        'rounded-full border px-2 py-0.5 text-[0.6875rem] transition-colors',
        on
          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
          : 'border-[var(--line)] text-[var(--ink-secondary)] hover:border-[var(--ink-muted)]',
      )}
    >
      {children}
    </button>
  )
}

const TIER_TONE: Record<string, string> = {
  lean: 'text-emerald-600 dark:text-emerald-400',
  mid: 'text-sky-600 dark:text-sky-400',
  high: 'text-amber-600 dark:text-amber-400',
  top: 'text-rose-600 dark:text-rose-400',
}

/** Which box answers which criterion, and what it is called. */
const TILE: Partial<Record<CriterionKey, { label: string }>> = {
  cost: { label: 'What a month costs' },
  climate: { label: 'Winter' },
  beach: { label: 'The sea' },
  training: { label: 'Training as a beginner' },
  connectivity: { label: 'Internet' },
  food: { label: 'Food' },
  safety: { label: 'Safe as an Israeli' },
  home: { label: 'A home' },
  proximity: { label: 'Getting home' },
  tax: { label: 'Tax' },
  admin: { label: 'Getting in' },
}

function PlaceCard({ place, order, stay }: { place: Place; order: CriterionKey[]; stay: StayKey }) {
  const country = COUNTRY.get(place.country)
  const scenery = sceneryFor(place)
  const lines = costsForStay(place, stay)
  const total = monthlyForStay(place, stay)
  const tier = tierOf(total)
  const autumn = autumnFor(place)

  return (
    <details className="card card-fold overflow-hidden">
      <summary className="cursor-pointer list-none p-3">
        <div className="flex items-start gap-3">
          <PlacePhoto
            place={place}
            className="h-12 w-20 shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-[var(--ink)]">{place.name}</span>
              <span className="shrink-0 rounded border border-[var(--line)] px-1 py-px text-[0.5625rem] uppercase tracking-wide text-[var(--ink-muted)]">
                {country?.country ?? place.country}
              </span>
            </div>
            <div className="truncate text-[0.6875rem] text-[var(--ink-muted)]">{place.where}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Tag>{'●'.repeat(place.fit) + '○'.repeat(5 - place.fit)}</Tag>
              {place.mma ? <Tag tone="good">Beginner classes</Tag> : <Tag tone="muted">No mat</Tag>}
              <Tag tone={place.house === 'normal' ? 'good' : 'muted'}>{HOUSE_LABEL[place.house]}</Tag>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className={clsx('tabular text-sm font-semibold', TIER_TONE[tier])}>
              €{total.toLocaleString()}
            </div>
            <div className="text-[0.625rem] text-[var(--ink-muted)]">a month{stay === 'test' ? ', short let' : ''}</div>
          </div>
          <span className="fold-chevron mt-1 text-[var(--ink-muted)]" aria-hidden>
            ›
          </span>
        </div>
      </summary>

      <div className="border-t border-[var(--line)]">
        <PlacePhoto
          place={place}
          className="h-24 w-full object-cover"
        />
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          {order.map((key) => (
            <Box key={key} criterion={key} place={place} stay={stay} lines={lines} total={total} />
          ))}
          <Box criterion="townInfo" place={place} stay={stay} lines={lines} total={total} />
          <Box criterion="catch" place={place} stay={stay} lines={lines} total={total} />
        </div>
      </div>
    </details>
  )
}

type BoxKey = CriterionKey | 'townInfo' | 'catch'

function Box({
  criterion,
  place,
  stay,
  lines,
  total,
}: {
  criterion: BoxKey
  place: Place
  stay: StayKey
  lines: CostLines
  total: number
}) {
  const country = COUNTRY.get(place.country)
  const scenery = sceneryFor(place)
  const net = CONNECTIVITY[place.country]
  const safety = SAFETY[place.country]
  const entry = ENTRY[place.country]
  const climate = TRAINING_CLIMATE[place.country]

  switch (criterion) {
    case 'cost':
      return (
        <Shell title="What a month costs" wide accent>
          <CostTable lines={lines} total={total} stay={stay} place={place} />
        </Shell>
      )
    case 'home': {
      const spots = spotsFor(place.id)
      const autumn = autumnFor(place)
      return (
        <Shell title="Where exactly to stay" wide tile={<HouseTile scenery={scenery} />}>
          <div className="flex flex-wrap gap-1">
            <Fact label="Typical">{place.rent}</Fact>
            {autumn ? (
              <Fact label="Your months">
                about {Math.round(autumn.offSeasonRent * 100)}% of the annual rate
              </Fact>
            ) : null}
          </div>
          {spots.length > 0 ? (
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {spots.map((spot) => (
                <SpotCard key={spot.name} spot={spot} country={place.country} />
              ))}
            </div>
          ) : (
            <Note>No street-level spot written for this town yet.</Note>
          )}
        </Shell>
      )
    }
    case 'beach':
      return (
        <Shell title="The sea" tile={<ShoreTile scenery={scenery} />}>
          <p>{place.beach}</p>
        </Shell>
      )
    case 'training':
      return (
        <Shell title="Training as a beginner" wide tile={<GymTile hasMat={place.mma} scenery={scenery} />}>
          <p>{place.train}</p>
          {BEGINNER[place.id] ? <p className="mt-1">{BEGINNER[place.id]}</p> : null}
          {climate ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Fact label="Month">{climate.price}</Fact>
              <Fact label="Taught in">{climate.language}</Fact>
              <Fact label="Joining">{climate.joining}</Fact>
            </div>
          ) : null}
        </Shell>
      )
    case 'connectivity':
      return (
        <Shell title="Internet">
          <p className="font-medium text-[var(--ink)]">{place.net}</p>
          {net ? (
            <>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Fact label="Line">{net.line}</Fact>
                <Fact label="Mobile">{net.mobile}</Fact>
              </div>
              <p
                className={clsx(
                  'mt-1.5 text-[0.625rem]',
                  net.fallbackMatters >= 4
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-[var(--ink-muted)]',
                )}
              >
                {net.fallbackMatters >= 4
                  ? 'Budget for a second line or Starlink — one connection is not enough here.'
                  : 'A data SIM is enough of a backup here.'}{' '}
                Check the exact street number before signing: {net.checker}
              </p>
            </>
          ) : null}
        </Shell>
      )
    case 'food':
      return (
        <Shell title="Food">
          <p>{place.food}</p>
        </Shell>
      )
    case 'climate': {
      const autumn = autumnFor(place)
      if (!autumn) return null
      return (
        <Shell title="Late September to December" wide accent>
          <p className="font-medium text-[var(--ink)]">{autumn.verdict}</p>
          <table className="mt-1.5 w-full text-[0.6875rem]">
            <thead>
              <tr className="text-[var(--ink-muted)]">
                <th className="text-left font-normal" />
                <th className="w-12 pl-2 text-right font-normal">Day</th>
                <th className="w-12 pl-2 text-right font-normal">Sea</th>
                <th className="w-10 pl-2 text-right font-normal">Rain</th>
                <th className="pl-3 text-left font-normal">What it is like</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map(({ key, label }) => {
                const month = autumn.months[key]
                return (
                  <tr key={key}>
                    <td className="py-0.5 pr-2 font-medium text-[var(--ink)]">{label}</td>
                    <td className="tabular py-0.5 pl-2 text-right">{month.day}°C</td>
                    <td className="tabular py-0.5 pl-2 text-right">{month.sea === null ? '—' : `${month.sea}°C`}</td>
                    <td
                      className={clsx(
                        'tabular py-0.5 pl-2 text-right',
                        month.rain >= 14 && 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {month.rain}
                    </td>
                    <td className="py-0.5 pl-3">{month.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-1.5 text-[0.625rem] text-[var(--ink-muted)]">
            <strong className="text-[var(--ink)]">Still open in November and December:</strong>{' '}
            {autumn.open}
          </p>
        </Shell>
      )
    }
    case 'safety':
      return safety ? (
        <Shell title="Safe as an Israeli">
          <div className="flex items-center gap-2">
            <Score value={safety.score} />
            <p className="min-w-0 flex-1 font-medium text-[var(--ink)]">{safety.verdict}</p>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Fact label="Street" tone={safety.score <= 2 ? 'warn' : undefined}>{safety.street}</Fact>
            <Fact label="Official">{safety.official}</Fact>
          </div>
        </Shell>
      ) : null
    case 'proximity':
      return (
        <Shell title="Getting home">
          <p>
            Return flights from Tel Aviv run about €{FLIGHT_HOME[place.country]?.toLocaleString()}.
          </p>
        </Shell>
      )
    case 'tax':
      return (
        <Shell title="Tax">
          <p>{country?.taxLine}</p>
        </Shell>
      )
    case 'admin':
      return entry ? (
        <Shell title="Getting in">
          <div className="flex flex-wrap gap-1">
            <Fact label="Polish passport">{entry.polish}</Fact>
            <Fact label="Israeli passport">{entry.israeli}</Fact>
            <Fact label="Past that">{entry.limit}</Fact>
          </div>
        </Shell>
      ) : null
    case 'townInfo':
      return (
        <Shell title="The town">
          <p>{place.town}</p>
        </Shell>
      )
    case 'catch':
      return (
        <Shell title="The catch" tone="warn">
          <p>{place.catch}</p>
        </Shell>
      )
    default:
      return null
  }
}

function CostTable({
  lines,
  total,
  stay,
  place,
}: {
  lines: CostLines
  total: number
  stay: StayKey
  place: Place
}) {
  const max = Math.max(...CATEGORIES.map((category) => lines[category.key]))
  return (
    <div>
      <table className="w-full text-[0.6875rem]">
        <tbody>
          {CATEGORIES.map((category) => {
            const value = lines[category.key]
            return (
              <tr key={category.key}>
                <td className="py-0.5 pr-2 align-middle text-[var(--ink-secondary)]">{category.label}</td>
                <td className="w-1/2 py-0.5 pr-2 align-middle">
                  <span
                    className="block h-1.5 rounded-full bg-[var(--accent)]"
                    style={{ width: `${Math.max(3, (value / max) * 100)}%`, opacity: 0.55 }}
                  />
                </td>
                <td className="tabular py-0.5 text-right align-middle font-medium text-[var(--ink)]">
                  €{value.toLocaleString()}
                </td>
              </tr>
            )
          })}
          <tr className="border-t border-[var(--line)]">
            <td className="pt-1 font-semibold text-[var(--ink)]">Total</td>
            <td />
            <td className="tabular pt-1 text-right font-semibold text-[var(--ink)]">
              €{total.toLocaleString()}
            </td>

          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[0.625rem] text-[var(--ink-muted)]">
        {stay === 'test'
          ? `Priced as a three-month stay: furnished short let, travel insurance, and eating out more. Three months here is about €${(total * 3 + (FLIGHT_HOME[place.country] ?? 0)).toLocaleString()} including flights.`
          : 'Priced as a twelve-month lease with local health cover and a local tax number.'}
      </p>
    </div>
  )
}

function Shell({
  title,
  children,
  wide,
  tone,
  accent,
  tile,
}: {
  title: string
  children: React.ReactNode
  wide?: boolean
  tone?: 'warn'
  accent?: boolean
  tile?: React.ReactNode
}) {
  return (
    <section
      className={clsx(
        'rounded-lg border p-2.5',
        wide && 'sm:col-span-2',
        tone === 'warn'
          ? 'border-amber-500/40 bg-amber-500/5'
          : accent
            ? 'border-[var(--line)] bg-[var(--surface-sunken)]'
            : 'border-[var(--line)]',
      )}
    >
      <h4 className="mb-1.5 text-[0.625rem] uppercase tracking-wide text-[var(--ink-muted)]">{title}</h4>
      <div className="flex gap-2.5">
        {tile ? <div className="text-[var(--ink)]">{tile}</div> : null}
        <div
          className={clsx(
            'min-w-0 flex-1 text-xs leading-relaxed',
            tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--ink-secondary)]',
          )}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

function Fact({
  label,
  children,
  tone,
}: {
  label: string
  children: React.ReactNode
  tone?: 'warn'
}) {
  return (
    <span
      title={typeof children === 'string' ? children : undefined}
      className={clsx(
        'line-clamp-2 max-w-full rounded border px-1.5 py-1 text-[0.625rem] leading-snug',
        tone === 'warn'
          ? 'border-amber-500/40 text-amber-700 dark:text-amber-400'
          : 'border-[var(--line)] text-[var(--ink-secondary)]',
      )}
    >
      <span className="font-semibold text-[var(--ink)]">{label}:</span> {children}
    </span>
  )
}

function Score({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 gap-px" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={clsx(
            'h-3 w-1.5 rounded-sm',
            step <= value
              ? value <= 2
                ? 'bg-rose-500'
                : value === 3
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              : 'bg-[var(--surface-sunken)]',
          )}
        />
      ))}
    </span>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[0.625rem] text-[var(--ink-muted)]">{children}</p>
}

function Tag({ tone = 'plain', children }: { tone?: 'plain' | 'good' | 'muted'; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        'rounded-full border px-1.5 py-px text-[0.5625rem]',
        tone === 'good'
          ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
          : tone === 'muted'
            ? 'border-[var(--line)] text-[var(--ink-muted)]'
            : 'border-[var(--line)] text-[var(--ink-secondary)]',
      )}
    >
      {children}
    </span>
  )
}
