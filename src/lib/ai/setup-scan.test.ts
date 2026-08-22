import { describe, expect, it } from 'vitest'
import { buildSetupScanPrompt, parseSetupScan } from './setup-scan'

describe('buildSetupScanPrompt', () => {
  it('offers the trader\'s own setups by name', () => {
    const prompt = buildSetupScanPrompt(['London sweep', 'FVG continuation'])
    expect(prompt).toContain('London sweep, FVG continuation')
    expect(prompt).toContain('exactly as written')
  })

  it('tells the model not to invent one when there are none', () => {
    expect(buildSetupScanPrompt([])).toContain('return null for modelName')
  })
})

describe('parseSetupScan', () => {
  it('reads a clean reply', () => {
    const scan = parseSetupScan(
      JSON.stringify({
        symbol: 'MNQ',
        direction: 'long',
        entryPrice: 20100.25,
        stopPrice: 20080,
        targetPrice: 20160.5,
        modelName: 'London sweep',
        confidence: 'high',
        unreadable: [],
      }),
    )
    expect(scan).toEqual({
      symbol: 'MNQ',
      direction: 'long',
      entryPrice: 20100.25,
      stopPrice: 20080,
      targetPrice: 20160.5,
      modelName: 'London sweep',
      confidence: 'high',
      unreadable: [],
    })
  })

  it('keeps an unreadable level null rather than zero', () => {
    // A zero stop would compute an infinite R and look like a real number.
    const scan = parseSetupScan(
      JSON.stringify({ entryPrice: 20100, stopPrice: null, confidence: 'low', unreadable: ['stop hidden behind the toolbar'] }),
    )
    expect(scan.stopPrice).toBeNull()
    expect(scan.unreadable).toEqual(['stop hidden behind the toolbar'])
  })

  it('recovers a price the model formatted as text', () => {
    const scan = parseSetupScan(JSON.stringify({ entryPrice: '$20,105.50' }))
    expect(scan.entryPrice).toBe(20105.5)
  })

  it('survives a fenced reply with prose around it', () => {
    const scan = parseSetupScan('Here is what I read:\n```json\n{"symbol":"ES","direction":"short"}\n```\nHope that helps.')
    expect(scan.symbol).toBe('ES')
    expect(scan.direction).toBe('short')
  })

  it('treats an unrecognised confidence as the lowest', () => {
    // The failure to avoid is trusting a bad reading, so anything unexpected
    // degrades rather than promotes.
    expect(parseSetupScan(JSON.stringify({ confidence: 'certain' })).confidence).toBe('low')
    expect(parseSetupScan(JSON.stringify({})).confidence).toBe('low')
  })

  it('rejects a direction it does not recognise', () => {
    expect(parseSetupScan(JSON.stringify({ direction: 'sideways' })).direction).toBeNull()
  })

  it('rejects a non-finite price', () => {
    expect(parseSetupScan('{"entryPrice": "not a price"}').entryPrice).toBeNull()
  })

  it('returns an empty scan for an empty reply', () => {
    const scan = parseSetupScan('')
    expect(scan.entryPrice).toBeNull()
    expect(scan.confidence).toBe('low')
    expect(scan.unreadable).toEqual([])
  })
})
