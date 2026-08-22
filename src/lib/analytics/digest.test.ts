import { describe, expect, it } from 'vitest'
import { buildDigest, record, type WeekStats } from './digest'

const week: WeekStats = {
  evalPnl: 300,
  fundedPnl: 940,
  wins: 12,
  losses: 8,
  passed: 2,
  failed: 1,
  payoutCount: 2,
  payoutTotal: 3000,
  expenses: 450,
}

const base = { currency: 'USD', today: null, week: null } as const

describe('record', () => {
  it('reads as W/L and a percentage', () => {
    expect(record(3, 2)).toBe('3W/2L (60%)')
    expect(record(1, 0)).toBe('1W/0L (100%)')
  })

  it('says nothing when nothing closed', () => {
    expect(record(0, 0)).toBeNull()
  })
})

describe('buildDigest', () => {
  it('never speaks in the morning — the inbox pushes its own news', () => {
    expect(
      buildDigest({
        ...base,
        slot: 'morning',
        isFriday: true,
        today: { pnl: 430, wins: 3, losses: 2, trades: 5 },
        week,
      }),
    ).toBeNull()
  })

  it('reports the day when it was traded', () => {
    const digest = buildDigest({
      ...base,
      slot: 'evening',
      isFriday: false,
      today: { pnl: 430, wins: 3, losses: 2, trades: 5 },
    })

    expect(digest?.title).toBe('Evening check')
    expect(digest?.body).toBe('Today +$430 · 5 trades · 3W/2L (60%)')
  })

  it('shows a losing day as a loss, not a negative-of-a-negative', () => {
    const digest = buildDigest({
      ...base,
      slot: 'evening',
      isFriday: false,
      today: { pnl: -215, wins: 1, losses: 3, trades: 4 },
    })
    expect(digest?.body).toContain('Today −$215')
    expect(digest?.body).toContain('1W/3L (25%)')
  })

  it('stays silent on an untraded, non-Friday evening', () => {
    expect(buildDigest({ ...base, slot: 'evening', isFriday: false, today: null })).toBeNull()
    expect(
      buildDigest({
        ...base,
        slot: 'evening',
        isFriday: false,
        today: { pnl: 0, wins: 0, losses: 0, trades: 0 },
      }),
    ).toBeNull()
  })

  it('wraps the week on Friday, split between evals and funded', () => {
    const digest = buildDigest({
      ...base,
      slot: 'evening',
      isFriday: true,
      today: { pnl: 120, wins: 2, losses: 1, trades: 3 },
      week,
    })

    expect(digest?.title).toBe('Friday wrap')
    const lines = digest!.body.split('\n')
    expect(lines[0]).toBe('Today +$120 · 3 trades · 2W/1L (67%)')
    expect(lines[1]).toBe('Week +$1,240 — evals +$300, funded +$940')
    expect(lines[2]).toBe('12W/8L (60%) · 2 passed, 1 failed')
    expect(lines[3]).toBe('Payouts $3,000 (2) · Costs $450 · Net +$2,550')
    expect(digest?.url).toBe('/analytics')
  })

  it('wraps a Friday with no trades but real money movement', () => {
    const digest = buildDigest({
      ...base,
      slot: 'evening',
      isFriday: true,
      today: null,
      week: { ...week, wins: 0, losses: 0, evalPnl: 0, fundedPnl: 0 },
    })

    expect(digest?.title).toBe('Friday wrap')
    expect(digest?.body).toContain('Payouts $3,000 (2)')
    expect(digest?.body).not.toContain('W/')
  })

  it('stays silent on a Friday where nothing happened at all', () => {
    expect(
      buildDigest({
        ...base,
        slot: 'evening',
        isFriday: true,
        today: null,
        week: {
          evalPnl: 0,
          fundedPnl: 0,
          wins: 0,
          losses: 0,
          passed: 0,
          failed: 0,
          payoutCount: 0,
          payoutTotal: 0,
          expenses: 0,
        },
      }),
    ).toBeNull()
  })

  it('nets costs against payouts rather than reporting them separately', () => {
    const digest = buildDigest({
      ...base,
      slot: 'evening',
      isFriday: true,
      today: null,
      week: { ...week, payoutTotal: 400, expenses: 900 },
    })
    expect(digest?.body).toContain('Net −$500')
  })
})
