/**
 * Prop firm account rules.
 *
 * The account rule that actually ends careers is the trailing drawdown, and it
 * is widely misunderstood: on most firms it follows your *highest* equity, not
 * your balance, so an unrealised gain you gave back has permanently raised the
 * line you must stay above. A trader who is up $1,800 on a $2,500 drawdown and
 * then flat has $700 of room left, not $2,500.
 *
 * This module makes that line explicit, and every account view in the app leads
 * with it.
 */
import type { Account } from '@/db/schema'

export type DrawdownState = {
  /** Equity below which the account is breached. */
  line: number
  /** Distance from current equity to that line. This is the real risk budget. */
  room: number
  /** Highest equity the drawdown has trailed to. */
  highWater: number
  /** True once the line has stopped trailing. */
  locked: boolean
  /** Room as a share of the original allowance. */
  roomPercent: number
  breached: boolean
}

export type EquityPoint = {
  /** End-of-day, or intraday peak, depending on the drawdown type. */
  day: string
  equity: number
  /** Highest equity reached during that day, when known. */
  peakEquity?: number
}

/**
 * Walks the account's equity history and returns where the drawdown line sits.
 *
 * `trailing_intraday` follows the intraday peak — the most punishing variant,
 * used by Apex and most Rithmic-based firms.
 * `trailing_eod` follows the end-of-day balance only, which is materially more
 * forgiving because intraday give-back does not move the line.
 * `static` never moves.
 */
export function drawdownState(account: Account, history: EquityPoint[]): DrawdownState {
  const allowance = account.maxDrawdown ?? 0
  const start = account.startingBalance
  const currentEquity = history.length ? history[history.length - 1].equity : (account.currentBalance ?? start)

  if (account.drawdownType === 'none' || allowance <= 0) {
    return {
      line: -Infinity,
      room: Infinity,
      highWater: Math.max(start, currentEquity),
      locked: true,
      roomPercent: 1,
      breached: false,
    }
  }

  if (account.drawdownType === 'static') {
    const line = start - allowance
    return {
      line,
      room: currentEquity - line,
      highWater: start,
      locked: true,
      roomPercent: clamp01((currentEquity - line) / allowance),
      breached: currentEquity <= line,
    }
  }

  const useIntraday = account.drawdownType === 'trailing_intraday'
  // The lock point is where the firm freezes the line, typically once the
  // account has earned back its buffer plus a margin.
  const lockAt = account.drawdownLocksAt ?? null

  let highWater = start
  let locked = false

  for (const point of history) {
    const candidate = useIntraday ? (point.peakEquity ?? point.equity) : point.equity
    if (!locked && candidate > highWater) highWater = candidate
    if (lockAt !== null && highWater - allowance >= lockAt) {
      // Once the trailing line reaches the lock threshold it stops moving.
      highWater = lockAt + allowance
      locked = true
    }
  }

  const line = highWater - allowance
  const room = currentEquity - line

  return {
    line: round(line),
    room: round(room),
    highWater: round(highWater),
    locked,
    roomPercent: clamp01(room / allowance),
    breached: room <= 0,
  }
}

/**
 * Consistency rule check.
 *
 * Most firms refuse a payout if one day accounts for more than a set share of
 * total profit — a single lucky day is not evidence of an edge. Knowing the
 * threshold *before* requesting the payout is the difference between waiting a
 * week and having the request denied.
 */
export function consistencyCheck(
  dailyPnls: { day: string; netPnl: number }[],
  consistencyPercent: number | null,
): {
  applies: boolean
  bestDay: { day: string; netPnl: number } | null
  totalProfit: number
  bestDayShare: number
  passes: boolean
  /** Extra profit needed elsewhere before the best day stops breaching. */
  profitNeeded: number
} {
  const greenDays = dailyPnls.filter((d) => d.netPnl > 0)
  const totalProfit = greenDays.reduce((sum, d) => sum + d.netPnl, 0)
  const bestDay = greenDays.length
    ? greenDays.reduce((best, d) => (d.netPnl > best.netPnl ? d : best))
    : null

  if (!consistencyPercent || consistencyPercent <= 0 || !bestDay || totalProfit <= 0) {
    return { applies: false, bestDay, totalProfit, bestDayShare: 0, passes: true, profitNeeded: 0 }
  }

  const share = bestDay.netPnl / totalProfit
  // Total profit that would make the best day exactly compliant.
  const requiredTotal = bestDay.netPnl / consistencyPercent

  return {
    applies: true,
    bestDay,
    totalProfit: round(totalProfit),
    bestDayShare: share,
    passes: share <= consistencyPercent,
    profitNeeded: round(Math.max(0, requiredTotal - totalProfit)),
  }
}

export type PayoutEligibility = {
  eligible: boolean
  blockers: string[]
  /** Profit above the account's starting balance available to withdraw. */
  withdrawable: number
  /** Trader's share after the profit split. */
  netToTrader: number
}

export function payoutEligibility(
  account: Account,
  options: {
    currentEquity: number
    tradingDays: number
    dailyPnls: { day: string; netPnl: number }[]
    profitSplit: number
    /** Firm requires this much profit above starting balance to withdraw. */
    minProfit?: number
  },
): PayoutEligibility {
  const blockers: string[] = []
  const profit = options.currentEquity - account.startingBalance

  if (account.phase !== 'funded' && account.phase !== 'live') {
    blockers.push('Account is still in evaluation — payouts apply to funded accounts only.')
  }
  if (account.status !== 'active') {
    blockers.push(`Account status is "${account.status}".`)
  }
  if (account.minTradingDays && options.tradingDays < account.minTradingDays) {
    blockers.push(
      `${options.tradingDays} of ${account.minTradingDays} required trading days completed.`,
    )
  }
  if (profit <= 0) {
    blockers.push('Account is not above its starting balance.')
  }
  if (options.minProfit && profit < options.minProfit) {
    blockers.push(`Profit of ${profit.toFixed(0)} is below the firm's ${options.minProfit} minimum.`)
  }

  const consistency = consistencyCheck(options.dailyPnls, account.consistencyPercent ?? null)
  if (consistency.applies && !consistency.passes) {
    blockers.push(
      `Consistency rule: best day is ${(consistency.bestDayShare * 100).toFixed(0)}% of total profit, above the ${((account.consistencyPercent ?? 0) * 100).toFixed(0)}% limit. About ${consistency.profitNeeded.toFixed(0)} more profit on other days is needed.`,
    )
  }

  const withdrawable = Math.max(0, profit)
  return {
    eligible: blockers.length === 0,
    blockers,
    withdrawable: round(withdrawable),
    netToTrader: round(withdrawable * options.profitSplit),
  }
}

/** Progress toward passing an evaluation. */
export function evaluationProgress(
  account: Account,
  currentEquity: number,
  tradingDays: number,
): { profitPercent: number; daysPercent: number; profit: number; remaining: number } {
  const target = account.profitTarget ?? 0
  const profit = currentEquity - account.startingBalance
  return {
    profit: round(profit),
    remaining: round(Math.max(0, target - profit)),
    profitPercent: target > 0 ? clamp01(profit / target) : 0,
    daysPercent: account.minTradingDays ? clamp01(tradingDays / account.minTradingDays) : 1,
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Common firm presets. These change often and vary by account size and
 * promotion, so treat them as a starting point to edit rather than as truth —
 * the app reads the values stored on each account, never these.
 */
export const FIRM_PRESETS: {
  name: string
  platform: string
  profitSplit: number
  drawdownType: Account['drawdownType']
  note: string
}[] = [
  {
    name: 'Apex Trader Funding',
    platform: 'rithmic',
    profitSplit: 0.9,
    drawdownType: 'trailing_intraday',
    note: 'Trailing threshold follows intraday equity and locks once it reaches starting balance plus a buffer.',
  },
  {
    name: 'TopstepX',
    platform: 'projectx',
    profitSplit: 0.9,
    drawdownType: 'trailing_eod',
    note: 'End-of-day trailing drawdown; consistency rule applies to payouts.',
  },
  {
    name: 'Take Profit Trader',
    platform: 'rithmic',
    profitSplit: 0.8,
    drawdownType: 'trailing_eod',
    note: 'End-of-day drawdown that stops trailing at the starting balance.',
  },
  {
    name: 'MyFundedFutures',
    platform: 'tradovate',
    profitSplit: 0.9,
    drawdownType: 'trailing_eod',
    note: 'Plan-dependent; several account types with different drawdown behaviour.',
  },
  {
    name: 'Bulenox',
    platform: 'tradovate',
    profitSplit: 0.9,
    drawdownType: 'trailing_intraday',
    note: 'Intraday trailing drawdown on most account types.',
  },
  {
    name: 'Tradeify',
    platform: 'tradovate',
    profitSplit: 0.9,
    drawdownType: 'trailing_eod',
    note: 'Offers both static and trailing variants depending on the plan.',
  },
]
