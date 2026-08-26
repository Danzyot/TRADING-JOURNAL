import { describe, expect, it } from 'vitest'
import { CRITERIA } from './criteria'
import {
  ALL_KEYS,
  DEFAULT_PRIORITIES,
  move,
  normalise,
  toggleIgnored,
  weightsFrom,
} from './priorities'

describe('the priority order', () => {
  it('covers every criterion exactly once', () => {
    expect([...DEFAULT_PRIORITIES.order].sort()).toEqual([...ALL_KEYS].sort())
    expect(DEFAULT_PRIORITIES.order.length).toBe(CRITERIA.length)
  })
})

describe('weightsFrom', () => {
  it('gives first place the most and last place the least', () => {
    const weights = weightsFrom(DEFAULT_PRIORITIES)
    const first = DEFAULT_PRIORITIES.order[0]
    const last = DEFAULT_PRIORITIES.order[DEFAULT_PRIORITIES.order.length - 1]
    expect(weights[first]).toBeGreaterThan(weights[last])
    expect(weights[first]).toBe(5)
  })

  it('keeps last place meaningful rather than nearly zero', () => {
    const weights = weightsFrom(DEFAULT_PRIORITIES)
    const last = DEFAULT_PRIORITIES.order[DEFAULT_PRIORITIES.order.length - 1]
    expect(weights[last]).toBeGreaterThan(1)
  })

  it('drops an ignored criterion out of the comparison entirely', () => {
    const weights = weightsFrom({ ...DEFAULT_PRIORITIES, ignored: ['tax'] })
    expect(weights.tax).toBe(0)
  })

  it('still ranks the rest when almost everything is ignored', () => {
    const ignored = ALL_KEYS.filter((key) => key !== 'cost')
    const weights = weightsFrom({ ...DEFAULT_PRIORITIES, ignored })
    expect(weights.cost).toBe(5)
    expect(weights.beach).toBe(0)
  })
})

describe('move', () => {
  it('promotes and demotes', () => {
    const promoted = move(DEFAULT_PRIORITIES, 'beach', -1)
    expect(promoted.order.indexOf('beach')).toBe(DEFAULT_PRIORITIES.order.indexOf('beach') - 1)
    const demoted = move(DEFAULT_PRIORITIES, 'beach', 1)
    expect(demoted.order.indexOf('beach')).toBe(DEFAULT_PRIORITIES.order.indexOf('beach') + 1)
  })

  it('stops at the ends instead of wrapping', () => {
    const first = DEFAULT_PRIORITIES.order[0]
    expect(move(DEFAULT_PRIORITIES, first, -1)).toBe(DEFAULT_PRIORITIES)
  })

  it('ignores a key that is not in the list', () => {
    expect(move(DEFAULT_PRIORITIES, 'nonsense' as never, -1)).toBe(DEFAULT_PRIORITIES)
  })
})

describe('toggleIgnored', () => {
  it('goes both ways', () => {
    const off = toggleIgnored(DEFAULT_PRIORITIES, 'tax')
    expect(off.ignored).toContain('tax')
    expect(toggleIgnored(off, 'tax').ignored).not.toContain('tax')
  })
})

describe('normalise', () => {
  it('adds a criterion that did not exist when the order was saved', () => {
    const stored = { order: ['cost', 'beach'], ignored: [] }
    const repaired = normalise(stored)
    expect(repaired.order).toContain('safety')
    expect([...repaired.order].sort()).toEqual([...ALL_KEYS].sort())
    expect(repaired.order.slice(0, 2)).toEqual(['cost', 'beach'])
  })

  it('drops a criterion that no longer exists', () => {
    const repaired = normalise({ order: ['cost', 'weather-vibes'], ignored: ['gone'] })
    expect(repaired.order).not.toContain('weather-vibes')
    expect(repaired.ignored).toEqual([])
  })

  it('survives rubbish', () => {
    expect(normalise(null).order).toEqual(DEFAULT_PRIORITIES.order)
    expect(normalise('nope').order).toEqual(DEFAULT_PRIORITIES.order)
  })
})
