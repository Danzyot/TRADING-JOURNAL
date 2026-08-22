import { money } from '@/lib/format'

/**
 * The twice-daily check-in, as text.
 *
 * A notification you receive every day regardless of whether anything happened
 * is one you stop reading, so this returns `null` far more often than it
 * returns a message. The morning check never speaks on its own — payouts and
 * account changes announce themselves as the inbox is read — and the evening
 * check only speaks when the day was actually traded, or when it is Friday and
 * there is a week to summarise.
 *
 * Pure: the caller gathers the numbers, this decides whether they are worth a
 * buzz and how to say it.
 */

export type DayStats = {
  pnl: number
  wins: number
  losses: number
  trades: number
}

export type WeekStats = {
  /** Split because a good week on evaluations is not the same as a paid week. */
  evalPnl: number
  fundedPnl: number
  wins: number
  losses: number
  passed: number
  failed: number
  payoutCount: number
  payoutTotal: number
  expenses: number
}

export type DigestInput = {
  slot: 'morning' | 'evening'
  isFriday: boolean
  currency: string
  /** Null when the day was not traded. */
  today: DayStats | null
  /** Only gathered for the Friday evening wrap. */
  week: WeekStats | null
}

export type Digest = {
  title: string
  body: string
  url: string
  tag: string
}

const signed = (value: number, currency: string): string =>
  `${value >= 0 ? '+' : '−'}${money(Math.abs(value), currency, 0)}`

/** "3W/2L (60%)" — and nothing at all when there were no closed trades. */
export function record(wins: number, losses: number): string | null {
  const total = wins + losses
  if (total === 0) return null
  return `${wins}W/${losses}L (${Math.round((wins / total) * 100)}%)`
}

function weekHadActivity(week: WeekStats): boolean {
  return (
    week.wins + week.losses > 0 ||
    week.passed + week.failed > 0 ||
    week.payoutCount > 0 ||
    week.expenses > 0 ||
    week.evalPnl !== 0 ||
    week.fundedPnl !== 0
  )
}

export function buildDigest(input: DigestInput): Digest | null {
  // Mornings are for the inbox, not for a summary: anything worth knowing
  // before the session arrived overnight and was pushed when it was read.
  if (input.slot === 'morning') return null

  const lines: string[] = []

  if (input.today && input.today.trades > 0) {
    const scoreline = record(input.today.wins, input.today.losses)
    lines.push(
      [
        `Today ${signed(input.today.pnl, input.currency)}`,
        `${input.today.trades} trade${input.today.trades === 1 ? '' : 's'}`,
        scoreline,
      ]
        .filter(Boolean)
        .join(' · '),
    )
  }

  const week = input.isFriday && input.week && weekHadActivity(input.week) ? input.week : null
  if (week) {
    const total = week.evalPnl + week.fundedPnl
    lines.push(
      `Week ${signed(total, input.currency)} — evals ${signed(week.evalPnl, input.currency)}, funded ${signed(
        week.fundedPnl,
        input.currency,
      )}`,
    )

    const second = [record(week.wins, week.losses)]
    if (week.passed > 0 || week.failed > 0) {
      second.push(`${week.passed} passed, ${week.failed} failed`)
    }
    if (second.filter(Boolean).length > 0) lines.push(second.filter(Boolean).join(' · '))

    // Net is payouts less costs — the number that actually reached you this
    // week, which is a different question from how the accounts traded.
    const net = week.payoutTotal - week.expenses
    lines.push(
      `Payouts ${money(week.payoutTotal, input.currency, 0)} (${week.payoutCount}) · Costs ${money(
        week.expenses,
        input.currency,
        0,
      )} · Net ${signed(net, input.currency)}`,
    )
  }

  if (lines.length === 0) return null

  return {
    title: week ? 'Friday wrap' : 'Evening check',
    body: lines.join('\n'),
    url: week ? '/trades' : '/',
    tag: week ? 'weekly' : 'evening',
  }
}
