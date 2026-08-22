import { describe, expect, it } from 'vitest'
import { accountEquity, balanceAnchor, profitAboveStart } from './balance'

function account(overrides: Partial<Parameters<typeof balanceAnchor>[0]> = {}) {
  return {
    startingBalance: 50_000,
    openingBalance: null,
    openingBalanceAt: null,
    currentBalance: null,
    balanceUpdatedAt: null,
    ...overrides,
  }
}

const trade = (tradingDay: string, netPnl: number) => ({ tradingDay, netPnl })

describe('balanceAnchor', () => {
  it('falls back to the account size, which precedes every trade', () => {
    expect(balanceAnchor(account())).toEqual({ balance: 50_000, asOf: null, source: 'start' })
  })

  it('prefers a stated balance over the account size', () => {
    const anchor = balanceAnchor(
      account({ openingBalance: 52_300, openingBalanceAt: '2026-08-14' }),
    )
    expect(anchor).toEqual({ balance: 52_300, asOf: '2026-08-14', source: 'manual' })
  })

  it('ignores a stated balance with no date — it cannot say what it includes', () => {
    const anchor = balanceAnchor(account({ openingBalance: 52_300, openingBalanceAt: null }))
    expect(anchor.source).toBe('start')
  })

  it('ignores a sync balance with no timestamp, for the same reason', () => {
    const anchor = balanceAnchor(account({ currentBalance: 51_000, balanceUpdatedAt: null }))
    expect(anchor.source).toBe('start')
  })

  it('takes whichever balance was stated later', () => {
    const synced = balanceAnchor(
      account({
        openingBalance: 52_300,
        openingBalanceAt: '2026-08-14',
        currentBalance: 51_800,
        balanceUpdatedAt: new Date('2026-08-20T13:00:00Z'),
      }),
    )
    expect(synced).toEqual({ balance: 51_800, asOf: '2026-08-20', source: 'sync' })

    const stale = balanceAnchor(
      account({
        openingBalance: 52_300,
        openingBalanceAt: '2026-08-21',
        currentBalance: 51_800,
        balanceUpdatedAt: new Date('2026-08-20T13:00:00Z'),
      }),
    )
    expect(stale.source).toBe('manual')
  })

  it('lets the trader win a tie on the same day', () => {
    // They typed it knowing what the sync said, so theirs is the later word.
    const anchor = balanceAnchor(
      account({
        openingBalance: 52_300,
        openingBalanceAt: '2026-08-20',
        currentBalance: 51_800,
        balanceUpdatedAt: new Date('2026-08-20T13:00:00Z'),
      }),
    )
    expect(anchor).toEqual({ balance: 52_300, asOf: '2026-08-20', source: 'manual' })
  })
})

describe('accountEquity', () => {
  it('adds every trade when there is nothing but the account size', () => {
    const result = accountEquity(account(), [trade('2026-08-10', 400), trade('2026-08-11', -150)])
    expect(result.equity).toBe(50_250)
    expect(result.countedTrades).toBe(2)
    expect(result.ignoredTrades).toBe(0)
  })

  it('counts only trades after the anchor, so nothing is double-counted', () => {
    // The $52,300 already contains June and July. Adding those trades again
    // would report the summer's profit twice.
    const result = accountEquity(
      account({ openingBalance: 52_300, openingBalanceAt: '2026-08-14' }),
      [trade('2026-06-02', 900), trade('2026-07-20', 1_400), trade('2026-08-15', 250)],
    )
    expect(result.equity).toBe(52_550)
    expect(result.countedPnl).toBe(250)
    expect(result.countedTrades).toBe(1)
    expect(result.ignoredTrades).toBe(2)
  })

  it('excludes trades on the anchor day itself', () => {
    // "It was $52,300 at the close of the 14th" — the 14th's trading is in it.
    const result = accountEquity(
      account({ openingBalance: 52_300, openingBalanceAt: '2026-08-14' }),
      [trade('2026-08-14', 800), trade('2026-08-17', 100)],
    )
    expect(result.equity).toBe(52_400)
    expect(result.ignoredTrades).toBe(1)
  })

  it('keeps moving as new trades land, rather than freezing at the entered figure', () => {
    // The bug this replaces: a bare currentBalance froze equity at whatever
    // was typed, so the account read the same after a $1,200 day.
    const acct = account({ openingBalance: 52_300, openingBalanceAt: '2026-08-14' })
    expect(accountEquity(acct, []).equity).toBe(52_300)
    expect(accountEquity(acct, [trade('2026-08-18', 1_200)]).equity).toBe(53_500)
  })

  it('handles an account that is down since the anchor', () => {
    const result = accountEquity(
      account({ openingBalance: 52_300, openingBalanceAt: '2026-08-14' }),
      [trade('2026-08-15', -2_800)],
    )
    expect(result.equity).toBe(49_500)
    expect(profitAboveStart(account(), result.equity)).toBe(-500)
  })
})

describe('profitAboveStart', () => {
  it('measures against the account size, not against the anchor', () => {
    // What the firm's buffer, profit target and payout all key off.
    const acct = account({ openingBalance: 52_300, openingBalanceAt: '2026-08-14' })
    const { equity } = accountEquity(acct, [trade('2026-08-15', 250)])
    expect(profitAboveStart(acct, equity)).toBe(2_550)
  })
})
