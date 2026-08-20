import { DrawdownChart, EquityChart, RDistributionChart, RankedBarChart } from '@/components/charts'
import { ActionButton } from '@/components/form'
import { BarRow, Card, EmptyState, KeyValue, PageHeader, SeverityIcon, Stat, StatGrid } from '@/components/ui'
import {
  byDirection,
  byDuration,
  byHour,
  byMistake,
  bySession,
  bySetup,
  bySize,
  bySymbol,
  byTag,
  byWeekday,
  computeMetrics,
  dailySeries,
  equityCurve,
  mistakeCost,
  type Bucket,
} from '@/lib/analytics/metrics'
import { money, number, percent, signed } from '@/lib/format'
import { secondsToHuman } from '@/lib/time'
import { dismissInsightAction, refreshInsights } from '@/server/actions'
import { listInsights } from '@/server/insights'
import { getSettings } from '@/server/settings'
import { listTradesForStats } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analytics — Trading Journal' }

export default async function AnalyticsPage() {
  const [settings, trades, insights] = await Promise.all([
    getSettings(),
    listTradesForStats(),
    listInsights(),
  ])

  const ccy = settings.baseCurrency
  const tz = settings.timezone
  const metrics = computeMetrics(trades)

  if (metrics.trades === 0) {
    return (
      <>
        <PageHeader title="Analytics" />
        <Card>
          <EmptyState
            title="No closed trades yet"
            body="Analytics needs trades to analyse. Import an export or connect a broker and this page fills in."
            action={{ href: '/import', label: 'Import trades' }}
          />
        </Card>
      </>
    )
  }

  const breakdowns: { title: string; description: string; buckets: Bucket[] }[] = [
    { title: 'By symbol', description: 'Which products actually pay you.', buckets: bySymbol(trades) },
    {
      title: 'By session',
      description: `Entry time in ${tz}. Often the single most actionable split.`,
      buckets: bySession(trades, tz),
    },
    { title: 'By weekday', description: 'Entry weekday, local time.', buckets: byWeekday(trades, tz) },
    { title: 'By hour', description: 'Entry hour, local time.', buckets: byHour(trades, tz) },
    { title: 'By direction', description: 'Long versus short.', buckets: byDirection(trades) },
    { title: 'By position size', description: 'Whether size follows conviction or emotion.', buckets: bySize(trades) },
    { title: 'By hold time', description: 'How long you stay in.', buckets: byDuration(trades) },
    { title: 'By setup', description: 'Requires setups to be recorded on trades.', buckets: bySetup(trades) },
    { title: 'By tag', description: 'Requires tags to be recorded on trades.', buckets: byTag(trades) },
    { title: 'By mistake', description: 'Requires mistakes to be tagged on trades.', buckets: byMistake(trades) },
  ]

  const rDistribution = buildRDistribution(trades.map((t) => t.rMultiple ?? null))
  const mistakes = mistakeCost(trades)

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`${metrics.trades} closed trades from ${metrics.firstTradeOn ?? '—'} to ${metrics.lastTradeOn ?? '—'}.`}
        actions={
          <ActionButton action={refreshInsights} className="btn btn-primary" pendingLabel="Analysing…">
            Refresh insights
          </ActionButton>
        }
      />

      <StatGrid columns={5}>
        <Card bodyClassName="p-4">
          <Stat label="Net P&L" value={signed(metrics.netPnl, ccy, 0)} tone="pnl" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Expectancy" value={signed(metrics.expectancy, ccy)} hint="per trade" tone="pnl" />
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
          <Stat label="Max drawdown" value={money(-metrics.maxDrawdown, ccy, 0)} tone="critical" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Recovery factor"
            value={metrics.recoveryFactor === null ? '—' : number(metrics.recoveryFactor)}
            hint="profit per unit of drawdown"
          />
        </Card>
      </StatGrid>

      {insights.length > 0 && (
        <div className="mt-6">
          <Card title="Findings" description="Rules run over your own trades. Each states its evidence." bodyClassName="divide-y divide-[var(--line)]">
            {insights.map((insight) => (
              <div key={insight.id} className="flex gap-3 p-4 first:pt-0 last:pb-0">
                <SeverityIcon severity={insight.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-sm font-medium text-[var(--ink)]">{insight.title}</h3>
                    {insight.impactBase !== null && (
                      <span className="tabular text-xs text-[var(--ink-muted)]">
                        {signed(insight.impactBase, ccy, 0)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-secondary)]">{insight.body}</p>
                </div>
                <ActionButton
                  action={async () => {
                    'use server'
                    return dismissInsightAction(insight.id)
                  }}
                  className="btn shrink-0 px-2 py-1 text-[var(--ink-muted)]"
                >
                  Dismiss
                </ActionButton>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Equity curve" className="xl:col-span-2">
          <EquityChart data={dailySeries(trades)} currency={ccy} height={280} />
        </Card>
        <Card title="Underwater" description="Distance below the high-water mark, trade by trade.">
          <DrawdownChart data={equityCurve(trades)} currency={ccy} height={280} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Distribution of R" description="The shape of the edge, not just its average.">
          {rDistribution.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--ink-muted)]">
              No stops recorded yet. Add a stop price on trades to unlock this.
            </p>
          ) : (
            <RDistributionChart data={rDistribution} height={220} />
          )}
        </Card>

        <Card title="The full picture">
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
        </Card>
      </div>

      {mistakes.length > 0 && (
        <div className="mt-4">
          <Card
            title="What each mistake has cost"
            description="Measured against what a clean trade returned over the same period."
          >
            {mistakes.map((entry) => (
              <BarRow
                key={entry.mistake}
                label={entry.mistake}
                value={entry.cost}
                max={Math.max(...mistakes.map((m) => Math.abs(m.cost)), 1)}
                currency={ccy}
                sublabel={`${entry.trades} trades`}
              />
            ))}
          </Card>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {breakdowns
          .filter((breakdown) => breakdown.buckets.length > 0)
          .map((breakdown) => (
            <Card key={breakdown.title} title={breakdown.title} description={breakdown.description}>
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
            </Card>
          ))}
      </div>
    </>
  )
}

/**
 * Buckets R-multiples for the distribution chart. The bands are deliberately
 * uneven — the interesting question is how often you take a full stop versus
 * how often a winner runs, not the fine detail between 3R and 4R.
 */
function buildRDistribution(values: (number | null)[]): { bucket: string; count: number; positive: boolean }[] {
  const bands: { label: string; min: number; max: number; positive: boolean }[] = [
    { label: '< -2R', min: -Infinity, max: -2, positive: false },
    { label: '-2R to -1R', min: -2, max: -1, positive: false },
    { label: '-1R to 0', min: -1, max: 0, positive: false },
    { label: '0 to 1R', min: 0, max: 1, positive: true },
    { label: '1R to 2R', min: 1, max: 2, positive: true },
    { label: '2R to 3R', min: 2, max: 3, positive: true },
    { label: '> 3R', min: 3, max: Infinity, positive: true },
  ]

  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (present.length === 0) return []

  return bands.map((band) => ({
    bucket: band.label,
    positive: band.positive,
    count: present.filter((value) => value > band.min && value <= band.max).length,
  }))
}
