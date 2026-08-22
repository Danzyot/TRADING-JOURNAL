import { ActionForm, Field, SubmitButton } from '@/components/form'
import { ALL_SPECS } from '@/lib/symbols'
import { SymbolField } from './symbol-field'
import { saveManualTrade } from '@/server/actions'
import type { listAccounts } from '@/server/trades'
import type { Trade, TradingModel } from '@/db/schema'

type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number]

/**
 * The form for a hand-written trade — used both to log one and to correct one.
 *
 * A journal whose numbers cannot be fixed is a journal you stop trusting: a
 * fat-fingered exit price, or a P&L typed before the fees were known, has to be
 * correctable in place rather than by deleting the trade and typing it again.
 *
 * Only trades entered by hand are editable here. Synced and imported trades are
 * derived from the executions table and rebuilt from it, so an edit would be
 * silently discarded on the next rebuild; those carry their notes, tags and
 * model through annotation instead.
 */
export function TradeForm({
  accounts,
  models,
  trade,
}: {
  accounts: AccountRow[]
  models: TradingModel[]
  trade?: Trade
}) {
  async function submit(formData: FormData) {
    'use server'
    return saveManualTrade(trade?.id ?? null, formData)
  }

  /** datetime-local wants `yyyy-MM-ddTHH:mm`, and reads back the way it was written. */
  const stamp = (value: Date | null | undefined): string =>
    value ? value.toISOString().slice(0, 16) : ''

  return (
    <ActionForm action={submit} className="space-y-4" resetOnSuccess={!trade}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Account">
          <select name="accountId" className="select" required defaultValue={trade?.accountId}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Symbol" hint="Root symbol — MNQ, ES, CL">
          <SymbolField
            specs={ALL_SPECS.map((spec) => ({ root: spec.root, name: spec.name }))}
            defaultValue={trade?.symbol ?? ''}
          />
        </Field>
      </div>

      {/* The three prices sit together: entry, exit and the stop are read as one
          line when you check a trade, and the stop is what makes R possible. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Direction">
          <select name="direction" className="select" required defaultValue={trade?.direction}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </Field>
        <Field label="Quantity">
          <input name="qty" type="number" min="1" defaultValue={trade?.qty ?? 1} className="input" required />
        </Field>
        <Field label="Entry price">
          <input name="avgEntry" type="number" step="any" className="input" required defaultValue={trade?.avgEntry} />
        </Field>
        <Field label="Exit price" hint="Blank if still open">
          <input name="avgExit" type="number" step="any" className="input" defaultValue={trade?.avgExit ?? ''} />
        </Field>
        <Field label="Stop price" hint="What you risked — this is what makes R possible">
          <input name="stopPrice" type="number" step="any" className="input" defaultValue={trade?.stopPrice ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Entry time">
          <input name="entryAt" type="datetime-local" className="input" required defaultValue={stamp(trade?.entryAt)} />
        </Field>
        <Field label="Exit time">
          <input name="exitAt" type="datetime-local" className="input" defaultValue={stamp(trade?.exitAt)} />
        </Field>
      </div>

      {/* No commission box: the rate is the same every round turn, so it comes
          off the account rather than being typed sixty times a month. */}
      <Field label="Net P&L" hint="After costs. Negative for a loss.">
        <input name="netPnl" type="number" step="any" className="input" required defaultValue={trade?.netPnl} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Model" hint="Your written setup — the AI reviews the trade against it">
          <select name="modelId" className="select" defaultValue={trade?.modelId ?? ''}>
            <option value="">No model</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Setup">
          <input name="setup" className="input" placeholder="ORB, VWAP reclaim…" defaultValue={trade?.setup ?? ''} />
        </Field>
        {/* The file itself, not a link to one: an image host is somebody else's
            server, and this is a picture of a funded account's ticket. It is
            encrypted at rest like the documents are. */}
        <Field label="Chart screenshot" hint="PNG, JPEG or WebP · stored encrypted">
          <input
            name="screenshot"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="input"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea name="notes" rows={4} className="textarea" defaultValue={trade?.notes ?? ''} />
      </Field>

      <SubmitButton>{trade ? 'Save changes' : 'Save trade'}</SubmitButton>
    </ActionForm>
  )
}
