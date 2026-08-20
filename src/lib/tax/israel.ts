/**
 * Israeli tax estimation for a funded-trader business.
 *
 * The premise this whole module rests on, and the thing most funded traders get
 * wrong: a prop firm payout is **not** a capital gain. You never owned the
 * capital, so there is no asset and no disposal. What you sold the firm is a
 * service — your trading performance — and Israel taxes that as business income
 * at marginal rates, with National Insurance on top. The 25% capital gains rate
 * that applies to a personal brokerage account does not apply here.
 *
 * That has a silver lining. Business income is *net* income: every shekel of
 * genuine business expense reduces it, and a funded trader's cost base (evals,
 * resets, data, platforms, hardware, a share of internet and rent) is large
 * relative to revenue. The engine below models that properly.
 *
 * Second consequence: the prop firms are foreign residents buying a service
 * from Israel. That is an export of services, zero-rated for VAT under s.30(a)(5)
 * of the VAT Law — so an osek murshe charges 0% output VAT while still
 * reclaiming input VAT on Israeli purchases. See docs/TAX-ISRAEL.md.
 *
 * Estimates only. Nothing here is filed, and nothing here is advice.
 */
import { DEFAULT_CREDIT_POINTS, ratesFor, type TaxYearRates } from './rates'
import type { TaxProfile } from '@/db/schema'

export type BusinessStatus = TaxProfile['status']

export type TaxInput = {
  year: number
  /** Gross business revenue for the year, in ILS. Payouts, essentially. */
  revenueIls: number
  /** Deductible business expenses for the year, in ILS (after the % haircut). */
  deductibleExpensesIls: number
  /** Israeli VAT actually paid on those expenses, in ILS. */
  inputVatIls: number
  status: BusinessStatus
  creditPoints: number
  /** Business opened part-way through the year -> prorated osek patur ceiling. */
  monthsActive: number
}

export type TaxBreakdown = {
  year: number
  status: BusinessStatus
  revenue: number
  expenses: number
  /** Revenue minus expenses. The base for everything below. */
  netProfit: number

  nationalInsurance: number
  nationalInsuranceDeduction: number
  healthInsurance: number
  /** Net profit less the deductible share of NI. */
  taxableIncome: number

  incomeTaxBeforeCredits: number
  creditPointsValue: number
  incomeTax: number
  surtax: number

  /** VAT reclaimable (negative = a refund owed to you). */
  vatPosition: number

  totalTax: number
  netAfterTax: number
  /** totalTax / revenue. What each shekel of payout really costs. */
  effectiveRate: number
  /** Tax on the next shekel earned. Drives the "is it worth it" questions. */
  marginalRate: number
  notes: string[]
}

const clamp = (value: number, min = 0): number => (Number.isFinite(value) ? Math.max(min, value) : min)
const round2 = (value: number): number => Math.round(value * 100) / 100

/** Progressive income tax on annual taxable income, before credit points. */
export function incomeTaxOn(taxable: number, rates: TaxYearRates): number {
  let tax = 0
  for (const bracket of rates.brackets) {
    if (taxable <= bracket.from) break
    const slice = Math.min(taxable, bracket.to) - bracket.from
    tax += slice * bracket.rate
  }
  return clamp(tax)
}

/** Marginal rate at a given taxable income, surtax included. */
export function marginalRateAt(taxable: number, rates: TaxYearRates): number {
  // At zero income the next shekel is taxed in the FIRST band. The previous
  // strict `taxable > b.from` matched nothing at 0 and fell through to the top
  // band, showing a brand-new business a 47% marginal rate.
  if (taxable <= 0) return rates.brackets[0].rate
  const band = rates.brackets.find((b) => taxable > b.from && taxable <= b.to) ?? rates.brackets.at(-1)!
  const surtax = taxable > rates.surtax.threshold ? rates.surtax.rate : 0
  return band.rate + surtax
}

/**
 * Self-employed National Insurance and health contributions.
 *
 * Charged on net profit, on a floor of the minimum base and capped at the
 * annual ceiling. The reduced band applies to the first slice only.
 */
export function nationalInsuranceOn(
  netProfit: number,
  rates: TaxYearRates,
): { insurance: number; health: number; total: number; base: number } {
  const ni = rates.nationalInsurance
  // Below the floor you still pay as if you earned it; above the ceiling you stop.
  const base = Math.min(Math.max(netProfit, netProfit > 0 ? ni.minimumBase : 0), ni.ceiling)

  const reducedSlice = Math.min(base, ni.reducedCeiling)
  const fullSlice = clamp(base - ni.reducedCeiling)

  const insurance = reducedSlice * ni.reduced.insurance + fullSlice * ni.full.insurance
  const health = reducedSlice * ni.reduced.health + fullSlice * ni.full.health

  return { insurance: round2(insurance), health: round2(health), total: round2(insurance + health), base }
}

export function calculateIsraeliTax(input: TaxInput): TaxBreakdown {
  const rates = ratesFor(input.year)
  const notes: string[] = []

  const revenue = clamp(input.revenueIls)
  let expenses = clamp(input.deductibleExpensesIls)

  // Osek zair swaps itemised expenses for a flat 30% of turnover. Take whichever
  // is larger — the whole point of the regime is that you may choose it.
  if (input.status === 'osek_zair') {
    const normative = revenue * rates.vat.osekZairNormativeExpenseRate
    if (normative > expenses) {
      notes.push(
        `Osek zair: claiming the flat ${Math.round(rates.vat.osekZairNormativeExpenseRate * 100)}% normative expense (₪${Math.round(normative).toLocaleString()}) beats your itemised ₪${Math.round(expenses).toLocaleString()}.`,
      )
      expenses = normative
    } else {
      notes.push(
        `Your itemised expenses (₪${Math.round(expenses).toLocaleString()}) exceed the ${Math.round(rates.vat.osekZairNormativeExpenseRate * 100)}% normative deduction — osek zair is costing you money versus osek murshe.`,
      )
    }
  }

  const netProfit = clamp(revenue - expenses)

  // Corporate route is a different animal: 23% on profit, then dividend tax on
  // whatever you take out personally.
  if (input.status === 'company') {
    const corporateTax = netProfit * rates.corporate.rate
    const distributable = netProfit - corporateTax
    const dividendTax = distributable * rates.corporate.dividendRateSubstantial
    const totalTax = corporateTax + dividendTax
    notes.push(
      'Company figures assume you distribute all profit as a dividend in the same year, taxed at the 30% substantial-shareholder rate. Retaining profit inside the company defers the dividend tax — that deferral is the main reason to incorporate.',
    )
    notes.push(
      'A company also owes you a market-rate salary if you work in it, which carries National Insurance. This estimate does not model a salary split; a CPA should.',
    )
    return {
      year: rates.year,
      status: input.status,
      revenue: round2(revenue),
      expenses: round2(expenses),
      netProfit: round2(netProfit),
      nationalInsurance: 0,
      nationalInsuranceDeduction: 0,
      healthInsurance: 0,
      taxableIncome: round2(netProfit),
      incomeTaxBeforeCredits: round2(corporateTax),
      creditPointsValue: 0,
      incomeTax: round2(corporateTax),
      surtax: 0,
      vatPosition: round2(-clamp(input.inputVatIls)),
      totalTax: round2(totalTax),
      netAfterTax: round2(netProfit - totalTax),
      effectiveRate: revenue > 0 ? totalTax / revenue : 0,
      marginalRate: rates.corporate.rate + (1 - rates.corporate.rate) * rates.corporate.dividendRateSubstantial,
      notes,
    }
  }

  const ni = nationalInsuranceOn(netProfit, rates)
  const niDeduction = ni.insurance * rates.nationalInsurance.deductibleShare
  const taxableIncome = clamp(netProfit - niDeduction)

  const incomeTaxBeforeCredits = incomeTaxOn(taxableIncome, rates)
  const creditPointsValue = clamp(input.creditPoints) * rates.creditPointAnnual
  // Credit points can zero out the bill but are not refundable.
  const incomeTax = clamp(incomeTaxBeforeCredits - creditPointsValue)
  const surtax = clamp(taxableIncome - rates.surtax.threshold) * rates.surtax.rate

  // Osek patur cannot reclaim input VAT — it is a real, sunk cost.
  // Osek murshe and osek zair can, and against foreign clients there is no
  // output VAT to net it against, so it comes back as a refund.
  let vatPosition = 0
  if (input.status === 'osek_murshe') {
    vatPosition = -clamp(input.inputVatIls)
    if (input.inputVatIls > 0) {
      notes.push(
        `Zero-rated export sales mean no output VAT, so the ₪${Math.round(input.inputVatIls).toLocaleString()} of input VAT on your Israeli purchases is refundable rather than merely offset.`,
      )
    }
  } else if (input.status === 'osek_patur') {
    notes.push(
      `As osek patur the ₪${Math.round(input.inputVatIls).toLocaleString()} of VAT on Israeli purchases is unrecoverable. It stays a cost.`,
    )
  }

  const ceiling = prorateCeiling(rates.vat.osekPaturCeiling, input.monthsActive)
  if ((input.status === 'osek_patur' || input.status === 'osek_zair') && revenue > ceiling) {
    notes.push(
      `Turnover of ₪${Math.round(revenue).toLocaleString()} is over the ₪${Math.round(ceiling).toLocaleString()} ceiling for this status. You must register as osek murshe — and you owe VAT on the excess from the moment you crossed it, not from year end.`,
    )
  } else if (input.status === 'osek_patur' && revenue > ceiling * 0.8) {
    notes.push(
      `You are at ${Math.round((revenue / ceiling) * 100)}% of the osek patur ceiling. Change status before the next payout lands, not after.`,
    )
  }

  const totalTax = incomeTax + surtax + ni.total + vatPosition

  return {
    year: rates.year,
    status: input.status,
    revenue: round2(revenue),
    expenses: round2(expenses),
    netProfit: round2(netProfit),
    nationalInsurance: ni.insurance,
    nationalInsuranceDeduction: round2(niDeduction),
    healthInsurance: ni.health,
    taxableIncome: round2(taxableIncome),
    incomeTaxBeforeCredits: round2(incomeTaxBeforeCredits),
    creditPointsValue: round2(creditPointsValue),
    incomeTax: round2(incomeTax),
    surtax: round2(surtax),
    vatPosition: round2(vatPosition),
    totalTax: round2(totalTax),
    netAfterTax: round2(netProfit - totalTax),
    effectiveRate: revenue > 0 ? totalTax / revenue : 0,
    marginalRate: marginalRateAt(taxableIncome, rates) + effectiveNiMarginal(netProfit, rates),
    notes,
  }
}

/** NI is a real marginal cost until the ceiling; after it, it stops entirely. */
function effectiveNiMarginal(netProfit: number, rates: TaxYearRates): number {
  const ni = rates.nationalInsurance
  if (netProfit >= ni.ceiling) return 0
  const combined =
    netProfit < ni.reducedCeiling
      ? ni.reduced.insurance + ni.reduced.health
      : ni.full.insurance + ni.full.health
  // The deductible share of the insurance component softens the true marginal bite.
  return combined * (1 - ni.deductibleShare * 0.35)
}

export function prorateCeiling(ceiling: number, monthsActive: number): number {
  const months = Math.min(12, Math.max(1, Math.round(monthsActive)))
  return months >= 12 ? ceiling : (ceiling / 12) * months
}

/**
 * Runs the same numbers through every available status so the choice is made on
 * arithmetic rather than on what a forum said.
 */
export function compareStatuses(
  input: Omit<TaxInput, 'status'>,
): { status: BusinessStatus; breakdown: TaxBreakdown; eligible: boolean; reason: string }[] {
  const rates = ratesFor(input.year)
  const ceiling = prorateCeiling(rates.vat.osekPaturCeiling, input.monthsActive)
  const statuses: BusinessStatus[] = ['osek_patur', 'osek_zair', 'osek_murshe', 'company']

  return statuses
    .map((status) => {
      const breakdown = calculateIsraeliTax({ ...input, status })
      const capped = status === 'osek_patur' || status === 'osek_zair'
      const eligible = !capped || input.revenueIls <= ceiling
      const reason = eligible
        ? ''
        : `Turnover exceeds the ₪${Math.round(ceiling).toLocaleString()} ceiling for this status.`
      return { status, breakdown, eligible, reason }
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      return b.breakdown.netAfterTax - a.breakdown.netAfterTax
    })
}

/**
 * What share of each payout to move into the tax account the day it lands.
 *
 * Computed by asking what the *next* shekel of revenue costs at the current
 * run-rate, then adding a buffer — under-reserving is far more painful than
 * over-reserving, because the shortfall shows up as a lump sum long after the
 * money has been spent.
 */
export function reservePercentFor(input: TaxInput, buffer = 0.05): number {
  const current = calculateIsraeliTax(input)
  const stepIls = Math.max(10_000, input.revenueIls * 0.1)
  const stepped = calculateIsraeliTax({ ...input, revenueIls: input.revenueIls + stepIls })
  const marginalCost = (stepped.totalTax - current.totalTax) / stepIls
  const blended = Math.max(current.effectiveRate, marginalCost)
  return Math.min(0.6, Math.max(0.15, blended + buffer))
}

/**
 * Advance payments (מקדמות). The Tax Authority sets these from your last filed
 * return, so a first profitable year produces no advances and then a very large
 * balancing payment. Reserving against this schedule prevents that ambush.
 */
export function advanceSchedule(annualTax: number): { period: string; dueOn: string; amount: number }[] {
  const perPeriod = round2(annualTax / 6)
  // Bi-monthly periods, each due on the 15th of the following month.
  return [
    { period: 'Jan-Feb', dueOn: '03-15', amount: perPeriod },
    { period: 'Mar-Apr', dueOn: '05-15', amount: perPeriod },
    { period: 'May-Jun', dueOn: '07-15', amount: perPeriod },
    { period: 'Jul-Aug', dueOn: '09-15', amount: perPeriod },
    { period: 'Sep-Oct', dueOn: '11-15', amount: perPeriod },
    { period: 'Nov-Dec', dueOn: '01-15', amount: perPeriod },
  ]
}

/**
 * Default deductibility by expense category.
 *
 * A funded trader's costs are unusually clean: an evaluation fee has no private
 * use whatsoever, so it is fully deductible. Mixed-use items are where the Tax
 * Authority pushes back, and the percentages below reflect the customary
 * treatment rather than the most aggressive one. Keep receipts for all of it.
 */
export const DEDUCTIBLE_DEFAULTS: Record<string, { percent: number; note: string }> = {
  eval_fee: { percent: 1, note: 'Wholly and exclusively a business cost. Fully deductible.' },
  reset_fee: { percent: 1, note: 'Same treatment as an evaluation fee.' },
  activation_fee: { percent: 1, note: 'Cost of putting a funded account into service.' },
  data_feed: { percent: 1, note: 'CME and exchange fees are a direct input to the work.' },
  platform_subscription: { percent: 1, note: 'TradingView, Tradovate, Tradecopia and similar.' },
  software: { percent: 1, note: 'Deductible where the use is business-only.' },
  hardware: {
    percent: 1,
    note: 'Capitalised and depreciated rather than expensed in full — typically 33% a year for computers. Your accountant will make the adjustment.',
  },
  education: {
    percent: 1,
    note: 'Courses that maintain or sharpen an existing skill are deductible; training that creates a brand-new qualification usually is not.',
  },
  internet: { percent: 0.5, note: 'Split between business and private use. 50% is the customary starting point.' },
  phone: { percent: 0.5, note: 'Same split as internet.' },
  office: {
    percent: 0.25,
    note: 'A home office is deductible in proportion to floor area used exclusively for work. Be able to point at the room.',
  },
  travel: {
    percent: 1,
    note: 'Deductible only where the purpose is genuinely business. Keep the itinerary and the reason. Travel that is really a holiday is not deductible, and this is a common audit trigger.',
  },
  accounting: { percent: 1, note: 'Professional fees for running the business.' },
  bank_fees: { percent: 1, note: 'Fees on the business account, including FX conversion spreads.' },
  commission: { percent: 1, note: 'Broker commissions and exchange fees.' },
  other: { percent: 1, note: 'Review each item individually.' },
}

export function defaultDeductibleFor(category: string): number {
  return DEDUCTIBLE_DEFAULTS[category]?.percent ?? 1
}

export const DEFAULT_TAX_PROFILE: TaxProfile = {
  status: 'undecided',
  israeliResident: true,
  creditPoints: DEFAULT_CREDIT_POINTS,
  reservePercent: 0.3,
  businessOpenedOn: null,
  claimsZeroRatedVat: true,
}
