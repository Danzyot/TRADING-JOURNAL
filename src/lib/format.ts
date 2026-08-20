/**
 * Display formatting.
 *
 * Kept in one place so a P&L number looks identical on the dashboard, in the
 * trade table and inside a tooltip — inconsistent formatting makes two equal
 * numbers look different, which is exactly the wrong signal in a journal.
 */

export function money(value: number | null | undefined, currency = 'USD', decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const symbol = currency === 'ILS' ? '₪' : currency === 'EUR' ? '€' : '$'
  const abs = Math.abs(value)
  return `${value < 0 ? '-' : ''}${symbol}${abs.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/** Compact form for axis ticks and dense tiles: $1.2k, $3.4M. */
export function moneyCompact(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const symbol = currency === 'ILS' ? '₪' : '$'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}k`
  return `${sign}${symbol}${abs.toFixed(0)}`
}

/** P&L always carries an explicit sign — "+$240" reads differently from "$240". */
export function signed(value: number | null | undefined, currency = 'USD', decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const formatted = money(Math.abs(value), currency, decimals)
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}

export function percent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(decimals)}%`
}

export function number(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function rMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}R`
}

/** Semantic class for a P&L figure. Never the only cue — a sign always rides along. */
export function pnlClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return 'text-[var(--ink-secondary)]'
  }
  return value > 0 ? 'text-[var(--good-text)]' : 'text-[var(--critical)]'
}

export function shortDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function longDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function relativeDays(day: string): string {
  const target = new Date(`${day}T00:00:00Z`).getTime()
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const days = Math.round((target - todayUtc) / 86_400_000)

  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 0) return `in ${days} days`
  return `${Math.abs(days)} days ago`
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export const CATEGORY_LABELS: Record<string, string> = {
  eval_fee: 'Evaluation fee',
  reset_fee: 'Reset fee',
  activation_fee: 'Activation fee',
  data_feed: 'Market data',
  platform_subscription: 'Platform subscription',
  software: 'Software',
  hardware: 'Hardware',
  education: 'Education',
  internet: 'Internet',
  phone: 'Phone',
  office: 'Office',
  travel: 'Travel',
  accounting: 'Accounting',
  bank_fees: 'Bank & FX fees',
  commission: 'Commissions',
  other: 'Other',
}

export const STATUS_LABELS: Record<string, string> = {
  osek_patur: 'Osek patur',
  osek_zair: 'Osek zair',
  osek_murshe: 'Osek murshe',
  company: 'Company (Ltd)',
  undecided: 'Not yet chosen',
}
