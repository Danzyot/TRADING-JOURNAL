/**
 * End-to-end check for the email automation, against a real Postgres.
 *
 * Runs actual prop-firm emails through the parser and the applier, then reads
 * the database back: the point is to prove the effects land on the right rows
 * and that a second run of the same mail changes nothing.
 *
 *   DATABASE_URL=... npx tsx --conditions=react-server scripts/email-check.mts
 */
import { db } from '../src/db/index'
import { accounts, emailEvents, expenses, payouts } from '../src/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { classifyEmail, type RawEmail } from '../src/lib/email/parse'
import { applyEmailEvents } from '../src/server/email-ingest'

const stamp = Date.now()
const received = new Date('2026-08-21T21:40:40Z')

const account = (await db.select().from(accounts).limit(1))[0]
if (!account) throw new Error('Seed an account first.')
const externalId = account.externalId ?? account.label
console.log(`Using account #${account.id} "${account.label}" externalId=${externalId}`)

const emails: RawEmail[] = [
  {
    id: `apex-payout-${stamp}`,
    from: 'noreply@apextraderfunding.com',
    subject: 'PA Payout Approved',
    text: 'Hi,\n\nYour requested PA Payout for $1500 has been approved on Aug 21, 2026.\nFunds will be sent within 3–4 business days.',
    receivedAt: received,
  },
  {
    id: `lucid-wire-${stamp}`,
    from: 'admin@lucidtrading.com',
    subject: 'LucidEval Daily Wire',
    text: `LucidEval YOUR DAILY SNAPSHOT 8/21/2026\nAccount Number: ${externalId}\nAccount Balance $24577\nTotal Profit -$424\nSession PnL -$487`,
    receivedAt: received,
  },
  {
    id: `lucid-order-${stamp}`,
    from: 'support@lucidtrading.com',
    subject: 'Lucid Trading - Order Processing',
    text: '| ### Order number: 8472684 | ### Order date: August 21, 2026 |\n| LucidFlex 25K Rithmic | 1 | $79.00 |\n| Subtotal: | $79.00 |\n| Discount: | -$0.00 |\n| Total: | $79.00 |',
    receivedAt: received,
  },
  {
    id: `alpha-breach-${stamp}`,
    from: 'info@alpha-futures.com',
    subject: 'Account Suspension Notice - Details Regarding the Breach',
    text: `Unfortunately the Maximum Loss Limit on your 50K Evaluation has been breached. Account number ${externalId} has violated Maximum Loss.`,
    receivedAt: received,
  },
  {
    id: `tpt-marketing-${stamp}`,
    from: 'team@takeprofittrader.com',
    subject: '⏰ Only 3 Days Left',
    text: '50% off is ending soon… grab your evaluation for $49.',
    receivedAt: received,
  },
]

const drafts = emails.flatMap((email) => classifyEmail(email))
console.log(`\nParsed ${drafts.length} events from ${emails.length} emails:`)
for (const draft of drafts) console.log(`  ${draft.kind.padEnd(17)} ${draft.summary}`)

const before = {
  payouts: await count(payouts),
  expenses: await count(expenses),
  events: await count(emailEvents),
}

const first = await applyEmailEvents(drafts)
console.log('\nFirst run :', first)

const second = await applyEmailEvents(drafts)
console.log('Second run:', second, second.applied === 0 ? '✓ deduped' : '✗ DOUBLE-APPLIED')

const after = {
  payouts: await count(payouts),
  expenses: await count(expenses),
  events: await count(emailEvents),
}
console.log('\nRows added:', {
  payouts: after.payouts - before.payouts,
  expenses: after.expenses - before.expenses,
  events: after.events - before.events,
})

const [payout] = await db.select().from(payouts).orderBy(desc(payouts.id)).limit(1)
console.log('Latest payout :', {
  status: payout?.status,
  gross: payout?.grossAmount,
  requestedOn: payout?.requestedOn,
  notes: payout?.notes?.slice(0, 60),
})

const [expense] = await db.select().from(expenses).orderBy(desc(expenses.id)).limit(1)
console.log('Latest expense:', {
  vendor: expense?.vendor,
  amount: expense?.amount,
  category: expense?.category,
  deductible: expense?.deductiblePercent,
})

const [updated] = await db.select().from(accounts).where(eq(accounts.id, account.id))
console.log('Account now   :', {
  status: updated?.status,
  balance: updated?.currentBalance,
  balanceUpdatedAt: updated?.balanceUpdatedAt?.toISOString(),
})

// A late-arriving *older* snapshot must not overwrite the fresher balance.
const stale = classifyEmail({
  id: `lucid-stale-${stamp}`,
  from: 'admin@lucidtrading.com',
  subject: 'LucidEval Daily Wire',
  text: `LucidEval YOUR DAILY SNAPSHOT 8/01/2026\nAccount Number: ${externalId}\nAccount Balance $11111`,
  receivedAt: new Date('2026-08-01T21:00:00Z'),
})
await applyEmailEvents(stale)
const [afterStale] = await db.select().from(accounts).where(eq(accounts.id, account.id))
console.log(
  'After stale   :',
  { balance: afterStale?.currentBalance },
  afterStale?.currentBalance === 24577 ? '✓ old email ignored' : '✗ OVERWROTE A FRESHER BALANCE',
)

async function count(table: Parameters<typeof db.select>[0] extends never ? never : typeof payouts | typeof expenses | typeof emailEvents) {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(table)
  return Number(rows[0]?.n ?? 0)
}

process.exit(0)
