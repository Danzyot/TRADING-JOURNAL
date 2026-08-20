'use client'

import { useState } from 'react'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { FIRM_PRESETS } from '@/lib/propfirm/rules'
import type { ActionResult } from '@/server/actions'

export type FirmFormData = {
  id: number
  name: string
  website: string | null
  platform: string
  profitSplit: number
  minDaysToPayout: number | null
  payoutPolicy: string | null
  notes: string | null
}

/**
 * Add / edit a prop firm.
 *
 * Templates are offered here, in the form, as something the user chooses to
 * apply — nothing is ever pre-created. Picking one fills the fields and every
 * field stays editable, because the presets are a starting point for typing
 * less, not a claim about what the firm's current terms are.
 */
export function FirmForm({
  action,
  firm,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  firm?: FirmFormData
}) {
  const [template, setTemplate] = useState<string>('')
  const preset = FIRM_PRESETS.find((entry) => entry.name === template)

  const defaults = {
    name: preset?.name ?? firm?.name ?? '',
    website: firm?.website ?? '',
    platform: preset?.platform ?? firm?.platform ?? 'tradovate',
    profitSplit: preset?.profitSplit ?? firm?.profitSplit ?? 0.9,
    minDaysToPayout: firm?.minDaysToPayout ?? '',
    payoutPolicy: preset?.note ?? firm?.payoutPolicy ?? '',
    notes: firm?.notes ?? '',
  }

  return (
    <ActionForm action={action} className="space-y-3">
      {!firm && (
        <Field
          label="Start from a template (optional)"
          hint="Fills the fields below — edit anything. Firm terms change often, so treat the values as a starting point."
        >
          <select value={template} onChange={(event) => setTemplate(event.target.value)} className="select">
            <option value="">Blank</option>
            {FIRM_PRESETS.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
        </Field>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Platform">
            <select name="platform" defaultValue={defaults.platform} className="select">
              <option value="tradovate">Tradovate</option>
              <option value="rithmic">Rithmic</option>
              <option value="projectx">ProjectX / TopstepX</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Profit split" hint="Your share as a fraction, e.g. 0.9 for 90%">
            <input
              name="profitSplit"
              type="number"
              step="0.01"
              min="0"
              max="1"
              defaultValue={defaults.profitSplit}
              className="input"
            />
          </Field>
          <Field label="Min days to payout">
            <input name="minDaysToPayout" type="number" defaultValue={defaults.minDaysToPayout} className="input" />
          </Field>
        </div>

        <Field label="Payout policy" hint="The rules in your own words — consistency %, caps, schedule.">
          <textarea name="payoutPolicy" rows={3} defaultValue={defaults.payoutPolicy} className="textarea" />
        </Field>

        <Field label="Notes">
          <textarea name="notes" rows={2} defaultValue={defaults.notes} className="textarea" />
        </Field>
      </div>

      <SubmitButton>{firm ? 'Save changes' : 'Add firm'}</SubmitButton>
    </ActionForm>
  )
}
