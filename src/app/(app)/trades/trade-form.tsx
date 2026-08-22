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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        <Field label="Exit price" hint="Leave blank if still open">
          <input name="avgExit" type="number" step="any" className="input" defaultValue={trade?.avgExit ?? ''} />
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Net P&L" hint="After costs. Negative for a loss.">
          <input name="netPnl" type="number" step="any" className="input" required defaultValue={trade?.netPnl} />
        </Field>
        <Field label="Commission">
          <input name="commission" type="number" step="any" defaultValue={trade?.commission ?? 0} className="input" />
        </Field>
        <Field label="Fees">
          <input name="fees" type="number" step="any" defaultValue={trade?.fees ?? 0} className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Stop price" hint="Records what you risked, which is what makes R possible">
          <input name="stopPrice" type="number" step="any" className="input" defaultValue={trade?.stopPrice ?? ''} />
        </Field>
        <Field label="Target price">
          <input name="targetPrice" type="number" step="any" className="input" defaultValue={trade?.targetPrice ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <Field label="Tags" hint="Comma separated">
          <input name="tags" className="input" defaultValue={trade?.tags?.join(', ') ?? ''} />
        </Field>
        <Field label="Mistakes" hint="Comma separated">
          <input name="mistakes" className="input" defaultValue={trade?.mistakes?.join(', ') ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Execution score" hint="1–5">
          <input name="execScore" type="number" min="1" max="5" className="input" defaultValue={trade?.execScore ?? ''} />
        </Field>
        <Field label="Emotion">
          <input name="emotion" className="input" defaultValue={trade?.emotion ?? ''} />
        </Field>
        <Field label="Screenshot URL">
          <input name="screenshotUrl" className="input" defaultValue={trade?.screenshotUrl ?? ''} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea name="notes" rows={4} className="textarea" defaultValue={trade?.notes ?? ''} />
      </Field>

      <SubmitButton>{trade ? 'Save changes' : 'Save trade'}</SubmitButton>
    </ActionForm>
  )
}
