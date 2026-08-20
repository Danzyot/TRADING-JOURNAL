/**
 * CSV import.
 *
 * Rithmic and Tradecopia have no retail API — Rithmic licenses R|API+ through
 * FCMs under a professional agreement, and Tradecopia's "API" is its outbound
 * connection to brokers, not an inbound one for customers. For those, and for
 * any platform added later, a CSV export is the reliable path.
 *
 * Rather than hard-coding each vendor's exact header row — which every vendor
 * changes without warning — this parser resolves columns by alias. A header
 * called "Fill Time", "fillTime", "Timestamp" or "Exec Time" all mean the same
 * thing, so all four resolve to the same field. A format that has drifted still
 * imports; a genuinely unknown one degrades to explicit column mapping instead
 * of failing.
 *
 * Two export shapes exist in the wild and both are handled:
 *   - **Fill exports** (one row per execution) go through the FIFO matcher.
 *   - **Round-trip exports** (NinjaTrader trade performance, Tradovate's paired
 *     performance report) already contain entry and exit, so they are taken as
 *     complete trades.
 */
import Papa from 'papaparse'
import { rootSymbol } from '@/lib/symbols'
import { parseTimestamp, tradingDayFor } from '@/lib/time'

export type ImportSource =
  | 'tradovate_csv'
  | 'tradovate_performance_csv'
  | 'rithmic_csv'
  | 'ninjatrader_csv'
  | 'tradingview_csv'
  | 'generic_csv'

export type ParsedExecution = {
  contract: string
  symbol: string
  side: 'buy' | 'sell'
  qty: number
  fillPrice: number
  fillAt: Date
  tradingDay: string
  commission: number
  fees: number
  externalId: string | null
  accountHint: string | null
  raw: Record<string, unknown>
}

export type ParsedTrade = {
  contract: string
  symbol: string
  direction: 'long' | 'short'
  qty: number
  entryAt: Date
  exitAt: Date | null
  tradingDay: string
  avgEntry: number
  avgExit: number | null
  grossPnl: number
  commission: number
  fees: number
  netPnl: number
  maeBase: number | null
  mfeBase: number | null
  externalId: string | null
  accountHint: string | null
  raw: Record<string, unknown>
}

export type ImportResult = {
  source: ImportSource
  shape: 'executions' | 'trades'
  executions: ParsedExecution[]
  trades: ParsedTrade[]
  rowsSeen: number
  rowsSkipped: number
  errors: string[]
  /** Headers we could not map, surfaced so the user can map them manually. */
  unmappedHeaders: string[]
}

export type ImportOptions = {
  timezone: string
  dayBoundary: string
  /** Timezone the file's naked timestamps are written in. */
  sourceTimezone?: string
  /** Round-turn commission applied when the export carries none. */
  commissionPerContract?: number
  /** Force a format instead of auto-detecting. */
  source?: ImportSource
}

// ---------------------------------------------------------------------------
// Column aliases
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string[]> = {
  timestamp: [
    'timestamp', 'filltime', 'fill time', 'time', 'datetime', 'date/time', 'date time',
    'exectime', 'exec time', 'execution time', 'tradetime', 'trade time', 'transactiontime',
    'boughttimestamp', 'date', 'order time', 'placedtime', 'updatetime', 'closetime',
  ],
  entryTime: [
    'entrytime', 'entry time', 'boughttimestamp', 'open time', 'opentime', 'entry date/time',
    'entry timestamp', 'time of entry',
  ],
  exitTime: [
    'exittime', 'exit time', 'soldtimestamp', 'close time', 'closetime', 'exit date/time',
    'exit timestamp', 'time of exit',
  ],
  side: ['side', 'b/s', 'buy/sell', 'action', 'direction', 'type', 'ordertype', 'buysell', 'transaction'],
  marketPosition: ['marketpos.', 'market pos.', 'marketposition', 'market position', 'position'],
  qty: ['qty', 'quantity', 'filledqty', 'filled qty', 'size', 'contracts', 'volume', 'amount', 'lots', 'filled'],
  price: ['price', 'fillprice', 'fill price', 'avgprice', 'avg price', 'average price', 'executionprice'],
  entryPrice: ['entryprice', 'entry price', 'buyprice', 'buy price', 'open price', 'openprice'],
  exitPrice: ['exitprice', 'exit price', 'sellprice', 'sell price', 'close price', 'closeprice'],
  contract: ['contract', 'symbol', 'instrument', 'ticker', 'product', 'market', 'contractname', 'security'],
  commission: ['commission', 'commissions', 'comm', 'fee', 'brokerage'],
  fees: ['fees', 'exchangefees', 'exchange fees', 'nfa', 'clearingfee', 'otherfees', 'totalfees'],
  pnl: ['pnl', 'p/l', 'profit', 'netprofit', 'net profit', 'realizedpnl', 'realized pnl', 'gross p/l', 'p&l', 'result'],
  netPnl: ['netpnl', 'net pnl', 'net p/l', 'net', 'netprofit'],
  account: ['account', 'accountname', 'account name', 'accountid', 'acct', 'accountspec'],
  id: ['id', 'fillid', 'fill id', 'orderid', 'order id', 'executionid', 'tradeid', 'trade #', 'trade#', 'buyfillid'],
  mae: ['mae', 'maxadverseexcursion', 'max adverse excursion'],
  mfe: ['mfe', 'maxfavorableexcursion', 'max favorable excursion'],
}

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\s]+/g, ' ').replace(/\s+/g, ' ')
}

function buildIndex(headers: string[]): { map: Record<string, string>; unmapped: string[] } {
  const map: Record<string, string> = {}
  const used = new Set<string>()

  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const header of headers) {
      const normalised = normaliseHeader(header)
      const compact = normalised.replace(/\s/g, '')
      if (aliases.some((alias) => alias === normalised || alias === compact)) {
        if (!map[field]) {
          map[field] = header
          used.add(header)
        }
        break
      }
    }
  }

  return { map, unmapped: headers.filter((h) => !used.has(h)) }
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

/**
 * Money and quantity columns arrive with currency symbols, thousands
 * separators, and parentheses for negatives — "($1,234.56)" is -1234.56.
 */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value === null || value === undefined) return null

  let raw = String(value).trim()
  if (!raw || raw === '-' || raw === '--') return null

  const negative = /^\(.*\)$/.test(raw)
  raw = raw.replace(/[()]/g, '').replace(/[$₪€£,\s]/g, '').replace(/%$/, '')

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return negative ? -parsed : parsed
}

/**
 * Bond and grain prices come in tick notation: 110'155 means 110 + 15.5/32,
 * and 432'2 means 432 + 2/8 cents. Plain decimals pass through untouched.
 */
export function toPrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const tickNotation = raw.match(/^(-?\d+)['"](\d{1,3})$/)
  if (tickNotation) {
    const whole = Number(tickNotation[1])
    const fraction = tickNotation[2]
    // Three digits is 32nds plus halves/quarters; two is 32nds; one is 8ths.
    const denominator = fraction.length === 3 ? 320 : fraction.length === 2 ? 32 : 8
    const magnitude = Math.abs(whole) + Number(fraction) / denominator
    return whole < 0 ? -magnitude : magnitude
  }

  return toNumber(raw)
}

function toSide(value: unknown): 'buy' | 'sell' | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 'b' || raw.startsWith('buy') || raw === 'long' || raw === 'bot' || raw === 'bought') return 'buy'
  if (raw === 's' || raw.startsWith('sell') || raw === 'short' || raw === 'sld' || raw === 'sold') return 'sell'
  return null
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/**
 * Header signatures for the formats worth recognising by name. Detection only
 * changes defaults (source timezone, whether costs are already included); the
 * alias resolver does the actual work, so a miss is not fatal.
 */
const SIGNATURES: { source: ImportSource; shape: 'executions' | 'trades'; markers: string[] }[] = [
  { source: 'tradovate_performance_csv', shape: 'trades', markers: ['buyfillid', 'sellfillid'] },
  { source: 'tradovate_performance_csv', shape: 'trades', markers: ['boughttimestamp', 'soldtimestamp'] },
  { source: 'ninjatrader_csv', shape: 'trades', markers: ['market pos.', 'entry price', 'exit price'] },
  { source: 'ninjatrader_csv', shape: 'trades', markers: ['entry name', 'exit name'] },
  { source: 'tradingview_csv', shape: 'trades', markers: ['trade #', 'signal'] },
  { source: 'rithmic_csv', shape: 'executions', markers: ['fill time', 'b/s'] },
  { source: 'tradovate_csv', shape: 'executions', markers: ['filledqty', 'avgprice'] },
]

export function detectSource(headers: string[]): { source: ImportSource; shape: 'executions' | 'trades' } {
  const normalised = headers.map(normaliseHeader)
  const compact = normalised.map((h) => h.replace(/\s/g, ''))

  for (const signature of SIGNATURES) {
    const hit = signature.markers.every(
      (marker) => normalised.includes(marker) || compact.includes(marker.replace(/\s/g, '')),
    )
    if (hit) return { source: signature.source, shape: signature.shape }
  }

  // No signature: the presence of separate entry and exit columns is what
  // distinguishes a round-trip export from a fill export.
  const { map } = buildIndex(headers)
  const hasRoundTrip = Boolean((map.entryPrice && map.exitPrice) || (map.entryTime && map.exitTime))
  return { source: 'generic_csv', shape: hasRoundTrip ? 'trades' : 'executions' }
}

/** Platforms that stamp exports in exchange time rather than UTC. */
const SOURCE_TIMEZONES: Partial<Record<ImportSource, string>> = {
  rithmic_csv: 'America/Chicago',
  ninjatrader_csv: 'America/Chicago',
  tradovate_csv: 'America/New_York',
  tradovate_performance_csv: 'America/New_York',
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseCsv(content: string, options: ImportOptions): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(content.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })

  const errors: string[] = parsed.errors
    .slice(0, 5)
    .map((error) => `Row ${error.row ?? '?'}: ${error.message}`)

  const rows = parsed.data.filter((row) => Object.values(row).some((value) => value?.trim?.()))
  const headers = parsed.meta.fields ?? []

  if (rows.length === 0) {
    return {
      source: options.source ?? 'generic_csv',
      shape: 'executions',
      executions: [],
      trades: [],
      rowsSeen: 0,
      rowsSkipped: 0,
      errors: [...errors, 'The file contained no data rows.'],
      unmappedHeaders: headers,
    }
  }

  const detected = detectSource(headers)
  const source = options.source ?? detected.source
  const shape = options.source ? detected.shape : detected.shape
  const { map, unmapped } = buildIndex(headers)
  const sourceZone = options.sourceTimezone ?? SOURCE_TIMEZONES[source]

  const context = { map, source, shape, sourceZone, options }

  return shape === 'trades'
    ? parseTradeRows(rows, context, errors, unmapped)
    : parseExecutionRows(rows, context, errors, unmapped)
}

type ParseContext = {
  map: Record<string, string>
  source: ImportSource
  shape: 'executions' | 'trades'
  sourceZone: string | undefined
  options: ImportOptions
}

const cell = (row: Record<string, string>, map: Record<string, string>, field: string): string | undefined =>
  map[field] ? row[map[field]] : undefined

function parseExecutionRows(
  rows: Record<string, string>[],
  context: ParseContext,
  errors: string[],
  unmapped: string[],
): ImportResult {
  const { map, options, sourceZone } = context
  const executions: ParsedExecution[] = []
  let skipped = 0

  rows.forEach((row, index) => {
    const contract = cell(row, map, 'contract')?.trim()
    const side = toSide(cell(row, map, 'side'))
    const qty = toNumber(cell(row, map, 'qty'))
    const price = toPrice(cell(row, map, 'price'))
    const fillAt = parseTimestamp(cell(row, map, 'timestamp'), sourceZone)

    const missing: string[] = []
    if (!contract) missing.push('contract')
    if (!side) missing.push('side')
    if (!qty || qty <= 0) missing.push('quantity')
    if (price === null) missing.push('price')
    if (!fillAt) missing.push('timestamp')

    if (missing.length > 0) {
      skipped += 1
      if (errors.length < 12) {
        errors.push(`Row ${index + 2}: could not read ${missing.join(', ')} — row skipped.`)
      }
      return
    }

    const explicitCommission = toNumber(cell(row, map, 'commission'))
    const commission =
      explicitCommission !== null
        ? Math.abs(explicitCommission)
        // Fill exports usually omit cost; a per-side half of the round turn
        // keeps the totals right whichever way the trade is entered.
        : ((options.commissionPerContract ?? 0) * qty!) / 2

    executions.push({
      contract: contract!.toUpperCase(),
      symbol: rootSymbol(contract!),
      side: side!,
      qty: Math.round(qty!),
      fillPrice: price!,
      fillAt: fillAt!,
      tradingDay: tradingDayFor(fillAt!, options.timezone, options.dayBoundary),
      commission,
      fees: Math.abs(toNumber(cell(row, map, 'fees')) ?? 0),
      externalId: cell(row, map, 'id')?.trim() || null,
      accountHint: cell(row, map, 'account')?.trim() || null,
      raw: row,
    })
  })

  return {
    source: context.source,
    shape: 'executions',
    executions,
    trades: [],
    rowsSeen: rows.length,
    rowsSkipped: skipped,
    errors,
    unmappedHeaders: unmapped,
  }
}

function parseTradeRows(
  rows: Record<string, string>[],
  context: ParseContext,
  errors: string[],
  unmapped: string[],
): ImportResult {
  const { map, options, sourceZone } = context
  const trades: ParsedTrade[] = []
  let skipped = 0

  rows.forEach((row, index) => {
    const contract = cell(row, map, 'contract')?.trim()
    const qty = toNumber(cell(row, map, 'qty'))
    const entryPrice = toPrice(cell(row, map, 'entryPrice') ?? cell(row, map, 'price'))
    const exitPrice = toPrice(cell(row, map, 'exitPrice'))
    const entryAt = parseTimestamp(cell(row, map, 'entryTime') ?? cell(row, map, 'timestamp'), sourceZone)
    const exitAt = parseTimestamp(cell(row, map, 'exitTime'), sourceZone)

    const missing: string[] = []
    if (!contract) missing.push('contract')
    if (!qty || qty <= 0) missing.push('quantity')
    if (entryPrice === null) missing.push('entry price')
    if (!entryAt) missing.push('entry time')

    if (missing.length > 0) {
      skipped += 1
      if (errors.length < 12) {
        errors.push(`Row ${index + 2}: could not read ${missing.join(', ')} — row skipped.`)
      }
      return
    }

    // Direction comes from an explicit position column where one exists;
    // otherwise it is inferred from the side, and finally from price movement
    // against reported P&L.
    const declared = toSide(cell(row, map, 'marketPosition') ?? cell(row, map, 'side'))
    const reportedPnl = toNumber(cell(row, map, 'pnl') ?? cell(row, map, 'netPnl'))
    let direction: 'long' | 'short'
    if (declared) {
      direction = declared === 'buy' ? 'long' : 'short'
    } else if (exitPrice !== null && reportedPnl !== null && exitPrice !== entryPrice) {
      direction = exitPrice > entryPrice === reportedPnl > 0 ? 'long' : 'short'
    } else {
      direction = 'long'
    }

    const commission = Math.abs(toNumber(cell(row, map, 'commission')) ?? 0)
    const fees = Math.abs(toNumber(cell(row, map, 'fees')) ?? 0)

    // Round-trip exports normally report P&L already net of commission. Trust
    // the reported figure and derive gross, rather than recomputing from price
    // and risking a double deduction.
    const netPnl = reportedPnl ?? 0
    const grossPnl = reportedPnl !== null ? reportedPnl + commission + fees : 0

    trades.push({
      contract: contract!.toUpperCase(),
      symbol: rootSymbol(contract!),
      direction,
      qty: Math.round(qty!),
      entryAt: entryAt!,
      exitAt,
      tradingDay: tradingDayFor(entryAt!, options.timezone, options.dayBoundary),
      avgEntry: entryPrice!,
      avgExit: exitPrice,
      grossPnl,
      commission,
      fees,
      netPnl,
      maeBase: toNumber(cell(row, map, 'mae')),
      mfeBase: toNumber(cell(row, map, 'mfe')),
      externalId: cell(row, map, 'id')?.trim() || null,
      accountHint: cell(row, map, 'account')?.trim() || null,
      raw: row,
    })
  })

  return {
    source: context.source,
    shape: 'trades',
    executions: [],
    trades,
    rowsSeen: rows.length,
    rowsSkipped: skipped,
    errors,
    unmappedHeaders: unmapped,
  }
}

export const SOURCE_LABELS: Record<ImportSource, string> = {
  tradovate_csv: 'Tradovate — order/fill export',
  tradovate_performance_csv: 'Tradovate — performance (paired) export',
  rithmic_csv: 'Rithmic R|Trader Pro export',
  ninjatrader_csv: 'NinjaTrader trade performance export',
  tradingview_csv: 'TradingView list of trades',
  generic_csv: 'Generic CSV',
}
