/**
 * What to do with a payout the day it lands.
 *
 * A payout is not income in the way a salary is. Part of it was never yours —
 * the tax authority is simply letting you hold it for a while. Part of it has to
 * go straight back into the business or the next failed evaluation stops you
 * trading. What remains after those two claims is the only part that is
 * genuinely a reward, and it is much smaller than the number on the wire.
 *
 * This engine makes that split automatic and, crucially, *ordered*: buckets fill
 * in sequence, each stops at its cap, and the overflow cascades to whatever
 * comes next. Nothing goes into long-term investing until the tax reserve and
 * the operating float are whole.
 */
import type { AllocationBucket, AllocationPlan } from '@/db/schema'

export type AllocationResult = {
  gross: number
  lines: {
    key: string
    label: string
    /** Share of the payout requested by the plan. */
    requested: number
    /** Share actually assigned after caps. */
    assigned: number
    /** Bucket balance once this payout is applied. */
    balanceAfter: number
    capBase: number | null
    capped: boolean
    color: string
    note: string
  }[]
  /** Left over after every bucket hit its cap. Sweeps to the last bucket. */
  unallocated: number
}

/**
 * A starting plan for a funded trader early in their career.
 *
 * The ordering is the opinionated part. Tax first because it is not your money.
 * Operating float second because running out of evaluation capital is the most
 * common way a working trader stops working. Emergency fund third because it is
 * what stops a bad month turning into revenge trading. Only then does anything
 * get spent or invested.
 */
export const DEFAULT_ALLOCATION_PLAN: AllocationPlan = {
  buckets: [
    {
      key: 'tax',
      label: 'Tax reserve',
      percent: 0.3,
      capBase: null,
      color: 'amber',
      note: 'Moved to a separate account the day the payout lands. Israeli business income carries income tax plus National Insurance, and there is no withholding — nobody takes it out for you. Under-reserving here is the single most common way a profitable trading year turns into a debt.',
    },
    {
      key: 'operating',
      label: 'Operating float',
      percent: 0.2,
      capBase: 6000,
      color: 'sky',
      note: 'Evaluations, resets, data feeds, platform subscriptions. Cap this at roughly six months of running costs — beyond that it is idle cash, and below it a losing streak costs you the ability to hold funded accounts at all.',
    },
    {
      key: 'emergency',
      label: 'Emergency fund',
      percent: 0.15,
      capBase: 40000,
      color: 'violet',
      note: 'Six months of personal living costs, held in cash or a money-market fund, never touched for trading. This is what lets you trade a drawdown without needing the next payout, and traders who need the next payout make the worst decisions.',
    },
    {
      key: 'invest',
      label: 'Long-term investing',
      percent: 0.2,
      capBase: null,
      color: 'emerald',
      note: 'A broad low-cost index fund, bought monthly, never sold. Trading income is volatile and has no compounding of its own; this is the part of the payout that turns a good few years into lasting capital. Keep it entirely separate from trading capital.',
    },
    {
      key: 'personal',
      label: 'Personal',
      percent: 0.15,
      capBase: null,
      color: 'rose',
      note: 'Living costs and the part you actually enjoy. Deliberately budgeted rather than whatever happens to be left, because a payout that funds no life at all is not sustainable either.',
    },
  ],
}

export function normalisePlan(plan: AllocationPlan | null | undefined): AllocationPlan {
  const buckets = plan?.buckets?.length ? plan.buckets : DEFAULT_ALLOCATION_PLAN.buckets
  const total = buckets.reduce((sum, bucket) => sum + bucket.percent, 0)
  if (total <= 0) return DEFAULT_ALLOCATION_PLAN
  // Rescale so the shares always sum to 1, whatever the user typed in.
  return { buckets: buckets.map((bucket) => ({ ...bucket, percent: bucket.percent / total })) }
}

/**
 * Splits a payout across the plan.
 *
 * `balances` carries the current value of each bucket so caps are enforced
 * against the running total rather than against this payout in isolation.
 */
export function allocatePayout(
  gross: number,
  plan: AllocationPlan | null | undefined,
  balances: Record<string, number> = {},
): AllocationResult {
  const { buckets } = normalisePlan(plan)
  const amount = Math.max(0, gross)

  const lines: AllocationResult['lines'] = []
  let remaining = amount
  // Anything a bucket refused, carried forward to the next one down the list.
  // A true waterfall: overflow only ever flows downstream, so a full emergency
  // fund quietly becomes more investing, and the tax reserve — which sits at the
  // top and is sized to a liability, not to spare cash — never absorbs more than
  // its share.
  let carry = 0

  for (const bucket of buckets) {
    const offered = Math.min(amount * bucket.percent + carry, remaining)
    const current = balances[bucket.key] ?? 0
    const headroom = bucket.capBase === null ? Infinity : Math.max(0, bucket.capBase - current)
    const assigned = Math.min(offered, headroom)

    lines.push({
      key: bucket.key,
      label: bucket.label,
      requested: round(offered),
      assigned: round(assigned),
      balanceAfter: round(current + assigned),
      capBase: bucket.capBase,
      capped: assigned < offered - 0.005,
      color: bucket.color,
      note: bucket.note,
    })

    carry = offered - assigned
    remaining -= assigned
  }

  // Only reachable when the final bucket is itself capped. Surfacing it beats
  // silently stuffing the money into a bucket the plan did not choose.
  return { gross: round(amount), lines, unallocated: round(Math.max(0, remaining)) }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------------------
// Deployment guidance
// ---------------------------------------------------------------------------

export type DeploymentContext = {
  /** Trailing 12-month payout total, base currency. */
  annualPayouts: number
  /** Trailing 12-month business costs, base currency. */
  annualCosts: number
  /** Current cash in the emergency bucket. */
  emergencyBalance: number
  /** Monthly personal living costs. */
  monthlyLiving: number
  /** Current cash in the operating bucket. */
  operatingBalance: number
  /** Number of funded accounts currently live. */
  fundedAccounts: number
  /** Cost of one evaluation at the firm being used. */
  evalCost: number
  /** Historical share of evaluations that reach funded. 0..1. */
  evalPassRate: number
}

export type DeploymentSuggestion = {
  priority: number
  title: string
  body: string
  /** 'fix' when something is unsafe, 'grow' when it is time to scale. */
  kind: 'fix' | 'grow' | 'hold'
}

/**
 * The "what should I do with this money" question, answered in priority order.
 *
 * The ordering is deliberately conservative: securing the downside always
 * outranks scaling the upside, because a funded trader who runs out of runway
 * stops being a funded trader, and no amount of expected value fixes that.
 */
export function deploymentAdvice(context: DeploymentContext): DeploymentSuggestion[] {
  const out: DeploymentSuggestion[] = []
  const monthlyBurn = context.annualCosts / 12

  // Before the first payout there is nothing to allocate, and every ratio below
  // divides by a number that does not exist yet. Saying so is more useful than
  // computing advice from a fabricated living cost.
  if (context.annualPayouts <= 0) {
    return [
      {
        priority: 1,
        kind: 'hold',
        title: 'No payouts yet — the plan starts with the first one',
        body: `Once a payout lands it is split automatically across your buckets: tax reserve first, then the operating float, then the emergency fund, then investing. ${
          monthlyBurn > 0
            ? `You are currently spending about ${fmt(monthlyBurn)} a month on evaluations, data and platforms, so that is the running cost the first payouts have to cover before anything is genuinely profit.`
            : 'Log your evaluation fees and subscriptions so the running cost of the business is visible against the first payout.'
        }`,
      },
    ]
  }

  const monthsOfRunway = context.monthlyLiving > 0 ? context.emergencyBalance / context.monthlyLiving : 0

  if (monthsOfRunway < 6) {
    out.push({
      priority: 1,
      kind: 'fix',
      title: `Emergency fund covers ${monthsOfRunway.toFixed(1)} months — take it to six`,
      body: `At ${fmt(context.monthlyLiving)}/month you need ${fmt(context.monthlyLiving * 6)} in cash before any payout money goes anywhere else. Trading income is not a salary: it can be zero for a quarter without anything being wrong with your process. Six months of runway is what lets you take that quarter calmly, and calm is worth more in this job than any edge you can find.`,
    })
  }

  if (context.operatingBalance < monthlyBurn * 4) {
    out.push({
      priority: 2,
      kind: 'fix',
      title: 'Operating float is thin',
      body: `You are spending about ${fmt(monthlyBurn)} a month on evaluations, data and platforms, and holding ${fmt(context.operatingBalance)}. Hold at least four to six months of that so a run of failed evaluations never forces you to stop taking them. This float is a cost of doing business, not savings.`,
    })
  }

  // Expected value of another evaluation, given the observed pass rate.
  if (context.evalPassRate > 0 && context.fundedAccounts > 0) {
    const revenuePerFunded = context.annualPayouts / Math.max(1, context.fundedAccounts)
    const costPerFunded = context.evalCost / context.evalPassRate
    const ratio = costPerFunded > 0 ? revenuePerFunded / costPerFunded : 0

    if (ratio > 3 && monthsOfRunway >= 6) {
      out.push({
        priority: 3,
        kind: 'grow',
        title: `Each funded account returns about ${ratio.toFixed(1)}x what it costs to obtain`,
        body: `At a ${(context.evalPassRate * 100).toFixed(0)}% pass rate you spend roughly ${fmt(costPerFunded)} in evaluation fees per account that reaches funding, and each funded account has produced about ${fmt(revenuePerFunded)} a year. While that ratio holds and your reserves are full, adding accounts is the highest-return use of payout money you have — better than any market you could invest it in. Add them one at a time and re-check the ratio: it falls as soon as managing more accounts starts degrading your execution.`,
      })
    } else if (ratio > 0 && ratio < 1.5) {
      out.push({
        priority: 2,
        kind: 'fix',
        title: `Evaluations are barely paying for themselves (${ratio.toFixed(1)}x)`,
        body: `You are spending about ${fmt(costPerFunded)} per funded account and getting ${fmt(revenuePerFunded)} back. That is not a scaling problem, it is a consistency problem — buying more evaluations at this ratio just loses money faster. Stop adding accounts until either the pass rate or the per-account payout improves.`,
      })
    }
  }

  if (monthsOfRunway >= 6 && context.operatingBalance >= monthlyBurn * 4) {
    out.push({
      priority: 4,
      kind: 'grow',
      title: 'Reserves are full — start converting income into capital',
      body: `Prop income does not compound. It stops the day you stop trading well, and it produces nothing while you sleep. Money moved into a broad index fund does both. With your reserves complete, put the investing share of every payout to work on a fixed monthly schedule and do not time it — the discipline of the schedule is doing more work here than the choice of fund.`,
    })
  }

  if (out.length === 0) {
    out.push({
      priority: 5,
      kind: 'hold',
      title: 'Hold the current allocation',
      body: 'Nothing in your reserves or evaluation economics is asking for a change. Keep splitting payouts on the existing plan and revisit when either your monthly costs or your pass rate moves materially.',
    })
  }

  return out.sort((a, b) => a.priority - b.priority)
}

function fmt(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}
