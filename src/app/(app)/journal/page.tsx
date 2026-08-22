import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { tradingModels } from '@/db/schema'
import { Card, PageHeader, Stat, StatGrid } from '@/components/ui'
import { number } from '@/lib/format'
import { dailySeries } from '@/lib/analytics/metrics'
import { today } from '@/lib/time'
import { acceptChartReading, deleteSetup, readSetupChart, saveSetup } from '@/server/actions'
import { listSetups, setupStats } from '@/server/setups'
import { aiConfigured } from '@/server/ai'
import { Setups } from './setups'
import { getSettings } from '@/server/settings'
import { listTradesForStats } from '@/server/trades'
import { PnlCalendar } from './pnl-calendar'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Journal — Trading Journal' }

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>
}) {
  const params = await searchParams
  const [settings, trades, stats, models] = await Promise.all([
    getSettings(),
    listTradesForStats(),
    setupStats(),
    db
      .select({ id: tradingModels.id, name: tradingModels.name })
      .from(tradingModels)
      .where(eq(tradingModels.active, true))
      .orderBy(tradingModels.name),
  ])

  const ccy = settings.baseCurrency
  const todayStr = today(settings.timezone)
  const day = params.date ?? todayStr
  const daily = dailySeries(trades)
  const byDay = new Map(daily.map((point) => [point.day, point]))
  const dayStats = byDay.get(day)
  const setups = await listSetups(day)

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

  const shiftDay = (offset: number): string => {
    const date = new Date(`${day}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
  }

  // Calendar month: explicit ?month=, else the month of the selected day.
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : day.slice(0, 7)
  const calendarDays = new Map(daily.map((point) => [point.day, { netPnl: point.netPnl, trades: point.trades }]))
  // The calendar's mark now means "a trade was logged here", which is the
  // only thing this page records.
  const journaledDays = new Set(stats.days)

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Every trade as you took it: the levels, the model, the chart. The numbers are what make a review worth reading a month later."
        actions={
          <div className="flex items-center gap-2">
            <Link prefetch={false} href={`/journal?date=${shiftDay(-1)}`} className="btn px-2.5" aria-label="Previous day">
              ‹
            </Link>
            <Link
              href="/journal"
              className={day === todayStr ? 'btn pointer-events-none opacity-50' : 'btn'}
            >
              Today
            </Link>
            <Link
              prefetch={false}
              href={`/journal?date=${shiftDay(1)}`}
              className={day >= todayStr ? 'btn pointer-events-none px-2.5 opacity-50' : 'btn px-2.5'}
              aria-label="Next day"
            >
              ›
            </Link>
            <form method="get" className="flex items-center gap-2">
              <input name="date" type="date" defaultValue={day} className="input w-40" />
              <button type="submit" className="btn">
                Go
              </button>
            </form>
          </div>
        }
      />

      <StatGrid columns={4}>
        <Card bodyClassName="p-4">
          <Stat label="Logged this day" value={String(setups.length)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Trades logged"
            value={String(stats.total)}
            hint={`${stats.withChart} with a chart`}
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Average planned R"
            value={stats.avgRiskReward === null ? '—' : `${number(stats.avgRiskReward, 2)}R`}
            hint="across every setup logged"
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="That day's P&L"
            value={dayStats ? `${dayStats.netPnl >= 0 ? '+' : ''}${dayStats.netPnl.toFixed(0)}` : '—'}
            hint={dayStats ? `${dayStats.trades} trades` : 'No trades'}
            tone="pnl"
          />
        </Card>
      </StatGrid>

      <div className="mt-6">
        <PnlCalendar month={month} days={calendarDays} journaled={journaledDays} today={todayStr} ccy={ccy} />
      </div>

      <div className="mt-6">
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

    </>
  )
}
