import { CashflowChart } from '@/components/charts'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { BarRow, Badge, Card, EmptyState, KeyValue, Meter, PageHeader, Stat, StatGrid } from '@/components/ui'
import { CATEGORY_LABELS, money, percent, relativeDays, shortDate, signed, titleCase } from '@/lib/format'
import { EXPENSE_CATEGORIES } from '@/db/schema'
import { allocatePayout, normalisePlan } from '@/lib/allocation'
import { DEDUCTIBLE_DEFAULTS } from '@/lib/tax/israel'
import { today } from '@/lib/time'
import {
  cancelSubscription,
  deleteExpense,
  deletePayout,
  deleteSubscription,
  runSubscriptionCatchUp,
  saveAllocationPlan,
  saveExpense,
  savePayout,
  saveSubscription,
} from '@/server/actions'
import { annualisedCost, listExpenses, listFirms, listPayouts, listSubscriptions, moneySummary } from '@/server/money'
import { getSettings } from '@/server/settings'
import { listAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Money — Trading Journal' }

export default async function MoneyPage() {
  const [settings, summary, expenses, payouts, subscriptions, accounts, firms] = await Promise.all([
    getSettings(),
    moneySummary(),
    listExpenses(),
    listPayouts(),
    listSubscriptions(),
    listAccounts(),
    listFirms(),
  ])

  const ccy = settings.baseCurrency
  const plan = normalisePlan(settings.allocationPlan)
  const paid = payouts.filter((p) => p.status === 'paid')

  // Bucket balances are inferred from the plan applied to every payout to date —
  // this app has no view of the actual bank account.
  const balances: Record<string, number> = {}
  for (const payout of paid) {
    for (const [key, amount] of Object.entries(payout.allocation ?? {})) {
      balances[key] = (balances[key] ?? 0) + amount
    }
  }

  const nextPayoutPreview = allocatePayout(1000, plan, balances)
  const cashflow = buildCashflow(expenses, paid)
  const accountName = (id: number | null): string =>
    id === null ? '—' : (accounts.find((a) => a.id === id)?.label ?? `#${id}`)

  return (
    <>
      <PageHeader
        title="Money"
        subtitle="Payouts in, costs out, and where each payout should go."
        actions={
          <ActionButton action={runSubscriptionCatchUp} pendingLabel="Checking…">
            Log due subscriptions
          </ActionButton>
        }
      />

      <StatGrid columns={5}>
        <Card bodyClassName="p-4">
          <Stat label="Payouts received" value={money(summary.payoutsPaid, ccy, 0)} tone="good" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Pending" value={money(summary.payoutsPending, ccy, 0)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Total costs" value={money(summary.expensesTotal, ccy, 0)} tone="critical" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Net result" value={signed(summary.netBusinessResult, ccy, 0)} tone="pnl" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Deductible"
            value={money(summary.deductibleTotal, ccy, 0)}
            hint={`${percent(summary.expensesTotal > 0 ? summary.deductibleTotal / summary.expensesTotal : 0, 0)} of costs`}
          />
        </Card>
      </StatGrid>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Payouts and costs by month" className="lg:col-span-2">
          <CashflowChart data={cashflow} currency={ccy} height={240} />
        </Card>

        <Card title="Where costs go">
          {summary.byCategory.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--ink-muted)]">No costs logged yet</p>
          ) : (
            summary.byCategory.map((row) => (
              <BarRow
                key={row.category}
                label={CATEGORY_LABELS[row.category] ?? titleCase(row.category)}
                value={-row.total}
                max={Math.max(...summary.byCategory.map((r) => r.total), 1)}
                currency={ccy}
                sublabel={`${percent(row.total > 0 ? row.deductible / row.total : 0, 0)} deductible`}
              />
            ))
          )}
        </Card>
      </div>

      {/* --- Allocation ----------------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Payout allocation plan"
          description="Buckets fill in order. Anything a capped bucket refuses cascades to the next one down, so the tax reserve never absorbs spare cash."
        >
          <ActionForm action={saveAllocationPlan} className="space-y-4">
            {plan.buckets.map((bucket) => (
              <div key={bucket.key} className="rounded-lg border border-[var(--line)] p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--ink)]">{bucket.label}</span>
                  <span className="tabular text-xs text-[var(--ink-muted)]">
                    balance {money(balances[bucket.key] ?? 0, ccy, 0)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">{bucket.note}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Share of payout (%)">
                    <input
                      name={`percent_${bucket.key}`}
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      defaultValue={Math.round(bucket.percent * 100)}
                      className="input"
                    />
                  </Field>
                  <Field label="Cap" hint="Blank for no cap">
                    <input
                      name={`cap_${bucket.key}`}
                      type="number"
                      step="any"
                      defaultValue={bucket.capBase ?? ''}
                      className="input"
                    />
                  </Field>
                </div>
                {bucket.capBase !== null && (
                  <div className="mt-2">
                    <Meter
                      value={(balances[bucket.key] ?? 0) / bucket.capBase}
                      tone={(balances[bucket.key] ?? 0) >= bucket.capBase ? 'good' : 'accent'}
                      label={`${percent(Math.min(1, (balances[bucket.key] ?? 0) / bucket.capBase), 0)} of a ${money(bucket.capBase, ccy, 0)} cap`}
                    />
                  </div>
                )}
              </div>
            ))}
            <SubmitButton>Save plan</SubmitButton>
          </ActionForm>
        </Card>

        <Card
          title="How the next payout would split"
          description={`Worked on a ${money(1000, ccy, 0)} payout, against your current bucket balances.`}
        >
          <div className="space-y-0">
            {nextPayoutPreview.lines.map((line) => (
              <KeyValue
                key={line.key}
                label={line.label}
                hint={line.capped ? 'capped — the remainder cascaded downstream' : undefined}
                value={
                  <span className="flex items-center gap-2">
                    <span>{money(line.assigned, ccy)}</span>
                    <Badge tone={line.capped ? 'warn' : 'neutral'}>
                      {percent(line.assigned / 1000, 0)}
                    </Badge>
                  </span>
                }
              />
            ))}
            {nextPayoutPreview.unallocated > 0 && (
              <KeyValue
                label="Unallocated"
                hint="Every bucket is capped — add an uncapped bucket or raise a cap"
                value={money(nextPayoutPreview.unallocated, ccy)}
              />
            )}
          </div>

          <p className="mt-4 rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
            The tax bucket is not savings — it is money that already belongs to the tax authority and is simply
            sitting in your account until the assessment. Move it to a separate account on the day the payout lands.
            Nobody withholds this for you, and the bill arrives long after the money feels spendable.
          </p>
        </Card>
      </div>

      {/* --- Payouts -------------------------------------------------------- */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Payouts</h2>
          <Disclosure label="Record payout">
            <PayoutForm accounts={accounts} firms={firms} ccy={ccy} />
          </Disclosure>
        </div>

        <Card bodyClassName="p-0">
          {payouts.length === 0 ? (
            <EmptyState title="No payouts yet" body="Record each payout request so tax reserve and allocation stay accurate." />
          ) : (
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Paid</th>
                    <th>Account</th>
                    <th>Status</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Split</th>
                    <th className="text-right">Fee</th>
                    <th className="text-right">Net</th>
                    <th className="text-right">Tax reserved</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="tabular whitespace-nowrap">{shortDate(payout.requestedOn)}</td>
                      <td className="tabular whitespace-nowrap">{payout.paidOn ? shortDate(payout.paidOn) : '—'}</td>
                      <td className="max-w-[160px] truncate">{accountName(payout.accountId)}</td>
                      <td>
                        <Badge
                          tone={
                            payout.status === 'paid'
                              ? 'good'
                              : payout.status === 'rejected' || payout.status === 'cancelled'
                                ? 'critical'
                                : 'warn'
                          }
                        >
                          {titleCase(payout.status)}
                        </Badge>
                      </td>
                      <td className="tabular text-right">{money(payout.grossAmount, payout.currency, 0)}</td>
                      <td className="tabular text-right">{percent(payout.profitSplit, 0)}</td>
                      <td className="tabular text-right">{money(payout.processingFee, payout.currency, 0)}</td>
                      <td className="tabular text-right font-medium text-[var(--good-text)]">
                        {money(payout.netAmount, payout.currency)}
                      </td>
                      <td className="tabular text-right">{money(payout.taxReserved, ccy, 0)}</td>
                      <td className="text-right">
                        <ActionButton
                          action={async () => {
                            'use server'
                            return deletePayout(payout.id)
                          }}
                          className="btn btn-danger px-2 py-1"
                          confirm="Delete this payout?"
                        >
                          ✕
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* --- Subscriptions -------------------------------------------------- */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Subscriptions</h2>
            <p className="text-xs text-[var(--ink-secondary)]">
              {money(summary.subscriptionAnnual, ccy, 0)} a year across{' '}
              {subscriptions.filter((s) => s.active).length} active. Charges are logged automatically as they fall due.
            </p>
          </div>
          <Disclosure label="Add subscription">
            <SubscriptionForm accounts={accounts} />
          </Disclosure>
        </div>

        <Card bodyClassName="p-0">
          {subscriptions.length === 0 ? (
            <EmptyState
              title="No subscriptions tracked"
              body="Data feeds, platform fees and copier costs vanish from a journal because nobody logs the same $14 twelve times. Add them once and they log themselves."
            />
          ) : (
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th className="text-right">Amount</th>
                    <th>Cadence</th>
                    <th className="text-right">Per year</th>
                    <th>Next renewal</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td className="font-medium text-[var(--ink)]">{subscription.vendor}</td>
                      <td>{CATEGORY_LABELS[subscription.category] ?? titleCase(subscription.category)}</td>
                      <td className="tabular text-right">{money(subscription.amount, subscription.currency)}</td>
                      <td>{titleCase(subscription.cadence)}</td>
                      <td className="tabular text-right">{money(annualisedCost(subscription), subscription.currency, 0)}</td>
                      <td className="whitespace-nowrap">
                        {shortDate(subscription.nextRenewalOn)}
                        <span className="ml-1 text-[var(--ink-muted)]">
                          ({relativeDays(subscription.nextRenewalOn)})
                        </span>
                      </td>
                      <td>
                        <Badge tone={subscription.active ? 'good' : 'neutral'}>
                          {subscription.active ? 'Active' : 'Cancelled'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {subscription.active && (
                            <ActionButton
                              action={async () => {
                                'use server'
                                return cancelSubscription(subscription.id)
                              }}
                              className="btn px-2 py-1"
                            >
                              Cancel
                            </ActionButton>
                          )}
                          <ActionButton
                            action={async () => {
                              'use server'
                              return deleteSubscription(subscription.id)
                            }}
                            className="btn btn-danger px-2 py-1"
                            confirm="Delete this subscription? Past charges stay in your expenses."
                          >
                            ✕
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* --- Expenses ------------------------------------------------------- */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Expenses</h2>
          <Disclosure label="Log expense">
            <ExpenseForm accounts={accounts} firms={firms} />
          </Disclosure>
        </div>

        <Card bodyClassName="p-0">
          {expenses.length === 0 ? (
            <EmptyState
              title="No expenses logged"
              body="Evaluation fees, resets, data feeds, hardware and a share of your internet are all deductible against Israeli business income. Every one you fail to log is tax you pay unnecessarily."
            />
          ) : (
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">In {ccy}</th>
                    <th className="text-right">Deductible</th>
                    <th className="text-right">VAT</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 200).map((expense) => (
                    <tr key={expense.id}>
                      <td className="tabular whitespace-nowrap">{shortDate(expense.spentOn)}</td>
                      <td className="font-medium text-[var(--ink)]">{expense.vendor}</td>
                      <td>{CATEGORY_LABELS[expense.category] ?? titleCase(expense.category)}</td>
                      <td className="max-w-[140px] truncate text-xs">{accountName(expense.accountId)}</td>
                      <td className="tabular text-right">{money(expense.amount, expense.currency)}</td>
                      <td className="tabular text-right">{money(expense.amountBase, ccy)}</td>
                      <td className="tabular text-right">{percent(expense.deductiblePercent, 0)}</td>
                      <td className="tabular text-right">{expense.vatAmount > 0 ? money(expense.vatAmount, 'ILS') : '—'}</td>
                      <td className="text-right">
                        <ActionButton
                          action={async () => {
                            'use server'
                            return deleteExpense(expense.id)
                          }}
                          className="btn btn-danger px-2 py-1"
                          confirm="Delete this expense?"
                        >
                          ✕
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number]
type FirmRow = Awaited<ReturnType<typeof listFirms>>[number]

function ExpenseForm({ accounts, firms }: { accounts: AccountRow[]; firms: FirmRow[] }) {
  async function submit(formData: FormData) {
    'use server'
    return saveExpense(null, formData)
  }

  return (
    <Card>
      <ActionForm action={submit} className="space-y-3" resetOnSuccess>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Date">
            <input name="spentOn" type="date" defaultValue={today()} className="input" required />
          </Field>
          <Field label="Vendor">
            <input name="vendor" className="input" required placeholder="Apex, TradingView…" />
          </Field>
          <Field label="Category">
            <select name="category" className="select" defaultValue="eval_fee">
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category] ?? titleCase(category)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input name="amount" type="number" step="any" className="input" required />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Currency">
            <select name="currency" className="select" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="ILS">ILS</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
          <Field label="Account">
            <select name="accountId" className="select" defaultValue="">
              <option value="">Not account-specific</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Firm">
            <select name="firmId" className="select" defaultValue="">
              <option value="">No firm</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Deductible %"
            hint="Blank uses the category default"
          >
            <input name="deductiblePercent" type="number" step="1" min="0" max="100" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Israeli VAT paid (₪)" hint="Only on invoices from Israeli suppliers. Reclaimable as an osek murshe.">
            <input name="vatAmount" type="number" step="any" defaultValue="0" className="input" />
          </Field>
          <Field label="Description">
            <input name="description" className="input" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
          <input type="checkbox" name="hasReceipt" />I have the receipt or invoice on file
        </label>

        <details className="rounded-lg bg-[var(--surface-sunken)] p-3">
          <summary className="cursor-pointer text-xs font-medium text-[var(--ink)]">
            How each category is usually treated
          </summary>
          <dl className="mt-2 space-y-1.5">
            {Object.entries(DEDUCTIBLE_DEFAULTS).map(([category, info]) => (
              <div key={category} className="text-xs">
                <dt className="inline font-medium text-[var(--ink-secondary)]">
                  {CATEGORY_LABELS[category] ?? titleCase(category)} ({Math.round(info.percent * 100)}%):
                </dt>{' '}
                <dd className="inline text-[var(--ink-muted)]">{info.note}</dd>
              </div>
            ))}
          </dl>
        </details>

        <SubmitButton>Log expense</SubmitButton>
      </ActionForm>
    </Card>
  )
}

function SubscriptionForm({ accounts }: { accounts: AccountRow[] }) {
  async function submit(formData: FormData) {
    'use server'
    return saveSubscription(null, formData)
  }

  return (
    <Card>
      <ActionForm action={submit} className="space-y-3" resetOnSuccess>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Vendor">
            <input name="vendor" className="input" required placeholder="TradingView, Tradecopia…" />
          </Field>
          <Field label="Category">
            <select name="category" className="select" defaultValue="platform_subscription">
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category] ?? titleCase(category)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input name="amount" type="number" step="any" className="input" required />
          </Field>
          <Field label="Currency">
            <select name="currency" className="select" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="ILS">ILS</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Cadence">
            <select name="cadence" className="select" defaultValue="monthly">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <Field label="Started on">
            <input name="startedOn" type="date" defaultValue={today()} className="input" required />
          </Field>
          <Field label="Next renewal" hint="Blank puts it one period after the start">
            <input name="nextRenewalOn" type="date" className="input" />
          </Field>
          <Field label="Account">
            <select name="accountId" className="select" defaultValue="">
              <option value="">Not account-specific</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
          <input type="checkbox" name="autoLog" defaultChecked />
          Log the charge automatically each time it falls due
        </label>

        <SubmitButton>Add subscription</SubmitButton>
      </ActionForm>
    </Card>
  )
}

function PayoutForm({ accounts, firms, ccy }: { accounts: AccountRow[]; firms: FirmRow[]; ccy: string }) {
  async function submit(formData: FormData) {
    'use server'
    return savePayout(null, formData)
  }

  return (
    <Card>
      <ActionForm action={submit} className="space-y-3" resetOnSuccess>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Requested on">
            <input name="requestedOn" type="date" defaultValue={today()} className="input" required />
          </Field>
          <Field label="Paid on" hint="Blank until it lands">
            <input name="paidOn" type="date" className="input" />
          </Field>
          <Field label="Status">
            <select name="status" className="select" defaultValue="requested">
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Currency">
            <select name="currency" className="select" defaultValue={ccy}>
              <option value="USD">USD</option>
              <option value="ILS">ILS</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Gross amount" hint="Account profit before the split">
            <input name="grossAmount" type="number" step="any" className="input" required />
          </Field>
          <Field label="Profit split" hint="Your share, e.g. 0.9">
            <input name="profitSplit" type="number" step="0.01" min="0" max="1" defaultValue="0.9" className="input" />
          </Field>
          <Field label="Processing fee" hint="Wire or crypto fee the firm deducts">
            <input name="processingFee" type="number" step="any" defaultValue="0" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Account">
            <select name="accountId" className="select" defaultValue="">
              <option value="">No account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Firm">
            <select name="firmId" className="select" defaultValue="">
              <option value="">No firm</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Method">
            <input name="method" className="input" placeholder="Wire, Plane, crypto…" />
          </Field>
          <Field label="Reference">
            <input name="reference" className="input" />
          </Field>
        </div>

        <Field label="Notes">
          <textarea name="notes" rows={2} className="textarea" />
        </Field>

        <SubmitButton>Record payout</SubmitButton>
      </ActionForm>
    </Card>
  )
}

/** Monthly totals for the cashflow chart. */
function buildCashflow(
  expenses: Awaited<ReturnType<typeof listExpenses>>,
  payouts: Awaited<ReturnType<typeof listPayouts>>,
): { month: string; payouts: number; expenses: number }[] {
  const months = new Map<string, { payouts: number; expenses: number }>()

  const bump = (month: string, key: 'payouts' | 'expenses', amount: number) => {
    const entry = months.get(month) ?? { payouts: 0, expenses: 0 }
    entry[key] += amount
    months.set(month, entry)
  }

  for (const expense of expenses) bump(expense.spentOn.slice(0, 7), 'expenses', expense.amountBase)
  for (const payout of payouts) bump((payout.paidOn ?? payout.requestedOn).slice(0, 7), 'payouts', payout.netAmountBase)

  return [...months.entries()]
    .map(([month, value]) => ({ month, ...value }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
