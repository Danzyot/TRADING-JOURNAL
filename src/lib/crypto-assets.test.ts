import { describe, expect, it } from 'vitest'
import {
  addressLooksValid,
  explorerAddressUrl,
  explorerTxUrl,
  fiatValue,
  isCryptoCurrency,
  isStablecoin,
  shorten,
} from './crypto-assets'

describe('recognising crypto', () => {
  it('knows the assets firms actually settle in', () => {
    expect(isCryptoCurrency('USDC')).toBe(true)
    expect(isCryptoCurrency('usdt')).toBe(true)
    expect(isCryptoCurrency('BTC')).toBe(true)
  })

  it('does not mistake fiat for crypto', () => {
    expect(isCryptoCurrency('USD')).toBe(false)
    expect(isCryptoCurrency('EUR')).toBe(false)
    expect(isCryptoCurrency(null)).toBe(false)
  })

  it('separates stablecoins, whose fiat value is ~1:1', () => {
    expect(isStablecoin('USDC')).toBe(true)
    expect(isStablecoin('BTC')).toBe(false)
  })
})

describe('explorer links', () => {
  it('links a hash on the chain it actually moved on', () => {
    expect(explorerTxUrl('arbitrum', '0xabc')).toBe('https://arbiscan.io/tx/0xabc')
    expect(explorerTxUrl('tron', 'abc123')).toBe('https://tronscan.org/#/transaction/abc123')
    expect(explorerAddressUrl('solana', 'So11')).toBe('https://solscan.io/account/So11')
  })

  it('returns nothing rather than a broken link', () => {
    expect(explorerTxUrl('arbitrum', '')).toBeNull()
    expect(explorerTxUrl(null, '0xabc')).toBeNull()
    expect(explorerTxUrl('not-a-chain', '0xabc')).toBeNull()
  })
})

describe('addressLooksValid', () => {
  it('accepts a well-formed address for its chain', () => {
    expect(addressLooksValid('arbitrum', '0x' + 'a'.repeat(40))).toBe(true)
    expect(addressLooksValid('tron', 'T' + 'a'.repeat(33))).toBe(true)
    expect(addressLooksValid('bitcoin', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true)
  })

  it('catches the mistake that actually happens — right address, wrong chain', () => {
    // An EVM address pasted against Tron, or a truncated paste.
    expect(addressLooksValid('tron', '0x' + 'a'.repeat(40))).toBe(false)
    expect(addressLooksValid('arbitrum', '0x' + 'a'.repeat(20))).toBe(false)
  })
})

describe('shorten', () => {
  it('trims a long hash for display but leaves short values alone', () => {
    expect(shorten('0x1234567890abcdef1234')).toBe('0x1234…1234')
    expect(shorten('short')).toBe('short')
  })
})

describe('fiatValue', () => {
  it('multiplies the amount by the rate that actually settled', () => {
    expect(fiatValue(1500, 1)).toBe(1500)
    expect(fiatValue(0.05, 62_000)).toBe(3100)
  })

  it('is zero rather than NaN for missing inputs', () => {
    expect(fiatValue(Number.NaN, 1)).toBe(0)
    expect(fiatValue(100, Number.NaN)).toBe(0)
  })
})
