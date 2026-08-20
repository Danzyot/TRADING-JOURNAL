import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Badge, Card, KeyValue, PageHeader, SeverityIcon, Stat, StatGrid } from '@/components/ui'
import { CATEGORY_LABELS, STATUS_LABELS, money, percent, titleCase } from '@/lib/format'
import {
  advanceSchedule,
  calculateIsraeliTax,
  compareStatuses,
  prorateCeiling,
  reservePercentFor,
  type TaxInput,
} from '@/lib/tax/israel'
import { ratesFor } from '@/lib/tax/rates'
import { saveTaxProfile } from '@/server/actions'
import { deductibleExpensesForYear, moneySummary, revenueForYear } from '@/server/money'
import { getSettings } from '@/server/settings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tax — Trading Journal' }

export default async function TaxPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams
  const settings = await getSettings()
  const year = Number(params.year) || new Date().getFullYear()
  const rates = ratesFor(year)

  const [revenue, deductions, summary] = await Promise.all([
    revenueForYear(year),
    deductibleExpensesForYear(year),
    moneySummary(`${year}-01-01`, `${year}-12-31`),
  ])

  const profile = settings.taxProfile!
  const rate = settings.usdIls
  const toIls = (value: number): number => (settings.baseCurrency === 'ILS' ? value : value * rate)

  const monthsActive = monthsActiveIn(year, profile.businessOpenedOn)
  const input: TaxInput = {
    year,
    revenueIls: toIls(revenue),
    deductibleExpensesIls: toIls(deductions.deductible),
    inputVatIls: toIls(deductions.vat),
    status: profile.status === 'undecided' ? 'osek_murshe' : profile.status,
    creditPoints: profile.creditPoints,
    monthsActive,
  }

  const breakdown = calculateIsraeliTax(input)
  const comparison = compareStatuses(input)
  const eligible = comparison.filter((entry) => entry.eligible)
  const best = eligible[0]
  // With no Israeli VAT logged, osek patur and osek murshe produce identical
  // arithmetic. Declaring a winner on an exact tie would be false precision —
  // the real difference is compliance burden, so say that instead.
  const tied = best
    ? eligible.filter((entry) => Math.abs(entry.breakdown.netAfterTax - best.breakdown.netAfterTax) < 1)
    : []
  const suggestedReserve = revenue > 0 ? reservePercentFor(input) : profile.reservePercent
  const ceiling = prorateCeiling(rates.vat.osekPaturCeiling, monthsActive)
  const schedule = advanceSchedule(breakdown.totalTax)

  return (
    <>
      <PageHeader
        title="Tax"
        subtitle={`Israeli position for ${year}, computed on published rates. An estimate to plan and reserve against — not a filing.`}
        actions={
          <form method="get" className="flex items-center gap-2">
            <select name="year" defaultValue={String(year)} className="select w-28">
              {[year + 1, year, year - 1, year - 2].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button type="submit" className="btn">
              View
            </button>
          </form>
        }
      />

      {/* --- The framing that matters --------------------------------------- */}
      <Card className="mb-6">
        <div className="flex gap-3">
          <SeverityIcon severity="info" />
          <div className="text-sm leading-relaxed text-[var(--ink-secondary)]">
            <p>
              <strong className="text-[var(--ink)]">A prop payout is not a capital gain.</strong> You never owned
              the capital, so there is no asset and no disposal — what you sold the firm is a service, and Israel
              taxes that as business income at marginal rates with National Insurance on top. The 25% capital
              gains rate that applies to your own brokerage account does not apply here.
            </p>
            <p className="mt-2">
              The upside is that business income is <em>net</em> income. Evaluations, resets, data feeds,
              platforms, hardware and a proportion of your internet and workspace all come off the top before a
              shekel of tax is calculated. And because the firms are foreign residents buying a service from
              Israel, the sale is an export — zero-rated for VAT under section 30(a)(5), which means you charge
              no VAT while still reclaiming what you pay on Israeli purchases.
            </p>
            <p className="mt-2 text-[var(--ink-muted)]">
              Everything on this page is arithmetic on published rates. It is not advice, and the classification
              questions here have real consequences — take it to an Israeli accountant who has seen a funded
              trader before, and read <code>docs/TAX-ISRAEL.md</code> in this repository for what specifically to ask.
            </p>
          </div>
        </div>
      </Card>

      <StatGrid columns={5}>
        <Card bodyClassName="p-4">
          <Stat label="Revenue" value={money(breakdown.revenue, 'ILS', 0)} hint="payouts received" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Deductible costs" value={money(breakdown.expenses, 'ILS', 0)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Net profit" value={money(breakdown.netProfit, 'ILS', 0)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Total tax + NI" value={money(breakdown.totalTax, 'ILS', 0)} tone="critical" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Effective rate"
            value={percent(breakdown.effectiveRate)}
            hint={`${percent(breakdown.marginalRate)} on the next shekel`}
          />
        </Card>
      </StatGrid>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* --- Computation ------------------------------------------------- */}
        <Card
          title="How it is calculated"
          description={`${STATUS_LABELS[breakdown.status]} · ${year} rates`}
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <div>
              <KeyValue label="Revenue" value={money(breakdown.revenue, 'ILS', 0)} />
              <KeyValue label="Less deductible expenses" value={money(-breakdown.expenses, 'ILS', 0)} />
              <KeyValue label="Net profit" value={money(breakdown.netProfit, 'ILS', 0)} />
              <KeyValue
                label="National Insurance"
                value={money(breakdown.nationalInsurance, 'ILS', 0)}
                hint="charged on net profit, capped at the annual ceiling"
              />
              <KeyValue label="Health insurance" value={money(breakdown.healthInsurance, 'ILS', 0)} />
              <KeyValue
                label="Less 52% NI deduction"
                value={money(-breakdown.nationalInsuranceDeduction, 'ILS', 0)}
                hint="section 47A"
              />
              <KeyValue label="Taxable income" value={money(breakdown.taxableIncome, 'ILS', 0)} />
            </div>
            <div>
              <KeyValue label="Income tax before credits" value={money(breakdown.incomeTaxBeforeCredits, 'ILS', 0)} />
              <KeyValue
                label="Credit points"
                value={money(-breakdown.creditPointsValue, 'ILS', 0)}
                hint={`${profile.creditPoints} points at ₪${rates.creditPointAnnual.toLocaleString()} each`}
              />
              <KeyValue label="Income tax" value={money(breakdown.incomeTax, 'ILS', 0)} />
              <KeyValue
                label="Surtax"
                value={breakdown.surtax > 0 ? money(breakdown.surtax, 'ILS', 0) : 'None'}
                hint={`3% above ₪${rates.surtax.threshold.toLocaleString()}`}
              />
              <KeyValue
                label="VAT position"
                value={breakdown.vatPosition < 0 ? `${money(-breakdown.vatPosition, 'ILS', 0)} refund` : 'Nil'}
              />
              <KeyValue label="Total tax + NI" value={money(breakdown.totalTax, 'ILS', 0)} />
              <KeyValue label="Kept after tax" value={money(breakdown.netAfterTax, 'ILS', 0)} />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {year} income tax bands
            </h3>
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Annual income (₪)</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Tax in this band</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.brackets.map((bracket) => {
                    const slice = Math.max(
                      0,
                      Math.min(breakdown.taxableIncome, bracket.to) - bracket.from,
                    )
                    return (
                      <tr key={bracket.from}>
                        <td className="tabular">
                          {bracket.from.toLocaleString()} –{' '}
                          {bracket.to === Infinity ? '∞' : bracket.to.toLocaleString()}
                        </td>
                        <td className="tabular text-right">{percent(bracket.rate, 0)}</td>
                        <td className="tabular text-right">
                          {slice > 0 ? money(slice * bracket.rate, 'ILS', 0) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {breakdown.notes.length > 0 && (
            <div className="mt-4 space-y-2">
              {breakdown.notes.map((note, index) => (
                <p
                  key={index}
                  className="rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]"
                >
                  {note}
                </p>
              ))}
            </div>
          )}
        </Card>

        {/* --- Profile ------------------------------------------------------ */}
        <Card title="Your tax profile" description="Drives every figure on this page.">
          <ActionForm action={saveTaxProfile} className="space-y-3">
            <Field label="Business status">
              <select name="status" defaultValue={profile.status} className="select">
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Credit points"
              hint="2.25 is the base for a resident male. Discharged soldiers get extra for 36 months after release — worth real money, and easy to forget."
            >
              <input
                name="creditPoints"
                type="number"
                step="0.25"
                defaultValue={profile.creditPoints}
                className="input"
              />
            </Field>

            <Field label="Reserve % per payout" hint={`Suggested: ${percent(suggestedReserve, 0)} at your current run-rate`}>
              <input
                name="reservePercent"
                type="number"
                step="1"
                min="0"
                max="60"
                defaultValue={Math.round(profile.reservePercent * 100)}
                className="input"
              />
            </Field>

            <Field label="Business opened on" hint="A part year prorates the osek patur ceiling">
              <input
                name="businessOpenedOn"
                type="date"
                defaultValue={profile.businessOpenedOn ?? ''}
                className="input"
              />
            </Field>

            <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
              <input type="checkbox" name="israeliResident" defaultChecked={profile.israeliResident} />
              Israeli tax resident
            </label>

            <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
              <input type="checkbox" name="claimsZeroRatedVat" defaultChecked={profile.claimsZeroRatedVat} />
              Claiming zero-rated VAT on exported services
            </label>

            <SubmitButton>Save profile</SubmitButton>
          </ActionForm>

          <div className="mt-4 space-y-0 border-t border-[var(--line)] pt-3">
            <KeyValue label="USD → ILS rate used" value={rate.toFixed(3)} />
            <KeyValue
              label="Osek patur ceiling"
              value={money(ceiling, 'ILS', 0)}
              hint={monthsActive < 12 ? `prorated to ${monthsActive} months` : undefined}
            />
            <KeyValue
              label="Turnover against ceiling"
              value={
                <span
                  className={
                    breakdown.revenue > ceiling ? 'text-[var(--critical)]' : 'text-[var(--ink)]'
                  }
                >
                  {percent(ceiling > 0 ? breakdown.revenue / ceiling : 0, 0)}
                </span>
              }
            />
            <KeyValue label="VAT rate" value={percent(rates.vat.standardRate, 0)} />
          </div>
        </Card>
      </div>

      {/* --- Status comparison ---------------------------------------------- */}
      <div className="mt-6">
        <Card
          title="Which status keeps the most"
          description="The same revenue and expenses run through every option. Ineligible ones are shown so the ceiling is visible."
          bodyClassName="p-0"
        >
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Status</th>
                  <th className="text-right">Expenses claimed</th>
                  <th className="text-right">Net profit</th>
                  <th className="text-right">Income tax</th>
                  <th className="text-right">NI + health</th>
                  <th className="text-right">VAT</th>
                  <th className="text-right">Total tax</th>
                  <th className="text-right">Kept</th>
                  <th className="text-right">Effective</th>
                  <th>Eligible</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((entry) => (
                  <tr key={entry.status}>
                    <td className="font-medium text-[var(--ink)]">
                      {STATUS_LABELS[entry.status]}
                      {entry.status === profile.status && (
                        <Badge tone="accent">
                          <span className="ml-1">current</span>
                        </Badge>
                      )}
                    </td>
                    <td className="tabular text-right">{money(entry.breakdown.expenses, 'ILS', 0)}</td>
                    <td className="tabular text-right">{money(entry.breakdown.netProfit, 'ILS', 0)}</td>
                    <td className="tabular text-right">
                      {money(entry.breakdown.incomeTax + entry.breakdown.surtax, 'ILS', 0)}
                    </td>
                    <td className="tabular text-right">
                      {money(entry.breakdown.nationalInsurance + entry.breakdown.healthInsurance, 'ILS', 0)}
                    </td>
                    <td className="tabular text-right">
                      {entry.breakdown.vatPosition < 0
                        ? `−${money(-entry.breakdown.vatPosition, 'ILS', 0)}`
                        : '—'}
                    </td>
                    <td className="tabular text-right">{money(entry.breakdown.totalTax, 'ILS', 0)}</td>
                    <td className="tabular text-right font-medium text-[var(--good-text)]">
                      {money(entry.breakdown.netAfterTax, 'ILS', 0)}
                    </td>
                    <td className="tabular text-right">{percent(entry.breakdown.effectiveRate)}</td>
                    <td>
                      {entry.eligible ? (
                        <Badge tone="good">Yes</Badge>
                      ) : (
                        <span title={entry.reason}>
                          <Badge tone="critical">No</Badge>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {best && (
            <div className="border-t border-[var(--line)] p-4 text-sm leading-relaxed text-[var(--ink-secondary)]">
              {tied.length > 1 ? (
                <>
                  <strong className="text-[var(--ink)]">
                    {tied.map((entry) => STATUS_LABELS[entry.status]).join(' and ')} come out identical here
                  </strong>{' '}
                  — {money(best.breakdown.netAfterTax, 'ILS', 0)} kept from{' '}
                  {money(best.breakdown.revenue, 'ILS', 0)} of revenue either way, an effective rate of{' '}
                  {percent(best.breakdown.effectiveRate)}. That is because you have logged{' '}
                  {deductions.vat > 0 ? 'very little' : 'no'} Israeli VAT on your costs, and VAT is the only thing
                  that separates these two statuses when every customer is foreign. Log the VAT on your
                  Israeli-invoiced costs — internet, phone, your accountant, locally bought hardware — and the
                  comparison becomes real: an osek murshe reclaims it, an osek patur does not. Until then the
                  choice is about compliance burden, not tax.
                </>
              ) : (
                <>
                  <strong className="text-[var(--ink)]">
                    On these numbers, {STATUS_LABELS[best.status]} keeps the most
                  </strong>{' '}
                  — {money(best.breakdown.netAfterTax, 'ILS', 0)} of {money(best.breakdown.revenue, 'ILS', 0)} in
                  revenue, an effective rate of {percent(best.breakdown.effectiveRate)}.
                </>
              )}
              {tied.length <= 1 && best.status === 'osek_murshe' && (
                <>
                  {' '}
                  The reason osek murshe often wins for a funded trader even below the turnover ceiling is
                  counter-intuitive: your customers are foreign, so your sales are zero-rated and you charge no
                  VAT at all — but you still reclaim the VAT on your Israeli purchases. An osek patur charges no
                  VAT either, and eats the input VAT as a cost. The catch is the paperwork: monthly or
                  bi-monthly reporting rather than one annual declaration.
                </>
              )}
              {tied.length <= 1 && best.status === 'osek_zair' && (
                <>
                  {' '}
                  Osek zair is new for {year} and suits a trader whose real expenses are below 30% of turnover —
                  it hands you that 30% as a flat deduction with no receipts to keep, no advances, and a
                  simplified return. Once your genuine costs exceed 30%, itemising beats it.
                </>
              )}
              <span className="mt-2 block text-[var(--ink-muted)]">
                This ranks by tax alone. Compliance burden, whether you want to be VAT-registered when dealing
                with Israeli suppliers, and what happens if you leave Israel all matter too — which is what the
                accountant conversation is for.
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* --- Reserving & advances -------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Advance payments (מקדמות)"
          description="The Tax Authority sets these from your last filed return, so a first profitable year generates no advances — and then a very large balancing payment."
          bodyClassName="p-0"
        >
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Due</th>
                  <th className="text-right">Amount if spread evenly</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.period}>
                    <td>{row.period}</td>
                    <td className="tabular">{row.dueOn}</td>
                    <td className="tabular text-right">{money(row.amount, 'ILS', 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--line)] p-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            Reserving against this schedule from day one is what prevents the ambush. If your income is
            materially lower than the year the advances were set from, you can apply to reduce them rather than
            lending the state money interest-free.
          </p>
        </Card>

        <Card title="Reserve status" description="Against payouts actually received.">
          <div className="space-y-0">
            <KeyValue label="Payouts received" value={money(summary.payoutsPaid, settings.baseCurrency, 0)} />
            <KeyValue label="Reserved so far" value={money(summary.taxReserved, settings.baseCurrency, 0)} />
            <KeyValue
              label="Estimated liability"
              value={money(
                settings.baseCurrency === 'ILS' ? breakdown.totalTax : breakdown.totalTax / rate,
                settings.baseCurrency,
                0,
              )}
            />
            <KeyValue
              label="Shortfall"
              value={
                <span
                  className={
                    summary.taxReserved <
                    (settings.baseCurrency === 'ILS' ? breakdown.totalTax : breakdown.totalTax / rate)
                      ? 'text-[var(--critical)]'
                      : 'text-[var(--good-text)]'
                  }
                >
                  {money(
                    Math.max(
                      0,
                      (settings.baseCurrency === 'ILS' ? breakdown.totalTax : breakdown.totalTax / rate) -
                        summary.taxReserved,
                    ),
                    settings.baseCurrency,
                    0,
                  )}
                </span>
              }
            />
            <KeyValue label="Suggested reserve rate" value={percent(suggestedReserve, 0)} />
          </div>

          <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Deductible costs claimed this year
          </h3>
          {summary.byCategory.length === 0 ? (
            <p className="text-xs text-[var(--ink-muted)]">Nothing logged yet.</p>
          ) : (
            <div className="space-y-0">
              {summary.byCategory.map((row) => (
                <KeyValue
                  key={row.category}
                  label={CATEGORY_LABELS[row.category] ?? titleCase(row.category)}
                  value={money(row.deductible, settings.baseCurrency, 0)}
                  hint={
                    row.total !== row.deductible
                      ? `${money(row.total, settings.baseCurrency, 0)} spent, ${percent(row.deductible / row.total, 0)} claimable`
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function monthsActiveIn(year: number, openedOn: string | null): number {
  if (!openedOn) return 12
  const opened = new Date(`${openedOn}T00:00:00Z`)
  if (opened.getUTCFullYear() < year) return 12
  if (opened.getUTCFullYear() > year) return 0
  return 12 - opened.getUTCMonth()
}
