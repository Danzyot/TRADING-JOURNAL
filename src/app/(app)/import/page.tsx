import { redirect } from 'next/navigation'

/**
 * Import moved into the journal.
 *
 * It is the same job as everything else on that page — getting trades in — and
 * it is touched rarely, and never at all once the trade watcher is running. It
 * sits folded there beside the trades it produces, rather than holding a
 * permanent slot in the sidebar.
 *
 * The redirect stays because the old address is linked from the empty states
 * that appear before any trade exists.
 */
export const dynamic = 'force-dynamic'

export default function ImportRedirect() {
  redirect('/trades')
}
