import Link from 'next/link'
import { PlanCatalogue } from './plan-catalogue'
import { Card, KeyValue, PageHeader, Stat, StatGrid } from '@/components/ui'
import { Editable } from '@/components/site-text'
import { FIRM_CATALOGUES } from '@/lib/propfirm/catalogue'
import { addAccountFromPlan } from '@/server/actions'
import { listAccounts } from '@/server/trades'
import { listFirms } from '@/server/money'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Prop firms — Trading Journal' }

export default async function FirmsPage() {
  const [accounts, firms] = await Promise.all([listAccounts(), listFirms()])

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

      <div className="mt-6">
        <Card
          title="How to read this"
          description="These are the firms' own published numbers, not advice."
        >
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <KeyValue
              label="Max loss"
              value="The drawdown allowance. How it moves is the Drawdown column."
            />
            <KeyValue
              label="Buffer"
              value="Profit that must stay in the account. You withdraw down to this line, not to the account size."
            />
            <KeyValue
              label="Contracts"
              value="Minis, then micros — the two ceilings firms quote separately."
            />
            <KeyValue
              label="Consistency"
              value="The largest share of total profit any single day may be."
            />
          </div>
          <Editable as="p" scope="body" className="mt-3 block text-xs leading-relaxed text-[var(--ink-muted)]">
            Firm terms change constantly. Every value here is a starting point: adding a plan copies
            it onto the account, and the account is yours to correct afterwards. A plus beside a plan
            name opens the rules that resist being numbers.
          </Editable>
        </Card>
      </div>

      <div className="mt-6">
        <PlanCatalogue catalogues={FIRM_CATALOGUES} addAction={add} />
      </div>
    </>
  )
}
