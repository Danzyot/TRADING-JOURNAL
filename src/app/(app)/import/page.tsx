import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { importBatches } from '@/db/schema'
import { ImportForm } from './import-form'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { shortDate } from '@/lib/format'
import { listAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Import — Trading Journal' }

export default async function ImportPage() {
  const [accounts, batches] = await Promise.all([
    listAccounts(),
    db.select().from(importBatches).orderBy(desc(importBatches.createdAt)).limit(20),
  ])

  const accountName = (id: number | null): string =>
    id === null ? '—' : (accounts.find((a) => a.id === id)?.label ?? `#${id}`)

  return (
    <>
      <PageHeader
        title="Import"
        subtitle="Bring in trades from any platform's CSV export. Safe to re-run — anything already stored is skipped. Tired of doing this by hand? The trade watcher in Settings uploads exports from a folder on your computer automatically."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {accounts.length === 0 ? (
            <Card>
              <EmptyState
                title="Add an account first"
                body="Imported trades have to belong to an account, and the account's commission rate is what costs the fills correctly."
                action={{ href: '/accounts', label: 'Add an account' }}
              />
            </Card>
          ) : (
            <Card title="Upload an export">
              <ImportForm accounts={accounts.map((a) => ({ id: a.id, label: a.label }))} />
            </Card>
          )}
        </div>

        <Card title="Where to find your export">
          <div className="space-y-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">Tradovate</h3>
              <p className="mt-1">
                Web platform → Reports → Performance or Orders → export as CSV. The Performance report is
                already paired into round trips; the Orders report is raw fills and gets matched here.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">Rithmic (R|Trader Pro)</h3>
              <p className="mt-1">
                Orders or Fills window → right-click the grid → Export. Rithmic has no retail API — it is
                licensed through your broker under a professional agreement — so CSV is the route here.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">Tradecopia</h3>
              <p className="mt-1">
                Tradecopia connects outward to your brokers rather than offering an API to you, so import from
                whichever broker it copied into — usually Tradovate or Rithmic. Copied accounts produce
                near-identical fills, so import each one against its own account here to keep the statistics
                honest rather than multiplied.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">TradingView</h3>
              <p className="mt-1">
                Paper Trading or the Strategy Tester → List of Trades → export. Note that a TradingView order
                routed to Tradovate also appears in the Tradovate export, so import from one source per
                account, not both.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">NinjaTrader</h3>
              <p className="mt-1">Control Center → Trade Performance → right-click the grid → Export.</p>
            </div>
            <p className="rounded-lg bg-[var(--surface-sunken)] p-3">
              Column names are resolved by alias, so an export whose headers have drifted still imports. If a
              format is not recognised at all, the report will list the headers it could not place.
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Import history" bodyClassName="p-0">
          {batches.length === 0 ? (
            <EmptyState title="Nothing imported yet" body="Your import history will appear here." />
          ) : (
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>File</th>
                    <th>Format</th>
                    <th>Account</th>
                    <th className="text-right">Rows</th>
                    <th className="text-right">Imported</th>
                    <th className="text-right">Skipped</th>
                    <th className="text-right">Trades built</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="tabular whitespace-nowrap">
                        {shortDate(batch.createdAt.toISOString().slice(0, 10))}
                      </td>
                      <td className="max-w-[200px] truncate">{batch.filename ?? 'Pasted'}</td>
                      <td className="text-xs">{batch.source}</td>
                      <td className="max-w-[140px] truncate text-xs">{accountName(batch.accountId)}</td>
                      <td className="tabular text-right">{batch.rowsSeen}</td>
                      <td className="tabular text-right">{batch.rowsImported}</td>
                      <td className="tabular text-right">{batch.rowsSkipped}</td>
                      <td className="tabular text-right">{batch.tradesBuilt}</td>
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
