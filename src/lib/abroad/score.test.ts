import { describe, expect, it } from 'vitest'
import { drivers, rank, scoreOne } from './score'
import { DEFAULT_WEIGHTS, type CriterionKey, type Weights } from './criteria'

const flat = (value: number): Record<CriterionKey, number> =>
  Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((key) => [key, value])) as Record<
    CriterionKey,
    number
  >

const weights = (overrides: Partial<Weights>): Weights => ({ ...DEFAULT_WEIGHTS, ...overrides })

describe('scoreOne', () => {
  it('is the weighted mean, so a straight-5 candidate scores 5', () => {
    expect(scoreOne(flat(5), DEFAULT_WEIGHTS)).toBe(5)
    expect(scoreOne(flat(3), DEFAULT_WEIGHTS)).toBe(3)
  })

  it('ignores a criterion weighted zero rather than keeping a fraction of it', () => {
    const scores = { ...flat(5), tax: 0 }
    // With tax switched off entirely, a place that scores zero on tax is still
    // a perfect candidate.
    expect(scoreOne(scores, weights({ tax: 0 }))).toBe(5)
    expect(scoreOne(scores, DEFAULT_WEIGHTS)).toBeLessThan(5)
  })

  it('returns zero rather than dividing by zero when nothing is weighted', () => {
    const nothing = Object.fromEntries(
      Object.keys(DEFAULT_WEIGHTS).map((key) => [key, 0]),
    ) as Weights
    expect(scoreOne(flat(5), nothing)).toBe(0)
  })
})

describe('rank', () => {
  const candidates = [
    { name: 'Cheap and grim', scores: { ...flat(2), cost: 5, tax: 5 } },
    { name: 'Lovely and dear', scores: { ...flat(5), cost: 1, tax: 1 } },
  ]

  it('follows the weights rather than a fixed opinion', () => {
    const onMoney = rank(candidates, weights({ cost: 5, tax: 5, climate: 0, beach: 0, training: 0, food: 0, connectivity: 0, admin: 0, home: 0, proximity: 0 }))
    expect(onMoney[0].name).toBe('Cheap and grim')

    const onLife = rank(candidates, weights({ cost: 0, tax: 0 }))
    expect(onLife[0].name).toBe('Lovely and dear')
  })

  it('numbers the ranks from one', () => {
    const ranked = rank(candidates, DEFAULT_WEIGHTS)
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2])
  })
})

describe('drivers', () => {
  it('names what is carrying a candidate and what is dragging it', () => {
    const candidate = { scores: { ...flat(3), beach: 5, connectivity: 0 } }
    const result = drivers(candidate, DEFAULT_WEIGHTS)
    expect(result.best).toContain('beach')
    expect(result.worst).toContain('connectivity')
  })

  it('never names a criterion the reader switched off', () => {
    const candidate = { scores: { ...flat(3), connectivity: 0 } }
    const result = drivers(candidate, weights({ connectivity: 0 }))
    expect(result.worst).not.toContain('connectivity')
  })
})
