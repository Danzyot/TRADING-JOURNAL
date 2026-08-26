import { describe, expect, it } from 'vitest'
import { MONTHS, ZONES, autumnFor, autumnScore, zoneKeyOf } from './autumn'
import { PLACES } from './places'
import { spotsFor, DETAILED_COUNTRIES, SPOTS } from './stays'

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

describe('the exact spots', () => {
  it('exist for every town in the shortlisted countries', () => {
    const shortlisted = PLACES.filter((candidate) => DETAILED_COUNTRIES.includes(candidate.country))
    const missing = shortlisted.filter((candidate) => spotsFor(candidate.id).length === 0)
    expect(missing.map((candidate) => candidate.id)).toEqual([])
  })

  it('answer the three distances and price a real range', () => {
    for (const [id, spots] of Object.entries(SPOTS)) {
      for (const spot of spots ?? []) {
        expect(spot.name.length, `${id}.name`).toBeGreaterThan(4)
        for (const field of ['what', 'mat', 'sea', 'shop', 'net', 'snag', 'area', 'gym'] as const) {
          expect(spot[field].length, `${id}.${field}`).toBeGreaterThan(5)
        }
        const [low, high] = spot.rent
        expect(low, `${id}.rent`).toBeGreaterThan(200)
        expect(high, `${id}.rent`).toBeGreaterThan(low)
      }
    }
  })

  it('give every spot a geocodable area, so the links resolve', () => {
    for (const [id, spots] of Object.entries(SPOTS)) {
      for (const spot of spots ?? []) {
        // "Neighbourhood, Town, Country" — two commas is the shape that works.
        expect(spot.area.split(',').length, `${id}.area`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('name a place that exists', () => {
    const ids = new Set(PLACES.map((candidate) => candidate.id))
    expect(Object.keys(SPOTS).filter((id) => !ids.has(id))).toEqual([])
  })
})
