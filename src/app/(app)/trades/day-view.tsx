'use client'

import { useCallback, useEffect, useState } from 'react'
import { PnlCalendar, type CalendarDay } from './pnl-calendar'
import { Setups, type ModelOption } from './setups'
import { Badge, clsx } from '@/components/ui'
import { money, number, shortDate } from '@/lib/format'
import type { ActionResult } from '@/server/actions'
import type { SetupSummary } from '@/server/setups'

type DayTrade = {
  id: number
  symbol: string
  direction: 'long' | 'short'
  qty: number
  avgEntry: number
  avgExit: number | null
  netPnl: number
  rMultiple: number | null
  account: string
}

type DayData = { date: string; setups: SetupSummary[]; trades: DayTrade[]; netPnl: number }

function shiftDay(date: string, offset: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offset)
  return value.toISOString().slice(0, 10)
}

/**
 * The calendar, and a day opened in place.
 *
 * Clicking a day used to navigate, which re-rendered the whole journal — every
 * chart, every breakdown, the import history — to show a handful of rows for
 * one date. The day is fetched instead and shown over the page, so stepping
 * through a week costs one small request each rather than a full page load,
 * and the page you came from is still underneath when you close it.
 */
export function DayView({
  month,
  days,
  journaled,
  today,
  ccy,
  models,
  saveAction,
  deleteAction,
  readAction,
  acceptAction,
  aiConfigured,
}: {
  month: string
  days: Map<string, CalendarDay>
  journaled: Set<string>
  today: string
  ccy: string
  models: ModelOption[]
  saveAction: (id: number | null, formData: FormData) => Promise<ActionResult>
  deleteAction: (id: number) => Promise<ActionResult>
  readAction: (id: number) => Promise<ActionResult>
  acceptAction: (id: number) => Promise<ActionResult>
  aiConfigured: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [data, setData] = useState<DayData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/day?date=${date}`, { credentials: 'same-origin' })
      if (!response.ok) throw new Error(`That day could not be loaded (${response.status}).`)
      setData((await response.json()) as DayData)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That day could not be loaded.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open === null) return
    // Clear first, so stepping to the next day never shows the previous day's
    // rows under the new date.
    setData(null)
    void load(open)
  }, [open, load])

  // Escape closes, which is what every dialog on the web does.
  useEffect(() => {
    if (open === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  /**
   * Wraps a server action so the day reloads after it succeeds.
   *
   * The page underneath revalidates on its own, but this dialog holds fetched
   * data that nothing would otherwise refresh — a setup added here would not
   * appear until the dialog was closed and reopened.
   */
  const refreshing =
    <T extends unknown[]>(action: (...args: T) => Promise<ActionResult>) =>
    async (...args: T): Promise<ActionResult> => {
      const result = await action(...args)
      if (result.ok && open !== null) void load(open)
      return result
    }

  return (
    <>
      <PnlCalendar
        month={month}
        days={days}
        journaled={journaled}
        today={today}
        ccy={ccy}
        onPickDay={setOpen}
      />

      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Journal for ${open}`}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(null)
          }}
        >
          <div className="card w-full max-w-3xl shadow-lg">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ink)]">{shortDate(open)}</h2>
                <p className="text-xs text-[var(--ink-secondary)]">
                  {loading
                    ? 'Loading…'
                    : data
                      ? `${data.trades.length} trade${data.trades.length === 1 ? '' : 's'} · ${money(data.netPnl, ccy, 0)}`
                      : '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(shiftDay(open, -1))}
                  className="btn px-2.5"
                  aria-label="Previous day"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(today)}
                  className={today === open ? 'btn pointer-events-none opacity-50' : 'btn'}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(shiftDay(open, 1))}
                  className={open >= today ? 'btn pointer-events-none px-2.5 opacity-50' : 'btn px-2.5'}
                  aria-label="Next day"
                >
                  ›
                </button>
                <button type="button" onClick={() => setOpen(null)} className="btn" aria-label="Close">
                  ✕
                </button>
              </div>
            </header>

            <div className="max-h-[75vh] space-y-4 overflow-y-auto p-4">
              {error && <p className="text-xs text-[var(--critical)]">{error}</p>}

              {data && data.trades.length > 0 && (
                <div className="scroll-x">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">In</th>
                        <th className="text-right">Out</th>
                        <th className="text-right">R</th>
                        <th className="text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trades.map((trade) => (
                        <tr key={trade.id}>
                          <td className="font-medium text-[var(--ink)]">{trade.symbol}</td>
                          <td>
                            <Badge tone={trade.direction === 'long' ? 'good' : 'critical'}>
                              {trade.direction === 'long' ? 'Long' : 'Short'}
                            </Badge>
                          </td>
                          <td className="tabular text-right">{trade.qty}</td>
                          <td className="tabular text-right">{number(trade.avgEntry, 2)}</td>
                          <td className="tabular text-right">
                            {trade.avgExit === null ? '—' : number(trade.avgExit, 2)}
                          </td>
                          <td className="tabular text-right">
                            {trade.rMultiple === null ? '—' : `${number(trade.rMultiple, 2)}R`}
                          </td>
                          <td
                            className={clsx(
                              'tabular text-right font-medium',
                              trade.netPnl >= 0 ? 'text-[var(--good-text)]' : 'text-[var(--critical)]',
                            )}
                          >
                            {money(trade.netPnl, ccy)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data && (
                <Setups
                  day={data.date}
                  setups={data.setups}
                  models={models}
                  saveAction={refreshing(saveAction)}
                  deleteAction={refreshing(deleteAction)}
                  readAction={refreshing(readAction)}
                  acceptAction={refreshing(acceptAction)}
                  aiConfigured={aiConfigured}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
