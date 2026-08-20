import { describe, expect, it } from 'vitest'
import { detectSource, parseCsv, toNumber, toPrice } from './index'

const options = { timezone: 'Asia/Jerusalem', dayBoundary: '00:00' }

describe('toNumber', () => {
  it('reads plain numbers', () => {
    expect(toNumber('42')).toBe(42)
    expect(toNumber('42.5')).toBe(42.5)
    expect(toNumber(7)).toBe(7)
  })

  it('strips currency symbols and thousands separators', () => {
    expect(toNumber('$1,234.56')).toBe(1234.56)
    expect(toNumber('₪2,000')).toBe(2000)
  })

  it('reads accounting-style parentheses as negative', () => {
    expect(toNumber('($1,234.56)')).toBe(-1234.56)
  })

  it('returns null for blanks and placeholders', () => {
    expect(toNumber('')).toBeNull()
    expect(toNumber('-')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber('n/a')).toBeNull()
  })
})

describe('toNumber — locale shapes', () => {
  it('reads European dot-grouped comma-decimal numbers', () => {
    // "1.234,56" read as 1.23456 was a 1000x price error with no warning.
    expect(toNumber('1.234,56')).toBe(1234.56)
    expect(toNumber('-4.507,75')).toBe(-4507.75)
  })

  it('reads a lone comma as the decimal point', () => {
    expect(toNumber('42,5')).toBe(42.5)
  })

  it('still reads US thousands separators', () => {
    expect(toNumber('1,234.56')).toBe(1234.56)
    expect(toNumber('21,000')).toBe(21000)
  })
})

describe('toPrice', () => {
  it('reads decimal prices unchanged', () => {
    expect(toPrice('21000.25')).toBe(21000.25)
  })

  it("reads bond tick notation (110'16 = 110 and 16/32)", () => {
    expect(toPrice("110'16")).toBeCloseTo(110.5, 6)
  })

  it("reads grain tick notation (432'2 = 432 and 2/8)", () => {
    expect(toPrice("432'2")).toBeCloseTo(432.25, 6)
  })

  it("reads three-digit 320ths notation", () => {
    expect(toPrice("110'160")).toBeCloseTo(110.5, 6)
  })
})

describe('detectSource', () => {
  it('recognises a Tradovate performance export as round trips', () => {
    const result = detectSource(['symbol', 'buyFillId', 'sellFillId', 'qty', 'pnl'])
    expect(result.source).toBe('tradovate_performance_csv')
    expect(result.shape).toBe('trades')
  })

  it('recognises a NinjaTrader trade performance export', () => {
    const result = detectSource(['Instrument', 'Market pos.', 'Entry price', 'Exit price', 'Profit'])
    expect(result.source).toBe('ninjatrader_csv')
    expect(result.shape).toBe('trades')
  })

  it('recognises a Rithmic fill export as executions', () => {
    const result = detectSource(['Account', 'Symbol', 'B/S', 'Qty', 'Price', 'Fill Time'])
    expect(result.source).toBe('rithmic_csv')
    expect(result.shape).toBe('executions')
  })

  it('falls back to generic, inferring shape from entry/exit columns', () => {
    expect(detectSource(['Ticker', 'Entry Price', 'Exit Price']).shape).toBe('trades')
    expect(detectSource(['Ticker', 'Side', 'Price', 'Time']).shape).toBe('executions')
  })
})

describe('parseCsv — fill exports', () => {
  it('parses a Rithmic-style fill export into executions', () => {
    const csv = [
      'Account,Symbol,B/S,Qty,Price,Fill Time',
      'APEX-123,MNQZ5,B,2,21000.25,2026-03-04 08:30:00',
      'APEX-123,MNQZ5,S,2,21010.50,2026-03-04 08:35:00',
    ].join('\n')

    const result = parseCsv(csv, options)
    expect(result.shape).toBe('executions')
    expect(result.executions).toHaveLength(2)
    expect(result.rowsSkipped).toBe(0)

    const [first] = result.executions
    expect(first.side).toBe('buy')
    expect(first.qty).toBe(2)
    expect(first.fillPrice).toBe(21000.25)
    expect(first.symbol).toBe('MNQ')
    expect(first.contract).toBe('MNQZ5')
    expect(first.accountHint).toBe('APEX-123')
  })

  it('accepts long-form side words and alternative headers', () => {
    const csv = [
      'Instrument,Action,Quantity,Fill Price,Timestamp',
      'MESZ5,Bought,1,5800.00,2026-03-04T14:30:00Z',
      'MESZ5,Sold,1,5805.00,2026-03-04T14:35:00Z',
    ].join('\n')

    const result = parseCsv(csv, options)
    expect(result.executions.map((e) => e.side)).toEqual(['buy', 'sell'])
  })

  it('applies a per-contract commission when the export carries none', () => {
    const csv = [
      'Symbol,Side,Qty,Price,Time',
      'MNQZ5,Buy,2,21000,2026-03-04T14:30:00Z',
    ].join('\n')

    const result = parseCsv(csv, { ...options, commissionPerContract: 1.24 })
    // Half the round turn on each side, over 2 contracts.
    expect(result.executions[0].commission).toBeCloseTo(1.24, 6)
  })

  it('prefers an explicit commission column over the configured rate', () => {
    const csv = [
      'Symbol,Side,Qty,Price,Time,Commission',
      'MNQZ5,Buy,2,21000,2026-03-04T14:30:00Z,0.99',
    ].join('\n')

    const result = parseCsv(csv, { ...options, commissionPerContract: 1.24 })
    expect(result.executions[0].commission).toBe(0.99)
  })

  it('skips unreadable rows and says why, without failing the whole file', () => {
    const csv = [
      'Symbol,Side,Qty,Price,Time',
      'MNQZ5,Buy,1,21000,2026-03-04T14:30:00Z',
      'MNQZ5,,,,',
      'MNQZ5,Sell,1,21010,2026-03-04T14:35:00Z',
    ].join('\n')

    const result = parseCsv(csv, options)
    expect(result.executions).toHaveLength(2)
    expect(result.rowsSkipped).toBe(1)
    expect(result.errors.join(' ')).toContain('Row 3')
  })

  it('reports an empty file rather than throwing', () => {
    const result = parseCsv('Symbol,Side,Qty,Price,Time', options)
    expect(result.executions).toHaveLength(0)
    expect(result.errors.join(' ')).toContain('no data rows')
  })
})

describe('parseCsv — round-trip exports', () => {
  it('parses a NinjaTrader performance export into trades', () => {
    const csv = [
      'Instrument,Market pos.,Quantity,Entry price,Exit price,Entry time,Exit time,Profit,Commission',
      'MNQ 12-25,Long,2,21000.00,21010.00,2026-03-04 08:30:00,2026-03-04 08:35:00,38.76,1.24',
    ].join('\n')

    const result = parseCsv(csv, options)
    expect(result.shape).toBe('trades')
    expect(result.trades).toHaveLength(1)

    const [trade] = result.trades
    expect(trade.symbol).toBe('MNQ')
    expect(trade.direction).toBe('long')
    expect(trade.qty).toBe(2)
    expect(trade.netPnl).toBe(38.76)
    // Reported profit is net; gross adds the costs back rather than deducting twice.
    expect(trade.grossPnl).toBeCloseTo(40, 6)
  })

  it('reads a short round trip', () => {
    const csv = [
      'Instrument,Market pos.,Quantity,Entry price,Exit price,Entry time,Exit time,Profit',
      'MESZ5,Short,1,5805.00,5800.00,2026-03-04 08:30:00,2026-03-04 08:35:00,25.00',
    ].join('\n')

    expect(parseCsv(csv, options).trades[0].direction).toBe('short')
  })

  it('infers direction from price movement against reported P&L', () => {
    const csv = [
      'Symbol,Qty,Entry Price,Exit Price,Entry Time,Exit Time,P/L',
      'MNQZ5,1,21010,21000,2026-03-04T14:30:00Z,2026-03-04T14:35:00Z,20',
    ].join('\n')

    // Price fell but P&L is positive, so the position was short.
    expect(parseCsv(csv, options).trades[0].direction).toBe('short')
  })

  it('carries MAE and MFE through when present', () => {
    const csv = [
      'Instrument,Market pos.,Quantity,Entry price,Exit price,Entry time,Exit time,Profit,MAE,MFE',
      'MNQZ5,Long,1,21000,21010,2026-03-04 08:30:00,2026-03-04 08:35:00,20,-12,34',
    ].join('\n')

    const [trade] = parseCsv(csv, options).trades
    expect(trade.maeBase).toBe(-12)
    expect(trade.mfeBase).toBe(34)
  })
})

describe('regression: review findings', () => {
  it('treats a negative quantity as a sell, not a skipped row', () => {
    const csv = [
      'Symbol,Qty,Price,Time',
      'MNQZ5,2,21000,2026-03-04T14:30:00Z',
      'MNQZ5,-2,21010,2026-03-04T14:35:00Z',
    ].join('\n')

    const result = parseCsv(csv, options)
    expect(result.rowsSkipped).toBe(0)
    expect(result.executions.map((e) => e.side)).toEqual(['buy', 'sell'])
    expect(result.executions[1].qty).toBe(2)
  })

  it('treats an explicit Gross P/L column as gross, deriving net', () => {
    const csv = [
      'Instrument,Market pos.,Quantity,Entry price,Exit price,Entry time,Exit time,Gross P/L,Commission',
      'MNQZ5,Long,1,21000,21010,2026-03-04 08:30:00,2026-03-04 08:35:00,20,1.24',
    ].join('\n')

    const [trade] = parseCsv(csv, options).trades
    expect(trade.grossPnl).toBe(20)
    expect(trade.netPnl).toBeCloseTo(18.76, 6)
  })

  it('honours a forced round-trip format even when headers dodge detection', () => {
    // Headers vague enough to detect as executions; the user knows better.
    const csv = [
      'Symbol,Qty,Entry Price,Exit Price,Entry Time,Exit Time,P/L',
      'MNQZ5,1,21000,21010,2026-03-04T14:30:00Z,2026-03-04T14:35:00Z,20',
    ].join('\n')

    const forced = parseCsv(csv, { ...options, source: 'ninjatrader_csv' })
    expect(forced.shape).toBe('trades')
    expect(forced.trades).toHaveLength(1)
  })
})

describe('trading day assignment', () => {
  it('uses the local calendar date with a midnight boundary', () => {
    const csv = ['Symbol,Side,Qty,Price,Time', 'MNQZ5,Buy,1,21000,2026-03-04T14:30:00Z'].join('\n')
    // 14:30 UTC is 16:30 in Jerusalem, still 4 March.
    expect(parseCsv(csv, options).executions[0].tradingDay).toBe('2026-03-04')
  })

  it('rolls a fill past a session boundary into the next trading day', () => {
    const csv = ['Symbol,Side,Qty,Price,Time', 'MNQZ5,Buy,1,21000,2026-03-04T16:30:00Z'].join('\n')
    // 16:30 UTC is 18:30 Jerusalem — at or past an 18:00 boundary, so it is the
    // 5 March session even though the calendar still says the 4th.
    const result = parseCsv(csv, { ...options, dayBoundary: '18:00' })
    expect(result.executions[0].tradingDay).toBe('2026-03-05')
  })
})
