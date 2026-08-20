import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { FirmForm } from './firm-form'
import { Badge, Card, EmptyState, KeyValue, Meter, PageHeader, Stat, StatGrid } from '@/components/ui'
import { money, percent, titleCase } from '@/lib/format'
import { dailySeries } from '@/lib/analytics/metrics'
import { payoutEligibility } from '@/lib/propfirm/rules'
import { deleteAccount, deleteFirm, rebuildAccountTrades, saveAccount, saveFirm } from '@/server/actions'
import { getDashboardData } from '@/server/dashboard'
import { firmEconomics, listFirms } from '@/server/money'
import { getSettings } from '@/server/settings'
import { listAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Accounts — Trading Journal' }

export default async function AccountsPage() {
  const [settings, accounts, firms, economics, dashboard] = await Promise.all([
    getSettings(),
    listAccounts(),
    listFirms(),
    firmEconomics(),
    getDashboardData(),
  ])

  const ccy = settings.baseCurrency
  const cardsById = new Map(dashboard.accountCards.map((card) => [card.account.id, card]))

  const funded = accounts.filter((a) => a.phase === 'funded' || a.phase === 'live').length
  const evaluations = accounts.filter((a) => a.phase === 'eval' && a.status === 'active').length
  const totalCost = accounts.reduce((sum, a) => sum + a.costBase, 0)

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Prop firms and the accounts you hold with them. Drawdown rules here drive the warnings everywhere else."
      />

      <StatGrid columns={4}>
        <Card bodyClassName="p-4">
          <Stat label="Funded accounts" value={String(funded)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Live evaluations" value={String(evaluations)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Firms" value={String(firms.length)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Spent on accounts" value={money(totalCost, ccy, 0)} />
        </Card>
      </StatGrid>

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

      {/* --- Accounts ------------------------------------------------------- */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Accounts</h2>
          <Disclosure label="Add account">
            <AccountForm firms={firms} ccy={ccy} />
          </Disclosure>
        </div>

        {accounts.length === 0 ? (
          <Card>
            <EmptyState
              title="No accounts yet"
              body="Add each prop account you trade, with its size, drawdown allowance and drawdown type. Those three numbers drive every risk warning in the app."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {accounts.map((account) => {
              const card = cardsById.get(account.id)
              const room = card?.drawdown.roomPercent ?? 1
              const tone = room < 0.25 ? 'critical' : room < 0.5 ? 'warn' : 'good'
              const firm = firms.find((f) => f.id === account.firmId)

              return (
                <Card
                  key={account.id}
                  title={account.label}
                  description={`${firm?.name ?? 'No firm'} · ${titleCase(account.phase)} · ${account.platform}`}
                  actions={
                    <Badge tone={account.status === 'active' ? 'good' : account.status === 'failed' ? 'critical' : 'neutral'}>
                      {titleCase(account.status)}
                    </Badge>
                  }
                >
                  <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    <div>
                      <KeyValue label="Size" value={money(account.startingBalance, ccy, 0)} />
                      <KeyValue
                        label="Current equity"
                        value={card ? money(card.equity, ccy, 0) : money(account.currentBalance ?? account.startingBalance, ccy, 0)}
                      />
                      <KeyValue
                        label="Profit target"
                        value={account.profitTarget ? money(account.profitTarget, ccy, 0) : '—'}
                      />
                      <KeyValue
                        label="Max drawdown"
                        value={account.maxDrawdown ? money(account.maxDrawdown, ccy, 0) : '—'}
                        hint={titleCase(account.drawdownType)}
                      />
                    </div>
                    <div>
                      <KeyValue
                        label="Drawdown line"
                        value={
                          card && Number.isFinite(card.drawdown.line) ? money(card.drawdown.line, ccy, 0) : '—'
                        }
                        hint={card?.drawdown.locked ? 'locked — no longer trailing' : 'trails your high-water mark'}
                      />
                      <KeyValue
                        label="Room left"
                        value={card && Number.isFinite(card.drawdown.room) ? money(card.drawdown.room, ccy, 0) : '—'}
                      />
                      <KeyValue label="Cost to date" value={money(account.costBase, ccy, 0)} />
                      <KeyValue
                        label="Commission"
                        value={
                          account.commissionPerContract > 0
                            ? `${money(account.commissionPerContract, ccy)} round turn`
                            : 'Not set'
                        }
                      />
                    </div>
                  </div>

                  {card && Number.isFinite(card.drawdown.room) && (
                    <div className="mt-4">
                      <Meter value={room} tone={tone} label={`${percent(room, 0)} of the drawdown allowance remains`} />
                    </div>
                  )}

                  {(account.phase === 'funded' || account.phase === 'live') &&
                    account.status === 'active' &&
                    (() => {
                      const accountTrades = dashboard.trades.filter((t) => t.accountId === account.id)
                      const eligibility = payoutEligibility(account, {
                        currentEquity: card?.equity ?? account.startingBalance,
                        tradingDays: new Set(accountTrades.map((t) => t.tradingDay)).size,
                        dailyPnls: dailySeries(accountTrades).map((d) => ({ day: d.day, netPnl: d.netPnl })),
                        profitSplit: firm?.profitSplit ?? 0.9,
                      })

                      return (
                        <div className="mt-4 rounded-lg border border-[var(--line)] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[var(--ink)]">Payout readiness</span>
                            <Badge tone={eligibility.eligible ? 'good' : 'warn'}>
                              {eligibility.eligible ? 'Eligible' : `${eligibility.blockers.length} blocker${eligibility.blockers.length === 1 ? '' : 's'}`}
                            </Badge>
                          </div>
                          {eligibility.eligible ? (
                            <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                              About {money(eligibility.withdrawable, ccy, 0)} above starting balance —
                              roughly {money(eligibility.netToTrader, ccy, 0)} to you after the{' '}
                              {percent(firm?.profitSplit ?? 0.9, 0)} split. Check the firm's payout window
                              before requesting.
                            </p>
                          ) : (
                            <ul className="mt-1.5 space-y-1">
                              {eligibility.blockers.map((blocker) => (
                                <li key={blocker} className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                                  · {blocker}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })()}

                  {account.commissionPerContract === 0 && (
                    <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] p-2.5 text-xs text-[var(--serious)]">
                      No commission rate set. Synced trades will be costed at zero, which makes this account look
                      more profitable than it is.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Disclosure label="Edit">
                      <AccountForm firms={firms} ccy={ccy} account={account} />
                    </Disclosure>
                    <ActionButton
                      action={async () => {
                        'use server'
                        return rebuildAccountTrades(account.id)
                      }}
                      pendingLabel="Rebuilding…"
                    >
                      Rebuild trades
                    </ActionButton>
                    <ActionButton
                      action={async () => {
                        'use server'
                        return deleteAccount(account.id)
                      }}
                      className="btn btn-danger"
                      confirm={`Delete "${account.label}" and every trade and fill on it? This cannot be undone.`}
                    >
                      Delete
                    </ActionButton>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* --- Firms ---------------------------------------------------------- */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Prop firms</h2>
          <Disclosure label="+ Add firm">
            <FirmEditor />
          </Disclosure>
        </div>

        {firms.length === 0 ? (
          <Card>
            <EmptyState
              title="No firms yet"
              body="Add the firms you actually trade with — nothing is created for you. The add form offers templates for common firms, and every value stays yours to edit."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {firms.map((firm) => (
              <Card key={firm.id} title={firm.name} description={firm.website ?? undefined}>
                <KeyValue label="Profit split" value={percent(firm.profitSplit, 0)} />
                <KeyValue label="Platform" value={titleCase(firm.platform)} />
                <KeyValue
                  label="Min days to payout"
                  value={firm.minDaysToPayout ? String(firm.minDaysToPayout) : '—'}
                />
                {firm.payoutPolicy && (
                  <p className="mt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">{firm.payoutPolicy}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Disclosure label="Edit firm">
                    <FirmEditor firm={firm} />
                  </Disclosure>
                  <ActionButton
                    action={async () => {
                      'use server'
                      return deleteFirm(firm.id)
                    }}
                    className="btn btn-danger"
                    confirm={`Delete ${firm.name}? Accounts stay but lose their firm link.`}
                  >
                    Delete
                  </ActionButton>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

type FirmRow = Awaited<ReturnType<typeof listFirms>>[number]
type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number]

function FirmEditor({ firm }: { firm?: FirmRow }) {
  async function submit(formData: FormData) {
    'use server'
    return saveFirm(firm?.id ?? null, formData)
  }

  return (
    <Card>
      <FirmForm
        action={submit}
        firm={
          firm
            ? {
                id: firm.id,
                name: firm.name,
                website: firm.website,
                platform: firm.platform,
                profitSplit: firm.profitSplit,
                minDaysToPayout: firm.minDaysToPayout,
                payoutPolicy: firm.payoutPolicy,
                notes: firm.notes,
              }
            : undefined
        }
      />
    </Card>
  )
}

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
          <Field label="Platform">
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
          <Field label="Max contracts">
            <input name="maxContracts" type="number" defaultValue={account?.maxContracts ?? ''} className="input" />
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

        <Field label="Notes">
          <textarea name="notes" rows={2} defaultValue={account?.notes ?? ''} className="textarea" />
        </Field>

        <SubmitButton>{account ? 'Save account' : 'Add account'}</SubmitButton>
      </ActionForm>
    </Card>
  )
}
