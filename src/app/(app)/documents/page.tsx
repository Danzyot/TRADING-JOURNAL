import Link from 'next/link'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { shortDate } from '@/lib/format'
import { removeDocument, uploadDocument } from '@/server/actions'
import { MAX_DOCUMENT_BYTES, listDocuments } from '@/server/documents'
import { listFirms } from '@/server/money'
import { listAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Documents — Trading Journal' }

const KINDS: { value: string; label: string }[] = [
  { value: 'payout_confirmation', label: 'Payout confirmation' },
  { value: 'statement', label: 'Account statement' },
  { value: 'id_document', label: 'ID document' },
  { value: 'invoice', label: 'Invoice / receipt' },
  { value: 'contract', label: 'Contract / terms' },
  { value: 'other', label: 'Other' },
]

const KIND_LABELS: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]))
const KIND_TONES: Record<string, 'good' | 'warn' | 'critical' | 'neutral' | 'accent'> = {
  payout_confirmation: 'good',
  statement: 'accent',
  id_document: 'critical',
  invoice: 'warn',
  contract: 'neutral',
  other: 'neutral',
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function DocumentsPage() {
  const [documents, firms, accounts] = await Promise.all([listDocuments(), listFirms(), listAccounts()])

  const firmName = (id: number | null) => (id === null ? null : firms.find((f) => f.id === id)?.name)
  const accountName = (id: number | null) =>
    id === null ? null : accounts.find((a) => a.id === id)?.label

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Payout confirmations, statements and ID — encrypted, and ready the hour a bank asks where the money came from."
      />

      <div className="mb-4">
        <Disclosure label="Add a document">
          <Card>
            <ActionForm action={uploadDocument} className="space-y-3" resetOnSuccess>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="File" hint={`PDF, image or CSV, up to ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB`}>
                  <input
                    name="file"
                    type="file"
                    required
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.txt,.csv"
                    className="input"
                  />
                </Field>
                <Field label="What is it">
                  <select name="kind" className="select" defaultValue="payout_confirmation">
                    {KINDS.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Label" hint="Blank uses the filename">
                  <input name="label" className="input" placeholder="Apex payout — Aug 21" />
                </Field>
                <Field label="Date on the document">
                  <input name="documentDate" type="date" className="input" />
                </Field>
                <Field label="Firm">
                  <select name="firmId" className="select" defaultValue="">
                    <option value="">No firm</option>
                    {firms.map((firm) => (
                      <option key={firm.id} value={firm.id}>
                        {firm.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Account">
                  <select name="accountId" className="select" defaultValue="">
                    <option value="">Not account-specific</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Notes">
                  <input name="notes" className="input" />
                </Field>
              </div>

              <SubmitButton>Store it</SubmitButton>
            </ActionForm>
          </Card>
        </Disclosure>
      </div>

      <Card bodyClassName="p-0">
        {documents.length === 0 ? (
          <EmptyState
            title="Nothing stored yet"
            body="Payout confirmations, account statements and your ID. A bank asking for source of funds is a when, not an if, and answering the same hour with the paperwork attached is the difference between a two-day hold and a three-week one."
          />
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Kind</th>
                  <th>Date</th>
                  <th>Firm / account</th>
                  <th className="text-right">Size</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <Link
                        href={`/api/documents/${document.id}`}
                        className="font-medium text-[var(--accent)] hover:underline"
                        prefetch={false}
                      >
                        {document.label}
                      </Link>
                      {document.notes && (
                        <p className="text-xs text-[var(--ink-muted)]">{document.notes}</p>
                      )}
                    </td>
                    <td>
                      <Badge tone={KIND_TONES[document.kind] ?? 'neutral'}>
                        {KIND_LABELS[document.kind] ?? document.kind}
                      </Badge>
                    </td>
                    <td className="tabular whitespace-nowrap text-xs">
                      {document.documentDate
                        ? shortDate(document.documentDate)
                        : document.createdAt.toLocaleDateString()}
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-[var(--ink-secondary)]">
                      {[firmName(document.firmId), accountName(document.accountId)]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="tabular whitespace-nowrap text-right text-xs">
                      {readableSize(document.sizeBytes)}
                    </td>
                    <td className="text-right">
                      <ActionButton
                        action={async () => {
                          'use server'
                          return removeDocument(document.id)
                        }}
                        className="btn btn-danger px-2 py-1"
                        confirm="Delete this document? It cannot be recovered."
                      >
                        ✕
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4" title="How these are kept">
        <ul className="space-y-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
          <li>
            <strong className="text-[var(--ink)]">Encrypted before storage</strong> with AES-256-GCM, keyed
            by <code>ENCRYPTION_KEY</code> — which lives in the environment, never in the database. A leaked
            database dump is ciphertext, not your passport.
          </li>
          <li>
            <strong className="text-[var(--ink)]">No public URLs.</strong> Files are served only through an
            authenticated route that re-checks your session and sets <code>no-store</code>, so nothing is
            cached by a CDN or left on disk by a browser.
          </li>
          <li>
            <strong className="text-[var(--ink)]">Never written to disk</strong> — this app runs on
            serverless functions with no persistent filesystem, so there is no temp copy to leak.
          </li>
          <li>
            <strong className="text-[var(--ink)]">What this is not:</strong> your own device and your email
            are still the weak links, and anyone who gets your login gets these files. Use a long password,
            and keep the ID scans here only while you actually need them.
          </li>
        </ul>
      </Card>
    </>
  )
}
