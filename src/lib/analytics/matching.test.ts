import { describe, expect, it } from 'vitest'
import { matchExecutions, riskFromStop, rMultiple, type MatchExecution } from './matching'

const at = (iso: string): Date => new Date(iso)

function fill(overrides: Partial<MatchExecution> & Pick<MatchExecution, 'side' | 'qty' | 'fillPrice' | 'fillAt'>): MatchExecution {
  return {
    accountId: 1,
    contract: 'MNQZ5',
    tradingDay: '2026-03-04',
    commission: 0,
    fees: 0,
    ...overrides,
  }
}

describe('matchExecutions', () => {
  it('builds a simple winning long from two fills', () => {
    const trades = matchExecutions([
      fill({ side: 'buy', qty: 1, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z') }),
      fill({ side: 'sell', qty: 1, fillPrice: 21010, fillAt: at('2026-03-04T14:35:00Z') }),
    ])

    expect(trades).toHaveLength(1)
    const [trade] = trades
    expect(trade.direction).toBe('long')
    expect(trade.status).toBe('closed')
    expect(trade.qty).toBe(1)
    // MNQ is $2 a point: 10 points x 1 contract = $20.
    expect(trade.grossPnl).toBe(20)
    expect(trade.netPnl).toBe(20)
    expect(trade.durationSeconds).toBe(300)
    expect(trade.symbol).toBe('MNQ')
  })

  it('builds a winning short (price falls)', () => {
    const trades = matchExecutions([
      fill({ side: 'sell', qty: 2, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z') }),
      fill({ side: 'buy', qty: 2, fillPrice: 20990, fillAt: at('2026-03-04T14:40:00Z') }),
    ])

    expect(trades[0].direction).toBe('short')
    // 10 points x 2 contracts x $2 = $40.
    expect(trades[0].grossPnl).toBe(40)
  })

  it('subtracts commissions and fees to reach net', () => {
    const trades = matchExecutions([
      fill({ side: 'buy', qty: 1, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z'), commission: 0.62, fees: 0.1 }),
      fill({ side: 'sell', qty: 1, fillPrice: 21010, fillAt: at('2026-03-04T14:35:00Z'), commission: 0.62, fees: 0.1 }),
    ])

    expect(trades[0].grossPnl).toBe(20)
    expect(trades[0].commission).toBeCloseTo(1.24, 6)
    expect(trades[0].fees).toBeCloseTo(0.2, 6)
    expect(trades[0].netPnl).toBeCloseTo(18.56, 6)
  })

  it('matches scale-ins and partial exits FIFO', () => {
    const trades = matchExecutions([
      fill({ side: 'buy', qty: 2, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z') }),
      fill({ side: 'buy', qty: 2, fillPrice: 21010, fillAt: at('2026-03-04T14:31:00Z') }),
      fill({ side: 'sell', qty: 2, fillPrice: 21020, fillAt: at('2026-03-04T14:32:00Z') }),
      fill({ side: 'sell', qty: 2, fillPrice: 21030, fillAt: at('2026-03-04T14:33:00Z') }),
    ])

    expect(trades).toHaveLength(1)
    const [trade] = trades
    expect(trade.qty).toBe(4)
    expect(trade.exitQty).toBe(4)
    // FIFO: the 2 bought at 21000 close at 21020 (+20 pts on 2 contracts), and
    // the 2 at 21010 close at 21030 (+20 pts on 2). 80 point-contracts x $2.
    expect(trade.grossPnl).toBe(160)
    expect(trade.avgEntry).toBe(21005)
    expect(trade.avgExit).toBe(21025)
  })

  it('splits a position-flipping fill into a close and a new open', () => {
    const trades = matchExecutions([
      fill({ side: 'buy', qty: 2, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z') }),
      // Sells 3: two close the long, one opens a short.
      fill({ side: 'sell', qty: 3, fillPrice: 21010, fillAt: at('2026-03-04T14:35:00Z') }),
      fill({ side: 'buy', qty: 1, fillPrice: 21005, fillAt: at('2026-03-04T14:40:00Z') }),
    ])

    expect(trades).toHaveLength(2)

    const [long, short] = trades
    expect(long.direction).toBe('long')
    expect(long.qty).toBe(2)
    expect(long.grossPnl).toBe(40) // 10 points x 2 x $2

    expect(short.direction).toBe('short')
    expect(short.qty).toBe(1)
    expect(short.grossPnl).toBe(10) // sold 21010, bought 21005 = 5 points x $2
  })

  it('apportions commission across a flipping fill by quantity', () => {
    const trades = matchExecutions([
      fill({ side: 'buy', qty: 2, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z'), commission: 2 }),
      fill({ side: 'sell', qty: 3, fillPrice: 21010, fillAt: at('2026-03-04T14:35:00Z'), commission: 3 }),
      fill({ side: 'buy', qty: 1, fillPrice: 21005, fillAt: at('2026-03-04T14:40:00Z'), commission: 1 }),
    ])

    // The 3-lot sell costs $1/contract: $2 to the closing long, $1 to the new short.
    expect(trades[0].commission).toBeCloseTo(4, 6)
    expect(trades[1].commission).toBeCloseTo(2, 6)
  })

  it('leaves a still-open position marked open with no exit', () => {
    const trades = matchExecutions([
      fill({ side: 'buy', qty: 3, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z') }),
      fill({ side: 'sell', qty: 1, fillPrice: 21010, fillAt: at('2026-03-04T14:35:00Z') }),
    ])

    expect(trades).toHaveLength(1)
    expect(trades[0].status).toBe('open')
    expect(trades[0].exitAt).toBeNull()
    expect(trades[0].qty).toBe(3)
    expect(trades[0].exitQty).toBe(1)
    // The realised leg still counts.
    expect(trades[0].grossPnl).toBe(20)
  })

  it('keeps different contracts in separate positions', () => {
    const trades = matchExecutions([
      fill({ contract: 'MNQZ5', side: 'buy', qty: 1, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z') }),
      fill({ contract: 'MESZ5', side: 'buy', qty: 1, fillPrice: 5800, fillAt: at('2026-03-04T14:31:00Z') }),
      fill({ contract: 'MNQZ5', side: 'sell', qty: 1, fillPrice: 21010, fillAt: at('2026-03-04T14:32:00Z') }),
      fill({ contract: 'MESZ5', side: 'sell', qty: 1, fillPrice: 5805, fillAt: at('2026-03-04T14:33:00Z') }),
    ])

    expect(trades).toHaveLength(2)
    expect(trades.find((t) => t.symbol === 'MNQ')?.grossPnl).toBe(20)
    // MES is $5 a point: 5 points = $25.
    expect(trades.find((t) => t.symbol === 'MES')?.grossPnl).toBe(25)
  })

  it('orders same-millisecond fills by insertion id', () => {
    const trades = matchExecutions([
      fill({ id: 2, side: 'sell', qty: 1, fillPrice: 21010, fillAt: at('2026-03-04T14:30:00Z') }),
      fill({ id: 1, side: 'buy', qty: 1, fillPrice: 21000, fillAt: at('2026-03-04T14:30:00Z') }),
    ])

    expect(trades).toHaveLength(1)
    expect(trades[0].direction).toBe('long')
    expect(trades[0].grossPnl).toBe(20)
  })

  it('values an unmatched close from average entry rather than dropping it', () => {
    // A partial export that begins mid-position: the close has no opening lot.
    const trades = matchExecutions([
      fill({ side: 'sell', qty: 1, fillPrice: 21010, fillAt: at('2026-03-04T14:30:00Z') }),
      fill({ side: 'buy', qty: 1, fillPrice: 21000, fillAt: at('2026-03-04T14:35:00Z') }),
    ])

    expect(trades).toHaveLength(1)
    expect(trades[0].direction).toBe('short')
    expect(trades[0].grossPnl).toBe(20)
  })

  it('handles a full round trip on a bond contract in 32nds', () => {
    const trades = matchExecutions([
      fill({ contract: 'ZNZ5', side: 'buy', qty: 1, fillPrice: 110.5, fillAt: at('2026-03-04T14:30:00Z') }),
      fill({ contract: 'ZNZ5', side: 'sell', qty: 1, fillPrice: 110.75, fillAt: at('2026-03-04T14:35:00Z') }),
    ])

    // ZN pointValue is 1000: a quarter point is $250.
    expect(trades[0].grossPnl).toBe(250)
  })
})

describe('risk and R-multiples', () => {
  it('computes currency at risk from a long stop', () => {
    // 20 points of stop on 2 MNQ at $2/point = $80.
    expect(riskFromStop('MNQZ5', 'long', 21000, 20980, 2)).toBe(80)
  })

  it('computes currency at risk from a short stop', () => {
    expect(riskFromStop('MNQZ5', 'short', 21000, 21020, 2)).toBe(80)
  })

  it('returns null when the stop is on the wrong side of entry', () => {
    // A long stopped above its entry is a typo, not a zero-risk trade.
    expect(riskFromStop('MNQZ5', 'long', 21000, 21020, 2)).toBeNull()
    expect(riskFromStop('MNQZ5', 'short', 21000, 20980, 2)).toBeNull()
  })

  it('returns null when the stop equals the entry', () => {
    expect(riskFromStop('MNQZ5', 'long', 21000, 21000, 1)).toBeNull()
  })

  it('yields no R-multiple from an invalid stop', () => {
    expect(rMultiple(100, riskFromStop('MNQZ5', 'long', 21000, 21020, 2))).toBeNull()
  })

  it('expresses P&L as a multiple of risk', () => {
    expect(rMultiple(160, 80)).toBe(2)
    expect(rMultiple(-80, 80)).toBe(-1)
    expect(rMultiple(100, null)).toBeNull()
    expect(rMultiple(100, 0)).toBeNull()
  })
})
