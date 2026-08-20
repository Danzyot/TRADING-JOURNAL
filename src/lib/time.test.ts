import { describe, expect, it } from 'vitest'
import { addDays, addMonths, dateRange, parseTimestamp, secondsToHuman, tradingDayFor } from './time'

describe('parseTimestamp', () => {
  it('reads an ISO timestamp with an explicit zone', () => {
    expect(parseTimestamp('2026-03-04T14:30:00Z')?.toISOString()).toBe('2026-03-04T14:30:00.000Z')
  })

  it('reads US-style dates', () => {
    const parsed = parseTimestamp('03/04/2026 09:30:00')
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(2)
  })

  it('reads epoch seconds and milliseconds as the same instant', () => {
    const seconds = 1772634600
    expect(parseTimestamp(seconds)?.toISOString()).toBe('2026-03-04T14:30:00.000Z')
    expect(parseTimestamp(seconds * 1000)?.toISOString()).toBe('2026-03-04T14:30:00.000Z')
  })

  it('anchors a naked wall-clock reading into the source timezone', () => {
    // 08:30 Chicago in March (CDT, UTC-5) is 13:30 UTC.
    const parsed = parseTimestamp('2026-03-04 08:30:00', 'America/Chicago')
    expect(parsed?.toISOString()).toBe('2026-03-04T14:30:00.000Z')
  })

  it('returns null for unparseable input', () => {
    expect(parseTimestamp('not a date')).toBeNull()
    expect(parseTimestamp('')).toBeNull()
    expect(parseTimestamp(null)).toBeNull()
  })
})

describe('tradingDayFor', () => {
  it('is the local calendar date at a midnight boundary', () => {
    expect(tradingDayFor(new Date('2026-03-04T14:30:00Z'), 'Asia/Jerusalem', '00:00')).toBe('2026-03-04')
  })

  it('rolls forward at or after the session boundary', () => {
    // 18:30 Jerusalem, past an 18:00 boundary.
    expect(tradingDayFor(new Date('2026-03-04T16:30:00Z'), 'Asia/Jerusalem', '18:00')).toBe('2026-03-05')
  })

  it('does not roll forward before the boundary', () => {
    expect(tradingDayFor(new Date('2026-03-04T14:30:00Z'), 'Asia/Jerusalem', '18:00')).toBe('2026-03-04')
  })

  it('respects the timezone, not the server clock', () => {
    // 23:30 UTC is already 01:30 the next day in Jerusalem.
    expect(tradingDayFor(new Date('2026-03-04T23:30:00Z'), 'Asia/Jerusalem', '00:00')).toBe('2026-03-05')
    expect(tradingDayFor(new Date('2026-03-04T23:30:00Z'), 'America/New_York', '00:00')).toBe('2026-03-04')
  })
})

describe('dateRange', () => {
  it('is inclusive at both ends', () => {
    expect(dateRange('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04',
    ])
  })

  it('handles a single day', () => {
    expect(dateRange('2026-03-01', '2026-03-01')).toEqual(['2026-03-01'])
  })

  it('crosses a month boundary', () => {
    expect(dateRange('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})

describe('addDays', () => {
  it('advances by exactly the given days', () => {
    expect(addDays('2026-08-01', 7)).toBe('2026-08-08')
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-29', 7)).toBe('2027-01-05')
  })
})

describe('addMonths', () => {
  it('advances by whole months', () => {
    expect(addMonths('2026-03-15', 1)).toBe('2026-04-15')
    expect(addMonths('2026-03-15', 3)).toBe('2026-06-15')
  })

  it('clamps to the last valid day of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('crosses a year boundary', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
  })
})

describe('secondsToHuman', () => {
  it('formats seconds, minutes and hours', () => {
    expect(secondsToHuman(45)).toBe('45s')
    expect(secondsToHuman(90)).toBe('1m 30s')
    expect(secondsToHuman(3900)).toBe('1h 5m')
  })

  it('renders an em dash for missing data', () => {
    expect(secondsToHuman(null)).toBe('—')
  })
})
