'use server'

/**
 * Every mutation in the app.
 *
 * Server Actions rather than API routes: the forms are all server-rendered, the
 * validation lives beside the write, and there is no client state to keep in
 * sync. Each action revalidates the paths its data appears on so a redirect
 * lands on fresh numbers.
 */

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  accounts,
  brokerConnections,
  expenses,
  journalEntries,
  payouts,
  propFirms,
  subscriptions,
  trades,
  type AllocationPlan,
  type RiskRules,
  type TaxProfile,
} from '@/db/schema'
import { allocatePayout } from '@/lib/allocation'
import { riskFromStop, rMultiple } from '@/lib/analytics/matching'
import { defaultDeductibleFor } from '@/lib/tax/israel'
import { addMonths, tradingDayFor } from '@/lib/time'
import { getSettings, updateSettings } from './settings'
import { CADENCE_MONTHS, materialiseSubscriptions } from './money'
import { regenerateInsights } from './insights'
import { rebuildTradesForAccount, rollupDailyStats } from './trades'
import { saveTradovateCredentials, syncAllConnections, syncTradovateConnection } from './sync'

const REVALIDATE = ['/', '/trades', '/accounts', '/money', '/tax', '/analytics']

function revalidateAll() {
  for (const path of REVALIDATE) revalidatePath(path)
}

const num = z.coerce.number()
const optionalNum = z
  .union([z.literal(''), z.coerce.number()])
  .transform((value) => (value === '' ? null : value))
const optionalText = z
  .union([z.literal(''), z.string()])
  .transform((value) => (value === '' ? null : value))

export type ActionResult = { ok: true; message: string } | { ok: false; message: string }

/** Wraps an action so a thrown error becomes a message rather than a crash. */
async function guard(run: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await run() }
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
        : error instanceof Error
          ? error.message
          : 'Something went wrong.'
    return { ok: false, message }
  }
}

// ---------------------------------------------------------------------------
// Firms & accounts
// ---------------------------------------------------------------------------

const firmSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  website: optionalText,
  platform: z.string().default('tradovate'),
  profitSplit: num.min(0).max(1).default(0.9),
  payoutPolicy: optionalText,
  minDaysToPayout: optionalNum,
  notes: optionalText,
})

export async function saveFirm(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const values = firmSchema.parse(Object.fromEntries(formData))
    const payload = { ...values, minDaysToPayout: values.minDaysToPayout ?? null }

    if (id) await db.update(propFirms).set(payload).where(eq(propFirms.id, id))
    else await db.insert(propFirms).values(payload)

    revalidateAll()
    return `Saved ${values.name}.`
  })
}

export async function deleteFirm(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(propFirms).where(eq(propFirms.id, id))
    revalidateAll()
    return 'Firm deleted.'
  })
}

const accountSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  firmId: optionalNum,
  externalId: optionalText,
  platform: z.string().default('tradovate'),
  phase: z.enum(['eval', 'funded', 'live', 'personal', 'demo']).default('eval'),
  status: z.enum(['active', 'passed', 'failed', 'closed', 'paused']).default('active'),
  startingBalance: num.default(50_000),
  profitTarget: optionalNum,
  maxDrawdown: optionalNum,
  drawdownType: z.enum(['trailing_intraday', 'trailing_eod', 'static', 'none']).default('trailing_eod'),
  drawdownLocksAt: optionalNum,
  dailyLossLimit: optionalNum,
  maxContracts: optionalNum,
  minTradingDays: optionalNum,
  consistencyPercent: optionalNum,
  costBase: num.default(0),
  commissionPerContract: num.default(0),
  currentBalance: optionalNum,
  startedOn: optionalText,
  notes: optionalText,
  excludeFromStats: z.coerce.boolean().default(false),
})

export async function saveAccount(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const raw = Object.fromEntries(formData)
    const values = accountSchema.parse({ ...raw, excludeFromStats: raw.excludeFromStats === 'on' })

    const payload = {
      ...values,
      firmId: values.firmId ?? null,
      profitTarget: values.profitTarget ?? null,
      maxDrawdown: values.maxDrawdown ?? null,
      drawdownLocksAt: values.drawdownLocksAt ?? null,
      dailyLossLimit: values.dailyLossLimit ?? null,
      maxContracts: values.maxContracts ?? null,
      minTradingDays: values.minTradingDays ?? null,
      // Entered as a whole percentage; stored as a fraction.
      consistencyPercent: values.consistencyPercent === null ? null : values.consistencyPercent / 100,
      currentBalance: values.currentBalance ?? null,
      balanceUpdatedAt: values.currentBalance !== null ? new Date() : undefined,
    }

    if (id) {
      await db.update(accounts).set(payload).where(eq(accounts.id, id))
      // Commission changes alter every derived trade, so rebuild.
      await rollupDailyStats(id)
    } else {
      await db.insert(accounts).values(payload)
    }

    revalidateAll()
    return `Saved ${values.label}.`
  })
}

export async function deleteAccount(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(accounts).where(eq(accounts.id, id))
    revalidateAll()
    return 'Account and its trades deleted.'
  })
}

export async function rebuildAccountTrades(id: number): Promise<ActionResult> {
  return guard(async () => {
    const count = await rebuildTradesForAccount(id)
    revalidateAll()
    return `Rebuilt ${count} trades from stored fills.`
  })
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

const tradeSchema = z.object({
  accountId: num,
  symbol: z.string().min(1, 'Symbol is required'),
  direction: z.enum(['long', 'short']),
  qty: num.int().positive(),
  entryAt: z.string().min(1, 'Entry time is required'),
  exitAt: optionalText,
  avgEntry: num,
  avgExit: optionalNum,
  netPnl: num,
  commission: num.default(0),
  fees: num.default(0),
  stopPrice: optionalNum,
  targetPrice: optionalNum,
  setup: optionalText,
  emotion: optionalText,
  execScore: optionalNum,
  notes: optionalText,
  screenshotUrl: optionalText,
})

export async function saveManualTrade(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const values = tradeSchema.parse(Object.fromEntries(formData))
    const settings = await getSettings()

    const entryAt = new Date(values.entryAt)
    const exitAt = values.exitAt ? new Date(values.exitAt) : null
    const tags = splitList(formData.get('tags'))
    const mistakes = splitList(formData.get('mistakes'))

    const riskBase =
      values.stopPrice !== null
        ? riskFromStop(values.symbol, values.direction, values.avgEntry, values.stopPrice, values.qty)
        : null

    await db.insert(trades).values({
      accountId: values.accountId,
      symbol: values.symbol.toUpperCase(),
      contract: values.symbol.toUpperCase(),
      direction: values.direction,
      qty: values.qty,
      entryAt,
      exitAt,
      tradingDay: tradingDayFor(entryAt, settings.timezone, settings.dayBoundary),
      avgEntry: values.avgEntry,
      avgExit: values.avgExit,
      grossPnl: values.netPnl + values.commission + values.fees,
      commission: values.commission,
      fees: values.fees,
      netPnl: values.netPnl,
      stopPrice: values.stopPrice,
      targetPrice: values.targetPrice,
      riskBase,
      rMultiple: rMultiple(values.netPnl, riskBase),
      durationSeconds: exitAt ? Math.round((exitAt.getTime() - entryAt.getTime()) / 1000) : null,
      status: exitAt ? 'closed' : 'open',
      setup: values.setup,
      tags,
      mistakes,
      execScore: values.execScore,
      emotion: values.emotion,
      notes: values.notes,
      screenshotUrl: values.screenshotUrl,
      // Manual trades are the user's own record and survive a rebuild.
      autoGenerated: false,
    })

    await rollupDailyStats(values.accountId)
    revalidateAll()
    return 'Trade saved.'
  })
}

/** Post-trade journalling on an existing trade, whether synced or manual. */
export async function annotateTrade(id: number, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const [existing] = await db.select().from(trades).where(eq(trades.id, id)).limit(1)
    if (!existing) throw new Error('Trade not found.')

    const stopPrice = optionalNum.parse(formData.get('stopPrice') ?? '')
    const riskBase =
      stopPrice !== null
        ? riskFromStop(existing.symbol, existing.direction, existing.avgEntry, stopPrice, existing.qty)
        : existing.riskBase

    await db
      .update(trades)
      .set({
        stopPrice,
        targetPrice: optionalNum.parse(formData.get('targetPrice') ?? ''),
        riskBase,
        rMultiple: rMultiple(existing.netPnl, riskBase),
        setup: optionalText.parse(formData.get('setup') ?? ''),
        tags: splitList(formData.get('tags')),
        mistakes: splitList(formData.get('mistakes')),
        execScore: optionalNum.parse(formData.get('execScore') ?? ''),
        emotion: optionalText.parse(formData.get('emotion') ?? ''),
        notes: optionalText.parse(formData.get('notes') ?? ''),
        screenshotUrl: optionalText.parse(formData.get('screenshotUrl') ?? ''),
        updatedAt: new Date(),
      })
      .where(eq(trades.id, id))

    revalidatePath(`/trades/${id}`)
    revalidateAll()
    return 'Trade updated.'
  })
}

export async function deleteTrade(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(trades).where(eq(trades.id, id))
    revalidateAll()
    return 'Trade deleted.'
  })
}

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

const expenseSchema = z.object({
  spentOn: z.string().min(1, 'Date is required'),
  category: z.string().min(1),
  vendor: z.string().min(1, 'Vendor is required'),
  description: optionalText,
  amount: num.positive('Amount must be greater than zero'),
  currency: z.string().default('USD'),
  accountId: optionalNum,
  firmId: optionalNum,
  deductiblePercent: optionalNum,
  vatAmount: num.default(0),
  notes: optionalText,
})

export async function saveExpense(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const raw = Object.fromEntries(formData)
    const values = expenseSchema.parse(raw)
    const settings = await getSettings()

    const fxRate =
      values.currency === settings.baseCurrency
        ? 1
        : values.currency === 'ILS' && settings.baseCurrency === 'USD'
          ? 1 / settings.usdIls
          : values.currency === 'USD' && settings.baseCurrency === 'ILS'
            ? settings.usdIls
            : 1

    const payload = {
      ...values,
      category: values.category as (typeof expenses.$inferInsert)['category'],
      accountId: values.accountId ?? null,
      firmId: values.firmId ?? null,
      fxRate,
      amountBase: values.amount * fxRate,
      // Entered as a whole percentage; fall back to the category default.
      deductiblePercent:
        values.deductiblePercent === null
          ? defaultDeductibleFor(values.category)
          : values.deductiblePercent / 100,
      hasReceipt: raw.hasReceipt === 'on',
    }

    if (id) await db.update(expenses).set(payload).where(eq(expenses.id, id))
    else await db.insert(expenses).values(payload)

    revalidateAll()
    return `Logged ${values.vendor}.`
  })
}

export async function deleteExpense(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(expenses).where(eq(expenses.id, id))
    revalidateAll()
    return 'Expense deleted.'
  })
}

const subscriptionSchema = z.object({
  vendor: z.string().min(1, 'Vendor is required'),
  description: optionalText,
  category: z.string().default('software'),
  amount: num.positive(),
  currency: z.string().default('USD'),
  cadence: z.enum(['weekly', 'monthly', 'quarterly', 'annual']).default('monthly'),
  startedOn: z.string().min(1),
  nextRenewalOn: optionalText,
  accountId: optionalNum,
  deductiblePercent: optionalNum,
})

export async function saveSubscription(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const raw = Object.fromEntries(formData)
    const values = subscriptionSchema.parse(raw)

    const payload = {
      ...values,
      category: values.category as (typeof subscriptions.$inferInsert)['category'],
      accountId: values.accountId ?? null,
      // Default the first renewal one full period after the start date.
      nextRenewalOn:
        values.nextRenewalOn ?? addMonths(values.startedOn, CADENCE_MONTHS[values.cadence] || 1),
      deductiblePercent:
        values.deductiblePercent === null ? defaultDeductibleFor(values.category) : values.deductiblePercent / 100,
      autoLog: raw.autoLog === 'on',
      active: raw.active !== 'off',
    }

    if (id) await db.update(subscriptions).set(payload).where(eq(subscriptions.id, id))
    else await db.insert(subscriptions).values(payload)

    revalidateAll()
    return `Saved ${values.vendor}.`
  })
}

export async function cancelSubscription(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db
      .update(subscriptions)
      .set({ active: false, cancelledOn: new Date().toISOString().slice(0, 10) })
      .where(eq(subscriptions.id, id))
    revalidateAll()
    return 'Subscription marked cancelled. Past charges stay in your expense history.'
  })
}

export async function deleteSubscription(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.id, id))
    revalidateAll()
    return 'Subscription deleted.'
  })
}

const payoutSchema = z.object({
  accountId: optionalNum,
  firmId: optionalNum,
  requestedOn: z.string().min(1),
  paidOn: optionalText,
  status: z.enum(['requested', 'approved', 'paid', 'rejected', 'cancelled']).default('requested'),
  grossAmount: num.positive(),
  profitSplit: num.min(0).max(1).default(0.9),
  processingFee: num.default(0),
  currency: z.string().default('USD'),
  method: optionalText,
  reference: optionalText,
  notes: optionalText,
})

export async function savePayout(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const values = payoutSchema.parse(Object.fromEntries(formData))
    const settings = await getSettings()

    // What actually lands: the trader's share, less whatever the firm charges
    // to move it.
    const netAmount = values.grossAmount * values.profitSplit - values.processingFee
    const fxRate =
      values.currency === settings.baseCurrency ? 1 : settings.baseCurrency === 'ILS' ? settings.usdIls : 1
    const netAmountBase = netAmount * fxRate

    const allocation = allocatePayout(netAmountBase, settings.allocationPlan)
    const taxLine = allocation.lines.find((line) => line.key === 'tax')

    const payload = {
      ...values,
      accountId: values.accountId ?? null,
      firmId: values.firmId ?? null,
      netAmount,
      fxRate,
      netAmountBase,
      // Only a payout that has actually arrived carries a real tax reserve.
      taxReserved: values.status === 'paid' ? (taxLine?.assigned ?? 0) : 0,
      allocation: Object.fromEntries(allocation.lines.map((line) => [line.key, line.assigned])),
    }

    if (id) await db.update(payouts).set(payload).where(eq(payouts.id, id))
    else await db.insert(payouts).values(payload)

    revalidateAll()
    return `Payout of ${netAmount.toFixed(2)} ${values.currency} saved.`
  })
}

export async function deletePayout(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(payouts).where(eq(payouts.id, id))
    revalidateAll()
    return 'Payout deleted.'
  })
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export async function saveJournalEntry(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const entryDate = String(formData.get('entryDate') ?? '')
    if (!entryDate) throw new Error('A date is required.')

    const values = {
      entryDate,
      plan: optionalText.parse(formData.get('plan') ?? ''),
      review: optionalText.parse(formData.get('review') ?? ''),
      marketNotes: optionalText.parse(formData.get('marketNotes') ?? ''),
      lessons: optionalText.parse(formData.get('lessons') ?? ''),
      mood: optionalNum.parse(formData.get('mood') ?? ''),
      discipline: optionalNum.parse(formData.get('discipline') ?? ''),
      sleepHours: optionalNum.parse(formData.get('sleepHours') ?? ''),
      tags: splitList(formData.get('tags')),
      updatedAt: new Date(),
    }

    await db
      .insert(journalEntries)
      .values(values)
      .onConflictDoUpdate({ target: journalEntries.entryDate, set: values })

    revalidatePath('/journal')
    revalidatePath('/')
    return 'Journal entry saved.'
  })
}

// ---------------------------------------------------------------------------
// Settings & connections
// ---------------------------------------------------------------------------

export async function saveGeneralSettings(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    await updateSettings({
      displayName: String(formData.get('displayName') ?? 'Trader'),
      baseCurrency: String(formData.get('baseCurrency') ?? 'USD'),
      timezone: String(formData.get('timezone') ?? 'Asia/Jerusalem'),
      dayBoundary: String(formData.get('dayBoundary') ?? '00:00'),
      usdIls: num.parse(formData.get('usdIls') ?? 3.7),
    })
    revalidateAll()
    revalidatePath('/settings')
    return 'Settings saved.'
  })
}

export async function saveTaxProfile(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const profile: TaxProfile = {
      status: z
        .enum(['osek_patur', 'osek_zair', 'osek_murshe', 'company', 'undecided'])
        .parse(formData.get('status') ?? 'undecided'),
      israeliResident: formData.get('israeliResident') === 'on',
      creditPoints: num.parse(formData.get('creditPoints') ?? 2.25),
      reservePercent: num.parse(formData.get('reservePercent') ?? 30) / 100,
      businessOpenedOn: optionalText.parse(formData.get('businessOpenedOn') ?? ''),
      claimsZeroRatedVat: formData.get('claimsZeroRatedVat') === 'on',
    }

    await updateSettings({ taxProfile: profile })
    revalidatePath('/tax')
    revalidatePath('/settings')
    revalidatePath('/')
    return 'Tax profile saved.'
  })
}

export async function saveAllocationPlan(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const settings = await getSettings()
    const buckets = (settings.allocationPlan?.buckets ?? []).map((bucket) => {
      const percent = optionalNum.parse(formData.get(`percent_${bucket.key}`) ?? '')
      const cap = optionalNum.parse(formData.get(`cap_${bucket.key}`) ?? '')
      return {
        ...bucket,
        percent: percent === null ? bucket.percent : percent / 100,
        capBase: cap,
      }
    })

    const plan: AllocationPlan = { buckets }
    await updateSettings({ allocationPlan: plan })
    revalidatePath('/money')
    revalidatePath('/settings')
    return 'Allocation plan saved.'
  })
}

export async function saveRiskRules(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const rules: RiskRules = {
      maxTradesPerDay: num.parse(formData.get('maxTradesPerDay') ?? 5),
      maxLossPerDayBase: num.parse(formData.get('maxLossPerDayBase') ?? 500),
      maxConsecutiveLosses: num.parse(formData.get('maxConsecutiveLosses') ?? 3),
      maxDailyLossR: num.parse(formData.get('maxDailyLossR') ?? 3),
      sessionStart: String(formData.get('sessionStart') ?? '15:30'),
      sessionEnd: String(formData.get('sessionEnd') ?? '23:00'),
      maxRiskPercentPerTrade: num.parse(formData.get('maxRiskPercentPerTrade') ?? 1) / 100,
    }

    await updateSettings({ riskRules: rules })
    revalidatePath('/settings')
    return 'Risk rules saved.'
  })
}

export async function createConnection(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const label = String(formData.get('label') ?? '').trim()
    if (!label) throw new Error('A label is required.')

    const [created] = await db
      .insert(brokerConnections)
      .values({
        label,
        provider: String(formData.get('provider') ?? 'tradovate'),
        environment: String(formData.get('environment') ?? 'live'),
      })
      .returning({ id: brokerConnections.id })

    await saveTradovateCredentials(created.id, {
      name: String(formData.get('name') ?? ''),
      password: String(formData.get('password') ?? ''),
      appId: String(formData.get('appId') ?? ''),
      appVersion: String(formData.get('appVersion') ?? '1.0'),
      cid: String(formData.get('cid') ?? ''),
      sec: String(formData.get('sec') ?? ''),
      deviceId: String(formData.get('deviceId') ?? '') || undefined,
    })

    revalidatePath('/settings')
    return `Connection "${label}" saved. Run a sync to pull your fills.`
  })
}

export async function deleteConnection(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(brokerConnections).where(eq(brokerConnections.id, id))
    revalidatePath('/settings')
    return 'Connection removed.'
  })
}

export async function runSync(connectionId?: number): Promise<ActionResult> {
  return guard(async () => {
    const outcomes = connectionId
      ? [await syncTradovateConnection(connectionId)]
      : await syncAllConnections()

    if (outcomes.length === 0) return 'No enabled connections to sync.'

    const failed = outcomes.filter((outcome) => outcome.status === 'error')
    revalidateAll()
    revalidatePath('/settings')

    if (failed.length > 0) {
      throw new Error(failed.map((outcome) => `${outcome.label}: ${outcome.message}`).join(' | '))
    }

    const imported = outcomes.reduce((sum, outcome) => sum + outcome.fillsImported, 0)
    return `Synced ${outcomes.length} connection(s); ${imported} new fills imported.`
  })
}

/**
 * Syncs every enabled connection.
 *
 * A separate zero-argument action rather than `runSync()` with its optional
 * parameter: a Server Action reference passed to a Client Component is invoked
 * with no arguments, and being explicit about that at the call site is clearer
 * than relying on a default.
 */
export async function syncAllBrokers(): Promise<ActionResult> {
  return runSync()
}

export async function refreshInsights(): Promise<ActionResult> {
  return guard(async () => {
    const result = await regenerateInsights()
    revalidateAll()
    return `${result.generated} insights generated, ${result.resolved} resolved.`
  })
}

export async function runSubscriptionCatchUp(): Promise<ActionResult> {
  return guard(async () => {
    const created = await materialiseSubscriptions()
    revalidateAll()
    return created > 0
      ? `Logged ${created} subscription charge(s) that had come due.`
      : 'No subscription charges were outstanding.'
  })
}
