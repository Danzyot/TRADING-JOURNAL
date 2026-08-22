import { describe, expect, it } from 'vitest'
import { deriveSetup } from './setup'

describe('deriveSetup — filling in what is missing', () => {
  it('measures the distances when prices are given', () => {
    const setup = deriveSetup({ entryPrice: 20_100, stopPrice: 20_080, targetPrice: 20_160 })
    expect(setup.direction).toBe('long')
    expect(setup.stopPoints).toBe(20)
    expect(setup.targetPoints).toBe(60)
    expect(setup.riskReward).toBe(3)
    expect(setup.warnings).toEqual([])
  })

  it('places the levels when only distances are given', () => {
    const setup = deriveSetup({
      direction: 'long',
      entryPrice: 20_100,
      stopPoints: 20,
      targetPoints: 60,
    })
    expect(setup.stopPrice).toBe(20_080)
    expect(setup.targetPrice).toBe(20_160)
    expect(setup.riskReward).toBe(3)
  })

  it('places them the other way for a short', () => {
    const setup = deriveSetup({
      direction: 'short',
      entryPrice: 20_100,
      stopPoints: 20,
      targetPoints: 60,
    })
    expect(setup.stopPrice).toBe(20_120)
    expect(setup.targetPrice).toBe(20_040)
  })

  it('reads the direction off the stop, not the target', () => {
    // A target can sit either side while the trade is still being thought
    // through; a stop below the entry is a long, always.
    expect(deriveSetup({ entryPrice: 100, stopPrice: 90 }).direction).toBe('long')
    expect(deriveSetup({ entryPrice: 100, stopPrice: 110 }).direction).toBe('short')
  })

  it('handles fractional prices without drifting', () => {
    const setup = deriveSetup({ entryPrice: 6_012.25, stopPrice: 6_009.5, targetPrice: 6_020.5 })
    expect(setup.stopPoints).toBe(2.75)
    expect(setup.targetPoints).toBe(8.25)
    expect(setup.riskReward).toBe(3)
  })
})

describe('deriveSetup — disagreements', () => {
  it('trusts the prices and says so when the points contradict them', () => {
    const setup = deriveSetup({
      entryPrice: 20_100,
      stopPrice: 20_080,
      stopPoints: 45,
      targetPrice: 20_160,
    })
    expect(setup.stopPoints).toBe(20)
    expect(setup.warnings.join(' ')).toContain('45 points by your figure but 20 from the prices')
  })

  it('flags a stop on the wrong side of the entry', () => {
    const setup = deriveSetup({ direction: 'long', entryPrice: 20_100, stopPrice: 20_150 })
    expect(setup.warnings.join(' ')).toContain('wrong side of a long entry')
  })

  it('flags a risk-reward that does not match the distances', () => {
    const setup = deriveSetup({
      entryPrice: 20_100,
      stopPrice: 20_080,
      targetPrice: 20_160,
      riskReward: 5,
    })
    // The typed figure is kept — it is what the trader meant to record — but
    // it is never quietly reconciled with the points.
    expect(setup.riskReward).toBe(5)
    expect(setup.warnings.join(' ')).toContain('which is 3')
  })

  it('flags a stop that risks nothing', () => {
    const setup = deriveSetup({ entryPrice: 20_100, stopPrice: 20_100, targetPrice: 20_160 })
    expect(setup.warnings.join(' ')).toContain('risks nothing')
    expect(setup.riskReward).toBeNull()
  })

  it('takes the absolute value of a negative distance and says so', () => {
    const setup = deriveSetup({ direction: 'long', entryPrice: 20_100, stopPoints: -20 })
    expect(setup.stopPoints).toBe(20)
    expect(setup.stopPrice).toBe(20_080)
    expect(setup.warnings.join(' ')).toContain('cannot be negative')
  })
})

describe('deriveSetup — partial input', () => {
  it('returns what it has without inventing the rest', () => {
    const setup = deriveSetup({ entryPrice: 20_100 })
    expect(setup).toMatchObject({
      entryPrice: 20_100,
      stopPrice: null,
      stopPoints: null,
      targetPrice: null,
      targetPoints: null,
      riskReward: null,
      direction: null,
    })
    expect(setup.warnings).toEqual([])
  })

  it('cannot place a level without knowing the direction', () => {
    const setup = deriveSetup({ entryPrice: 20_100, stopPoints: 20 })
    expect(setup.stopPrice).toBeNull()
    expect(setup.stopPoints).toBe(20)
  })

  it('survives an entirely empty setup', () => {
    const setup = deriveSetup({})
    expect(setup.riskReward).toBeNull()
    expect(setup.warnings).toEqual([])
  })
})
