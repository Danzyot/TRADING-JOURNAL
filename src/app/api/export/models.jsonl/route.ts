import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { modelReviews, trades, tradingModels } from '@/db/schema'
import { datasetRow } from '@/lib/ai/model-review'
import { tradeFacts } from '@/server/ai'
import { getSettings } from '@/server/settings'

export const dynamic = 'force-dynamic'

/**
 * The labelled dataset: one JSON line per AI-reviewed trade — the model's
 * rules, the trade's numbers, the AI's verdict and the trader's feedback.
 * This is the training data for the automated strategies the user wants to
 * build: reviews graded by a human are exactly the labels a bot needs.
 *
 * Session-gated by the middleware like every page; downloaded from the
 * browser, so the cookie rides along.
 */
export async function GET() {
  const settings = await getSettings()

  const rows = await db
    .select()
    .from(trades)
    .where(and(isNotNull(trades.modelId), isNotNull(trades.modelReview)))
    .orderBy(trades.entryAt)

  // One query each, joined in memory — no per-row round trips on a remote DB.
  const [models, reviewRows] = await Promise.all([
    db.select().from(tradingModels),
    db.select().from(modelReviews).orderBy(modelReviews.createdAt),
  ])
  const modelById = new Map(models.map((model) => [model.id, model]))
  const reviewKey = (accountId: number, entryAt: Date, symbol: string): string =>
    `${accountId}|${entryAt.toISOString()}|${symbol}`
  // Later reviews overwrite earlier ones, so each trade pairs with its latest.
  const latestReview = new Map(
    reviewRows.map((row) => [
      reviewKey(row.accountId, row.entryAt, row.symbol),
      { feedback: row.feedback, feedbackNote: row.feedbackNote },
    ]),
  )

  const lines: string[] = []
  for (const trade of rows) {
    const model = modelById.get(trade.modelId!)
    if (!model || !trade.modelReview) continue
    const feedback = latestReview.get(reviewKey(trade.accountId, trade.entryAt, trade.symbol)) ?? null
    lines.push(datasetRow(model, tradeFacts(trade, settings.timezone), trade.modelReview, feedback))
  }

  return new Response(lines.join('\n') + (lines.length > 0 ? '\n' : ''), {
    headers: {
      'content-type': 'application/jsonl; charset=utf-8',
      'content-disposition': 'attachment; filename="trading-models-dataset.jsonl"',
    },
  })
}
