'use client'

import { useEffect, useState } from 'react'
import { moneyCompact } from '@/lib/format'
import { outcomeOf, type Outcome } from '@/lib/analytics/metrics'
import type { CalendarTrade } from '@/server/trades'

export type CalendarDay = { netPnl: number; trades: number; list: CalendarTrade[] }

/** W, BE or L — the same band the rest of the site counts by. */
const MARK: Record<Outcome, { text: string; className: string }> = {
  win: { text: 'W', className: 'bg-[var(--good)] text-white' },
  loss: { text: 'L', className: 'bg-[var(--critical)] text-white' },
  breakEven: { text: 'BE', className: 'bg-[var(--ink-muted)] text-white' },
}

const TONE: Record<Outcome, string> = {
  win: 'text-[var(--good-text)]',
  loss: 'text-[var(--critical)]',
  breakEven: 'text-[var(--ink-secondary)]',
}

/**
 * The month at a glance: one cell per day, tinted by that day's net P&L with
 * intensity scaled to the month's largest day, and a weekly total on the
 * right — the copier-platform report view, but every cell clicks through to
 * that day's setups.
 *
 * Paging between months is local state, not navigation. Every day of history
 * is already in `days`, so asking the server to re-render the whole journal
 * just to draw a different grid of the same data made flicking back through
 * the year feel like a page load each time — which it was.
 *
 * Picking a day does not navigate either — it hands the date upward, and the
 * caller opens that day in place. Re-rendering the entire journal to show a
 * handful of rows was the same waste as paging the months.
 */
export function PnlCalendar({
  month,
  days,
  journaled,
  today,
  ccy,
  onPickDay,
}: {
  /** YYYY-MM */
  month: string
  /** tradingDay → stats */
  days: Map<string, CalendarDay>
  /** days with a journal entry get a marker */
  journaled: Set<string>
  today: string
  ccy: string
  /** Called with a YYYY-MM-DD when a day cell is pressed. */
  onPickDay: (date: string) => void
}) {
  // Seeded from the server's month, and re-synced whenever it changes — the
  // server decides the month when a day is picked or a link is opened.
  const [visible, setVisible] = useState(month)
  useEffect(() => setVisible(month), [month])

  const [yearStr, monthStr] = visible.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1

  const first = new Date(Date.UTC(year, monthIndex, 1))
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

  const iso = (day: number): string =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // Sunday-first weeks, matching the CME week that opens Sunday evening.
  const leading = first.getUTCDay()
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const monthMax = Math.max(
    1,
    ...Array.from(days.entries())
      .filter(([day]) => day.startsWith(visible))
      .map(([, stats]) => Math.abs(stats.netPnl)),
  )

  const prev = new Date(Date.UTC(year, monthIndex - 1, 1))
  const next = new Date(Date.UTC(year, monthIndex + 1, 1))
  const monthParam = (date: Date): string =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  const monthLabel = first.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-[var(--ink)]">{monthLabel}</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVisible(monthParam(prev))}
            className="btn px-2.5"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setVisible(monthParam(next))}
            className="btn px-2.5"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="scroll-x">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                <th
                  key={label}
                  className="px-1 py-2 text-center text-[0.625rem] font-medium uppercase tracking-wide text-[var(--ink-muted)]"
                >
                  {label}
                </th>
              ))}
              <th className="border-l border-[var(--line)] px-1 py-2 text-center text-[0.625rem] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                Week
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => {
              const weekStats = week.reduce(
                (acc, day) => {
                  const stats = day === null ? undefined : days.get(iso(day))
                  return stats
                    ? { netPnl: acc.netPnl + stats.netPnl, trades: acc.trades + stats.trades }
                    : acc
                },
                { netPnl: 0, trades: 0 },
              )
              return (
                <tr key={weekIndex}>
                  {week.map((day, dayIndex) => {
                    if (day === null) return <td key={dayIndex} className="p-0.5" />
                    const date = iso(day)
                    const stats = days.get(date)
                    const dayResult = stats ? outcomeOf(stats.netPnl) : null
                    const intensity = stats ? Math.min(1, Math.abs(stats.netPnl) / monthMax) : 0
                    // A break-even day gets no colour: the point of the band is
                    // that flat is flat, and a green wash on +$12 says otherwise.
                    const tint =
                      stats && dayResult && dayResult !== 'breakEven'
                        ? `color-mix(in srgb, ${
                            dayResult === 'win' ? 'var(--good)' : 'var(--critical)'
                          } ${Math.round(8 + intensity * 26)}%, transparent)`
                        : undefined
                    return (
                      <td key={dayIndex} className="p-0.5 align-top">
                        {/* Not one big button any more: the strip of charts in
                            the middle scrolls, and a swipe inside a button is
                            read as a press. The day number and the total are
                            the buttons; the strip carries its own. */}
                        <div
                          className="flex h-[6.25rem] w-full flex-col rounded-md border p-1 text-left"
                          style={{
                            background: tint ?? 'var(--surface-sunken)',
                            borderColor: date === today ? 'var(--accent)' : 'var(--line)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => onPickDay(date)}
                            className="flex items-center justify-between px-0.5 text-[0.6875rem] text-[var(--ink-muted)]"
                          >
                            {day}
                            {journaled.has(date) && (
                              <span aria-label="journalled" title="Journal entry written" className="text-[var(--accent)]">
                                ✎
                              </span>
                            )}
                          </button>

                          <div className="min-h-0 flex-1 py-0.5">
                            {stats && stats.list.length > 0 && (
                              <div
                                className="scroll-x flex h-full snap-x items-center gap-1 overscroll-x-contain"
                                aria-label={`${stats.list.length} trades`}
                              >
                                {stats.list.map((entry) => {
                                  const mark = MARK[outcomeOf(entry.netPnl)]
                                  return (
                                    <button
                                      key={entry.id}
                                      type="button"
                                      onClick={() => onPickDay(date)}
                                      title={`${moneyCompact(entry.netPnl, ccy)} — open the day`}
                                      className="relative h-full w-11 shrink-0 snap-start overflow-hidden rounded border border-[var(--line)] bg-[var(--surface)]"
                                    >
                                      {entry.hasShot ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={`/api/trades/${entry.id}/screenshot`}
                                          alt=""
                                          loading="lazy"
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <span
                                          className={`tabular flex h-full w-full items-center justify-center text-[0.5625rem] font-medium ${
                                            TONE[outcomeOf(entry.netPnl)]
                                          }`}
                                        >
                                          {moneyCompact(entry.netPnl, ccy)}
                                        </span>
                                      )}
                                      <span
                                        className={`absolute left-0 top-0 rounded-br px-0.5 text-[0.5rem] font-bold leading-tight ${mark.className}`}
                                      >
                                        {mark.text}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {stats && dayResult && (
                            <button
                              type="button"
                              onClick={() => onPickDay(date)}
                              className={`tabular px-0.5 text-left text-xs font-semibold ${TONE[dayResult]}`}
                            >
                              {dayResult === 'breakEven' && Math.abs(stats.netPnl) < 1
                                ? moneyCompact(0, ccy)
                                : `${stats.netPnl >= 0 ? '+' : '−'}${moneyCompact(Math.abs(stats.netPnl), ccy)}`}
                            </button>
                          )}
                        </div>
                      </td>
                    )
                  })}
                  <td className="border-l border-[var(--line)] p-0.5 align-middle">
                    {weekStats.trades > 0 ? (
                      <div className="px-2 text-right">
                        <span className={`tabular block text-xs font-semibold ${TONE[outcomeOf(weekStats.netPnl)]}`}>
                          {weekStats.netPnl >= 0 ? '+' : '−'}
                          {moneyCompact(Math.abs(weekStats.netPnl), ccy)}
                        </span>
                        <span className="block text-[0.625rem] text-[var(--ink-muted)]">
                          {weekStats.trades} trades
                        </span>
                      </div>
                    ) : (
                      <span className="block px-2 text-right text-xs text-[var(--ink-muted)]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
