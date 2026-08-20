/**
 * Trading-model review — the pure half.
 *
 * Everything here is deterministic string-building and parsing so it can be
 * unit-tested without an API key. The server half (src/server/ai.ts) owns the
 * network call and the database writes.
 *
 * The feedback loop: every review the user grades (agree/disagree) becomes a
 * calibration example in the next prompt for that model, and the refine step
 * compresses the whole feedback history into the model's stored `aiGuidance`.
 * The reviewer is a fixed model — what improves is the context it is given,
 * which is the part we control.
 */

import type { ModelReviewResult, TradingModel } from '@/db/schema'

export type ReviewTradeFacts = {
  symbol: string
  direction: 'long' | 'short'
  qty: number
  entryAt: string
  exitAt: string | null
  avgEntry: number
  avgExit: number | null
  netPnl: number
  rMultiple: number | null
  stopPrice: number | null
  targetPrice: number | null
  durationSeconds: number | null
  maeBase: number | null
  mfeBase: number | null
  session: string
  setup: string | null
  notes: string | null
  mistakes: string[]
  hasScreenshot: boolean
}

export type FeedbackExample = {
  verdict: string
  reasoning: string
  feedback: 'agree' | 'disagree'
  feedbackNote: string | null
}

const field = (label: string, value: string | null | undefined): string =>
  value && value.trim() !== '' ? `${label}: ${value.trim()}` : ''

export function describeModel(model: TradingModel): string {
  return [
    `MODEL: ${model.name}`,
    field('Idea', model.description),
    field('Timeframe', model.timeframe),
    field('Instruments', model.instruments),
    field('Entry rules', model.entryRules),
    field('Exit rules', model.exitRules),
    field('Risk rules', model.riskRules),
    field('Invalidations (setup is void when)', model.invalidations),
  ]
    .filter(Boolean)
    .join('\n')
}

export function describeTrade(t: ReviewTradeFacts): string {
  const lines = [
    `${t.direction.toUpperCase()} ${t.qty} ${t.symbol}`,
    `Entry ${t.entryAt} @ ${t.avgEntry}`,
    t.exitAt ? `Exit ${t.exitAt} @ ${t.avgExit}` : 'Still open',
    `Net P&L ${t.netPnl.toFixed(2)}`,
    t.rMultiple !== null ? `R multiple ${t.rMultiple.toFixed(2)}` : 'No stop recorded — R unknown',
    t.stopPrice !== null ? `Stop ${t.stopPrice}` : 'No stop price recorded',
    t.targetPrice !== null ? `Target ${t.targetPrice}` : '',
    t.durationSeconds !== null ? `Held ${Math.round(t.durationSeconds / 60)}m` : '',
    t.maeBase !== null ? `MAE ${t.maeBase.toFixed(2)}` : '',
    t.mfeBase !== null ? `MFE ${t.mfeBase.toFixed(2)}` : '',
    `Session: ${t.session}`,
    field('Trader tagged setup', t.setup),
    t.mistakes.length > 0 ? `Trader admitted mistakes: ${t.mistakes.join(', ')}` : '',
    field('Trader notes', t.notes),
  ]
  return lines.filter(Boolean).join('\n')
}

export const REVIEW_SYSTEM_PROMPT = `You are a strict but constructive trading coach embedded in a futures trading journal. You judge one trade against the trader's own written model. Judge only rule fit, never outcome: a losing trade that followed every rule fits; a winner that broke the rules is a violation. If the information given cannot answer whether a rule was followed, say so in reasoning and lean on the "unclear" verdict rather than guessing. Reply with a single JSON object and nothing else:
{"verdict": "fits" | "partial" | "violation" | "unclear", "score": 0-100, "reasoning": "2-4 sentences, concrete, reference the specific rules", "violations": ["each rule broken, verbatim from the model where possible"], "suggestions": ["1-3 specific, actionable improvements"], "chart_observations": "only if a chart image was provided: what the chart actually shows relative to the entry rules, else null"}`

export function buildReviewPrompt(options: {
  model: TradingModel
  trade: ReviewTradeFacts
  journalPlan: string | null
  feedback: FeedbackExample[]
}): string {
  const { model, trade, journalPlan, feedback } = options

  const calibration =
    feedback.length === 0
      ? ''
      : [
          'CALIBRATION — how this trader graded your past verdicts on this model. Weigh disagreements heavily; they are corrections:',
          ...feedback.map(
            (f, i) =>
              `${i + 1}. You said "${f.verdict}" (${truncate(f.reasoning, 200)}). Trader ${f.feedback}d${
                f.feedbackNote ? `: "${truncate(f.feedbackNote, 200)}"` : '.'
              }`,
          ),
        ].join('\n')

  return [
    describeModel(model),
    model.aiGuidance ? `CALIBRATION NOTES (accumulated from trader feedback):\n${model.aiGuidance}` : '',
    calibration,
    journalPlan ? `TRADER'S PLAN FOR THAT DAY:\n${truncate(journalPlan, 600)}` : '',
    `TRADE TO REVIEW:\n${describeTrade(trade)}`,
    trade.hasScreenshot
      ? 'A chart screenshot of this trade is attached. Read it against the entry rules and fill chart_observations.'
      : 'No chart screenshot was attached — judge from the numbers alone and do not invent chart details.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildRefinePrompt(model: TradingModel, examples: FeedbackExample[]): string {
  return [
    'You maintain the calibration notes an AI reviewer uses when judging trades against this trading model.',
    describeModel(model),
    model.aiGuidance ? `CURRENT NOTES:\n${model.aiGuidance}` : 'CURRENT NOTES: none yet.',
    'FEEDBACK HISTORY (trader grading past AI verdicts):',
    ...examples.map(
      (f, i) =>
        `${i + 1}. Verdict "${f.verdict}" — ${truncate(f.reasoning, 200)} → trader ${f.feedback}d${
          f.feedbackNote ? `: "${truncate(f.feedbackNote, 200)}"` : ''
        }`,
    ),
    'Rewrite the calibration notes: what the reviewer keeps getting wrong or right for THIS model, what the trader actually means by their rules, and edge cases to watch. Plain text, at most 250 words, no preamble.',
  ].join('\n\n')
}

/** Classify-a-trade prompt for auto-tagging unlabelled trades. */
export function buildClassifyPrompt(models: TradingModel[], trade: ReviewTradeFacts): string {
  return [
    'Which of this trader\'s models does the trade below most plausibly belong to? Base it on instruments, timeframe, session and the tagged setup/notes. If none fits, say none.',
    ...models.map((m) => `--- id ${m.id}\n${describeModel(m)}`),
    `TRADE:\n${describeTrade(trade)}`,
    'Reply with a single JSON object: {"modelId": <id or null>, "confidence": 0-100, "why": "one sentence"}',
  ].join('\n\n')
}

// ---------------------------------------------------------------------------
// Parsing — the AI is asked for bare JSON but fences and stray prose happen.

export function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  if (start === -1) return null
  // Walk to the matching brace so trailing prose does not break JSON.parse.
  let depth = 0
  let inString = false
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return candidate.slice(start, i + 1)
    }
  }
  return null
}

const VERDICTS = new Set(['fits', 'partial', 'violation', 'unclear'])

export function parseReview(
  text: string,
  meta: { aiModel: string; reviewedAt: string },
): ModelReviewResult {
  const raw = extractJson(text)
  let parsed: Record<string, unknown> = {}
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }

  const verdict = VERDICTS.has(String(parsed.verdict)) ? (String(parsed.verdict) as ModelReviewResult['verdict']) : 'unclear'
  const scoreRaw = Number(parsed.score)
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((v) => String(v)).filter((v) => v.trim() !== '').slice(0, 8) : []

  return {
    verdict,
    score: Number.isFinite(scoreRaw) ? Math.min(100, Math.max(0, Math.round(scoreRaw))) : 0,
    reasoning:
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim() !== ''
        ? parsed.reasoning.trim()
        : 'The reviewer did not return a readable verdict. Re-run the check.',
    violations: strings(parsed.violations),
    suggestions: strings(parsed.suggestions),
    chartObservations:
      typeof parsed.chart_observations === 'string' && parsed.chart_observations.trim() !== ''
        ? parsed.chart_observations.trim()
        : null,
    reviewedAt: meta.reviewedAt,
    aiModel: meta.aiModel,
  }
}

export function parseClassification(text: string): { modelId: number | null; confidence: number } {
  const raw = extractJson(text)
  try {
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const id = Number(parsed.modelId)
    const confidence = Number(parsed.confidence)
    return {
      modelId: Number.isInteger(id) && id > 0 ? id : null,
      confidence: Number.isFinite(confidence) ? Math.min(100, Math.max(0, confidence)) : 0,
    }
  } catch {
    return { modelId: null, confidence: 0 }
  }
}

/** One JSONL row of the labelled dataset — training data for future bots. */
export function datasetRow(
  model: TradingModel,
  trade: ReviewTradeFacts,
  review: ModelReviewResult,
  feedback: { feedback: string | null; feedbackNote: string | null } | null,
): string {
  return JSON.stringify({
    model: {
      name: model.name,
      timeframe: model.timeframe,
      instruments: model.instruments,
      entryRules: model.entryRules,
      exitRules: model.exitRules,
      riskRules: model.riskRules,
      invalidations: model.invalidations,
    },
    trade,
    label: {
      verdict: review.verdict,
      score: review.score,
      reasoning: review.reasoning,
      violations: review.violations,
      chartObservations: review.chartObservations,
    },
    humanFeedback: feedback?.feedback ?? null,
    humanNote: feedback?.feedbackNote ?? null,
  })
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
