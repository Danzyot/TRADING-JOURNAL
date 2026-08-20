import Link from 'next/link'
import { DailyPnlChart, EquityChart, RankedBarChart } from '@/components/charts'
import { ActionButton } from '@/components/form'
import {
  Badge,
  BarRow,
  Card,
  EmptyState,
  KeyValue,
  Meter,
  PageHeader,
  SeverityIcon,
  Stat,
  StatGrid,
} from '@/components/ui'
import { money, moneyCompact, number, percent, relativeDays, signed } from '@/lib/format'
import { secondsToHuman } from '@/lib/time'
import { SetupChecklist } from '@/components/setup-checklist'
import { refreshInsights, syncAllBrokers } from '@/server/actions'
import { getDashboardData } from '@/server/dashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard — Trading Journal' }

export default async function DashboardPage() {
  const data = await getDashboardData()
  const { metrics, baseCurrency: ccy } = data

  if (metrics.trades === 0 && data.accountCards.length === 0) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          subtitle="Everything on this page derives from your trades. The steps below get them in."
        />
        <SetupChecklist setup={data.setup} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${metrics.trades} closed trades across ${data.accountCards.length} active accounts.`}
        actions={
          <>
            <ActionButton action={refreshInsights} pendingLabel="Analysing…">
              Refresh insights
            </ActionButton>
            <ActionButton action={syncAllBrokers} className="btn btn-primary" pendingLabel="Syncing…">
              Sync brokers
            </ActionButton>
          </>
        }
      />

      {/* --- Headline numbers ---------------------------------------------- */}
      <StatGrid columns={5}>
        <Card bodyClassName="p-4">
          <Stat label="Today" value={signed(data.todayPnl, ccy, 0)} tone="pnl" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="This month" value={signed(data.monthPnl, ccy, 0)} tone="pnl" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="This year" value={signed(data.yearPnl, ccy, 0)} tone="pnl" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Expectancy"
            value={signed(metrics.expectancy, ccy)}
            hint="per trade"
            tone="pnl"
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Profit factor"
            value={metrics.profitFactor === null ? '—' : number(metrics.profitFactor)}
            hint={`${percent(metrics.winRate)} win rate`}
            tone={
              metrics.profitFactor === null
                ? 'neutral'
                : metrics.profitFactor >= 1.3
                  ? 'good'
                  : // Above 1.0 is profitable, just thin — red would overstate it.
                    metrics.profitFactor >= 1
                    ? 'warn'
                    : 'critical'
            }
          />
        </Card>
      </StatGrid>

      <div className="mt-6">
        <SetupChecklist setup={data.setup} />
      </div>

      {/* --- What needs attention ------------------------------------------ */}
      {data.insights.length > 0 && (
        <div className="mt-6">
          <Card
            title="What the numbers are telling you"
            description="Generated from your own trades and costs. Each one names its evidence."
            actions={
              <Link href="/analytics" className="text-xs text-[var(--accent)] hover:underline">
                All analytics →
              </Link>
            }
            bodyClassName="divide-y divide-[var(--line)]"
          >
            {data.insights.slice(0, 5).map((insight) => (
              <div key={insight.id} className="flex gap-3 p-4 first:pt-0 last:pb-0">
                <SeverityIcon severity={insight.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-[var(--ink)]">{insight.title}</h3>
                    <Badge tone="neutral">{insight.category}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-secondary)]">{insight.body}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* --- Curves --------------------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Cumulative net P&L" description="After commissions and fees." className="xl:col-span-2">
          <EquityChart data={data.daily} currency={ccy} height={280} />
        </Card>

        <Card title="Performance" bodyClassName="p-4">
          <div className="space-y-0">
            <KeyValue label="Net P&L" value={signed(metrics.netPnl, ccy)} />
            <KeyValue label="Gross P&L" value={signed(metrics.grossPnl, ccy)} />
            <KeyValue
              label="Costs"
              value={money(metrics.totalCosts, ccy)}
              hint={metrics.costRatio !== null ? `${percent(metrics.costRatio)} of gross profit` : undefined}
            />
            <KeyValue label="Average win" value={money(metrics.avgWin, ccy)} />
            <KeyValue label="Average loss" value={money(-metrics.avgLoss, ccy)} />
            <KeyValue
              label="Payoff ratio"
              value={metrics.payoffRatio === null ? '—' : `${number(metrics.payoffRatio)}:1`}
            />
            <KeyValue label="Max drawdown" value={money(-metrics.maxDrawdown, ccy)} />
            <KeyValue
              label="Expectancy in R"
              value={metrics.expectancyR === null ? '—' : `${number(metrics.expectancyR)}R`}
              hint={metrics.expectancyR === null ? 'Record stops to unlock' : undefined}
            />
            <KeyValue label="Avg hold" value={secondsToHuman(metrics.avgHoldSeconds)} />
            <KeyValue
              label="Streak"
              value={
                metrics.currentStreak === 0
                  ? '—'
                  : `${Math.abs(metrics.currentStreak)} ${metrics.currentStreak > 0 ? 'wins' : 'losses'}`
              }
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Daily net P&L" className="xl:col-span-2">
          <DailyPnlChart data={data.daily} currency={ccy} height={220} />
        </Card>

        <Card title="By session" description={`Times shown in ${data.timezone}.`}>
          <RankedBarChart
            data={data.bySession.map((bucket) => ({ label: bucket.label, netPnl: bucket.netPnl }))}
            currency={ccy}
            height={200}
          />
        </Card>
      </div>

      {/* --- Accounts ------------------------------------------------------- */}
      <div className="mt-6">
        <Card
          title="Active accounts"
          description="Ordered by how close each one is to its drawdown line."
          actions={
            <Link href="/accounts" className="text-xs text-[var(--accent)] hover:underline">
              Manage →
            </Link>
          }
          bodyClassName="p-0"
        >
          {data.accountCards.length === 0 ? (
            <EmptyState
              title="No active accounts"
              body="Add the accounts you are trading so drawdown, targets and payout eligibility are tracked."
              action={{ href: '/accounts', label: 'Add an account' }}
            />
          ) : (
            <div className="grid grid-cols-1 divide-y divide-[var(--line)] md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
              {data.accountCards.map((card) => {
                const room = card.drawdown.roomPercent
                const tone = room < 0.25 ? 'critical' : room < 0.5 ? 'warn' : 'good'

                return (
                  <div key={card.account.id} className="border-[var(--line)] p-4 md:border-r md:border-b">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{card.account.label}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {card.account.phase} · {moneyCompact(card.account.startingBalance, ccy)}
                        </p>
                      </div>
                      <Badge tone={tone}>
                        {Number.isFinite(card.drawdown.room)
                          ? `${moneyCompact(card.drawdown.room, ccy)} room`
                          : 'No limit'}
                      </Badge>
                    </div>

                    <div className="mt-3">
                      <Meter
                        value={room}
                        tone={tone}
                        label={
                          Number.isFinite(card.drawdown.line)
                            ? `Line at ${money(card.drawdown.line, ccy, 0)}${card.drawdown.locked ? ' · locked' : ''}`
                            : 'No drawdown limit set'
                        }
                      />
                    </div>

                    {card.account.profitTarget && card.account.phase === 'eval' && (
                      <div className="mt-3">
                        <Meter
                          value={card.progress.profitPercent}
                          tone="accent"
                          label={`${percent(card.progress.profitPercent, 0)} to target · ${money(card.progress.remaining, ccy, 0)} to go`}
                        />
                      </div>
                    )}

                    <div className="mt-3 flex items-baseline justify-between text-xs">
                      <span className="text-[var(--ink-muted)]">{card.trades} trades</span>
                      <span className="tabular font-medium text-[var(--ink)]">
                        {money(card.equity, ccy, 0)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* --- Money ---------------------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Money"
          actions={
            <Link href="/money" className="text-xs text-[var(--accent)] hover:underline">
              Details →
            </Link>
          }
        >
          <div className="space-y-0">
            <KeyValue label="Payouts received" value={money(data.money.payoutsPaid, ccy)} />
            <KeyValue label="Payouts pending" value={money(data.money.payoutsPending, ccy)} />
            <KeyValue label="Total costs" value={money(-data.money.expensesTotal, ccy)} />
            <KeyValue label="Evaluation spend" value={money(-data.money.evaluationSpend, ccy)} />
            <KeyValue
              label="Subscriptions"
              value={money(-data.money.subscriptionAnnual, ccy)}
              hint="annualised"
            />
            <KeyValue
              label="Net business result"
              value={signed(data.money.netBusinessResult, ccy)}
              hint="payouts less every cost"
            />
          </div>
        </Card>

        <Card
          title="Tax position"
          description={`${data.tax.year} estimate at your current status.`}
          actions={
            <Link href="/tax" className="text-xs text-[var(--accent)] hover:underline">
              Full picture →
            </Link>
          }
        >
          <div className="space-y-0">
            <KeyValue label="Revenue (payouts)" value={money(data.tax.revenue, ccy)} />
            <KeyValue label="Deductible costs" value={money(-data.tax.deductible, ccy)} />
            <KeyValue label="Estimated tax + NI" value={money(data.tax.estimatedTax, ccy)} />
            <KeyValue label="Reserved so far" value={money(data.tax.reservedSoFar, ccy)} />
            <KeyValue
              label="Shortfall"
              value={
                <span className={data.tax.shortfall > 0 ? 'text-[var(--critical)]' : 'text-[var(--good-text)]'}>
                  {data.tax.shortfall > 0 ? money(data.tax.shortfall, ccy) : 'None'}
                </span>
              }
            />
            <KeyValue label="Suggested reserve" value={percent(data.tax.reservePercent, 0)} />
          </div>
        </Card>

        <Card title="Top symbols">
          {data.bySymbol.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--ink-muted)]">No trades yet</p>
          ) : (
            <div>
              {data.bySymbol.map((bucket) => (
                <BarRow
                  key={bucket.key}
                  label={bucket.label}
                  value={bucket.netPnl}
                  max={Math.max(...data.bySymbol.map((b) => Math.abs(b.netPnl)), 1)}
                  currency={ccy}
                  sublabel={`${bucket.trades} trades`}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* --- Next actions ---------------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="What to do with the money" description="Priority order, based on your reserves and evaluation economics.">
          <div className="space-y-4">
            {data.advice.map((item, index) => (
              <div key={index} className="flex gap-3">
                <SeverityIcon severity={item.kind === 'fix' ? 'warn' : item.kind === 'grow' ? 'good' : 'info'} />
                <div>
                  <h3 className="text-sm font-medium text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-secondary)]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Upcoming renewals"
          description="Recurring costs due in the next 30 days."
          actions={
            <Link href="/money" className="text-xs text-[var(--accent)] hover:underline">
              Manage →
            </Link>
          }
        >
          {data.renewals.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--ink-muted)]">Nothing due in the next 30 days</p>
          ) : (
            <div className="space-y-0">
              {data.renewals.map((subscription) => (
                <KeyValue
                  key={subscription.id}
                  label={subscription.vendor}
                  hint={`${subscription.cadence} · renews ${relativeDays(subscription.nextRenewalOn)}`}
                  value={money(subscription.amount, subscription.currency)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
