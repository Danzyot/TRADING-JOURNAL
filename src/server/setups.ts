import 'server-only'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { tradeSetups } from '@/db/schema'
import { decryptBytes, encryptBytes } from '@/lib/crypto'

/**
 * Trade setups and their charts.
 *
 * The screenshot is encrypted before it reaches the database, the same way a
 * document is: it is a picture of a funded account's order ticket, showing
 * size and levels, and there is no reason for that to sit in the clear just
 * because it happens to be a journal attachment rather than a statement.
 */

/**
 * Per-image ceiling.
 *
 * Vercel caps a request body at 4.5 MB and the Server Action limit is 4 MB, so
 * this leaves room for the rest of the form. A phone screenshot of a chart is
 * well inside it; a lossless export of a 4K monitor is not, which the upload
 * says plainly rather than failing at the platform edge.
 */
export const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024

/** What a charting platform actually produces, plus what a phone shares. */
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'])

export type SetupSummary = Omit<typeof tradeSetups.$inferSelect, 'screenshot'>

/** Never selects the image — one chart would dwarf a whole day of setups. */
const SUMMARY_COLUMNS = {
  id: tradeSetups.id,
  entryDate: tradeSetups.entryDate,
  symbol: tradeSetups.symbol,
  direction: tradeSetups.direction,
  entryPrice: tradeSetups.entryPrice,
  stopPrice: tradeSetups.stopPrice,
  stopPoints: tradeSetups.stopPoints,
  targetPrice: tradeSetups.targetPrice,
  targetPoints: tradeSetups.targetPoints,
  riskReward: tradeSetups.riskReward,
  modelId: tradeSetups.modelId,
  notes: tradeSetups.notes,
  screenshotType: tradeSetups.screenshotType,
  screenshotBytes: tradeSetups.screenshotBytes,
  aiExtract: tradeSetups.aiExtract,
  aiReadAt: tradeSetups.aiReadAt,
  createdAt: tradeSetups.createdAt,
  updatedAt: tradeSetups.updatedAt,
}

export async function listSetups(entryDate?: string): Promise<SetupSummary[]> {
  const query = db.select(SUMMARY_COLUMNS).from(tradeSetups)
  return entryDate
    ? query.where(eq(tradeSetups.entryDate, entryDate)).orderBy(desc(tradeSetups.createdAt))
    : query.orderBy(desc(tradeSetups.entryDate), desc(tradeSetups.createdAt)).limit(200)
}

/**
 * Headline numbers for the journal, in one round trip.
 *
 * Counted in the database rather than over a page of rows: the list is capped
 * at 200, so summing it would quietly understate the totals the day a
 * two-hundred-and-first setup is logged.
 */
export async function setupStats(): Promise<{
  total: number
  withChart: number
  avgRiskReward: number | null
  days: string[]
}> {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withChart: sql<number>`count(${tradeSetups.screenshot})::int`,
      avgRiskReward: sql<number | null>`avg(${tradeSetups.riskReward})`,
    })
    .from(tradeSetups)

  const days = await db
    .selectDistinct({ entryDate: tradeSetups.entryDate })
    .from(tradeSetups)
    .orderBy(desc(tradeSetups.entryDate))
    .limit(400)

  return {
    total: totals?.total ?? 0,
    withChart: totals?.withChart ?? 0,
    // Postgres hands numeric averages back as strings through postgres.js.
    avgRiskReward: totals?.avgRiskReward == null ? null : Number(totals.avgRiskReward),
    days: days.map((row) => row.entryDate),
  }
}

/** Validates and encrypts an uploaded chart. Returns null for "no file sent". */
export async function prepareScreenshot(
  file: File | null,
): Promise<{ data: Buffer; type: string; bytes: number } | null> {
  if (!file || file.size === 0) return null

  const type = file.type || 'application/octet-stream'
  if (!ALLOWED_IMAGE_TYPES.has(type)) {
    throw new Error(`${type} is not an image this journal accepts. Use PNG, JPEG or WebP.`)
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    const mb = (MAX_SCREENSHOT_BYTES / 1024 / 1024).toFixed(0)
    throw new Error(`That screenshot is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${mb} MB.`)
  }

  const plaintext = Buffer.from(await file.arrayBuffer())
  return { data: encryptBytes(plaintext), type, bytes: plaintext.length }
}

/** The decrypted image, for the authenticated route that serves it. */
export async function readScreenshot(
  id: number,
): Promise<{ data: Buffer; type: string } | null> {
  const [row] = await db
    .select({ data: tradeSetups.screenshot, type: tradeSetups.screenshotType })
    .from(tradeSetups)
    .where(eq(tradeSetups.id, id))
    .limit(1)

  if (!row?.data) return null
  return { data: decryptBytes(Buffer.from(row.data)), type: row.type ?? 'application/octet-stream' }
}

/** The same bytes as base64, which is the only form the vision API takes. */
export async function screenshotForAi(
  id: number,
): Promise<{ base64: string; type: string } | null> {
  const image = await readScreenshot(id)
  if (!image) return null
  return { base64: image.data.toString('base64'), type: image.type }
}
