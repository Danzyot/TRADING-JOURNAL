'use client'

import { useActionState } from 'react'
import { Field, SubmitButton } from '@/components/form'
import { SOURCE_LABELS } from '@/lib/integrations/importers'
import { importCsvFile, type ImportReport } from '@/server/import'

export function ImportForm({ accounts }: { accounts: { id: number; label: string }[] }) {
  const [report, action] = useActionState(
    async (_previous: ImportReport | null, formData: FormData) => importCsvFile(formData),
    null,
  )

  return (
    <>
      <form action={action} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Account" hint="Its commission rate is what costs the imported fills.">
            <select name="accountId" className="select" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Format" hint="Auto-detect handles almost everything.">
            <select name="source" className="select" defaultValue="">
              <option value="">Detect automatically</option>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Source timezone"
          hint="Only needed when the file's timestamps carry no offset and the platform is not recognised. Rithmic and NinjaTrader export in Chicago time; Tradovate in New York."
        >
          <select name="sourceTimezone" className="select" defaultValue="">
            <option value="">Use the format's default</option>
            <option value="America/Chicago">America/Chicago (CME)</option>
            <option value="America/New_York">America/New_York</option>
            <option value="UTC">UTC</option>
            <option value="Asia/Jerusalem">Asia/Jerusalem</option>
          </select>
        </Field>

        <Field label="CSV file">
          <input name="file" type="file" accept=".csv,text/csv,text/plain" className="input" />
        </Field>

        <Field label="…or paste the contents" hint="Include the header row.">
          <textarea name="pasted" rows={6} className="textarea font-mono text-xs" />
        </Field>

        <SubmitButton pendingLabel="Importing…">Import</SubmitButton>
      </form>

      {report && <Report report={report} />}
    </>
  )
}

function Report({ report }: { report: ImportReport }) {
  return (
    <div
      className="mt-4 rounded-lg border p-4"
      style={{
        borderColor: report.ok ? 'color-mix(in srgb, var(--good) 35%, transparent)' : 'color-mix(in srgb, var(--critical) 35%, transparent)',
        background: report.ok
          ? 'color-mix(in srgb, var(--good) 8%, transparent)'
          : 'color-mix(in srgb, var(--critical) 8%, transparent)',
      }}
      role="status"
    >
      <p className="text-sm font-medium" style={{ color: report.ok ? 'var(--good-text)' : 'var(--critical)' }}>
        {report.ok ? '✓' : '!'} {report.message}
      </p>

      {report.rowsSeen > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <Metric label="Rows read" value={report.rowsSeen} />
          <Metric label="Imported" value={report.rowsImported} />
          <Metric label="Already stored" value={report.duplicates} />
          <Metric label="Trades built" value={report.tradesBuilt} />
        </dl>
      )}

      {report.errors.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-[var(--ink-secondary)]">
            {report.errors.length} row problem{report.errors.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1.5 space-y-0.5">
            {report.errors.map((error, index) => (
              <li key={index} className="text-xs text-[var(--ink-muted)]">
                {error}
              </li>
            ))}
          </ul>
        </details>
      )}

      {report.unmappedHeaders.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-[var(--ink-secondary)]">
            {report.unmappedHeaders.length} column{report.unmappedHeaders.length === 1 ? '' : 's'} not recognised
          </summary>
          <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
            {report.unmappedHeaders.join(', ')} — these were ignored. If one of them holds something important,
            renaming it to a common name (Symbol, Side, Qty, Price, Time, Commission) will let it through.
          </p>
        </details>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-[var(--ink-muted)]">{label}</dt>
      <dd className="tabular text-sm font-medium text-[var(--ink)]">{value}</dd>
    </div>
  )
}
