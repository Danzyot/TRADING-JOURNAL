import Link from 'next/link'
import { Card, PageHeader } from '@/components/ui'
import { TripBuilder } from './builder'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Plan a trip — Trading Journal' }

export default async function TripPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string }>
}) {
  const { place } = await searchParams

  return (
    <>
      <PageHeader
        title="Plan a trip"
        subtitle="Pick a town and a length, and see what it actually costs end to end — flights, deposit and gloves included — against the same weeks at home."
        actions={
          <div className="flex gap-2">
            <Link href="/abroad" className="btn">
              ← Countries
            </Link>
            <Link href="/abroad/places" className="btn">
              Every place
            </Link>
          </div>
        }
      />

      <TripBuilder initialPlace={place} />

      <div className="mt-4">
        <Card title="What this is not, yet">
          <div className="space-y-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <p>
              A first pass. It prices the trip and answers the tax and entry questions, and it does
              not yet book anything, hold real flight prices, or remember more than one plan at a
              time. It lives in this browser rather than in the database, because it is a sketchpad
              you change ten times before you book, not a record of something that happened.
            </p>
            <p>
              The obvious next steps, when you want them: several saved plans side by side, live
              flight prices for real dates, a checklist that survives the trip, and the cost landing
              in Earnings and expenses once you actually go.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
