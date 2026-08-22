import 'server-only'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { proposalFor, type EmailProposal } from '@/lib/email/proposals'
import { accounts, emailEvents, expenses, payouts, propFirms } from '@/db/schema'
import { classifyEmail, looksTransactional, type EmailEventDraft } from '@/lib/email/parse'
import { defaultDeductibleFor } from '@/lib/tax/israel'
import { aiConfigured, classifyEmailWithAi } from './ai'
import { fetchRecentMail, gmailConfigured } from './gmail'
import { notify } from './push'

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
  /** Read as a change, but waiting for you to say which account. */
  proposed: number
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
      proposed: 0,
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
    proposed: outcome.proposed,
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
): Promise<{ applied: number; proposed: number; skipped: number; errors: string[] }> {
  if (drafts.length === 0) return { applied: 0, proposed: 0, skipped: 0, errors: [] }

  // One email can produce the same event twice across mailboxes; keep the first.
  const unique = new Map<string, EmailEventDraft>()
  for (const draft of drafts) if (!unique.has(draft.sourceId)) unique.set(draft.sourceId, draft)

  const known = await knownSourceIds([...unique.keys()])
  const fresh = [...unique.values()].filter((draft) => !known.has(draft.sourceId))
  const skipped = unique.size - fresh.length
  if (fresh.length === 0) return { applied: 0, proposed: 0, skipped, errors: [] }

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

  const proposedEvents: { draft: EmailEventDraft; proposal: EmailProposal }[] = []
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
        // The account's own split first: it varies within a firm, so the
        // firm's value is only a fallback for accounts that never set one.
        profitSplit: account?.profitSplit ?? firm?.profitSplit ?? 1,
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
        // Attribute the fee to the account it bought whenever the email names
        // one. Without this every evaluation fee sat against the firm alone,
        // and "cost per funded account" counted spend it could not place.
        accountId: account?.id ?? null,
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
      if (status) {
        statusChanges.push({ accountId: account.id, status })
        otherEvents.push(draft)
        continue
      }
    } else if (draft.kind === 'balance_snapshot' && account && typeof draft.balance === 'number') {
      balanceChanges.push({
        accountId: account.id,
        balance: draft.balance,
        cutoff: `${draft.date}T23:59:00Z`,
      })
      otherEvents.push(draft)
      continue
    }

    // Nothing to act on directly. If the email still reads as a change — a
    // balance, a pass, a blow-up — it is kept as a proposal rather than logged
    // and forgotten: the account it names is one this journal does not know,
    // and the trader does. Everything else ('subscription', 'note', and any
    // status this app does not model) is news, and is recorded as such.
    const proposal = proposalFor(draft)
    if (proposal) proposedEvents.push({ draft, proposal })
    else otherEvents.push(draft)
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

  if (recorded.length > 0 || proposedEvents.length > 0) {
    if (recorded.length > 0) await announce(recorded)
    try {
      await db.insert(emailEvents).values([
        ...recorded.map((draft) => ({
          sourceId: draft.sourceId,
          kind: draft.kind,
          summary: draft.summary,
          payload: draft as unknown as Record<string, unknown>,
          state: 'applied' as const,
        })),
        ...proposedEvents.map(({ draft, proposal }) => ({
          sourceId: draft.sourceId,
          kind: draft.kind,
          summary: draft.summary,
          payload: draft as unknown as Record<string, unknown>,
          state: 'proposed' as const,
          proposal,
        })),
      ])
    } catch (error) {
      // The effects are already written; failing to record them would replay
      // the whole batch next run, so this is the one error worth shouting about.
      errors.push(`event log: ${error instanceof Error ? error.message.slice(0, 160) : 'failed'}`)
    }
  }

  return { applied: recorded.length, proposed: proposedEvents.length, skipped, errors }
}

/**
 * Pushes the events worth interrupting someone for.
 *
 * Not every event is news: a balance snapshot arrives every evening and a
 * subscription notice can wait for the next time the app is opened. A payout
 * moving, or an account being passed or lost, is the reason to have
 * notifications at all — and the point of the automation is that you hear
 * about it without going to look.
 */
async function announce(events: EmailEventDraft[]): Promise<void> {
  const worthTelling = events.filter(
    (event) => event.kind === 'payout' || event.kind === 'account_status',
  )
  if (worthTelling.length === 0) return

  if (worthTelling.length > 1) {
    await notify({
      title: `${worthTelling.length} updates from your firms`,
      body: worthTelling.map((event) => event.summary).join(' · ').slice(0, 200),
      url: '/money',
      tag: 'email-batch',
    })
    return
  }

  const [event] = worthTelling
  const payout = event.kind === 'payout'
  await notify({
    title: payout
      ? `Payout ${event.status ?? 'update'}${event.amount ? ` — $${event.amount.toLocaleString()}` : ''}`
      : `Account ${event.status ?? 'changed'}`,
    body: event.summary,
    url: payout ? '/money' : '/accounts',
    tag: payout ? 'payout' : 'account',
  })
}

/** The most recent events, for the Settings page. */
export async function recentEmailEvents(limit = 12) {
  return db
    .select()
    .from(emailEvents)
    .orderBy(sql`${emailEvents.createdAt} desc`)
    .limit(limit)
}

/** Everything still waiting on one press. */
export async function pendingEmailProposals() {
  const rows = await db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.state, 'proposed'))
    .orderBy(sql`${emailEvents.createdAt} desc`)
    .limit(20)

  return rows.filter((row): row is typeof row & { proposal: EmailProposal } => row.proposal !== null)
}

/**
 * Applies one proposal to the account the trader picked.
 *
 * The account is also *taught* the identifier the email used, when it does not
 * already carry one: the next snapshot for that id then matches on its own, so
 * a proposal is answered once rather than every morning. Only when the field is
 * empty — overwriting a broker's own id would break the sync that uses it.
 */
export async function applyEmailProposal(
  eventId: number,
  accountId: number,
): Promise<{ message: string }> {
  const [row] = await db.select().from(emailEvents).where(eq(emailEvents.id, eventId)).limit(1)
  if (!row) throw new Error('That suggestion is no longer there.')
  if (row.state !== 'proposed') throw new Error('That suggestion has already been answered.')
  const proposal = row.proposal
  if (!proposal) throw new Error('That event has nothing to apply.')

  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1)
  if (!account) throw new Error('Account not found.')

  if (proposal.type === 'balance') {
    await db
      .update(accounts)
      .set({ currentBalance: proposal.balance, balanceUpdatedAt: new Date(proposal.cutoff) })
      .where(
        and(
          eq(accounts.id, accountId),
          or(
            sql`${accounts.balanceUpdatedAt} is null`,
            sql`${accounts.balanceUpdatedAt} < ${proposal.cutoff}::timestamptz`,
          ),
        ),
      )
  } else {
    await db.update(accounts).set({ status: proposal.status }).where(eq(accounts.id, accountId))
  }

  if (proposal.externalId && !account.externalId) {
    await db
      .update(accounts)
      .set({ externalId: proposal.externalId })
      .where(eq(accounts.id, accountId))
  }

  await db.update(emailEvents).set({ state: 'applied' }).where(eq(emailEvents.id, eventId))

  const learned = proposal.externalId && !account.externalId
  return {
    message:
      proposal.type === 'balance'
        ? `Balance updated on ${account.label}.${learned ? ' Future snapshots for that id will apply themselves.' : ''}`
        : `${account.label} marked ${proposal.status}.${learned ? ' Future emails for that id will apply themselves.' : ''}`,
  }
}

/** Declines a proposal. It is never offered again — the email stays in the log. */
export async function dismissEmailProposal(eventId: number): Promise<void> {
  await db.update(emailEvents).set({ state: 'dismissed' }).where(eq(emailEvents.id, eventId))
}
