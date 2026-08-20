'use client'

/**
 * Charts.
 *
 * Rules applied throughout, per the visualization guidance:
 *  - One y-axis, never two. Two measures of different scale get two charts.
 *  - Sign is encoded by position (above or below the baseline) as well as by
 *    colour, so the reading never rests on hue alone.
 *  - Grid and axes are recessive; the data is the only thing with weight.
 *  - Every chart has a hover layer, because a chart on a screen is interactive
 *    and a reader should be able to interrogate a point.
 *  - Colours come from the CSS custom properties, so both themes are correct
 *    without the component knowing which one is active.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { money, moneyCompact, shortDate } from '@/lib/format'

const AXIS_STYLE = { fontSize: 11, fill: 'var(--ink-muted)' }

function ChartTooltip({
  active,
  payload,
  label,
  currency = 'USD',
  formatLabel,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]
  label?: string | number
  currency?: string
  formatLabel?: (value: string | number) => string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="card-raised px-3 py-2 text-xs">
      {label !== undefined && (
        <p className="mb-1 font-medium text-[var(--ink)]">
          {formatLabel ? formatLabel(label) : String(label)}
        </p>
      )}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color ?? 'var(--accent)' }}
          />
          <span className="text-[var(--ink-secondary)]">{entry.name ?? entry.dataKey}</span>
          <span className="tabular ml-auto font-medium text-[var(--ink)]">
            {money(entry.value ?? 0, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Cumulative equity over time.
 *
 * Area rather than line: the fill communicates "accumulated", and a single
 * series needs no legend — the card title names it.
 */
export function EquityChart({
  data,
  currency = 'USD',
  height = 260,
}: {
  data: { day: string; cumulative: number }[]
  currency?: string
  height?: number
}) {
  if (data.length === 0) return <NoData height={height} />
  const ending = data[data.length - 1].cumulative
  const positive = ending >= 0
  const color = positive ? 'var(--good)' : 'var(--critical)'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="day" tickFormatter={shortDate} tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis
          tickFormatter={(value) => moneyCompact(value, currency)}
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <ReferenceLine y={0} stroke="var(--axis)" strokeWidth={1} />
        <Tooltip
          content={<ChartTooltip currency={currency} formatLabel={(value) => shortDate(String(value))} />}
          cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          name="Cumulative P&L"
          stroke={color}
          strokeWidth={2}
          fill="url(#equityFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/**
 * Daily P&L. Sign is carried by which side of the baseline the bar sits on,
 * with colour reinforcing rather than replacing that.
 */
export function DailyPnlChart({
  data,
  currency = 'USD',
  height = 220,
}: {
  data: { day: string; netPnl: number }[]
  currency?: string
  height?: number
}) {
  if (data.length === 0) return <NoData height={height} />

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="day" tickFormatter={shortDate} tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis
          tickFormatter={(value) => moneyCompact(value, currency)}
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <ReferenceLine y={0} stroke="var(--axis)" strokeWidth={1} />
        <Tooltip
          content={<ChartTooltip currency={currency} formatLabel={(value) => shortDate(String(value))} />}
          cursor={{ fill: 'var(--surface-sunken)' }}
        />
        <Bar dataKey="netPnl" name="Net P&L" radius={[3, 3, 0, 0]} maxBarSize={28}>
          {data.map((point, index) => (
            <Cell key={index} fill={point.netPnl >= 0 ? 'var(--good)' : 'var(--critical)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** The underwater curve — how far below the high-water mark equity has been. */
export function DrawdownChart({
  data,
  currency = 'USD',
  height = 180,
}: {
  data: { index: number; drawdown: number }[]
  currency?: string
  height?: number
}) {
  if (data.length === 0) return <NoData height={height} />

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--critical)" stopOpacity={0.05} />
            <stop offset="100%" stopColor="var(--critical)" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="index" tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis
          tickFormatter={(value) => moneyCompact(value, currency)}
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          content={<ChartTooltip currency={currency} formatLabel={(value) => `Trade #${value}`} />}
          cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          name="Below high-water"
          stroke="var(--critical)"
          strokeWidth={2}
          fill="url(#ddFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/**
 * Horizontal ranked bars — symbol, session, weekday, setup.
 * Labels sit on the axis, so the light-mode contrast relief is satisfied.
 */
export function RankedBarChart({
  data,
  currency = 'USD',
  height = 240,
}: {
  data: { label: string; netPnl: number }[]
  currency?: string
  height?: number
}) {
  if (data.length === 0) return <NoData height={height} />

  return (
    <ResponsiveContainer width="100%" height={Math.max(height, data.length * 32 + 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--grid)" />
        <XAxis
          type="number"
          tickFormatter={(value) => moneyCompact(value, currency)}
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          width={104}
        />
        <ReferenceLine x={0} stroke="var(--axis)" strokeWidth={1} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'var(--surface-sunken)' }} />
        <Bar dataKey="netPnl" name="Net P&L" radius={[0, 3, 3, 0]} maxBarSize={20}>
          {data.map((point, index) => (
            <Cell key={index} fill={point.netPnl >= 0 ? 'var(--good)' : 'var(--critical)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Distribution of R-multiples — the shape of the edge, not just its average. */
export function RDistributionChart({
  data,
  height = 200,
}: {
  data: { bucket: string; count: number; positive: boolean }[]
  height?: number
}) {
  if (data.length === 0) return <NoData height={height} />

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="bucket" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'var(--surface-sunken)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="card-raised px-3 py-2 text-xs">
                <p className="font-medium text-[var(--ink)]">{String(label)}</p>
                <p className="text-[var(--ink-secondary)]">{payload[0].value} trades</p>
              </div>
            ) : null
          }
        />
        <Bar dataKey="count" name="Trades" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {data.map((point, index) => (
            <Cell key={index} fill={point.positive ? 'var(--good)' : 'var(--critical)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Cumulative money in versus money out, as two separate lines on one scale. */
export function CashflowChart({
  data,
  currency = 'USD',
  height = 240,
}: {
  data: { month: string; payouts: number; expenses: number }[]
  currency?: string
  height?: number
}) {
  if (data.length === 0) return <NoData height={height} />

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={30} />
          <YAxis
            tickFormatter={(value) => moneyCompact(value, currency)}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: 'var(--line-strong)' }} />
          <Line
            type="monotone"
            dataKey="payouts"
            name="Payouts"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            name="Costs"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <Legend
        items={[
          { label: 'Payouts', color: 'var(--series-1)' },
          { label: 'Costs', color: 'var(--series-2)' },
        ]}
      />
    </>
  )
}

/** Two or more series always carry a legend; identity is never colour alone. */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function NoData({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-xs text-[var(--ink-muted)]"
      style={{ height }}
    >
      Not enough data yet
    </div>
  )
}
