import 'server-only'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  accounts,
  expenses,
  payouts,
  propFirms,
  subscriptions,
  type Expense,
  type Payout,
  type Subscription,
} from '@/db/schema'
import { addDays, addMonths, today } from '@/lib/time'
import { defaultDeductibleFor } from '@/lib/tax/israel'
import { getSettings } from './settings'

export async function listExpenses(from?: string, to?: string): Promise<Expense[]> {
  const conditions = []
  if (from) conditions.push(gte(expenses.spentOn, from))
  if (to) conditions.push(lte(expenses.spentOn, to))
  return db
    .select()
    .from(expenses)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.spentOn))
}

export async function listPayouts(from?: string, to?: string): Promise<Payout[]> {
  const conditions = []
  if (from) conditions.push(gte(payouts.requestedOn, from))
  if (to) conditions.push(lte(payouts.requestedOn, to))
  return db
    .select()
    .from(payouts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(payouts.requestedOn))
}

export async function listSubscriptions(): Promise<Subscription[]> {
  return db.select().from(subscriptions).orderBy(desc(subscriptions.active), asc(subscriptions.nextRenewalOn))
}

export async function listFirms() {
  return db.select().from(propFirms).orderBy(asc(propFirms.name))
}

/**
 * Advances a renewal date by one billing period.
 *
 * Weekly must move by days: `setUTCMonth(month + 0.25)` truncates the fraction,
 * so a fractional-month "week" never advances at all — which made the
 * materialiser loop mint its 60-iteration guard limit of duplicate expenses on
 * every single daily run.
 */
export function nextRenewal(day: string, cadence: Subscription['cadence']): string {
  switch (cadence) {
    case 'weekly':
      return addDays(day, 7)
    case 'monthly':
      return addMonths(day, 1)
    case 'quarterly':
      return addMonths(day, 3)
    case 'annual':
      return addMonths(day, 12)
  }
}

export function annualisedCost(subscription: Subscription): number {
  const perYear = { weekly: 52, monthly: 12, quarterly: 4, annual: 1 }[subscription.cadence]
  return subscription.amount * perYear
}

/**
 * Materialises subscription renewals that have come due into real expenses.
 *
 * Recurring costs are the ones that vanish from a journal: nobody remembers to
 * log the $14 data feed twelve times a year, and by December the expense total —
 * which is also the tax deduction — is materially understated. The cron runs
 * this daily and it catches up any missed periods rather than only the latest.
 */
export async function materialiseSubscriptions(asOf = today()): Promise<number> {
  const settings = await getSettings()
  const due = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.active, true), eq(subscriptions.autoLog, true), lte(subscriptions.nextRenewalOn, asOf)))

  let created = 0

  for (const subscription of due) {
    let renewal = subscription.nextRenewalOn
    // A subscription may be several periods behind if the cron was paused.
    let guard = 0
    while (renewal <= asOf && guard < 60) {
      const fxRate = subscription.currency === settings.baseCurrency ? 1 : rateFor(subscription.currency, settings)

      await db.insert(expenses).values({
        spentOn: renewal,
        category: subscription.category,
        vendor: subscription.vendor,
        description: subscription.description ?? `${subscription.cadence} renewal`,
        amount: subscription.amount,
        currency: subscription.currency,
        fxRate,
        amountBase: subscription.amount * fxRate,
        accountId: subscription.accountId,
        subscriptionId: subscription.id,
        deductiblePercent: subscription.deductiblePercent,
        vatAmount: 0,
        hasReceipt: false,
        notes: 'Logged automatically from a recurring subscription.',
      })

      created += 1
      renewal = nextRenewal(renewal, subscription.cadence)
      guard += 1
    }

    await db
      .update(subscriptions)
      .set({ nextRenewalOn: renewal })
      .where(eq(subscriptions.id, subscription.id))
  }

  return created
}

function rateFor(currency: string, settings: { usdIls: number; baseCurrency: string }): number {
  if (currency === settings.baseCurrency) return 1
  if (settings.baseCurrency === 'USD' && currency === 'ILS') return 1 / settings.usdIls
  if (settings.baseCurrency === 'ILS' && currency === 'USD') return settings.usdIls
  return 1
}

export type MoneySummary = {
  payoutsPaid: number
  payoutsPending: number
  taxReserved: number
  expensesTotal: number
  deductibleTotal: number
  inputVat: number
  evaluationSpend: number
  subscriptionAnnual: number
  netBusinessResult: number
  byCategory: { category: string; total: number; deductible: number }[]
}

/** Rolls the whole money picture into one object for the dashboard and tax page. */
export async function moneySummary(from?: string, to?: string): Promise<MoneySummary> {
  const [expenseRows, payoutRows, subscriptionRows] = await Promise.all([
    listExpenses(from, to),
    listPayouts(from, to),
    listSubscriptions(),
  ])

  const paid = payoutRows.filter((p) => p.status === 'paid')
  const pending = payoutRows.filter((p) => p.status === 'requested' || p.status === 'approved')

  const byCategory = new Map<string, { total: number; deductible: number }>()
  for (const expense of expenseRows) {
    const entry = byCategory.get(expense.category) ?? { total: 0, deductible: 0 }
    entry.total += expense.amountBase
    entry.deductible += expense.amountBase * expense.deductiblePercent
    byCategory.set(expense.category, entry)
  }

  const payoutsPaid = paid.reduce((sum, p) => sum + p.netAmountBase, 0)
  const expensesTotal = expenseRows.reduce((sum, e) => sum + e.amountBase, 0)
  const deductibleTotal = expenseRows.reduce((sum, e) => sum + e.amountBase * e.deductiblePercent, 0)

  return {
    payoutsPaid,
    payoutsPending: pending.reduce((sum, p) => sum + p.netAmountBase, 0),
    taxReserved: paid.reduce((sum, p) => sum + p.taxReserved, 0),
    expensesTotal,
    deductibleTotal,
    inputVat: expenseRows.reduce((sum, e) => sum + e.vatAmount, 0),
    evaluationSpend: expenseRows
      .filter((e) => ['eval_fee', 'reset_fee', 'activation_fee'].includes(e.category))
      .reduce((sum, e) => sum + e.amountBase, 0),
    subscriptionAnnual: subscriptionRows.filter((s) => s.active).reduce((sum, s) => sum + annualisedCost(s), 0),
    netBusinessResult: payoutsPaid - expensesTotal,
    byCategory: [...byCategory.entries()]
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.total - a.total),
  }
}

/**
 * Evaluation economics per firm: what it costs to obtain a funded account, and
 * what one produces. This is the number that decides whether adding accounts is
 * investment or gambling.
 */
export async function firmEconomics(): Promise<
  {
    firmId: number | null
    name: string
    spend: number
    payouts: number
    net: number
    accountsTotal: number
    accountsPassed: number
    accountsFailed: number
    passRate: number | null
    costPerFunded: number | null
    roi: number | null
  }[]
> {
  const [firms, accountRows, expenseRows, payoutRows] = await Promise.all([
    listFirms(),
    db.select().from(accounts),
    listExpenses(),
    listPayouts(),
  ])

  const rows = firms.map((firm) => {
    const firmAccounts = accountRows.filter((a) => a.firmId === firm.id)
    const evaluations = firmAccounts.filter((a) => a.phase === 'eval' || a.status === 'passed' || a.status === 'failed')
    const passed = firmAccounts.filter((a) => a.status === 'passed' || a.phase === 'funded' || a.phase === 'live')
    const failed = firmAccounts.filter((a) => a.status === 'failed')

    const spend = expenseRows
      .filter((e) => e.firmId === firm.id && ['eval_fee', 'reset_fee', 'activation_fee'].includes(e.category))
      .reduce((sum, e) => sum + e.amountBase, 0)
    const received = payoutRows
      .filter((p) => p.firmId === firm.id && p.status === 'paid')
      .reduce((sum, p) => sum + p.netAmountBase, 0)

    const attempts = Math.max(evaluations.length, passed.length + failed.length)
    const passRate = attempts > 0 ? passed.length / attempts : null

    return {
      firmId: firm.id,
      name: firm.name,
      spend,
      payouts: received,
      net: received - spend,
      accountsTotal: firmAccounts.length,
      accountsPassed: passed.length,
      accountsFailed: failed.length,
      passRate,
      costPerFunded: passed.length > 0 ? spend / passed.length : null,
      roi: spend > 0 ? received / spend : null,
    }
  })

  return rows.sort((a, b) => b.net - a.net)
}

export async function upcomingRenewals(days = 30): Promise<Subscription[]> {
  const horizon = addMonths(today(), 0)
  const cutoff = new Date(`${horizon}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() + days)

  return db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.active, true), lte(subscriptions.nextRenewalOn, cutoff.toISOString().slice(0, 10))))
    .orderBy(asc(subscriptions.nextRenewalOn))
}

/** Applies the category default when the user has not overridden it. */
export function deductibleFor(category: string, override?: number | null): number {
  return override ?? defaultDeductibleFor(category)
}

export async function revenueForYear(year: number): Promise<number> {
  // Israeli tax follows when the money became available, so a payout requested
  // in late December but paid in January belongs to the January year. Fall back
  // to the request date only while no payment date exists.
  const paidDate = sql`coalesce(${payouts.paidOn}, ${payouts.requestedOn})`
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${payouts.netAmountBase}), 0)::float8` })
    .from(payouts)
    .where(
      and(
        eq(payouts.status, 'paid'),
        gte(paidDate, `${year}-01-01`),
        lte(paidDate, `${year}-12-31`),
      ),
    )
  return row?.total ?? 0
}

export async function deductibleExpensesForYear(year: number): Promise<{ deductible: number; vat: number }> {
  const rows = await listExpenses(`${year}-01-01`, `${year}-12-31`)
  return {
    deductible: rows.reduce((sum, e) => sum + e.amountBase * e.deductiblePercent, 0),
    vat: rows.reduce((sum, e) => sum + e.vatAmount, 0),
  }
}
