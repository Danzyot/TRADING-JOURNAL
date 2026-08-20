/**
 * The statistics layer.
 *
 * Everything the dashboard, the analytics page and the insights engine report
 * comes from here. Functions are pure and take plain arrays so they can be run
 * over a database result set, a CSV preview, or a test fixture without change.
 *
 * A note on what is deliberately *not* averaged: win rate on its own says
 * nothing. A 30% win rate with a 4:1 payoff prints money; an 80% win rate with
 * a 1:6 payoff bleeds. Expectancy and profit factor are the headline numbers
 * in this app, and win rate is context for them.
 */
import { toZonedTime } from 'date-fns-tz'

export type TradeLike = {
  id?: number
  accountId: number
  symbol: string
  direction: 'long' | 'short'
  qty: number
  entryAt: Date
  exitAt: Date | null
  tradingDay: string
  netPnl: number
  grossPnl: number
  commission: number
  fees: number
  rMultiple?: number | null
  riskBase?: number | null
  durationSeconds?: number | null
  setup?: string | null
  tags?: string[]
  mistakes?: string[]
  execScore?: number | null
  status?: 'open' | 'closed'
}

export type CoreMetrics = {
  trades: number
  wins: number
  losses: number
  scratches: number
  winRate: number
  lossRate: number

  grossPnl: number
  commission: number
  fees: number
  totalCosts: number
  netPnl: number

  grossProfit: number
  grossLoss: number
  profitFactor: number | null

  avgWin: number
  avgLoss: number
  /** avgWin / avgLoss. The other half of the edge equation. */
  payoffRatio: number | null
  largestWin: number
  largestLoss: number

  /** Expected net P&L per trade. The single most useful number here. */
  expectancy: number
  /** Same, denominated in R. Null when stops were not recorded. */
  expectancyR: number | null
  avgR: number | null
  totalR: number | null

  /** Peak-to-trough of the cumulative net-P&L curve. */
  maxDrawdown: number
  maxDrawdownPercent: number | null
  /** netPnl / maxDrawdown — how much profit each unit of pain bought. */
  recoveryFactor: number | null

  maxConsecutiveWins: number
  maxConsecutiveLosses: number
  currentStreak: number

  volume: number
  avgSize: number
  avgHoldSeconds: number | null
  avgWinHoldSeconds: number | null
  avgLossHoldSeconds: number | null

  /** Costs as a share of gross profit. Over ~30% the broker is the edge. */
  costRatio: number | null
  /** Annualised Sharpe from the daily net-P&L series. */
  sharpe: number | null
  /** Fraction of bankroll Kelly would stake given this win rate and payoff. */
  kellyFraction: number | null

  firstTradeOn: string | null
  lastTradeOn: string | null
  tradingDays: number
  avgTradesPerDay: number
  avgDailyPnl: number
  bestDay: { day: string; netPnl: number } | null
  worstDay: { day: string; netPnl: number } | null
  greenDays: number
  redDays: number
  dayWinRate: number
}

/** A trade within this band of zero is neither a win nor a loss. */
const SCRATCH_BAND = 0.005

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0)
const mean = (values: number[]): number => (values.length ? sum(values) / values.length : 0)

function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(sum(values.map((v) => (v - m) ** 2)) / (values.length - 1))
}

function safeDiv(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

export function isWin(trade: TradeLike): boolean {
  return trade.netPnl > SCRATCH_BAND
}

export function isLoss(trade: TradeLike): boolean {
  return trade.netPnl < -SCRATCH_BAND
}

/** Only closed trades count toward performance; open ones have no outcome yet. */
export function closedTrades(trades: TradeLike[]): TradeLike[] {
  return trades.filter((t) => t.status !== 'open')
}

export function computeMetrics(input: TradeLike[]): CoreMetrics {
  const trades = closedTrades(input).slice().sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime())

  const wins = trades.filter(isWin)
  const losses = trades.filter(isLoss)
  const scratches = trades.length - wins.length - losses.length

  const grossProfit = sum(wins.map((t) => t.netPnl))
  const grossLoss = Math.abs(sum(losses.map((t) => t.netPnl)))
  const netPnl = sum(trades.map((t) => t.netPnl))
  const grossPnl = sum(trades.map((t) => t.grossPnl))
  const commission = sum(trades.map((t) => t.commission))
  const fees = sum(trades.map((t) => t.fees))

  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const winRate = trades.length ? wins.length / trades.length : 0
  const lossRate = trades.length ? losses.length / trades.length : 0

  const rValues = trades
    .map((t) => t.rMultiple)
    .filter((r): r is number => typeof r === 'number' && Number.isFinite(r))

  const { maxDrawdown, maxDrawdownPercent } = drawdownOf(trades)
  const streaks = streaksOf(trades)
  const daily = dailySeries(trades)
  const dailyPnls = daily.map((d) => d.netPnl)

  const durations = trades
    .map((t) => t.durationSeconds)
    .filter((d): d is number => typeof d === 'number' && d >= 0)
  const winDurations = wins
    .map((t) => t.durationSeconds)
    .filter((d): d is number => typeof d === 'number' && d >= 0)
  const lossDurations = losses
    .map((t) => t.durationSeconds)
    .filter((d): d is number => typeof d === 'number' && d >= 0)

  const dailyStdev = stdev(dailyPnls)
  const greenDays = daily.filter((d) => d.netPnl > SCRATCH_BAND).length
  const redDays = daily.filter((d) => d.netPnl < -SCRATCH_BAND).length

  const sorted = daily.slice().sort((a, b) => a.netPnl - b.netPnl)

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    scratches,
    winRate,
    lossRate,

    grossPnl,
    commission,
    fees,
    totalCosts: commission + fees,
    netPnl,

    grossProfit,
    grossLoss,
    profitFactor: safeDiv(grossProfit, grossLoss),

    avgWin,
    avgLoss,
    payoffRatio: safeDiv(avgWin, avgLoss),
    largestWin: wins.length ? Math.max(...wins.map((t) => t.netPnl)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map((t) => t.netPnl)) : 0,

    expectancy: trades.length ? netPnl / trades.length : 0,
    expectancyR: rValues.length ? mean(rValues) : null,
    avgR: rValues.length ? mean(rValues) : null,
    totalR: rValues.length ? sum(rValues) : null,

    maxDrawdown,
    maxDrawdownPercent,
    recoveryFactor: maxDrawdown > 0 ? netPnl / maxDrawdown : null,

    maxConsecutiveWins: streaks.maxWins,
    maxConsecutiveLosses: streaks.maxLosses,
    currentStreak: streaks.current,

    volume: sum(trades.map((t) => t.qty)),
    avgSize: trades.length ? sum(trades.map((t) => t.qty)) / trades.length : 0,
    avgHoldSeconds: durations.length ? mean(durations) : null,
    avgWinHoldSeconds: winDurations.length ? mean(winDurations) : null,
    avgLossHoldSeconds: lossDurations.length ? mean(lossDurations) : null,

    costRatio: grossProfit > 0 ? (commission + fees) / grossProfit : null,
    // 252 trading days annualises a daily series; with a $0 risk-free rate this
    // is the standard "return per unit of volatility" reading.
    sharpe: dailyStdev > 0 ? (mean(dailyPnls) / dailyStdev) * Math.sqrt(252) : null,
    kellyFraction: kelly(winRate, avgWin, avgLoss),

    firstTradeOn: trades.length ? trades[0].tradingDay : null,
    lastTradeOn: trades.length ? trades[trades.length - 1].tradingDay : null,
    tradingDays: daily.length,
    avgTradesPerDay: daily.length ? trades.length / daily.length : 0,
    avgDailyPnl: daily.length ? netPnl / daily.length : 0,
    bestDay: sorted.length ? { day: sorted[sorted.length - 1].day, netPnl: sorted[sorted.length - 1].netPnl } : null,
    worstDay: sorted.length ? { day: sorted[0].day, netPnl: sorted[0].netPnl } : null,
    greenDays,
    redDays,
    dayWinRate: daily.length ? greenDays / daily.length : 0,
  }
}

/**
 * Kelly criterion: f* = W - (1 - W) / R, where W is win rate and R the payoff
 * ratio. Reported as-is; full Kelly is far too aggressive for a drawdown-capped
 * prop account, so the UI shows a quarter of it as the practical number.
 */
export function kelly(winRate: number, avgWin: number, avgLoss: number): number | null {
  if (avgLoss <= 0 || avgWin <= 0) return null
  const payoff = avgWin / avgLoss
  const f = winRate - (1 - winRate) / payoff
  return Number.isFinite(f) ? f : null
}

export function drawdownOf(trades: TradeLike[]): {
  maxDrawdown: number
  maxDrawdownPercent: number | null
} {
  let equity = 0
  let peak = 0
  let maxDrawdown = 0
  let maxDrawdownPercent: number | null = null

  for (const trade of trades) {
    equity += trade.netPnl
    if (equity > peak) peak = equity
    const drop = peak - equity
    if (drop > maxDrawdown) {
      maxDrawdown = drop
      maxDrawdownPercent = peak > 0 ? drop / peak : null
    }
  }

  return { maxDrawdown, maxDrawdownPercent }
}

export function streaksOf(trades: TradeLike[]): {
  maxWins: number
  maxLosses: number
  current: number
} {
  let maxWins = 0
  let maxLosses = 0
  let run = 0

  for (const trade of trades) {
    if (isWin(trade)) {
      run = run > 0 ? run + 1 : 1
      maxWins = Math.max(maxWins, run)
    } else if (isLoss(trade)) {
      run = run < 0 ? run - 1 : -1
      maxLosses = Math.max(maxLosses, Math.abs(run))
    }
    // Scratches leave the streak alone — they are not a change of fortune.
  }

  return { maxWins, maxLosses, current: run }
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export type DailyPoint = {
  day: string
  trades: number
  netPnl: number
  grossPnl: number
  costs: number
  cumulative: number
  wins: number
  losses: number
  volume: number
}

export function dailySeries(trades: TradeLike[]): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>()

  for (const trade of closedTrades(trades)) {
    const point = byDay.get(trade.tradingDay) ?? {
      day: trade.tradingDay,
      trades: 0,
      netPnl: 0,
      grossPnl: 0,
      costs: 0,
      cumulative: 0,
      wins: 0,
      losses: 0,
      volume: 0,
    }
    point.trades += 1
    point.netPnl += trade.netPnl
    point.grossPnl += trade.grossPnl
    point.costs += trade.commission + trade.fees
    point.volume += trade.qty
    if (isWin(trade)) point.wins += 1
    else if (isLoss(trade)) point.losses += 1
    byDay.set(trade.tradingDay, point)
  }

  const points = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
  let running = 0
  for (const point of points) {
    running += point.netPnl
    point.cumulative = running
  }
  return points
}

export type EquityPoint = {
  index: number
  at: Date
  netPnl: number
  equity: number
  peak: number
  drawdown: number
}

/** Trade-by-trade equity curve, with the underwater series alongside it. */
export function equityCurve(trades: TradeLike[], startingEquity = 0): EquityPoint[] {
  const ordered = closedTrades(trades)
    .slice()
    .sort((a, b) => (a.exitAt ?? a.entryAt).getTime() - (b.exitAt ?? b.entryAt).getTime())

  let equity = startingEquity
  let peak = startingEquity
  return ordered.map((trade, index) => {
    equity += trade.netPnl
    peak = Math.max(peak, equity)
    return {
      index: index + 1,
      at: trade.exitAt ?? trade.entryAt,
      netPnl: trade.netPnl,
      equity,
      peak,
      drawdown: equity - peak,
    }
  })
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

export type Bucket = {
  key: string
  label: string
  trades: number
  netPnl: number
  wins: number
  losses: number
  winRate: number
  expectancy: number
  profitFactor: number | null
  avgR: number | null
  volume: number
}

export function groupBy(
  trades: TradeLike[],
  keyOf: (trade: TradeLike) => string | string[] | null,
  labelOf: (key: string) => string = (key) => key,
): Bucket[] {
  const groups = new Map<string, TradeLike[]>()

  for (const trade of closedTrades(trades)) {
    const raw = keyOf(trade)
    if (raw === null) continue
    for (const key of Array.isArray(raw) ? raw : [raw]) {
      if (!key) continue
      const bucket = groups.get(key)
      if (bucket) bucket.push(trade)
      else groups.set(key, [trade])
    }
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const wins = group.filter(isWin)
      const losses = group.filter(isLoss)
      const grossProfit = sum(wins.map((t) => t.netPnl))
      const grossLoss = Math.abs(sum(losses.map((t) => t.netPnl)))
      const rValues = group
        .map((t) => t.rMultiple)
        .filter((r): r is number => typeof r === 'number' && Number.isFinite(r))
      const netPnl = sum(group.map((t) => t.netPnl))

      return {
        key,
        label: labelOf(key),
        trades: group.length,
        netPnl,
        wins: wins.length,
        losses: losses.length,
        winRate: group.length ? wins.length / group.length : 0,
        expectancy: group.length ? netPnl / group.length : 0,
        profitFactor: safeDiv(grossProfit, grossLoss),
        avgR: rValues.length ? mean(rValues) : null,
        volume: sum(group.map((t) => t.qty)),
      }
    })
    .sort((a, b) => b.netPnl - a.netPnl)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function bySymbol(trades: TradeLike[]): Bucket[] {
  return groupBy(trades, (t) => t.symbol)
}

export function byDirection(trades: TradeLike[]): Bucket[] {
  return groupBy(trades, (t) => t.direction, (key) => (key === 'long' ? 'Long' : 'Short'))
}

export function bySetup(trades: TradeLike[]): Bucket[] {
  return groupBy(trades, (t) => t.setup ?? 'Untagged')
}

export function byTag(trades: TradeLike[]): Bucket[] {
  return groupBy(trades, (t) => (t.tags?.length ? t.tags : null))
}

export function byMistake(trades: TradeLike[]): Bucket[] {
  return groupBy(trades, (t) => (t.mistakes?.length ? t.mistakes : null))
}

export function byWeekday(trades: TradeLike[], timezone: string): Bucket[] {
  return groupBy(
    trades,
    (t) => String(toZonedTime(t.entryAt, timezone).getDay()),
    (key) => WEEKDAYS[Number(key)] ?? key,
  ).sort((a, b) => Number(a.key) - Number(b.key))
}

export function byHour(trades: TradeLike[], timezone: string): Bucket[] {
  return groupBy(
    trades,
    (t) => String(toZonedTime(t.entryAt, timezone).getHours()).padStart(2, '0'),
    (key) => `${key}:00`,
  ).sort((a, b) => a.key.localeCompare(b.key))
}

const SIZE_BANDS: { max: number; label: string }[] = [
  { max: 1, label: '1 contract' },
  { max: 2, label: '2 contracts' },
  { max: 3, label: '3 contracts' },
  { max: 5, label: '4-5 contracts' },
  { max: 10, label: '6-10 contracts' },
  { max: Infinity, label: '10+ contracts' },
]

export function bySize(trades: TradeLike[]): Bucket[] {
  return groupBy(trades, (t) => SIZE_BANDS.find((band) => t.qty <= band.max)?.label ?? 'Unknown')
}

const DURATION_BANDS: { max: number; label: string }[] = [
  { max: 60, label: 'Under 1 min' },
  { max: 300, label: '1-5 min' },
  { max: 900, label: '5-15 min' },
  { max: 3600, label: '15-60 min' },
  { max: 14400, label: '1-4 hours' },
  { max: Infinity, label: 'Over 4 hours' },
]

export function byDuration(trades: TradeLike[]): Bucket[] {
  return groupBy(trades, (t) => {
    if (typeof t.durationSeconds !== 'number') return null
    return DURATION_BANDS.find((band) => t.durationSeconds! <= band.max)?.label ?? null
  })
}

/**
 * CME session buckets, in the trader's own timezone. Which part of the day is
 * actually profitable is one of the most reliably actionable findings in a
 * journal, and it is invisible without this split.
 */
export function bySession(trades: TradeLike[], timezone: string): Bucket[] {
  return groupBy(trades, (t) => {
    const hour = toZonedTime(t.entryAt, timezone).getHours()
    if (hour < 6) return 'Overnight'
    if (hour < 11) return 'Asia / early Europe'
    if (hour < 16) return 'London'
    if (hour < 18) return 'NY open'
    if (hour < 21) return 'NY midday'
    return 'NY close'
  })
}

/**
 * How much a named mistake has cost, measured against what the same setup
 * returns when the mistake is absent. This is the number that changes behaviour.
 */
export function mistakeCost(trades: TradeLike[]): { mistake: string; trades: number; cost: number }[] {
  const closed = closedTrades(trades)
  const clean = closed.filter((t) => !t.mistakes?.length)
  const baseline = clean.length ? sum(clean.map((t) => t.netPnl)) / clean.length : 0

  const tally = new Map<string, TradeLike[]>()
  for (const trade of closed) {
    for (const mistake of trade.mistakes ?? []) {
      const bucket = tally.get(mistake)
      if (bucket) bucket.push(trade)
      else tally.set(mistake, [trade])
    }
  }

  return [...tally.entries()]
    .map(([mistake, group]) => ({
      mistake,
      trades: group.length,
      // Negative = the mistake destroyed value relative to a clean trade.
      cost: sum(group.map((t) => t.netPnl - baseline)),
    }))
    .sort((a, b) => a.cost - b.cost)
}
