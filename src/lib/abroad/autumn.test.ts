import { describe, expect, it } from 'vitest'
import { MONTHS, ZONES, autumnFor, autumnScore, zoneKeyOf } from './autumn'
import { PLACES } from './places'
import { staysFor, DETAILED_COUNTRIES, STAYS } from './stays'

const place = (id: string) => {
  const found = PLACES.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no place ${id}`)
  return found
}

describe('the September to December window', () => {
  it('covers every town', () => {
    const missing = PLACES.filter((candidate) => !autumnFor(candidate)).map((candidate) => candidate.id)
    expect(missing).toEqual([])
  })

  it('names a zone that exists for every town', () => {
    for (const candidate of PLACES) {
      expect(ZONES[zoneKeyOf(candidate)!], candidate.id).toBeTruthy()
    }
  })

  it('answers all four months everywhere', () => {
    for (const zone of Object.values(ZONES)) {
      for (const { key } of MONTHS) {
        const month = zone.months[key]
        expect(month.day, `${zone.label}.${key}`).toBeGreaterThan(-10)
        expect(month.rain, `${zone.label}.${key}`).toBeGreaterThanOrEqual(0)
        expect(month.note.length, `${zone.label}.${key}`).toBeGreaterThan(15)
      }
    }
  })

  it('has no zone defined that nothing uses', () => {
    const used = new Set(PLACES.map((candidate) => zoneKeyOf(candidate)))
    const orphans = Object.keys(ZONES).filter((key) => !used.has(key))
    expect(orphans).toEqual([])
  })

  it('ranks Cyprus above the Baltic for these months, and Samui below Crete', () => {
    expect(autumnScore(place('limassol'))).toBeGreaterThan(autumnScore(place('sopot')))
    expect(autumnScore(place('chania'))).toBeGreaterThan(autumnScore(place('koh-samui')))
  })

  it('prices the off season below the annual lease around the Mediterranean', () => {
    expect(ZONES.crete.offSeasonRent).toBeLessThan(1)
    expect(ZONES.malta.offSeasonRent).toBeLessThan(1)
    // …and above it where these months are the high season.
    expect(ZONES.canaries.offSeasonRent).toBeGreaterThan(1)
    expect(ZONES.gulf.offSeasonRent).toBeGreaterThan(1)
  })
})

describe('street-level stays', () => {
  it('exist for every town in the shortlisted countries', () => {
    const shortlisted = PLACES.filter((candidate) => DETAILED_COUNTRIES.includes(candidate.country))
    const missing = shortlisted.filter((candidate) => staysFor(candidate.id).length === 0)
    expect(missing.map((candidate) => candidate.id)).toEqual([])
  })

  it('answer every question, concretely', () => {
    for (const [id, options] of Object.entries(STAYS)) {
      for (const option of options ?? []) {
        // A neighbourhood name is legitimately short; an answer is not.
        expect(option.name.length, `${id}.name`).toBeGreaterThan(4)
        for (const [field, value] of Object.entries(option)) {
          if (field === 'name') continue
          expect(value.length, `${id}.${field}`).toBeGreaterThan(20)
        }
      }
    }
  })

  it('name a place that exists', () => {
    const ids = new Set(PLACES.map((candidate) => candidate.id))
    expect(Object.keys(STAYS).filter((id) => !ids.has(id))).toEqual([])
  })
})
