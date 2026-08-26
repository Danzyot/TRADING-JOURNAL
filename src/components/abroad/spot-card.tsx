'use client'

import { airbnbSearch, longLetSearch, mapsSearch, WINDOW } from '@/lib/abroad/links'
import type { Spot } from '@/lib/abroad/stays'
import { clsx } from '@/components/ui'
import { WikiPhoto } from './photo'

/**
 * One spot, built to be scanned in two seconds.
 *
 * A photograph, three numbers, and three links out. Everything that was a
 * paragraph is now a number or a chip, because the question this answers —
 * "could I live on this street" — is answered by distances and a rent, not by
 * prose about the neighbourhood's character.
 */
export function SpotCard({ spot, country }: { spot: Spot; country: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)]">
      <div className="flex gap-3 p-2">
        <WikiPhoto
          title={spot.wiki}
          alt={spot.name}
          className="h-20 w-28 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-xs font-semibold text-[var(--ink)]">{spot.name}</p>
            <p className="tabular ml-auto shrink-0 text-xs font-semibold text-[var(--accent)]">
              €{spot.rent[0].toLocaleString()}–{spot.rent[1].toLocaleString()}
            </p>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[0.6875rem] leading-snug text-[var(--ink-secondary)]">
            {spot.what}
          </p>

          <dl className="mt-1.5 grid grid-cols-3 gap-1">
            <Stat icon="🥋" label="mat">{spot.mat}</Stat>
            <Stat icon="🌊" label="sea">{spot.sea}</Stat>
            <Stat icon="🛒" label="shops">{spot.shop}</Stat>
          </dl>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-[var(--line)] px-2 py-1.5">
        <Out href={mapsSearch(spot.area)}>Map</Out>
        <Out href={airbnbSearch(spot.area)}>Airbnb · your dates</Out>
        <Out href={longLetSearch(spot.area, country)}>Long lets</Out>
        <Out href={spot.gymUrl ?? mapsSearch(spot.gym)}>{spot.gym}</Out>
        <span className="ml-auto text-[0.5625rem] text-[var(--ink-muted)]">
          {WINDOW.from.slice(5)} → {WINDOW.to.slice(5)}
        </span>
      </div>

      <div className="grid gap-1 px-2 pb-2 text-[0.625rem] leading-snug sm:grid-cols-2">
        <p className="text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--ink-secondary)]">Fibre.</span> {spot.net}
        </p>
        <p className="text-amber-700 dark:text-amber-400">
          <span className="font-semibold">Snag.</span> {spot.snag}
        </p>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded border border-[var(--line)] px-1.5 py-1">
      <dt className="text-[0.5625rem] uppercase tracking-wide text-[var(--ink-muted)]">
        <span aria-hidden>{icon}</span> {label}
      </dt>
      <dd className="text-[0.625rem] leading-snug text-[var(--ink)]">{children}</dd>
    </div>
  )
}

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={clsx(
        'rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.625rem] text-[var(--ink-secondary)]',
        'transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {children} ↗
    </a>
  )
}
