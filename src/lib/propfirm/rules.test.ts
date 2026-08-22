import { describe, expect, it } from 'vitest'
import { consistencyCheck, drawdownState, payoutEligibility } from './rules'
import type { Account } from '@/db/schema'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    firmId: null,
    label: 'Test 50k',
    externalId: null,
    platform: 'tradovate',
    phase: 'funded',
    status: 'active',
    currency: 'USD',
    startingBalance: 50_000,
    profitTarget: 3_000,
    maxDrawdown: 2_500,
    drawdownType: 'trailing_eod',
    drawdownLocksAt: null,
    dailyLossLimit: null,
    maxContracts: null,
    maxMicroContracts: null,
    profitSplit: null,
    payoutPolicy: null,
    minTradingDays: null,
    planLabel: null,
    minWinningDays: null,
    winningDayMinProfit: null,
    consistencyPercent: null,
    costBase: 0,
    commissionPerContract: 0,
    currentBalance: null,
    balanceUpdatedAt: null,
    startedOn: null,
    endedOn: null,
    notes: null,
    excludeFromStats: false,
    createdAt: new Date(),
    ...overrides,
  }
}

const day = (day: string, equity: number) => ({ day, equity })

describe('drawdownState', () => {
  it('trails the end-of-day high-water mark', () => {
    const state = drawdownState(account(), [
      day('2026-03-01', 51_000),
      day('2026-03-02', 50_400),
    ])
    // High water 51,000 - 2,500 allowance = 48,500 line.
    expect(state.line).toBe(48_500)
    expect(state.room).toBe(50_400 - 48_500)
    expect(state.breached).toBe(false)
  })

  it('gives back room only until the line, never past it', () => {
    const state = drawdownState(account(), [
      day('2026-03-01', 51_000),
      day('2026-03-02', 48_400),
    ])
    expect(state.breached).toBe(true)
    expect(state.room).toBeLessThanOrEqual(0)
  })

  it('locks the trailing line at the configured equity', () => {
    const state = drawdownState(account({ drawdownLocksAt: 50_100 }), [
      day('2026-03-01', 53_000),
      day('2026-03-02', 56_000),
    ])
    // The line froze at 50,100 despite equity running to 56,000.
    expect(state.locked).toBe(true)
    expect(state.line).toBe(50_100)
  })

  it('keeps a static drawdown line fixed below the start', () => {
    const state = drawdownState(account({ drawdownType: 'static' }), [
      day('2026-03-01', 55_000),
      day('2026-03-02', 49_000),
    ])
    expect(state.line).toBe(47_500)
    expect(state.breached).toBe(false)
  })

  it('reports unlimited room when no drawdown is configured', () => {
    const state = drawdownState(account({ drawdownType: 'none', maxDrawdown: null }), [
      day('2026-03-01', 45_000),
    ])
    expect(state.room).toBe(Infinity)
    expect(state.breached).toBe(false)
  })
})

describe('consistencyCheck', () => {
  it('passes when the best day is within the threshold', () => {
    const result = consistencyCheck(
      [
        { day: '2026-03-01', netPnl: 400 },
        { day: '2026-03-02', netPnl: 300 },
        { day: '2026-03-03', netPnl: 300 },
      ],
      0.5,
    )
    expect(result.passes).toBe(true)
  })

  it('fails when one day dominates, and quantifies the shortfall', () => {
    const result = consistencyCheck(
      [
        { day: '2026-03-01', netPnl: 900 },
        { day: '2026-03-02', netPnl: 100 },
      ],
      0.3,
    )
    expect(result.passes).toBe(false)
    // 900 / 0.3 = 3,000 total needed; currently 1,000.
    expect(result.profitNeeded).toBe(2_000)
  })

  it('ignores losing days when computing the share', () => {
    const result = consistencyCheck(
      [
        { day: '2026-03-01', netPnl: 500 },
        { day: '2026-03-02', netPnl: -400 },
        { day: '2026-03-03', netPnl: 500 },
      ],
      0.5,
    )
    expect(result.passes).toBe(true)
  })

  it('does not apply without a threshold or without profit', () => {
    expect(consistencyCheck([{ day: 'd', netPnl: 100 }], null).applies).toBe(false)
    expect(consistencyCheck([{ day: 'd', netPnl: -100 }], 0.3).applies).toBe(false)
  })
})

describe('payoutEligibility', () => {
  const options = {
    currentEquity: 52_000,
    tradingDays: 10,
    dailyPnls: [
      { day: '2026-03-01', netPnl: 600 },
      { day: '2026-03-02', netPnl: 500 },
      { day: '2026-03-03', netPnl: 400 },
      { day: '2026-03-04', netPnl: 300 },
      { day: '2026-03-05', netPnl: 200 },
    ],
    profitSplit: 0.9,
  }

  it('is eligible when every configured rule passes', () => {
    const result = payoutEligibility(account(), options)
    expect(result.eligible).toBe(true)
    expect(result.withdrawable).toBe(2_000)
    expect(result.netToTrader).toBe(1_800)
  })

  it('blocks an evaluation account', () => {
    const result = payoutEligibility(account({ phase: 'eval' }), options)
    expect(result.eligible).toBe(false)
    expect(result.blockers.join(' ')).toContain('evaluation')
  })

  it('blocks below the minimum trading days', () => {
    const result = payoutEligibility(account({ minTradingDays: 15 }), options)
    expect(result.blockers.join(' ')).toContain('10 of 15')
  })

  it('enforces the winning-days gate with a profit threshold', () => {
    // 5 winning days exist, but only 3 cleared $350.
    const result = payoutEligibility(
      account({ minWinningDays: 5, winningDayMinProfit: 350 }),
      options,
    )
    expect(result.eligible).toBe(false)
    expect(result.blockers.join(' ')).toContain('3 of 5')
  })

  it('passes the winning-days gate when enough days clear the bar', () => {
    const result = payoutEligibility(
      account({ minWinningDays: 5, winningDayMinProfit: 150 }),
      options,
    )
    expect(result.eligible).toBe(true)
  })

  it('does not count a break-even or losing day as winning', () => {
    const result = payoutEligibility(account({ minWinningDays: 6 }), {
      ...options,
      dailyPnls: [...options.dailyPnls, { day: '2026-03-06', netPnl: 0 }],
    })
    // The zero day must not count: still 5 of 6.
    expect(result.blockers.join(' ')).toContain('5 of 6')
  })

  it('blocks an account below its starting balance', () => {
    const result = payoutEligibility(account(), { ...options, currentEquity: 49_500 })
    expect(result.eligible).toBe(false)
    expect(result.withdrawable).toBe(0)
  })

  it('applies the consistency rule at payout time', () => {
    const result = payoutEligibility(account({ consistencyPercent: 0.2 }), options)
    // Best day 600 of 2,000 total = 30%, above the 20% cap.
    expect(result.eligible).toBe(false)
    expect(result.blockers.join(' ')).toContain('Consistency')
  })
})
