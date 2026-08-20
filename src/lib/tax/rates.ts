/**
 * Israeli tax rates and thresholds.
 *
 * Every number below is a published statutory figure for the stated tax year,
 * kept in one table so an annual update is a single edit rather than a hunt
 * through the codebase. Figures are in ILS.
 *
 * 2026 sources:
 *   - Income tax brackets: Income Tax Ordinance Amendment 288 (published
 *     31.3.2026, effective January 2026) widened the 20% and 31% bands.
 *   - Surtax (מס יסף): 3% above 721,560, per s.121B.
 *   - National Insurance / health: Bituach Leumi self-employed rates 2026.
 *   - Osek patur ceiling: 122,833 (index-linked, updated annually).
 *   - VAT: 18% standard rate.
 *
 * These are inputs to an estimate, not a filing. Confirm with a CPA before
 * acting — see docs/TAX-ISRAEL.md for what specifically needs confirming.
 */

export type Bracket = {
  /** Annual income at which this rate starts applying. */
  from: number
  /** Annual income at which it stops. Infinity for the top band. */
  to: number
  rate: number
}

export type TaxYearRates = {
  year: number
  /** Marginal income tax bands on annual taxable income. */
  brackets: Bracket[]
  /** Surtax on total annual income above the threshold. */
  surtax: { threshold: number; rate: number }
  /** Annual value of one credit point (נקודת זיכוי). */
  creditPointAnnual: number
  nationalInsurance: {
    /** Annual income below which the reduced combined rate applies. */
    reducedCeiling: number
    /** Annual income above which no further contributions are due. */
    ceiling: number
    /** Contributions are charged on at least this much annual income. */
    minimumBase: number
    reduced: { insurance: number; health: number }
    full: { insurance: number; health: number }
    /**
     * Share of the *insurance* component (not health) that is deductible
     * against taxable income. Income Tax Ordinance s.47A.
     */
    deductibleShare: number
  }
  vat: {
    standardRate: number
    /** Turnover ceiling for osek patur / osek zair status. */
    osekPaturCeiling: number
    /**
     * Osek zair (new for 2026): claim a flat share of turnover as expenses
     * instead of itemising, with simplified reporting and no advances.
     */
    osekZairNormativeExpenseRate: number
  }
  corporate: {
    rate: number
    /** Dividend withholding on distribution to a non-substantial shareholder. */
    dividendRate: number
    /** 30% applies to a shareholder holding 10% or more. */
    dividendRateSubstantial: number
  }
}

export const RATES_2026: TaxYearRates = {
  year: 2026,
  // Monthly bands x12. 7,010 / 10,060 / 19,000 / 25,100 / 46,690 / 60,130.
  brackets: [
    { from: 0, to: 84_120, rate: 0.1 },
    { from: 84_120, to: 120_720, rate: 0.14 },
    { from: 120_720, to: 228_000, rate: 0.2 },
    { from: 228_000, to: 301_200, rate: 0.31 },
    { from: 301_200, to: 560_280, rate: 0.35 },
    { from: 560_280, to: Infinity, rate: 0.47 },
  ],
  surtax: { threshold: 721_560, rate: 0.03 },
  creditPointAnnual: 2_904, // 242/month
  nationalInsurance: {
    reducedCeiling: 92_436, // 7,703/month
    ceiling: 622_920, // 51,910/month
    minimumBase: 41_304, // 3,442/month
    reduced: { insurance: 0.0447, health: 0.0323 }, // 7.70% combined
    full: { insurance: 0.1283, health: 0.0517 }, // 18.00% combined
    deductibleShare: 0.52,
  },
  vat: {
    standardRate: 0.18,
    osekPaturCeiling: 122_833,
    osekZairNormativeExpenseRate: 0.3,
  },
  corporate: {
    rate: 0.23,
    dividendRate: 0.25,
    dividendRateSubstantial: 0.3,
  },
}

export const RATE_TABLE: Record<number, TaxYearRates> = {
  2026: RATES_2026,
}

export function ratesFor(year: number): TaxYearRates {
  // Fall back to the most recent table we have rather than throwing — a
  // forward-dated estimate on last year's rates beats no estimate at all.
  return RATE_TABLE[year] ?? RATES_2026
}

/**
 * Credit points for a 21-year-old Israeli resident.
 *
 * Base entitlement is 2.25 for a resident male (2.75 for a female). Discharged
 * soldiers receive an additional monthly credit for 36 months after release,
 * which is worth real money at this income level and is easy to forget — set it
 * explicitly in Settings rather than relying on this default.
 */
export const DEFAULT_CREDIT_POINTS = 2.25
