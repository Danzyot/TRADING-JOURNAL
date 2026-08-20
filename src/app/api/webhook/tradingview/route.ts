import { NextResponse } from 'next/server'
import { and, desc, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { accounts, trades } from '@/db/schema'
import { authorizeMachineRequest } from '@/lib/auth'
import { riskFromStop, rMultiple } from '@/lib/analytics/matching'
import { rootSymbol } from '@/lib/symbols'
import { log } from '@/server/sync'

export const dynamic = 'force-dynamic'

/**
 * TradingView alert receiver.
 *
 * The gap this fills: a broker fill feed tells you the entry and the exit, but
 * never what you *intended* — and without the intended stop there is no
 * R-multiple, which is the only way to compare trades of different size on
 * equal terms. TradingView knows the stop at the moment the order is placed.
 *
 * Point an alert's webhook at this URL with `?token=$CRON_SECRET` and a JSON
 * message body:
 *
 *   {
 *     "symbol": "{{ticker}}",
 *     "action": "entry",
 *     "side": "long",
 *     "stop": 21000.25,
 *     "target": 21080,
 *     "setup": "ORB retest",
 *     "account": "Apex 50k #3"
 *   }
 *
 * The alert is matched to the most recent trade on that symbol rather than
 * creating one, because the fill feed remains the source of truth for what
 * actually happened. An alert that finds no trade yet is not an error — the
 * fill often lands seconds later, and the daily rebuild will pick the stop up.
 */
const alertSchema = z.object({
  symbol: z.string().min(1),
  action: z.string().optional(),
  side: z.enum(['long', 'short', 'buy', 'sell']).optional(),
  stop: z.coerce.number().optional(),
  target: z.coerce.number().optional(),
  setup: z.string().optional(),
  notes: z.string().optional(),
  account: z.string().optional(),
  /** Minutes to look back for a matching trade. */
  window: z.coerce.number().optional(),
})

export async function POST(request: Request) {
  if (!authorizeMachineRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = await request.text()
    // TradingView sends whatever is in the alert box: JSON if you wrote JSON,
    // plain text otherwise. Only JSON carries enough structure to act on.
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      await log('tradingview_webhook', 'skipped', 'Alert body was not JSON', { raw: raw.slice(0, 500) })
      return NextResponse.json({ ok: false, error: 'Alert body must be JSON.' })
    }

    const alert = alertSchema.parse(body)
    const symbol = rootSymbol(alert.symbol)
    const windowMinutes = alert.window ?? 15
    const since = new Date(Date.now() - windowMinutes * 60_000)

    const conditions = [eq(trades.symbol, symbol), gte(trades.entryAt, since)]

    if (alert.account) {
      const [account] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.label, alert.account))
        .limit(1)
      if (account) conditions.push(eq(trades.accountId, account.id))
    }

    const [match] = await db
      .select()
      .from(trades)
      .where(and(...conditions))
      .orderBy(desc(trades.entryAt))
      .limit(1)

    if (!match) {
      // Not a failure: the fill usually arrives after the alert.
      await log('tradingview_webhook', 'skipped', `No ${symbol} trade in the last ${windowMinutes} minutes`, alert)
      return NextResponse.json({ ok: true, matched: false, symbol })
    }

    const stop = alert.stop ?? match.stopPrice
    const riskBase =
      stop !== null && stop !== undefined
        ? riskFromStop(match.symbol, match.direction, match.avgEntry, stop, match.qty)
        : match.riskBase

    await db
      .update(trades)
      .set({
        stopPrice: stop ?? null,
        targetPrice: alert.target ?? match.targetPrice,
        riskBase,
        rMultiple: rMultiple(match.netPnl, riskBase),
        setup: alert.setup ?? match.setup,
        notes: alert.notes ?? match.notes,
        updatedAt: new Date(),
      })
      .where(eq(trades.id, match.id))

    await log('tradingview_webhook', 'ok', `Annotated ${symbol} trade #${match.id}`, alert)
    return NextResponse.json({ ok: true, matched: true, tradeId: match.id, symbol })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure'
    await log('tradingview_webhook', 'error', message).catch(() => {})
    return NextResponse.json({ ok: false, error: message })
  }
}

/** A GET makes it easy to confirm the URL and token are right from a browser. */
export async function GET(request: Request) {
  if (!authorizeMachineRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, message: 'TradingView webhook is reachable. POST a JSON alert body here.' })
}
