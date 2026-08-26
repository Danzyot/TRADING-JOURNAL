import { describe, expect, it } from 'vitest'
import { CANDIDATES } from './countries'
import {
  CATEGORIES,
  EVERYDAY,
  HOME_TOTAL,
  RENT,
  costsFor,
  countryCosts,
  monthlyOf,
  totalOf,
} from './costs'
import { PLACES } from './places'

describe('the cost model', () => {
  it('prices every town', () => {
    const missing = PLACES.filter((place) => !RENT[place.id]).map((place) => place.id)
    expect(missing).toEqual([])
  })

  it('has an everyday profile for every country', () => {
    for (const candidate of CANDIDATES) {
      expect(EVERYDAY[candidate.slug], candidate.slug).toBeTruthy()
    }
  })

  it('makes the total the sum of the lines, never a separate number', () => {
    for (const place of PLACES) {
      expect(monthlyOf(place), place.id).toBe(totalOf(costsFor(place)))
    }
  })

  it('fills every category for every town', () => {
    for (const place of PLACES) {
      const lines = costsFor(place)
      for (const category of CATEGORIES) {
        expect(lines[category.key], `${place.id}.${category.key}`).toBeGreaterThan(0)
      }
    }
  })

  it('puts Tel Aviv above most of the list and below the dearest', () => {
    const totals = PLACES.map(monthlyOf)
    expect(Math.min(...totals)).toBeLessThan(HOME_TOTAL)
    expect(Math.max(...totals)).toBeGreaterThan(HOME_TOTAL)
  })

  it('costs a country from its own towns', () => {
    const greece = countryCosts('greece', PLACES)
    expect(greece).not.toBeNull()
    expect(greece!.rentLow).toBeLessThan(greece!.rentHigh)
    expect(greece!.total).toBe(totalOf(greece!.lines))
  })

  it('has nothing to say about a country with no towns', () => {
    expect(countryCosts('atlantis', PLACES)).toBeNull()
  })
})
