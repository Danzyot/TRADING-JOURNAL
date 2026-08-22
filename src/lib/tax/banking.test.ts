import { describe, expect, it } from 'vitest'
import {
  PAYOUT_RAILS,
  RECEIVING_ACCOUNTS,
  annualSaving,
  conversionCost,
} from './banking'

describe('conversionCost', () => {
  it('costs a conversion at the stated percentage', () => {
    expect(conversionCost(10_000, 2)).toBe(200)
    expect(conversionCost(10_000, 0.5)).toBe(50)
  })

  it('is zero for a non-amount rather than NaN', () => {
    expect(conversionCost(0, 2)).toBe(0)
    expect(conversionCost(-500, 2)).toBe(0)
    expect(conversionCost(Number.NaN, 2)).toBe(0)
  })
})

describe('annualSaving', () => {
  it('is the difference between two accounts on the same volume', () => {
    // A year of $60k in payouts, Israeli bank (2%) vs Wise (0.5%).
    expect(annualSaving(60_000, 2, 0.5)).toBe(900)
  })

  it('never reports a saving for moving to a more expensive account', () => {
    expect(annualSaving(60_000, 0.5, 2)).toBe(0)
  })
})

describe('reference data', () => {
  it('covers every firm the journal tracks payouts for', () => {
    const firms = PAYOUT_RAILS.map((rail) => rail.firm)
    for (const firm of ['Apex Trader Funding', 'Topstep', 'Lucid Trading', 'MyFundedFutures']) {
      expect(firms).toContain(firm)
    }
  })

  it('ranks the specialist accounts below the bank on FX cost', () => {
    const cost = (name: string) =>
      RECEIVING_ACCOUNTS.find((account) => account.name === name)!.fxCostPercent
    expect(cost('Wise')).toBeLessThan(cost('Israeli bank (USD account)'))
    expect(cost('Revolut')).toBeLessThan(cost('Israeli bank (USD account)'))
  })

  it('records that only Wise gives local USD details', () => {
    const withUsd = RECEIVING_ACCOUNTS.filter((account) => account.usdDetails).map((a) => a.name)
    expect(withUsd).toEqual(['Wise'])
  })
})
