/**
 * What a month actually costs, line by line.
 *
 * A single "€1,900 a month" hides the decision. Two towns at the same total can
 * be a cheap flat with expensive everything, or a dear flat in a country where
 * food and training cost nothing — and only one of those survives a bad quarter.
 * So the total is built, never asserted: rent is per town, everything else is a
 * per-country profile, and a handful of towns carry a local multiplier because
 * Athens Riviera is not Kalamata even inside the same country.
 *
 * All figures are euros per month for one person living comfortably: eating
 * well, training properly, running a car or a scooter, insured. Not a backpacker
 * budget and not a family budget, and not compared to anything — living at home
 * with your parents costs nothing, so there is no baseline worth measuring
 * against. These numbers are for ordering towns against each other. They are honest estimates from 2026 published
 * cost-of-living data, and they are for ordering towns — not for a spreadsheet.
 */
import type { Place, PlaceId } from './places'

export type CategoryKey =
  | 'rent'
  | 'utilities'
  | 'internet'
  | 'groceries'
  | 'eatingOut'
  | 'transport'
  | 'training'
  | 'health'
  | 'everyday'

export type Category = { key: CategoryKey; label: string; meaning: string }

export const CATEGORIES: Category[] = [
  { key: 'rent', label: 'Rent', meaning: 'A good one or two bed, or the low end of a house, long term.' },
  { key: 'utilities', label: 'Power and water', meaning: 'Electricity, water, heating or air conditioning, averaged over the year.' },
  { key: 'internet', label: 'Internet and phone', meaning: 'Fibre you can trade on, plus a mobile plan as the fallback.' },
  { key: 'groceries', label: 'Groceries', meaning: 'Cooking most meals, buying good meat, fish and produce.' },
  { key: 'eatingOut', label: 'Eating out', meaning: 'Roughly a meal out every other day, plus coffee.' },
  { key: 'transport', label: 'Getting around', meaning: 'A run-around car or a scooter with fuel, or a transit pass where one works.' },
  { key: 'training', label: 'Gym and mats', meaning: 'A commercial gym plus an unlimited MMA or BJJ membership.' },
  { key: 'health', label: 'Health cover', meaning: 'Private cover or the local contribution, for someone in their twenties.' },
  { key: 'everyday', label: 'Everyday', meaning: 'Household, laundry, haircuts, going out, the things nobody budgets for.' },
]

export type Everyday = Omit<Record<CategoryKey, number>, 'rent'>
export type CostLines = Record<CategoryKey, number>

/**
 * Everything except rent, by country.
 *
 * Health is the line that moves most between countries and the one people
 * forget: it is €55 in Greece and €380 in the United States, and that gap alone
 * is most of the difference between the two totals.
 */
export const EVERYDAY: Record<string, Everyday> = {
  greece: { utilities: 120, internet: 32, groceries: 300, eatingOut: 170, transport: 85, training: 65, health: 55, everyday: 110 },
  cyprus: { utilities: 160, internet: 35, groceries: 360, eatingOut: 200, transport: 110, training: 75, health: 85, everyday: 130 },
  spain: { utilities: 120, internet: 35, groceries: 330, eatingOut: 200, transport: 70, training: 60, health: 70, everyday: 125 },
  portugal: { utilities: 110, internet: 35, groceries: 320, eatingOut: 180, transport: 60, training: 55, health: 65, everyday: 115 },
  italy: { utilities: 140, internet: 32, groceries: 330, eatingOut: 190, transport: 80, training: 65, health: 60, everyday: 120 },
  malta: { utilities: 150, internet: 30, groceries: 380, eatingOut: 220, transport: 70, training: 85, health: 90, everyday: 140 },
  croatia: { utilities: 130, internet: 28, groceries: 300, eatingOut: 170, transport: 70, training: 55, health: 55, everyday: 105 },
  montenegro: { utilities: 110, internet: 25, groceries: 260, eatingOut: 140, transport: 60, training: 45, health: 60, everyday: 95 },
  albania: { utilities: 80, internet: 20, groceries: 210, eatingOut: 110, transport: 45, training: 35, health: 45, everyday: 75 },
  bulgaria: { utilities: 100, internet: 15, groceries: 230, eatingOut: 120, transport: 45, training: 40, health: 45, everyday: 80 },
  poland: { utilities: 120, internet: 18, groceries: 270, eatingOut: 150, transport: 50, training: 50, health: 50, everyday: 95 },
  georgia: { utilities: 85, internet: 15, groceries: 200, eatingOut: 110, transport: 40, training: 35, health: 45, everyday: 70 },
  uae: { utilities: 260, internet: 70, groceries: 480, eatingOut: 320, transport: 150, training: 140, health: 180, everyday: 220 },
  thailand: { utilities: 110, internet: 20, groceries: 240, eatingOut: 150, transport: 50, training: 70, health: 70, everyday: 100 },
  'costa-rica': { utilities: 130, internet: 50, groceries: 380, eatingOut: 210, transport: 110, training: 70, health: 90, everyday: 130 },
  mexico: { utilities: 90, internet: 35, groceries: 280, eatingOut: 150, transport: 70, training: 55, health: 70, everyday: 100 },
  panama: { utilities: 130, internet: 45, groceries: 340, eatingOut: 190, transport: 90, training: 60, health: 90, everyday: 115 },
  usa: { utilities: 180, internet: 70, groceries: 470, eatingOut: 330, transport: 160, training: 130, health: 380, everyday: 200 },
}

/** A good one-or-two-bed, or the low end of a whole house, long term. */
export const RENT: Record<PlaceId, number> = {
  chania: 1000, rethymno: 850, heraklion: 900, 'athens-riviera': 1600, kalamata: 800,
  rhodes: 900, thessaloniki: 700, corfu: 900,
  limassol: 1600, paphos: 1000, larnaca: 950, protaras: 900, nicosia: 800,
  valencia: 1200, malaga: 1350, alicante: 1000, marbella: 2000, palma: 1500,
  'las-palmas': 1050, 'costa-adeje': 1150,
  cascais: 1700, carcavelos: 1300, 'lagos-pt': 1150, portimao: 900, ericeira: 1200, funchal: 950,
  'aci-castello': 850, mondello: 850, monopoli: 900, lecce: 750, cagliari: 900, sanremo: 1200,
  sliema: 1600, gzira: 1150, mellieha: 1150, gozo: 900,
  split: 1000, zadar: 800, sibenik: 700, opatija: 800, dubrovnik: 1200,
  budva: 700, tivat: 950, 'herceg-novi': 600, bar: 450,
  vlore: 450, sarande: 480, golem: 400, himare: 520,
  varna: 550, burgas: 450, sozopol: 480, sofia: 700,
  sopot: 800, gdynia: 700, krakow: 700, warsaw: 950,
  batumi: 500, tbilisi: 600, kobuleti: 320,
  jbr: 2400, 'dubai-hills': 2000, saadiyat: 1900,
  rawai: 800, bangtao: 1250, 'koh-samui': 800, 'chiang-mai': 500, 'ao-nang': 550,
  tamarindo: 1100, 'santa-teresa': 1050, jaco: 750, 'playas-del-coco': 750, uvita: 700,
  'playa-del-carmen': 950, tulum: 1150, 'puerto-escondido': 600, 'puerto-vallarta': 850, merida: 600,
  'panama-city': 1300, coronado: 800, bocas: 700, pedasi: 600,
  'fort-lauderdale': 2400, 'st-petersburg': 1900, 'san-diego': 2600, austin: 1900,
}

/**
 * Towns where everyday life costs more or less than the country average.
 *
 * A capital's riviera, a resort island, a village. Only the towns where the
 * country figure would be misleading are listed; everywhere else is 1.
 */
export const LOCAL: Partial<Record<PlaceId, number>> = {
  'athens-riviera': 1.15,
  marbella: 1.2,
  palma: 1.1,
  cascais: 1.15,
  sanremo: 1.15,
  gozo: 0.9,
  dubrovnik: 1.2,
  tivat: 1.15,
  warsaw: 1.1,
  saadiyat: 0.95,
  bangtao: 1.1,
  'chiang-mai': 0.85,
  'ao-nang': 0.9,
  tamarindo: 1.05,
  'playas-del-coco': 0.95,
  uvita: 0.92,
  tulum: 1.15,
  'puerto-escondido': 0.92,
  merida: 0.92,
  coronado: 0.92,
  bocas: 0.95,
  pedasi: 0.85,
  'fort-lauderdale': 1.05,
  'st-petersburg': 0.95,
  'san-diego': 1.1,
  austin: 0.95,
}

const EVERYDAY_KEYS = CATEGORIES.filter((category) => category.key !== 'rent').map(
  (category) => category.key,
) as (keyof Everyday)[]

export function costsFor(place: Place): CostLines {
  const base = EVERYDAY[place.country]
  const index = LOCAL[place.id] ?? 1
  const lines = { rent: RENT[place.id] ?? 0 } as CostLines
  for (const key of EVERYDAY_KEYS) {
    lines[key] = Math.round(((base?.[key] ?? 0) * index) / 5) * 5
  }
  return lines
}

export function totalOf(lines: CostLines): number {
  return CATEGORIES.reduce((sum, category) => sum + lines[category.key], 0)
}

export function monthlyOf(place: Place): number {
  return totalOf(costsFor(place))
}

/**
 * A country's own line-by-line month, using its cheapest and dearest towns for
 * the rent range and its everyday profile for the rest.
 */
export function countryCosts(slug: string, places: Place[]): {
  lines: CostLines
  rentLow: number
  rentHigh: number
  total: number
} | null {
  const own = places.filter((place) => place.country === slug)
  if (own.length === 0) return null
  const rents = own.map((place) => RENT[place.id] ?? 0)
  const rentLow = Math.min(...rents)
  const rentHigh = Math.max(...rents)
  const median = [...rents].sort((a, b) => a - b)[Math.floor(rents.length / 2)]
  const base = EVERYDAY[slug]
  const lines = { rent: median } as CostLines
  for (const key of EVERYDAY_KEYS) lines[key] = base?.[key] ?? 0
  return { lines, rentLow, rentHigh, total: totalOf(lines) }
}
