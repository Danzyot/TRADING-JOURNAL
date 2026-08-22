/**
 * Reads prop-firm spec sheets written for humans into typed numbers.
 *
 * Firms publish their rules as prose — "2 mini / 20 micro", "90 / 10",
 * "None — no minimum balance", "FREE" — and every firm words it differently.
 * This turns those strings into the fields an account actually needs, and
 * returns null wherever a value is genuinely absent rather than inventing a
 * zero: a plan with no daily loss limit and a plan with a $0 one are not the
 * same plan, and a zero would quietly become a rule the trader never had.
 *
 * Pure, and tested against the real strings from the source data.
 */

/** Words firms use to mean "this rule does not exist". */
const ABSENT = /^(—|-|n\/a|na|none|no|unlimited|—\s*$)/i

const isAbsent = (raw: string | undefined | null): boolean =>
  raw === undefined || raw === null || raw.trim() === '' || ABSENT.test(raw.trim())

/** "$1,250" · "$98.00" · "FREE" → 1250 · 98 · 0. Absent stays null. */
export function parseMoney(raw: string | undefined | null): number | null {
  if (isAbsent(raw)) return null
  const text = raw!.trim()
  if (/^free$/i.test(text) || /\$0\b/.test(text)) return 0
  const match = /-?[\d,]+(?:\.\d+)?/.exec(text.replace(/\s/g, ''))
  if (!match) return null
  const value = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

/** "50%" → 0.5. Absent stays null, so "no consistency rule" survives. */
export function parsePercent(raw: string | undefined | null): number | null {
  if (isAbsent(raw)) return null
  const match = /(\d+(?:\.\d+)?)\s*%/.exec(raw!)
  return match ? Number(match[1]) / 100 : null
}

/** "90 / 10" · "90%" · "Up to 100%" → 0.9 · 0.9 · 1. */
export function parseSplit(raw: string | undefined | null): number | null {
  if (isAbsent(raw)) return null
  const match = /(\d+(?:\.\d+)?)\s*(?:%|\/)/.exec(raw!.trim())
  if (!match) return null
  const percent = Number(match[1])
  return percent > 0 && percent <= 100 ? percent / 100 : null
}

export type DrawdownType = 'trailing_intraday' | 'trailing_eod' | 'static' | 'none'

/**
 * Which drawdown a plan runs. The distinction that matters is *when* the
 * threshold moves: intraday follows unrealised equity tick by tick, end-of-day
 * only settles at the close — the same account can pass one and blow the other.
 */
export function parseDrawdownType(raw: string | undefined | null): DrawdownType {
  if (isAbsent(raw)) return 'none'
  const text = raw!.toLowerCase()
  if (/intraday|real[- ]?time|live/.test(text)) return 'trailing_intraday'
  if (/eod|end of day|daily close|close/.test(text)) return 'trailing_eod'
  if (/static|fixed|absolute/.test(text)) return 'static'
  if (/trailing/.test(text)) return 'trailing_eod'
  return 'none'
}

/** "2 mini / 20 micro" · "12 contracts" → { mini, micro }. */
export function parseContracts(raw: string | undefined | null): { mini: number | null; micro: number | null } {
  if (isAbsent(raw)) return { mini: null, micro: null }
  const text = raw!.toLowerCase()

  const mini = /(\d+)\s*mini/.exec(text)
  const micro = /(\d+)\s*micro/.exec(text)
  if (mini || micro) {
    return { mini: mini ? Number(mini[1]) : null, micro: micro ? Number(micro[1]) : null }
  }

  // "12 contracts" — a single limit, which firms quote in minis.
  const plain = /(\d+)\s*(?:contracts?)?/.exec(text)
  return { mini: plain ? Number(plain[1]) : null, micro: null }
}

/** "2 days" · "5 days of $100+" · "None — pass in 1 day" → 2 · 5 · null. */
export function parseDays(raw: string | undefined | null): number | null {
  if (isAbsent(raw)) return null
  const match = /(\d+)\s*(?:\+\s*)?days?/i.exec(raw!)
  return match ? Number(match[1]) : null
}

/** The profit each winning day must clear: "5 days of $100+" → 100. */
export function parseWinningDayMinimum(raw: string | undefined | null): number | null {
  if (isAbsent(raw)) return null
  const match = /\$\s*([\d,]+)/.exec(raw!)
  return match ? Number(match[1].replace(/,/g, '')) : null
}

/** "25K" · "150K" · "$50,000" → 25000 · 150000 · 50000. */
export function parseSize(raw: string | undefined | null): number | null {
  if (isAbsent(raw)) return null
  const text = raw!.trim().replace(/[$,\s]/g, '')
  const scaled = /^(\d+(?:\.\d+)?)k$/i.exec(text)
  if (scaled) return Math.round(Number(scaled[1]) * 1000)
  const plain = /^(\d+(?:\.\d+)?)$/.exec(text)
  return plain ? Number(plain[1]) : null
}
