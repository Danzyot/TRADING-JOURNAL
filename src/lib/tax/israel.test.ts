import { describe, expect, it } from 'vitest'
import {
  calculateIsraeliTax,
  compareStatuses,
  incomeTaxOn,
  marginalRateAt,
  nationalInsuranceOn,
  prorateCeiling,
  reservePercentFor,
  type TaxInput,
} from './israel'
import { RATES_2026 } from './rates'

const base: TaxInput = {
  year: 2026,
  revenueIls: 200_000,
  deductibleExpensesIls: 40_000,
  inputVatIls: 0,
  status: 'osek_murshe',
  creditPoints: 2.25,
  monthsActive: 12,
}

describe('incomeTaxOn', () => {
  it('is zero at zero income', () => {
    expect(incomeTaxOn(0, RATES_2026)).toBe(0)
  })

  it('charges 10% within the first bracket', () => {
    expect(incomeTaxOn(50_000, RATES_2026)).toBeCloseTo(5_000, 2)
  })

  it('stacks brackets progressively rather than applying one rate to the whole', () => {
    // 84,120 @ 10% = 8,412; the next 15,880 @ 14% = 2,223.20.
    expect(incomeTaxOn(100_000, RATES_2026)).toBeCloseTo(8_412 + 15_880 * 0.14, 2)
  })

  it('reaches the top band above 560,280', () => {
    const atThreshold = incomeTaxOn(560_280, RATES_2026)
    const justAbove = incomeTaxOn(560_280 + 1_000, RATES_2026)
    expect(justAbove - atThreshold).toBeCloseTo(470, 2)
  })
})

describe('marginalRateAt', () => {
  it('reports the band rate below the surtax threshold', () => {
    expect(marginalRateAt(150_000, RATES_2026)).toBeCloseTo(0.2, 6)
    expect(marginalRateAt(250_000, RATES_2026)).toBeCloseTo(0.31, 6)
  })

  it('adds the 3% surtax above 721,560', () => {
    expect(marginalRateAt(800_000, RATES_2026)).toBeCloseTo(0.5, 6)
  })
})

describe('nationalInsuranceOn', () => {
  it('applies the reduced rate to the first band', () => {
    const result = nationalInsuranceOn(50_000, RATES_2026)
    expect(result.total).toBeCloseTo(50_000 * 0.077, 1)
  })

  it('applies the full rate above the reduced ceiling', () => {
    const result = nationalInsuranceOn(200_000, RATES_2026)
    const expected = 92_436 * 0.077 + (200_000 - 92_436) * 0.18
    expect(result.total).toBeCloseTo(expected, 1)
  })

  it('stops charging above the annual ceiling', () => {
    const atCeiling = nationalInsuranceOn(622_920, RATES_2026)
    const wellAbove = nationalInsuranceOn(1_000_000, RATES_2026)
    expect(wellAbove.total).toBeCloseTo(atCeiling.total, 2)
  })

  it('charges on the minimum base even when profit is tiny', () => {
    const result = nationalInsuranceOn(5_000, RATES_2026)
    expect(result.base).toBe(RATES_2026.nationalInsurance.minimumBase)
  })

  it('charges nothing at zero profit', () => {
    expect(nationalInsuranceOn(0, RATES_2026).total).toBe(0)
  })
})

describe('calculateIsraeliTax', () => {
  it('taxes net profit, not revenue', () => {
    const withExpenses = calculateIsraeliTax(base)
    const withoutExpenses = calculateIsraeliTax({ ...base, deductibleExpensesIls: 0 })
    expect(withExpenses.netProfit).toBe(160_000)
    expect(withExpenses.totalTax).toBeLessThan(withoutExpenses.totalTax)
  })

  it('applies credit points as a reduction in tax, not in income', () => {
    const withPoints = calculateIsraeliTax({ ...base, creditPoints: 2.25 })
    const withoutPoints = calculateIsraeliTax({ ...base, creditPoints: 0 })
    expect(withoutPoints.incomeTax - withPoints.incomeTax).toBeCloseTo(2.25 * 2_904, 2)
  })

  it('never lets credit points push tax below zero', () => {
    const result = calculateIsraeliTax({ ...base, revenueIls: 30_000, deductibleExpensesIls: 25_000, creditPoints: 10 })
    expect(result.incomeTax).toBe(0)
  })

  it('deducts 52% of the National Insurance component from taxable income', () => {
    const result = calculateIsraeliTax(base)
    expect(result.nationalInsuranceDeduction).toBeCloseTo(result.nationalInsurance * 0.52, 2)
    expect(result.taxableIncome).toBeCloseTo(result.netProfit - result.nationalInsuranceDeduction, 2)
  })

  it('makes input VAT refundable for an osek murshe exporting services', () => {
    const result = calculateIsraeliTax({ ...base, status: 'osek_murshe', inputVatIls: 3_000 })
    expect(result.vatPosition).toBe(-3_000)
    expect(result.notes.some((n) => n.includes('refundable'))).toBe(true)
  })

  it('leaves input VAT as a sunk cost for an osek patur', () => {
    const result = calculateIsraeliTax({
      ...base,
      revenueIls: 100_000,
      status: 'osek_patur',
      inputVatIls: 3_000,
    })
    expect(result.vatPosition).toBe(0)
    expect(result.notes.some((n) => n.includes('unrecoverable'))).toBe(true)
  })

  it('gives osek zair the flat 30% deduction when it beats itemised expenses', () => {
    const result = calculateIsraeliTax({
      ...base,
      revenueIls: 100_000,
      deductibleExpensesIls: 10_000,
      status: 'osek_zair',
    })
    expect(result.expenses).toBe(30_000)
  })

  it('keeps itemised expenses when they beat the flat deduction', () => {
    const result = calculateIsraeliTax({
      ...base,
      revenueIls: 100_000,
      deductibleExpensesIls: 50_000,
      status: 'osek_zair',
    })
    expect(result.expenses).toBe(50_000)
    expect(result.notes.some((n) => n.includes('costing you money'))).toBe(true)
  })

  it('warns when turnover exceeds the osek patur ceiling', () => {
    const result = calculateIsraeliTax({ ...base, revenueIls: 200_000, status: 'osek_patur' })
    expect(result.notes.some((n) => n.includes('over the'))).toBe(true)
  })

  it('models the company route as corporate tax plus dividend tax', () => {
    const result = calculateIsraeliTax({ ...base, status: 'company' })
    const corporate = 160_000 * 0.23
    expect(result.incomeTax).toBeCloseTo(corporate, 2)
    expect(result.totalTax).toBeCloseTo(corporate + (160_000 - corporate) * 0.3, 2)
    expect(result.nationalInsurance).toBe(0)
  })

  it('produces an effective rate below the top marginal rate', () => {
    const result = calculateIsraeliTax(base)
    expect(result.effectiveRate).toBeGreaterThan(0)
    expect(result.effectiveRate).toBeLessThan(0.5)
  })
})

describe('prorateCeiling', () => {
  it('is unchanged over a full year', () => {
    expect(prorateCeiling(122_833, 12)).toBe(122_833)
  })

  it('scales down for a part year', () => {
    expect(prorateCeiling(122_833, 6)).toBeCloseTo(61_416.5, 2)
  })
})

describe('compareStatuses', () => {
  it('marks capped statuses ineligible above the ceiling', () => {
    const results = compareStatuses({ ...base, revenueIls: 400_000 })
    const patur = results.find((r) => r.status === 'osek_patur')!
    expect(patur.eligible).toBe(false)
    expect(patur.reason).toContain('ceiling')
  })

  it('ranks eligible statuses ahead of ineligible ones', () => {
    const results = compareStatuses({ ...base, revenueIls: 400_000 })
    const firstIneligible = results.findIndex((r) => !r.eligible)
    const lastEligible = results.map((r) => r.eligible).lastIndexOf(true)
    expect(lastEligible).toBeLessThan(firstIneligible)
  })

  it('covers every available status', () => {
    expect(compareStatuses(base).map((r) => r.status).sort()).toEqual([
      'company',
      'osek_murshe',
      'osek_patur',
      'osek_zair',
    ])
  })
})

describe('reservePercentFor', () => {
  it('stays within a sane band', () => {
    const rate = reservePercentFor(base)
    expect(rate).toBeGreaterThanOrEqual(0.15)
    expect(rate).toBeLessThanOrEqual(0.6)
  })

  it('rises with income', () => {
    const low = reservePercentFor({ ...base, revenueIls: 80_000 })
    const high = reservePercentFor({ ...base, revenueIls: 600_000 })
    expect(high).toBeGreaterThan(low)
  })
})
