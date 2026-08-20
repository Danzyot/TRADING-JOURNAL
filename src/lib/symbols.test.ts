import { describe, expect, it } from 'vitest'
import { pnlFromPrices, pointValue, rootSymbol, specFor, tickValue } from './symbols'

describe('rootSymbol', () => {
  it('strips Tradovate and Rithmic month/year codes', () => {
    expect(rootSymbol('MNQZ5')).toBe('MNQ')
    expect(rootSymbol('MNQZ25')).toBe('MNQ')
    expect(rootSymbol('ESH6')).toBe('ES')
    expect(rootSymbol('CLM26')).toBe('CL')
  })

  it('handles NinjaTrader spacing', () => {
    expect(rootSymbol('MNQ 12-25')).toBe('MNQ')
    expect(rootSymbol('ES 03-26')).toBe('ES')
  })

  it('handles TradingView notation', () => {
    expect(rootSymbol('/MNQ')).toBe('MNQ')
    expect(rootSymbol('MNQ1!')).toBe('MNQ')
    expect(rootSymbol('MNQ:XCME')).toBe('MNQ')
  })

  it('never confuses a micro with its full-size sibling', () => {
    // Longest-prefix matching: MES must not resolve to ES.
    expect(rootSymbol('MESZ5')).toBe('MES')
    expect(rootSymbol('MNQZ5')).toBe('MNQ')
    expect(rootSymbol('MGCZ5')).toBe('MGC')
    expect(rootSymbol('M2KZ5')).toBe('M2K')
  })

  it('passes through an unrecognised product rather than mangling it', () => {
    expect(rootSymbol('XYZ')).toBe('XYZ')
    expect(rootSymbol('')).toBe('')
  })

  it('strips a month code from an unknown product', () => {
    expect(rootSymbol('ABCZ5')).toBe('ABC')
  })
})

describe('contract specifications', () => {
  it('prices the equity index micros correctly', () => {
    expect(pointValue('MNQ')).toBe(2)
    expect(tickValue('MNQ')).toBe(0.5)
    expect(pointValue('MES')).toBe(5)
    expect(tickValue('MES')).toBe(1.25)
  })

  it('prices the full-size equity index contracts correctly', () => {
    expect(tickValue('ES')).toBe(12.5)
    expect(tickValue('NQ')).toBe(5)
    expect(tickValue('YM')).toBe(5)
    expect(tickValue('RTY')).toBeCloseTo(5, 6)
  })

  it('prices energies and metals correctly', () => {
    expect(tickValue('CL')).toBeCloseTo(10, 6)
    expect(tickValue('MCL')).toBeCloseTo(1, 6)
    expect(tickValue('GC')).toBeCloseTo(10, 6)
    expect(tickValue('MGC')).toBeCloseTo(1, 6)
    expect(tickValue('SI')).toBeCloseTo(25, 6)
  })

  it('prices treasuries in 32nds and 64ths', () => {
    expect(tickValue('ZB')).toBeCloseTo(31.25, 6)
    expect(tickValue('ZN')).toBeCloseTo(15.625, 6)
    expect(tickValue('ZF')).toBeCloseTo(7.8125, 6)
  })

  it('prices FX correctly', () => {
    expect(tickValue('6E')).toBeCloseTo(6.25, 6)
    expect(tickValue('6B')).toBeCloseTo(6.25, 6)
  })

  it('prices grains quoted in cents', () => {
    // Corn: 5,000 bushels means one cent of move is $50, a quarter-cent $12.50.
    expect(tickValue('ZC')).toBeCloseTo(12.5, 6)
    expect(tickValue('ZW')).toBeCloseTo(12.5, 6)
  })

  it('groups micros with their full-size family', () => {
    expect(specFor('MNQ')?.family).toBe(specFor('NQ')?.family)
    expect(specFor('MNQ')?.micro).toBe(true)
    expect(specFor('NQ')?.micro).toBe(false)
  })
})

describe('pnlFromPrices', () => {
  it('is symmetric between long and short', () => {
    const long = pnlFromPrices('MNQ', 'long', 21000, 21010, 1)
    const short = pnlFromPrices('MNQ', 'short', 21000, 21010, 1)
    expect(long).toBe(20)
    expect(short).toBe(-20)
  })

  it('scales with quantity', () => {
    expect(pnlFromPrices('MES', 'long', 5800, 5801, 3)).toBe(15)
  })
})
