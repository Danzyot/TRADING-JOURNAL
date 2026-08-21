import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { journalEntries } from '@/db/schema'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Card, EmptyState, PageHeader, Pnl, Stat, StatGrid } from '@/components/ui'
import { longDate, money, number, percent, shortDate } from '@/lib/format'
import { dailySeries } from '@/lib/analytics/metrics'
import { today } from '@/lib/time'
import { saveJournalEntry } from '@/server/actions'
import { getSettings } from '@/server/settings'
import { listTradesForStats } from '@/server/trades'
import { PnlCalendar } from './pnl-calendar'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Journal — Trading Journal' }

/** Stored as the same 1–5 the schema always had; the emoji is just the label. */
const MOODS = [
  { value: 5, emoji: '🔥', label: 'Great' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 1, emoji: '😡', label: 'Terrible' },
]

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>
}) {
  const params = await searchParams
  const [settings, trades, entries] = await Promise.all([
    getSettings(),
    listTradesForStats(),
    db.select().from(journalEntries).orderBy(desc(journalEntries.entryDate)).limit(60),
  ])

  const ccy = settings.baseCurrency
  const todayStr = today(settings.timezone)
  const day = params.date ?? todayStr
  const current = entries.find((entry) => entry.entryDate === day)
  const daily = dailySeries(trades)
  const byDay = new Map(daily.map((point) => [point.day, point]))
  const dayStats = byDay.get(day)
  const dayTrades = trades
    .filter((trade) => trade.tradingDay === day)
    .sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime())

  const shiftDay = (offset: number): string => {
    const date = new Date(`${day}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
  }

  // Calendar month: explicit ?month=, else the month of the selected day.
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : day.slice(0, 7)
  const calendarDays = new Map(daily.map((point) => [point.day, { netPnl: point.netPnl, trades: point.trades }]))
  const journaledDays = new Set(entries.map((entry) => entry.entryDate))

  const withEntries = entries.length
  const disciplineScores = entries.map((e) => e.discipline).filter((v): v is number => typeof v === 'number')
  const avgDiscipline = disciplineScores.length
    ? disciplineScores.reduce((sum, value) => sum + value, 0) / disciplineScores.length
    : null

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="A plan before the session and an honest review after it. The review is where the pattern gets found — the P&L only tells you it happened."
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
          <Stat label="Entries written" value={String(withEntries)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Journalling rate"
            value={daily.length > 0 ? percent(Math.min(1, withEntries / daily.length), 0) : '—'}
            hint="of your trading days"
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Average discipline"
            value={avgDiscipline === null ? '—' : `${number(avgDiscipline, 1)} / 5`}
            tone={avgDiscipline !== null && avgDiscipline >= 4 ? 'good' : 'neutral'}
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={longDate(day)} description="Write the plan before you trade; write the review before you close the laptop." className="lg:col-span-2">
          <ActionForm action={saveJournalEntry} className="space-y-4" key={day}>
            <input type="hidden" name="entryDate" value={day} />

            <Field label="Plan" hint="What you are looking for today, and what would make you sit out.">
              <textarea name="plan" rows={5} defaultValue={current?.plan ?? ''} className="textarea" />
            </Field>

            <Field label="Review" hint="What actually happened, and what you would do differently.">
              <textarea name="review" rows={6} defaultValue={current?.review ?? ''} className="textarea" />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Market notes">
                <textarea name="marketNotes" rows={3} defaultValue={current?.marketNotes ?? ''} className="textarea" />
              </Field>
              <Field label="Lessons" hint="The one thing you want to remember.">
                <textarea name="lessons" rows={3} defaultValue={current?.lessons ?? ''} className="textarea" />
              </Field>
            </div>

            <Field label="How did you feel?">
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((mood) => (
                  <label key={mood.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="mood"
                      value={mood.value}
                      defaultChecked={current?.mood === mood.value}
                      className="peer sr-only"
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] transition-colors peer-checked:border-[var(--accent)] peer-checked:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] peer-checked:font-medium peer-checked:text-[var(--ink)] hover:border-[var(--line-strong)]">
                      <span aria-hidden>{mood.emoji}</span> {mood.label}
                    </span>
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Discipline" hint="1–5">
                <input
                  name="discipline"
                  type="number"
                  min="1"
                  max="5"
                  defaultValue={current?.discipline ?? ''}
                  className="input"
                />
              </Field>
              <Field label="Sleep (hours)">
                <input
                  name="sleepHours"
                  type="number"
                  step="0.5"
                  defaultValue={current?.sleepHours ?? ''}
                  className="input"
                />
              </Field>
              <Field label="Tags" hint="Comma separated">
                <input name="tags" defaultValue={current?.tags.join(', ') ?? ''} className="input" />
              </Field>
            </div>

            <SubmitButton>Save entry</SubmitButton>
          </ActionForm>

          {/* --- Trades closed on this day -------------------------------- */}
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <p className="text-xs font-semibold text-[var(--ink)]">
              Trades · {dayTrades.length}
            </p>
            {dayTrades.length === 0 ? (
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">No trades closed on this day.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--line)]">
                {dayTrades.map((trade) => (
                  <li key={trade.id} className="flex items-center justify-between gap-3 py-1.5">
                    <Link
                      href={trade.id !== undefined ? `/trades/${trade.id}` : '/trades'}
                      className="min-w-0 truncate text-xs text-[var(--ink)] hover:text-[var(--accent)]"
                    >
                      <span className="font-medium">{trade.symbol}</span>{' '}
                      <span className="text-[var(--ink-muted)]">
                        {trade.direction} · {trade.qty}
                        {trade.setup ? ` · ${trade.setup}` : ''}
                      </span>
                    </Link>
                    <span
                      className={`tabular shrink-0 text-xs font-medium ${
                        trade.netPnl >= 0 ? 'text-[var(--good-text)]' : 'text-[var(--critical)]'
                      }`}
                    >
                      {money(trade.netPnl, ccy)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card title="Recent entries" bodyClassName="p-0">
          {entries.length === 0 ? (
            <EmptyState title="Nothing written yet" body="Start with today. Three sentences beats a blank page." />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {entries.map((entry) => {
                const stats = byDay.get(entry.entryDate)
                return (
                  <li key={entry.id}>
                    <a
                      href={`/journal?date=${entry.entryDate}`}
                      className="block px-4 py-3 transition-colors hover:bg-[var(--surface-sunken)]"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--ink)]">{shortDate(entry.entryDate)}</span>
                        {stats && <Pnl value={stats.netPnl} currency={ccy} />}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                        {entry.review || entry.plan || 'No text'}
                      </p>
                      {entry.discipline && (
                        <p className="mt-1 text-[0.6875rem] text-[var(--ink-muted)]">
                          Discipline {entry.discipline}/5
                        </p>
                      )}
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
