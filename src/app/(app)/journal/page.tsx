import { redirect } from 'next/navigation'

/**
 * The journal moved into the trades page.
 *
 * Two pages described the same day from different angles: one listed the round
 * trips built from fills, the other the setups logged by hand, and both were
 * "what happened today". They are one page now.
 *
 * This redirect stays because the old address is on a home screen, in the app
 * manifest's shortcuts, and in whatever links were shared before the move.
 */
export const dynamic = 'force-dynamic'

export default async function JournalRedirect({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  if (params.date) query.set('date', params.date)
  if (params.month) query.set('month', params.month)
  const search = query.toString()
  redirect(search ? `/trades?${search}` : '/trades')
}
