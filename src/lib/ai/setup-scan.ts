/**
 * Reading a trade setup off a chart screenshot.
 *
 * The model is a suggestion here and nothing more. A price misread by a digit
 * silently rewrites every R-multiple that follows, so this prompt is written to
 * make the model say "I could not read that" far more readily than it guesses,
 * and the parser keeps a null as a null rather than defaulting it to zero.
 *
 * Pure: the prompt and the parsing, with the network half in src/server/ai.ts.
 */
import { extractJson } from './model-review'

export const SETUP_SCAN_SYSTEM_PROMPT = `You read futures trading charts and report only what is legibly drawn on them.

You are looking at a screenshot from a charting platform. Report:
- the entry price
- the stop-loss price
- the take-profit / target price
- the instrument symbol, if a label shows it
- the direction, long or short
- which of the trader's named setups the chart most resembles, if any

Rules that matter more than completeness:
- Report a number ONLY if you can read the actual digits on the chart. Do not
  infer a level from the position of a coloured box, do not round, and do not
  calculate a level from the others.
- If a value is not legible, return null for it. A null is a correct answer.
  A guessed price is worse than no price, because the trader will not know
  which is which.
- Long/short: a stop below the entry is long, above is short. If neither the
  entry nor the stop is legible, return null.
- The model match is a suggestion. Return null unless the chart shows
  something the named setup explicitly describes.
- confidence is your own honest reading quality: "high" only when every number
  you returned is clearly legible.

Reply with JSON only, no prose:
{
  "symbol": string | null,
  "direction": "long" | "short" | null,
  "entryPrice": number | null,
  "stopPrice": number | null,
  "targetPrice": number | null,
  "modelName": string | null,
  "confidence": "high" | "medium" | "low",
  "unreadable": string[]
}

"unreadable" names the fields you could not read and why, one short phrase each.`

export type SetupScan = {
  symbol: string | null
  direction: 'long' | 'short' | null
  entryPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
  modelName: string | null
  confidence: 'high' | 'medium' | 'low'
  unreadable: string[]
}

export function buildSetupScanPrompt(modelNames: string[]): string {
  const named =
    modelNames.length > 0
      ? `The trader's named setups are: ${modelNames.join(', ')}. Match only one of these, exactly as written, or null.`
      : 'The trader has no named setups yet, so return null for modelName.'

  return `${named}

Read the attached chart and reply with the JSON described in your instructions.`
}

/** A number only if it really is one — NaN and Infinity are not prices. */
function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    // Models sometimes return "20,105.50" or "$20105.5" despite being asked
    // for a number; the digits are still a legible reading.
    const parsed = Number(value.replace(/[$,\s]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

export function parseSetupScan(text: string): SetupScan {
  const raw = extractJson(text)
  const data = (raw ? (JSON.parse(raw) as Record<string, unknown>) : {}) ?? {}

  const direction = str(data.direction)?.toLowerCase()
  const confidence = str(data.confidence)?.toLowerCase()

  return {
    symbol: str(data.symbol),
    direction: direction === 'long' || direction === 'short' ? direction : null,
    entryPrice: num(data.entryPrice),
    stopPrice: num(data.stopPrice),
    targetPrice: num(data.targetPrice),
    modelName: str(data.modelName),
    // Anything unrecognised is treated as the least confident reading rather
    // than the most — the failure mode to avoid is trusting a bad number.
    confidence: confidence === 'high' || confidence === 'medium' ? confidence : 'low',
    unreadable: Array.isArray(data.unreadable)
      ? data.unreadable.filter((item): item is string => typeof item === 'string')
      : [],
  }
}
