import { CashflowChart } from '@/components/charts'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { EditableRow } from '@/components/editable-row'
import { CryptoFields } from '@/components/crypto-fields'
import { Editable } from '@/components/site-text'
import { BarRow, Badge, Card, EmptyState, KeyValue, Meter, PageHeader, Stat, StatGrid } from '@/components/ui'
import { CATEGORY_LABELS, money, percent, relativeDays, shortDate, signed, titleCase } from '@/lib/format'
import { EXPENSE_CATEGORIES } from '@/db/schema'
import { allocatePayout, normalisePlan } from '@/lib/allocation'
import { DEDUCTIBLE_DEFAULTS } from '@/lib/tax/israel'
import { NETWORKS, explorerAddressUrl, explorerTxUrl, networkFor, shorten } from '@/lib/crypto-assets'
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
  saveWallet,
  deleteWallet,
} from '@/server/actions'
import {
  annualisedCost,
  listExpenses,
  listFirms,
  listPayouts,
  listSubscriptions,
  listWallets,
  moneySummary,
} from '@/server/money'
import { getSettings } from '@/server/settings'
import { listAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Earnings — Trading Journal' }

export default async function MoneyPage() {
  const [settings, summary, expenses, payouts, subscriptions, accounts, firms, wallets] = await Promise.all([
    getSettings(),
    moneySummary(),
    listExpenses(),
    listPayouts(),
    listSubscriptions(),
    listAccounts(),
    listFirms(),
    listWallets(),
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
        title="Earnings"
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
          <h2 className="text-sm font-semibold text-[var(--ink)]">
            <Editable scope="heading">Payouts</Editable>
          </h2>
          <Disclosure label="Record payout">
            <PayoutForm accounts={accounts} firms={firms} ccy={ccy} wallets={wallets} />
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
                    <EditableRow
                      key={payout.id}
                      columns={10}
                      editor={
                        <PayoutForm accounts={accounts} firms={firms} ccy={ccy} payout={payout} wallets={wallets} />
                      }
                      actions={
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
                      }
                      cells={
                        <>
                      <td className="tabular whitespace-nowrap">{shortDate(payout.requestedOn)}</td>
                      <td className="tabular whitespace-nowrap">{payout.paidOn ? shortDate(payout.paidOn) : '—'}</td>
                      <td className="max-w-[160px] truncate">
                        <span className="flex items-center gap-1.5">
                          {accountName(payout.accountId)}
                          <SourceBadge source={payout.source} />
                          <ChainLink network={payout.cryptoNetwork} hash={payout.cryptoTxHash} />
                        </span>
                      </td>
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
                        </>
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* --- Wallets -------------------------------------------------------- */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              <Editable scope="heading">Wallets</Editable>
            </h2>
            <Editable as="p" scope="body" className="text-xs text-[var(--ink-secondary)]">
              Receiving addresses, so a crypto payout has a destination with a name. Nothing here can move money — an
              address is what you hand a firm, not a key.
            </Editable>
          </div>
          <Disclosure label="Add wallet">
            <WalletForm />
          </Disclosure>
        </div>

        <Card>
          {wallets.length === 0 ? (
            <EmptyState
              title="No wallets saved"
              body="Add the addresses you get paid to and the payout form will offer them by name."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Chain</th>
                    <th>Address</th>
                    <th>Assets</th>
                    <th>Custody</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet) => (
                    <EditableRow
                      key={wallet.id}
                      columns={6}
                      editor={<WalletForm wallet={wallet} />}
                      actions={
                        <ActionButton
                          action={async () => {
                            'use server'
                            return deleteWallet(wallet.id)
                          }}
                          className="btn btn-danger px-2 py-1"
                          confirm="Remove this wallet? Payouts keep their address and hash."
                        >
                          ✕
                        </ActionButton>
                      }
                      cells={
                        <>
                          <td className="font-medium text-[var(--ink)]">
                            <span className="flex items-center gap-1.5">
                              {wallet.label}
                              {!wallet.active && <Badge tone="warn">Retired</Badge>}
                            </span>
                          </td>
                          <td>{networkFor(wallet.network)?.label ?? wallet.network}</td>
                          <td className="font-mono text-xs">
                            {explorerAddressUrl(wallet.network, wallet.address) ? (
                              <a
                                href={explorerAddressUrl(wallet.network, wallet.address)!}
                                target="_blank"
                                rel="noreferrer noopener"
                                title={wallet.address}
                                className="hover:text-[var(--accent)]"
                              >
                                {shorten(wallet.address, 8, 6)}
                              </a>
                            ) : (
                              shorten(wallet.address, 8, 6)
                            )}
                          </td>
                          <td className="text-xs">{wallet.assets ?? '—'}</td>
                          <td className="text-xs">{wallet.custody ?? '—'}</td>
                        </>
                      }
                    />
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
            <h2 className="text-sm font-semibold text-[var(--ink)]">
            <Editable scope="heading">Subscriptions</Editable>
          </h2>
            <p className="text-xs text-[var(--ink-secondary)]">
              {money(summary.subscriptionAnnual, ccy, 0)} a year across{' '}
              {subscriptions.filter((s) => s.active).length} active.{' '}
              <Editable scope="body">Charges are logged automatically as they fall due.</Editable>
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
                    <EditableRow
                      key={subscription.id}
                      columns={8}
                      editor={<SubscriptionForm accounts={accounts} subscription={subscription} />}
                      actions={
                        <>
                          {subscription.active && (
                            <ActionButton
                              action={async () => {
                                'use server'
                                return cancelSubscription(subscription.id)
                              }}
                              className="btn px-2 py-1 text-xs"
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
                        </>
                      }
                      cells={
                        <>
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
                        </>
                      }
                    />
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
          <h2 className="text-sm font-semibold text-[var(--ink)]">
            <Editable scope="heading">Expenses</Editable>
          </h2>
          <Disclosure label="Log expense">
            <ExpenseForm accounts={accounts} firms={firms} wallets={wallets} ccy={ccy} />
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
                    <EditableRow
                      key={expense.id}
                      columns={9}
                      editor={<ExpenseForm accounts={accounts} firms={firms} expense={expense} wallets={wallets} ccy={ccy} />}
                      actions={
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
                      }
                      cells={
                        <>
                      <td className="tabular whitespace-nowrap">{shortDate(expense.spentOn)}</td>
                      <td className="font-medium text-[var(--ink)]">
                        <span className="flex items-center gap-1.5">
                          {expense.vendor}
                          <SourceBadge source={expense.source} />
                          <ChainLink network={expense.cryptoNetwork} hash={expense.cryptoTxHash} />
                        </span>
                      </td>
                      <td>{CATEGORY_LABELS[expense.category] ?? titleCase(expense.category)}</td>
                      <td className="max-w-[140px] truncate text-xs">{accountName(expense.accountId)}</td>
                      <td className="tabular text-right">{money(expense.amount, expense.currency)}</td>
                      <td className="tabular text-right">{money(expense.amountBase, ccy)}</td>
                      <td className="tabular text-right">{percent(expense.deductiblePercent, 0)}</td>
                      <td className="tabular text-right">{expense.vatAmount > 0 ? money(expense.vatAmount, 'ILS') : '—'}</td>
                        </>
                      }
                    />
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
type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number]
type PayoutRow = Awaited<ReturnType<typeof listPayouts>>[number]
type WalletRow = Awaited<ReturnType<typeof listWallets>>[number]

/**
 * A transaction hash, as a link to the chain that settled it.
 *
 * The point of recording the hash at all is that the row stops being a claim
 * and becomes something anyone can check — so it renders as one click to the
 * explorer rather than 66 characters of hex nobody would ever retype.
 */
function ChainLink({ network, hash }: { network: string | null; hash: string | null }) {
  const url = explorerTxUrl(network, hash)
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={`${networkFor(network)?.label ?? network} · ${hash}`}
      className="tabular rounded bg-[var(--surface-sunken)] px-1 py-0.5 font-mono text-[0.625rem] text-[var(--ink-secondary)] hover:text-[var(--accent)]"
    >
      {shorten(hash, 4, 4)}
    </a>
  )
}
type SubscriptionRow = Awaited<ReturnType<typeof listSubscriptions>>[number]

/**
 * Marks a row the email automation created rather than a person.
 *
 * Automation misreads things — a firm changes a template, a total is taken
 * from the wrong line — and the fix is only easy if the rows worth double
 * checking are the ones you can see at a glance.
 */
function SourceBadge({ source }: { source: string | null }) {
  if (source !== 'email') return null
  return (
    <span title="Logged automatically from your inbox — press Edit to correct it">
      <Badge tone="neutral">Email</Badge>
    </span>
  )
}

/**
 * One form for logging an expense and for correcting one.
 *
 * The same fields, validation and defaults either way — an edit screen that
 * drifts from its create screen is how a field ends up uneditable.
 */
function ExpenseForm({
  accounts,
  firms,
  expense,
  wallets,
  ccy,
}: {
  accounts: AccountRow[]
  firms: FirmRow[]
  expense?: ExpenseRow
  wallets: WalletRow[]
  ccy: string
}) {
  async function submit(formData: FormData) {
    'use server'
    return saveExpense(expense?.id ?? null, formData)
  }

  const form = (
      <ActionForm action={submit} className="space-y-3" resetOnSuccess={!expense}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Date">
            <input name="spentOn" type="date" defaultValue={expense?.spentOn ?? today()} className="input" required />
          </Field>
          <Field label="Vendor">
            <input name="vendor" className="input" required placeholder="Apex, TradingView…" defaultValue={expense?.vendor} />
          </Field>
          <Field label="Category">
            <select name="category" className="select" defaultValue={expense?.category ?? 'eval_fee'}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category] ?? titleCase(category)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input name="amount" type="number" step="any" className="input" required defaultValue={expense?.amount} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <CryptoFields
            defaultCurrency={expense?.currency ?? 'USD'}
            defaultNetwork={expense?.cryptoNetwork}
            defaultTxHash={expense?.cryptoTxHash}
            defaultAddress={expense?.cryptoAddress}
            defaultRate={expense?.fxRate}
            wallets={wallets}
            baseCurrency={ccy}
          />
          <Field label="Account">
            <select name="accountId" className="select" defaultValue={expense?.accountId ?? ''}>
              <option value="">Not account-specific</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Firm">
            <select name="firmId" className="select" defaultValue={expense?.firmId ?? ''}>
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
            <input
              name="deductiblePercent"
              type="number"
              step="1"
              min="0"
              max="100"
              className="input"
              defaultValue={expense ? Math.round(expense.deductiblePercent * 100) : ''}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Israeli VAT paid (₪)" hint="Only on invoices from Israeli suppliers. Reclaimable as an osek murshe.">
            <input name="vatAmount" type="number" step="any" defaultValue={expense?.vatAmount ?? 0} className="input" />
          </Field>
          <Field label="Description">
            <input name="description" className="input" defaultValue={expense?.description ?? ''} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
          <input type="checkbox" name="hasReceipt" defaultChecked={expense?.hasReceipt ?? false} />I have the
          receipt or invoice on file
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

        <SubmitButton>{expense ? 'Save changes' : 'Log expense'}</SubmitButton>
      </ActionForm>
  )

  // Inside a table the editor is already framed by the row it belongs to.
  return expense ? form : <Card>{form}</Card>
}

function SubscriptionForm({
  accounts,
  subscription,
}: {
  accounts: AccountRow[]
  subscription?: SubscriptionRow
}) {
  async function submit(formData: FormData) {
    'use server'
    return saveSubscription(subscription?.id ?? null, formData)
  }

  const form = (
      <ActionForm action={submit} className="space-y-3" resetOnSuccess={!subscription}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Vendor">
            <input
              name="vendor"
              className="input"
              required
              placeholder="TradingView, Tradecopia…"
              defaultValue={subscription?.vendor}
            />
          </Field>
          <Field label="Category">
            <select name="category" className="select" defaultValue={subscription?.category ?? 'platform_subscription'}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category] ?? titleCase(category)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input name="amount" type="number" step="any" className="input" required defaultValue={subscription?.amount} />
          </Field>
          <Field label="Currency">
            <select name="currency" className="select" defaultValue={subscription?.currency ?? 'USD'}>
              <option value="USD">USD</option>
              <option value="ILS">ILS</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Cadence">
            <select name="cadence" className="select" defaultValue={subscription?.cadence ?? 'monthly'}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <Field label="Started on">
            <input
              name="startedOn"
              type="date"
              defaultValue={subscription?.startedOn ?? today()}
              className="input"
              required
            />
          </Field>
          <Field label="Next renewal" hint="Blank puts it one period after the start">
            <input
              name="nextRenewalOn"
              type="date"
              className="input"
              defaultValue={subscription?.nextRenewalOn ?? ''}
            />
          </Field>
          <Field label="Account">
            <select name="accountId" className="select" defaultValue={subscription?.accountId ?? ''}>
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
          <input type="checkbox" name="autoLog" defaultChecked={subscription?.autoLog ?? true} />
          Log the charge automatically each time it falls due
        </label>

        <SubmitButton>{subscription ? 'Save changes' : 'Add subscription'}</SubmitButton>
      </ActionForm>
  )

  return subscription ? form : <Card>{form}</Card>
}

function PayoutForm({
  accounts,
  firms,
  ccy,
  payout,
  wallets,
}: {
  accounts: AccountRow[]
  firms: FirmRow[]
  ccy: string
  payout?: PayoutRow
  wallets: WalletRow[]
}) {
  async function submit(formData: FormData) {
    'use server'
    return savePayout(payout?.id ?? null, formData)
  }

  const form = (
      <ActionForm action={submit} className="space-y-3" resetOnSuccess={!payout}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Requested on">
            <input
              name="requestedOn"
              type="date"
              defaultValue={payout?.requestedOn ?? today()}
              className="input"
              required
            />
          </Field>
          <Field label="Paid on" hint="Blank until it lands">
            <input name="paidOn" type="date" className="input" defaultValue={payout?.paidOn ?? ''} />
          </Field>
          <Field label="Status">
            <select name="status" className="select" defaultValue={payout?.status ?? 'requested'}>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <CryptoFields
            defaultCurrency={payout?.currency ?? ccy}
            defaultNetwork={payout?.cryptoNetwork}
            defaultTxHash={payout?.cryptoTxHash}
            defaultAddress={payout?.cryptoAddress}
            defaultRate={payout?.fxRate}
            wallets={wallets}
            baseCurrency={ccy}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Gross amount" hint="Account profit before the split">
            <input
              name="grossAmount"
              type="number"
              step="any"
              className="input"
              required
              defaultValue={payout?.grossAmount}
            />
          </Field>
          <Field label="Profit split" hint="Your share, e.g. 0.9">
            <input
              name="profitSplit"
              type="number"
              step="0.01"
              min="0"
              max="1"
              defaultValue={payout?.profitSplit ?? 0.9}
              className="input"
            />
          </Field>
          <Field label="Processing fee" hint="Wire or crypto fee the firm deducts">
            <input
              name="processingFee"
              type="number"
              step="any"
              defaultValue={payout?.processingFee ?? 0}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Account">
            <select name="accountId" className="select" defaultValue={payout?.accountId ?? ''}>
              <option value="">No account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Firm">
            <select name="firmId" className="select" defaultValue={payout?.firmId ?? ''}>
              <option value="">No firm</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Method">
            <input name="method" className="input" placeholder="Wire, Plane, crypto…" defaultValue={payout?.method ?? ''} />
          </Field>
          <Field label="Reference">
            <input name="reference" className="input" defaultValue={payout?.reference ?? ''} />
          </Field>
        </div>

        <Field label="Notes">
          <textarea name="notes" rows={2} className="textarea" defaultValue={payout?.notes ?? ''} />
        </Field>

        <SubmitButton>{payout ? 'Save changes' : 'Record payout'}</SubmitButton>
      </ActionForm>
  )

  return payout ? form : <Card>{form}</Card>
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

function WalletForm({ wallet }: { wallet?: WalletRow }) {
  async function submit(formData: FormData) {
    'use server'
    return saveWallet(wallet?.id ?? null, formData)
  }

  const form = (
    <ActionForm action={submit} className="space-y-3" resetOnSuccess={!wallet}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Label" hint="What you call it, not what the chain calls it">
          <input name="label" className="input" required placeholder="Revolut USDC" defaultValue={wallet?.label} />
        </Field>
        <Field label="Chain">
          <select name="network" className="select" defaultValue={wallet?.network ?? ''} required>
            <option value="">Choose a chain…</option>
            {NETWORKS.map((network) => (
              <option key={network.id} value={network.id}>
                {network.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assets" hint="What actually arrives here">
          <input name="assets" className="input" placeholder="USDC, USDT" defaultValue={wallet?.assets ?? ''} />
        </Field>
      </div>

      <Field label="Address">
        <input
          name="address"
          className="input font-mono text-xs"
          required
          placeholder="0x…"
          defaultValue={wallet?.address}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Custody" hint="Who holds the keys — the first thing a compliance question asks">
          <input
            name="custody"
            className="input"
            placeholder="Self-custody hardware, Revolut, Coinbase…"
            defaultValue={wallet?.custody ?? ''}
          />
        </Field>
        <Field label="Notes">
          <input name="notes" className="input" defaultValue={wallet?.notes ?? ''} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
        <input type="checkbox" name="active" defaultChecked={wallet?.active ?? true} />
        Still in use
      </label>

      <SubmitButton>{wallet ? 'Save changes' : 'Add wallet'}</SubmitButton>
    </ActionForm>
  )

  return wallet ? form : <Card>{form}</Card>
}
