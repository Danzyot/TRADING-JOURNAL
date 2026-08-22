import { describe, expect, it } from 'vitest'
import { firmArt, firmArtKey } from './firm-art'

describe('firm logos', () => {
  it('finds a firm however its name is spaced or cased', () => {
    for (const name of ['MyFundedFutures', 'My Funded Futures', 'my funded futures', 'MFFU']) {
      expect(firmArt(name).mark).toBe('/firms/myfundedfutures-mark.webp')
    }
  })

  it('follows the short names people actually type', () => {
    expect(firmArt('Apex').mark).toBe(firmArt('Apex Trader Funding').mark)
    expect(firmArt('TPT').wordmark).toBe(firmArt('Take Profit Trader').wordmark)
    expect(firmArt('Lucid').mark).toBe(firmArt('Lucid Trading').mark)
    expect(firmArt('FundedNext Futures').mark).toBe(firmArt('FundedNext').mark)
  })

  it('has both shapes for Topstep', () => {
    expect(firmArt('Topstep').wordmark).toBe('/firms/topstep-wordmark.png')
    expect(firmArt('Topstep').mark).toBe('/firms/topstep-mark.png')
  })

  it('has nothing for a firm nobody sent a logo for', () => {
    expect(firmArt('Bulenox')).toEqual({})
    expect(firmArt('Some Firm I Invented')).toEqual({})
    expect(firmArt('')).toEqual({})
    expect(firmArt(null)).toEqual({})
  })

  it('normalises punctuation out of the key', () => {
    expect(firmArtKey('Take-Profit Trader!')).toBe('takeprofittrader')
  })

  it('points every entry at a file under /firms/', () => {
    for (const name of [
      'Lucid',
      'MFFU',
      'Apex',
      'TPT',
      'FundedNext',
      'Alpha Futures',
      'Tradeify',
      'Topstep',
    ]) {
      const art = firmArt(name)
      expect(art.mark).toMatch(/^\/firms\/[\w-]+\.(png|jpeg|webp)$/)
      expect(art.wordmark).toMatch(/^\/firms\/[\w-]+\.(png|jpeg|webp)$/)
    }
  })
})
