import Link from 'next/link'
import { Card, PageHeader } from '@/components/ui'
import { ABROAD_VERIFIED, CANDIDATES } from '@/lib/abroad/countries'
import { PLACES } from '@/lib/abroad/places'
import { monthlyOf } from '@/lib/abroad/costs'
import { SPOTS } from '@/lib/abroad/stays'
import { PlacesBrowser } from './browser'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Every place — Trading Journal' }

const withMat = PLACES.filter((place) => place.mma).length
const withHouse = PLACES.filter((place) => place.house === 'normal').length
const underTwoK = PLACES.filter((place) => monthlyOf(place) < 2000).length
const spotCount = Object.values(SPOTS).reduce((sum, spots) => sum + (spots?.length ?? 0), 0)

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>
}) {
  const { country } = await searchParams
  return (
    <>
      <PageHeader
        title="Every place"
        subtitle={`${PLACES.length} towns across ${CANDIDATES.length} countries, each answering the same questions, scored for late September to December. Filter to the ones you could actually sign a lease in.`}
        actions={
          <div className="flex gap-2">
            <Link href="/abroad" className="btn">
              ← Countries
            </Link>
            <Link href="/abroad/trip" className="btn btn-primary">
              Plan a trip
            </Link>
          </div>
        }
      />

      <Card title="Before you read the list">
        <div className="grid grid-cols-1 gap-3 text-xs leading-relaxed text-[var(--ink-secondary)] sm:grid-cols-3">
          <p>
            <strong className="text-[var(--ink)]">{spotCount} named neighbourhoods.</strong>{' '}
            Not a town — a street. Each one carries the rent for your
            months, minutes to the mat, the water and a shop, the fibre at that address, and links
            to the map, to listings for 25 September to 20 December, and to the gym.
          </p>
          <p>
            <strong className="text-[var(--ink)]">{withHouse} make a whole house normal.</strong>{' '}
            Not possible — normal, meaning it is the ordinary thing people rent long-term rather than
            a search that takes six months. Sliema and Dubai Marina are flats, and no amount of money
            changes that.
          </p>
          <p>
            <strong className="text-[var(--ink)]">{underTwoK} of {PLACES.length} come in under
            €2,000 a month.</strong> Every figure is euros for one person living comfortably with
            rent included, built from nine lines you can see. They are for ordering towns, not for
            budgeting.
          </p>
        </div>
      </Card>

      <div className="mt-4">
        <PlacesBrowser initialCountry={country} />
      </div>

      <div className="mt-6">
        <Card title="What the fields mean">
          <div className="space-y-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <p>
              <strong className="text-[var(--ink)]">Fit</strong> is a judgement, 1–5, against one
              brief: sea you can swim in, sun through the winter, a mat, a gym, somewhere to run,
              unprocessed food, fibre you can hold a position on, and a rent a payout covers.
              A town can be beautiful and score 2 because it fails four of those.
            </p>
            <p>
              <strong className="text-[var(--ink)]">Gyms are named where they exist.</strong> Every
              academy on this page was verified as trading with an adult schedule as of{' '}
              {ABROAD_VERIFIED}. Schedules change and coaches move — call before you sign a lease on
              the strength of one.
            </p>
            <p>
              <strong className="text-[var(--ink)]">The catch is the point of each entry.</strong>{' '}
              Anywhere can be sold; the line that matters is the one that would make you leave after a
              year. Rain, a dead November, a 40-minute drive to training, a timezone that puts the New
              York open at 20:30.
            </p>
            <p className="text-[var(--ink-muted)]">
              Rents and costs move faster than anything else here. Treat them as ordering, not as a
              budget, and re-check the two or three you are serious about.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
