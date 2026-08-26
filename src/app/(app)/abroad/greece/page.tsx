import Link from 'next/link'
import { Badge, Card, CollapsibleCard, PageHeader, Stat, StatGrid } from '@/components/ui'
import {
  CHANIA_YEAR,
  CLIMATE_SOURCES,
  CLIMATE_VERDICT,
  GREECE_VERIFIED,
  HOUSE_CHECKLIST,
  PLACES,
  SETUP_SOURCES,
  SETUP_STEPS,
} from '@/lib/abroad/greece'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Greece in depth — Trading Journal' }

export default function GreecePage() {
  const wettest = [...CHANIA_YEAR].sort((a, b) => b.rainMm - a.rainMm)[0]
  const coldest = [...CHANIA_YEAR].sort((a, b) => a.high - b.high)[0]

  return (
    <>
      <PageHeader
        title="Greece in depth"
        subtitle="The winter question answered with numbers, the towns worth living in, and what to check before you sign for a house."
        actions={
          <Link href="/abroad" className="btn">
            ← All countries
          </Link>
        }
      />

      <StatGrid columns={4}>
        <Card bodyClassName="p-4">
          <Stat label="December in Chania" value={`${CHANIA_YEAR[2].high}°C`} hint="daytime average, with a 19°C sea" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Coldest month" value={`${coldest.high}°C`} hint={`${coldest.month} — and ~6 hours of sun`} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Wettest month" value={`${wettest.rainMm}mm`} hint={`${wettest.month}, over ~${wettest.rainDays} days`} tone="warn" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Tax exemption" value="50%" hint="of business income, for 7 years" tone="good" />
        </Card>
      </StatGrid>

      <div className="mt-6">
        <Card
          title="Is Q4 cold?"
          description="The thing you actually asked. Chania, month by month."
        >
          <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">{CLIMATE_VERDICT}</p>

          <div className="scroll-x mt-4">
            <table className="data">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Day</th>
                  <th className="text-right">Night</th>
                  <th className="text-right">Rain days</th>
                  <th className="text-right">Rain</th>
                  <th>What it feels like</th>
                </tr>
              </thead>
              <tbody>
                {CHANIA_YEAR.map((month) => (
                  <tr key={month.month}>
                    <td className="font-medium text-[var(--ink)]">{month.month}</td>
                    <td className="tabular text-right">{month.high}°C</td>
                    <td className="tabular text-right">{month.low}°C</td>
                    <td className="tabular text-right">{month.rainDays}</td>
                    <td className="tabular text-right">{month.rainMm}mm</td>
                    <td className="text-xs text-[var(--ink-secondary)]">{month.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.625rem]">
            {CLIMATE_SOURCES.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--accent)] hover:underline"
              >
                {source.label}
              </a>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">Where, specifically</h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Ordered by fit for the brief: a house near a beach, in a town with a gym, an MMA room and a
            hospital, that does not shut in November.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {PLACES.map((place) => (
            <CollapsibleCard
              key={place.slug}
              title={place.name}
              description={place.pitch}
              summary={`${place.fit}/5`}
              defaultOpen={place.slug === 'chania'}
            >
              <div className="space-y-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                <p>
                  <Badge tone="neutral">{place.region}</Badge>
                </p>
                <p>
                  <strong className="text-[var(--ink)]">The house.</strong> {place.house}
                </p>
                <p>
                  <strong className="text-[var(--ink)]">Training.</strong> {place.training}
                </p>
                <p>
                  <strong className="text-[var(--ink)]">Practical.</strong> {place.practical}
                </p>
                <p>
                  <strong className="text-[var(--ink)]">Winter.</strong> {place.winter}
                </p>
                <p className="rounded-lg bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] p-2.5 text-[var(--serious)]">
                  <strong>Watch out.</strong> {place.watchOut}
                </p>
              </div>
            </CollapsibleCard>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card
          title="Before you sign for a house"
          description="In the order these things bite, not the order an agent raises them."
        >
          <ol className="space-y-3">
            {HOUSE_CHECKLIST.map((item, index) => (
              <li key={item.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[0.625rem] font-semibold text-[var(--accent)]"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--ink)]">{item.title}</p>
                  <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card
          title="Landing there, in order"
          description="With a Polish passport this is registration, not immigration."
        >
          <ol className="space-y-3">
            {SETUP_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[0.625rem] font-semibold text-[var(--accent)]"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--ink)]">{step.title}</p>
                  <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-4 rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
            The trading day does not move: Greece keeps the same clock as Israel, so the New York open
            stays at 16:30 local and the close at 23:00. It is the one thing you do not have to plan
            around — and the reason Thailand, on paper the best training in the world, is not on the
            shortlist. The{' '}
            <Link href="/tax" className="text-[var(--accent)] hover:underline">
              tax page
            </Link>{' '}
            carries the exit rules from Israel, which are the part that actually decides when this can
            happen.
          </p>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.625rem]">
            {SETUP_SOURCES.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--accent)] hover:underline"
              >
                {source.label}
              </a>
            ))}
          </div>
        </Card>
      </div>

      <p className="mt-4 text-center text-[0.625rem] text-[var(--ink-muted)]">
        Researched {GREECE_VERIFIED}. Climate figures are long-run monthly averages — any single
        winter can be wetter or milder than this.
      </p>
    </>
  )
}
