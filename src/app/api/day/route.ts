import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { listSetups } from '@/server/setups'
import { listAccounts, listTrades } from '@/server/trades'

export const dynamic = 'force-dynamic'

/**
 * One day of the journal, for the calendar's day view.
 *
 * Fetched rather than navigated to: opening a day used to re-render the whole
 * journal — every chart, the breakdowns, the import history — to show a
 * handful of rows. This returns just the day.
 *
 * The session is re-checked here rather than trusting the middleware alone,
 * for the same reason every other data route does.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = new URL(request.url).searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'A date of the form YYYY-MM-DD is required' }, { status: 400 })
  }

  const [setups, trades, accounts] = await Promise.all([
    listSetups(date),
    listTrades({ from: date, to: date, limit: 200 }),
    listAccounts(),
  ])

  const accountName = (id: number): string =>
    accounts.find((account) => account.id === id)?.label ?? `#${id}`

  return NextResponse.json(
    {
      date,
      setups,
      // A narrow shape on purpose: the day view shows a row per trade, and
      // sending the whole record would put fills and notes on the wire for
      // nothing.
      trades: trades.map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        qty: trade.qty,
        avgEntry: trade.avgEntry,
        avgExit: trade.avgExit,
        netPnl: trade.netPnl,
        rMultiple: trade.rMultiple,
        account: accountName(trade.accountId),
        entryAt: trade.entryAt,
      })),
      netPnl: trades.reduce((sum, trade) => sum + trade.netPnl, 0),
    },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
