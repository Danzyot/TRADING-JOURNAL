/**
 * Time handling.
 *
 * The subtle bug this module exists to prevent: "what day was that trade on?"
 * has no universal answer. The CME session opens at 18:00 New York and runs
 * past midnight, so a fill at 01:30 New York belongs to the *next* calendar
 * day's session. Prop firms evaluate daily loss limits and end-of-day drawdown
 * on their own boundary. Getting this wrong quietly misattributes P&L across
 * days and makes daily-limit analysis meaningless.
 *
 * `tradingDayFor` takes an instant, a timezone and a boundary, and answers
 * consistently everywhere in the app.
 */
import { format, parse, isValid } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export const DEFAULT_TIMEZONE = 'Asia/Jerusalem'

/**
 * The trading day an instant belongs to, as YYYY-MM-DD in `timezone`.
 *
 * With a boundary of "00:00" this is just the local calendar date. With
 * "18:00" — a CME-style session boundary — anything at or after 18:00 local
 * rolls forward into the next day.
 */
export function tradingDayFor(instant: Date, timezone = DEFAULT_TIMEZONE, boundary = '00:00'): string {
  const local = toZonedTime(instant, timezone)
  const [boundaryHour, boundaryMinute] = boundary.split(':').map(Number)

  if (boundaryHour || boundaryMinute) {
    const minutesIntoDay = local.getHours() * 60 + local.getMinutes()
    const boundaryMinutes = (boundaryHour || 0) * 60 + (boundaryMinute || 0)
    if (minutesIntoDay >= boundaryMinutes) local.setDate(local.getDate() + 1)
  }

  return format(local, 'yyyy-MM-dd')
}

export function formatInZone(instant: Date, timezone: string, pattern = 'yyyy-MM-dd HH:mm:ss'): string {
  return format(toZonedTime(instant, timezone), pattern)
}

/** Midnight local time on a YYYY-MM-DD, as a UTC instant. */
export function startOfDayInZone(day: string, timezone: string): Date {
  return fromZonedTime(`${day}T00:00:00`, timezone)
}

const DATE_PATTERNS = [
  "yyyy-MM-dd'T'HH:mm:ss.SSSX",
  "yyyy-MM-dd'T'HH:mm:ssX",
  "yyyy-MM-dd'T'HH:mm:ss",
  'yyyy-MM-dd HH:mm:ss.SSS',
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm',
  'yyyy-MM-dd',
  'MM/dd/yyyy HH:mm:ss.SSS',
  'MM/dd/yyyy HH:mm:ss',
  'MM/dd/yyyy HH:mm',
  'MM/dd/yyyy',
  'M/d/yyyy H:mm:ss',
  'M/d/yyyy H:mm',
  'M/d/yyyy',
  'dd/MM/yyyy HH:mm:ss',
  'dd/MM/yyyy HH:mm',
  'dd.MM.yyyy HH:mm:ss',
  'dd-MM-yyyy HH:mm:ss',
  'MM/dd/yy HH:mm:ss',
  'yyyyMMdd HH:mm:ss',
  'yyyyMMdd',
]

/**
 * Parses the many date shapes broker exports use.
 *
 * `assumeZone` matters: a CSV that prints "2026-03-04 09:31:00" with no offset
 * is in the exporting platform's timezone, which is usually the exchange's, not
 * the reader's. Guessing UTC here would shift every fill by hours.
 */
export function parseTimestamp(value: string | number | Date | null | undefined, assumeZone?: string): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return isValid(value) ? value : null

  if (typeof value === 'number') return fromEpoch(value)

  const raw = String(value).trim()
  if (!raw) return null

  if (/^\d{10}$/.test(raw) || /^\d{13}$/.test(raw)) return fromEpoch(Number(raw))

  // An explicit offset or trailing Z is unambiguous — trust it.
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)
  if (hasZone) {
    const direct = new Date(raw)
    if (isValid(direct)) return direct
  }

  for (const pattern of DATE_PATTERNS) {
    const parsed = parse(raw, pattern, new Date())
    if (isValid(parsed)) {
      if (!assumeZone) return parsed
      // Re-anchor the wall-clock reading into the source's timezone.
      return fromZonedTime(format(parsed, "yyyy-MM-dd'T'HH:mm:ss"), assumeZone)
    }
  }

  const fallback = new Date(raw)
  return isValid(fallback) ? fallback : null
}

function fromEpoch(value: number): Date | null {
  // Heuristic: 13 digits is milliseconds, 10 is seconds.
  const ms = value > 1e11 ? value : value * 1000
  const date = new Date(ms)
  return isValid(date) ? date : null
}

export function secondsToHuman(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

/** Inclusive list of YYYY-MM-DD dates. Used to pad sparse chart series. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function addMonths(day: string, months: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  const targetMonth = date.getUTCMonth() + months
  const dayOfMonth = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(targetMonth)
  // Clamp to the last valid day so 31 Jan + 1 month is 28/29 Feb, not 3 March.
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(dayOfMonth, lastDay))
  return date.toISOString().slice(0, 10)
}

export function today(timezone = DEFAULT_TIMEZONE): string {
  return format(toZonedTime(new Date(), timezone), 'yyyy-MM-dd')
}
