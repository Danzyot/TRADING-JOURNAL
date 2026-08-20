import Link from 'next/link'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { ALL_SPECS } from '@/lib/symbols'
import { SymbolField } from './symbol-field'
import { saveManualTrade } from '@/server/actions'
import { listAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Log a trade — Trading Journal' }

export default async function NewTradePage() {
  const accounts = await listAccounts()

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Log a trade" />
        <Card>
          <EmptyState
            title="No accounts yet"
            body="A trade has to belong to an account, so add one first."
            action={{ href: '/accounts', label: 'Add an account' }}
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Log a trade"
        subtitle="For trades that did not come from a sync or an import. These are kept as your own record and survive a rebuild."
        actions={
          <Link href="/trades" className="btn">
            ← All trades
          </Link>
        }
      />

      <Card className="max-w-3xl">
        <ActionForm action={saveManualTrade} className="space-y-4" resetOnSuccess>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Account">
              <select name="accountId" className="select" required>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Symbol" hint="Root symbol — MNQ, ES, CL">
              <SymbolField specs={ALL_SPECS.map((spec) => ({ root: spec.root, name: spec.name }))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Direction">
              <select name="direction" className="select" required>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </Field>
            <Field label="Quantity">
              <input name="qty" type="number" min="1" defaultValue="1" className="input" required />
            </Field>
            <Field label="Entry price">
              <input name="avgEntry" type="number" step="any" className="input" required />
            </Field>
            <Field label="Exit price" hint="Leave blank if still open">
              <input name="avgExit" type="number" step="any" className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Entry time">
              <input name="entryAt" type="datetime-local" className="input" required />
            </Field>
            <Field label="Exit time">
              <input name="exitAt" type="datetime-local" className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Net P&L" hint="After costs. Negative for a loss.">
              <input name="netPnl" type="number" step="any" className="input" required />
            </Field>
            <Field label="Commission">
              <input name="commission" type="number" step="any" defaultValue="0" className="input" />
            </Field>
            <Field label="Fees">
              <input name="fees" type="number" step="any" defaultValue="0" className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Stop price" hint="Records what you risked, which is what makes R possible">
              <input name="stopPrice" type="number" step="any" className="input" />
            </Field>
            <Field label="Target price">
              <input name="targetPrice" type="number" step="any" className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Setup">
              <input name="setup" className="input" placeholder="ORB, VWAP reclaim…" />
            </Field>
            <Field label="Tags" hint="Comma separated">
              <input name="tags" className="input" />
            </Field>
            <Field label="Mistakes" hint="Comma separated">
              <input name="mistakes" className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Execution score" hint="1–5">
              <input name="execScore" type="number" min="1" max="5" className="input" />
            </Field>
            <Field label="Emotion">
              <input name="emotion" className="input" />
            </Field>
            <Field label="Screenshot URL">
              <input name="screenshotUrl" className="input" />
            </Field>
          </div>

          <Field label="Notes">
            <textarea name="notes" rows={4} className="textarea" />
          </Field>

          <SubmitButton>Save trade</SubmitButton>
        </ActionForm>
      </Card>
    </>
  )
}
