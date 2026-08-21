import { NextResponse } from 'next/server'
import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { accounts, emailEvents, expenses, payouts, propFirms } from '@/db/schema'
import { authorizeMachineRequest } from '@/lib/auth'
import { defaultDeductibleFor } from '@/lib/tax/israel'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Structured events extracted from the user's prop-firm emails.
 *
 * The extraction itself happens in the hourly automation (a Claude session
 * with Gmail access) — it reads each email and posts normalized events here.
 * This endpoint is deliberately dumb: validate, dedupe on the Gmail message
 * id, apply the effect, record the event. Re-posting the same inbox is a
 * no-op, so the automation never has to be careful.
 *
 * Auth: the CRON_SECRET bearer, or INGEST_SECRET when set (so the email
 * automation can hold its own token).
 */

const eventSchema = z.object({
  /** Gmail message id — the dedupe key. */
  sourceId: z.string().min(4),
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
  const header = request.headers.get('authorization') ?? ''
  return header === `Bearer ${ingest}`
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

  const [firms, accountRows] = await Promise.all([
    db.select().from(propFirms),
    db.select().from(accounts),
  ])

  const findFirm = (name?: string) =>
    name ? firms.find((f) => f.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(f.name.toLowerCase())) : undefined
  const findAccount = (externalId?: string) => {
    if (!externalId) return undefined
    const needle = externalId.toLowerCase()
    return accountRows.find(
      (a) =>
        a.externalId?.toLowerCase() === needle ||
        a.label.toLowerCase() === needle ||
        a.label.toLowerCase().includes(needle) ||
        needle.includes(a.label.toLowerCase()),
    )
  }

  let applied = 0
  let skipped = 0
  const errors: string[] = []

  for (const event of events) {
    const [existing] = await db
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(eq(emailEvents.sourceId, event.sourceId))
      .limit(1)
    if (existing) {
      skipped += 1
      continue
    }

    try {
      const firm = findFirm(event.firm)
      const account = findAccount(event.accountExternalId)

      if (event.kind === 'payout' && event.amount && event.amount > 0) {
        const status =
          event.status === 'paid'
            ? 'paid'
            : event.status === 'denied' || event.status === 'rejected'
              ? 'rejected'
              : event.status === 'approved'
                ? 'approved'
                : 'requested'
        await db.insert(payouts).values({
          firmId: firm?.id ?? null,
          accountId: account?.id ?? null,
          requestedOn: event.date,
          paidOn: status === 'paid' ? event.date : null,
          status,
          grossAmount: event.amount,
          profitSplit: firm?.profitSplit ?? 1,
          netAmount: event.amount,
          currency: event.currency ?? 'USD',
          fxRate: 1,
          netAmountBase: event.amount,
          notes: `From email: ${event.summary}`,
        })
      } else if (event.kind === 'purchase' && event.amount && event.amount > 0) {
        await db.insert(expenses).values({
          spentOn: event.date,
          category: 'eval_fee',
          vendor: firm?.name ?? event.firm ?? 'Prop firm',
          description: event.summary.slice(0, 200),
          amount: event.amount,
          currency: event.currency ?? 'USD',
          fxRate: 1,
          amountBase: event.amount,
          firmId: firm?.id ?? null,
          deductiblePercent: defaultDeductibleFor('eval_fee'),
          notes: 'Logged automatically from email',
        })
      } else if (event.kind === 'account_status' && account && event.status) {
        const status = ['passed', 'failed', 'closed', 'paused'].includes(event.status)
          ? (event.status as 'passed' | 'failed' | 'closed' | 'paused')
          : null
        if (status) {
          await db.update(accounts).set({ status }).where(eq(accounts.id, account.id))
        }
      } else if (event.kind === 'balance_snapshot' && account && typeof event.balance === 'number') {
        // Only move forward in time — a late-processed old email must not
        // overwrite a fresher balance from sync.
        const cutoff = `${event.date}T23:59:00Z`
        await db
          .update(accounts)
          .set({ currentBalance: event.balance, balanceUpdatedAt: new Date(cutoff) })
          .where(
            and(
              eq(accounts.id, account.id),
              or(
                sql`${accounts.balanceUpdatedAt} is null`,
                sql`${accounts.balanceUpdatedAt} < ${cutoff}::timestamptz`,
              ),
            ),
          )
      }
      // 'subscription' and 'note' record the event only — visible in the log,
      // no automatic side effect worth guessing at.

      await db.insert(emailEvents).values({
        sourceId: event.sourceId,
        kind: event.kind,
        summary: event.summary,
        payload: event as Record<string, unknown>,
      })
      applied += 1
    } catch (error) {
      errors.push(`${event.sourceId}: ${error instanceof Error ? error.message.slice(0, 120) : 'failed'}`)
    }
  }

  return NextResponse.json({ ok: errors.length === 0, applied, skipped, errors })
}
