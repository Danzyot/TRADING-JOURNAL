/**
 * Database schema.
 *
 * Money is stored as `numeric` and surfaced to TypeScript as `number` via the
 * `money` / `price` custom types below. Postgres numeric avoids float drift on
 * the way in and out; the mapping keeps the analytics code free of string math.
 *
 * Instants are `timestamptz`. The "trading day" a fill belongs to is stored
 * separately as a plain `date` because the CME session crosses midnight UTC and
 * every prop firm evaluates drawdown on *its* day boundary, not on UTC's.
 */
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const numericAsNumber = (precision: number, scale: number) =>
  customType<{ data: number; driverData: string }>({
    dataType: () => `numeric(${precision}, ${scale})`,
    fromDriver: (value) => Number(value),
    toDriver: (value) => String(value),
  })

/** Currency amounts. 4 dp so per-contract commissions like $0.0935 survive. */
const money = numericAsNumber(20, 4)
/** Instrument prices. 8 dp covers FX and crypto futures alongside ES/NQ. */
const price = numericAsNumber(20, 8)
/** Ratios, R-multiples, percentages. */
const ratio = numericAsNumber(12, 6)

// ---------------------------------------------------------------------------
// Settings — single row, id = 1
// ---------------------------------------------------------------------------

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  displayName: text('display_name').default('Trader').notNull(),
  /** Currency all reporting rolls up into. Trading is USD, life is ILS. */
  baseCurrency: text('base_currency').default('USD').notNull(),
  /** IANA zone used to bucket trades into days and sessions. */
  timezone: text('timezone').default('Asia/Jerusalem').notNull(),
  /** Trading day boundary in `timezone`, e.g. '17:00' for the CME session open. */
  dayBoundary: text('day_boundary').default('00:00').notNull(),
  /** USD -> ILS. Refreshed by the daily cron; manual override allowed. */
  usdIls: money('usd_ils').default(3.7).notNull(),
  fxUpdatedAt: timestamp('fx_updated_at', { withTimezone: true }),
  /** Israeli tax profile — see src/lib/tax/israel.ts for the shape. */
  taxProfile: jsonb('tax_profile').$type<TaxProfile>(),
  /** Payout allocation waterfall — see src/lib/allocation.ts. */
  allocationPlan: jsonb('allocation_plan').$type<AllocationPlan>(),
  /** Personal risk guardrails the insights engine checks trades against. */
  riskRules: jsonb('risk_rules').$type<RiskRules>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TaxProfile = {
  /** 'osek_patur' | 'osek_zair' | 'osek_murshe' | 'company' | 'undecided' */
  status: 'osek_patur' | 'osek_zair' | 'osek_murshe' | 'company' | 'undecided'
  /** Israeli tax resident? Drives worldwide-income exposure. */
  israeliResident: boolean
  /** Credit points (נקודות זיכוי). Base for a 21yo male citizen is 2.25. */
  creditPoints: number
  /** Percent of each payout parked for tax. */
  reservePercent: number
  /** Business opened mid-year -> osek patur ceiling is prorated. */
  businessOpenedOn: string | null
  /** Prop firms are foreign residents -> exported service, VAT zero-rated. */
  claimsZeroRatedVat: boolean
}

export type AllocationBucket = {
  key: string
  label: string
  /** Share of the payout, 0..1. Buckets should sum to 1. */
  percent: number
  /** Stop funding this bucket once its balance reaches the cap (base currency). */
  capBase: number | null
  color: string
  note: string
}

export type AllocationPlan = {
  buckets: AllocationBucket[]
}

export type RiskRules = {
  maxTradesPerDay: number
  maxLossPerDayBase: number
  maxConsecutiveLosses: number
  /** Stop trading for the day after this many R lost. */
  maxDailyLossR: number
  /** Flag trades taken outside these hours (local `timezone`), "HH:MM". */
  sessionStart: string
  sessionEnd: string
  /** Flag trades whose risk exceeds this fraction of account size. */
  maxRiskPercentPerTrade: number
}

// ---------------------------------------------------------------------------
// Prop firms & accounts
// ---------------------------------------------------------------------------

/**
 * A plan template inside a firm's catalogue — "Pro — $50k" and friends.
 *
 * Applying one to an account copies the values onto the account; nothing
 * references the plan afterwards, so editing a plan never silently rewrites
 * history, and an account can always diverge from its template.
 */
export type FirmPlan = {
  label: string
  phase: 'eval' | 'funded'
  size: number
  maxDrawdown: number | null
  drawdownType: 'trailing_intraday' | 'trailing_eod' | 'static' | 'none'
  /** Fraction, 0..1, like the account column. */
  consistencyPercent: number | null
  profitTarget: number | null
  dailyLossLimit: number | null
  minWinningDays: number | null
  winningDayMinProfit: number | null
  /** What this plan costs to buy, for pre-filling the account's cost. */
  cost: number | null
}

export const propFirms = pgTable('prop_firms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  website: text('website'),
  /**
   * Legacy column, no longer shown anywhere. A broker is a property of the
   * account/connection — the same firm hands out accounts on Rithmic,
   * Tradovate and paper feeds at once — so tying it to the firm was wrong.
   */
  platform: text('platform').default('other').notNull(),
  /** Plan catalogue: templates applied to accounts, per firm. */
  plans: jsonb('plans').$type<FirmPlan[]>().default([]).notNull(),
  /** Trader's share of profits, 0..1. */
  profitSplit: ratio('profit_split').default(0.9).notNull(),
  /** Firm-level payout policy, free text — the specifics vary wildly. */
  payoutPolicy: text('payout_policy'),
  /** Firm keeps the first $N of payouts, or a per-payout cap. */
  payoutCapBase: money('payout_cap_base'),
  minDaysToPayout: integer('min_days_to_payout'),
  notes: text('notes'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const ACCOUNT_PHASES = ['eval', 'funded', 'live', 'personal', 'demo'] as const
export const ACCOUNT_STATUSES = ['active', 'passed', 'failed', 'closed', 'paused'] as const
export const DRAWDOWN_TYPES = ['trailing_intraday', 'trailing_eod', 'static', 'none'] as const

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    firmId: integer('firm_id').references(() => propFirms.id, { onDelete: 'set null' }),
    /** Human label, e.g. "Apex 50k #3". */
    label: text('label').notNull(),
    /** The broker's own identifier, used to match synced fills back to an account. */
    externalId: text('external_id'),
    /** tradovate | rithmic | projectx | tradingview | manual */
    platform: text('platform').default('tradovate').notNull(),
    phase: text('phase', { enum: ACCOUNT_PHASES }).default('eval').notNull(),
    /** Which catalogue plan this account was created from, for display only. */
    planLabel: text('plan_label'),
    status: text('status', { enum: ACCOUNT_STATUSES }).default('active').notNull(),
    currency: text('currency').default('USD').notNull(),

    /** Nominal account size, e.g. 50000. */
    startingBalance: money('starting_balance').default(50000).notNull(),
    profitTarget: money('profit_target'),
    /** Max drawdown in currency, e.g. 2500 on a 50k Apex. */
    maxDrawdown: money('max_drawdown'),
    drawdownType: text('drawdown_type', { enum: DRAWDOWN_TYPES })
      .default('trailing_eod')
      .notNull(),
    /** Trailing drawdown stops trailing once it reaches this equity. */
    drawdownLocksAt: money('drawdown_locks_at'),
    dailyLossLimit: money('daily_loss_limit'),
    /** Max contracts the firm allows. Used to flag size violations. */
    maxContracts: integer('max_contracts'),
    minTradingDays: integer('min_trading_days'),
    /**
     * Payout gate in the form most firms now use: N days that each netted at
     * least `winningDayMinProfit`. Distinct from minTradingDays, which counts
     * any day with a trade.
     */
    minWinningDays: integer('min_winning_days'),
    winningDayMinProfit: money('winning_day_min_profit'),
    /** Consistency rule: no single day may exceed this share of total profit. */
    consistencyPercent: ratio('consistency_percent'),

    /** What it cost to get this account: eval fee, resets, activation. */
    costBase: money('cost_base').default(0).notNull(),
    /**
     * Round-turn commission per contract. Broker fill feeds rarely carry
     * commission, so synced trades are costed from this rate — leaving it at 0
     * makes every strategy look better than it is.
     */
    commissionPerContract: money('commission_per_contract').default(0).notNull(),
    /** Live cash balance, kept fresh by broker sync. */
    currentBalance: money('current_balance'),
    balanceUpdatedAt: timestamp('balance_updated_at', { withTimezone: true }),

    startedOn: date('started_on'),
    endedOn: date('ended_on'),
    notes: text('notes'),
    /** Excluded from headline stats but still stored (e.g. demo experiments). */
    excludeFromStats: boolean('exclude_from_stats').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('accounts_firm_idx').on(t.firmId),
    uniqueIndex('accounts_platform_external_idx')
      .on(t.platform, t.externalId)
      .where(sql`${t.externalId} is not null`),
  ],
)

// ---------------------------------------------------------------------------
// Broker connections (encrypted credentials)
// ---------------------------------------------------------------------------

export const brokerConnections = pgTable('broker_connections', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  /** tradovate | rithmic | projectx */
  provider: text('provider').notNull(),
  /** 'live' | 'demo' — Tradovate serves these from different hosts. */
  environment: text('environment').default('live').notNull(),
  /** AES-256-GCM blob. Never leaves the server. See src/lib/crypto.ts. */
  credentialsEncrypted: text('credentials_encrypted'),
  accessToken: text('access_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastSyncStatus: text('last_sync_status'),
  lastSyncError: text('last_sync_error'),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// Executions (raw fills) -> Trades (matched round trips)
// ---------------------------------------------------------------------------

export const executions = pgTable(
  'executions',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id')
      .references(() => accounts.id, { onDelete: 'cascade' })
      .notNull(),
    /** Broker fill id. Unique per source so re-imports are idempotent. */
    externalId: text('external_id'),
    /** tradovate_api | tradovate_csv | rithmic_csv | ninjatrader_csv | tradingview_csv | webhook | manual */
    source: text('source').default('manual').notNull(),
    batchId: integer('batch_id').references(() => importBatches.id, { onDelete: 'set null' }),

    /** Front-month contract as filled, e.g. "MNQZ5". */
    contract: text('contract').notNull(),
    /** Root symbol, e.g. "MNQ". Everything aggregates on this. */
    symbol: text('symbol').notNull(),
    side: text('side', { enum: ['buy', 'sell'] }).notNull(),
    qty: integer('qty').notNull(),
    fillPrice: price('fill_price').notNull(),
    fillAt: timestamp('fill_at', { withTimezone: true }).notNull(),
    tradingDay: date('trading_day').notNull(),
    commission: money('commission').default(0).notNull(),
    fees: money('fees').default(0).notNull(),
    /** Set once the matcher folds this fill into a trade. */
    tradeId: integer('trade_id'),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('executions_account_time_idx').on(t.accountId, t.fillAt),
    index('executions_trade_idx').on(t.tradeId),
    index('executions_day_idx').on(t.tradingDay),
    uniqueIndex('executions_source_external_idx')
      .on(t.source, t.externalId)
      .where(sql`${t.externalId} is not null`),
  ],
)

export const trades = pgTable(
  'trades',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id')
      .references(() => accounts.id, { onDelete: 'cascade' })
      .notNull(),
    symbol: text('symbol').notNull(),
    contract: text('contract'),
    /** Net direction of the round trip. */
    direction: text('direction', { enum: ['long', 'short'] }).notNull(),
    qty: integer('qty').notNull(),

    entryAt: timestamp('entry_at', { withTimezone: true }).notNull(),
    exitAt: timestamp('exit_at', { withTimezone: true }),
    tradingDay: date('trading_day').notNull(),
    avgEntry: price('avg_entry').notNull(),
    avgExit: price('avg_exit'),

    /** P&L before costs, in the account's currency. */
    grossPnl: money('gross_pnl').default(0).notNull(),
    commission: money('commission').default(0).notNull(),
    fees: money('fees').default(0).notNull(),
    /** grossPnl - commission - fees. The number that matters. */
    netPnl: money('net_pnl').default(0).notNull(),

    /** Planned stop/target, entered by hand or parsed from a TradingView alert. */
    stopPrice: price('stop_price'),
    targetPrice: price('target_price'),
    /** Currency at risk at entry. Enables R-multiples. */
    riskBase: money('risk_base'),
    /** netPnl / riskBase. Null when no stop was recorded. */
    rMultiple: ratio('r_multiple'),
    /** Max adverse / favourable excursion, when the data source provides it. */
    maeBase: money('mae_base'),
    mfeBase: money('mfe_base'),

    durationSeconds: integer('duration_seconds'),
    /** open while the position is still on; the matcher closes it on flat. */
    status: text('status', { enum: ['open', 'closed'] }).default('closed').notNull(),

    setup: text('setup'),
    /** The trading model this trade claims to be an instance of. */
    modelId: integer('model_id').references(() => tradingModels.id, { onDelete: 'set null' }),
    /** Latest AI verdict against that model; history lives in model_reviews. */
    modelReview: jsonb('model_review').$type<ModelReviewResult>(),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    /** Post-trade honesty box. Feeds the mistake-cost analytics. */
    mistakes: jsonb('mistakes').$type<string[]>().default([]).notNull(),
    /** 1..5 how well the plan was followed. */
    execScore: integer('exec_score'),
    emotion: text('emotion'),
    notes: text('notes'),
    screenshotUrl: text('screenshot_url'),
    /** True when built by the matcher rather than typed in. */
    autoGenerated: boolean('auto_generated').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('trades_account_day_idx').on(t.accountId, t.tradingDay),
    index('trades_symbol_idx').on(t.symbol),
    index('trades_entry_idx').on(t.entryAt),
    index('trades_status_idx').on(t.status),
  ],
)

/** Per-account daily rollup. Rebuilt by cron; makes the dashboard cheap. */
export const dailyStats = pgTable(
  'daily_stats',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id')
      .references(() => accounts.id, { onDelete: 'cascade' })
      .notNull(),
    tradingDay: date('trading_day').notNull(),
    trades: integer('trades').default(0).notNull(),
    wins: integer('wins').default(0).notNull(),
    losses: integer('losses').default(0).notNull(),
    scratches: integer('scratches').default(0).notNull(),
    grossPnl: money('gross_pnl').default(0).notNull(),
    commission: money('commission').default(0).notNull(),
    fees: money('fees').default(0).notNull(),
    netPnl: money('net_pnl').default(0).notNull(),
    volume: integer('volume').default(0).notNull(),
    /** Running account equity at end of day. */
    equity: money('equity').default(0).notNull(),
    /** Distance to the firm's drawdown line at end of day. */
    drawdownRoom: money('drawdown_room'),
    rSum: ratio('r_sum'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('daily_stats_account_day_idx').on(t.accountId, t.tradingDay)],
)

// ---------------------------------------------------------------------------
// Money in / money out
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORIES = [
  'eval_fee',
  'reset_fee',
  'activation_fee',
  'data_feed',
  'platform_subscription',
  'software',
  'hardware',
  'education',
  'internet',
  'phone',
  'office',
  'travel',
  'accounting',
  'bank_fees',
  'commission',
  'other',
] as const

export const expenses = pgTable(
  'expenses',
  {
    id: serial('id').primaryKey(),
    spentOn: date('spent_on').notNull(),
    category: text('category', { enum: EXPENSE_CATEGORIES }).notNull(),
    vendor: text('vendor').notNull(),
    description: text('description'),
    amount: money('amount').notNull(),
    currency: text('currency').default('USD').notNull(),
    /** FX applied at the time of spend. */
    fxRate: money('fx_rate').default(1).notNull(),
    /** amount * fxRate, in base currency. Denormalised for fast sums. */
    amountBase: money('amount_base').notNull(),

    /** Attribute the cost to a specific account (eval fees, resets). */
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    firmId: integer('firm_id').references(() => propFirms.id, { onDelete: 'set null' }),
    subscriptionId: integer('subscription_id'),

    /**
     * Where the row came from: 'email' when the inbox automation created it, null
     * when a person did. Automation gets things wrong, and a row you cannot tell
     * apart from your own typing is a row you cannot audit — the money pages badge
     * these so a wrong amount is findable rather than merely present.
     */
    source: text('source'),

    /** Fraction claimable against Israeli business income, 0..1. */
    deductiblePercent: ratio('deductible_percent').default(1).notNull(),
    /** Israeli VAT paid on the invoice, reclaimable by an osek murshe. */
    vatAmount: money('vat_amount').default(0).notNull(),
    hasReceipt: boolean('has_receipt').default(false).notNull(),
    receiptUrl: text('receipt_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('expenses_date_idx').on(t.spentOn),
    index('expenses_category_idx').on(t.category),
    index('expenses_account_idx').on(t.accountId),
  ],
)

/** Recurring costs. The cron materialises each renewal into `expenses`. */
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  vendor: text('vendor').notNull(),
  description: text('description'),
  category: text('category', { enum: EXPENSE_CATEGORIES }).default('software').notNull(),
  amount: money('amount').notNull(),
  currency: text('currency').default('USD').notNull(),
  /** monthly | quarterly | annual | weekly */
  cadence: text('cadence', { enum: ['weekly', 'monthly', 'quarterly', 'annual'] })
    .default('monthly')
    .notNull(),
  startedOn: date('started_on').notNull(),
  nextRenewalOn: date('next_renewal_on').notNull(),
  cancelledOn: date('cancelled_on'),
  accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  deductiblePercent: ratio('deductible_percent').default(1).notNull(),
  /** Auto-create the expense row on renewal day. */
  autoLog: boolean('auto_log').default(true).notNull(),
  active: boolean('active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const PAYOUT_STATUSES = ['requested', 'approved', 'paid', 'rejected', 'cancelled'] as const

export const payouts = pgTable(
  'payouts',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    firmId: integer('firm_id').references(() => propFirms.id, { onDelete: 'set null' }),
    requestedOn: date('requested_on').notNull(),
    paidOn: date('paid_on'),
    status: text('status', { enum: PAYOUT_STATUSES }).default('requested').notNull(),

    /** What the account made before the split. */
    grossAmount: money('gross_amount').notNull(),
    /** Trader's share, 0..1, at the time of the payout. */
    profitSplit: ratio('profit_split').default(0.9).notNull(),
    /** Wire/crypto/processor fee deducted by the firm. */
    processingFee: money('processing_fee').default(0).notNull(),
    /** What actually landed. */
    netAmount: money('net_amount').notNull(),
    currency: text('currency').default('USD').notNull(),
    fxRate: money('fx_rate').default(1).notNull(),
    netAmountBase: money('net_amount_base').notNull(),

    method: text('method'),
    reference: text('reference'),
    /**
     * Where the row came from: 'email' when the inbox automation created it, null
     * when a person did. Automation gets things wrong, and a row you cannot tell
     * apart from your own typing is a row you cannot audit — the money pages badge
     * these so a wrong amount is findable rather than merely present.
     */
    source: text('source'),
    /** Tax reserved off this payout, per the tax profile. */
    taxReserved: money('tax_reserved').default(0).notNull(),
    /** Snapshot of how the allocation engine split this payout. */
    allocation: jsonb('allocation').$type<Record<string, number>>(),
    /** Set once the payout has been invoiced (osek murshe / patur receipt). */
    invoiceNumber: text('invoice_number'),
    invoicedOn: date('invoiced_on'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('payouts_date_idx').on(t.requestedOn), index('payouts_account_idx').on(t.accountId)],
)

// ---------------------------------------------------------------------------
// Trading models — named entry setups the AI reviews trades against
// ---------------------------------------------------------------------------

/**
 * A trading model is the user's own definition of a setup: when to enter,
 * when they are wrong, how to manage it. Trades link to a model, and the AI
 * review judges each trade against these rules — so the rules are data, not
 * prose in a notebook.
 */
export const tradingModels = pgTable('trading_models', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  /** One-paragraph idea: what edge this captures and why it exists. */
  description: text('description'),
  timeframe: text('timeframe'),
  instruments: text('instruments'),
  entryRules: text('entry_rules'),
  exitRules: text('exit_rules'),
  riskRules: text('risk_rules'),
  /** What makes the setup void — the AI weighs these hardest. */
  invalidations: text('invalidations'),
  /**
   * AI calibration notes, accumulated from the user's agree/disagree feedback
   * on past reviews. Rewritten by the refine action, included in every future
   * review prompt — this is how the reviewer gets better over time.
   */
  aiGuidance: text('ai_guidance'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** The latest AI verdict, denormalised onto the trade so lists render cheaply. */
export type ModelReviewResult = {
  verdict: 'fits' | 'partial' | 'violation' | 'unclear'
  /** 0..100 — how cleanly the trade matches the model. */
  score: number
  reasoning: string
  violations: string[]
  suggestions: string[]
  /** What the AI read off the chart screenshot, when one was attached. */
  chartObservations: string | null
  reviewedAt: string
  aiModel: string
}

/**
 * Review history. Keyed by the trade's natural identity (account, entry
 * instant, symbol) rather than a trade FK, because auto-generated trades are
 * deleted and reinserted on every rebuild — a foreign key would wipe the
 * history the feedback loop learns from.
 */
export const modelReviews = pgTable(
  'model_reviews',
  {
    id: serial('id').primaryKey(),
    modelId: integer('model_id')
      .references(() => tradingModels.id, { onDelete: 'cascade' })
      .notNull(),
    accountId: integer('account_id').notNull(),
    symbol: text('symbol').notNull(),
    entryAt: timestamp('entry_at', { withTimezone: true }).notNull(),
    tradingDay: date('trading_day').notNull(),
    verdict: text('verdict', { enum: ['fits', 'partial', 'violation', 'unclear'] }).notNull(),
    score: integer('score').notNull(),
    reasoning: text('reasoning').notNull(),
    violations: jsonb('violations').$type<string[]>().default([]).notNull(),
    suggestions: jsonb('suggestions').$type<string[]>().default([]).notNull(),
    chartObservations: text('chart_observations'),
    aiModel: text('ai_model').notNull(),
    /** The improve-the-AI signal: did the trader agree with the verdict? */
    feedback: text('feedback', { enum: ['agree', 'disagree'] }),
    feedbackNote: text('feedback_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('model_reviews_model_idx').on(t.modelId, t.createdAt),
    index('model_reviews_trade_idx').on(t.accountId, t.entryAt, t.symbol),
  ],
)

/**
 * Events ingested from the user's prop-firm emails by the hourly Gmail
 * automation. sourceId is the Gmail message id — the unique index is what
 * makes re-processing the same inbox idempotent.
 */
export const emailEvents = pgTable(
  'email_events',
  {
    id: serial('id').primaryKey(),
    sourceId: text('source_id').notNull(),
    kind: text('kind').notNull(),
    summary: text('summary'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('email_events_source_idx').on(t.sourceId)],
)

/**
 * Devices signed up for push notifications.
 *
 * One row per browser or installed app, keyed on the endpoint the push service
 * gives us — that string *is* the device's address, and it changes when a
 * subscription is renewed, so it is the natural key rather than anything we
 * invent. Subscriptions expire on their own (a reinstalled app, a cleared
 * browser); a send that comes back 404 or 410 deletes the row.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: serial('id').primaryKey(),
    endpoint: text('endpoint').notNull(),
    /** The device's public key and auth secret, from the browser. */
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    /** Something recognisable in Settings, e.g. "iPhone". */
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint)],
)

// ---------------------------------------------------------------------------
// Journal, insights, imports
// ---------------------------------------------------------------------------

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: serial('id').primaryKey(),
    entryDate: date('entry_date').notNull(),
    /** Written before the session. */
    plan: text('plan'),
    /** Written after. */
    review: text('review'),
    /** 1..5 */
    mood: integer('mood'),
    sleepHours: ratio('sleep_hours'),
    /** 1..5 self-rated discipline. */
    discipline: integer('discipline'),
    marketNotes: text('market_notes'),
    lessons: text('lessons'),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    /** Rule checklist ticked off pre-session. */
    checklist: jsonb('checklist').$type<{ label: string; done: boolean }[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('journal_date_idx').on(t.entryDate)],
)

/** Generated observations. Regenerated by cron; dismissals are remembered. */
export const insights = pgTable(
  'insights',
  {
    id: serial('id').primaryKey(),
    /** Stable identity for an insight so regeneration updates rather than duplicates. */
    key: text('key').notNull(),
    /** risk | edge | cost | discipline | tax | account | payout */
    category: text('category').notNull(),
    severity: text('severity', { enum: ['info', 'good', 'warn', 'critical'] })
      .default('info')
      .notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Money impact of acting on this, when quantifiable. */
    impactBase: money('impact_base'),
    /** Supporting numbers, rendered in the UI. */
    evidence: jsonb('evidence').$type<Record<string, unknown>>(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('insights_key_idx').on(t.key)],
)

export const importBatches = pgTable('import_batches', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  filename: text('filename'),
  accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  rowsSeen: integer('rows_seen').default(0).notNull(),
  rowsImported: integer('rows_imported').default(0).notNull(),
  rowsSkipped: integer('rows_skipped').default(0).notNull(),
  tradesBuilt: integer('trades_built').default(0).notNull(),
  errors: jsonb('errors').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/** Append-only audit of every automated run. */
export const syncLog = pgTable(
  'sync_log',
  {
    id: serial('id').primaryKey(),
    job: text('job').notNull(),
    status: text('status', { enum: ['ok', 'error', 'skipped'] }).notNull(),
    message: text('message'),
    detail: jsonb('detail'),
    durationMs: integer('duration_ms'),
    ranAt: timestamp('ran_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('sync_log_job_idx').on(t.job, t.ranAt)],
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const propFirmRelations = relations(propFirms, ({ many }) => ({
  accounts: many(accounts),
  payouts: many(payouts),
}))

export const accountRelations = relations(accounts, ({ one, many }) => ({
  firm: one(propFirms, { fields: [accounts.firmId], references: [propFirms.id] }),
  trades: many(trades),
  executions: many(executions),
  payouts: many(payouts),
  expenses: many(expenses),
  dailyStats: many(dailyStats),
}))

export const tradeRelations = relations(trades, ({ one, many }) => ({
  account: one(accounts, { fields: [trades.accountId], references: [accounts.id] }),
  executions: many(executions),
}))

export const executionRelations = relations(executions, ({ one }) => ({
  account: one(accounts, { fields: [executions.accountId], references: [accounts.id] }),
  trade: one(trades, { fields: [executions.tradeId], references: [trades.id] }),
}))

export const payoutRelations = relations(payouts, ({ one }) => ({
  account: one(accounts, { fields: [payouts.accountId], references: [accounts.id] }),
  firm: one(propFirms, { fields: [payouts.firmId], references: [propFirms.id] }),
}))

export const expenseRelations = relations(expenses, ({ one }) => ({
  account: one(accounts, { fields: [expenses.accountId], references: [accounts.id] }),
  firm: one(propFirms, { fields: [expenses.firmId], references: [propFirms.id] }),
}))

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Settings = typeof settings.$inferSelect
export type PropFirm = typeof propFirms.$inferSelect
export type NewPropFirm = typeof propFirms.$inferInsert
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type Execution = typeof executions.$inferSelect
export type NewExecution = typeof executions.$inferInsert
export type Trade = typeof trades.$inferSelect
export type NewTrade = typeof trades.$inferInsert
export type DailyStat = typeof dailyStats.$inferSelect
export type Expense = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type Payout = typeof payouts.$inferSelect
export type NewPayout = typeof payouts.$inferInsert
export type JournalEntry = typeof journalEntries.$inferSelect
export type Insight = typeof insights.$inferSelect
export type NewInsight = typeof insights.$inferInsert
export type BrokerConnection = typeof brokerConnections.$inferSelect
export type ImportBatch = typeof importBatches.$inferSelect
export type TradingModel = typeof tradingModels.$inferSelect
export type NewTradingModel = typeof tradingModels.$inferInsert
export type ModelReview = typeof modelReviews.$inferSelect
export type EmailEvent = typeof emailEvents.$inferSelect
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect
