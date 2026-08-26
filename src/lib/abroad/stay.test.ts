import { describe, expect, it } from 'vitest'
import { CANDIDATES } from './countries'
import { costsFor, totalOf } from './costs'
import { DEFAULT_PRIORITIES, weightsFrom } from './priorities'
import { PLACES } from './places'
import {
  ENTRY,
  FLIGHT_HOME,
  IRRELEVANT_ON_A_TEST_RUN,
  SHORT_LET,
  costsForStay,
  monthlyForStay,
  shortLetFactor,
  weightsForStay,
} from './stay'

const place = (id: string) => {
  const found = PLACES.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no place ${id}`)
  return found
}

describe('a test run', () => {
  it('costs more per month than a lease, everywhere', () => {
    for (const candidate of PLACES) {
      expect(monthlyForStay(candidate, 'test'), candidate.id).toBeGreaterThan(
        monthlyForStay(candidate, 'move'),
      )
    }
  })

  it('marks up the rent and flattens health cover to travel insurance', () => {
    const chania = place('chania')
    const lease = costsFor(chania)
    const trip = costsForStay(chania, 'test')
    expect(trip.rent).toBeGreaterThan(lease.rent)
    expect(trip.health).toBe(45)
    expect(trip.groceries).toBe(lease.groceries)
  })

  it('charges a season premium where the town lives off a summer', () => {
    expect(shortLetFactor(place('protaras'))).toBeGreaterThan(shortLetFactor(place('nicosia')))
  })

  it('leaves a twelve-month plan priced as a lease', () => {
    const chania = place('chania')
    expect(costsForStay(chania, 'move')).toEqual(costsFor(chania))
    expect(monthlyForStay(chania, 'move')).toBe(totalOf(costsFor(chania)))
  })

  it('takes tax and paperwork out of the ranking, and nothing else', () => {
    const base = weightsFrom(DEFAULT_PRIORITIES)
    const trip = weightsForStay(base, 'test')
    for (const key of IRRELEVANT_ON_A_TEST_RUN) expect(trip[key]).toBe(0)
    expect(trip.beach).toBe(base.beach)
    expect(weightsForStay(base, 'move')).toBe(base)
  })
})

describe('the country tables', () => {
  it('cover every candidate', () => {
    for (const candidate of CANDIDATES) {
      expect(SHORT_LET[candidate.slug], candidate.slug).toBeGreaterThan(1)
      expect(FLIGHT_HOME[candidate.slug], candidate.slug).toBeGreaterThan(0)
      expect(ENTRY[candidate.slug], candidate.slug).toBeTruthy()
    }
  })

  it('says what both passports get you', () => {
    for (const candidate of CANDIDATES) {
      const entry = ENTRY[candidate.slug]
      expect(entry.polish.length, candidate.slug).toBeGreaterThan(10)
      expect(entry.israeli.length, candidate.slug).toBeGreaterThan(10)
    }
  })

  it('knows Poland cannot ask you to leave', () => {
    expect(ENTRY.poland.polish.toLowerCase()).toContain('citizen')
  })
})
