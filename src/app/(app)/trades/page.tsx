import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { tradingModels } from '@/db/schema'
import { Badge, Card, EmptyState, PageHeader, Pnl, Stat, StatGrid } from '@/components/ui'
import { money, number, percent, rMultiple, shortDate } from '@/lib/format'
import { computeMetrics, dailySeries } from '@/lib/analytics/metrics'
import { secondsToHuman, today } from '@/lib/time'
import { getSettings } from '@/server/settings'
import { listAccounts, listTrades, listTradesForStats, toTradeLike } from '@/server/trades'
import { acceptChartReading, deleteSetup, readSetupChart, saveSetup } from '@/server/actions'
import { listSetups, setupStats } from '@/server/setups'
import { aiConfigured } from '@/server/ai'
import { PnlCalendar } from './pnl-calendar'
import { Setups } from './setups'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Journal — Trading Journal' }

const PAGE_SIZE = 100

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{
    account?: string
    symbol?: string
    from?: string
    to?: string
    page?: string
    date?: string
    month?: string
  }>
}) {
  const params = await searchParams
  const page = Math.max(0, Number(params.page ?? 0) || 0)

  const [settings, accounts, allTrades, stats, models] = await Promise.all([
    getSettings(),
    listAccounts(),
    listTradesForStats(),
    setupStats(),
    db
      .select({ id: tradingModels.id, name: tradingModels.name })
      .from(tradingModels)
      .where(eq(tradingModels.active, true))
      .orderBy(tradingModels.name),
  ])
  const accountId = params.account ? Number(params.account) : undefined

  const rows = await listTrades({
    accountIds: accountId ? [accountId] : undefined,
    symbols: params.symbol ? [params.symbol.toUpperCase()] : undefined,
    from: params.from,
    to: params.to,
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  })

  const hasNext = rows.length > PAGE_SIZE
  const trades = rows.slice(0, PAGE_SIZE)
  const metrics = computeMetrics(trades.map(toTradeLike))
  const accountName = (id: number): string => accounts.find((a) => a.id === id)?.label ?? `#${id}`
  const ccy = settings.baseCurrency

  // --- The journalling half: a day, its calendar, and the setups on it -----
  const todayStr = today(settings.timezone)
  const day = params.date ?? todayStr
  const daily = dailySeries(allTrades)
  const dayStats = daily.find((point) => point.day === day)
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : day.slice(0, 7)
  const calendarDays = new Map(
    daily.map((point) => [point.day, { netPnl: point.netPnl, trades: point.trades }]),
  )
  const setups = await listSetups(day)

  const shiftDay = (offset: number): string => {
    const date = new Date(`${day}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
  }

  async function saveSetupAction(id: number | null, formData: FormData) {
    'use server'
    return saveSetup(id, formData)
  }
  async function deleteSetupAction(id: number) {
    'use server'
    return deleteSetup(id)
  }
  async function readChartAction(id: number) {
    'use server'
    return readSetupChart(id)
  }
  async function acceptReadingAction(id: number) {
    'use server'
    return acceptChartReading(id)
  }

  const query = (overrides: Record<string, string | undefined>): string => {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value) next.set(key, String(value))
    }
    const search = next.toString()
    return search ? `/trades?${search}` : '/trades'
  }

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Every trade you took: the setups you logged, and the round trips built from your fills."
        actions={
          <Link href="/trades/new" className="btn btn-primary">
            Log a trade
          </Link>
        }
      />

      <StatGrid columns={4}>
        <Card bodyClassName="p-4">
          <Stat label="Trades shown" value={String(metrics.trades)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Net P&L" value={money(metrics.netPnl, ccy, 0)} tone="pnl" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Win rate" value={percent(metrics.winRate)} hint={`${metrics.wins}W / ${metrics.losses}L`} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Profit factor"
            value={metrics.profitFactor === null ? '—' : number(metrics.profitFactor)}
          />
        </Card>
      </StatGrid>

      <div className="mt-6">
        <PnlCalendar
          month={month}
          days={calendarDays}
          journaled={new Set(stats.days)}
          today={todayStr}
          ccy={ccy}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">{day}</h2>
        <div className="flex items-center gap-2">
          <Link
            prefetch={false}
            href={query({ date: shiftDay(-1) })}
            className="btn px-2.5"
            aria-label="Previous day"
          >
            ‹
          </Link>
          <Link
            href={query({ date: undefined })}
            className={day === todayStr ? 'btn pointer-events-none opacity-50' : 'btn'}
          >
            Today
          </Link>
          <Link
            prefetch={false}
            href={query({ date: shiftDay(1) })}
            className={day >= todayStr ? 'btn pointer-events-none px-2.5 opacity-50' : 'btn px-2.5'}
            aria-label="Next day"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="mt-3">
        <Setups
          day={day}
          setups={setups}
          models={models}
          saveAction={saveSetupAction}
          deleteAction={deleteSetupAction}
          readAction={readChartAction}
          acceptAction={acceptReadingAction}
          aiConfigured={aiConfigured()}
        />
      </div>

      <form method="get" className="card mt-6 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor="account">
            Account
          </label>
          <select id="account" name="account" defaultValue={params.account ?? ''} className="select">
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="label" htmlFor="symbol">
            Symbol
          </label>
          <input id="symbol" name="symbol" defaultValue={params.symbol ?? ''} className="input" placeholder="MNQ" />
        </div>
        <div className="w-40">
          <label className="label" htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={params.from ?? ''} className="input" />
        </div>
        <div className="w-40">
          <label className="label" htmlFor="to">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={params.to ?? ''} className="input" />
        </div>
        <button type="submit" className="btn">
          Filter
        </button>
        <Link href="/trades" className="btn">
          Reset
        </Link>
      </form>

      <div className="mt-4">
        <Card bodyClassName="p-0">
          {trades.length === 0 ? (
            <EmptyState
              title="No trades match"
              body="Import a CSV export or connect a broker, then trades appear here automatically."
              action={{ href: '/import', label: 'Import trades' }}
            />
          ) : (
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Entry</th>
                    <th className="text-right">Exit</th>
                    <th className="text-right">Net P&L</th>
                    <th className="text-right">R</th>
                    <th className="text-right">Hold</th>
                    <th>Setup</th>
                    <th>Account</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="tabular whitespace-nowrap">{shortDate(trade.tradingDay)}</td>
                      <td className="font-medium text-[var(--ink)]">{trade.symbol}</td>
                      <td>
                        <Badge tone={trade.direction === 'long' ? 'accent' : 'warn'}>
                          {trade.direction === 'long' ? 'Long' : 'Short'}
                        </Badge>
                      </td>
                      <td className="tabular text-right">{trade.qty}</td>
                      <td className="tabular text-right">{number(trade.avgEntry, 2)}</td>
                      <td className="tabular text-right">
                        {trade.avgExit === null ? (
                          <Badge tone="warn">Open</Badge>
                        ) : (
                          number(trade.avgExit, 2)
                        )}
                      </td>
                      <td className="text-right">
                        <Pnl value={trade.netPnl} currency={ccy} />
                      </td>
                      <td className="tabular text-right">{rMultiple(trade.rMultiple)}</td>
                      <td className="tabular whitespace-nowrap text-right">
                        {secondsToHuman(trade.durationSeconds)}
                      </td>
                      <td className="max-w-[140px] truncate">{trade.setup ?? '—'}</td>
                      <td className="max-w-[140px] truncate text-xs">{accountName(trade.accountId)}</td>
                      <td className="text-right">
                        <Link href={`/trades/${trade.id}`} className="text-xs text-[var(--accent)] hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {(page > 0 || hasNext) && (
        <div className="mt-4 flex items-center justify-between">
          {page > 0 ? (
            <Link href={query({ page: String(page - 1) })} className="btn">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-[var(--ink-muted)]">Page {page + 1}</span>
          {hasNext ? (
            <Link href={query({ page: String(page + 1) })} className="btn">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </>
  )
}
