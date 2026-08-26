import Link from 'next/link'
import { Card, CollapsibleCard, KeyValue, PageHeader } from '@/components/ui'
import { WeightedRanking } from './weights'
import { ABROAD_VERIFIED, BENCHMARK, CANDIDATES } from '@/lib/abroad/countries'
import { PLACES, costRange, placesOf } from '@/lib/abroad/places'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Where to live — Trading Journal' }

/** "5 towns, €1,700–2,800 a month" — the country's range, taken from its towns. */
function townLine(slug: string): string {
  const places = placesOf(slug)
  const range = costRange(places)
  if (!range) return 'none yet'
  const span =
    range.low === range.high
      ? `€${range.low.toLocaleString()}`
      : `€${range.low.toLocaleString()}–${range.high.toLocaleString()}`
  return `${places.length} ${places.length === 1 ? 'town' : 'towns'}, ${span} a month`
}

export default function AbroadPage() {
  return (
    <>
      <PageHeader
        title="Where to live"
        subtitle={`Research, not a plan: ${CANDIDATES.length} countries and ${PLACES.length} specific towns measured against the life you actually want, with the weights in your hands.`}
        actions={
          <div className="flex gap-2">
            <Link href="/abroad/places" className="btn">
              Every place
            </Link>
            <Link href="/abroad/trip" className="btn">
              Plan a trip
            </Link>
            <Link href="/abroad/greece" className="btn btn-primary">
              Greece in depth
            </Link>
          </div>
        }
      />

      <Card title="The short version">
        <div className="space-y-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
          <p>
            <strong className="text-[var(--ink)]">Greece is still the right first move, and Crete is
            still the right part of Greece.</strong> Eighteen countries later nothing has displaced
            it: it is the only candidate that scores well on every line of the brief at once — sea,
            sun, food, cost, an MMA room, a two-hour flight home — and the one tax regime here that a
            prop trader can actually use. Article 5C exempts half your business income for seven
            years, and EFKA is a fixed monthly class rather than a percentage of what you earn.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Your Q4 worry is misplaced, but not baseless.</strong>{' '}
            December in Chania averages a 17°C day — warmer than a Tel Aviv January. What Q4 brings is
            rain, not cold, and January is the month that decides whether you like it: about 18 rainy
            days and six hours of sun. Survivable in a town with a gym and fibre; grim in a village
            without them.
          </p>
          <p>
            <strong className="text-[var(--ink)]">The three real challengers.</strong> Alicante has
            the best training in Europe — Climent Club and Fightzone, and Spain&apos;s tax answer is the
            worst on this list. Valencia is the best day-to-day life on the list at any price, with
            the same tax problem. Limassol is the best tax answer and the least like the life you
            described.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Two cheap outliers worth taking seriously.</strong>{' '}
            Georgia charges 1% of turnover and Tbilisi has real mats and the best food per euro
            anywhere — and no sea, and a Russian border. Albania charges 0% up to ~€135,000 until
            2029 and Himarë is beautiful — and the training answer is a flat no.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Two you should stop thinking about.</strong> The
            United States fits the brief better than anywhere — Miami, San Diego, the market opening
            at 09:30 where you live — and you have no right to be there. Portugal is on every list
            like this and should not be on yours: IFICI, the regime that replaced NHR, specifically
            excludes remote work for foreign clients.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Poland is the floor under all of it.</strong> You
            are already a citizen, so it is the one country that cannot refuse you: real MMA, real
            food, low cost, gigabit everywhere. It fails on exactly one criterion — a December that
            is 2°C and dark at 15:30 — which is why it is the fallback rather than the plan.
          </p>
        </div>
      </Card>

      <div className="mt-6">
        <WeightedRanking />
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {CANDIDATES.map((candidate) => (
          <CollapsibleCard
            key={candidate.slug}
            title={candidate.country}
            description={candidate.headline}
            summary={candidate.spots[0]}
          >
            <div className="space-y-0">
              <KeyValue label="Where, specifically" value={candidate.spots.join(' · ')} />
              <KeyValue label="A comfortable month" value={candidate.monthlyCost} />
              <KeyValue
                label="Towns detailed"
                value={
                  <Link
                    href={`/abroad/places?country=${candidate.slug}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {townLine(candidate.slug)} →
                  </Link>
                }
              />
            </div>

            <div className="mt-3 space-y-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
              <p>
                <strong className="text-[var(--ink)]">Tax.</strong> {candidate.taxLine}
              </p>
              <p>
                <strong className="text-[var(--ink)]">The catch.</strong> {candidate.theCatch}
              </p>
              {candidate.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--line)] pt-2 text-[0.625rem]">
              {candidate.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target={source.url.startsWith('/') ? undefined : '_blank'}
                  rel="noreferrer noopener"
                  className="text-[var(--accent)] hover:underline"
                >
                  {source.label}
                </a>
              ))}
            </div>
          </CollapsibleCard>
        ))}
      </div>

      <div className="mt-6">
        <Card title="How to read any of this">
          <div className="space-y-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <p>
              <strong className="text-[var(--ink)]">The benchmark is staying put.</strong>{' '}
              {BENCHMARK.cost} Every cost figure here is what a comfortable month costs a single
              person, rent included, from published 2026 cost-of-living data — not a holiday budget
              and not a survival budget.
            </p>
            <p>
              <strong className="text-[var(--ink)]">None of the tax rates exist until Israel lets
              go.</strong> Residency follows your centre of life, and a foreign address while your life
              stays in Israel changes nothing. The order is: pick the life, move it for real, then the
              regime applies. The <Link href="/tax" className="text-[var(--accent)] hover:underline">tax
              page</Link> carries the detailed comparison and the exit rules.
            </p>
            <p>
              <strong className="text-[var(--ink)]">Scores are judgements; figures are sourced.</strong>{' '}
              Every number on this page has a link next to it. The 0–5 scores are mine, against your
              brief — argue with them by moving the weights, which is what they are there for.
            </p>
            <p className="text-[var(--ink-muted)]">Researched {ABROAD_VERIFIED}. Rents, tax regimes
            and flight routes all move; re-check anything decisive before you act on it.</p>
          </div>
        </Card>
      </div>
    </>
  )
}
