import { describe, expect, it } from 'vitest'
import {
  bySession,
  bySymbol,
  computeMetrics,
  dailySeries,
  drawdownOf,
  equityCurve,
  kelly,
  mistakeCost,
  streaksOf,
  type TradeLike,
} from './metrics'

let counter = 0

function trade(netPnl: number, overrides: Partial<TradeLike> = {}): TradeLike {
  counter += 1
  const entryAt = overrides.entryAt ?? new Date(Date.UTC(2026, 2, 4, 14, 0, counter))
  return {
    accountId: 1,
    symbol: 'MNQ',
    direction: 'long',
    qty: 1,
    entryAt,
    exitAt: overrides.exitAt ?? new Date(entryAt.getTime() + 300_000),
    tradingDay: '2026-03-04',
    netPnl,
    grossPnl: netPnl,
    commission: 0,
    fees: 0,
    status: 'closed',
    ...overrides,
  }
}

describe('computeMetrics', () => {
  it('returns a zeroed shape for no trades', () => {
    const metrics = computeMetrics([])
    expect(metrics.trades).toBe(0)
    expect(metrics.netPnl).toBe(0)
    expect(metrics.profitFactor).toBeNull()
    expect(metrics.expectancy).toBe(0)
  })

  it('counts wins, losses and scratches separately', () => {
    const metrics = computeMetrics([trade(100), trade(-50), trade(0), trade(0.001)])
    expect(metrics.wins).toBe(1)
    expect(metrics.losses).toBe(1)
    // Anything inside the half-cent band is neither a win nor a loss.
    expect(metrics.scratches).toBe(2)
  })

  it('computes profit factor as gross profit over gross loss', () => {
    const metrics = computeMetrics([trade(300), trade(-100), trade(-50)])
    expect(metrics.grossProfit).toBe(300)
    expect(metrics.grossLoss).toBe(150)
    expect(metrics.profitFactor).toBe(2)
  })

  it('computes expectancy as net P&L per trade', () => {
    const metrics = computeMetrics([trade(100), trade(-40), trade(60)])
    expect(metrics.netPnl).toBe(120)
    expect(metrics.expectancy).toBe(40)
  })

  it('excludes open trades from performance', () => {
    const metrics = computeMetrics([trade(100), trade(500, { status: 'open', exitAt: null })])
    expect(metrics.trades).toBe(1)
    expect(metrics.netPnl).toBe(100)
  })

  it('computes payoff ratio from average win and loss', () => {
    const metrics = computeMetrics([trade(200), trade(200), trade(-100)])
    expect(metrics.avgWin).toBe(200)
    expect(metrics.avgLoss).toBe(100)
    expect(metrics.payoffRatio).toBe(2)
  })

  it('reports cost ratio against gross profit', () => {
    const metrics = computeMetrics([
      trade(90, { grossPnl: 100, commission: 8, fees: 2 }),
      trade(-30, { grossPnl: -20, commission: 8, fees: 2 }),
    ])
    expect(metrics.totalCosts).toBe(20)
    expect(metrics.costRatio).toBeCloseTo(20 / 90, 6)
  })

  it('averages hold time separately for winners and losers', () => {
    const metrics = computeMetrics([
      trade(100, { durationSeconds: 60 }),
      trade(-50, { durationSeconds: 600 }),
    ])
    expect(metrics.avgWinHoldSeconds).toBe(60)
    expect(metrics.avgLossHoldSeconds).toBe(600)
  })

  it('summarises R when stops were recorded', () => {
    const metrics = computeMetrics([
      trade(200, { rMultiple: 2 }),
      trade(-100, { rMultiple: -1 }),
      trade(100, { rMultiple: 1 }),
    ])
    expect(metrics.totalR).toBe(2)
    expect(metrics.avgR).toBeCloseTo(2 / 3, 6)
  })

  it('leaves R null when no stop data exists', () => {
    expect(computeMetrics([trade(100), trade(-50)]).avgR).toBeNull()
  })

  it('separates green from red days', () => {
    const metrics = computeMetrics([
      trade(100, { tradingDay: '2026-03-04' }),
      trade(-30, { tradingDay: '2026-03-04' }),
      trade(-80, { tradingDay: '2026-03-05' }),
    ])
    expect(metrics.tradingDays).toBe(2)
    expect(metrics.greenDays).toBe(1)
    expect(metrics.redDays).toBe(1)
    expect(metrics.bestDay?.day).toBe('2026-03-04')
    expect(metrics.worstDay?.day).toBe('2026-03-05')
  })
})

describe('drawdownOf', () => {
  it('is zero for a monotonically rising curve', () => {
    expect(drawdownOf([trade(100), trade(100), trade(100)]).maxDrawdown).toBe(0)
  })

  it('measures peak to trough, not start to trough', () => {
    // +100, +200 peak, then -150 to 50: the drawdown is 150.
    const result = drawdownOf([trade(100), trade(100), trade(-150)])
    expect(result.maxDrawdown).toBe(150)
    expect(result.maxDrawdownPercent).toBeCloseTo(0.75, 6)
  })

  it('keeps the deepest of several drawdowns', () => {
    const result = drawdownOf([trade(100), trade(-40), trade(200), trade(-90), trade(10)])
    expect(result.maxDrawdown).toBe(90)
  })
})

describe('streaksOf', () => {
  it('finds the longest winning and losing runs', () => {
    const result = streaksOf([
      trade(10), trade(10), trade(10),
      trade(-10), trade(-10),
      trade(10),
    ])
    expect(result.maxWins).toBe(3)
    expect(result.maxLosses).toBe(2)
    expect(result.current).toBe(1)
  })

  it('reports a live losing streak as a negative number', () => {
    expect(streaksOf([trade(10), trade(-10), trade(-10)]).current).toBe(-2)
  })

  it('does not let a scratch break a streak', () => {
    expect(streaksOf([trade(10), trade(0), trade(10)]).maxWins).toBe(2)
  })
})

describe('dailySeries', () => {
  it('aggregates per day and carries a running cumulative', () => {
    const series = dailySeries([
      trade(100, { tradingDay: '2026-03-04' }),
      trade(-30, { tradingDay: '2026-03-04' }),
      trade(50, { tradingDay: '2026-03-05' }),
    ])
    expect(series).toHaveLength(2)
    expect(series[0].netPnl).toBe(70)
    expect(series[0].cumulative).toBe(70)
    expect(series[1].cumulative).toBe(120)
  })

  it('returns days in chronological order regardless of input order', () => {
    const series = dailySeries([
      trade(10, { tradingDay: '2026-03-06' }),
      trade(10, { tradingDay: '2026-03-04' }),
    ])
    expect(series.map((p) => p.day)).toEqual(['2026-03-04', '2026-03-06'])
  })
})

describe('equityCurve', () => {
  it('tracks equity, peak and underwater distance', () => {
    const curve = equityCurve([trade(100), trade(-40)], 50_000)
    expect(curve[0].equity).toBe(50_100)
    expect(curve[1].equity).toBe(50_060)
    expect(curve[1].peak).toBe(50_100)
    expect(curve[1].drawdown).toBe(-40)
  })
})

describe('groupings', () => {
  it('splits by symbol and ranks by net P&L', () => {
    const buckets = bySymbol([
      trade(100, { symbol: 'MNQ' }),
      trade(-200, { symbol: 'MES' }),
      trade(50, { symbol: 'MNQ' }),
    ])
    expect(buckets[0].key).toBe('MNQ')
    expect(buckets[0].netPnl).toBe(150)
    expect(buckets[0].trades).toBe(2)
    expect(buckets[1].key).toBe('MES')
  })

  it('buckets by session in the trader local timezone', () => {
    // 14:30 UTC is 16:30 in Jerusalem (winter), which is the London window.
    const buckets = bySession(
      [trade(100, { entryAt: new Date('2026-03-04T14:30:00Z') })],
      'Asia/Jerusalem',
    )
    expect(buckets).toHaveLength(1)
    expect(buckets[0].trades).toBe(1)
  })
})

describe('mistakeCost', () => {
  it('measures a tagged mistake against clean trades of the same period', () => {
    const trades = [
      trade(100),
      trade(100),
      trade(-100, { mistakes: ['moved stop'] }),
      trade(-100, { mistakes: ['moved stop'] }),
    ]
    const costs = mistakeCost(trades)
    expect(costs[0].mistake).toBe('moved stop')
    expect(costs[0].trades).toBe(2)
    // Baseline from clean trades is +100 each, so two -100 trades are 400 worse.
    expect(costs[0].cost).toBe(-400)
  })

  it('returns nothing when no mistakes are tagged', () => {
    expect(mistakeCost([trade(100), trade(-50)])).toEqual([])
  })
})

describe('kelly', () => {
  it('is positive for a favourable edge', () => {
    // 50% win rate at 2:1 payoff -> 0.25.
    expect(kelly(0.5, 200, 100)).toBeCloseTo(0.25, 6)
  })

  it('is negative when the edge is against you', () => {
    expect(kelly(0.3, 100, 100)!).toBeLessThan(0)
  })

  it('is null without a loss to measure against', () => {
    expect(kelly(0.5, 100, 0)).toBeNull()
  })
})
