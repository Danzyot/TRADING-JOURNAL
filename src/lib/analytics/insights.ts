/**
 * The tips engine.
 *
 * Every insight here is a rule over the trader's own numbers, and every one of
 * them states the evidence that produced it. Generic advice ("cut losses, ride
 * winners") changes nothing; "your losers are held 3.4x longer than your
 * winners, and the 22 trades where that happened cost $1,840 against baseline"
 * is a specific, checkable claim about this account.
 *
 * Rules that fire on thin samples are worse than no rules at all — a 2-trade
 * "edge" is noise, and acting on it costs money. Each rule declares a minimum
 * sample and stays silent below it.
 */
import type { Account, Expense, Payout, Subscription } from '@/db/schema'
import { drawdownState, consistencyCheck } from '@/lib/propfirm/rules'
import {
  bySession,
  bySize,
  bySymbol,
  byWeekday,
  closedTrades,
  computeMetrics,
  dailySeries,
  isLoss,
  isWin,
  mistakeCost,
  type TradeLike,
} from './metrics'

export type GeneratedInsight = {
  key: string
  category: 'risk' | 'edge' | 'cost' | 'discipline' | 'tax' | 'account' | 'payout'
  severity: 'info' | 'good' | 'warn' | 'critical'
  title: string
  body: string
  impactBase: number | null
  evidence: Record<string, unknown>
}

export type InsightContext = {
  trades: TradeLike[]
  accounts: Account[]
  /** Equity history per account id, for drawdown proximity. */
  equityByAccount: Record<number, { day: string; equity: number; peakEquity?: number }[]>
  expenses: Expense[]
  subscriptions: Subscription[]
  payouts: Payout[]
  timezone: string
  /** Fraction of payouts set aside for tax. */
  reservePercent: number
  /** Turnover ceiling for the current VAT status, in base currency. */
  statusCeilingBase: number | null
  annualRevenueBase: number
}

const MIN_SAMPLE = 20
const MIN_BUCKET = 8

const money = (value: number): string =>
  `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const pct = (value: number): string => `${(value * 100).toFixed(0)}%`

export function generateInsights(context: InsightContext): GeneratedInsight[] {
  const out: GeneratedInsight[] = []
  const trades = closedTrades(context.trades)
  const metrics = computeMetrics(trades)

  out.push(...edgeInsights(trades, metrics, context))
  out.push(...costInsights(trades, metrics))
  out.push(...disciplineInsights(trades, metrics, context))
  out.push(...accountInsights(context))
  out.push(...moneyInsights(context))

  const rank = { critical: 0, warn: 1, good: 2, info: 3 }
  return out.sort((a, b) => {
    const bySeverity = rank[a.severity] - rank[b.severity]
    if (bySeverity !== 0) return bySeverity
    return Math.abs(b.impactBase ?? 0) - Math.abs(a.impactBase ?? 0)
  })
}

// ---------------------------------------------------------------------------

function edgeInsights(
  trades: TradeLike[],
  metrics: ReturnType<typeof computeMetrics>,
  context: InsightContext,
): GeneratedInsight[] {
  const out: GeneratedInsight[] = []
  if (metrics.trades < MIN_SAMPLE) {
    out.push({
      key: 'sample-too-small',
      category: 'edge',
      severity: 'info',
      title: `${metrics.trades} trades logged — too few to draw conclusions from`,
      body: `Performance statistics need somewhere around 100 trades before they say anything reliable, and edge-by-time-of-day or edge-by-setup needs more than that. Keep logging; the analytics here will start flagging real patterns as the sample grows. Until then, treat every number on this page as provisional.`,
      impactBase: null,
      evidence: { trades: metrics.trades },
    })
    return out
  }

  // --- Is there an edge at all? -------------------------------------------
  if (metrics.profitFactor !== null && metrics.profitFactor < 1) {
    out.push({
      key: 'negative-expectancy',
      category: 'edge',
      severity: 'critical',
      title: `Profit factor is ${metrics.profitFactor.toFixed(2)} — the strategy is losing money`,
      body: `Across ${metrics.trades} trades you have made ${money(metrics.grossProfit)} on winners and lost ${money(metrics.grossLoss)} on losers, for an expectancy of ${money(metrics.expectancy)} per trade. Size is not the problem and neither is discipline yet — there is nothing here to size up. Cut back to the smallest contract available and work on the entry criteria until this number is above 1.3 over at least 50 trades.`,
      impactBase: metrics.netPnl,
      evidence: {
        profitFactor: metrics.profitFactor,
        expectancy: metrics.expectancy,
        trades: metrics.trades,
      },
    })
  } else if (metrics.profitFactor !== null && metrics.profitFactor > 1.5) {
    out.push({
      key: 'healthy-edge',
      category: 'edge',
      severity: 'good',
      title: `Profit factor ${metrics.profitFactor.toFixed(2)} across ${metrics.trades} trades`,
      body: `Every ${money(1)} risked is returning ${money(metrics.profitFactor)}, with an expectancy of ${money(metrics.expectancy)} per trade and a ${pct(metrics.winRate)} win rate. That is a real edge. The job now is to not break it: keep the position sizing where it is until the sample doubles, because the fastest way to lose a working strategy is to scale it before the numbers are stable.`,
      impactBase: metrics.netPnl,
      evidence: { profitFactor: metrics.profitFactor, winRate: metrics.winRate },
    })
  }

  // --- Where the edge actually lives ---------------------------------------
  const sessions = bySession(trades, context.timezone).filter((b) => b.trades >= MIN_BUCKET)
  if (sessions.length >= 2) {
    const worst = sessions[sessions.length - 1]
    const best = sessions[0]
    if (worst.netPnl < 0 && best.netPnl > 0) {
      out.push({
        key: `session-drag-${worst.key}`,
        category: 'edge',
        severity: 'warn',
        title: `The ${worst.label} session has cost you ${money(Math.abs(worst.netPnl))}`,
        body: `Over ${worst.trades} trades in the ${worst.label} window you are down ${money(Math.abs(worst.netPnl))} at a ${pct(worst.winRate)} win rate, while ${best.label} has produced ${money(best.netPnl)} over ${best.trades} trades. Simply not trading the ${worst.label} window would have added ${money(Math.abs(worst.netPnl))} to your year without changing anything else about how you trade. That is the cheapest improvement available to you.`,
        impactBase: Math.abs(worst.netPnl),
        evidence: { worst, best },
      })
    }
  }

  const symbols = bySymbol(trades).filter((b) => b.trades >= MIN_BUCKET)
  const losingSymbol = symbols.find((b) => b.netPnl < 0 && b.trades >= MIN_BUCKET)
  if (losingSymbol && symbols.length > 1) {
    out.push({
      key: `symbol-drag-${losingSymbol.key}`,
      category: 'edge',
      severity: 'warn',
      title: `${losingSymbol.label} is a net loser for you`,
      body: `${losingSymbol.trades} trades in ${losingSymbol.label} have produced ${money(losingSymbol.netPnl)} at a ${pct(losingSymbol.winRate)} win rate. Different products move differently — what works on ${symbols[0].label} does not automatically transfer. Either treat ${losingSymbol.label} as a separate strategy with its own testing, or stop trading it.`,
      impactBase: Math.abs(losingSymbol.netPnl),
      evidence: { symbol: losingSymbol },
    })
  }

  const weekdays = byWeekday(trades, context.timezone).filter((b) => b.trades >= MIN_BUCKET)
  const worstDay = weekdays.slice().sort((a, b) => a.netPnl - b.netPnl)[0]
  if (worstDay && worstDay.netPnl < 0 && weekdays.length >= 3) {
    out.push({
      key: `weekday-drag-${worstDay.key}`,
      category: 'edge',
      severity: 'info',
      title: `${worstDay.label}s are costing you ${money(Math.abs(worstDay.netPnl))}`,
      body: `${worstDay.trades} trades on ${worstDay.label}s at a ${pct(worstDay.winRate)} win rate, netting ${money(worstDay.netPnl)}. Worth checking what is different about that day — scheduled economic releases, a lighter pre-market routine, or simply the tail end of a tiring week.`,
      impactBase: Math.abs(worstDay.netPnl),
      evidence: { weekday: worstDay },
    })
  }

  return out
}

// ---------------------------------------------------------------------------

function costInsights(
  trades: TradeLike[],
  metrics: ReturnType<typeof computeMetrics>,
): GeneratedInsight[] {
  const out: GeneratedInsight[] = []
  if (metrics.trades < MIN_SAMPLE) return out

  if (metrics.totalCosts === 0) {
    out.push({
      key: 'no-commission-recorded',
      category: 'cost',
      severity: 'warn',
      title: 'No commission is recorded on any trade',
      body: `Every trade in this journal shows zero cost, which is not what your statement says. Prop accounts pay roughly $1.20 to $4.00 round turn per contract depending on the product and the firm. Set the round-turn rate on each account in Settings so synced trades are costed properly — otherwise every strategy here looks better than it is, and a high-frequency one can look profitable while actually losing money.`,
      impactBase: null,
      evidence: { trades: metrics.trades },
    })
    return out
  }

  if (metrics.costRatio !== null && metrics.costRatio > 0.25) {
    out.push({
      key: 'cost-drag',
      category: 'cost',
      severity: metrics.costRatio > 0.4 ? 'critical' : 'warn',
      title: `Commissions eat ${pct(metrics.costRatio)} of your gross profit`,
      body: `You have paid ${money(metrics.totalCosts)} in commissions and fees against ${money(metrics.grossProfit)} of gross winnings, across ${metrics.volume} contracts. At this ratio the broker is taking a larger share of the edge than is sustainable. Two levers: trade fewer, better setups — your expectancy is ${money(metrics.expectancy)} per trade, so marginal trades are nearly free money for the broker and nothing for you — or hold winners longer so each round turn covers more ground.`,
      impactBase: metrics.totalCosts,
      evidence: {
        costRatio: metrics.costRatio,
        totalCosts: metrics.totalCosts,
        volume: metrics.volume,
      },
    })
  }

  return out
}

// ---------------------------------------------------------------------------

function disciplineInsights(
  trades: TradeLike[],
  metrics: ReturnType<typeof computeMetrics>,
  context: InsightContext,
): GeneratedInsight[] {
  const out: GeneratedInsight[] = []
  if (metrics.trades < MIN_SAMPLE) return out

  // --- Cutting winners, holding losers -------------------------------------
  if (
    metrics.avgWinHoldSeconds !== null &&
    metrics.avgLossHoldSeconds !== null &&
    metrics.avgWinHoldSeconds > 0 &&
    metrics.avgLossHoldSeconds > metrics.avgWinHoldSeconds * 1.4
  ) {
    const ratio = metrics.avgLossHoldSeconds / metrics.avgWinHoldSeconds
    out.push({
      key: 'holding-losers',
      category: 'discipline',
      severity: 'warn',
      title: `You hold losers ${ratio.toFixed(1)}x longer than winners`,
      body: `Average winner is held ${Math.round(metrics.avgWinHoldSeconds / 60)} minutes; average loser ${Math.round(metrics.avgLossHoldSeconds / 60)} minutes. This is the single most common pattern in a losing journal, and it is not a strategy problem — it is that closing a red trade means admitting it was wrong, and closing a green one feels safe. The fix is mechanical rather than emotional: put the stop in the moment you enter, and do not move it further away. Ever.`,
      impactBase: null,
      evidence: {
        avgWinHoldSeconds: metrics.avgWinHoldSeconds,
        avgLossHoldSeconds: metrics.avgLossHoldSeconds,
      },
    })
  }

  // --- Overtrading ---------------------------------------------------------
  const daily = dailySeries(trades)
  if (daily.length >= 10) {
    const median = [...daily].sort((a, b) => a.trades - b.trades)[Math.floor(daily.length / 2)].trades
    const threshold = Math.max(median + 1, 4)
    const busy = daily.filter((d) => d.trades > threshold)
    const calm = daily.filter((d) => d.trades <= threshold)

    if (busy.length >= 4 && calm.length >= 4) {
      const busyAvg = busy.reduce((s, d) => s + d.netPnl, 0) / busy.length
      const calmAvg = calm.reduce((s, d) => s + d.netPnl, 0) / calm.length
      if (calmAvg > busyAvg && busyAvg < 0) {
        out.push({
          key: 'overtrading',
          category: 'discipline',
          severity: 'warn',
          title: `Days with more than ${threshold} trades average ${money(busyAvg)}`,
          body: `On your ${calm.length} quieter days (${threshold} trades or fewer) you average ${money(calmAvg)}. On the ${busy.length} busy days you average ${money(busyAvg)}. Past a certain count you are no longer selecting setups, you are reacting to the screen. A hard cap of ${threshold} trades a day, enforced by closing the platform rather than by willpower, is worth roughly ${money((calmAvg - busyAvg) * busy.length)} over the period you have logged.`,
          impactBase: (calmAvg - busyAvg) * busy.length,
          evidence: { threshold, busyAvg, calmAvg, busyDays: busy.length },
        })
      }
    }
  }

  // --- Revenge trading -----------------------------------------------------
  const ordered = trades.slice().sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime())
  const revenge: TradeLike[] = []
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1]
    if (!isLoss(previous) || !previous.exitAt) continue
    const gapMinutes = (ordered[i].entryAt.getTime() - previous.exitAt.getTime()) / 60000
    if (gapMinutes >= 0 && gapMinutes <= 5 && ordered[i].tradingDay === previous.tradingDay) {
      revenge.push(ordered[i])
    }
  }

  if (revenge.length >= MIN_BUCKET) {
    const revengeAvg = revenge.reduce((s, t) => s + t.netPnl, 0) / revenge.length
    if (revengeAvg < metrics.expectancy) {
      out.push({
        key: 'revenge-trading',
        category: 'discipline',
        severity: revengeAvg < 0 ? 'critical' : 'warn',
        title: `Trades taken within 5 minutes of a loss average ${money(revengeAvg)}`,
        body: `${revenge.length} of your trades were opened inside five minutes of closing a losing one. They average ${money(revengeAvg)} against your overall ${money(metrics.expectancy)} per trade — a difference of ${money(metrics.expectancy - revengeAvg)} each, or ${money((metrics.expectancy - revengeAvg) * revenge.length)} in total. A ten-minute enforced break after any loss would have kept most of that. Set a timer; do not negotiate with it.`,
        impactBase: (metrics.expectancy - revengeAvg) * revenge.length,
        evidence: { count: revenge.length, revengeAvg, baseline: metrics.expectancy },
      })
    }
  }

  // --- Sizing up on tilt ---------------------------------------------------
  const sizes = bySize(trades).filter((b) => b.trades >= MIN_BUCKET)
  if (sizes.length >= 2) {
    const sorted = sizes.slice().sort((a, b) => a.key.localeCompare(b.key))
    const smallest = sorted[0]
    const largest = sorted[sorted.length - 1]
    if (largest.expectancy < 0 && smallest.expectancy > 0) {
      out.push({
        key: 'size-discipline',
        category: 'discipline',
        severity: 'warn',
        title: `Your largest positions have negative expectancy`,
        body: `At ${smallest.label} you average ${money(smallest.expectancy)} per trade over ${smallest.trades} trades. At ${largest.label} you average ${money(largest.expectancy)} over ${largest.trades}. Size should follow conviction, and conviction should follow the setup — when the biggest trades are the worst ones, size is usually following emotion instead: chasing a loss back, or pressing after a win. Fix the size rule before anything else, because this is the pattern that ends funded accounts.`,
        impactBase: Math.abs(largest.expectancy * largest.trades),
        evidence: { smallest, largest },
      })
    }
  }

  // --- Missing risk data ---------------------------------------------------
  const withRisk = trades.filter((t) => typeof t.rMultiple === 'number').length
  const riskCoverage = trades.length > 0 ? withRisk / trades.length : 0
  if (riskCoverage < 0.5) {
    out.push({
      key: 'missing-risk-data',
      category: 'discipline',
      severity: 'info',
      title: `Only ${pct(riskCoverage)} of trades have a stop recorded`,
      body: `Without an intended stop there is no R-multiple, and without R you cannot compare a 1-lot MNQ scalp to a 5-lot ES swing — profit alone conflates edge with position size. Recording the stop takes a second per trade and unlocks the most useful comparison in the journal. If you trade with bracket orders, the stop is already there; entering it here just makes it measurable.`,
      impactBase: null,
      evidence: { riskCoverage, withRisk, total: trades.length },
    })
  }

  // --- Named mistakes ------------------------------------------------------
  const mistakes = mistakeCost(trades).filter((m) => m.trades >= 3 && m.cost < 0)
  if (mistakes.length > 0) {
    const worst = mistakes[0]
    out.push({
      key: `mistake-${worst.mistake}`,
      category: 'discipline',
      severity: 'warn',
      title: `"${worst.mistake}" has cost about ${money(Math.abs(worst.cost))}`,
      body: `You tagged ${worst.trades} trades with this mistake, and against a clean trade of the same period they came in ${money(Math.abs(worst.cost))} worse in total. You already know what this one is — you named it yourself. That makes it the most tractable problem on this page.`,
      impactBase: worst.cost,
      evidence: { mistake: worst },
    })
  }

  // --- Streaks -------------------------------------------------------------
  if (metrics.currentStreak <= -4) {
    out.push({
      key: 'losing-streak',
      category: 'discipline',
      severity: 'critical',
      title: `${Math.abs(metrics.currentStreak)} losing trades in a row, right now`,
      body: `Your worst historical run is ${metrics.maxConsecutiveLosses}. Losing streaks happen to strategies with a genuine edge — at a ${pct(metrics.winRate)} win rate a run of ${Math.abs(metrics.currentStreak)} is statistically ordinary — but they are also what precedes account-ending decisions. Stop for the day. The setups will still be there tomorrow, and your judgment will be better.`,
      impactBase: null,
      evidence: { currentStreak: metrics.currentStreak, worstEver: metrics.maxConsecutiveLosses },
    })
  }

  return out
}

// ---------------------------------------------------------------------------

function accountInsights(context: InsightContext): GeneratedInsight[] {
  const out: GeneratedInsight[] = []

  for (const account of context.accounts) {
    if (account.status !== 'active') continue
    const history = context.equityByAccount[account.id] ?? []
    if (history.length === 0) continue

    const state = drawdownState(account, history)
    if (!Number.isFinite(state.room)) continue

    if (state.breached) {
      out.push({
        key: `drawdown-breached-${account.id}`,
        category: 'account',
        severity: 'critical',
        title: `${account.label} is at or through its drawdown line`,
        body: `Equity has reached the ${money(state.line)} threshold. Mark the account failed here so it stops distorting your live statistics, and log the evaluation fee as a business expense — it is deductible.`,
        impactBase: account.costBase,
        evidence: { state },
      })
    } else if (state.roomPercent < 0.25) {
      out.push({
        key: `drawdown-tight-${account.id}`,
        category: 'account',
        severity: 'warn',
        title: `${account.label} has ${money(state.room)} of drawdown room left`,
        body: `That is ${pct(state.roomPercent)} of the original allowance, with the line sitting at ${money(state.line)}${state.locked ? ' (locked — it no longer trails)' : ` and trailing your ${money(state.highWater)} high-water mark`}. Cut position size now rather than after the next loss: at this distance a single normal-sized losing trade can end the account. Trading the smallest contract until there is room again costs you very little and preserves the account.`,
        impactBase: state.room,
        evidence: { state, accountId: account.id },
      })
    }

    // Payout consistency, checked before the request rather than after refusal.
    if ((account.phase === 'funded' || account.phase === 'live') && account.consistencyPercent) {
      const dailyPnls = history.map((point, index) => ({
        day: point.day,
        netPnl: index === 0 ? point.equity - account.startingBalance : point.equity - history[index - 1].equity,
      }))
      const check = consistencyCheck(dailyPnls, account.consistencyPercent)
      if (check.applies && !check.passes) {
        out.push({
          key: `consistency-${account.id}`,
          category: 'payout',
          severity: 'warn',
          title: `${account.label} would fail its consistency rule today`,
          body: `Your best day (${check.bestDay?.day}, ${money(check.bestDay?.netPnl ?? 0)}) is ${pct(check.bestDayShare)} of total profit, against a ${pct(account.consistencyPercent)} limit. Requesting a payout now would likely be refused. About ${money(check.profitNeeded)} of additional profit spread across other days brings you into compliance — grind smaller days rather than chasing another big one, which only makes the ratio worse.`,
          impactBase: check.profitNeeded,
          evidence: { check, accountId: account.id },
        })
      }
    }
  }

  return out
}

// ---------------------------------------------------------------------------

function moneyInsights(context: InsightContext): GeneratedInsight[] {
  const out: GeneratedInsight[] = []
  const paid = context.payouts.filter((p) => p.status === 'paid')
  const payoutTotal = paid.reduce((sum, p) => sum + p.netAmountBase, 0)
  const reserved = paid.reduce((sum, p) => sum + p.taxReserved, 0)

  // --- Tax reserve ---------------------------------------------------------
  if (payoutTotal > 0) {
    const expected = payoutTotal * context.reservePercent
    if (reserved < expected * 0.9) {
      out.push({
        key: 'tax-reserve-short',
        category: 'tax',
        severity: 'critical',
        title: `Tax reserve is ${money(expected - reserved)} short`,
        body: `You have received ${money(payoutTotal)} in payouts and set aside ${money(reserved)}, against ${money(expected)} at your ${pct(context.reservePercent)} reserve rate. Nobody withholds tax on a prop payout — the full amount lands in your account and feels like yours, and the bill arrives months later as a single number. Move the difference to a separate account today. This is the most common way a profitable trading year turns into a debt.`,
        impactBase: expected - reserved,
        evidence: { payoutTotal, reserved, expected },
      })
    } else {
      out.push({
        key: 'tax-reserve-ok',
        category: 'tax',
        severity: 'good',
        title: `Tax reserve is on track at ${money(reserved)}`,
        body: `That covers ${pct(reserved / Math.max(1, payoutTotal))} of ${money(payoutTotal)} in payouts. Keep moving the reserve on the day each payout lands rather than at year end.`,
        impactBase: reserved,
        evidence: { payoutTotal, reserved },
      })
    }
  }

  // --- Approaching the turnover ceiling ------------------------------------
  if (context.statusCeilingBase && context.annualRevenueBase > context.statusCeilingBase * 0.8) {
    const over = context.annualRevenueBase > context.statusCeilingBase
    out.push({
      key: 'vat-ceiling',
      category: 'tax',
      severity: over ? 'critical' : 'warn',
      title: over
        ? 'You are over the turnover ceiling for your VAT status'
        : `You are at ${pct(context.annualRevenueBase / context.statusCeilingBase)} of your turnover ceiling`,
      body: over
        ? `Annual payouts of ${money(context.annualRevenueBase)} exceed the ceiling for osek patur / osek zair. Registration as osek murshe is mandatory, and the liability runs from the moment you crossed the line, not from year end — so the longer this sits, the larger the back-dated exposure. Speak to your accountant this week.`
        : `Annual payouts are ${money(context.annualRevenueBase)} against a ceiling of ${money(context.statusCeilingBase)}. Change status *before* the payout that would cross it, not after — crossing first means owing VAT on the excess out of your own pocket.`,
      impactBase: context.annualRevenueBase,
      evidence: { revenue: context.annualRevenueBase, ceiling: context.statusCeilingBase },
    })
  }

  // --- Evaluation ROI per firm ---------------------------------------------
  const spendByFirm = new Map<number, number>()
  for (const expense of context.expenses) {
    if (!expense.firmId) continue
    if (!['eval_fee', 'reset_fee', 'activation_fee'].includes(expense.category)) continue
    spendByFirm.set(expense.firmId, (spendByFirm.get(expense.firmId) ?? 0) + expense.amountBase)
  }
  const payoutByFirm = new Map<number, number>()
  for (const payout of paid) {
    if (!payout.firmId) continue
    payoutByFirm.set(payout.firmId, (payoutByFirm.get(payout.firmId) ?? 0) + payout.netAmountBase)
  }

  for (const [firmId, spend] of spendByFirm) {
    if (spend < 300) continue
    const received = payoutByFirm.get(firmId) ?? 0
    const firm = context.accounts.find((a) => a.firmId === firmId)
    const name = firm?.label ?? `Firm #${firmId}`
    if (received < spend) {
      out.push({
        key: `firm-roi-${firmId}`,
        category: 'cost',
        severity: 'warn',
        title: `You are ${money(spend - received)} down with this firm`,
        body: `${money(spend)} spent on evaluations, resets and activations against ${money(received)} received in payouts (accounts include ${name}). Evaluation fees are a real cost of doing business and they compound quietly — three resets a month is a subscription you did not intend to buy. Either the strategy needs to clear the evaluation more reliably, or this firm's rules do not suit how you trade.`,
        impactBase: received - spend,
        evidence: { spend, received, firmId },
      })
    }
  }

  // --- Dormant subscriptions ----------------------------------------------
  const annualSubs = context.subscriptions
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.amount * cadenceMultiplier(s.cadence), 0)
  if (annualSubs > 0) {
    out.push({
      key: 'subscription-load',
      category: 'cost',
      severity: annualSubs > payoutTotal * 0.25 && payoutTotal > 0 ? 'warn' : 'info',
      title: `Recurring costs run ${money(annualSubs)} a year`,
      body: `${context.subscriptions.filter((s) => s.active).length} active subscriptions across data feeds, platforms and copiers${payoutTotal > 0 ? `, against ${money(payoutTotal)} of payouts — ${pct(annualSubs / payoutTotal)} of gross income` : ''}. All of it is deductible against Israeli business income, so keep every invoice. Review anything you have not opened in a month: recurring costs are the easiest money in this business to leave on the table.`,
      impactBase: annualSubs,
      evidence: { annualSubs, count: context.subscriptions.filter((s) => s.active).length },
    })
  }

  return out
}

function cadenceMultiplier(cadence: Subscription['cadence']): number {
  switch (cadence) {
    case 'weekly':
      return 52
    case 'monthly':
      return 12
    case 'quarterly':
      return 4
    case 'annual':
      return 1
  }
}
