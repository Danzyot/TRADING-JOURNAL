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
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { DEMO_REFUSAL, demoMode } from '@/lib/demo'
import { db } from '@/db'
import {
  accounts,
  brokerConnections,
  executions,
  expenses,
  modelReviews,
  payouts,
  propFirms,
  subscriptions,
  trades,
  tradingModels,
  type AllocationPlan,
  type TaxProfile,
  wallets,
  tradeSetups,
  documentFolders,
  documents,
} from '@/db/schema'
import { allocatePayout } from '@/lib/allocation'
import { riskFromStop, rMultiple } from '@/lib/analytics/matching'
import { defaultDeductibleFor } from '@/lib/tax/israel'
import { addMonths, today, tradingDayFor } from '@/lib/time'
import { getSettings, updateSettings } from './settings'
import { materialiseSubscriptions, nextRenewal } from './money'
import { applyEmailProposal, dismissEmailProposal } from './email-ingest'
import { regenerateInsights } from './insights'
import { rebuildTradesForAccount, rollupDailyStats } from './trades'
import { saveTradovateCredentials, syncAllConnections, syncTradovateConnection } from './sync'
import { autoTagTrades, refineModelGuidance, reviewPendingForModel, reviewTradeAgainstModel } from './ai'
import { runEmailIngest } from './email-ingest'
import { forgetDevice, saveDevice, sendPush } from './push'
import { setSiteText } from './site-text'
import { isLogoId } from '@/lib/logos'
import { FIRM_CATALOGUES } from '@/lib/propfirm/catalogue'
import { parsePlainMoney } from '@/lib/propfirm/parse-specs'
import { addressLooksValid, isCryptoCurrency, isStablecoin } from '@/lib/crypto-assets'
import { deleteDocument, storeDocument } from './documents'
import { prepareScreenshot } from './setups'
import { deriveSetup } from '@/lib/analytics/setup'
import { scanSetupScreenshot } from './ai'

const REVALIDATE = ['/', '/trades', '/accounts', '/firms', '/money', '/tax', '/documents', '/models']

function revalidateAll() {
  for (const path of REVALIDATE) revalidatePath(path)
}

const num = z.coerce.number()
/**
 * For fields where a blank is a mistake, not a zero. `z.coerce.number()('')`
 * is 0, which quietly stored a $0 trade when the P&L field was left empty and
 * a 0.0 USD/ILS rate when the FX field was cleared — the latter then divides
 * by zero downstream.
 */
const requiredNum = z
  .union([z.string().min(1, 'Required'), z.number()])
  .pipe(z.coerce.number())
/**
 * An optional field, whether it arrives empty or not at all.
 *
 * `Object.fromEntries(formData)` has no key for a field the form never
 * rendered, and it has an empty string for one the user left blank. Both mean
 * "not provided", so both become null.
 *
 * These used to reject a missing key, with a separate absent-tolerant pair
 * beside them for forms that render a field conditionally. That distinction
 * was a trap: it cost a whole trading model, typed out and lost to
 * "description: Invalid input", because the schema listed a field the form
 * does not have. Nothing was gained by the strictness — a field declared
 * optional has no business failing on absence — so there is now one pair.
 */
const optionalNum = z
  .union([z.literal(''), z.coerce.number()])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))
const optionalText = z
  .union([z.literal(''), z.string()])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))

export type ActionResult = { ok: true; message: string } | { ok: false; message: string }

/** Wraps an action so a thrown error becomes a message rather than a crash. */
async function guard(run: () => Promise<string>): Promise<ActionResult> {
  // Every mutation in this app is a Server Action, and every Server Action
  // comes through here — which makes this the one place a demo has to be made
  // read-only. A refusal rather than a hidden button: the forms are half of
  // what there is to demonstrate, so they stay, they just do not write.
  if (demoMode()) return { ok: false, message: DEMO_REFUSAL }

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

/**
 * Conversion factor from `currency` into the reporting currency. Only USD/ILS
 * is a real pair here; an unknown currency converts 1:1 and the row keeps its
 * original currency so the gap is visible rather than silently wrong.
 */
function fxToBase(currency: string, settings: { baseCurrency: string; usdIls: number }): number {
  if (currency === settings.baseCurrency) return 1
  if (currency === 'ILS' && settings.baseCurrency === 'USD') return 1 / settings.usdIls
  if (currency === 'USD' && settings.baseCurrency === 'ILS') return settings.usdIls
  return 1
}

/**
 * The same factor, but honest about crypto.
 *
 * `fxToBase` falls back to 1:1 for anything it does not know, which is a fine
 * default for an unrecognised fiat code and a dangerous one for a chain asset:
 * 0.4 ETH would be booked as $0.40 and quietly disappear from every total. So
 * a stablecoin is valued as the dollar it tracks, and a volatile asset must
 * carry the unit price that actually settled — the form asks for it, and this
 * refuses rather than guesses when it is missing.
 */
function settlementRate(
  currency: string,
  settings: { baseCurrency: string; usdIls: number },
  override: number | null,
): number {
  if (!isCryptoCurrency(currency)) return fxToBase(currency, settings)
  if (isStablecoin(currency) && override === null) return fxToBase('USD', settings)
  if (override === null || override <= 0) {
    throw new Error(
      `${currency} has no fixed value — enter what one ${currency} was worth in ${settings.baseCurrency} when it settled.`,
    )
  }
  return override
}

/**
 * Chain details, kept only while the row is actually in crypto.
 *
 * Editing a payout from USDC back to USD has to clear them: a hash left
 * behind on a wire transfer would link to a block explorer that knows nothing
 * about it, which is worse than having no link at all.
 */
function cryptoColumns(
  currency: string,
  values: { cryptoNetwork?: string | null; cryptoTxHash?: string | null; cryptoAddress?: string | null },
) {
  if (!isCryptoCurrency(currency)) {
    return { cryptoNetwork: null, cryptoTxHash: null, cryptoAddress: null }
  }
  return {
    cryptoNetwork: values.cryptoNetwork ?? null,
    cryptoTxHash: values.cryptoTxHash ?? null,
    cryptoAddress: values.cryptoAddress ?? null,
  }
}

// ---------------------------------------------------------------------------
// Firms & accounts
// ---------------------------------------------------------------------------

/**
 * A firm is a name and a website.
 *
 * Profit split, payout policy and days-to-payout used to live here, but they
 * vary within a firm rather than across it, so they moved to the plan and the
 * account. The columns remain for the accounts that still fall back to them,
 * and are simply not written from this form — an edit must not reset a value
 * the form never showed.
 */
const firmSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  website: optionalText,
  notes: optionalText,
  /** Plan catalogue carried from a firm template, as JSON. */
  plansJson: optionalText.optional(),
})

export async function saveFirm(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const { plansJson, ...values } = firmSchema.parse(Object.fromEntries(formData))
    const payload: Record<string, unknown> = { ...values }

    // A template's catalogue seeds plans only on create — an edit never
    // silently overwrites a catalogue the user has since customised.
    if (id === null && plansJson) {
      payload.plans = z.array(firmPlanSchema).max(50).parse(JSON.parse(plansJson))
    }

    if (id) await db.update(propFirms).set(payload).where(eq(propFirms.id, id))
    else await db.insert(propFirms).values(payload as typeof propFirms.$inferInsert)

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
  startingBalance: requiredNum.catch(50_000),
  profitTarget: optionalNum,
  maxDrawdown: optionalNum,
  drawdownType: z.enum(['trailing_intraday', 'trailing_eod', 'static', 'none']).default('trailing_eod'),
  drawdownLocksAt: optionalNum,
  dailyLossLimit: optionalNum,
  maxContracts: optionalNum,
  maxMicroContracts: optionalNum,
  /** Blank falls back to the firm's split rather than assuming a number. */
  profitSplit: optionalNum,
  payoutPolicy: optionalText,
  minTradingDays: optionalNum,
  payoutMinTradingDays: optionalNum,
  minWinningDays: optionalNum,
  winningDayMinProfit: optionalNum,
  consistencyPercent: optionalNum,
  costBase: num.default(0),
  commissionPerContract: num.default(0),
  currentBalance: optionalNum,
  openingBalance: optionalNum,
  openingBalanceAt: optionalText,
  buffer: optionalNum,
  minPayout: optionalNum,
  startedOn: optionalText,
  notes: optionalText,
  excludeFromStats: z.coerce.boolean().default(false),
})

/**
 * Keeps the expense ledger in step with what an account cost.
 *
 * The price of an evaluation is typed on the accounts page, because that is
 * where you are when you buy one — and it is an expense, so it belongs in the
 * expense ledger too. Typing it twice is how the two disagree.
 *
 * One row per account, marked `source: 'account'` so it can be found again:
 * changing the cost edits that row, clearing it deletes the row, and an
 * expense you wrote by hand is never touched.
 */
async function syncAccountCostExpense(
  accountId: number,
  values: { label: string; costBase: number; firmId: number | null; startedOn?: string | null },
): Promise<void> {
  const [existing] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.accountId, accountId), eq(expenses.source, 'account')))
    .limit(1)

  if (!values.costBase || values.costBase <= 0) {
    if (existing) await db.delete(expenses).where(eq(expenses.id, existing.id))
    return
  }

  const settings = await getSettings()
  const [firm] = values.firmId
    ? await db.select({ name: propFirms.name }).from(propFirms).where(eq(propFirms.id, values.firmId)).limit(1)
    : []

  const row = {
    spentOn: values.startedOn || today(settings.timezone),
    category: 'eval_fee' as const,
    vendor: firm?.name ?? 'Prop firm',
    description: `${values.label} — account cost`,
    amount: values.costBase,
    currency: 'USD',
    fxRate: 1,
    amountBase: values.costBase,
    firmId: values.firmId,
    accountId,
    deductiblePercent: defaultDeductibleFor('eval_fee'),
    notes: 'Kept in step with the account\'s cost on the accounts page.',
    source: 'account',
  }

  if (existing) await db.update(expenses).set(row).where(eq(expenses.id, existing.id))
  else await db.insert(expenses).values(row)
}

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
      maxMicroContracts: values.maxMicroContracts ?? null,
      profitSplit: values.profitSplit ?? null,
      minTradingDays: values.minTradingDays ?? null,
      payoutMinTradingDays: values.payoutMinTradingDays ?? null,
      minWinningDays: values.minWinningDays ?? null,
      winningDayMinProfit: values.winningDayMinProfit ?? null,
      // Entered as a whole percentage; stored as a fraction.
      consistencyPercent: values.consistencyPercent === null ? null : values.consistencyPercent / 100,
      currentBalance: values.currentBalance ?? null,
      balanceUpdatedAt: values.currentBalance !== null ? new Date() : undefined,
      // A stated balance without its date cannot say which trades it already
      // contains, so it is stored only as a pair — and clearing either clears
      // both rather than leaving an anchor that silently does nothing.
      openingBalance: values.openingBalanceAt === null ? null : (values.openingBalance ?? null),
      openingBalanceAt: values.openingBalance === null ? null : values.openingBalanceAt,
      buffer: values.buffer ?? null,
      minPayout: values.minPayout ?? null,
    }

    if (id) {
      const [before] = await db
        .select({ rate: accounts.commissionPerContract })
        .from(accounts)
        .where(eq(accounts.id, id))
        .limit(1)
      await db.update(accounts).set(payload).where(eq(accounts.id, id))

      // A commission change must reach the fills that were costed from the old
      // rate, or it changes nothing: rebuilds re-read the stored per-fill
      // commission. Broker-synced fills are always rate-derived (the API sends
      // none), and a stored zero means "no commission was known" — both get
      // repriced at half the round turn per side. Fills that came in with a
      // real commission from a CSV column are left untouched.
      if (before && before.rate !== values.commissionPerContract) {
        await db
          .update(executions)
          .set({
            commission: sql`${executions.qty} * ${values.commissionPerContract} / 2`,
          })
          .where(
            and(
              eq(executions.accountId, id),
              or(eq(executions.source, 'tradovate_api'), eq(executions.commission, 0)),
            ),
          )
        await rebuildTradesForAccount(id)
      } else {
        await rollupDailyStats(id)
      }
      await syncAccountCostExpense(id, {
        label: values.label,
        costBase: values.costBase,
        firmId: values.firmId ?? null,
        startedOn: values.startedOn,
      })
    } else {
      const [created] = await db.insert(accounts).values(payload).returning({ id: accounts.id })
      await syncAccountCostExpense(created.id, {
        label: values.label,
        costBase: values.costBase,
        firmId: values.firmId ?? null,
        startedOn: values.startedOn,
      })
    }

    revalidateAll()
    return `Saved ${values.label}.`
  })
}

/**
 * Creates an account from a catalogue plan.
 *
 * Typing eighteen rule fields by hand for every new evaluation is how those
 * fields end up blank, and a blank drawdown or profit target silently turns
 * off every warning the app exists to give. The catalogue already holds the
 * firm's own numbers, so this copies them across and asks only for what the
 * catalogue cannot know: what you call it, which stage it is at, and what you
 * paid.
 *
 * The firm row is created on demand. Nothing is pre-seeded for the user, but
 * an account has to belong to something, and making them add the firm first
 * only to pick it again from a dropdown is a step with no decision in it.
 */
const fromPlanSchema = z.object({
  firmSlug: z.string().min(1),
  planLabel: z.string().min(1),
  label: z.string().min(1, 'Give the account a label'),
  phase: z.enum(['eval', 'funded', 'live', 'personal', 'demo']).default('eval'),
  externalId: optionalText,
  platform: z.string().default('tradovate'),
  startedOn: optionalText,
  costBase: optionalNum,
  openingBalance: optionalNum,
  openingBalanceAt: optionalText,
})

export async function addAccountFromPlan(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const values = fromPlanSchema.parse(Object.fromEntries(formData))

    // A firm added by hand has no catalogue entry, and the firms page lists it
    // alongside the ones that do under a `db-<id>` slug. Its own stored plans
    // are then the catalogue: same form, same rules, one list on screen.
    const handAdded = /^db-(\d+)$/.exec(values.firmSlug)
    const catalogue = handAdded
      ? await (async () => {
          const [row] = await db
            .select({ name: propFirms.name, website: propFirms.website, plans: propFirms.plans })
            .from(propFirms)
            .where(eq(propFirms.id, Number(handAdded[1])))
            .limit(1)
          return row
            ? { name: row.name, website: row.website ?? '', plans: row.plans ?? [] }
            : undefined
        })()
      : FIRM_CATALOGUES.find((entry) => entry.slug === values.firmSlug)
    if (!catalogue) throw new Error(`No catalogue for "${values.firmSlug}".`)
    const plan = catalogue.plans.find((entry) => entry.label === values.planLabel)
    if (!plan) throw new Error(`${catalogue.name} has no plan called "${values.planLabel}".`)

    // Match on name so a firm the user added by hand is reused rather than
    // duplicated — they would then have two "MyFundedFutures" rows and their
    // economics split across both.
    const [existing] = await db
      .select({ id: propFirms.id, plans: propFirms.plans })
      .from(propFirms)
      .where(sql`lower(${propFirms.name}) = ${catalogue.name.toLowerCase()}`)
      .limit(1)

    const firmId =
      existing?.id ??
      (
        await db
          .insert(propFirms)
          .values({ name: catalogue.name, website: catalogue.website, plans: catalogue.plans })
          .returning({ id: propFirms.id })
      )[0].id

    // A firm row that predates the catalogue — or one seeded by name alone —
    // carries no plans, which leaves its price editor empty. Fill it the first
    // time an account is added from that firm; never overwrite plans the user
    // has already edited.
    if (existing && (existing.plans ?? []).length === 0 && catalogue.plans.length > 0) {
      await db.update(propFirms).set({ plans: catalogue.plans }).where(eq(propFirms.id, firmId))
    }

    // A profit target belongs to an evaluation. Carrying it onto a funded
    // account would show a progress bar toward a bar that no longer exists.
    const isEval = values.phase === 'eval'

    const [created] = await db.insert(accounts).values({
      firmId,
      label: values.label,
      externalId: values.externalId,
      platform: values.platform,
      phase: values.phase,
      planLabel: plan.label,
      startingBalance: plan.size,
      profitTarget: isEval ? plan.profitTarget : null,
      maxDrawdown: plan.maxDrawdown,
      drawdownType: plan.drawdownType,
      dailyLossLimit: plan.dailyLossLimit,
      maxContracts: plan.maxContracts ?? null,
      maxMicroContracts: plan.maxMicroContracts ?? null,
      profitSplit: plan.profitSplit ?? null,
      minTradingDays: plan.minTradingDays ?? null,
      minWinningDays: plan.minWinningDays,
      winningDayMinProfit: plan.winningDayMinProfit,
      consistencyPercent: plan.consistencyPercent,
      buffer: plan.buffer ?? null,
      // The catalogue keeps this as the firm writes it ("$500", "1% of
      // balance"); only a plain figure becomes a number to test against.
      minPayout: parsePlainMoney(plan.minPayout ?? null),
      payoutPolicy: [plan.payoutFrequency, plan.minPayout ? `Minimum ${plan.minPayout}` : null, plan.notes]
        .filter(Boolean)
        .join(' · ') || null,
      costBase: values.costBase ?? plan.cost ?? 0,
      startedOn: values.startedOn,
      openingBalance: values.openingBalanceAt === null ? null : values.openingBalance,
      openingBalanceAt: values.openingBalance === null ? null : values.openingBalanceAt,
    }).returning({ id: accounts.id })

    await syncAccountCostExpense(created.id, {
      label: values.label,
      costBase: values.costBase ?? plan.cost ?? 0,
      firmId,
      startedOn: values.startedOn,
    })

    revalidateAll()
    return `Added ${values.label} from ${catalogue.name} ${plan.label}.`
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

const bulkRowSchema = z.object({
  id: z.number().int().positive(),
  firmId: z.number().int().positive().nullable(),
  planLabel: z.string().max(120).nullable(),
  phase: z.enum(['eval', 'funded', 'live', 'personal', 'demo']),
  startingBalance: z.number().nonnegative(),
  drawdownType: z.enum(['trailing_intraday', 'trailing_eod', 'static', 'none']),
  maxDrawdown: z.number().positive().nullable(),
  /** Whole percent from the grid, 0..100. */
  consistencyPercent: z.number().min(0).max(100).nullable(),
  profitTarget: z.number().positive().nullable(),
  /** Contract ceilings, which firms quote separately for minis and micros. */
  maxContracts: z.number().int().nonnegative().nullable(),
  maxMicroContracts: z.number().int().nonnegative().nullable(),
  costBase: z.number().nonnegative(),
})

/**
 * Saves the accounts grid in one submit.
 *
 * One transaction, one UPDATE per changed row — the grid sends only rows the
 * user actually touched, so this stays small even with dozens of accounts on
 * screen. Fields not present in the grid (commission, broker id, status…) are
 * deliberately untouched; the full per-account form owns those.
 */
export async function bulkUpdateAccounts(rows: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = z.array(bulkRowSchema).min(1).max(500).parse(rows)

    await db.transaction(async (tx) => {
      for (const row of parsed) {
        await tx
          .update(accounts)
          .set({
            firmId: row.firmId,
            planLabel: row.planLabel,
            phase: row.phase,
            startingBalance: row.startingBalance,
            drawdownType: row.drawdownType,
            maxDrawdown: row.maxDrawdown,
            consistencyPercent: row.consistencyPercent === null ? null : row.consistencyPercent / 100,
            profitTarget: row.profitTarget,
            maxContracts: row.maxContracts,
            maxMicroContracts: row.maxMicroContracts,
            costBase: row.costBase,
          })
          .where(eq(accounts.id, row.id))
      }
    })

    revalidateAll()
    return `Saved ${parsed.length} account${parsed.length === 1 ? '' : 's'}.`
  })
}

/**
 * A plan as stored on a firm.
 *
 * Every field the catalogue can carry is listed, not only the ones the editor
 * shows: a Zod object drops unknown keys, so a schema that stopped at `cost`
 * quietly deleted the buffer, the payout minimum, the contract ceilings and
 * the notes every time a plan was saved — which is what a trader does the
 * moment they want to record what a plan actually cost them.
 *
 * The optional ones default to null rather than being required, so a plan
 * written before a field existed still validates.
 */
const nullableNumber = z.number().nullable().optional().transform((value) => value ?? null)
const nullableString = z.string().max(600).nullable().optional().transform((value) => value ?? null)

const firmPlanSchema = z.object({
  label: z.string().min(1).max(120),
  phase: z.enum(['eval', 'funded']),
  size: z.number().positive(),
  maxDrawdown: z.number().positive().nullable(),
  drawdownType: z.enum(['trailing_intraday', 'trailing_eod', 'static', 'none']),
  consistencyPercent: z.number().min(0).max(1).nullable(),
  profitTarget: z.number().positive().nullable(),
  dailyLossLimit: z.number().positive().nullable(),
  minWinningDays: z.number().int().positive().nullable(),
  winningDayMinProfit: z.number().positive().nullable(),
  cost: z.number().nonnegative().nullable(),

  profitSplit: nullableNumber,
  maxContracts: nullableNumber,
  maxMicroContracts: nullableNumber,
  activationFee: nullableNumber,
  resetFee: nullableNumber,
  buffer: nullableNumber,
  minTradingDays: nullableNumber,
  payoutFrequency: nullableString,
  minPayout: nullableString,
  notes: nullableString,
})

/** Replaces a firm's plan catalogue. Plans are templates; accounts keep copies. */
export async function saveFirmPlans(firmId: number, plans: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = z.array(firmPlanSchema).max(50).parse(plans)
    await db.update(propFirms).set({ plans: parsed }).where(eq(propFirms.id, firmId))
    revalidateAll()
    return `Saved ${parsed.length} plan${parsed.length === 1 ? '' : 's'}.`
  })
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

const tradeSchema = z.object({
  /** At least one — a copied trade is logged on every account it was taken on. */
  accountIds: z.array(num).min(1, 'Pick at least one account'),
  symbol: z.string().min(1, 'Symbol is required'),
  direction: z.enum(['long', 'short']),
  qty: num.int().positive(),
  entryAt: z.string().min(1, 'Entry time is required'),
  exitAt: optionalText,
  avgEntry: requiredNum,
  avgExit: optionalNum,
  netPnl: requiredNum,
  stopPrice: optionalNum,
  setup: optionalText,
  modelId: optionalNum,
  notes: optionalText,
})

/**
 * Logs a hand-written trade, or corrects one.
 *
 * Editing is restricted to manual trades on purpose. Synced and imported
 * trades are derived from the executions table and are deleted and rebuilt
 * from it, so an edit here would vanish at the next rebuild without ever
 * saying so — a silent data loss is worse than a refusal.
 */
export async function saveManualTrade(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    // `getAll`, because the account picker submits one value per account and
    // `Object.fromEntries` keeps only the last of them.
    const values = tradeSchema.parse({
      ...Object.fromEntries(formData),
      accountIds: formData.getAll('accountIds'),
    })
    const settings = await getSettings()

    if (id) {
      const [existing] = await db
        .select({ autoGenerated: trades.autoGenerated, accountId: trades.accountId })
        .from(trades)
        .where(eq(trades.id, id))
        .limit(1)
      if (!existing) throw new Error('Trade not found.')
      if (existing.autoGenerated) {
        throw new Error(
          'This trade came from a sync or an import, so it is rebuilt from your executions and cannot be edited directly. Notes, tags and the model can still be changed below.',
        )
      }
    }

    const entryAt = new Date(values.entryAt)
    const exitAt = values.exitAt ? new Date(values.exitAt) : null

    // The round-turn rate is a property of the account, not of the trade: it is
    // the same every time, so it is set once on the accounts page rather than
    // typed into every ticket. A trade that never closed has not paid the exit
    // side yet, so it is costed at half — and a trade copied across accounts is
    // costed at each account's own rate, which is the one thing that genuinely
    // differs between them.
    const rates = await db
      .select({ id: accounts.id, rate: accounts.commissionPerContract })
      .from(accounts)
      .where(inArray(accounts.id, values.accountIds))
    const commissionFor = (accountId: number): number => {
      const roundTurn = (rates.find((row) => row.id === accountId)?.rate ?? 0) * values.qty
      return exitAt ? roundTurn : roundTurn / 2
    }

    const screenshot = await prepareScreenshot(formData.get('screenshot') as File | null)

    const riskBase =
      values.stopPrice !== null
        ? riskFromStop(values.symbol, values.direction, values.avgEntry, values.stopPrice, values.qty)
        : null

    // Typed explicitly: lifted out of the insert call, the literal would widen
    // `status` to string and stop matching the column's enum.
    const rowFor = (accountId: number): typeof trades.$inferInsert => ({
      accountId,
      symbol: values.symbol.toUpperCase(),
      contract: values.symbol.toUpperCase(),
      direction: values.direction,
      qty: values.qty,
      entryAt,
      exitAt,
      tradingDay: tradingDayFor(entryAt, settings.timezone, settings.dayBoundary),
      avgEntry: values.avgEntry,
      avgExit: values.avgExit,
      // Net is what was typed — the figure the broker actually settled — so
      // gross is that plus what it cost to get there.
      grossPnl: values.netPnl + commissionFor(accountId),
      commission: commissionFor(accountId),
      fees: 0,
      netPnl: values.netPnl,
      stopPrice: values.stopPrice,
      riskBase,
      rMultiple: rMultiple(values.netPnl, riskBase),
      durationSeconds: exitAt ? Math.round((exitAt.getTime() - entryAt.getTime()) / 1000) : null,
      status: exitAt ? 'closed' : 'open',
      setup: values.setup,
      modelId: values.modelId,
      notes: values.notes,
      // Only when a new file was chosen: an edit that leaves the picker empty
      // is an edit to the other fields, not an instruction to drop the chart.
      ...(screenshot
        ? {
            screenshot: screenshot.data,
            screenshotType: screenshot.type,
            screenshotBytes: screenshot.bytes,
          }
        : {}),
      // Manual trades are the user's own record and survive a rebuild.
      autoGenerated: false,
    })

    if (id) {
      await db.update(trades).set(rowFor(values.accountIds[0])).where(eq(trades.id, id))
    } else {
      await db.insert(trades).values(values.accountIds.map(rowFor))
    }

    for (const accountId of values.accountIds) await rollupDailyStats(accountId)
    revalidateAll()
    if (id) return 'Trade updated.'
    return values.accountIds.length === 1
      ? 'Trade saved.'
      : `Logged on ${values.accountIds.length} accounts.`
  })
}

/** Post-trade journalling on an existing trade, whether synced or manual. */
export async function annotateTrade(id: number, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const [existing] = await db.select().from(trades).where(eq(trades.id, id)).limit(1)
    if (!existing) throw new Error('Trade not found.')

    const stopPrice = optionalNum.parse(formData.get('stopPrice') ?? '')
    const modelId = optionalNum.parse(formData.get('modelId') ?? '')
    const annotationShot = await prepareScreenshot(formData.get('screenshot') as File | null)
    const riskBase =
      stopPrice !== null
        ? riskFromStop(existing.symbol, existing.direction, existing.avgEntry, stopPrice, existing.qty)
        : existing.riskBase

    await db
      .update(trades)
      .set({
        stopPrice,
        riskBase,
        rMultiple: rMultiple(existing.netPnl, riskBase),
        setup: optionalText.parse(formData.get('setup') ?? ''),
        modelId: modelId,
        // A verdict is only meaningful against the model it was made for.
        modelReview: modelId === existing.modelId ? existing.modelReview : null,
        notes: optionalText.parse(formData.get('notes') ?? ''),
        ...(annotationShot
          ? {
              screenshot: annotationShot.data,
              screenshotType: annotationShot.type,
              screenshotBytes: annotationShot.bytes,
            }
          : {}),
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
    const [existing] = await db
      .select({ accountId: trades.accountId })
      .from(trades)
      .where(eq(trades.id, id))
      .limit(1)
    await db.delete(trades).where(eq(trades.id, id))
    // Without this the deleted trade kept haunting equity, drawdown room and
    // daily P&L until the next nightly rollup.
    if (existing) await rollupDailyStats(existing.accountId)
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
  amount: requiredNum.pipe(z.number().positive('Amount must be greater than zero')),
  currency: z.string().default('USD'),
  accountId: optionalNum,
  firmId: optionalNum,
  deductiblePercent: optionalNum,
  vatAmount: num.default(0),
  notes: optionalText,
  cryptoNetwork: optionalText,
  cryptoTxHash: optionalText,
  cryptoAddress: optionalText,
  /** Unit price of a volatile asset when it settled, in the base currency. */
  settlementRate: optionalNum,
})

export async function saveExpense(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const raw = Object.fromEntries(formData)
    const values = expenseSchema.parse(raw)
    const settings = await getSettings()

    const fxRate = settlementRate(values.currency, settings, values.settlementRate)

    const { settlementRate: _rate, ...columns } = values
    const payload = {
      ...columns,
      ...cryptoColumns(values.currency, values),
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
    return `${id ? 'Updated' : 'Logged'} ${values.vendor}.`
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
  amount: requiredNum.pipe(z.number().positive()),
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
      nextRenewalOn: values.nextRenewalOn ?? nextRenewal(values.startedOn, values.cadence),
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
  grossAmount: requiredNum.pipe(z.number().positive()),
  profitSplit: num.min(0).max(1).default(0.9),
  processingFee: num.default(0),
  currency: z.string().default('USD'),
  method: optionalText,
  reference: optionalText,
  notes: optionalText,
  cryptoNetwork: optionalText,
  cryptoTxHash: optionalText,
  cryptoAddress: optionalText,
  /** Unit price of a volatile asset when it settled, in the base currency. */
  settlementRate: optionalNum,
})

/**
 * Moves a payout to its next state: requested → approved → paid.
 *
 * A payout spends its life walking that line, and doing it through the full
 * edit form meant opening a row, finding the status select and saving, four
 * times a month. The day it lands is stamped automatically, because "paid" and
 * "paid on" are the same fact and typing the second one is how they drift
 * apart.
 */
/** Applies one email suggestion to the account the trader picked. */
export async function applyEmailSuggestion(
  eventId: number,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const accountId = num.parse(formData.get('accountId'))
    const { message } = await applyEmailProposal(eventId, accountId)
    revalidateAll()
    revalidatePath('/settings')
    return message
  })
}

/** Declines one. The email stays in the log; the suggestion does not come back. */
export async function dismissEmailSuggestion(eventId: number): Promise<ActionResult> {
  return guard(async () => {
    await dismissEmailProposal(eventId)
    revalidatePath('/settings')
    return 'Suggestion dismissed.'
  })
}

export async function advancePayout(id: number): Promise<ActionResult> {
  return guard(async () => {
    const [existing] = await db
      .select({ status: payouts.status, paidOn: payouts.paidOn })
      .from(payouts)
      .where(eq(payouts.id, id))
      .limit(1)
    if (!existing) throw new Error('Payout not found.')

    const next =
      existing.status === 'requested' ? 'approved' : existing.status === 'approved' ? 'paid' : null
    if (!next) throw new Error(`A ${existing.status} payout has nowhere further to go.`)

    const settings = await getSettings()
    await db
      .update(payouts)
      .set({
        status: next,
        // Only when it is not already recorded: a payout entered late already
        // knows the day it arrived, and today is not that day.
        ...(next === 'paid' && !existing.paidOn ? { paidOn: today(settings.timezone) } : {}),
      })
      .where(eq(payouts.id, id))

    revalidateAll()
    return next === 'approved' ? 'Marked approved.' : 'Marked paid.'
  })
}

export async function savePayout(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const values = payoutSchema.parse(Object.fromEntries(formData))
    const settings = await getSettings()

    // What actually lands: the trader's share, less whatever the firm charges
    // to move it.
    const netAmount = values.grossAmount * values.profitSplit - values.processingFee
    // Same conversion the expense path uses. The old inline version booked an
    // ILS payout 1:1 into a USD base — a ₪10,000 payout recorded as $10,000.
    const fxRate = settlementRate(values.currency, settings, values.settlementRate)
    const netAmountBase = netAmount * fxRate

    // Caps only mean anything against the RUNNING balance of each bucket, so
    // feed the sum of every previous paid payout's allocation. Without this,
    // the operating and emergency caps were applied per payout against zero
    // and never actually capped anything.
    const previous = await db
      .select({ allocation: payouts.allocation })
      .from(payouts)
      .where(eq(payouts.status, 'paid'))
    const balances: Record<string, number> = {}
    for (const row of previous) {
      for (const [key, amount] of Object.entries(row.allocation ?? {})) {
        balances[key] = (balances[key] ?? 0) + amount
      }
    }

    const allocation = allocatePayout(netAmountBase, settings.allocationPlan, balances)
    const taxLine = allocation.lines.find((line) => line.key === 'tax')

    const { settlementRate: _rate, ...columns } = values
    const payload = {
      ...columns,
      ...cryptoColumns(values.currency, values),
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

/**
 * A receiving address, saved so a payout's destination is a name.
 *
 * Deliberately narrow: nothing here can move money. The address is public
 * information by construction — it is what you hand a prop firm — so it is
 * stored in the clear, unlike the broker credentials next door.
 */
const walletSchema = z.object({
  label: z.string().min(1, 'Give it a name'),
  network: z.string().min(1, 'Choose a chain'),
  address: z.string().min(1, 'Address is required'),
  assets: optionalText,
  custody: optionalText,
  notes: optionalText,
})

export async function saveWallet(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const raw = Object.fromEntries(formData)
    const values = walletSchema.parse(raw)
    const address = values.address.trim()

    // A warning, not a rejection: a chain this app has not heard of yet must
    // not stop the trader recording where their money actually goes.
    const shape = addressLooksValid(values.network, address)

    const payload = { ...values, address, active: raw.active !== 'off' }
    if (id) await db.update(wallets).set(payload).where(eq(wallets.id, id))
    else await db.insert(wallets).values(payload)

    revalidateAll()
    return shape
      ? `Saved ${values.label}.`
      : `Saved ${values.label} — but that does not look like a ${values.network} address, so check it before using it.`
  })
}

export async function deleteWallet(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(wallets).where(eq(wallets.id, id))
    revalidateAll()
    return 'Wallet removed. Payouts that used it keep their address and hash.'
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
// Trade setups

/**
 * A setup as the trader recorded it.
 *
 * Prices and point distances are two ways of writing one fact, so the form
 * takes whichever the platform showed and `deriveSetup` fills in the rest.
 * Where both are given and disagree, the mismatch is reported back rather than
 * quietly resolved — a stop recorded 45 points from the entry when the order
 * was 20 makes every R-multiple downstream wrong.
 */
const setupSchema = z.object({
  entryDate: z.string().min(1, 'A date is required'),
  symbol: optionalText,
  direction: z.enum(['long', 'short']).nullish().catch(null),
  entryPrice: optionalNum,
  stopPrice: optionalNum,
  stopPoints: optionalNum,
  targetPrice: optionalNum,
  targetPoints: optionalNum,
  riskReward: optionalNum,
  modelId: optionalNum,
  notes: optionalText,
})

export async function saveSetup(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const raw = Object.fromEntries(formData)
    const values = setupSchema.parse({ ...raw, direction: raw.direction || null })

    const derived = deriveSetup({
      direction: values.direction ?? null,
      entryPrice: values.entryPrice,
      stopPrice: values.stopPrice,
      stopPoints: values.stopPoints,
      targetPrice: values.targetPrice,
      targetPoints: values.targetPoints,
      riskReward: values.riskReward,
    })

    const file = formData.get('screenshot')
    const image = await prepareScreenshot(file instanceof File ? file : null)

    const payload = {
      entryDate: values.entryDate,
      symbol: values.symbol,
      direction: derived.direction,
      entryPrice: derived.entryPrice,
      stopPrice: derived.stopPrice,
      stopPoints: derived.stopPoints,
      targetPrice: derived.targetPrice,
      targetPoints: derived.targetPoints,
      riskReward: derived.riskReward,
      modelId: values.modelId ?? null,
      notes: values.notes,
      updatedAt: new Date(),
      // Only overwrite the chart when a new one was actually sent: an edit that
      // changes a price must not silently drop the screenshot.
      ...(image
        ? { screenshot: image.data, screenshotType: image.type, screenshotBytes: image.bytes }
        : {}),
    }

    if (id) await db.update(tradeSetups).set(payload).where(eq(tradeSetups.id, id))
    else await db.insert(tradeSetups).values(payload)

    revalidateAll()
    const saved = id ? 'Setup updated' : 'Setup saved'
    return derived.warnings.length > 0
      ? `${saved} — but check this: ${derived.warnings.join(' ')}`
      : `${saved}.`
  })
}

export async function deleteSetup(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(tradeSetups).where(eq(tradeSetups.id, id))
    revalidateAll()
    return 'Setup deleted.'
  })
}

/** Asks the model to read the chart. Never writes over what the trader typed. */
export async function readSetupChart(id: number): Promise<ActionResult> {
  return guard(async () => {
    const result = await scanSetupScreenshot(id)
    revalidateAll()
    if (!result.ok) throw new Error(result.message)
    return result.message
  })
}

/**
 * Copies the model's reading into the setup's own fields.
 *
 * Deliberately a separate, explicit step: the reading arrives as a suggestion
 * and becomes data only when the trader has looked at it and pressed the
 * button. Anything the model could not read is left exactly as it was.
 */
export async function acceptChartReading(id: number): Promise<ActionResult> {
  return guard(async () => {
    const [row] = await db.select().from(tradeSetups).where(eq(tradeSetups.id, id)).limit(1)
    if (!row) throw new Error('That setup no longer exists.')
    const scan = row.aiExtract as Record<string, unknown> | null
    if (!scan) throw new Error('That setup has not been read yet.')

    const pick = (key: string): number | null => {
      const value = scan[key]
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    }

    const derived = deriveSetup({
      direction: (scan.direction as 'long' | 'short' | null) ?? row.direction,
      entryPrice: pick('entryPrice') ?? row.entryPrice,
      stopPrice: pick('stopPrice') ?? row.stopPrice,
      targetPrice: pick('targetPrice') ?? row.targetPrice,
    })

    const named = typeof scan.modelName === 'string' ? scan.modelName.toLowerCase() : null
    const [model] = named
      ? await db
          .select({ id: tradingModels.id })
          .from(tradingModels)
          .where(sql`lower(${tradingModels.name}) = ${named}`)
          .limit(1)
      : []

    await db
      .update(tradeSetups)
      .set({
        direction: derived.direction,
        entryPrice: derived.entryPrice,
        stopPrice: derived.stopPrice,
        stopPoints: derived.stopPoints,
        targetPrice: derived.targetPrice,
        targetPoints: derived.targetPoints,
        riskReward: derived.riskReward,
        symbol: (typeof scan.symbol === 'string' ? scan.symbol : null) ?? row.symbol,
        modelId: model?.id ?? row.modelId,
        updatedAt: new Date(),
      })
      .where(eq(tradeSetups.id, id))

    revalidateAll()
    return 'Reading copied into the setup. Check every level against your platform.'
  })
}

// ---------------------------------------------------------------------------
// Document folders

const folderSchema = z.object({
  name: z.string().min(1, 'Give the folder a name'),
  description: optionalText,
})

export async function saveFolder(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const values = folderSchema.parse(Object.fromEntries(formData))
    if (id) await db.update(documentFolders).set(values).where(eq(documentFolders.id, id))
    else await db.insert(documentFolders).values(values)
    revalidateAll()
    return `Saved ${values.name}.`
  })
}

/**
 * Removes a folder, keeping everything in it.
 *
 * The foreign key is ON DELETE SET NULL, so the documents move to the vault's
 * root. Deleting a folder is a filing decision; taking a passport scan with it
 * would be a destructive one, and the two should never share a button.
 */
export async function deleteFolder(id: number): Promise<ActionResult> {
  return guard(async () => {
    await db.delete(documentFolders).where(eq(documentFolders.id, id))
    revalidateAll()
    return 'Folder removed. Everything in it moved back to the vault root.'
  })
}

export async function moveDocument(id: number, folderId: number | null): Promise<ActionResult> {
  return guard(async () => {
    await db.update(documents).set({ folderId }).where(eq(documents.id, id))
    revalidateAll()
    return folderId === null ? 'Moved to the vault root.' : 'Moved.'
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
      usdIls: requiredNum.pipe(z.number().positive()).parse(formData.get('usdIls') ?? 3.7),
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
      creditPoints: requiredNum.parse(formData.get('creditPoints') ?? 2.25),
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

/** Hides one insight until its underlying condition changes or returns. */
export async function dismissInsightAction(id: number): Promise<ActionResult> {
  return guard(async () => {
    const { dismissInsight } = await import('./insights')
    await dismissInsight(id)
    revalidatePath('/')
    revalidatePath('/trades')
    return 'Dismissed. It comes back only if the condition re-fires after being resolved.'
  })
}

export async function refreshInsights(): Promise<ActionResult> {
  return guard(async () => {
    const result = await regenerateInsights()
    revalidateAll()
    return `${result.generated} insights generated, ${result.resolved} resolved.`
  })
}

/**
 * Reads the prop-firm inboxes on demand.
 *
 * The same job the schedule runs — exposed as a button so setting the mailbox
 * up has an immediate, visible result, and so a wider window can be replayed
 * to backfill mail that arrived before the automation existed. Re-reading is
 * safe: every event is deduped on the email's own Message-ID.
 */
export async function checkInbox(days: number): Promise<ActionResult> {
  return guard(async () => {
    const summary = await runEmailIngest({ days })
    revalidateAll()

    if (summary.errors.length > 0) {
      throw new Error(summary.errors.join('; ').slice(0, 300))
    }

    const parts = [`Read ${summary.scanned} email${summary.scanned === 1 ? '' : 's'}`]
    parts.push(summary.applied === 1 ? '1 new event logged' : `${summary.applied} new events logged`)
    if (summary.skipped > 0) parts.push(`${summary.skipped} already known`)
    return `${parts.join(' — ')}.`
  })
}

const subscriptionJsonSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }),
})

/**
 * Registers this browser or installed app for notifications.
 *
 * The subscription arrives as the JSON the browser produced, which is the only
 * shape a push service accepts back; it is parsed here rather than trusted.
 */
export async function registerPushDevice(subscription: string, label: string): Promise<ActionResult> {
  return guard(async () => {
    const parsed = subscriptionJsonSchema.parse(JSON.parse(subscription))
    await saveDevice({
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      label: label.slice(0, 40),
    })
    revalidatePath('/settings')
    return 'Notifications are on for this device.'
  })
}

export async function removePushDevice(id: number): Promise<ActionResult> {
  return guard(async () => {
    await forgetDevice(id)
    revalidatePath('/settings')
    return 'Device removed.'
  })
}

export async function sendTestNotification(): Promise<ActionResult> {
  return guard(async () => {
    const { sent, failed } = await sendPush({
      title: 'Trading Journal',
      body: 'Notifications are working. This is what a payout alert will look like.',
      url: '/',
      tag: 'test',
    })
    if (sent === 0) {
      throw new Error(
        failed > 0
          ? 'Every device rejected the notification — try Enable again to refresh the subscription.'
          : 'No devices are registered yet.',
      )
    }
    return `Sent to ${sent} device${sent === 1 ? '' : 's'}.`
  })
}

/**
 * Rewrites one piece of the interface's own wording.
 *
 * Every path is revalidated rather than just the current one: the same words
 * can appear on several pages, and seeing a heading change in one place but
 * not another would read as a bug.
 */
/**
 * Picks one of the app marks.
 *
 * Everything that shows the logo — the sidebar, the tab icon, the manifest the
 * phone reads — resolves it from this one value, so the whole app follows in
 * one step. The id is validated against the catalogue, never trusted.
 */
const documentSchema = z.object({
  kind: z
    .enum(['payout_confirmation', 'statement', 'id_document', 'invoice', 'contract', 'other'])
    .default('other'),
  label: z.string().max(200).default(''),
  folderId: optionalNum,
  firmId: optionalNum,
  accountId: optionalNum,
  documentDate: optionalText,
  notes: optionalText,
})

/**
 * Adds a document to the vault.
 *
 * The file never touches disk and is encrypted before the insert — see
 * src/server/documents.ts for why that matters more here than anywhere else
 * in the app.
 */
export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const file = formData.get('file')
    if (!(file instanceof File)) throw new Error('Choose a file to upload.')

    const values = documentSchema.parse(Object.fromEntries(formData))
    const message = await storeDocument({
      file,
      kind: values.kind,
      label: values.label,
      folderId: values.folderId ?? null,
      firmId: values.firmId ?? null,
      accountId: values.accountId ?? null,
      documentDate: values.documentDate,
      notes: values.notes,
    })

    revalidatePath('/documents')
    return message
  })
}

export async function removeDocument(id: number): Promise<ActionResult> {
  return guard(async () => {
    await deleteDocument(id)
    revalidatePath('/documents')
    return 'Document deleted.'
  })
}

export async function saveLogo(id: string): Promise<ActionResult> {
  return guard(async () => {
    if (!isLogoId(id)) throw new Error('Unknown logo.')
    await updateSettings({ logo: id })
    revalidateAll()
    revalidatePath('/settings')
    // The manifest names the icons, so it has to be re-fetched for the phone
    // to notice.
    revalidatePath('/manifest.webmanifest')
    return 'Logo updated. On your phone, re-add it to the home screen to see the new icon.'
  })
}

export async function saveSiteText(key: string, value: string): Promise<ActionResult> {
  return guard(async () => {
    const parsed = z
      .object({ key: z.string().min(1).max(200), value: z.string().max(2000) })
      .parse({ key, value })

    await setSiteText(parsed.key, parsed.value)
    revalidateAll()
    revalidatePath('/settings')
    revalidatePath('/trades')
    revalidatePath('/trades')
    return parsed.value.trim() === '' ? 'Original wording restored.' : 'Saved.'
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

// ---------------------------------------------------------------------------
// Trading models + AI review
// ---------------------------------------------------------------------------

const tradingModelSchema = z.object({
  name: z.string().min(1, 'Give the model a name'),
  description: optionalText,
  timeframe: optionalText,
  instruments: optionalText,
  entryRules: optionalText,
  exitRules: optionalText,
  riskRules: optionalText,
  invalidations: optionalText,
})

export async function saveTradingModel(id: number | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const values = tradingModelSchema.parse(Object.fromEntries(formData))
    const active = formData.get('active') !== null ? formData.get('active') === 'on' : true

    if (id === null) {
      await db.insert(tradingModels).values({ ...values, active })
    } else {
      await db
        .update(tradingModels)
        .set({ ...values, active, updatedAt: new Date() })
        .where(eq(tradingModels.id, id))
    }
    revalidateAll()
    return id === null ? 'Model saved.' : 'Model updated.'
  })
}

export async function deleteTradingModel(id: number): Promise<ActionResult> {
  return guard(async () => {
    // trades.model_id is ON DELETE SET NULL; review history cascades away.
    await db.delete(tradingModels).where(eq(tradingModels.id, id))
    revalidateAll()
    return 'Model deleted. Trades that used it keep everything except the link.'
  })
}

/** Ask the AI to judge one trade against its assigned model. */
export async function reviewTradeAction(tradeId: number): Promise<ActionResult> {
  return guard(async () => {
    const outcome = await reviewTradeAgainstModel(tradeId)
    if (!outcome.ok) throw new Error(outcome.error)
    revalidatePath(`/trades/${tradeId}`)
    revalidateAll()
    return `Verdict: ${outcome.review.verdict} (${outcome.review.score}/100).`
  })
}

/** Batch-review recent unreviewed trades assigned to a model. */
export async function reviewPendingAction(modelId: number): Promise<ActionResult> {
  return guard(async () => {
    const result = await reviewPendingForModel(modelId)
    if (result.error) throw new Error(result.error)
    revalidateAll()
    return result.reviewed === 0 && result.failed === 0
      ? 'Nothing to review — every tagged trade already has a verdict.'
      : `Reviewed ${result.reviewed} trade(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}.`
  })
}

/** AI-assign models to recent trades that have none. */
export async function autoTagAction(): Promise<ActionResult> {
  return guard(async () => {
    const result = await autoTagTrades()
    if (result.error) throw new Error(result.error)
    revalidateAll()
    return `Tagged ${result.tagged} trade(s); left ${result.skipped} untagged (no confident match).`
  })
}

/** The trader grades a verdict — the signal the AI learns from. */
export async function reviewFeedbackAction(
  reviewId: number,
  feedback: 'agree' | 'disagree',
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const note = optionalText.parse(formData.get('note') ?? '')
    const [review] = await db
      .update(modelReviews)
      .set({ feedback, feedbackNote: note })
      .where(eq(modelReviews.id, reviewId))
      .returning({ id: modelReviews.id })
    if (!review) throw new Error('Review not found.')
    revalidateAll()
    return feedback === 'agree'
      ? 'Noted. Agreements confirm the calibration.'
      : 'Noted. Disagreements teach the reviewer the most — refine the model to fold them in.'
  })
}

/** Compress feedback history into the model's stored AI guidance. */
export async function refineModelAction(modelId: number): Promise<ActionResult> {
  return guard(async () => {
    const result = await refineModelGuidance(modelId)
    if (!result.ok) throw new Error(result.message)
    revalidateAll()
    return result.message
  })
}
