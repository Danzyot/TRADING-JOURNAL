import { describe, expect, it } from 'vitest'
import {
  TRAIL_LOCK_ABOVE_START,
  consistencyCheck,
  drawdownState,
  payoutEligibility,
  payoutThreshold,
} from './rules'
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
    payoutMinTradingDays: null,
    planLabel: null,
    minWinningDays: null,
    winningDayMinProfit: null,
    consistencyPercent: null,
    costBase: 0,
    commissionPerContract: 0,
    currentBalance: null,
    balanceUpdatedAt: null,
    openingBalance: null,
    openingBalanceAt: null,
    buffer: null,
    minPayout: null,
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
    const rule = result.requirements.find((entry) => entry.key === 'consistency')
    expect(rule).toMatchObject({ label: 'Consistency rule (20%)', met: false })
    expect(rule?.detail).toContain('30%')
  })

  it('lists every rule that applies, met or not', () => {
    const result = payoutEligibility(
      account({
        payoutMinTradingDays: 5,
        minWinningDays: 5,
        winningDayMinProfit: 250,
        consistencyPercent: 0.5,
        buffer: 2_100,
        minPayout: 500,
      }),
      { ...options, tradingDays: 2 },
    )
    // The firm's own dashboard shows all of them; a list of only the failures
    // cannot say that four of five gates are already cleared.
    expect(result.requirements.map((entry) => entry.key)).toEqual([
      'trading_days',
      'winning_days',
      'consistency',
      'balance',
    ])
    expect(result.requirements.find((entry) => entry.key === 'trading_days')).toMatchObject({
      label: '5 trading days',
      met: false,
      detail: '2 of 5 trading days completed',
    })
    expect(result.requirements.find((entry) => entry.key === 'winning_days')?.label).toBe(
      '5 days with 250+ profit',
    )
  })

  it('does not invent a trading-days rule from the evaluation\'s minimum', () => {
    const result = payoutEligibility(account({ minTradingDays: 15 }), { ...options, tradingDays: 2 })
    expect(result.requirements.some((entry) => entry.key === 'trading_days')).toBe(false)
  })
})

describe('payoutEligibility — buffer and minimum payout', () => {
  const base = {
    tradingDays: 20,
    dailyPnls: [
      { day: '2026-08-03', netPnl: 900 },
      { day: '2026-08-04', netPnl: 800 },
      { day: '2026-08-05', netPnl: 700 },
    ],
    profitSplit: 0.9,
  }

  it('quotes only the profit above the buffer', () => {
    // MyFundedFutures $50k: you may withdraw down to $52,100, not to $50,000.
    const result = payoutEligibility(account({ buffer: 2_100 }), {
      ...base,
      currentEquity: 52_400,
    })
    expect(result.eligible).toBe(true)
    expect(result.withdrawable).toBe(300)
    expect(result.netToTrader).toBe(270)
  })

  it('blocks below the buffer and says how much more is needed', () => {
    const result = payoutEligibility(account({ buffer: 2_100 }), {
      ...base,
      currentEquity: 51_500,
    })
    expect(result.eligible).toBe(false)
    expect(result.requirements.find((entry) => entry.key === 'balance')).toMatchObject({
      met: false,
      detail: '51500 of 52100 (2100 buffer + 0 minimum payout)',
    })
    expect(result.withdrawable).toBe(0)
  })

  it('blocks an amount the firm is too small to process', () => {
    const result = payoutEligibility(account({ buffer: 2_100, minPayout: 500 }), {
      ...base,
      currentEquity: 52_400,
    })
    // The bar is the buffer *and* the firm's minimum: $50,000 + $2,100 + $500.
    expect(result.eligible).toBe(false)
    expect(result.requirements.find((entry) => entry.key === 'balance')?.detail).toBe(
      '52400 of 52600 (2100 buffer + 500 minimum payout)',
    )
  })

  it('counts both the buffer and the minimum toward the first payout', () => {
    // $50k account at $51,000: $1,100 short of the buffer, and $500 more to
    // clear the firm's floor once there.
    const result = payoutEligibility(account({ buffer: 2_100, minPayout: 500 }), {
      ...base,
      currentEquity: 51_000,
    })
    expect(result.toFirstPayout).toBe(1_600)
  })

  it('leaves an account with no buffer exactly as it was', () => {
    const result = payoutEligibility(account(), { ...base, currentEquity: 52_400 })
    expect(result.withdrawable).toBe(2_400)
    expect(result.toFirstPayout).toBe(0)
  })

  it('prefers the account\'s own buffer over the caller\'s fallback', () => {
    const result = payoutEligibility(account({ buffer: 2_100 }), {
      ...base,
      currentEquity: 52_400,
      minProfit: 5_000,
    })
    expect(result.withdrawable).toBe(300)
  })
})

describe('the trailing drawdown stops $100 above the starting balance', () => {
  const history = (...equities: number[]) =>
    equities.map((equity, index) => ({ day: `2026-03-0${index + 1}`, equity }))

  it('locks the floor at start + $100 however far the account runs', () => {
    // $50k account, $2,000 trailing: the line follows to $50,100 and stops.
    // Before this cap it kept climbing — a $55,723 account was reported as
    // breaching at $53,723, which cannot happen on any of these accounts.
    const state = drawdownState(
      account({ startingBalance: 50_000, maxDrawdown: 2_000, drawdownType: 'trailing_eod' }),
      history(51_000, 53_000, 55_723),
    )
    expect(state.line).toBe(50_000 + TRAIL_LOCK_ABOVE_START)
    expect(state.locked).toBe(true)
    expect(state.room).toBe(55_723 - 50_100)
  })

  it('still trails normally below that point', () => {
    const state = drawdownState(
      account({ startingBalance: 50_000, maxDrawdown: 2_000, drawdownType: 'trailing_eod' }),
      history(51_000),
    )
    expect(state.line).toBe(49_000)
    expect(state.locked).toBe(false)
  })

  it('applies to intraday accounts too, from the intraday peak', () => {
    const state = drawdownState(
      account({ startingBalance: 50_000, maxDrawdown: 2_500, drawdownType: 'trailing_intraday' }),
      [{ day: '2026-03-01', equity: 51_000, peakEquity: 60_000 }],
    )
    expect(state.line).toBe(50_100)
  })

  it('leaves a static drawdown where it is', () => {
    const state = drawdownState(
      account({ startingBalance: 50_000, maxDrawdown: 2_000, drawdownType: 'static' }),
      history(58_000),
    )
    expect(state.line).toBe(48_000)
  })

  it('honours an explicit lock point when the account carries one', () => {
    const state = drawdownState(
      account({
        startingBalance: 50_000,
        maxDrawdown: 2_000,
        drawdownType: 'trailing_eod',
        drawdownLocksAt: 50_500,
      }),
      history(60_000),
    )
    expect(state.line).toBe(50_500)
  })
})

describe('payoutThreshold', () => {
  it('is the buffer and the firm minimum on top of the account size', () => {
    // The example that prompted it: $50k, $2,100 buffer, $500 minimum.
    expect(payoutThreshold(account({ startingBalance: 50_000, buffer: 2_100, minPayout: 500 }))).toBe(
      52_600,
    )
  })

  it('falls back to the account size when the firm asks for neither', () => {
    expect(payoutThreshold(account({ startingBalance: 25_000, buffer: null, minPayout: null }))).toBe(
      25_000,
    )
  })
})
