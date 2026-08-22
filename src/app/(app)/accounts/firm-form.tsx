'use client'

import { useState } from 'react'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { FIRM_CATALOGUES } from '@/lib/propfirm/catalogue'
import type { ActionResult } from '@/server/actions'

export type FirmFormData = {
  id: number
  name: string
  website: string | null
  notes: string | null
}

/**
 * Add / edit a prop firm.
 *
 * A firm is a name and a website, and nothing else. Everything that used to
 * sit here — profit split, payout policy, days to payout — varies *within* a
 * firm rather than across it: MyFundedFutures pays 80% on some accounts and
 * 90% on others, and Apex sells one size with either intraday or end-of-day
 * drawdown. Asking for one value per firm meant filling in a number that was
 * wrong for half the accounts under it. Those fields now live on the plan and
 * on the account.
 *
 * Picking a firm from the catalogue fills the name and website and brings its
 * plans along. Nothing is pre-created: the catalogue is a starting point the
 * user chooses, and every value stays editable afterwards.
 */
export function FirmForm({
  action,
  firm,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  firm?: FirmFormData
}) {
  const [template, setTemplate] = useState<string>('')
  const preset = FIRM_CATALOGUES.find((entry) => entry.name === template)

  const defaults = {
    name: preset?.name ?? firm?.name ?? '',
    website: preset?.website ?? firm?.website ?? '',
    notes: firm?.notes ?? '',
  }

  return (
    <ActionForm action={action} className="space-y-3">
      {!firm && (
        <Field
          label="Start from a firm we have specs for (optional)"
          hint="Fills the name and website and brings that firm's plans in. Terms change often, so treat every value as a starting point."
        >
          <select value={template} onChange={(event) => setTemplate(event.target.value)} className="select">
            <option value="">Blank</option>
            {FIRM_CATALOGUES.map((entry) => (
              <option key={entry.slug} value={entry.name}>
                {entry.name} — {entry.plans.length} plans
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* The catalogue rides along as JSON; the server seeds the firm's plans
          from it so the accounts grid's plan picker works immediately. */}
      {!firm && preset && preset.plans.length > 0 && (
        <>
          <input type="hidden" name="plansJson" value={JSON.stringify(preset.plans)} />
          <p className="text-xs text-[var(--ink-secondary)]">
            Brings {preset.plans.length} plans — sizes, drawdown type, targets, consistency, contract
            limits, profit split and list prices. All editable in the plan catalogue after saving, and an
            account can always diverge from the plan it came from.
          </p>
        </>
      )}

      {/* Remounting on template change is what lets defaultValue re-apply. */}
      <div key={template || 'blank'} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input name="name" defaultValue={defaults.name} className="input" required />
          </Field>
          <Field label="Website">
            <input name="website" defaultValue={defaults.website} className="input" placeholder="https://…" />
          </Field>
        </div>

        <Field label="Notes" hint="Anything about the firm as a whole. Account rules live on the account.">
          <textarea name="notes" rows={2} defaultValue={defaults.notes} className="textarea" />
        </Field>
      </div>

      <SubmitButton>{firm ? 'Save changes' : 'Add firm'}</SubmitButton>
    </ActionForm>
  )
}
