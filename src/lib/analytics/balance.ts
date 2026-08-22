/**
 * What an account is actually worth right now.
 *
 * The naive answer — account size plus every tracked trade — is only right for
 * an account whose whole life is in the journal. Most are not: an account
 * bought in March and journalled from August has months of P&L that no trade
 * row knows about, and a synced account gets a balance from the broker that
 * was true at the moment of the sync and not since.
 *
 * So equity is an *anchor* plus the trades after it. An anchor is a balance
 * that was true on a stated day, from whichever source spoke last:
 *
 *   - the account size, true on the day the account opened;
 *   - a balance the trader typed in, true at the close of the day they gave;
 *   - a balance the broker reported, true at the moment of the sync.
 *
 * Trades on or before the anchor's day are already inside its number, so
 * counting them again would double them. Trades after it are not, so they
 * move the figure — which is the difference between a balance you enter once
 * and a balance that stays current.
 *
 * Pure: no clock, no database. The caller supplies the trades.
 */

export type BalanceAnchor = {
  balance: number
  /**
   * The trading day this balance was true at the close of, or null for the
   * account's own start — which precedes every trade, so nothing is excluded.
   */
  asOf: string | null
  source: 'start' | 'manual' | 'sync'
}

type AnchorAccount = {
  startingBalance: number
  openingBalance: number | null
  openingBalanceAt: string | null
  currentBalance: number | null
  balanceUpdatedAt: Date | string | null
}

type PnlTrade = {
  tradingDay: string
  netPnl: number
}

/** The day part of a sync timestamp, which is what the comparison needs. */
function dayOf(value: Date | string | null): string | null {
  if (value === null) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

/**
 * Picks the balance to count trades from.
 *
 * Later wins, because a later statement of the balance already contains
 * everything the earlier one did. A manual entry and a sync on the same day
 * both claim to be true at that day's close; the manual one wins, since the
 * trader typed it knowing what the sync said.
 */
export function balanceAnchor(account: AnchorAccount): BalanceAnchor {
  const candidates: BalanceAnchor[] = [
    { balance: account.startingBalance, asOf: null, source: 'start' },
  ]

  const syncDay = dayOf(account.balanceUpdatedAt)
  if (account.currentBalance !== null && syncDay !== null) {
    candidates.push({ balance: account.currentBalance, asOf: syncDay, source: 'sync' })
  }
  if (account.openingBalance !== null && account.openingBalanceAt !== null) {
    candidates.push({
      balance: account.openingBalance,
      asOf: account.openingBalanceAt,
      source: 'manual',
    })
  }

  return candidates.reduce((best, candidate) => {
    if (best.asOf === null) return candidate.asOf === null ? best : candidate
    if (candidate.asOf === null) return best
    if (candidate.asOf > best.asOf) return candidate
    // Same day: the trader's own figure is the more informed one.
    if (candidate.asOf === best.asOf && candidate.source === 'manual') return candidate
    return best
  })
}

export type AccountEquity = {
  equity: number
  anchor: BalanceAnchor
  /** P&L of the trades that moved the anchor — not the account's whole history. */
  countedPnl: number
  /** How many trades that was, so the UI can say what it is showing. */
  countedTrades: number
  /** Trades already inside the anchor's balance, and so deliberately ignored. */
  ignoredTrades: number
}

/**
 * Equity, and enough about how it was reached to explain it on screen.
 *
 * A number the trader cannot account for is a number they will not trust, and
 * an equity figure that silently drops half their trades is exactly the kind
 * that gets discovered during a drawdown.
 */
export function accountEquity(account: AnchorAccount, trades: PnlTrade[]): AccountEquity {
  const anchor = balanceAnchor(account)

  let countedPnl = 0
  let countedTrades = 0
  let ignoredTrades = 0
  for (const trade of trades) {
    if (anchor.asOf !== null && trade.tradingDay <= anchor.asOf) {
      ignoredTrades += 1
      continue
    }
    countedPnl += trade.netPnl
    countedTrades += 1
  }

  return {
    equity: round(anchor.balance + countedPnl),
    anchor,
    countedPnl: round(countedPnl),
    countedTrades,
    ignoredTrades,
  }
}

/**
 * Profit as the firm measures it: against the account size, never against the
 * anchor. An account funded at $50k and anchored at $52,300 is $2,300 up, and
 * the buffer, the profit target and the payout all key off that number.
 */
export function profitAboveStart(account: AnchorAccount, equity: number): number {
  return round(equity - account.startingBalance)
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
