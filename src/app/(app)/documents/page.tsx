import Link from 'next/link'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { shortDate } from '@/lib/format'
import { Editable } from '@/components/site-text'
import { deleteFolder, moveDocument, removeDocument, saveFolder, uploadDocument } from '@/server/actions'
import { MAX_DOCUMENT_BYTES, listDocuments, listFolders } from '@/server/documents'
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

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>
}) {
  const [params, documents, folders, firms, accounts] = await Promise.all([
    searchParams,
    listDocuments(),
    listFolders(),
    listFirms(),
    listAccounts(),
  ])

  // '' is everything, 'root' is the unfiled pile, otherwise a folder id.
  const selected = params.folder ?? ''
  const visible = documents.filter((document) => {
    if (selected === '') return true
    if (selected === 'root') return document.folderId === null
    return document.folderId === Number(selected)
  })
  const countIn = (folderId: number | null) =>
    documents.filter((document) => document.folderId === folderId).length
  const folderName = (id: number | null) =>
    id === null ? null : (folders.find((folder) => folder.id === id)?.name ?? null)

  const firmName = (id: number | null) => (id === null ? null : firms.find((f) => f.id === id)?.name)
  const accountName = (id: number | null) =>
    id === null ? null : accounts.find((a) => a.id === id)?.label

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Payout confirmations, statements and ID — encrypted, and ready the hour a bank asks where the money came from."
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <FolderTab href="/documents" active={selected === ''} label="All" count={documents.length} />
        <FolderTab
          href="/documents?folder=root"
          active={selected === 'root'}
          label="Unfiled"
          count={countIn(null)}
        />
        {folders.map((folder) => (
          <FolderTab
            key={folder.id}
            href={`/documents?folder=${folder.id}`}
            active={selected === String(folder.id)}
            label={folder.name}
            count={countIn(folder.id)}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Disclosure label="New folder">
          <Card>
            <ActionForm
              action={async (formData: FormData) => {
                'use server'
                return saveFolder(null, formData)
              }}
              className="space-y-3"
              resetOnSuccess
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <input name="name" className="input" required placeholder="Payout confirmations" />
                </Field>
                <Field label="What belongs in here" hint="For the times it is not obvious">
                  <input name="description" className="input" />
                </Field>
              </div>
              <SubmitButton>Create folder</SubmitButton>
            </ActionForm>
          </Card>
        </Disclosure>
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
                <Field label="Folder">
                  <select
                    name="folderId"
                    className="select"
                    defaultValue={selected !== '' && selected !== 'root' ? selected : ''}
                  >
                    <option value="">Unfiled</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
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

      {selected !== '' && selected !== 'root' && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">
                {folderName(Number(selected))}
              </p>
              {folders.find((folder) => folder.id === Number(selected))?.description && (
                <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">
                  {folders.find((folder) => folder.id === Number(selected))!.description}
                </p>
              )}
            </div>
            <ActionButton
              action={async () => {
                'use server'
                return deleteFolder(Number(selected))
              }}
              className="btn btn-danger"
              confirm="Remove this folder? Everything in it moves back to the vault root — nothing is deleted."
            >
              Remove folder
            </ActionButton>
          </div>
        </Card>
      )}

      <Card bodyClassName="p-0">
        {visible.length === 0 ? (
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
                  <th>Folder</th>
                  <th>Date</th>
                  <th>Firm / account</th>
                  <th className="text-right">Size</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((document) => (
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
                    <td>
                      {/* Filing is a one-click change, not a trip through an
                          edit form — a vault only stays tidy if tidying is
                          cheaper than leaving it. */}
                      <form
                        action={async (formData: FormData) => {
                          'use server'
                          const target = String(formData.get('folderId') ?? '')
                          // The page revalidates, so the select comes back
                          // showing the new folder; the result message would
                          // have nowhere to go inside a table cell.
                          await moveDocument(document.id, target === '' ? null : Number(target))
                        }}
                      >
                        <select
                          name="folderId"
                          defaultValue={document.folderId ?? ''}
                          className="select py-1 text-xs"
                        >
                          <option value="">Unfiled</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="btn mt-1 px-2 py-0.5 text-[0.625rem]">
                          Move
                        </button>
                      </form>
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

/** A folder as a pill, with what is in it — an empty one should look empty. */
function FolderTab({
  href,
  active,
  label,
  count,
}: {
  href: string
  active: boolean
  label: string
  count: number
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white'
          : 'inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-secondary)] transition-colors hover:border-[var(--line-strong)]'
      }
    >
      {label}
      <span className={active ? 'text-white/70' : 'text-[var(--ink-muted)]'}>{count}</span>
    </Link>
  )
}
