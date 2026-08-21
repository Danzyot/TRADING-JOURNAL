import { runJob } from '../_shared'
import { runEmailIngest } from '@/server/email-ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Reads the prop-firm inboxes and logs whatever they contain.
 *
 * Designed to be called often — hourly is sensible — because the window it
 * reads overlaps itself and every event is deduped on the email's Message-ID.
 * `?days=` widens the window for a backfill: `?days=14` after setting the
 * mailbox up will catch the fortnight the journal missed.
 */
export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get('days'))
  const days = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 60) : 2

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

    return {
      days,
      scanned: summary.scanned,
      applied: summary.applied,
      skipped: summary.skipped,
      aiUsed: summary.aiUsed,
    }
  })
}

/** POST behaves identically, so schedulers that only send POST work too. */
export const POST = GET
