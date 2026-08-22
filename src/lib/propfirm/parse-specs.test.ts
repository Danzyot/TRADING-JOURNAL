import { describe, expect, it } from 'vitest'
import {
  parseContracts,
  parseDays,
  parseDrawdownType,
  parseMoney,
  parsePercent,
  parseSize,
  parseSplit,
  parseWinningDayMinimum,
} from './parse-specs'

/** Every string below is taken verbatim from a real firm's published specs. */

describe('parseMoney', () => {
  it('reads the amounts firms quote', () => {
    expect(parseMoney('$1,250')).toBe(1250)
    expect(parseMoney('$98.00')).toBe(98)
    expect(parseMoney('FREE')).toBe(0)
  })

  it('keeps "no such rule" distinct from zero', () => {
    // A plan with no daily loss limit and one with a $0 limit are opposites;
    // collapsing them into 0 invents a rule the trader never had.
    expect(parseMoney('None')).toBeNull()
    expect(parseMoney('—')).toBeNull()
    expect(parseMoney('')).toBeNull()
    expect(parseMoney(undefined)).toBeNull()
  })
})

describe('parsePercent', () => {
  it('reads a consistency rule as a fraction', () => {
    expect(parsePercent('50%')).toBe(0.5)
    expect(parsePercent('40%')).toBe(0.4)
  })

  it('is null when the rule does not exist', () => {
    expect(parsePercent('None')).toBeNull()
    expect(parsePercent('—')).toBeNull()
  })
})

describe('parseSplit', () => {
  it('reads both ways firms write a split', () => {
    expect(parseSplit('90 / 10')).toBe(0.9)
    expect(parseSplit('90%')).toBe(0.9)
    expect(parseSplit('80 / 20')).toBe(0.8)
  })

  it('ignores an unstated split', () => {
    expect(parseSplit('—')).toBeNull()
  })
})

describe('parseDrawdownType', () => {
  it('separates the two that behave differently', () => {
    expect(parseDrawdownType('Intraday trailing')).toBe('trailing_intraday')
    expect(parseDrawdownType('EOD trailing')).toBe('trailing_eod')
    expect(parseDrawdownType('End of day')).toBe('trailing_eod')
  })

  it('falls back sensibly', () => {
    expect(parseDrawdownType('Static')).toBe('static')
    expect(parseDrawdownType('Trailing')).toBe('trailing_eod')
    expect(parseDrawdownType('—')).toBe('none')
  })
})

describe('parseContracts', () => {
  it('splits minis from micros', () => {
    expect(parseContracts('2 mini / 20 micro')).toEqual({ mini: 2, micro: 20 })
    expect(parseContracts('10 mini / 100 micro')).toEqual({ mini: 10, micro: 100 })
  })

  it('reads a single quoted limit as minis', () => {
    expect(parseContracts('12 contracts')).toEqual({ mini: 12, micro: null })
  })

  it('is empty when unlimited or unstated', () => {
    expect(parseContracts('—')).toEqual({ mini: null, micro: null })
    expect(parseContracts('Unlimited')).toEqual({ mini: null, micro: null })
  })
})

describe('parseDays and parseWinningDayMinimum', () => {
  it('reads the day count and the profit each day must clear', () => {
    expect(parseDays('2 days')).toBe(2)
    expect(parseDays('5 days of $100+')).toBe(5)
    expect(parseWinningDayMinimum('5 days of $100+')).toBe(100)
    expect(parseWinningDayMinimum('5 days of $250+')).toBe(250)
  })

  it('treats "pass in one day" as no minimum', () => {
    expect(parseDays('None — pass in 1 day')).toBeNull()
  })
})

describe('parseSize', () => {
  it('reads the sizes firms sell', () => {
    expect(parseSize('25K')).toBe(25000)
    expect(parseSize('150K')).toBe(150000)
    expect(parseSize('$50,000')).toBe(50000)
  })
})
