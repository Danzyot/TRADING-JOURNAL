import { redirect } from 'next/navigation'

/**
 * Analytics moved into the journal.
 *
 * The two pages answered the same question at different zoom levels — what
 * these trades add up to — and kept the same numbers in two places, where they
 * could disagree. The charts, the breakdowns and the findings now sit folded
 * below the trades that produced them.
 *
 * The redirect stays because the old address is on a home screen and in links
 * shared before the move.
 */
export const dynamic = 'force-dynamic'

export default function AnalyticsRedirect() {
  redirect('/trades')
}
