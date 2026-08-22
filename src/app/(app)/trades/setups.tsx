'use client'

import { useMemo, useState } from 'react'
import { ActionButton, ActionForm, Field, SubmitButton } from '@/components/form'
import { Badge, Card, EmptyState, clsx } from '@/components/ui'
import { deriveSetup } from '@/lib/analytics/setup'
import type { ActionResult } from '@/server/actions'
import type { SetupSummary } from '@/server/setups'

export type ModelOption = { id: number; name: string }

/** What the model read, as it is stored. Every field is allowed to be absent. */
type Reading = {
  symbol?: string | null
  direction?: string | null
  entryPrice?: number | null
  stopPrice?: number | null
  targetPrice?: number | null
  modelName?: string | null
  confidence?: string
  unreadable?: string[]
}

function fmt(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

/**
 * The setups logged against one day.
 *
 * The chart read is offered, never applied. A price misread by a digit rewrites
 * every R-multiple that follows it, so the model's reading sits beside the
 * trader's own fields as something to look at and accept, and the accept is a
 * separate button — which is also why the form asks for every level outright
 * rather than treating the scan as the primary input.
 */
export function Setups({
  day,
  setups,
  models,
  saveAction,
  deleteAction,
  readAction,
  acceptAction,
  aiConfigured,
}: {
  day: string
  setups: SetupSummary[]
  models: ModelOption[]
  saveAction: (id: number | null, formData: FormData) => Promise<ActionResult>
  deleteAction: (id: number) => Promise<ActionResult>
  readAction: (id: number) => Promise<ActionResult>
  acceptAction: (id: number) => Promise<ActionResult>
  aiConfigured: boolean
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <Card
      title="Trades logged today"
      description="One entry per setup: the levels you took, the model you took it on, and the chart."
      actions={
        <button
          type="button"
          onClick={() => {
            setAdding((open) => !open)
            setEditing(null)
          }}
          className="btn"
        >
          {adding ? 'Cancel' : '+ Log a trade'}
        </button>
      }
    >
      {adding && (
        <div className="mb-4">
          <SetupForm
            day={day}
            models={models}
            saveAction={saveAction}
            onDone={() => setAdding(false)}
          />
        </div>
      )}

      {setups.length === 0 ? (
        <EmptyState
          title="Nothing logged for this day"
          body="Log the entry, stop and target as you took them. The numbers are what make a review worth reading a month later."
        />
      ) : (
        <ul className="space-y-3">
          {setups.map((setup) =>
            editing === setup.id ? (
              <li key={setup.id}>
                <SetupForm
                  day={day}
                  setup={setup}
                  models={models}
                  saveAction={saveAction}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={setup.id}>
                <SetupRow
                  setup={setup}
                  models={models}
                  onEdit={() => {
                    setEditing(setup.id)
                    setAdding(false)
                  }}
                  deleteAction={deleteAction}
                  readAction={readAction}
                  acceptAction={acceptAction}
                  aiConfigured={aiConfigured}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </Card>
  )
}

function SetupRow({
  setup,
  models,
  onEdit,
  deleteAction,
  readAction,
  acceptAction,
  aiConfigured,
}: {
  setup: SetupSummary
  models: ModelOption[]
  onEdit: () => void
  deleteAction: (id: number) => Promise<ActionResult>
  readAction: (id: number) => Promise<ActionResult>
  acceptAction: (id: number) => Promise<ActionResult>
  aiConfigured: boolean
}) {
  const [showChart, setShowChart] = useState(false)
  const reading = setup.aiExtract as Reading | null
  const model = models.find((entry) => entry.id === setup.modelId)

  return (
    <article className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {setup.symbol && <Badge tone="accent">{setup.symbol}</Badge>}
          {setup.direction && (
            <Badge tone={setup.direction === 'long' ? 'good' : 'critical'}>
              {setup.direction === 'long' ? 'Long' : 'Short'}
            </Badge>
          )}
          {model && <Badge>{model.name}</Badge>}
          {setup.riskReward != null && <Badge>{fmt(setup.riskReward, 2)}R</Badge>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {setup.screenshotBytes != null && (
            <button type="button" onClick={() => setShowChart(!showChart)} className="btn px-2 py-1 text-xs">
              {showChart ? 'Hide chart' : 'Chart'}
            </button>
          )}
          <button type="button" onClick={onEdit} className="btn px-2 py-1 text-xs">
            Edit
          </button>
          <ActionButton
            action={async () => deleteAction(setup.id)}
            className="btn btn-danger px-2 py-1 text-xs"
            confirm="Delete this setup?"
          >
            ✕
          </ActionButton>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <Cell label="Entry" value={fmt(setup.entryPrice)} />
        <Cell
          label="Stop"
          value={`${fmt(setup.stopPrice)}${setup.stopPoints != null ? ` · ${fmt(setup.stopPoints)} pts` : ''}`}
        />
        <Cell
          label="Target"
          value={`${fmt(setup.targetPrice)}${setup.targetPoints != null ? ` · ${fmt(setup.targetPoints)} pts` : ''}`}
        />
        <Cell label="Risk / reward" value={setup.riskReward == null ? '—' : `${fmt(setup.riskReward, 2)}R`} />
      </dl>

      {setup.notes && (
        <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-[var(--ink-secondary)]">
          {setup.notes}
        </p>
      )}

      {showChart && setup.screenshotBytes != null && (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/setups/${setup.id}/chart`}
            alt="Chart screenshot for this setup"
            className="max-h-[70vh] w-full rounded-lg border border-[var(--line)] object-contain"
          />
        </div>
      )}

      {setup.screenshotBytes != null && (
        <div className="mt-3 rounded-lg bg-[var(--surface-sunken)] p-2.5">
          {reading ? (
            <>
              <p className="text-[0.6875rem] font-medium text-[var(--ink-secondary)]">
                Read off the chart{reading.confidence ? ` · ${reading.confidence} confidence` : ''}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                Entry {fmt(reading.entryPrice)} · Stop {fmt(reading.stopPrice)} · Target{' '}
                {fmt(reading.targetPrice)}
                {reading.modelName ? ` · ${reading.modelName}` : ''}
              </p>
              {reading.unreadable && reading.unreadable.length > 0 && (
                <p className="mt-1 text-[0.6875rem] text-[var(--ink-muted)]">
                  Could not read: {reading.unreadable.join('; ')}
                </p>
              )}
              <p className="mt-1 text-[0.6875rem] text-[var(--ink-muted)]">
                A suggestion, not a record — check each level against your platform before accepting.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ActionButton action={async () => acceptAction(setup.id)} className="btn px-2 py-1 text-xs">
                  Use these values
                </ActionButton>
                <ActionButton
                  action={async () => readAction(setup.id)}
                  className="btn px-2 py-1 text-xs"
                  pendingLabel="Reading…"
                >
                  Read again
                </ActionButton>
              </div>
            </>
          ) : aiConfigured ? (
            <ActionButton
              action={async () => readAction(setup.id)}
              className="btn px-2 py-1 text-xs"
              pendingLabel="Reading the chart…"
            >
              Read levels off the chart
            </ActionButton>
          ) : (
            <p className="text-[0.6875rem] text-[var(--ink-muted)]">
              Set ANTHROPIC_API_KEY to have the chart read automatically.
            </p>
          )}
        </div>
      )}
    </article>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] text-[var(--ink-muted)]">{label}</dt>
      <dd className="tabular font-medium text-[var(--ink)]">{value}</dd>
    </div>
  )
}

/**
 * The form.
 *
 * Every level is asked for as both a price and a distance, because the trader
 * has whichever one their platform put in front of them. Filling either fills
 * the other live, so nothing is typed twice — and the preview shows the same
 * warnings the server will apply, before the save rather than after it.
 */
function SetupForm({
  day,
  setup,
  models,
  saveAction,
  onDone,
}: {
  day: string
  setup?: SetupSummary
  models: ModelOption[]
  saveAction: (id: number | null, formData: FormData) => Promise<ActionResult>
  onDone: () => void
}) {
  const [direction, setDirection] = useState<string>(setup?.direction ?? '')
  const [entry, setEntry] = useState(setup?.entryPrice?.toString() ?? '')
  const [stopPrice, setStopPrice] = useState(setup?.stopPrice?.toString() ?? '')
  const [stopPoints, setStopPoints] = useState(setup?.stopPoints?.toString() ?? '')
  const [targetPrice, setTargetPrice] = useState(setup?.targetPrice?.toString() ?? '')
  const [targetPoints, setTargetPoints] = useState(setup?.targetPoints?.toString() ?? '')

  const n = (value: string): number | null => {
    if (value.trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const preview = useMemo(
    () =>
      deriveSetup({
        direction: direction === 'long' || direction === 'short' ? direction : null,
        entryPrice: n(entry),
        stopPrice: n(stopPrice),
        stopPoints: n(stopPoints),
        targetPrice: n(targetPrice),
        targetPoints: n(targetPoints),
      }),
    [direction, entry, stopPrice, stopPoints, targetPrice, targetPoints],
  )

  return (
    <ActionForm
      action={async (formData) => {
        const result = await saveAction(setup?.id ?? null, formData)
        if (result.ok) onDone()
        return result
      }}
      className="space-y-3 rounded-lg border border-[var(--accent)] p-3"
    >
      <input type="hidden" name="entryDate" value={day} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Symbol">
          <input name="symbol" className="input" placeholder="MNQ" defaultValue={setup?.symbol ?? ''} />
        </Field>
        <Field label="Direction">
          <select
            name="direction"
            className="select"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="">From the levels</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </Field>
        <Field label="Entry price" hint="Exactly as filled">
          <input
            name="entryPrice"
            type="number"
            step="any"
            className="input"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
          />
        </Field>
        <Field label="Model" hint="From your models list">
          <select name="modelId" className="select" defaultValue={setup?.modelId ?? ''}>
            <option value="">No model</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Stop price">
          <input
            name="stopPrice"
            type="number"
            step="any"
            className="input"
            value={stopPrice}
            onChange={(event) => setStopPrice(event.target.value)}
            placeholder={preview.stopPrice != null ? String(preview.stopPrice) : ''}
          />
        </Field>
        <Field label="Stop points" hint="Either one fills the other">
          <input
            name="stopPoints"
            type="number"
            step="any"
            className="input"
            value={stopPoints}
            onChange={(event) => setStopPoints(event.target.value)}
            placeholder={preview.stopPoints != null ? String(preview.stopPoints) : ''}
          />
        </Field>
        <Field label="Target price">
          <input
            name="targetPrice"
            type="number"
            step="any"
            className="input"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            placeholder={preview.targetPrice != null ? String(preview.targetPrice) : ''}
          />
        </Field>
        <Field label="Target points">
          <input
            name="targetPoints"
            type="number"
            step="any"
            className="input"
            value={targetPoints}
            onChange={(event) => setTargetPoints(event.target.value)}
            placeholder={preview.targetPoints != null ? String(preview.targetPoints) : ''}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Risk / reward"
          hint={
            preview.riskReward != null
              ? `Blank uses the ${fmt(preview.riskReward, 2)} your levels give`
              : 'Blank computes it from the points'
          }
        >
          <input
            name="riskReward"
            type="number"
            step="any"
            className="input"
            defaultValue={setup?.riskReward ?? ''}
            placeholder={preview.riskReward != null ? String(preview.riskReward) : ''}
          />
        </Field>
        <Field label="Chart screenshot" hint="PNG, JPEG or WebP, up to 3 MB">
          <input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
        </Field>
      </div>

      <Field label="Notes" hint="Anything worth remembering about this one.">
        <textarea name="notes" rows={3} className="textarea" defaultValue={setup?.notes ?? ''} />
      </Field>

      {preview.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] p-2.5 text-[0.6875rem] text-[var(--serious)]">
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className={clsx('flex flex-wrap items-center gap-2')}>
        <SubmitButton>{setup ? 'Save setup' : 'Log it'}</SubmitButton>
        <button type="button" onClick={onDone} className="btn">
          Cancel
        </button>
      </div>
    </ActionForm>
  )
}
