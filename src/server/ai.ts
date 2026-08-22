import 'server-only'

/**
 * The AI reviewer — the impure half of src/lib/ai/model-review.ts.
 *
 * Talks to the Anthropic API with plain fetch (no SDK dependency), loads the
 * context a review needs (model, trade, that day's journal plan, the trader's
 * feedback history), writes the verdict to model_reviews, and denormalises the
 * latest verdict onto the trade so lists render without a join.
 *
 * Needs ANTHROPIC_API_KEY. Without it every entry point returns a clear
 * "not configured" result rather than throwing — the UI shows how to fix it.
 */

import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  journalEntries,
  modelReviews,
  trades,
  tradingModels,
  type ModelReviewResult,
  type Trade,
  type TradingModel,
  tradeSetups,
} from '@/db/schema'
import { sessionLabel } from '@/lib/analytics/metrics'
import { formatInZone } from '@/lib/time'
import {
  buildClassifyPrompt,
  buildRefinePrompt,
  buildReviewPrompt,
  parseClassification,
  parseReview,
  REVIEW_SYSTEM_PROMPT,
  type FeedbackExample,
  type ReviewTradeFacts,
} from '@/lib/ai/model-review'
import { getSettings } from './settings'
import { EMAIL_SYSTEM_PROMPT, buildEmailPrompt, parseEmailEvents } from '@/lib/email/ai'
import {
  SETUP_SCAN_SYSTEM_PROMPT,
  buildSetupScanPrompt,
  parseSetupScan,
  type SetupScan,
} from '@/lib/ai/setup-scan'
import { screenshotForAi } from './setups'

/** What the vision API accepts. HEIC from a phone has to be converted first. */
const VISION_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
import { firmForSender, type EmailEventDraft, type RawEmail } from '@/lib/email/parse'

const API_URL = 'https://api.anthropic.com/v1/messages'

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function aiModel(): string {
  return process.env.AI_MODEL || 'claude-sonnet-5'
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url'; url: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

async function callClaude(options: {
  system: string
  prompt: string
  imageUrl?: string | null
  /** An image this app holds itself, which has no URL anyone else can fetch. */
  image?: { base64: string; type: string } | null
  maxTokens?: number
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set.')

  const content: ContentBlock[] = []
  if (options.image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: options.image.type, data: options.image.base64 },
    })
  } else if (options.imageUrl && /^https:\/\//.test(options.imageUrl)) {
    content.push({ type: 'image', source: { type: 'url', url: options.imageUrl } })
  }
  content.push({ type: 'text', text: options.prompt })

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: aiModel(),
      max_tokens: options.maxTokens ?? 1024,
      system: options.system,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`)
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] }
  return (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
}

// ---------------------------------------------------------------------------

export function tradeFacts(trade: Trade, timezone: string): ReviewTradeFacts {
  const stamp = (value: Date | null): string | null =>
    value === null ? null : `${formatInZone(value, timezone, 'yyyy-MM-dd HH:mm')} (${timezone})`

  return {
    symbol: trade.symbol,
    direction: trade.direction,
    qty: trade.qty,
    entryAt: stamp(trade.entryAt)!,
    exitAt: stamp(trade.exitAt),
    avgEntry: trade.avgEntry,
    avgExit: trade.avgExit,
    netPnl: trade.netPnl,
    rMultiple: trade.rMultiple,
    stopPrice: trade.stopPrice,
    targetPrice: trade.targetPrice,
    durationSeconds: trade.durationSeconds,
    maeBase: trade.maeBase,
    mfeBase: trade.mfeBase,
    session: sessionLabel(trade.entryAt, timezone),
    setup: trade.setup,
    notes: trade.notes,
    mistakes: trade.mistakes,
    hasScreenshot: Boolean(trade.screenshotUrl && /^https:\/\//.test(trade.screenshotUrl)),
  }
}

async function feedbackExamples(modelId: number, limit = 6): Promise<FeedbackExample[]> {
  // Disagreements first — they are the corrections worth the prompt space.
  const rows = await db
    .select()
    .from(modelReviews)
    .where(and(eq(modelReviews.modelId, modelId), isNotNull(modelReviews.feedback)))
    .orderBy(
      sql`case when ${modelReviews.feedback} = 'disagree' then 0 else 1 end`,
      desc(modelReviews.createdAt),
    )
    .limit(limit)

  return rows.map((row) => ({
    verdict: row.verdict,
    reasoning: row.reasoning,
    feedback: row.feedback as 'agree' | 'disagree',
    feedbackNote: row.feedbackNote,
  }))
}

export type ReviewOutcome =
  | { ok: true; review: ModelReviewResult }
  | { ok: false; error: string }

/** Review one trade against its assigned model and persist the verdict. */
export async function reviewTradeAgainstModel(tradeId: number): Promise<ReviewOutcome> {
  if (!aiConfigured()) {
    return { ok: false, error: 'AI is not configured — set ANTHROPIC_API_KEY in your Vercel environment variables.' }
  }

  const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId)).limit(1)
  if (!trade) return { ok: false, error: 'Trade not found.' }
  if (trade.modelId === null) return { ok: false, error: 'Assign a model to this trade first.' }

  const [model] = await db.select().from(tradingModels).where(eq(tradingModels.id, trade.modelId)).limit(1)
  if (!model) return { ok: false, error: 'That model no longer exists.' }

  const settings = await getSettings()
  /**
   * What the trader said they were doing that day.
   *
   * The setups logged against the day are the live record now — the levels
   * they planned and the notes they wrote at the time. The old daily journal
   * entry is still read as a fallback so reviews of older trades keep the
   * context they were written with.
   */
  const daySetups = await db
    .select({ notes: tradeSetups.notes, symbol: tradeSetups.symbol })
    .from(tradeSetups)
    .where(eq(tradeSetups.entryDate, trade.tradingDay))

  const setupNotes = daySetups
    .filter((row) => row.notes)
    .map((row) => (row.symbol ? `${row.symbol}: ${row.notes}` : row.notes))
    .join('\n')

  const [journalRow] = setupNotes
    ? []
    : await db
        .select({ plan: journalEntries.plan })
        .from(journalEntries)
        .where(eq(journalEntries.entryDate, trade.tradingDay))
        .limit(1)

  const facts = tradeFacts(trade, settings.timezone)
  const prompt = buildReviewPrompt({
    model,
    trade: facts,
    journalPlan: setupNotes || (journalRow?.plan ?? null),
    feedback: await feedbackExamples(model.id),
  })

  let text: string
  try {
    text = await callClaude({
      system: REVIEW_SYSTEM_PROMPT,
      prompt,
      imageUrl: facts.hasScreenshot ? trade.screenshotUrl : null,
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'AI request failed.' }
  }

  const review = parseReview(text, { aiModel: aiModel(), reviewedAt: new Date().toISOString() })

  await db.insert(modelReviews).values({
    modelId: model.id,
    accountId: trade.accountId,
    symbol: trade.symbol,
    entryAt: trade.entryAt,
    tradingDay: trade.tradingDay,
    verdict: review.verdict,
    score: review.score,
    reasoning: review.reasoning,
    violations: review.violations,
    suggestions: review.suggestions,
    chartObservations: review.chartObservations,
    aiModel: review.aiModel,
  })
  await db.update(trades).set({ modelReview: review, updatedAt: new Date() }).where(eq(trades.id, tradeId))

  return { ok: true, review }
}

/** Review up to `limit` unreviewed trades already assigned to this model. */
export async function reviewPendingForModel(
  modelId: number,
  limit = 8,
): Promise<{ reviewed: number; failed: number; error?: string }> {
  if (!aiConfigured()) {
    return { reviewed: 0, failed: 0, error: 'AI is not configured — set ANTHROPIC_API_KEY.' }
  }
  const pending = await db
    .select({ id: trades.id })
    .from(trades)
    .where(and(eq(trades.modelId, modelId), isNull(trades.modelReview), eq(trades.status, 'closed')))
    .orderBy(desc(trades.entryAt))
    .limit(limit)

  let reviewed = 0
  let failed = 0
  for (const row of pending) {
    const outcome = await reviewTradeAgainstModel(row.id)
    if (outcome.ok) reviewed += 1
    else failed += 1
  }
  return { reviewed, failed }
}

/** AI-assign models to recent closed trades that have none. */
export async function autoTagTrades(
  limit = 12,
): Promise<{ tagged: number; skipped: number; error?: string }> {
  if (!aiConfigured()) {
    return { tagged: 0, skipped: 0, error: 'AI is not configured — set ANTHROPIC_API_KEY.' }
  }
  const models = await db.select().from(tradingModels).where(eq(tradingModels.active, true))
  if (models.length === 0) return { tagged: 0, skipped: 0, error: 'Define at least one model first.' }

  const settings = await getSettings()
  const untagged = await db
    .select()
    .from(trades)
    .where(and(isNull(trades.modelId), eq(trades.status, 'closed')))
    .orderBy(desc(trades.entryAt))
    .limit(limit)

  let tagged = 0
  let skipped = 0
  for (const trade of untagged) {
    try {
      const text = await callClaude({
        system: 'You classify trades into the trader\'s own playbook. Reply with JSON only.',
        prompt: buildClassifyPrompt(models, tradeFacts(trade, settings.timezone)),
        maxTokens: 256,
      })
      const { modelId, confidence } = parseClassification(text)
      // Low-confidence guesses are worse than no tag — they poison the stats.
      if (modelId !== null && confidence >= 60 && models.some((m) => m.id === modelId)) {
        await db.update(trades).set({ modelId, updatedAt: new Date() }).where(eq(trades.id, trade.id))
        tagged += 1
      } else {
        skipped += 1
      }
    } catch {
      skipped += 1
    }
  }
  return { tagged, skipped }
}

/** Compress the feedback history into the model's stored AI guidance. */
export async function refineModelGuidance(modelId: number): Promise<{ ok: boolean; message: string }> {
  if (!aiConfigured()) {
    return { ok: false, message: 'AI is not configured — set ANTHROPIC_API_KEY.' }
  }
  const [model] = await db.select().from(tradingModels).where(eq(tradingModels.id, modelId)).limit(1)
  if (!model) return { ok: false, message: 'Model not found.' }

  const examples = await feedbackExamples(modelId, 30)
  if (examples.length === 0) {
    return { ok: false, message: 'No feedback yet — agree or disagree with some reviews first, that is what the AI learns from.' }
  }

  try {
    const text = await callClaude({
      system: 'You maintain calibration notes for an AI trade reviewer. Reply with the notes only, plain text.',
      prompt: buildRefinePrompt(model, examples),
      maxTokens: 512,
    })
    const guidance = text.trim().slice(0, 4000)
    await db.update(tradingModels).set({ aiGuidance: guidance, updatedAt: new Date() }).where(eq(tradingModels.id, modelId))
    return { ok: true, message: `Guidance updated from ${examples.length} graded reviews.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'AI request failed.' }
  }
}


// ---------------------------------------------------------------------------
// Email

/**
 * Reads one prop-firm email the deterministic rules could not.
 *
 * Returns nothing rather than throwing: the email automation must finish and
 * record what it did understand even when the model is unreachable, over
 * budget, or replies with something unusable.
 */
export async function classifyEmailWithAi(email: RawEmail): Promise<EmailEventDraft[]> {
  if (!aiConfigured()) return []
  try {
    const reply = await callClaude({
      system: EMAIL_SYSTEM_PROMPT,
      prompt: buildEmailPrompt(email),
      maxTokens: 700,
    })
    return parseEmailEvents(reply, email, firmForSender(email.from))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Reading a setup off a chart

/**
 * Asks the model what it can read on a screenshot.
 *
 * The reading is stored in `aiExtract`, deliberately apart from the fields the
 * trader typed. Nothing here overwrites a value they entered: a misread digit
 * would silently rewrite every R-multiple downstream, and once merged there
 * would be no way to tell a level that was checked from one that was guessed.
 * The journal offers the reading as something to accept, field by field.
 */
export async function scanSetupScreenshot(
  setupId: number,
): Promise<{ ok: boolean; message: string; scan?: SetupScan }> {
  if (!aiConfigured()) {
    return { ok: false, message: 'ANTHROPIC_API_KEY is not set, so chart reading is unavailable.' }
  }

  const image = await screenshotForAi(setupId)
  if (!image) {
    return { ok: false, message: 'That setup has no screenshot to read.' }
  }
  if (!VISION_TYPES.has(image.type)) {
    return {
      ok: false,
      message: `${image.type} cannot be read by the model. Re-upload the chart as PNG, JPEG or WebP.`,
    }
  }

  const models = await db
    .select({ name: tradingModels.name })
    .from(tradingModels)
    .where(eq(tradingModels.active, true))

  let scan: SetupScan
  try {
    const reply = await callClaude({
      system: SETUP_SCAN_SYSTEM_PROMPT,
      prompt: buildSetupScanPrompt(models.map((model) => model.name)),
      image,
      maxTokens: 800,
    })
    scan = parseSetupScan(reply)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The chart read failed.' }
  }

  await db
    .update(tradeSetups)
    .set({ aiExtract: scan as unknown as Record<string, unknown>, aiReadAt: new Date() })
    .where(eq(tradeSetups.id, setupId))

  const read = [
    scan.entryPrice !== null ? 'entry' : null,
    scan.stopPrice !== null ? 'stop' : null,
    scan.targetPrice !== null ? 'target' : null,
  ].filter(Boolean)

  if (read.length === 0) {
    return {
      ok: true,
      scan,
      message: scan.unreadable.length
        ? `Nothing legible: ${scan.unreadable.join('; ')}.`
        : 'Nothing legible on that chart — fill the levels in yourself.',
    }
  }

  return {
    ok: true,
    scan,
    message: `Read ${read.join(', ')} with ${scan.confidence} confidence. Check each one before accepting it.`,
  }
}
