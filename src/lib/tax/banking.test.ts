import { describe, expect, it } from 'vitest'
import { ACCOUNT_LAYERS, RAILS, annualRailPenalty, compareRails, railCost } from './banking'

describe('railCost', () => {
  it('prices a payout on each rail', () => {
    const usdc = RAILS.find((rail) => rail.name.includes('USDC'))!
    const paypal = RAILS.find((rail) => rail.name.includes('PayPal'))!

    // The numbers that decide the question: $2,000 costs single digits on
    // stablecoin and ~$70 through PayPal.
    expect(railCost(2000, usdc)).toBeCloseTo(6, 0)
    expect(railCost(2000, paypal)).toBeCloseTo(70, 0)
  })

  it('is zero for a non-payout rather than charging a flat fee on nothing', () => {
    expect(railCost(0, RAILS[0])).toBe(0)
    expect(railCost(-100, RAILS[0])).toBe(0)
  })
})

describe('compareRails', () => {
  it('puts PayPal last at every payout size worth collecting', () => {
    for (const amount of [1000, 2000, 5000, 20000]) {
      const ranked = compareRails(amount)
      expect(ranked[ranked.length - 1].rail.name).toContain('PayPal')
    }
  })

  it('shows the flat fees biting hardest on a small payout', () => {
    // Worth knowing rather than smoothing over: on $500 the $20 USD leg costs
    // more than PayPal's 3.5%. Percentages beat flat fees at the bottom, and
    // lose at the top — which is why the cheapest rail is the one that is
    // barely either.
    const ranked = compareRails(500)
    const paypal = ranked.find((entry) => entry.rail.name.includes('PayPal'))!
    const usdLeg = ranked.find((entry) => entry.rail.name.includes('USD → Wise'))!
    expect(paypal.cost).toBeLessThan(usdLeg.cost)
  })

  it('crosses over between the two cheap rails at a few hundred dollars', () => {
    // Direct-to-Wise is pure percentage, stablecoin is a small flat fee plus a
    // smaller percentage — so the flat fee dominates on tiny payouts and the
    // percentage dominates on large ones. Both beat everything else either
    // way; which of the two leads depends on size.
    const lead = (amount: number) => compareRails(amount)[0].rail.name
    expect(lead(300)).toContain('Wise directly')
    expect(lead(2000)).toContain('USDC')
    expect(lead(10000)).toContain('USDC')
  })

  it('shows the flat-fee rail overtaking the percentage one as size grows', () => {
    // Rise EUR-direct is cheaper on a small payout; the $20 USD leg wins once
    // the 1.15% margin outgrows it.
    const cost = (amount: number, needle: string) =>
      compareRails(amount).find((entry) => entry.rail.name.includes(needle))!.cost

    expect(cost(500, 'EUR bank')).toBeLessThan(cost(500, 'USD → Wise'))
    expect(cost(5000, 'USD → Wise')).toBeLessThan(cost(5000, 'EUR bank'))
  })
})

describe('annualRailPenalty', () => {
  it('is what a year on the worst rail costs over the best', () => {
    // Twelve payouts totalling $24,000 — $2,000 each.
    const penalty = annualRailPenalty(24_000, 12)
    expect(penalty).toBeGreaterThan(700)
    expect(penalty).toBeLessThan(800)
  })

  it('is nothing without payouts', () => {
    expect(annualRailPenalty(0, 0)).toBe(0)
    expect(annualRailPenalty(5000, 0)).toBe(0)
  })
})

describe('the layers', () => {
  it('runs one to four, each with its own failure to guard against', () => {
    expect(ACCOUNT_LAYERS.map((layer) => layer.layer)).toEqual([1, 2, 3, 4])
    for (const layer of ACCOUNT_LAYERS) expect(layer.watchOut.length).toBeGreaterThan(20)
  })
})
