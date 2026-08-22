import 'server-only'
import { db } from '@/db'
import { journalEntries } from '@/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import {
  bySession,
  bySymbol,
  byWeekday,
  computeMetrics,
  dailySeries,
  equityCurve,
  type CoreMetrics,
  type DailyPoint,
} from '@/lib/analytics/metrics'
import { drawdownState, evaluationProgress, type DrawdownState } from '@/lib/propfirm/rules'
import { deploymentAdvice, type DeploymentSuggestion } from '@/lib/allocation'
import { calculateIsraeliTax, reservePercentFor } from '@/lib/tax/israel'
import { boundariesFor, hasOther, pnlByPeriod, type PnlPeriod } from '@/lib/analytics/pnl-windows'
import { accountEquity } from '@/lib/analytics/balance'
import { today } from '@/lib/time'
import type { Account, Insight } from '@/db/schema'
import { brokerConnections, emailEvents, payouts, pushSubscriptions, syncLog, tradingModels } from '@/db/schema'
import { getSettings } from './settings'
import { equityHistory, listAccounts, listTradesForStats } from './trades'
import { listFirms } from './money'
import { deductibleExpensesForYear, moneySummary, revenueForYear, upcomingRenewals } from './money'
import { listInsights } from './insights'
import { gmailConfigured } from './gmail'

export type AccountCard = {
  account: Account
  drawdown: DrawdownState
  equity: number
  netPnl: number
  trades: number
  progress: ReturnType<typeof evaluationProgress>
}

export type SetupState = {
  firms: number
  accounts: number
  accountsMissingCommission: number
  trades: number
  connections: number
  taxStatusChosen: boolean
  payouts: number
  aiConfigured: boolean
  models: number
  /** The local trade watcher has uploaded or pumped at least once. */
  watcherSeen: boolean
  /** The Gmail automation has delivered at least one event. */
  emailAutomation: boolean
  notificationsOn: boolean
  complete: boolean
}

export type BusinessSummary = {
  lastPayout: { amount: number; date: string } | null
  totalPayouts: number
  totalCosts: number
  costsThisMonth: number
  activeEvals: number
  fundedActive: number
  weekPnl: number
}

export type DashboardData = {
  /** P&L for each period, split by evaluation vs funded. */
  pnlPeriods: PnlPeriod[]
  showOtherPhase: boolean
  metrics: CoreMetrics
  /** Per-trade rows behind the metrics, for pages that need per-account slices. */
  trades: Awaited<ReturnType<typeof listTradesForStats>>
  setup: SetupState
  business: BusinessSummary
  daily: DailyPoint[]
  equity: ReturnType<typeof equityCurve>
  todayPnl: number
  monthPnl: number
  yearPnl: number
  openTrades: number
  accountCards: AccountCard[]
  insights: Insight[]
  money: Awaited<ReturnType<typeof moneySummary>>
  tax: {
    year: number
    revenue: number
    deductible: number
    reservePercent: number
    estimatedTax: number
    reservedSoFar: number
    shortfall: number
    currency: string
  }
  advice: DeploymentSuggestion[]
  renewals: Awaited<ReturnType<typeof upcomingRenewals>>
  bySymbol: ReturnType<typeof bySymbol>
  bySession: ReturnType<typeof bySession>
  byWeekday: ReturnType<typeof byWeekday>
  timezone: string
  baseCurrency: string
  journalToday: { plan: string | null; review: string | null } | null
}

/**
 * Everything the landing page needs, assembled once.
 *
 * The dashboard is the page opened most often, so it is worth one wide read
 * rather than a dozen round trips — the queries below run in parallel and the
 * derived numbers are computed in memory.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const settings = await getSettings()
  const year = new Date().getFullYear()
  const currentDay = today(settings.timezone)
  const monthStart = `${currentDay.slice(0, 7)}-01`
  const yearStart = `${year}-01-01`

  const [
    trades,
    accounts,
    equityByAccount,
    insights,
    money,
    renewals,
    revenue,
    deductions,
    firms,
    connections,
    monthMoney,
    [lastPaidPayout],
    [{ modelCount }],
    [{ emailEventCount }],
    [{ deviceCount }],
    [watcherRun],
  ] = await Promise.all([
    listTradesForStats(),
    listAccounts(),
    equityHistory(),
    listInsights(),
    moneySummary(),
    upcomingRenewals(30),
    revenueForYear(year),
    deductibleExpensesForYear(year),
    listFirms(),
    db.select({ id: brokerConnections.id }).from(brokerConnections),
    moneySummary(monthStart),
    db.select().from(payouts).where(eq(payouts.status, 'paid')).orderBy(desc(payouts.paidOn)).limit(1),
    db.select({ modelCount: sql<number>`count(*)::int` }).from(tradingModels),
    db.select({ emailEventCount: sql<number>`count(*)::int` }).from(emailEvents),
    db.select({ deviceCount: sql<number>`count(*)::int` }).from(pushSubscriptions),
    db.select({ id: syncLog.id }).from(syncLog).where(eq(syncLog.job, 'watcher_upload')).limit(1),
  ])

  const metrics = computeMetrics(trades)
  const daily = dailySeries(trades)

  // Evaluation profit is a score; funded profit is money. Tagging each trade
  // with its account's phase is what lets every period be reported as both.
  const phaseByAccount = new Map(accounts.map((account) => [account.id, account.phase]))
  const pnlPeriods = pnlByPeriod(
    trades.map((trade) => ({
      tradingDay: trade.tradingDay,
      netPnl: trade.netPnl,
      phase: phaseByAccount.get(trade.accountId) ?? 'eval',
    })),
    boundariesFor(currentDay),
  )

  const sumFrom = (start: string): number =>
    daily.filter((point) => point.day >= start).reduce((sum, point) => sum + point.netPnl, 0)

  // Calendar week starting Sunday, in the user's timezone via currentDay.
  const weekStartDate = new Date(`${currentDay}T00:00:00Z`)
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - weekStartDate.getUTCDay())
  const weekStart = weekStartDate.toISOString().slice(0, 10)

  const business: BusinessSummary = {
    lastPayout:
      lastPaidPayout && lastPaidPayout.paidOn
        ? { amount: lastPaidPayout.netAmountBase, date: lastPaidPayout.paidOn }
        : null,
    totalPayouts: money.payoutsPaid,
    totalCosts: money.expensesTotal,
    costsThisMonth: monthMoney.expensesTotal,
    activeEvals: accounts.filter((a) => a.phase === 'eval' && a.status === 'active').length,
    fundedActive: accounts.filter(
      (a) => (a.phase === 'funded' || a.phase === 'live') && a.status === 'active',
    ).length,
    weekPnl: sumFrom(weekStart),
  }

  const accountCards: AccountCard[] = accounts
    .filter((account) => account.status === 'active')
    .map((account) => {
      const history = equityByAccount[account.id] ?? []
      const accountTrades = trades.filter((trade) => trade.accountId === account.id)
      const netPnl = accountTrades.reduce((sum, trade) => sum + trade.netPnl, 0)
      // Anchored rather than `currentBalance ?? size + pnl`: a balance the
      // trader or the broker stated is true as of a day, and the trades after
      // that day still have to move it. Taking it as final froze equity at
      // whatever was last entered, so a $1,200 day changed nothing on screen.
      const { equity } = accountEquity(account, accountTrades)
      const tradingDays = new Set(accountTrades.map((trade) => trade.tradingDay)).size

      return {
        account,
        drawdown: drawdownState(account, history.length ? history : [{ day: currentDay, equity }]),
        equity,
        netPnl,
        trades: accountTrades.length,
        progress: evaluationProgress(account, equity, tradingDays),
      }
    })
    .sort((a, b) => a.drawdown.roomPercent - b.drawdown.roomPercent)

  // --- Tax position -------------------------------------------------------
  const profile = settings.taxProfile!
  const toIls = (value: number): number => (settings.baseCurrency === 'ILS' ? value : value * settings.usdIls)
  const fromIls = (value: number): number => (settings.baseCurrency === 'ILS' ? value : value / settings.usdIls)

  const taxInput = {
    year,
    revenueIls: toIls(revenue),
    deductibleExpensesIls: toIls(deductions.deductible),
    inputVatIls: toIls(deductions.vat),
    status: profile.status === 'undecided' ? ('osek_murshe' as const) : profile.status,
    creditPoints: profile.creditPoints,
    monthsActive: monthsActiveIn(year, profile.businessOpenedOn),
  }
  const taxBreakdown = calculateIsraeliTax(taxInput)
  const reservePercent = revenue > 0 ? reservePercentFor(taxInput) : profile.reservePercent
  const estimatedTax = fromIls(taxBreakdown.totalTax)

  // --- Deployment advice --------------------------------------------------
  const fundedAccounts = accounts.filter((a) => a.phase === 'funded' || a.phase === 'live').length
  const evaluationAccounts = accounts.filter((a) => a.phase === 'eval' || a.status === 'failed' || a.status === 'passed')
  const passedAccounts = accounts.filter((a) => a.status === 'passed' || a.phase === 'funded' || a.phase === 'live')
  const buckets = balancesFromPlan(money.taxReserved, money.payoutsPaid, settings)

  const advice = deploymentAdvice({
    annualPayouts: money.payoutsPaid,
    annualCosts: money.expensesTotal,
    emergencyBalance: buckets.emergency,
    monthlyLiving: buckets.monthlyLiving,
    operatingBalance: buckets.operating,
    fundedAccounts,
    evalCost: evaluationAccounts.length > 0 ? money.evaluationSpend / evaluationAccounts.length : 0,
    evalPassRate: evaluationAccounts.length > 0 ? passedAccounts.length / evaluationAccounts.length : 0,
  })

  const [journalRow] = await db
    .select()
    .from(journalEntries)
    .orderBy(desc(journalEntries.entryDate))
    .limit(1)

  const setup: SetupState = {
    firms: firms.length,
    accounts: accounts.length,
    accountsMissingCommission: accounts.filter(
      (a) => a.status === 'active' && a.commissionPerContract === 0 && a.platform !== 'manual',
    ).length,
    trades: trades.length,
    connections: connections.length,
    taxStatusChosen: profile.status !== 'undecided',
    payouts: money.payoutsPaid > 0 ? 1 : 0,
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    models: modelCount,
    watcherSeen: Boolean(watcherRun),
    emailAutomation: gmailConfigured() || emailEventCount > 0,
    notificationsOn: deviceCount > 0,
    complete:
      firms.length > 0 &&
      accounts.length > 0 &&
      trades.length > 0 &&
      profile.status !== 'undecided' &&
      Boolean(process.env.ANTHROPIC_API_KEY) &&
      modelCount > 0 &&
      Boolean(watcherRun) &&
      emailEventCount > 0,
  }

  return {
    metrics,
    trades,
    pnlPeriods,
    showOtherPhase: hasOther(pnlPeriods),
    setup,
    business,
    daily,
    equity: equityCurve(trades),
    todayPnl: sumFrom(currentDay),
    monthPnl: sumFrom(monthStart),
    yearPnl: sumFrom(yearStart),
    openTrades: trades.filter((trade) => trade.status === 'open').length,
    accountCards,
    insights,
    money,
    tax: {
      year,
      revenue,
      deductible: deductions.deductible,
      reservePercent,
      estimatedTax,
      reservedSoFar: money.taxReserved,
      shortfall: Math.max(0, estimatedTax - money.taxReserved),
      currency: settings.baseCurrency,
    },
    advice,
    renewals,
    bySymbol: bySymbol(trades).slice(0, 8),
    bySession: bySession(trades, settings.timezone),
    byWeekday: byWeekday(trades, settings.timezone),
    timezone: settings.timezone,
    baseCurrency: settings.baseCurrency,
    journalToday: journalRow?.entryDate === currentDay ? { plan: journalRow.plan, review: journalRow.review } : null,
  }
}

function monthsActiveIn(year: number, openedOn: string | null): number {
  if (!openedOn) return 12
  const opened = new Date(`${openedOn}T00:00:00Z`)
  if (opened.getUTCFullYear() < year) return 12
  if (opened.getUTCFullYear() > year) return 0
  return 12 - opened.getUTCMonth()
}

/**
 * Bucket balances are inferred from the allocation plan rather than tracked as
 * real accounts — the app does not have access to the user's bank. It is an
 * estimate of where the money *should* be, which is what the advice needs.
 */
function balancesFromPlan(
  taxReserved: number,
  payoutsPaid: number,
  settings: { allocationPlan: { buckets: { key: string; percent: number }[] } | null },
): { emergency: number; operating: number; monthlyLiving: number } {
  const buckets = settings.allocationPlan?.buckets ?? []
  const share = (key: string): number => buckets.find((b) => b.key === key)?.percent ?? 0

  return {
    emergency: payoutsPaid * share('emergency'),
    operating: payoutsPaid * share('operating'),
    // Personal share of trailing payouts, spread over a year. Zero when no
    // payout has landed yet — the advice engine handles that case directly
    // rather than dividing by a made-up figure.
    monthlyLiving: (payoutsPaid * share('personal')) / 12,
  }
}
