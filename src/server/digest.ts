import 'server-only'
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, emailEvents, expenses, payouts, trades } from '@/db/schema'
import { buildDigest, type DayStats, type WeekStats } from '@/lib/analytics/digest'
import { splitFor } from '@/lib/analytics/pnl-windows'
import { today } from '@/lib/time'
import { notify } from './push'
import { getSettings } from './settings'

/**
 * The twice-daily check-in that reaches the phone.
 *
 * `buildDigest` decides whether there is anything worth saying; everything
 * here is the gathering. Numbers come from the same tables the pages read, so
 * a figure in a notification can be opened and checked rather than taken on
 * faith.
 */

export type DigestOutcome = {
  slot: 'morning' | 'evening'
  sent: boolean
  reason: string
}

export async function runDigest(slot: 'morning' | 'evening'): Promise<DigestOutcome> {
  const settings = await getSettings()
  const currentDay = today(settings.timezone)

  // The user's week runs Sunday to Saturday, the Israeli working week, and
  // "Friday" means the Friday of that week — the last day worth wrapping up.
  const asDate = new Date(`${currentDay}T00:00:00Z`)
  const isFriday = asDate.getUTCDay() === 5
  const weekStart = new Date(asDate)
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())
  const weekStartDay = weekStart.toISOString().slice(0, 10)

  const [dayStats, weekStats] = await Promise.all([
    statsForRange(currentDay, currentDay),
    isFriday ? weekSummary(weekStartDay, currentDay) : Promise.resolve(null),
  ])

  const digest = buildDigest({
    slot,
    isFriday,
    currency: settings.baseCurrency,
    today: dayStats.trades > 0 ? dayStats : null,
    week: weekStats,
  })

  if (!digest) {
    return { slot, sent: false, reason: 'nothing worth sending' }
  }

  await notify(digest)
  return { slot, sent: true, reason: digest.title }
}

/** Closed trades in a date range, as a scoreline. */
async function statsForRange(from: string, to: string): Promise<DayStats> {
  const rows = await db
    .select({ netPnl: trades.netPnl })
    .from(trades)
    .innerJoin(accounts, eq(trades.accountId, accounts.id))
    .where(
      and(
        gte(trades.tradingDay, from),
        lte(trades.tradingDay, to),
        eq(trades.status, 'closed'),
        eq(accounts.excludeFromStats, false),
      ),
    )

  return {
    pnl: rows.reduce((sum, row) => sum + row.netPnl, 0),
    wins: rows.filter((row) => row.netPnl > 0).length,
    losses: rows.filter((row) => row.netPnl < 0).length,
    trades: rows.length,
  }
}

/** Exported so the week's figures can be checked against a real database. */
export async function weekSummary(from: string, to: string): Promise<WeekStats> {
  const [tradeRows, payoutRows, expenseRows, statusRows] = await Promise.all([
    // Split by phase: a good week on evaluations is a different fact from a
    // week that actually earned.
    db
      .select({ netPnl: trades.netPnl, phase: accounts.phase })
      .from(trades)
      .innerJoin(accounts, eq(trades.accountId, accounts.id))
      .where(
        and(
          gte(trades.tradingDay, from),
          lte(trades.tradingDay, to),
          eq(trades.status, 'closed'),
          eq(accounts.excludeFromStats, false),
        ),
      ),
    db
      .select({ amount: payouts.netAmountBase })
      .from(payouts)
      .where(and(eq(payouts.status, 'paid'), gte(payouts.paidOn, from), lte(payouts.paidOn, to))),
    db
      .select({ amount: expenses.amountBase })
      .from(expenses)
      .where(and(gte(expenses.spentOn, from), lte(expenses.spentOn, to))),
    // Passes and failures come from the email log rather than the accounts
    // table: a status column records where an account is now, not when it got
    // there, and "this week" is a question about when.
    db
      .select({ payload: emailEvents.payload })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.kind, 'account_status'),
          gte(emailEvents.createdAt, new Date(`${from}T00:00:00Z`)),
          lte(emailEvents.createdAt, new Date(`${to}T23:59:59Z`)),
        ),
      ),
  ])

  const statuses = statusRows.map((row) => String(row.payload?.status ?? ''))

  // The same classifier the dashboard uses. Counting phases separately in two
  // places is how a Friday notification ends up disagreeing with the page it
  // links to — the numbers have to come from one definition.
  const split = splitFor(
    tradeRows.map((row) => ({ tradingDay: '', netPnl: row.netPnl, phase: row.phase })),
  )

  return {
    evalPnl: split.evaluation,
    fundedPnl: split.funded,
    wins: tradeRows.filter((row) => row.netPnl > 0).length,
    losses: tradeRows.filter((row) => row.netPnl < 0).length,
    passed: statuses.filter((status) => status === 'passed').length,
    failed: statuses.filter((status) => status === 'failed').length,
    payoutCount: payoutRows.length,
    payoutTotal: payoutRows.reduce((sum, row) => sum + row.amount, 0),
    expenses: expenseRows.reduce((sum, row) => sum + row.amount, 0),
  }
}
