/**
 * Turns raw broker fills into round-trip trades.
 *
 * Brokers hand you executions, not trades. A "trade" here is the span from the
 * moment a contract goes from flat to non-flat until it returns to flat —
 * scale-ins, partial exits and all. Realised P&L is matched FIFO, which is both
 * the convention every futures platform reports on and the one Israeli
 * bookkeeping expects.
 *
 * A fill that flips the position (long 2, then sell 3) is split: two contracts
 * close the long and complete that trade, and the third opens a fresh short.
 * Commissions and fees are apportioned across the split by quantity.
 *
 * Everything here is pure — no database, no clock — so the behaviour is
 * testable and re-running a match over the same fills is deterministic.
 */
import { pnlFromPrices, pointValue, rootSymbol } from '../symbols'

export type MatchExecution = {
  id?: number
  accountId: number
  contract: string
  side: 'buy' | 'sell'
  qty: number
  fillPrice: number
  fillAt: Date
  tradingDay: string
  commission?: number
  fees?: number
}

export type MatchedTrade = {
  accountId: number
  symbol: string
  contract: string
  direction: 'long' | 'short'
  /** Total contracts opened across the round trip. */
  qty: number
  /** Contracts closed so far. Equals `qty` once the trade is flat. */
  exitQty: number
  entryAt: Date
  exitAt: Date | null
  tradingDay: string
  avgEntry: number
  avgExit: number | null
  grossPnl: number
  commission: number
  fees: number
  netPnl: number
  durationSeconds: number | null
  status: 'open' | 'closed'
  /** Fills belonging to this trade, for drill-down in the UI. */
  executionIds: number[]
}

type Lot = { qty: number; price: number }

type Builder = {
  accountId: number
  symbol: string
  contract: string
  direction: 'long' | 'short'
  entryQty: number
  entryNotional: number
  exitQty: number
  exitNotional: number
  entryAt: Date
  exitAt: Date | null
  tradingDay: string
  grossPnl: number
  commission: number
  fees: number
  executionIds: number[]
}

const EPSILON = 1e-9

function chronological(a: MatchExecution, b: MatchExecution): number {
  const byTime = a.fillAt.getTime() - b.fillAt.getTime()
  if (byTime !== 0) return byTime
  // Same-millisecond fills: fall back to insertion order so a scale-in and the
  // exit that follows it in the same tick don't get reordered.
  return (a.id ?? 0) - (b.id ?? 0)
}

function finalize(builder: Builder, open: boolean): MatchedTrade {
  const avgEntry = builder.entryQty > 0 ? builder.entryNotional / builder.entryQty : 0
  const avgExit = builder.exitQty > 0 ? builder.exitNotional / builder.exitQty : null
  const netPnl = builder.grossPnl - builder.commission - builder.fees
  const durationSeconds =
    builder.exitAt !== null
      ? Math.max(0, Math.round((builder.exitAt.getTime() - builder.entryAt.getTime()) / 1000))
      : null

  return {
    accountId: builder.accountId,
    symbol: builder.symbol,
    contract: builder.contract,
    direction: builder.direction,
    qty: builder.entryQty,
    exitQty: builder.exitQty,
    entryAt: builder.entryAt,
    exitAt: open ? null : builder.exitAt,
    tradingDay: builder.tradingDay,
    avgEntry: round(avgEntry, 8),
    avgExit: avgExit === null ? null : round(avgExit, 8),
    grossPnl: round(builder.grossPnl, 4),
    commission: round(builder.commission, 4),
    fees: round(builder.fees, 4),
    netPnl: round(netPnl, 4),
    durationSeconds: open ? null : durationSeconds,
    status: open ? 'open' : 'closed',
    executionIds: builder.executionIds,
  }
}

function round(value: number, dp: number): number {
  const factor = 10 ** dp
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Matches one account's fills into trades.
 *
 * Positions are tracked per *contract* (MNQZ5), not per root (MNQ), because
 * holding the front month while rolling into the back month is two positions,
 * not a flat book. Reporting still aggregates on the root.
 */
export function matchExecutions(executions: MatchExecution[]): MatchedTrade[] {
  const byContract = new Map<string, MatchExecution[]>()
  for (const execution of executions) {
    const key = `${execution.accountId}::${execution.contract.toUpperCase()}`
    const bucket = byContract.get(key)
    if (bucket) bucket.push(execution)
    else byContract.set(key, [execution])
  }

  const trades: MatchedTrade[] = []
  for (const bucket of byContract.values()) {
    trades.push(...matchOneContract([...bucket].sort(chronological)))
  }
  return trades.sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime())
}

function matchOneContract(fills: MatchExecution[]): MatchedTrade[] {
  const trades: MatchedTrade[] = []
  const lots: Lot[] = []
  let position = 0
  let builder: Builder | null = null

  for (const fill of fills) {
    if (fill.qty <= 0) continue

    const signed = fill.side === 'buy' ? fill.qty : -fill.qty
    const commissionPerContract = (fill.commission ?? 0) / fill.qty
    const feesPerContract = (fill.fees ?? 0) / fill.qty

    // Split the fill into the part that closes existing exposure and the part
    // that opens new exposure. Only a flip produces both.
    const opposes = position !== 0 && Math.sign(signed) !== Math.sign(position)
    const closeQty = opposes ? Math.min(fill.qty, Math.abs(position)) : 0
    const openQty = fill.qty - closeQty

    if (closeQty > 0 && builder) {
      let remaining = closeQty
      let realised = 0

      while (remaining > EPSILON && lots.length > 0) {
        const lot = lots[0]
        const take = Math.min(lot.qty, remaining)
        realised += pnlFromPrices(fill.contract, builder.direction, lot.price, fill.fillPrice, take)
        lot.qty -= take
        remaining -= take
        if (lot.qty <= EPSILON) lots.shift()
      }

      // A close with no matching lot means the history starts mid-position
      // (a partial export). Value it from the trade's average entry so the
      // number is honest rather than zero.
      if (remaining > EPSILON) {
        const avgEntry = builder.entryQty > 0 ? builder.entryNotional / builder.entryQty : fill.fillPrice
        realised += pnlFromPrices(fill.contract, builder.direction, avgEntry, fill.fillPrice, remaining)
      }

      builder.grossPnl += realised
      builder.exitQty += closeQty
      builder.exitNotional += fill.fillPrice * closeQty
      builder.exitAt = fill.fillAt
      builder.commission += commissionPerContract * closeQty
      builder.fees += feesPerContract * closeQty
      if (fill.id !== undefined && closeQty >= openQty) builder.executionIds.push(fill.id)

      position += fill.side === 'buy' ? closeQty : -closeQty

      if (Math.abs(position) <= EPSILON) {
        trades.push(finalize(builder, false))
        builder = null
        lots.length = 0
      }
    }

    if (openQty > 0) {
      if (!builder) {
        builder = {
          accountId: fill.accountId,
          symbol: rootSymbol(fill.contract),
          contract: fill.contract.toUpperCase(),
          direction: fill.side === 'buy' ? 'long' : 'short',
          entryQty: 0,
          entryNotional: 0,
          exitQty: 0,
          exitNotional: 0,
          entryAt: fill.fillAt,
          exitAt: null,
          tradingDay: fill.tradingDay,
          grossPnl: 0,
          commission: 0,
          fees: 0,
          executionIds: [],
        }
      }

      lots.push({ qty: openQty, price: fill.fillPrice })
      builder.entryQty += openQty
      builder.entryNotional += fill.fillPrice * openQty
      builder.commission += commissionPerContract * openQty
      builder.fees += feesPerContract * openQty
      if (fill.id !== undefined && openQty > closeQty) builder.executionIds.push(fill.id)

      position += fill.side === 'buy' ? openQty : -openQty
    }
  }

  // Whatever is still on at the end of the data is a live position.
  if (builder && Math.abs(position) > EPSILON) trades.push(finalize(builder, true))

  return trades
}

/**
 * Unrealised P&L for an open trade at a given mark.
 * Used by the dashboard when a broker sync reports a live position.
 */
export function markToMarket(trade: MatchedTrade, mark: number): number {
  if (trade.status !== 'open') return trade.netPnl
  const openQty = trade.qty - trade.exitQty
  const qty = openQty > 0 ? openQty : trade.qty
  const gross = pnlFromPrices(trade.contract, trade.direction, trade.avgEntry, mark, qty)
  return round(gross - trade.commission - trade.fees, 4)
}

/**
 * Currency at risk between entry and stop. This is what makes R-multiples
 * possible, and R is the only way to compare a 1-lot MNQ scalp against a 5-lot
 * ES swing on equal terms.
 */
export function riskFromStop(
  contract: string,
  direction: 'long' | 'short',
  entry: number,
  stop: number,
  qty: number,
): number {
  const distance = direction === 'long' ? entry - stop : stop - entry
  if (distance <= 0) return 0
  return round(distance * qty * pointValue(contract), 4)
}

export function rMultiple(netPnl: number, riskBase: number | null | undefined): number | null {
  if (!riskBase || riskBase <= 0) return null
  return round(netPnl / riskBase, 6)
}
