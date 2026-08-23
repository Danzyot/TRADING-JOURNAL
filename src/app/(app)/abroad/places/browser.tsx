'use client'

import { useMemo, useState } from 'react'
import { CANDIDATES } from '@/lib/abroad/countries'
import {
  PLACES,
  TEL_AVIV_MONTHLY,
  filterPlaces,
  sortPlaces,
  tierOf,
  type Place,
  type SortKey,
} from '@/lib/abroad/places'
import { clsx } from '@/components/ui'

const COUNTRY = new Map(CANDIDATES.map((candidate) => [candidate.slug, candidate]))

const BUDGETS = [
  { label: 'Any', value: Infinity },
  { label: '≤ €1,500', value: 1500 },
  { label: '≤ €2,200', value: 2200 },
  { label: '≤ €3,000', value: 3000 },
] as const

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'fit', label: 'Best fit' },
  { key: 'cost', label: 'Cheapest' },
  { key: 'name', label: 'A–Z' },
]

const HOUSE_LABEL: Record<Place['house'], string> = {
  normal: 'Whole house normal',
  possible: 'House possible',
  rare: 'Flats only',
}

/**
 * Ninety-one towns is too many to read and exactly right to filter.
 *
 * So the page is a filter first and a list second: set the ceiling you can
 * actually pay, say whether a mat and a house are non-negotiable, and what is
 * left is the shortlist. Everything is client-side because the whole point is
 * that changing your mind costs nothing.
 */
export function PlacesBrowser({ initialCountry }: { initialCountry?: string }) {
  const [budget, setBudget] = useState<number>(Infinity)
  const [mmaOnly, setMmaOnly] = useState(false)
  const [houseOnly, setHouseOnly] = useState(false)
  const [countries, setCountries] = useState<string[]>(
    initialCountry && COUNTRY.has(initialCountry) ? [initialCountry] : [],
  )
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('fit')

  const shown = useMemo(
    () =>
      sortPlaces(
        filterPlaces(PLACES, {
          budget: budget === Infinity ? undefined : budget,
          mmaOnly,
          houseOnly,
          countries,
          query,
        }),
        sort,
      ),
    [budget, mmaOnly, houseOnly, countries, query, sort],
  )

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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Group label="A month costs at most">
            {BUDGETS.map((option) => (
              <Chip
                key={option.label}
                on={budget === option.value}
                onClick={() => setBudget(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </Group>

          <Group label="Must have">
            <Chip on={mmaOnly} onClick={() => setMmaOnly(!mmaOnly)}>
              A real mat
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
              <span aria-hidden>{candidate.flag}</span> {candidate.country}
            </Chip>
          ))}
        </div>

        <p className="text-[0.6875rem] text-[var(--ink-muted)]">
          {shown.length} of {PLACES.length} places · Tel Aviv, for scale, is about €
          {TEL_AVIV_MONTHLY.toLocaleString()} a month
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="card p-6 text-center text-sm text-[var(--ink-muted)]">
          Nothing matches all of that. Loosen the budget or drop one of the must-haves.
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
          {shown.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[0.625rem] uppercase tracking-wide text-[var(--ink-muted)]">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
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

function PlaceCard({ place }: { place: Place }) {
  const country = COUNTRY.get(place.country)
  const tier = tierOf(place.monthly)
  const savings = Math.round((1 - place.monthly / TEL_AVIV_MONTHLY) * 100)

  return (
    <details className="card card-fold">
      <summary className="cursor-pointer list-none p-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg" aria-hidden>
            {country?.flag ?? '•'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-[var(--ink)]">{place.name}</span>
              <span className="truncate text-[0.6875rem] text-[var(--ink-muted)]">{place.where}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Tag>{'●'.repeat(place.fit) + '○'.repeat(5 - place.fit)} fit</Tag>
              {place.mma ? <Tag tone="good">MMA + BJJ</Tag> : <Tag tone="muted">No mat</Tag>}
              <Tag tone={place.house === 'normal' ? 'good' : 'muted'}>{HOUSE_LABEL[place.house]}</Tag>
            </div>
          </div>
          <div className="text-right">
            <div className={clsx('tabular text-sm font-semibold', TIER_TONE[tier])}>
              €{place.monthly.toLocaleString()}
            </div>
            <div className="text-[0.625rem] text-[var(--ink-muted)]">
              {savings > 0 ? `${savings}% under Tel Aviv` : `${-savings}% over Tel Aviv`}
            </div>
          </div>
          <span className="fold-chevron mt-1 text-[var(--ink-muted)]" aria-hidden>
            ›
          </span>
        </div>
      </summary>

      <div className="border-t border-[var(--line)] px-3 pb-3 pt-2">
        <dl className="space-y-1.5 text-xs leading-relaxed">
          <Row label="A home">{place.rent}</Row>
          <Row label="The sea">{place.beach}</Row>
          <Row label="Training">{place.train}</Row>
          <Row label="Food">{place.food}</Row>
          <Row label="Internet">{place.net}</Row>
          <Row label="The town">{place.town}</Row>
          <Row label="The catch" tone="warn">
            {place.catch}
          </Row>
        </dl>
      </div>
    </details>
  )
}

function Row({
  label,
  tone,
  children,
}: {
  label: string
  tone?: 'warn'
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <dt className="text-[0.625rem] uppercase tracking-wide text-[var(--ink-muted)]">{label}</dt>
      <dd
        className={clsx(
          tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--ink-secondary)]',
        )}
      >
        {children}
      </dd>
    </div>
  )
}

function Tag({
  tone = 'plain',
  children,
}: {
  tone?: 'plain' | 'good' | 'muted'
  children: React.ReactNode
}) {
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
