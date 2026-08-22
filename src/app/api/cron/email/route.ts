import { runJob } from '../_shared'
import { runEmailIngest } from '@/server/email-ingest'
import { runDigest } from '@/server/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * The scheduled check-in: read the inboxes, then say something if it matters.
 *
 * Designed to be called often — hourly is sensible — because the window it
 * reads overlaps itself and every event is deduped on the email's Message-ID.
 * `?days=` widens the window for a backfill: `?days=14` after setting the
 * mailbox up will catch the fortnight the journal missed.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const requested = Number(params.get('days'))
  const days = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 60) : 2
  // `slot` decides whether a summary follows the inbox read. Anything other
  // than "evening" is treated as a morning check, which never summarises —
  // the inbox pushes its own news as it reads it.
  const slot = params.get('slot') === 'evening' ? 'evening' : 'morning'

  return runJob(request, 'cron_email', async () => {
    const summary = await runEmailIngest({ days })
    const counts = `days=${days} scanned=${summary.scanned} applied=${summary.applied} skipped=${summary.skipped}`

    // A mailbox that cannot be reached has to fail the job, not report a
    // cheerful zero: a wrong password would otherwise leave the schedule
    // green while nothing was ever read. Whatever did apply before the
    // failure is already written and deduped, so the retry is free.
    if (summary.errors.length > 0) {
      throw new Error(`${counts} — ${summary.errors.join('; ')}`.slice(0, 400))
    }

    // The digest runs after the inbox so the day's payouts are already in the
    // numbers it reports, and only after a clean read — summarising a run that
    // failed halfway would state figures that are simply wrong.
    const digest = await runDigest(slot)

    return {
      days,
      slot,
      scanned: summary.scanned,
      applied: summary.applied,
      skipped: summary.skipped,
      aiUsed: summary.aiUsed,
      digest: digest.sent ? digest.reason : 'not sent',
    }
  })
}

/** POST behaves identically, so schedulers that only send POST work too. */
export const POST = GET
