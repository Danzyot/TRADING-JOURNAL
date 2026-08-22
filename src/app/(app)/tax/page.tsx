import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Badge, Card, CollapsibleCard, KeyValue, PageHeader, Stat, StatGrid } from '@/components/ui'
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
import {
  ACCOUNT_LAYERS,
  BANKING_VERIFIED,
  FEE_RULES,
  RESIDENCY_NOTE,
  SETUP_NOTES,
  annualRailPenalty,
  compareRails,
} from '@/lib/tax/banking'
import {
  DEDUCTIBLE_CHECKLIST,
  ENTITY_VERDICTS,
  RELOCATION_OPTIONS,
  RELOCATION_VERIFIED,
  RESIDENCY_REALITY,
} from '@/lib/tax/relocation'
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
  /**
   * How old the rate is.
   *
   * It refreshes in the daily job, but that job fails quietly by design — a
   * provider that is down must not zero the rate. Without showing the age, a
   * refresh that stopped months ago looks exactly like one that ran this
   * morning, while every shekel figure on the page drifts.
   */
  const fxAgeDays =
    settings.fxUpdatedAt === null
      ? null
      : Math.floor((Date.now() - new Date(settings.fxUpdatedAt).getTime()) / 86_400_000)
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

      <StatGrid columns={5}>
        <Card bodyClassName="p-4">
          <Stat label="Revenue" value={money(breakdown.revenue, 'ILS', 0)} hint="payouts received" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Deductible costs" value={money(breakdown.expenses, 'ILS', 0)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Effective rate"
            value={percent(breakdown.effectiveRate)}
            hint={`${percent(breakdown.marginalRate)} on the next shekel`}
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Total tax + NI" value={money(breakdown.totalTax, 'ILS', 0)} tone="critical" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Net profit" value={money(breakdown.netProfit, 'ILS', 0)} />
        </Card>
      </StatGrid>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* --- Computation ------------------------------------------------- */}
        <CollapsibleCard
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
        </CollapsibleCard>

        {/* --- Profile ------------------------------------------------------ */}
        <CollapsibleCard
          title="Your tax profile"
          description="Drives every figure on this page."
          defaultOpen
        >
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
            <KeyValue
              label="USD → ILS rate used"
              value={rate.toFixed(3)}
              hint={
                fxAgeDays === null
                  ? 'never refreshed — set it in Settings, or check the daily job'
                  : fxAgeDays <= 0
                    ? 'refreshed today'
                    : fxAgeDays > 7
                      ? `${fxAgeDays} days old — the daily refresh has not run`
                      : `refreshed ${fxAgeDays} day${fxAgeDays === 1 ? '' : 's'} ago`
              }
            />
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
        </CollapsibleCard>
      </div>

      {/* --- Status comparison ---------------------------------------------- */}
      <div className="mt-6">
        <CollapsibleCard
          title="Compare business statuses"
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
        </CollapsibleCard>
      </div>

      {/* --- Reserving & advances -------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CollapsibleCard
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
        </CollapsibleCard>

        <CollapsibleCard title="Reserve status" description="Against payouts actually received."
  defaultOpen
>
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
        </CollapsibleCard>
      </div>

      {/* --- What you can write off ---------------------------------------- */}
      <div className="mt-6">
        <CollapsibleCard
          title="What you can write off"
          description="Every one of these reduces taxable business income. Log them on the Earnings and expenses page as they happen — each unlogged expense is tax paid unnecessarily."
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-[var(--line)]">
            {DEDUCTIBLE_CHECKLIST.map((entry) => (
              <li key={entry.item} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="text-sm font-medium text-[var(--ink)]">{entry.item}</span>
                <span className="text-xs text-[var(--ink-secondary)] sm:text-right">{entry.note}</span>
              </li>
            ))}
          </ul>
        </CollapsibleCard>
      </div>

      {/* --- Structures ----------------------------------------------------- */}
      <div className="mt-6">
        <CollapsibleCard
          title="Company structures"
          description={`"Run it through an S corp / LLC and write everything off" — checked against the actual rules, ${RELOCATION_VERIFIED}.`}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ENTITY_VERDICTS.map((entity) => (
              <div key={entity.name} className="rounded-lg border border-[var(--line)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--ink)]">{entity.name}</span>
                  <Badge tone={entity.verdict.startsWith('Not') || entity.verdict.startsWith('Same') ? 'warn' : 'neutral'}>
                    {entity.verdict}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">{entity.detail}</p>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      </div>

      {/* --- Relocation ----------------------------------------------------- */}
      <div className="mt-6">
        <CollapsibleCard
          title="If you relocate"
          description={`Rough all-in burden on ~$100k of prop payouts under each country's 2026 rules. Researched ${RELOCATION_VERIFIED}; full write-up with sources in docs/TAX-RELOCATION.md.`}
          bodyClassName="p-0"
        >
          <p className="border-b border-[var(--line)] p-4 text-xs leading-relaxed text-[var(--serious)]">
            {RESIDENCY_REALITY}
          </p>
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Regime</th>
                  <th className="text-right">All-in ≈</th>
                  <th>Presence needed</th>
                  <th>The catch</th>
                </tr>
              </thead>
              <tbody>
                {RELOCATION_OPTIONS.map((option) => (
                  <tr key={option.country}>
                    <td className="whitespace-nowrap font-medium text-[var(--ink)]">
                      {option.flag} {option.country}
                    </td>
                    <td className="max-w-[280px] text-xs">{option.regime}</td>
                    <td className="tabular whitespace-nowrap text-right font-medium">{option.effective}</td>
                    <td className="max-w-[150px] text-xs">{option.presence}</td>
                    <td className="max-w-[260px] text-xs text-[var(--ink-secondary)]">{option.theCatch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {RELOCATION_OPTIONS.map((option) => (
              <details key={option.country} className="group">
                <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-sunken)]">
                  {option.flag} {option.country} — details
                </summary>
                <p className="px-4 pb-3 text-xs leading-relaxed text-[var(--ink-secondary)]">{option.detail}</p>
              </details>
            ))}
          </div>
          <p className="border-t border-[var(--line)] p-4 text-xs leading-relaxed text-[var(--ink-muted)]">
            These are published-rule summaries, not advice, and they rot — before acting, one session with an
            Israeli international-tax advisor for the exit and one with a local advisor in the destination.
          </p>
        </CollapsibleCard>

        <GettingPaid
          payoutsThisYear={summary.payoutsPaid}
          payoutCount={summary.payoutsPaidCount}
          ccy={settings.baseCurrency}
        />
      </div>
    </>
  )
}

/**
 * Getting paid: the account structure, and what each rail costs.
 *
 * This sits under the relocation table because it only makes sense after it.
 * Where money lands never changes what is owed on it — that is decided by
 * where you live. What this decides is how much of each payout survives the
 * trip, which is a different question and a surprisingly expensive one.
 */
function GettingPaid({
  payoutsThisYear,
  payoutCount,
  ccy,
}: {
  payoutsThisYear: number
  payoutCount: number
  ccy: string
}) {
  // Costed on a real average payout when there are some, and on a round number
  // when there are not — always labelled as which, so no figure is mistaken
  // for a measurement it is not.
  const measured = payoutsThisYear > 0 && payoutCount > 0
  const perPayout = measured ? payoutsThisYear / payoutCount : 2000
  const ranked = compareRails(perPayout)
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  const penalty = measured
    ? annualRailPenalty(payoutsThisYear, payoutCount)
    : (worst.cost - best.cost) * 12

  return (
    <>
      <CollapsibleCard
        title="Getting paid"
        description={`Four accounts, each guarding against a different failure. Verified ${BANKING_VERIFIED}.`}
        bodyClassName="p-0"
        defaultOpen
      >
        <div className="scroll-x border-b border-[var(--line)]">
          <table className="data">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Account</th>
                <th>Holds</th>
                <th>Why this one</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNT_LAYERS.map((layer) => (
                <tr key={layer.layer}>
                  <td className="whitespace-nowrap">
                    <span className="font-medium text-[var(--ink)]">{layer.layer}</span>{' '}
                    <span className="text-xs text-[var(--ink-muted)]">{layer.role}</span>
                  </td>
                  <td className="whitespace-nowrap font-medium text-[var(--ink)]">{layer.name}</td>
                  <td className="max-w-[180px] text-xs">{layer.holds}</td>
                  <td className="max-w-[420px] text-xs text-[var(--ink-secondary)]">{layer.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[var(--line)] border-b border-[var(--line)]">
          {ACCOUNT_LAYERS.map((layer) => (
            <details key={layer.layer} className="group">
              <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-sunken)]">
                {layer.name} — what it is guarding against
              </summary>
              <p className="px-4 pb-3 text-xs leading-relaxed text-[var(--ink-secondary)]">{layer.watchOut}</p>
            </details>
          ))}
        </div>

        <div className="p-4">
          <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
            On {measured ? 'your average' : 'a'} {money(perPayout, ccy, 0)} payout, the cheapest rail costs{' '}
            <strong className="text-[var(--good-text)]">{money(best.cost, ccy, 0)}</strong> ({best.rail.name})
            and the most expensive <strong className="text-[var(--critical)]">{money(worst.cost, ccy, 0)}</strong>{' '}
            ({worst.rail.name}) — a difference of{' '}
            <strong className="text-[var(--ink)]">{money(penalty, ccy, 0)}</strong>{' '}
            {measured ? 'across the payouts recorded here this year.' : 'over twelve payouts a year.'}{' '}
            {measured ? '' : 'Illustrative until you record payouts here.'}
          </p>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Transfer costs" bodyClassName="p-0"
  defaultOpen
>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Rail</th>
                <th className="text-right">On {money(perPayout, ccy, 0)}</th>
                <th>Speed</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ rail, cost }) => (
                <tr key={rail.name}>
                  <td className="whitespace-nowrap font-medium text-[var(--ink)]">{rail.name}</td>
                  <td className="tabular whitespace-nowrap text-right">{money(cost, ccy, 0)}</td>
                  <td className="whitespace-nowrap text-xs">{rail.speed}</td>
                  <td className="max-w-[360px] text-xs text-[var(--ink-secondary)]">{rail.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--line)] p-4 text-xs leading-relaxed text-[var(--ink-muted)]">
          The firm picks the processor; you pick the exit. That distinction is worth more than the
          difference between a 90% and an 85% split — a 90% split paying through PayPal is worse than 85%
          paying through Rise on stablecoin. Ask every firm whether a wire or crypto option exists before
          accepting the default.
        </p>
      </CollapsibleCard>

      <CollapsibleCard title="Rules worth following" bodyClassName="p-0">
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {FEE_RULES.map((rule) => (
                <tr key={rule.rule}>
                  <td className="max-w-[280px] font-medium text-[var(--ink)]">{rule.rule}</td>
                  <td className="max-w-[460px] text-xs text-[var(--ink-secondary)]">{rule.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Opening the accounts">
        <dl className="space-y-3">
          {SETUP_NOTES.map((note) => (
            <div key={note.title}>
              <dt className="text-xs font-medium text-[var(--ink)]">{note.title}</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-[var(--ink-secondary)]">{note.body}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
          {RESIDENCY_NOTE.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="text-xs leading-relaxed text-[var(--ink-muted)]">
              {paragraph}
            </p>
          ))}
        </div>
      </CollapsibleCard>
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
