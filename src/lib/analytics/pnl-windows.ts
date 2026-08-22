/**
 * P&L by period, split by what the account actually is.
 *
 * A total that mixes evaluations with funded accounts answers the wrong
 * question. Evaluation profit is a score — it demonstrates the account should
 * pass, and none of it is ever paid. Funded profit is the part that becomes
 * money. Adding them produces a number that is neither, and flatters a month
 * where nothing was earned.
 *
 * Pure: given trades and the boundaries of each period, this does the
 * arithmetic and nothing else.
 */

/** Phases whose profit can actually be withdrawn. */
const FUNDED_PHASES = new Set(['funded', 'live'])
const EVALUATION_PHASES = new Set(['eval'])

export type PhaseSplit = {
  evaluation: number
  funded: number
  /** Personal and demo accounts — kept apart so the columns still add up. */
  other: number
  total: number
}

export type PnlPeriod = {
  key: 'today' | 'week' | 'month' | 'year' | 'all'
  label: string
  split: PhaseSplit
}

export type PnlTradeLike = {
  tradingDay: string
  netPnl: number
  phase: string
}

export type PeriodBoundaries = {
  /** All inclusive lower bounds, as YYYY-MM-DD in the user's timezone. */
  today: string
  weekStart: string
  monthStart: string
  yearStart: string
}

const empty = (): PhaseSplit => ({ evaluation: 0, funded: 0, other: 0, total: 0 })

export function splitFor(trades: PnlTradeLike[]): PhaseSplit {
  const split = empty()
  for (const trade of trades) {
    if (FUNDED_PHASES.has(trade.phase)) split.funded += trade.netPnl
    else if (EVALUATION_PHASES.has(trade.phase)) split.evaluation += trade.netPnl
    else split.other += trade.netPnl
    split.total += trade.netPnl
  }
  return split
}

export function pnlByPeriod(trades: PnlTradeLike[], boundaries: PeriodBoundaries): PnlPeriod[] {
  const from = (start: string) => trades.filter((trade) => trade.tradingDay >= start)

  return [
    { key: 'today', label: 'Today', split: splitFor(from(boundaries.today)) },
    { key: 'week', label: 'This week', split: splitFor(from(boundaries.weekStart)) },
    { key: 'month', label: 'This month', split: splitFor(from(boundaries.monthStart)) },
    { key: 'year', label: 'This year', split: splitFor(from(boundaries.yearStart)) },
    { key: 'all', label: 'All time', split: splitFor(trades) },
  ]
}

/**
 * Whether any personal or demo trading exists at all.
 *
 * Almost always false, and a column of zeros is noise — so the table only
 * grows a third column when there is something in it.
 */
export function hasOther(periods: PnlPeriod[]): boolean {
  return periods.some((period) => period.split.other !== 0)
}

/**
 * The boundaries of each period, from a day already in the user's timezone.
 *
 * The week starts on Sunday, matching both the Israeli working week and the
 * rest of the app's weekly figures.
 */
export function boundariesFor(currentDay: string): PeriodBoundaries {
  const date = new Date(`${currentDay}T00:00:00Z`)
  const weekStart = new Date(date)
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())

  return {
    today: currentDay,
    weekStart: weekStart.toISOString().slice(0, 10),
    monthStart: `${currentDay.slice(0, 7)}-01`,
    yearStart: `${currentDay.slice(0, 4)}-01-01`,
  }
}
