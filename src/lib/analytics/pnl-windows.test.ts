import { describe, expect, it } from 'vitest'
import { boundariesFor, hasOther, pnlByPeriod, splitFor } from './pnl-windows'

const trade = (tradingDay: string, netPnl: number, phase: string) => ({ tradingDay, netPnl, phase })

describe('splitFor', () => {
  it('keeps evaluation profit apart from money that can be withdrawn', () => {
    const split = splitFor([
      trade('2026-08-20', 500, 'eval'),
      trade('2026-08-20', 300, 'funded'),
      trade('2026-08-20', 200, 'live'),
    ])

    expect(split).toEqual({ evaluation: 500, funded: 500, other: 0, total: 1000 })
  })

  it('puts personal and demo accounts in their own column so the row still adds up', () => {
    const split = splitFor([
      trade('2026-08-20', 100, 'eval'),
      trade('2026-08-20', 50, 'personal'),
      trade('2026-08-20', 25, 'demo'),
    ])

    expect(split.evaluation).toBe(100)
    expect(split.other).toBe(75)
    expect(split.evaluation + split.funded + split.other).toBe(split.total)
  })

  it('handles losses', () => {
    const split = splitFor([trade('2026-08-20', -400, 'eval'), trade('2026-08-20', 150, 'funded')])
    expect(split).toEqual({ evaluation: -400, funded: 150, other: 0, total: -250 })
  })

  it('is all zeros with no trades', () => {
    expect(splitFor([])).toEqual({ evaluation: 0, funded: 0, other: 0, total: 0 })
  })
})

describe('pnlByPeriod', () => {
  const boundaries = boundariesFor('2026-08-20') // a Thursday
  const trades = [
    trade('2026-08-20', 100, 'funded'), // today
    trade('2026-08-18', 200, 'eval'), // this week (Sunday-start)
    trade('2026-08-05', 300, 'funded'), // this month
    trade('2026-03-02', 400, 'eval'), // this year
    trade('2025-11-11', 500, 'funded'), // earlier
  ]

  it('nests the periods, each including the ones inside it', () => {
    const periods = pnlByPeriod(trades, boundaries)
    const total = (key: string) => periods.find((period) => period.key === key)!.split.total

    expect(total('today')).toBe(100)
    expect(total('week')).toBe(300)
    expect(total('month')).toBe(600)
    expect(total('year')).toBe(1000)
    expect(total('all')).toBe(1500)
  })

  it('splits every period, not just the total', () => {
    const year = pnlByPeriod(trades, boundaries).find((period) => period.key === 'year')!.split
    expect(year.evaluation).toBe(600)
    expect(year.funded).toBe(400)
  })

  it('labels the periods for display', () => {
    expect(pnlByPeriod([], boundaries).map((period) => period.label)).toEqual([
      'Today',
      'This week',
      'This month',
      'This year',
      'All time',
    ])
  })
})

describe('boundariesFor', () => {
  it('starts the week on Sunday', () => {
    // 2026-08-20 is a Thursday; its week began Sunday the 16th.
    expect(boundariesFor('2026-08-20').weekStart).toBe('2026-08-16')
    // A Sunday is its own week start.
    expect(boundariesFor('2026-08-16').weekStart).toBe('2026-08-16')
  })

  it('starts the month and year on the first', () => {
    const boundaries = boundariesFor('2026-08-20')
    expect(boundaries.monthStart).toBe('2026-08-01')
    expect(boundaries.yearStart).toBe('2026-01-01')
  })

  it('crosses a month boundary backwards when the week does', () => {
    // 2026-09-02 is a Wednesday; its week began Sunday 30 August.
    expect(boundariesFor('2026-09-02').weekStart).toBe('2026-08-30')
  })
})

describe('hasOther', () => {
  it('is false when nothing personal or demo was traded', () => {
    expect(hasOther(pnlByPeriod([trade('2026-08-20', 100, 'eval')], boundariesFor('2026-08-20')))).toBe(false)
  })

  it('is true as soon as there is', () => {
    expect(hasOther(pnlByPeriod([trade('2026-08-20', 100, 'demo')], boundariesFor('2026-08-20')))).toBe(true)
  })
})
