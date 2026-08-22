import type { ReactNode } from 'react'
import Link from 'next/link'
import { PlanCatalogue } from './plan-catalogue'
import { FirmForm } from './firm-form'
import { FirmPlans } from './firm-plans'
import { ActionButton, Disclosure } from '@/components/form'
import { Card, CollapsibleCard, PageHeader, Stat, StatGrid } from '@/components/ui'
import { FIRM_CATALOGUES, type FirmCatalogue } from '@/lib/propfirm/catalogue'
import type { FirmPlan } from '@/db/schema'
import { firmArt } from '@/lib/propfirm/firm-art'
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

  // One list, not two. A firm you trade and a firm you are only reading about
  // are the same firm — the difference is a badge and, once you open it, the
  // prices you actually paid. Firms added by hand join the same list rather
  // than living in a second one above it.
  const catalogueNames = new Set(FIRM_CATALOGUES.map((firm) => firm.name.toLowerCase()))
  const handAdded: FirmCatalogue[] = firms
    .filter((firm) => !catalogueNames.has(firm.name.toLowerCase()))
    .map((firm) => ({
      slug: `db-${firm.id}`,
      name: firm.name,
      website: firm.website ?? '',
      plans: firm.plans ?? [],
    }))
  const catalogues = [...FIRM_CATALOGUES, ...handAdded]

  const plans = catalogues.reduce((sum, firm) => sum + firm.plans.length, 0)
  const sizes = new Set(catalogues.flatMap((firm) => firm.plans.map((plan) => plan.size)))

  // Matched on the firm's name rather than on the plan label: an account added
  // before the catalogue existed, or edited since, still belongs to its firm.
  const rowByName = new Map(firms.map((firm) => [firm.name.toLowerCase(), firm]))
  const yours: Record<string, number> = {}
  const panels: Record<string, ReactNode> = {}
  for (const firm of catalogues) {
    const row = rowByName.get(firm.name.toLowerCase())
    if (!row) continue
    yours[firm.slug] = accounts.filter((account) => account.firmId === row.id).length
    // A firm row can exist with no plans of its own — added by hand, or created
    // before the catalogue did. The editor then opens on the published plans, so
    // typing what you actually paid is one field rather than twenty.
    panels[firm.slug] = (
      <YourFirmPanel firm={row} fallback={(row.plans ?? []).length === 0 ? firm.plans : null} />
    )
  }

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
          <Stat
            label="Firms"
            value={String(catalogues.length)}
            hint={`${Object.keys(yours).length} you trade`}
          />
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

      {/* --- Firm economics ------------------------------------------------- */}
      {/* A table of zeros teaches nothing; it appears once there is money in it. */}
      {economics.some((row) => row.accountsTotal > 0 || row.spend > 0 || row.payouts > 0) && (
        <div className="mt-6">
          <CollapsibleCard
            title="Firm economics"
            description="What each firm has cost against what it has paid. This is what decides whether adding accounts is investment or gambling."
            summary={money(
              economics.reduce((sum, row) => sum + row.net, 0),
              ccy,
              0,
            )}
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
          </CollapsibleCard>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Firms and plans</h2>
            <p className="text-xs text-[var(--ink-secondary)]">
              Every plan every firm sells. Firms you already trade are marked; open one to edit what
              you actually paid. Adding a plan creates the account with its rules already filled in.
            </p>
          </div>
          <Disclosure label="Add firm">
            <FirmEditor />
          </Disclosure>
        </div>

        <PlanCatalogue catalogues={catalogues} yours={yours} panels={panels} addAction={add} />
      </div>
    </>
  )
}

type FirmRow = Awaited<ReturnType<typeof listFirms>>[number]

/**
 * The editable half of a firm — shown inside that firm's own page in the list,
 * so there is never a second list of firms just to reach it.
 */
function YourFirmPanel({ firm, fallback }: { firm: FirmRow; fallback: FirmPlan[] | null }) {
  const plans = fallback ?? firm.plans ?? []
  const { wordmark } = firmArt(firm.name)
  return (
    <CollapsibleCard
      // The firm's own wordmark, behind its own heading. It was a separate
      // banner above this card, which meant the logo and the words it belongs
      // to were two boxes apart.
      backdrop={wordmark}
      title={`Your ${firm.name} record`}
      description={
        fallback
          ? 'The published plans, ready for the prices you actually paid. Saving keeps your copy.'
          : 'Prices you actually paid, and the firm entry itself.'
      }
      summary={`${plans.length} plans`}
    >
      <FirmPlansEditor firmId={firm.id} plans={plans} />

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
    </CollapsibleCard>
  )
}

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
