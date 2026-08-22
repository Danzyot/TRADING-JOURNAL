import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { importBatches, tradingModels } from '@/db/schema'
import { EquityChart, RankedBarChart } from '@/components/charts'
import {
  Badge,
  Card,
  CollapsibleCard,
  EmptyState,
  KeyValue,
  PageHeader,
  Pnl,
  Stat,
  StatGrid,
} from '@/components/ui'
import { money, number, percent, rMultiple, shortDate, signed } from '@/lib/format'
import {
  byDirection,
  byDuration,
  byHour,
  bySession,
  bySetup,
  bySize,
  bySymbol,
  byWeekday,
  computeMetrics,
  dailySeries,
  equityCurve,
  type Bucket,
} from '@/lib/analytics/metrics'
import { secondsToHuman, today } from '@/lib/time'
import { getSettings } from '@/server/settings'
import { listAccounts, listTrades, listTradesForStats, toTradeLike } from '@/server/trades'
import {
  acceptChartReading,
  deleteSetup,
  readSetupChart,
  saveSetup,
} from '@/server/actions'
import { setupStats } from '@/server/setups'
import { aiConfigured } from '@/server/ai'
import { ImportForm } from './import-form'
import { DayView } from './day-view'
import { OpenOnHash } from '@/components/open-on-hash'

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

  const [settings, accounts, allTrades, stats, batches, models] = await Promise.all([
    getSettings(),
    listAccounts(),
    listTradesForStats(),
    setupStats(),
    db.select().from(importBatches).orderBy(desc(importBatches.createdAt)).limit(20),
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
  // Two different populations, deliberately: the table shows one filtered page,
  // while the headline figures and every chart describe the whole history. A
  // profit factor that changed when you paged would be worthless.
  const shown = computeMetrics(trades.map(toTradeLike))
  const metrics = computeMetrics(allTrades)
  const accountName = (id: number): string => accounts.find((a) => a.id === id)?.label ?? `#${id}`
  // The import history stores a nullable account: a batch can outlive the
  // account it was imported into.
  const batchAccountName = (id: number | null): string => (id === null ? '—' : accountName(id))
  const ccy = settings.baseCurrency

  // --- The journalling half: a day, its calendar, and the setups on it -----
  const todayStr = today(settings.timezone)
  // `?date=` still opens a specific month, so a shared link lands in the right
  // place; the day itself is picked in the dialog.
  const day = params.date ?? todayStr
  const daily = dailySeries(allTrades)
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : day.slice(0, 7)
  const calendarDays = new Map(
    daily.map((point) => [point.day, { netPnl: point.netPnl, trades: point.trades }]),
  )

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

  // --- The analysis half ----------------------------------------------------
  const tz = settings.timezone
  const breakdowns: { title: string; description: string; buckets: Bucket[] }[] = [
    { title: 'By symbol', description: 'Which products actually pay you.', buckets: bySymbol(allTrades) },
    {
      title: 'By session',
      description: `Entry time in ${tz}. Often the single most actionable split.`,
      buckets: bySession(allTrades, tz),
    },
    { title: 'By weekday', description: 'Entry weekday, local time.', buckets: byWeekday(allTrades, tz) },
    { title: 'By hour', description: 'Entry hour, local time.', buckets: byHour(allTrades, tz) },
    { title: 'By direction', description: 'Long versus short.', buckets: byDirection(allTrades) },
    {
      title: 'By position size',
      description: 'Whether size follows conviction or emotion.',
      buckets: bySize(allTrades),
    },
    { title: 'By hold time', description: 'How long you stay in.', buckets: byDuration(allTrades) },
    { title: 'By setup', description: 'Requires setups to be recorded on trades.', buckets: bySetup(allTrades) },
  ]

  // One figure per folded section, so a closed header still answers its own
  // question. `equityCurve` is cumulative net P&L, so its peak is the
  // high-water mark and the gap to the last point is how far underwater the
  // account sits right now.
  const curve = equityCurve(allTrades)
  const peak = curve.length ? Math.max(...curve.map((point) => point.equity)) : 0
  const bestBucket = (buckets: Bucket[]): string => {
    const ranked = [...buckets].sort((a, b) => b.netPnl - a.netPnl)[0]
    return ranked ? `${ranked.label} ${signed(ranked.netPnl, ccy, 0)}` : '—'
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

      <StatGrid columns={5}>
        <Card bodyClassName="p-4">
          <Stat label="Net P&L" value={signed(metrics.netPnl, ccy, 0)} tone="pnl" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Win rate"
            value={percent(metrics.winRate)}
            hint={`${metrics.wins}W / ${metrics.losses}L`}
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Max drawdown" value={money(-metrics.maxDrawdown, ccy, 0)} tone="critical" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Profit factor"
            value={metrics.profitFactor === null ? '—' : number(metrics.profitFactor)}
            tone={
              metrics.profitFactor === null
                ? 'neutral'
                : metrics.profitFactor >= 1.3
                  ? 'good'
                  : metrics.profitFactor >= 1
                    ? 'warn'
                    : 'critical'
            }
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Expectancy" value={signed(metrics.expectancy, ccy)} hint="per trade" tone="pnl" />
        </Card>
      </StatGrid>


      <div className="mt-6">
        <DayView
          month={month}
          days={calendarDays}
          journaled={new Set(stats.days)}
          today={todayStr}
          ccy={ccy}
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
              action={{ href: '/trades#import', label: 'Import trades' }}
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

      {/* --- The analysis, folded: read once, then scrolled past ------- */}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <CollapsibleCard
          title="Equity curve"
          summary={`peak ${signed(peak, ccy, 0)}`}
          className="xl:col-span-2"
        >
          <EquityChart data={dailySeries(allTrades)} currency={ccy} height={280} />
        </CollapsibleCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">

        <CollapsibleCard
          title="Overview"
          summary={`${percent(metrics.winRate)} win rate`}
        >
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <div>
              <KeyValue label="Trades" value={String(metrics.trades)} />
              <KeyValue label="Wins / losses" value={`${metrics.wins} / ${metrics.losses}`} />
              <KeyValue label="Scratches" value={String(metrics.scratches)} />
              <KeyValue label="Win rate" value={percent(metrics.winRate)} />
              <KeyValue label="Average win" value={money(metrics.avgWin, ccy)} />
              <KeyValue label="Average loss" value={money(-metrics.avgLoss, ccy)} />
              <KeyValue
                label="Payoff ratio"
                value={metrics.payoffRatio === null ? '—' : `${number(metrics.payoffRatio)}:1`}
              />
              <KeyValue label="Largest win" value={money(metrics.largestWin, ccy)} />
              <KeyValue label="Largest loss" value={money(metrics.largestLoss, ccy)} />
            </div>
            <div>
              <KeyValue label="Gross profit" value={money(metrics.grossProfit, ccy)} />
              <KeyValue label="Gross loss" value={money(-metrics.grossLoss, ccy)} />
              <KeyValue label="Commission + fees" value={money(-metrics.totalCosts, ccy)} />
              <KeyValue
                label="Cost ratio"
                value={metrics.costRatio === null ? '—' : percent(metrics.costRatio)}
                hint="of gross profit"
              />
              <KeyValue label="Longest win streak" value={String(metrics.maxConsecutiveWins)} />
              <KeyValue label="Longest loss streak" value={String(metrics.maxConsecutiveLosses)} />
              <KeyValue label="Green / red days" value={`${metrics.greenDays} / ${metrics.redDays}`} />
              <KeyValue label="Trades per day" value={number(metrics.avgTradesPerDay, 1)} />
              <KeyValue
                label="Sharpe (daily, annualised)"
                value={metrics.sharpe === null ? '—' : number(metrics.sharpe)}
              />
              <KeyValue
                label="SQN"
                value={metrics.sqn === null ? '—' : number(metrics.sqn)}
                hint={
                  metrics.sqn === null
                    ? 'needs 10+ trades with stops recorded'
                    : metrics.sqn >= 3
                      ? 'excellent system quality'
                      : metrics.sqn >= 2
                        ? 'average system quality'
                        : metrics.sqn >= 1.6
                          ? 'below average — tradeable, thin'
                          : 'hard to trade — edge unstable'
                }
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <strong className="text-[var(--ink)]">Hold times.</strong> Winners average{' '}
            {secondsToHuman(metrics.avgWinHoldSeconds)}, losers {secondsToHuman(metrics.avgLossHoldSeconds)}.
            {metrics.avgWinHoldSeconds !== null &&
              metrics.avgLossHoldSeconds !== null &&
              metrics.avgLossHoldSeconds > metrics.avgWinHoldSeconds * 1.3 &&
              ' Losers being held materially longer than winners is the classic pattern — the stop goes in at entry and does not move.'}
            {metrics.kellyFraction !== null && (
              <>
                {' '}
                <strong className="text-[var(--ink)]">Kelly.</strong> Full Kelly on these numbers is{' '}
                {percent(metrics.kellyFraction)} of bankroll per trade — far too aggressive for a
                drawdown-capped account. A quarter of it, {percent(metrics.kellyFraction / 4)}, is the
                practical figure.
              </>
            )}
          </div>
        </CollapsibleCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {breakdowns
          .filter((breakdown) => breakdown.buckets.length > 0)
          .map((breakdown) => (
            <CollapsibleCard
              key={breakdown.title}
              title={breakdown.title}
              description={breakdown.description}
              summary={bestBucket(breakdown.buckets)}
            >
              <RankedBarChart
                data={breakdown.buckets.slice(0, 12).map((bucket) => ({
                  label: bucket.label,
                  netPnl: bucket.netPnl,
                }))}
                currency={ccy}
                height={180}
              />
              <div className="scroll-x mt-3">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{breakdown.title.replace('By ', '')}</th>
                      <th className="text-right">Trades</th>
                      <th className="text-right">Win rate</th>
                      <th className="text-right">Expectancy</th>
                      <th className="text-right">PF</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.buckets.slice(0, 12).map((bucket) => (
                      <tr key={bucket.key}>
                        <td className="font-medium text-[var(--ink)]">{bucket.label}</td>
                        <td className="tabular text-right">{bucket.trades}</td>
                        <td className="tabular text-right">{percent(bucket.winRate, 0)}</td>
                        <td className="tabular text-right">{signed(bucket.expectancy, ccy, 0)}</td>
                        <td className="tabular text-right">
                          {bucket.profitFactor === null ? '—' : number(bucket.profitFactor, 2)}
                        </td>
                        <td className="tabular text-right">{signed(bucket.netPnl, ccy, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleCard>
          ))}
      </div>

      {/* Lets /trades#import arrive with the section already open. */}
      <OpenOnHash />

      {/* --- Getting trades in -------------------------------------------- */}
      <div className="mt-4">
        <CollapsibleCard
          id="import"
          title="Import trades"
          description="From any platform's CSV export. Safe to re-run — anything already stored is skipped. The trade watcher in Settings does this from a folder on your computer, automatically."
          summary={batches.length === 0 ? "nothing imported yet" : `${batches.length} imports`}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {accounts.length === 0 ? (
                <Card>
                  <EmptyState
                    title="Add an account first"
                    body="Imported trades have to belong to an account, and the account's commission rate is what costs the fills correctly."
                    action={{ href: '/accounts', label: 'Add an account' }}
                  />
                </Card>
              ) : (
                <Card title="Upload an export">
                  <ImportForm accounts={accounts.map((a) => ({ id: a.id, label: a.label }))} />
                </Card>
              )}
            </div>

            <Card title="Where to find your export">
              <div className="space-y-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                <div>
                  <h3 className="text-sm font-medium text-[var(--ink)]">Tradovate</h3>
                  <p className="mt-1">
                    Web platform → Reports → Performance or Orders → export as CSV. The Performance report is
                    already paired into round trips; the Orders report is raw fills and gets matched here.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--ink)]">Rithmic (R|Trader Pro)</h3>
                  <p className="mt-1">
                    Orders or Fills window → right-click the grid → Export. Rithmic has no retail API — it is
                    licensed through your broker under a professional agreement — so CSV is the route here.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--ink)]">Tradecopia</h3>
                  <p className="mt-1">
                    Tradecopia connects outward to your brokers rather than offering an API to you, so import from
                    whichever broker it copied into — usually Tradovate or Rithmic. Copied accounts produce
                    near-identical fills, so import each one against its own account here to keep the statistics
                    honest rather than multiplied.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--ink)]">TradingView</h3>
                  <p className="mt-1">
                    Paper Trading or the Strategy Tester → List of Trades → export. Note that a TradingView order
                    routed to Tradovate also appears in the Tradovate export, so import from one source per
                    account, not both.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--ink)]">NinjaTrader</h3>
                  <p className="mt-1">Control Center → Trade Performance → right-click the grid → Export.</p>
                </div>
                <p className="rounded-lg bg-[var(--surface-sunken)] p-3">
                  Column names are resolved by alias, so an export whose headers have drifted still imports. If a
                  format is not recognised at all, the report will list the headers it could not place.
                </p>
              </div>
            </Card>
          </div>

          <div className="mt-6">
            <Card title="Import history" bodyClassName="p-0">
              {batches.length === 0 ? (
                <EmptyState title="Nothing imported yet" body="Your import history will appear here." />
              ) : (
                <div className="scroll-x">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>File</th>
                        <th>Format</th>
                        <th>Account</th>
                        <th className="text-right">Rows</th>
                        <th className="text-right">Imported</th>
                        <th className="text-right">Skipped</th>
                        <th className="text-right">Trades built</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch) => (
                        <tr key={batch.id}>
                          <td className="tabular whitespace-nowrap">
                            {shortDate(batch.createdAt.toISOString().slice(0, 10))}
                          </td>
                          <td className="max-w-[200px] truncate">{batch.filename ?? 'Pasted'}</td>
                          <td className="text-xs">{batch.source}</td>
                          <td className="max-w-[140px] truncate text-xs">{batchAccountName(batch.accountId)}</td>
                          <td className="tabular text-right">{batch.rowsSeen}</td>
                          <td className="tabular text-right">{batch.rowsImported}</td>
                          <td className="tabular text-right">{batch.rowsSkipped}</td>
                          <td className="tabular text-right">{batch.tradesBuilt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </CollapsibleCard>
      </div>
    </>
  )
}

