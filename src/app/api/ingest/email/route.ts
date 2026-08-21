import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeMachineRequest } from '@/lib/auth'
import { applyEmailEvents } from '@/server/email-ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Accepts pre-extracted email events from outside the app.
 *
 * The app reads the inboxes itself (see `/api/cron/email`); this endpoint
 * exists for anything that cannot be an IMAP mailbox — a mail-provider webhook,
 * a Zapier-style forwarder, or a manual replay of an email the parser was
 * taught to read after the fact.
 *
 * Deliberately dumb: validate, hand to the shared applier, report. Re-posting
 * the same events is a no-op, so a sender never has to be careful.
 *
 * Auth: the `CRON_SECRET` bearer, or `INGEST_SECRET` when set, so an outside
 * poster can hold a token that does not open the scheduled jobs.
 */

const eventSchema = z.object({
  /** The email's Message-ID (or any stable id) — the dedupe key. */
  sourceId: z.string().min(4).max(300),
  kind: z.enum(['payout', 'purchase', 'account_status', 'balance_snapshot', 'subscription', 'note']),
  summary: z.string().max(500),
  /** ISO date the event happened, from the email. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  firm: z.string().max(120).optional(),
  accountExternalId: z.string().max(120).optional(),
  amount: z.number().optional(),
  currency: z.string().max(8).optional(),
  /** payout: requested|approved|paid|denied · account_status: passed|failed|closed|paused */
  status: z.string().max(30).optional(),
  balance: z.number().optional(),
})

const bodySchema = z.object({ events: z.array(eventSchema).max(100) })

function authorized(request: Request): boolean {
  if (authorizeMachineRequest(request)) return true
  const ingest = process.env.INGEST_SECRET
  if (!ingest) return false
  return (request.headers.get('authorization') ?? '') === `Bearer ${ingest}`
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let events
  try {
    events = bodySchema.parse(await request.json()).events
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message.slice(0, 500) : 'Bad payload' },
      { status: 400 },
    )
  }

  const outcome = await applyEmailEvents(events)
  return NextResponse.json({ ok: outcome.errors.length === 0, ...outcome })
}
