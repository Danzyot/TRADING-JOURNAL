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
import type { Account, FirmPlan } from '@/db/schema'

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
  /**
   * Profit available to withdraw: everything above the account size, less the
   * buffer the firm requires you to leave behind.
   */
  withdrawable: number
  /** Trader's share after the profit split. */
  netToTrader: number
  /** Profit still needed before the first dollar can be requested, 0 if none. */
  toFirstPayout: number
}

export function payoutEligibility(
  account: Account,
  options: {
    currentEquity: number
    tradingDays: number
    dailyPnls: { day: string; netPnl: number }[]
    profitSplit: number
    /**
     * Buffer, when it is not on the account. The account's own value wins —
     * this is only a fallback for callers that know the firm's rule and have
     * an account predating the column.
     */
    minProfit?: number
  },
): PayoutEligibility {
  const blockers: string[] = []
  const profit = options.currentEquity - account.startingBalance

  // Profit the firm makes you leave in the account. Withdrawing is allowed
  // down to this line, not down to the account size, so it comes off both the
  // eligibility test and the figure quoted — a $2,300 profit on a $2,100
  // buffer is $200 of payout, not $2,300.
  const buffer = Math.max(0, account.buffer ?? options.minProfit ?? 0)

  if (account.phase !== 'funded' && account.phase !== 'live') {
    blockers.push('Account is still in evaluation — payouts apply to funded accounts only.')
  }
  if (account.status !== 'active') {
    blockers.push(`Account status is "${account.status}".`)
  }
  // `minTradingDays` is deliberately NOT checked here. It comes off the plan
  // catalogue, where it is the *evaluation's* minimum — MyFundedFutures Rapid
  // is one day, Builder is fourteen — and a firm's payout policy is a separate
  // rule that most of them state in days-since-funding or winning days. Quoting
  // an evaluation number as the thing standing between you and your money is
  // inventing a rule the firm never wrote, so the eligibility test sticks to
  // rules that are genuinely about payouts: the account being funded and
  // active, profit above the buffer, the consistency limit, the firm's minimum
  // payout, and `minWinningDays` where the firm actually sets one.

  // The gate most firms actually use now: N days each netting at least $X.
  // A day that made $40 counts toward trading days but not toward this.
  if (account.minWinningDays) {
    const threshold = account.winningDayMinProfit ?? 0
    const qualifying = options.dailyPnls.filter((d) => d.netPnl >= Math.max(threshold, 0.01)).length
    if (qualifying < account.minWinningDays) {
      blockers.push(
        threshold > 0
          ? `${qualifying} of ${account.minWinningDays} required winning days of at least ${threshold.toFixed(0)} completed.`
          : `${qualifying} of ${account.minWinningDays} required winning days completed.`,
      )
    }
  }
  if (profit <= 0) {
    blockers.push('Account is not above its starting balance.')
  } else if (buffer > 0 && profit < buffer) {
    blockers.push(
      `Profit of ${profit.toFixed(0)} is below the ${buffer.toFixed(0)} buffer — ${(buffer - profit).toFixed(0)} more is needed before anything can be withdrawn.`,
    )
  }

  const consistency = consistencyCheck(options.dailyPnls, account.consistencyPercent ?? null)
  if (consistency.applies && !consistency.passes) {
    blockers.push(
      `Consistency rule: best day is ${(consistency.bestDayShare * 100).toFixed(0)}% of total profit, above the ${((account.consistencyPercent ?? 0) * 100).toFixed(0)}% limit. About ${consistency.profitNeeded.toFixed(0)} more profit on other days is needed.`,
    )
  }

  const withdrawable = Math.max(0, profit - buffer)

  // A firm that will not process less than $500 is not going to process $180,
  // so an account over the buffer can still have nothing to request.
  if (account.minPayout && withdrawable > 0 && withdrawable < account.minPayout) {
    blockers.push(
      `${withdrawable.toFixed(0)} is available but the firm's minimum payout is ${account.minPayout.toFixed(0)}.`,
    )
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    withdrawable: round(withdrawable),
    netToTrader: round(withdrawable * options.profitSplit),
    toFirstPayout: round(Math.max(0, buffer + Math.max(account.minPayout ?? 0, 0) - profit)),
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
const plan = (
  label: string,
  size: number,
  maxDrawdown: number,
  drawdownType: FirmPlan['drawdownType'],
  profitTarget: number | null,
  cost: number | null,
  extras: Partial<FirmPlan> = {},
): FirmPlan => ({
  label,
  phase: 'eval',
  size,
  maxDrawdown,
  drawdownType,
  consistencyPercent: null,
  profitTarget,
  dailyLossLimit: null,
  minWinningDays: null,
  winningDayMinProfit: null,
  cost,
  ...extras,
})

export const FIRM_PRESETS: {
  name: string
  platform: string
  profitSplit: number
  drawdownType: Account['drawdownType']
  note: string
  /** Plan catalogue seeded onto the firm — every value editable afterwards. */
  plans: FirmPlan[]
}[] = [
  // Verified against public sources August 2026. Firms change these terms
  // often and per plan — treat every value as a starting point to edit against
  // your actual agreement, not as truth.
  {
    name: 'Apex Trader Funding',
    platform: 'rithmic',
    profitSplit: 1.0,
    drawdownType: 'trailing_eod',
    note: 'Apex 4.0 (from Mar 2026): 100% of approved payouts to the trader, capped at 6 payouts per performance account. Drawdown type is chosen at purchase — EOD or intraday trailing — and locks at starting balance + drawdown + $100. Consistency: no day ≥50% of profit since last payout; 5 qualifying trading days per request. Routes via Rithmic, Tradovate or WealthCharts. One-time eval fee since 4.0 (list; sales of 70–90% are routine), PA activation $89–159 on top.',
    plans: [
      plan('25K EOD', 25_000, 1_500, 'trailing_eod', 1_500, 390),
      plan('50K EOD', 50_000, 2_500, 'trailing_eod', 3_000, 490),
      plan('100K EOD', 100_000, 3_000, 'trailing_eod', 6_000, 790),
      plan('150K EOD', 150_000, 5_000, 'trailing_eod', 9_000, 1_490),
      plan('25K Intraday', 25_000, 1_500, 'trailing_intraday', 1_500, 167),
      plan('50K Intraday', 50_000, 2_500, 'trailing_intraday', 3_000, 249),
      plan('100K Intraday', 100_000, 3_000, 'trailing_intraday', 6_000, 399),
      plan('150K Intraday', 150_000, 5_000, 'trailing_intraday', 9_000, 599),
    ],
  },
  {
    name: 'Topstep',
    platform: 'projectx',
    profitSplit: 0.9,
    drawdownType: 'trailing_eod',
    note: 'Accounts from Jan 2026: flat 90/10 from the first dollar. EOD trailing Maximum Loss Limit that locks permanently at starting balance; note the MLL moves to $0 after the first Express Funded payout. Payouts weekly after 5 winning days of ≥$150 (or 3 days on the 40% consistency path); per-payout caps apply on accounts from Apr 2026. Monthly subscription (promo prices below), $149 activation on the standard path.',
    plans: [
      plan('50K Combine', 50_000, 2_000, 'trailing_eod', 3_000, 49, {
        dailyLossLimit: 1_000,
        consistencyPercent: 0.5,
      }),
      plan('100K Combine', 100_000, 3_000, 'trailing_eod', 6_000, 99, {
        dailyLossLimit: 2_000,
        consistencyPercent: 0.5,
      }),
      plan('150K Combine', 150_000, 4_500, 'trailing_eod', 9_000, 149, {
        dailyLossLimit: 3_000,
        consistencyPercent: 0.5,
      }),
    ],
  },
  {
    name: 'Take Profit Trader',
    platform: 'rithmic',
    profitSplit: 0.8,
    drawdownType: 'trailing_intraday',
    note: 'PRO (sim funded) is 80/20 with INTRADAY trailing drawdown; PRO+ upgrades to 90/10 and reverts to EOD trailing. No consistency rule and no minimum days — withdraw daily once above the buffer (starting balance + max drawdown). Dual routing: Rithmic and Tradovate/CQG. Monthly eval fee + one-time $130 PRO activation. Eval drawdown is EOD; it becomes intraday in PRO.',
    plans: [
      plan('25K Eval', 25_000, 1_500, 'trailing_eod', 1_500, 150),
      plan('50K Eval', 50_000, 2_000, 'trailing_eod', 3_000, 170),
      plan('75K Eval', 75_000, 2_500, 'trailing_eod', 4_500, 245),
      plan('100K Eval', 100_000, 4_000, 'trailing_eod', 6_000, 330),
      plan('150K Eval', 150_000, 4_500, 'trailing_eod', 9_000, 360),
    ],
  },
  {
    name: 'MyFundedFutures',
    platform: 'tradovate',
    profitSplit: 0.9,
    drawdownType: 'trailing_eod',
    note: 'Plan lineup replaced in 2025 (Core / Rapid / Builder / Pro). Core: EOD trailing, 40% consistency, 80/20 capped $5k/cycle. Rapid: intraday trailing on live equity incl. unrealised, no consistency, 90/10. Pro: EOD, no consistency, 80/20, $1k minimum payout. EOD drawdown computes 4:59 PM CT on closed P&L. Prices range $105 (Builder 25K) to $477 (Pro 150K) — set the cost from your invoice.',
    plans: [
      plan('Core 50K', 50_000, 2_500, 'trailing_eod', 3_000, null, { consistencyPercent: 0.4 }),
      plan('Core 100K', 100_000, 3_500, 'trailing_eod', 6_000, null, { consistencyPercent: 0.4 }),
      plan('Core 150K', 150_000, 4_500, 'trailing_eod', 9_000, null, { consistencyPercent: 0.4 }),
      plan('Rapid 50K', 50_000, 2_500, 'trailing_intraday', 3_000, null),
      plan('Builder 25K', 25_000, 1_500, 'trailing_eod', 1_500, 105),
      plan('Pro 150K', 150_000, 4_500, 'trailing_eod', 9_000, 477),
    ],
  },
  {
    name: 'FundedNext Futures',
    platform: 'tradovate',
    profitSplit: 0.8,
    drawdownType: 'trailing_eod',
    note: '80/20 split on standard futures accounts. One-time fee, single phase, EOD trailing, no activation fee and no monthly subscription. Rapid Daily: daily payouts, zero consistency rule, no benchmark days. Rapid Pro: payouts every 3 days, no daily loss limit. Costs below are list — a ~50% code is usually running.',
    plans: [
      plan('Rapid 25K', 25_000, 1_000, 'trailing_eod', 1_500, 160),
      plan('Rapid 50K', 50_000, 2_000, 'trailing_eod', 3_000, 300),
      plan('Rapid 100K', 100_000, 2_500, 'trailing_eod', 5_000, 500),
    ],
  },
  {
    name: 'Bulenox',
    platform: 'rithmic',
    profitSplit: 0.9,
    drawdownType: 'trailing_intraday',
    note: '100% of the first $10k withdrawn, then 90/10. Drawdown chosen at purchase: real-time intraday trailing, or EOD trailing plus a daily loss limit; locks around starting balance. 40% best-day consistency at payout, 10 trading days minimum, payouts processed Wednesdays. Rithmic platforms only.',
    plans: [],
  },
  {
    name: 'Tradeify',
    platform: 'tradovate',
    profitSplit: 0.9,
    drawdownType: 'trailing_eod',
    note: 'Growth and Lightning pay 100% of the first $15k, then 90/10. EOD trailing that locks at start + $100. Consistency by plan: Growth 35% with 5 qualifying days per payout, Select none, Lightning graduated 20/25/30% per payout number. Routes via Tradovate, Rithmic or WealthCharts.',
    plans: [],
  },
  {
    name: 'Alpha Futures',
    platform: 'tradovate',
    profitSplit: 0.9,
    drawdownType: 'trailing_eod',
    note: 'Flat 90/10 from day one. EOD trailing Maximum Loss Limit on all plans (never intraday). Plans since May 2026: Zero (no eval consistency, Daily Loss Guard locks the day, 40% consistency once qualified), Advanced (3.5% MLL, 50% eval consistency) and Premium (50% eval consistency; $149 activation path or higher monthly with none). Payout caps up to $15k per request. Tradovate, NinjaTrader/Rithmic, Quantower, TradingView.',
    plans: [
      plan('Zero 25K', 25_000, 1_000, 'trailing_eod', 1_500, 79),
      plan('Zero 50K', 50_000, 2_000, 'trailing_eod', 3_000, null),
      plan('Zero 100K', 100_000, 3_000, 'trailing_eod', 6_000, null),
      plan('Advanced 50K', 50_000, 1_750, 'trailing_eod', 3_000, null, { consistencyPercent: 0.5 }),
      plan('Advanced 100K', 100_000, 3_500, 'trailing_eod', 6_000, null, { consistencyPercent: 0.5 }),
      plan('Premium 50K', 50_000, 2_000, 'trailing_eod', 3_000, 79, { consistencyPercent: 0.5 }),
      plan('Premium 100K', 100_000, 3_000, 'trailing_eod', 6_000, null, { consistencyPercent: 0.5 }),
      plan('Premium 150K', 150_000, 4_500, 'trailing_eod', 9_000, null, { consistencyPercent: 0.5 }),
    ],
  },
  {
    name: 'Lucid Trading',
    platform: 'rithmic',
    profitSplit: 0.9,
    drawdownType: 'trailing_eod',
    note: '90/10 with very fast payouts (~15 minutes average, $500 minimum). EOD trailing that updates at the close and locks at starting balance + $100. Flex: 50% consistency during eval, none funded, no daily loss limit. Pro: cheaper funded consistency trade-off. 5 qualifying profitable days per cycle. NinjaTrader, Tradovate and Rithmic platforms.',
    plans: [
      plan('Flex 25K', 25_000, 1_250, 'trailing_eod', 1_250, 89, { consistencyPercent: 0.5 }),
      plan('Flex 50K', 50_000, 2_500, 'trailing_eod', 3_000, 136, { consistencyPercent: 0.5 }),
      plan('Flex 100K', 100_000, 3_000, 'trailing_eod', 6_000, null, { consistencyPercent: 0.5 }),
      plan('Flex 150K', 150_000, 4_500, 'trailing_eod', 9_000, null, { consistencyPercent: 0.5 }),
      plan('Pro 50K', 50_000, 2_500, 'trailing_eod', 3_000, 172, { consistencyPercent: 0.5 }),
      plan('Pro 150K', 150_000, 4_500, 'trailing_eod', 9_000, 297, { consistencyPercent: 0.5 }),
    ],
  },
  {
    name: 'Elite Trader Funding',
    platform: 'rithmic',
    profitSplit: 0.9,
    drawdownType: 'trailing_intraday',
    note: 'Sim funded: 100% of first $12.5k then 90/10; Live Elite is 80/20 uncapped. Six evaluation models with different drawdowns — 1-Step is intraday trailing locking at profit = drawdown + $100, EOD and Static variants exist. Most plans have no payout consistency rule; Fast Track 30%. Payouts Mondays and Wednesdays.',
    plans: [],
  },
]
