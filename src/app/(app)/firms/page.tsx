import Link from 'next/link'
import { PlanCatalogue } from './plan-catalogue'
import { FirmForm } from './firm-form'
import { FirmPlans } from './firm-plans'
import { ActionButton, Disclosure } from '@/components/form'
import { Card, EmptyState, PageHeader, Stat, StatGrid } from '@/components/ui'
import { FIRM_CATALOGUES } from '@/lib/propfirm/catalogue'
import { addAccountFromPlan, deleteFirm, saveFirm, saveFirmPlans } from '@/server/actions'
import { listAccounts } from '@/server/trades'
import { firmEconomics, listFirms } from '@/server/money'
import { getSettings } from '@/server/settings'
import { money, percent } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Prop firms — Trading Journal' }

export default async function FirmsPage() {
  const [accounts, firms, economics] = await Promise.all([
    listAccounts(),
    listFirms(),
    firmEconomics(),
  ])
  const ccy = (await getSettings()).baseCurrency

  const plans = FIRM_CATALOGUES.reduce((sum, firm) => sum + firm.plans.length, 0)
  const sizes = new Set(FIRM_CATALOGUES.flatMap((firm) => firm.plans.map((plan) => plan.size)))
  // Which firms are more than reference material — the ones actually traded.
  // Matched on the firm's name rather than on the plan label: an account added
  // before the catalogue existed, or edited since, still belongs to its firm.
  const firmNames = new Map(firms.map((firm) => [firm.id, firm.name.toLowerCase()]))
  const inUse = new Set(
    accounts
      .map((account) => (account.firmId === null ? null : firmNames.get(account.firmId)))
      .filter((name): name is string => Boolean(name))
      .flatMap((name) =>
        FIRM_CATALOGUES.filter((firm) => firm.name.toLowerCase() === name).map((firm) => firm.slug),
      ),
  )

  async function add(formData: FormData) {
    'use server'
    return addAccountFromPlan(formData)
  }

  return (
    <>
      <PageHeader
        title="Prop firms"
        subtitle="Every plan these firms sell, with the rules they sell it under. Add one as an account and its numbers come with it."
        actions={
          <Link href="/accounts" className="btn">
            Your accounts
          </Link>
        }
      />

      <StatGrid columns={4}>
        <Card bodyClassName="p-4">
          <Stat label="Firms" value={String(FIRM_CATALOGUES.length)} hint={`${inUse.size} you trade`} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Plans" value={String(plans)} hint="Across every size and variant" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Account sizes" value={String(sizes.size)} hint="Distinct sizes on offer" />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Your accounts"
            value={String(accounts.length)}
            hint={`${accounts.filter((account) => account.status === 'active').length} active`}
          />
        </Card>
      </StatGrid>

      {/* --- The firms you actually trade ---------------------------------- */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Your firms</h2>
            <p className="text-xs text-[var(--ink-secondary)]">
              The firms you hold accounts with, and the plan presets the accounts grid offers. This is
              where a price goes once you know what you actually paid.
            </p>
          </div>
          <Disclosure label="Add firm">
            <FirmEditor />
          </Disclosure>
        </div>

        {firms.length === 0 ? (
          <Card>
            <EmptyState
              title="No firms yet"
              body="Adding an account from the catalogue below creates its firm for you. Add one by hand only if you trade somewhere the catalogue does not cover."
            />
          </Card>
        ) : (
          // One per row: the plan editor is a wide table of rules and a cost,
          // and squeezed into half a page its fields truncate to nothing.
          <div className="space-y-4">
            {firms.map((firm) => (
              <Card key={firm.id} title={firm.name} description={firm.website ?? undefined}>
                <FirmPlansEditor firmId={firm.id} plans={firm.plans ?? []} />

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

      <div className="mt-8 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">The catalogue</h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Every plan every firm sells. Adding one creates the account with its rules already filled in.
          </p>
        </div>
        <PlanCatalogue catalogues={FIRM_CATALOGUES} addAction={add} />
      </div>
    </>
  )
}

type FirmRow = Awaited<ReturnType<typeof listFirms>>[number]

function FirmEditor({ firm }: { firm?: FirmRow }) {
  async function submit(formData: FormData) {
    'use server'
    return saveFirm(firm?.id ?? null, formData)
  }

  return (
    <Card>
      <FirmForm
        action={submit}
        firm={firm ? { id: firm.id, name: firm.name, website: firm.website, notes: firm.notes } : undefined}
      />
    </Card>
  )
}

function FirmPlansEditor({ firmId, plans }: { firmId: number; plans: FirmRow['plans'] }) {
  async function save(plans: unknown) {
    'use server'
    return saveFirmPlans(firmId, plans)
  }

  return <FirmPlans plans={plans ?? []} saveAction={save} />
}
