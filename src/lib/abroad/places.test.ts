import { describe, expect, it } from 'vitest'
import { CANDIDATES } from './countries'
import { monthlyOf } from './costs'
import {
  PLACES,
  costRange,
  filterPlaces,
  placesOf,
  sortPlaces,
  tierOf,
  type Place,
} from './places'

const SLUGS = new Set(CANDIDATES.map((candidate) => candidate.slug))

describe('the places dataset', () => {
  it('gives every country at least three towns', () => {
    for (const candidate of CANDIDATES) {
      expect(placesOf(candidate.slug).length, candidate.slug).toBeGreaterThanOrEqual(3)
    }
  })

  it('never references a country that does not exist', () => {
    const orphans = PLACES.filter((place) => !SLUGS.has(place.country)).map((place) => place.id)
    expect(orphans).toEqual([])
  })

  it('uses unique ids', () => {
    expect(new Set(PLACES.map((place) => place.id)).size).toBe(PLACES.length)
  })

  it('answers every question for every town', () => {
    // "Fibre." is a complete answer to the internet question; a blank is not.
    const unanswered = PLACES.filter((place) =>
      [place.rent, place.beach, place.train, place.food, place.net, place.town, place.catch].some(
        (field) => field.trim().length === 0,
      ),
    ).map((place) => place.id)
    expect(unanswered).toEqual([])
  })

  it('says something substantial where a one-word answer would hide a gap', () => {
    // Rent, sea, training and the catch are the four that decide anything, and
    // "Nothing." on training has to say where the nearest mat actually is.
    const thin = PLACES.filter((place) =>
      [place.rent, place.beach, place.train, place.town, place.catch].some(
        (field) => field.trim().length < 20,
      ),
    ).map((place) => place.id)
    expect(thin).toEqual([])
  })

  it('keeps fit and cost inside believable bounds', () => {
    for (const place of PLACES) {
      expect(place.fit, place.id).toBeGreaterThanOrEqual(1)
      expect(place.fit, place.id).toBeLessThanOrEqual(5)
      expect(monthlyOf(place), place.id).toBeGreaterThan(500)
      expect(monthlyOf(place), place.id).toBeLessThan(10000)
    }
  })

  it('keeps the headline spots of a country as real towns of that country', () => {
    // The country card names a few spots; they should not drift from the towns.
    for (const candidate of CANDIDATES) {
      expect(placesOf(candidate.slug).length, candidate.slug).toBeGreaterThanOrEqual(
        Math.min(3, candidate.spots.length),
      )
    }
  })
})

describe('tierOf', () => {
  it('puts a cost in the first band it fits', () => {
    expect(tierOf(900)).toBe('lean')
    expect(tierOf(1500)).toBe('lean')
    expect(tierOf(1501)).toBe('mid')
    expect(tierOf(2200)).toBe('mid')
    expect(tierOf(2900)).toBe('high')
    expect(tierOf(4200)).toBe('top')
  })
})

const sample: Place[] = [
  {
    id: 'a',
    country: 'greece',
    name: 'Alpha',
    where: 'North',
    fit: 5,
    rent: 'a house on the hill',
    house: 'normal',
    beach: 'sand, ten minutes',
    train: 'a real mat with a schedule',
    mma: true,
    food: 'a market every day',
    net: 'fibre in the town',
    town: 'hospital and an airport',
    catch: 'it rains in January',
  },
  {
    id: 'b',
    country: 'spain',
    name: 'Beta',
    where: 'South',
    fit: 3,
    rent: 'flats only, and dear',
    house: 'rare',
    beach: 'rock swimming, all year',
    train: 'gyms but no mat at all',
    mma: false,
    food: 'supermarkets and little else',
    net: 'fibre everywhere here',
    town: 'a clinic, no airport',
    catch: 'it empties in November',
  },
]

// The two synthetic towns cost whatever their country's everyday profile costs,
// since neither is in the rent table — so the ceiling is derived, not guessed.
const [cheap, dear] = sample.map(monthlyOf).sort((a, b) => a - b)

describe('filterPlaces', () => {
  it('applies the budget ceiling', () => {
    expect(cheap).toBeLessThan(dear)
    expect(filterPlaces(sample, { budget: cheap }).map((p) => p.id)).toEqual(['a'])
    expect(filterPlaces(sample, { budget: dear })).toHaveLength(2)
  })

  it('drops towns without a mat when a mat is required', () => {
    expect(filterPlaces(sample, { mmaOnly: true }).map((p) => p.id)).toEqual(['a'])
  })

  it('treats "possible" as not a house', () => {
    expect(filterPlaces(sample, { houseOnly: true }).map((p) => p.id)).toEqual(['a'])
  })

  it('keeps only the chosen countries, and all of them when none are chosen', () => {
    expect(filterPlaces(sample, { countries: ['spain'] }).map((p) => p.id)).toEqual(['b'])
    expect(filterPlaces(sample, { countries: [] })).toHaveLength(2)
  })

  it('searches the prose, not just the name', () => {
    expect(filterPlaces(sample, { query: 'November' }).map((p) => p.id)).toEqual(['b'])
    expect(filterPlaces(sample, { query: 'ROCK' }).map((p) => p.id)).toEqual(['b'])
  })

  it('combines filters', () => {
    expect(filterPlaces(sample, { budget: cheap, mmaOnly: true, query: 'rains' })).toHaveLength(1)
    expect(filterPlaces(sample, { budget: cheap, countries: ['spain'] })).toHaveLength(0)
  })
})

describe('sortPlaces', () => {
  it('orders by fit, then by cost', () => {
    expect(sortPlaces(sample, 'fit').map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('orders by cost', () => {
    expect(sortPlaces(sample, 'cost').map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const before = sample.map((p) => p.id)
    sortPlaces(sample, 'name')
    expect(sample.map((p) => p.id)).toEqual(before)
  })
})

describe('costRange', () => {
  it('spans the towns given', () => {
    expect(costRange(sample)).toEqual({ low: cheap, high: dear })
  })

  it('has nothing to say about nowhere', () => {
    expect(costRange([])).toBeNull()
  })
})
