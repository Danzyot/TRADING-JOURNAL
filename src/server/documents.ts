import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { documents } from '@/db/schema'
import { decryptBytes, encryptBytes } from '@/lib/crypto'

/**
 * The document vault.
 *
 * Files are encrypted before they reach the database and decrypted only in the
 * request that serves them, so the bytes at rest are useless without the
 * environment key. Nothing is written to disk: this app runs on serverless
 * functions with no persistent filesystem, and a temp file is one more copy of
 * a passport scan than anyone needs.
 */

/**
 * Per-file ceiling.
 *
 * Vercel caps a request body at 4.5 MB, and the encrypted blob is the file
 * plus 28 bytes, so 4 MB leaves room for the multipart envelope. Phone photos
 * of documents land well under it; a long statement PDF occasionally does not,
 * which the upload says plainly rather than failing at the platform edge.
 */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024

/** What a bank or a firm actually sends, plus photos of physical documents. */
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'text/plain',
  'text/csv',
])

export type DocumentSummary = Omit<typeof documents.$inferSelect, 'data'>

/** The list never loads the blobs — one statement would dwarf the whole page. */
export async function listDocuments(): Promise<DocumentSummary[]> {
  return db
    .select({
      id: documents.id,
      kind: documents.kind,
      label: documents.label,
      filename: documents.filename,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      firmId: documents.firmId,
      accountId: documents.accountId,
      documentDate: documents.documentDate,
      notes: documents.notes,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .orderBy(desc(documents.createdAt))
}

export type StoreInput = {
  file: File
  kind: (typeof documents.$inferSelect)['kind']
  label: string
  firmId: number | null
  accountId: number | null
  documentDate: string | null
  notes: string | null
}

export async function storeDocument(input: StoreInput): Promise<string> {
  const { file } = input
  if (!file || file.size === 0) throw new Error('Choose a file to upload.')
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB. Photograph it at a lower resolution, or split the PDF.`,
    )
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`${file.type || 'That file type'} is not accepted. Use a PDF, an image, or a CSV.`)
  }

  const plaintext = Buffer.from(await file.arrayBuffer())

  await db.insert(documents).values({
    kind: input.kind,
    label: input.label.trim() || file.name,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: plaintext.length,
    data: encryptBytes(plaintext),
    firmId: input.firmId,
    accountId: input.accountId,
    documentDate: input.documentDate,
    notes: input.notes,
  })

  return `Stored ${input.label.trim() || file.name}, encrypted.`
}

/** Decrypts one document for the authenticated download route. */
export async function readDocument(
  id: number,
): Promise<{ bytes: Buffer; filename: string; mimeType: string } | null> {
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
  if (!row) return null
  return { bytes: decryptBytes(row.data), filename: row.filename, mimeType: row.mimeType }
}

export async function deleteDocument(id: number): Promise<void> {
  await db.delete(documents).where(eq(documents.id, id))
}
