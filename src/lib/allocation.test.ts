import { describe, expect, it } from 'vitest'
import { DEFAULT_ALLOCATION_PLAN, allocatePayout, deploymentAdvice, normalisePlan } from './allocation'
import type { AllocationPlan } from '@/db/schema'

const simplePlan: AllocationPlan = {
  buckets: [
    { key: 'tax', label: 'Tax', percent: 0.3, capBase: null, color: 'amber', note: '' },
    { key: 'ops', label: 'Ops', percent: 0.2, capBase: 1_000, color: 'sky', note: '' },
    { key: 'invest', label: 'Invest', percent: 0.5, capBase: null, color: 'emerald', note: '' },
  ],
}

describe('normalisePlan', () => {
  it('rescales percentages that do not sum to one', () => {
    const plan = normalisePlan({
      buckets: [
        { key: 'a', label: 'A', percent: 2, capBase: null, color: 'x', note: '' },
        { key: 'b', label: 'B', percent: 2, capBase: null, color: 'x', note: '' },
      ],
    })
    expect(plan.buckets[0].percent).toBe(0.5)
    expect(plan.buckets[1].percent).toBe(0.5)
  })

  it('falls back to the default plan when given nothing', () => {
    expect(normalisePlan(null).buckets).toHaveLength(DEFAULT_ALLOCATION_PLAN.buckets.length)
  })

  it('ships a default plan whose shares sum to one', () => {
    const total = DEFAULT_ALLOCATION_PLAN.buckets.reduce((sum, b) => sum + b.percent, 0)
    expect(total).toBeCloseTo(1, 6)
  })
})

describe('allocatePayout', () => {
  it('splits by percentage when nothing is capped', () => {
    const result = allocatePayout(1_000, simplePlan)
    expect(result.lines.find((l) => l.key === 'tax')!.assigned).toBe(300)
    expect(result.lines.find((l) => l.key === 'ops')!.assigned).toBe(200)
    expect(result.lines.find((l) => l.key === 'invest')!.assigned).toBe(500)
    expect(result.unallocated).toBe(0)
  })

  it('respects a cap and cascades the overflow to an uncapped bucket', () => {
    // Ops wants 200 but is already at 900 against a 1,000 cap: only 100 fits.
    const result = allocatePayout(1_000, simplePlan, { ops: 900 })
    const ops = result.lines.find((l) => l.key === 'ops')!
    expect(ops.assigned).toBe(100)
    expect(ops.capped).toBe(true)
    // The spare 100 lands in investing, not in limbo.
    expect(result.lines.find((l) => l.key === 'invest')!.assigned).toBe(600)
    expect(result.unallocated).toBe(0)
  })

  it('assigns nothing to a bucket that is already full', () => {
    const result = allocatePayout(1_000, simplePlan, { ops: 1_000 })
    expect(result.lines.find((l) => l.key === 'ops')!.assigned).toBe(0)
  })

  it('carries existing balances into balanceAfter', () => {
    const result = allocatePayout(1_000, simplePlan, { tax: 5_000 })
    expect(result.lines.find((l) => l.key === 'tax')!.balanceAfter).toBe(5_300)
  })

  it('handles a zero payout without dividing by zero', () => {
    const result = allocatePayout(0, simplePlan)
    expect(result.lines.every((l) => l.assigned === 0)).toBe(true)
    expect(result.unallocated).toBe(0)
  })

  it('treats a negative payout as zero', () => {
    expect(allocatePayout(-500, simplePlan).gross).toBe(0)
  })

  it('always distributes the full payout', () => {
    const result = allocatePayout(2_500, simplePlan, { ops: 500 })
    const assigned = result.lines.reduce((sum, l) => sum + l.assigned, 0)
    expect(assigned + result.unallocated).toBeCloseTo(2_500, 2)
  })
})

describe('deploymentAdvice', () => {
  const context = {
    annualPayouts: 60_000,
    annualCosts: 6_000,
    emergencyBalance: 30_000,
    monthlyLiving: 3_000,
    operatingBalance: 4_000,
    fundedAccounts: 3,
    evalCost: 150,
    evalPassRate: 0.35,
  }

  it('puts a thin emergency fund ahead of everything else', () => {
    const advice = deploymentAdvice({ ...context, emergencyBalance: 3_000 })
    expect(advice[0].kind).toBe('fix')
    expect(advice[0].title).toContain('Emergency fund')
  })

  it('flags a thin operating float', () => {
    const advice = deploymentAdvice({ ...context, operatingBalance: 100 })
    expect(advice.some((a) => a.title.includes('Operating float'))).toBe(true)
  })

  it('recommends scaling when reserves are full and evaluations pay off', () => {
    const advice = deploymentAdvice(context)
    expect(advice.some((a) => a.kind === 'grow')).toBe(true)
  })

  it('warns against scaling when evaluations barely pay for themselves', () => {
    const advice = deploymentAdvice({ ...context, annualPayouts: 1_500, evalPassRate: 0.1 })
    expect(advice.some((a) => a.title.includes('barely paying'))).toBe(true)
  })

  it('says so plainly before the first payout, rather than inventing ratios', () => {
    const advice = deploymentAdvice({
      ...context,
      annualPayouts: 0,
      emergencyBalance: 0,
      operatingBalance: 0,
      monthlyLiving: 0,
      fundedAccounts: 0,
    })
    expect(advice).toHaveLength(1)
    expect(advice[0].kind).toBe('hold')
    expect(advice[0].title).toContain('No payouts yet')
    // The old behaviour divided by a fabricated $1/month and printed "$6 in cash".
    expect(advice[0].body).not.toContain('$6')
    expect(advice[0].body).not.toContain('0.0 months')
  })

  it('still reports the running cost of the business before any payout', () => {
    const advice = deploymentAdvice({ ...context, annualPayouts: 0, annualCosts: 6_000 })
    expect(advice[0].body).toContain('$500')
  })

  it('always returns at least one suggestion', () => {
    const advice = deploymentAdvice({
      ...context,
      evalPassRate: 0,
      fundedAccounts: 0,
      annualPayouts: 0,
    })
    expect(advice.length).toBeGreaterThan(0)
  })
})
