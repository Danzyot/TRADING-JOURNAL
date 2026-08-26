import { describe, expect, it } from 'vitest'
import { CANDIDATES } from './countries'
import { CONNECTIVITY } from './connectivity'
import { PLACES } from './places'
import { SAFETY } from './safety'
import { PALETTES, TERRAIN_OVERRIDES, houseFor, sceneryFor, seedOf, shoreFor } from './scenery'
import { BEGINNER, TRAINING_CLIMATE } from './training'

describe('every country answers every question', () => {
  it.each(CANDIDATES.map((candidate) => candidate.slug))('%s', (slug) => {
    expect(CONNECTIVITY[slug], 'connectivity').toBeTruthy()
    expect(SAFETY[slug], 'safety').toBeTruthy()
    expect(TRAINING_CLIMATE[slug], 'training climate').toBeTruthy()
    expect(CANDIDATES.find((candidate) => candidate.slug === slug)?.winter.length).toBeGreaterThan(20)
  })
})

describe('the safety data', () => {
  it('scores every country and says something in every field', () => {
    for (const candidate of CANDIDATES) {
      const safety = SAFETY[candidate.slug]
      expect(safety.score, candidate.slug).toBeGreaterThanOrEqual(1)
      expect(safety.score, candidate.slug).toBeLessThanOrEqual(5)
      for (const field of [safety.community, safety.chabad, safety.incidents, safety.israelis, safety.faith, safety.verdict]) {
        expect(field.length, candidate.slug).toBeGreaterThan(30)
      }
    }
  })

  it('matches the score the country carries in the ranking', () => {
    for (const candidate of CANDIDATES) {
      expect(candidate.scores.safety, candidate.slug).toBe(SAFETY[candidate.slug].score)
    }
  })
})

describe('hard stops', () => {
  it('name a constraint no weighting can outvote', () => {
    const stopped = CANDIDATES.filter((candidate) => candidate.hardStop)
    expect(stopped.map((candidate) => candidate.slug).sort()).toEqual(['turkey', 'usa'])
    for (const candidate of stopped) {
      expect(candidate.hardStop!.length, candidate.slug).toBeGreaterThan(60)
    }
  })
})

describe('the beginner notes', () => {
  it('exist for towns with a mat and not for towns without one', () => {
    const withMat = PLACES.filter((place) => place.mma)
    const missing = withMat.filter((place) => !BEGINNER[place.id]).map((place) => place.id)
    expect(missing).toEqual([])
    const invented = PLACES.filter((place) => !place.mma && BEGINNER[place.id]).map((place) => place.id)
    expect(invented).toEqual([])
  })
})

describe('scenery', () => {
  it('draws a scene for every town', () => {
    for (const place of PLACES) {
      const scenery = sceneryFor(place)
      expect(Object.values(PALETTES)).toContain(scenery.palette)
      expect(scenery.seed).toBeGreaterThan(0)
    }
  })

  it('is stable — a town looks the same on every load', () => {
    expect(seedOf('chania')).toBe(seedOf('chania'))
    expect(seedOf('chania')).not.toBe(seedOf('rethymno'))
  })

  it('reads the shore off the town’s own sentence about the sea', () => {
    const shoreOf = (id: string) => shoreFor(PLACES.find((place) => place.id === id)!)
    expect(shoreOf('nicosia')).toBe('none')
    expect(shoreOf('thessaloniki')).toBe('none')
    expect(shoreOf('sliema')).toBe('rock')
    expect(shoreOf('herceg-novi')).toBe('rock')
    expect(shoreOf('bar')).toBe('pebble')
    expect(shoreOf('carcavelos')).toBe('sand')
  })

  it('draws a tower where whole houses are rare', () => {
    const sliema = PLACES.find((place) => place.id === 'sliema')!
    expect(houseFor(sliema, 'city')).toBe('tower')
  })

  it('has no terrain override for a town that does not exist', () => {
    // A typo here would silently fall back to the country default and draw the
    // wrong picture, which is the one failure mode nobody would notice.
    const ids = new Set(PLACES.map((place) => place.id))
    const orphans = Object.keys(TERRAIN_OVERRIDES).filter((id) => !ids.has(id))
    expect(orphans).toEqual([])
  })

  it('gives a landlocked town no shore at all', () => {
    const nicosia = PLACES.find((place) => place.id === 'nicosia')!
    expect(sceneryFor(nicosia).terrain).toBe('inland')
    expect(sceneryFor(nicosia).shore).toBe('none')
  })
})
