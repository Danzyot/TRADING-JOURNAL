import Link from 'next/link'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { PlanCatalogue } from '../firms/plan-catalogue'
import { FIRM_CATALOGUES } from '@/lib/propfirm/catalogue'
import { AccountsGrid, type GridFirm, type GridRow } from './accounts-grid'
import { Card, EmptyState, PageHeader, Stat, StatGrid, clsx } from '@/components/ui'
import { money, percent } from '@/lib/format'
import { dailySeries } from '@/lib/analytics/metrics'
import { accountEquity } from '@/lib/analytics/balance'
import { consistencyCheck, drawdownState, payoutEligibility } from '@/lib/propfirm/rules'
import {
  addAccountFromPlan,
  bulkUpdateAccounts,
  deleteAccount,
  rebuildAccountTrades,
  saveAccount,
} from '@/server/actions'
import { getDashboardData } from '@/server/dashboard'
import { firmEconomics, listFirms } from '@/server/money'
import { getSettings } from '@/server/settings'
import { listAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Accounts — Trading Journal' }

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; firm?: string }>
}) {
  const [params, settings, accounts, firms, economics, dashboard] = await Promise.all([
    searchParams,
    getSettings(),
    listAccounts(),
    listFirms(),
    firmEconomics(),
    getDashboardData(),
  ])

  const ccy = settings.baseCurrency
  const cardsById = new Map(dashboard.accountCards.map((card) => [card.account.id, card]))
  const firmsById = new Map(firms.map((firm) => [firm.id, firm]))

  // --- Portfolio tiles ------------------------------------------------------
  // Pass-rate semantics match firmEconomics: funded/live counts as a pass.
  const passed = accounts.filter((a) => a.status === 'passed' || a.phase === 'funded' || a.phase === 'live')
  const failed = accounts.filter((a) => a.status === 'failed')
  const evaluations = accounts.filter((a) => a.phase === 'eval' || a.status === 'passed' || a.status === 'failed')
  const attempts = Math.max(evaluations.length, passed.length + failed.length)
  const passRate = attempts > 0 ? passed.length / attempts : null

  const totalSpent = accounts.reduce((sum, a) => sum + a.costBase, 0)
  const totalPayouts = dashboard.money.payoutsPaid
  const net = totalPayouts - totalSpent

  // --- Grid rows ------------------------------------------------------------
  const firmFilter = params.firm ?? ''
  const filtered = accounts.filter((account) => {
    if (firmFilter === '') return true
    if (firmFilter === 'none') return account.firmId === null
    return account.firmId === Number(firmFilter)
  })

  const fallbackDay = new Date().toISOString().slice(0, 10)
  const rows: GridRow[] = filtered.map((account) => {
    const accountTrades = dashboard.trades.filter((trade) => trade.accountId === account.id)
    const netPnl = accountTrades.reduce((sum, trade) => sum + trade.netPnl, 0)
    const card = cardsById.get(account.id)
    // Cards only cover active accounts, so the fallback has to reach the same
    // answer rather than the old frozen `currentBalance`.
    const balance = accountEquity(account, accountTrades)
    const equity = card?.equity ?? balance.equity
    const dd = card?.drawdown ?? drawdownState(account, [{ day: fallbackDay, equity }])
    const tracksDrawdown = account.drawdownType !== 'none' && (account.maxDrawdown ?? 0) > 0

    const daily = dailySeries(accountTrades).map((point) => ({ day: point.day, netPnl: point.netPnl }))
    const check = consistencyCheck(daily, account.consistencyPercent)
    const firm = account.firmId === null ? undefined : firmsById.get(account.firmId)

    let payout: GridRow['payout'] = null
    if ((account.phase === 'funded' || account.phase === 'live') && account.status === 'active') {
      const eligibility = payoutEligibility(account, {
        currentEquity: equity,
        tradingDays: new Set(accountTrades.map((trade) => trade.tradingDay)).size,
        dailyPnls: daily,
        profitSplit: account.profitSplit ?? firm?.profitSplit ?? 0.9,
      })
      const split = account.profitSplit ?? firm?.profitSplit ?? 0.9
      payout = eligibility.eligible
        ? {
            state: 'eligible',
            text: `≈ ${money(eligibility.netToTrader, ccy, 0)} to you after the ${percent(split, 0)} split`,
          }
        : {
            state: 'blocked',
            // The distance to the first payout is the actionable half of a
            // blocker list; a count alone says nothing about how close it is.
            text:
              eligibility.toFirstPayout > 0
                ? `${money(eligibility.toFirstPayout, ccy, 0)} more to a first payout`
                : `${eligibility.blockers.length} blocker${eligibility.blockers.length === 1 ? '' : 's'} to payout`,
          }
    }

    return {
      id: account.id,
      label: account.label,
      platform: account.platform,
      firmId: account.firmId,
      planLabel: account.planLabel,
      phase: account.phase,
      status: account.status,
      size: account.startingBalance,
      maxDrawdown: account.maxDrawdown,
      drawdownType: account.drawdownType,
      consistencyPct: account.consistencyPercent ? Math.round(account.consistencyPercent * 100) : null,
      profitTarget: account.profitTarget,
      maxContracts: account.maxContracts,
      maxMicroContracts: account.maxMicroContracts,
      costBase: account.costBase,
      equity,
      netPnl,
      anchor: {
        source: balance.anchor.source,
        asOf: balance.anchor.asOf,
        countedTrades: balance.countedTrades,
      },
      line: tracksDrawdown && Number.isFinite(dd.line) ? dd.line : null,
      roomPct: tracksDrawdown && Number.isFinite(dd.line) ? dd.roomPercent : null,
      toTarget:
        account.phase === 'eval' && account.status === 'active' && account.profitTarget
          ? Math.max(0, account.profitTarget - (equity - account.startingBalance))
          : null,
      bestDayPct: check.bestDay && check.totalProfit > 0 ? Math.round(check.bestDayShare * 100) : null,
      payout,
      needsSetup:
        account.startingBalance <= 0 ||
        (account.maxDrawdown === null && account.drawdownType !== 'none') ||
        (account.phase === 'eval' && account.profitTarget === null),
    }
  })

  const gridFirms: GridFirm[] = firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    plans: firm.plans ?? [],
  }))

  async function addFromPlan(formData: FormData) {
    'use server'
    return addAccountFromPlan(formData)
  }

  const editId = params.edit ? Number(params.edit) : null
  const editing = editId === null ? undefined : accounts.find((account) => account.id === editId)
  const hasUnassigned = accounts.some((account) => account.firmId === null)

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Every account you hold, in one table. Add one from a firm's plan and its rules come with it; edit any row inline, or apply one change across all of them."
      />

      <StatGrid columns={5}>
        <Card bodyClassName="p-4">
          <Stat
            label="Accounts"
            value={String(accounts.length)}
            hint={`${accounts.filter((a) => a.status === 'active').length} active`}
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Total spent" value={money(totalSpent, ccy, 0)} hint="Sum of account costs" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Total payouts" value={money(totalPayouts, ccy, 0)} hint="Paid out to date" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Net P&L"
            value={money(net, ccy, 0)}
            tone={net > 0 ? 'good' : net < 0 ? 'critical' : 'neutral'}
            hint="Payouts − account costs"
          />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Pass rate"
            value={passRate === null ? '—' : percent(passRate, 0)}
            hint={attempts > 0 ? `${passed.length} of ${attempts} evaluations` : 'No finished evaluations yet'}
          />
        </Card>
      </StatGrid>

      {/* --- Full edit form (opened from a grid row) ------------------------ */}
      {editing && (
        <div id="full-edit" className="mt-6">
          <Card
            title={`Edit ${editing.label}`}
            description="The full account form — everything the grid does not edit inline lives here."
            actions={
              <Link href="/accounts" className="text-xs text-[var(--accent)] hover:underline">
                Close
              </Link>
            }
          >
            <AccountForm firms={firms} ccy={ccy} account={editing} />
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton
                action={async () => {
                  'use server'
                  return rebuildAccountTrades(editing.id)
                }}
                pendingLabel="Rebuilding…"
              >
                Rebuild trades
              </ActionButton>
            </div>
          </Card>
        </div>
      )}

      {/* --- Accounts table ------------------------------------------------- */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Firm filter — server-rendered tabs, no client state to manage. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterTab href="/accounts" active={firmFilter === ''} label="All firms" />
            {firms.map((firm) => (
              <FilterTab
                key={firm.id}
                href={`/accounts?firm=${firm.id}`}
                active={firmFilter === String(firm.id)}
                label={firm.name}
              />
            ))}
            {hasUnassigned && (
              <FilterTab href="/accounts?firm=none" active={firmFilter === 'none'} label="No firm" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* The catalogue first: it fills in eighteen rule fields that the
                blank form leaves to memory, and a blank drawdown silently
                turns off every warning on the account. */}
            <Disclosure label="Add from a plan">
              <PlanCatalogue catalogues={FIRM_CATALOGUES} addAction={addFromPlan} />
            </Disclosure>
            <Disclosure label="Add blank account">
              <AccountForm firms={firms} ccy={ccy} />
            </Disclosure>
          </div>
        </div>

        {accounts.length === 0 ? (
          <Card>
            <EmptyState
              title="No accounts yet"
              body="Add each prop account you trade, with its size, drawdown allowance and drawdown type. Those three numbers drive every risk warning in the app."
            />
          </Card>
        ) : (
          <AccountsGrid
            rows={rows}
            firms={gridFirms}
            ccy={ccy}
            bulkAction={bulkUpdateAccounts}
            deleteAction={deleteAccount}
          />
        )}
      </div>

      {/* --- Firm economics ------------------------------------------------- */}
      {/* A table of zeros teaches nothing; it appears once there is money in it. */}
      {economics.some((row) => row.accountsTotal > 0 || row.spend > 0 || row.payouts > 0) && (
        <div className="mt-6">
          <Card
            title="Firm economics"
            description="What each firm has cost against what it has paid. This is what decides whether adding accounts is investment or gambling."
            bodyClassName="p-0"
          >
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Firm</th>
                    <th className="text-right">Accounts</th>
                    <th className="text-right">Passed</th>
                    <th className="text-right">Pass rate</th>
                    <th className="text-right">Spend</th>
                    <th className="text-right">Payouts</th>
                    <th className="text-right">Net</th>
                    <th className="text-right">Cost per funded</th>
                    <th className="text-right">Return on spend</th>
                  </tr>
                </thead>
                <tbody>
                  {economics.map((row) => (
                    <tr key={row.firmId}>
                      <td className="font-medium text-[var(--ink)]">{row.name}</td>
                      <td className="tabular text-right">{row.accountsTotal}</td>
                      <td className="tabular text-right">{row.accountsPassed}</td>
                      <td className="tabular text-right">
                        {row.passRate === null ? '—' : percent(row.passRate, 0)}
                      </td>
                      <td className="tabular text-right">{money(row.spend, ccy, 0)}</td>
                      <td className="tabular text-right">{money(row.payouts, ccy, 0)}</td>
                      <td
                        className={`tabular text-right font-medium ${
                          row.net >= 0 ? 'text-[var(--good-text)]' : 'text-[var(--critical)]'
                        }`}
                      >
                        {money(row.net, ccy, 0)}
                      </td>
                      <td className="tabular text-right">
                        {row.costPerFunded === null ? '—' : money(row.costPerFunded, ccy, 0)}
                      </td>
                      <td className="tabular text-right">
                        {row.roi === null ? '—' : `${row.roi.toFixed(1)}x`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

    </>
  )
}

// ---------------------------------------------------------------------------

function FilterTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={clsx(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-transparent bg-[var(--accent)] font-medium text-white'
          : 'border-[var(--line)] text-[var(--ink-secondary)] hover:border-[var(--line-strong)]',
      )}
    >
      {label}
    </Link>
  )
}

type FirmRow = Awaited<ReturnType<typeof listFirms>>[number]
type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number]



function AccountForm({ firms, ccy, account }: { firms: FirmRow[]; ccy: string; account?: AccountRow }) {
  async function submit(formData: FormData) {
    'use server'
    return saveAccount(account?.id ?? null, formData)
  }

  return (
    <Card>
      <ActionForm action={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Label" hint="How you refer to it, e.g. Apex 50k #3">
            <input name="label" defaultValue={account?.label ?? ''} className="input" required />
          </Field>
          <Field label="Firm">
            <select name="firmId" defaultValue={account?.firmId ?? ''} className="select">
              <option value="">No firm</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Broker account id" hint="The name the broker uses — how synced fills find this account">
            <input name="externalId" defaultValue={account?.externalId ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Data source" hint="Where this account's fills come from">
            <select name="platform" defaultValue={account?.platform ?? 'tradovate'} className="select">
              <option value="tradovate">Tradovate</option>
              <option value="rithmic">Rithmic</option>
              <option value="projectx">ProjectX</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
          <Field label="Phase">
            <select name="phase" defaultValue={account?.phase ?? 'eval'} className="select">
              <option value="eval">Evaluation</option>
              <option value="funded">Funded</option>
              <option value="live">Live</option>
              <option value="personal">Personal</option>
              <option value="demo">Demo</option>
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={account?.status ?? 'active'} className="select">
              <option value="active">Active</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          <Field label="Started on">
            <input name="startedOn" type="date" defaultValue={account?.startedOn ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={`Account size (${ccy})`}>
            <input
              name="startingBalance"
              type="number"
              step="any"
              defaultValue={account?.startingBalance ?? 50000}
              className="input"
              required
            />
          </Field>
          <Field label="Profit target">
            <input name="profitTarget" type="number" step="any" defaultValue={account?.profitTarget ?? ''} className="input" />
          </Field>
          <Field label="Max drawdown">
            <input name="maxDrawdown" type="number" step="any" defaultValue={account?.maxDrawdown ?? ''} className="input" />
          </Field>
          <Field label="Current equity" hint="Kept fresh by sync where available">
            <input name="currentBalance" type="number" step="any" defaultValue={account?.currentBalance ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field
            label="Known balance"
            hint="For an account you did not journal from day one. Trades before the date below are already inside this number; everything after it moves it."
          >
            <input
              name="openingBalance"
              type="number"
              step="any"
              defaultValue={account?.openingBalance ?? ''}
              className="input"
            />
          </Field>
          <Field label="…at the close of" hint="Both fields or neither — a balance with no date cannot say what it includes">
            <input
              name="openingBalanceAt"
              type="date"
              defaultValue={account?.openingBalanceAt ?? ''}
              className="input"
            />
          </Field>
          <Field label="Payout buffer" hint="Profit that must stay in the account. You can withdraw down to this line, not to the account size.">
            <input name="buffer" type="number" step="any" defaultValue={account?.buffer ?? ''} className="input" />
          </Field>
          <Field label="Minimum payout" hint="The smallest request the firm will process">
            <input name="minPayout" type="number" step="any" defaultValue={account?.minPayout ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Drawdown type"
            hint="Intraday trailing follows your highest tick — the most punishing kind, and the most common."
          >
            <select name="drawdownType" defaultValue={account?.drawdownType ?? 'trailing_eod'} className="select">
              <option value="trailing_intraday">Trailing — intraday equity</option>
              <option value="trailing_eod">Trailing — end of day</option>
              <option value="static">Static</option>
              <option value="none">None</option>
            </select>
          </Field>
          <Field label="Drawdown locks at" hint="Equity at which the trailing line stops moving. Leave blank if it never locks.">
            <input name="drawdownLocksAt" type="number" step="any" defaultValue={account?.drawdownLocksAt ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Daily loss limit">
            <input name="dailyLossLimit" type="number" step="any" defaultValue={account?.dailyLossLimit ?? ''} className="input" />
          </Field>
          <Field label="Max contracts" hint="Minis, as most firms quote them">
            <input name="maxContracts" type="number" defaultValue={account?.maxContracts ?? ''} className="input" />
          </Field>
          <Field label="Max micro contracts">
            <input
              name="maxMicroContracts"
              type="number"
              defaultValue={account?.maxMicroContracts ?? ''}
              className="input"
            />
          </Field>
          <Field
            label="Profit split"
            hint="Your share, e.g. 0.9. Blank uses the firm's — it differs between accounts at the same firm."
          >
            <input
              name="profitSplit"
              type="number"
              step="0.01"
              min="0"
              max="1"
              defaultValue={account?.profitSplit ?? ''}
              className="input"
            />
          </Field>
          <Field label="Min trading days">
            <input name="minTradingDays" type="number" defaultValue={account?.minTradingDays ?? ''} className="input" />
          </Field>
          <Field label="Winning days for payout" hint="e.g. 5 — most firms now gate payouts on winning days, not just trading days">
            <input name="minWinningDays" type="number" defaultValue={account?.minWinningDays ?? ''} className="input" />
          </Field>
          <Field label="Min profit per winning day" hint="e.g. 150 — a day must net at least this to count">
            <input
              name="winningDayMinProfit"
              type="number"
              step="any"
              defaultValue={account?.winningDayMinProfit ?? ''}
              className="input"
            />
          </Field>
          <Field label="Consistency %" hint="Max share of profit one day may be">
            <input
              name="consistencyPercent"
              type="number"
              step="1"
              defaultValue={account?.consistencyPercent ? Math.round(account.consistencyPercent * 100) : ''}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Cost so far" hint="Evaluation fee, resets, activation">
            <input name="costBase" type="number" step="any" defaultValue={account?.costBase ?? 0} className="input" />
          </Field>
          <Field
            label="Round-turn commission per contract"
            hint="Roughly $1.20–$4.00 depending on the product. Leaving this at zero makes every strategy look better than it is."
          >
            <input
              name="commissionPerContract"
              type="number"
              step="0.01"
              defaultValue={account?.commissionPerContract ?? 0}
              className="input"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
          <input type="checkbox" name="excludeFromStats" defaultChecked={account?.excludeFromStats ?? false} />
          Exclude from headline statistics (for demo or experimental accounts)
        </label>

        <Field label="Payout policy" hint="This account's rules — consistency, caps, schedule.">
          <textarea name="payoutPolicy" rows={2} defaultValue={account?.payoutPolicy ?? ''} className="textarea" />
        </Field>

        <Field label="Notes">
          <textarea name="notes" rows={2} defaultValue={account?.notes ?? ''} className="textarea" />
        </Field>

        <SubmitButton>{account ? 'Save account' : 'Add account'}</SubmitButton>
      </ActionForm>
    </Card>
  )
}
