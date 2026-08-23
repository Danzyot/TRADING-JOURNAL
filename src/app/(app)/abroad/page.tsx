import Link from 'next/link'
import { Card, CollapsibleCard, KeyValue, PageHeader } from '@/components/ui'
import { WeightedRanking } from './weights'
import { ABROAD_VERIFIED, BENCHMARK, CANDIDATES } from '@/lib/abroad/countries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Where to live — Trading Journal' }

export default function AbroadPage() {
  return (
    <>
      <PageHeader
        title="Where to live"
        subtitle="Research, not a plan: eight places measured against the life you actually want, with the weights in your hands."
        actions={
          <Link href="/abroad/greece" className="btn btn-primary">
            Greece in depth
          </Link>
        }
      />

      <Card title="The short version">
        <div className="space-y-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
          <p>
            <strong className="text-[var(--ink)]">Greece is the right first move, and Crete is the
            right part of Greece.</strong> It is the only candidate that scores well on every line of
            the brief at once — sea, sun, food, cost, an MMA room, a two-hour flight home — and the
            one tax regime on this list that a prop trader can actually use: Article 5C exempts half
            your business income for seven years, and social contributions are a fixed monthly class
            rather than a percentage of what you earn.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Your Q4 worry is misplaced, but not baseless.</strong>{' '}
            December in Chania averages a 17°C day — warmer than a Tel Aviv January. What Q4 brings is
            rain, not cold, and January is the month that decides whether you like it: about 18 rainy
            days and six hours of sun. That is survivable in a town with a gym and fibre, and grim in
            a village without them.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Cyprus is the hedge.</strong> Warmer and drier in
            winter, 45 minutes from home, the best tax answer on the list — and the least like the life
            you described. If the point is a change of life rather than a change of tax rate, it is the
            fallback, not the plan.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Two that look right and are not:</strong> Spain has
            the best day-to-day life here and the worst tax answer — the Beckham regime excludes
            freelancers, leaving you on 19–47% plus social security. Thailand has the best training on
            earth for this sport and a New York open at 20:30 local.
          </p>
        </div>
      </Card>

      <div className="mt-6">
        <WeightedRanking />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CANDIDATES.map((candidate) => (
          <CollapsibleCard
            key={candidate.slug}
            title={`${candidate.flag} ${candidate.country}`}
            description={candidate.headline}
            summary={candidate.spots[0]}
          >
            <div className="space-y-0">
              <KeyValue label="Where, specifically" value={candidate.spots.join(' · ')} />
              <KeyValue label="A comfortable month" value={candidate.monthlyCost} />
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
