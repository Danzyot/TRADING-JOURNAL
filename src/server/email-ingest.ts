import 'server-only'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, emailEvents, expenses, payouts, propFirms } from '@/db/schema'
import { classifyEmail, looksTransactional, type EmailEventDraft } from '@/lib/email/parse'
import { defaultDeductibleFor } from '@/lib/tax/israel'
import { aiConfigured, classifyEmailWithAi } from './ai'
import { fetchRecentMail, gmailConfigured } from './gmail'

/**
 * The email automation: inbox in, journal rows out.
 *
 * It runs on the server on a schedule, so payouts, evaluation fees and blown
 * accounts land in the journal whether or not anyone opens the app that week.
 *
 * Everything is keyed on the email's Message-ID, recorded in `email_events`.
 * Re-reading the same mail — which every run does, since the search window
 * overlaps deliberately — applies nothing twice, so the job is safe to trigger
 * as often as you like and safe to re-run after a failure.
 */

export type IngestSummary = {
  ok: boolean
  scanned: number
  applied: number
  skipped: number
  aiUsed: number
  errors: string[]
}

/** How many unmatched messages may go to the model in one run. */
const AI_BUDGET = 6

/**
 * Reads the configured inboxes and applies whatever they contain.
 *
 * `days` overlaps the schedule on purpose: an hourly job reading two days of
 * mail recovers on its own from any outage shorter than that, and dedupe makes
 * the overlap free.
 */
export async function runEmailIngest(options: { days?: number } = {}): Promise<IngestSummary> {
  if (!gmailConfigured()) {
    return {
      ok: false,
      scanned: 0,
      applied: 0,
      skipped: 0,
      aiUsed: 0,
      errors: ['No mailbox configured — set GMAIL_USER and GMAIL_APP_PASSWORD.'],
    }
  }

  const { emails, errors } = await fetchRecentMail(options.days ?? 2)

  const drafts: EmailEventDraft[] = []
  const unmatched: typeof emails = []
  for (const email of emails) {
    const matched = classifyEmail(email)
    if (matched.length > 0) drafts.push(...matched)
    else if (looksTransactional(email)) unmatched.push(email)
  }

  // The model only sees what the rules could not read, and only messages that
  // still look like they carry money or an account change.
  let aiUsed = 0
  if (unmatched.length > 0 && aiConfigured()) {
    const known = await knownSourceIds(unmatched.map((email) => email.id))
    for (const email of unmatched.slice(0, AI_BUDGET)) {
      if (known.has(email.id)) continue
      aiUsed += 1
      drafts.push(...(await classifyEmailWithAi(email)))
    }
  }

  const outcome = await applyEmailEvents(drafts)
  return {
    ok: errors.length === 0 && outcome.errors.length === 0,
    scanned: emails.length,
    applied: outcome.applied,
    skipped: outcome.skipped,
    aiUsed,
    errors: [...errors, ...outcome.errors],
  }
}

async function knownSourceIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({ sourceId: emailEvents.sourceId })
    .from(emailEvents)
    .where(inArray(emailEvents.sourceId, ids))
  return new Set(rows.map((row) => row.sourceId))
}

/**
 * Applies a batch of events, ignoring any already recorded.
 *
 * Writes are grouped by kind rather than issued per event: this runs against a
 * database a network hop away, where a loop of single-row inserts costs a
 * round trip each. An event is only recorded in `email_events` once its own
 * effect has been written, so a failed batch is retried on the next run rather
 * than being silently marked as done.
 */
export async function applyEmailEvents(
  drafts: EmailEventDraft[],
): Promise<{ applied: number; skipped: number; errors: string[] }> {
  if (drafts.length === 0) return { applied: 0, skipped: 0, errors: [] }

  // One email can produce the same event twice across mailboxes; keep the first.
  const unique = new Map<string, EmailEventDraft>()
  for (const draft of drafts) if (!unique.has(draft.sourceId)) unique.set(draft.sourceId, draft)

  const known = await knownSourceIds([...unique.keys()])
  const fresh = [...unique.values()].filter((draft) => !known.has(draft.sourceId))
  const skipped = unique.size - fresh.length
  if (fresh.length === 0) return { applied: 0, skipped, errors: [] }

  const [firms, accountRows] = await Promise.all([
    db.select().from(propFirms),
    db.select().from(accounts),
  ])

  const findFirm = (name?: string) => {
    if (!name) return undefined
    const needle = name.toLowerCase()
    return firms.find(
      (firm) => firm.name.toLowerCase().includes(needle) || needle.includes(firm.name.toLowerCase()),
    )
  }
  const findAccount = (externalId?: string) => {
    if (!externalId) return undefined
    const needle = externalId.toLowerCase()
    return accountRows.find(
      (account) =>
        account.externalId?.toLowerCase() === needle ||
        account.label.toLowerCase() === needle ||
        account.label.toLowerCase().includes(needle) ||
        needle.includes(account.label.toLowerCase()),
    )
  }

  const errors: string[] = []
  const recorded: EmailEventDraft[] = []

  const payoutRows: (typeof payouts.$inferInsert)[] = []
  const expenseRows: (typeof expenses.$inferInsert)[] = []
  const statusChanges: { accountId: number; status: 'passed' | 'failed' | 'closed' | 'paused' }[] = []
  const balanceChanges: { accountId: number; balance: number; cutoff: string }[] = []

  const payoutEvents: EmailEventDraft[] = []
  const expenseEvents: EmailEventDraft[] = []
  const otherEvents: EmailEventDraft[] = []

  for (const draft of fresh) {
    const firm = findFirm(draft.firm)
    const account = findAccount(draft.accountExternalId)

    if (draft.kind === 'payout' && draft.amount && draft.amount > 0) {
      const status =
        draft.status === 'paid'
          ? 'paid'
          : draft.status === 'denied' || draft.status === 'rejected'
            ? 'rejected'
            : draft.status === 'approved'
              ? 'approved'
              : 'requested'
      payoutRows.push({
        firmId: firm?.id ?? null,
        accountId: account?.id ?? null,
        requestedOn: draft.date,
        paidOn: status === 'paid' ? draft.date : null,
        status,
        grossAmount: draft.amount,
        profitSplit: firm?.profitSplit ?? 1,
        netAmount: draft.amount,
        currency: draft.currency ?? 'USD',
        fxRate: 1,
        netAmountBase: draft.amount,
        notes: `From email: ${draft.summary}`,
        source: 'email',
      })
      payoutEvents.push(draft)
      continue
    }

    if (draft.kind === 'purchase' && draft.amount && draft.amount > 0) {
      expenseRows.push({
        spentOn: draft.date,
        category: 'eval_fee',
        vendor: firm?.name ?? draft.firm ?? 'Prop firm',
        description: draft.summary.slice(0, 200),
        amount: draft.amount,
        currency: draft.currency ?? 'USD',
        fxRate: 1,
        amountBase: draft.amount,
        firmId: firm?.id ?? null,
        deductiblePercent: defaultDeductibleFor('eval_fee'),
        notes: 'Logged automatically from email',
        source: 'email',
      })
      expenseEvents.push(draft)
      continue
    }

    if (draft.kind === 'account_status' && account && draft.status) {
      const status = (['passed', 'failed', 'closed', 'paused'] as const).find(
        (candidate) => candidate === draft.status,
      )
      if (status) statusChanges.push({ accountId: account.id, status })
    } else if (draft.kind === 'balance_snapshot' && account && typeof draft.balance === 'number') {
      balanceChanges.push({
        accountId: account.id,
        balance: draft.balance,
        cutoff: `${draft.date}T23:59:00Z`,
      })
    }

    // 'subscription' and 'note' — and any event whose account or firm is not
    // in the journal yet — are recorded and shown in the log without guessing
    // at a side effect. Nothing is created on the user's behalf.
    otherEvents.push(draft)
  }

  const run = async (label: string, work: () => Promise<unknown>, events: EmailEventDraft[]) => {
    if (events.length === 0) return
    try {
      await work()
      recorded.push(...events)
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message.slice(0, 160) : 'failed'}`)
    }
  }

  await run('payouts', () => db.insert(payouts).values(payoutRows), payoutEvents)
  await run('expenses', () => db.insert(expenses).values(expenseRows), expenseEvents)

  await run(
    'accounts',
    async () => {
      for (const change of statusChanges) {
        await db.update(accounts).set({ status: change.status }).where(eq(accounts.id, change.accountId))
      }
      for (const change of balanceChanges) {
        // Only ever move a balance forward in time: a late-processed old email
        // must not overwrite a fresher balance that came from broker sync.
        await db
          .update(accounts)
          .set({ currentBalance: change.balance, balanceUpdatedAt: new Date(change.cutoff) })
          .where(
            and(
              eq(accounts.id, change.accountId),
              or(
                sql`${accounts.balanceUpdatedAt} is null`,
                sql`${accounts.balanceUpdatedAt} < ${change.cutoff}::timestamptz`,
              ),
            ),
          )
      }
    },
    otherEvents,
  )

  if (recorded.length > 0) {
    try {
      await db.insert(emailEvents).values(
        recorded.map((draft) => ({
          sourceId: draft.sourceId,
          kind: draft.kind,
          summary: draft.summary,
          payload: draft as unknown as Record<string, unknown>,
        })),
      )
    } catch (error) {
      // The effects are already written; failing to record them would replay
      // the whole batch next run, so this is the one error worth shouting about.
      errors.push(`event log: ${error instanceof Error ? error.message.slice(0, 160) : 'failed'}`)
    }
  }

  return { applied: recorded.length, skipped, errors }
}

/** The most recent events, for the Settings page. */
export async function recentEmailEvents(limit = 12) {
  return db
    .select()
    .from(emailEvents)
    .orderBy(sql`${emailEvents.createdAt} desc`)
    .limit(limit)
}
