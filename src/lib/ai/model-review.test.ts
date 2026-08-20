import { describe, expect, it } from 'vitest'
import type { TradingModel } from '@/db/schema'
import {
  buildClassifyPrompt,
  buildRefinePrompt,
  buildReviewPrompt,
  datasetRow,
  extractJson,
  parseClassification,
  parseReview,
  type ReviewTradeFacts,
} from './model-review'

const model: TradingModel = {
  id: 1,
  name: 'ORB 15m',
  description: 'Opening range breakout on the NY open.',
  timeframe: '15m',
  instruments: 'MNQ, NQ',
  entryRules: 'Break of the first 15m range with volume; enter on retest.',
  exitRules: 'Half at 1R, rest at range projection.',
  riskRules: 'Stop below the range low. Max 2 contracts.',
  invalidations: 'No trade on FOMC days. No entry after 11:00 NY.',
  aiGuidance: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const trade: ReviewTradeFacts = {
  symbol: 'MNQ',
  direction: 'long',
  qty: 2,
  entryAt: '2026-08-19 16:31 Asia/Jerusalem',
  exitAt: '2026-08-19 16:39 Asia/Jerusalem',
  avgEntry: 21000.25,
  avgExit: 21010.25,
  netPnl: 35.2,
  rMultiple: 1.2,
  stopPrice: 20990,
  targetPrice: 21020,
  durationSeconds: 480,
  maeBase: -12,
  mfeBase: 44,
  session: 'NY open',
  setup: 'ORB',
  notes: 'clean retest',
  mistakes: [],
  hasScreenshot: false,
}

const meta = { aiModel: 'claude-sonnet-5', reviewedAt: '2026-08-20T00:00:00Z' }

describe('extractJson', () => {
  it('takes bare JSON', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}')
  })

  it('unwraps fenced JSON', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('ignores prose around the object and nested braces in strings', () => {
    const text = 'Here you go: {"reasoning":"used {brace} chars","score":90} hope that helps'
    expect(JSON.parse(extractJson(text)!)).toEqual({ reasoning: 'used {brace} chars', score: 90 })
  })

  it('returns null when there is no object', () => {
    expect(extractJson('no json here')).toBeNull()
  })
})

describe('parseReview', () => {
  it('parses a well-formed verdict', () => {
    const result = parseReview(
      JSON.stringify({
        verdict: 'fits',
        score: 88,
        reasoning: 'Entry on retest as written.',
        violations: [],
        suggestions: ['record the range high'],
        chart_observations: null,
      }),
      meta,
    )
    expect(result.verdict).toBe('fits')
    expect(result.score).toBe(88)
    expect(result.suggestions).toEqual(['record the range high'])
    expect(result.aiModel).toBe('claude-sonnet-5')
  })

  it('clamps score and falls back to unclear on junk', () => {
    const result = parseReview('{"verdict":"amazing","score":900,"reasoning":"x"}', meta)
    expect(result.verdict).toBe('unclear')
    expect(result.score).toBe(100)
  })

  it('survives an unparseable reply', () => {
    const result = parseReview('the model timed out', meta)
    expect(result.verdict).toBe('unclear')
    expect(result.score).toBe(0)
    expect(result.reasoning).toMatch(/Re-run/)
  })

  it('drops empty strings from lists and caps their length', () => {
    const result = parseReview(
      JSON.stringify({
        verdict: 'violation',
        score: 20,
        reasoning: 'Late entry.',
        violations: ['', 'entered after 11:00 NY', ...Array(10).fill('x')],
      }),
      meta,
    )
    expect(result.violations[0]).toBe('entered after 11:00 NY')
    expect(result.violations.length).toBeLessThanOrEqual(8)
  })
})

describe('parseClassification', () => {
  it('reads a model id', () => {
    expect(parseClassification('{"modelId": 3, "confidence": 80}')).toEqual({
      modelId: 3,
      confidence: 80,
    })
  })

  it('treats null and junk as no match', () => {
    expect(parseClassification('{"modelId": null}').modelId).toBeNull()
    expect(parseClassification('garbage').modelId).toBeNull()
  })
})

describe('prompts', () => {
  it('review prompt carries the rules, the trade and the no-chart guard', () => {
    const prompt = buildReviewPrompt({ model, trade, journalPlan: null, feedback: [] })
    expect(prompt).toContain('ORB 15m')
    expect(prompt).toContain('No trade on FOMC days')
    expect(prompt).toContain('LONG 2 MNQ')
    expect(prompt).toContain('do not invent chart details')
  })

  it('review prompt includes calibration when feedback exists and guidance when stored', () => {
    const prompt = buildReviewPrompt({
      model: { ...model, aiGuidance: 'Trader counts 16:29 as pre-open.' },
      trade,
      journalPlan: 'Only A setups today',
      feedback: [
        { verdict: 'violation', reasoning: 'Entered early', feedback: 'disagree', feedbackNote: 'retest was valid' },
      ],
    })
    expect(prompt).toContain('CALIBRATION NOTES')
    expect(prompt).toContain('Trader disagreed')
    expect(prompt).toContain('retest was valid')
    expect(prompt).toContain('Only A setups today')
  })

  it('refine prompt bounds the rewrite and shows history', () => {
    const prompt = buildRefinePrompt(model, [
      { verdict: 'fits', reasoning: 'ok', feedback: 'agree', feedbackNote: null },
    ])
    expect(prompt).toContain('at most 250 words')
    expect(prompt).toContain('Verdict "fits"')
  })

  it('classify prompt lists model ids', () => {
    const prompt = buildClassifyPrompt([model], trade)
    expect(prompt).toContain('--- id 1')
    expect(prompt).toContain('"modelId"')
  })
})

describe('datasetRow', () => {
  it('emits one valid JSON line with label and feedback', () => {
    const review = parseReview(
      '{"verdict":"fits","score":90,"reasoning":"good","violations":[],"suggestions":[]}',
      meta,
    )
    const row = datasetRow(model, trade, review, { feedback: 'agree', feedbackNote: null })
    const parsed = JSON.parse(row)
    expect(parsed.model.name).toBe('ORB 15m')
    expect(parsed.label.verdict).toBe('fits')
    expect(parsed.humanFeedback).toBe('agree')
    expect(row).not.toContain('\n')
  })
})
