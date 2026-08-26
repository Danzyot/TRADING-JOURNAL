/**
 * A picture of each place, built from what we know about it.
 *
 * Ninety-one photographs is ninety-one licences and ninety-one broken links a
 * year from now, so the pictures are drawn rather than fetched: the terrain,
 * the kind of house you would rent, the shore you would swim off and the room
 * you would train in, all derived from the entry's own fields. A drawing that
 * says "steep mountain coast, stone house, pebble shore, no mat" carries more
 * of the decision than a stock photograph of a sunset does.
 *
 * Where a real photograph exists it wins — see PHOTOS below. The generated
 * scene is the floor, not the ceiling.
 */
import type { Place, PlaceId } from './places'

export type Terrain =
  | 'harbour'
  | 'sand'
  | 'cliff'
  | 'city'
  | 'island'
  | 'mountain'
  | 'inland'
  | 'tropical'
  | 'desert'
  | 'baltic'

export type HouseKind = 'villa' | 'stone' | 'tower' | 'townhouse' | 'wooden'
export type ShoreKind = 'sand' | 'pebble' | 'rock' | 'none'
export type PaletteKey = 'med' | 'atlantic' | 'tropical' | 'cold' | 'desert'

export type Palette = {
  sky: [string, string]
  sea: string
  seaDeep: string
  land: string
  rock: string
  wall: string
  roof: string
  veg: string
  sun: string
}

export const PALETTES: Record<PaletteKey, Palette> = {
  med: {
    sky: ['#8ecae6', '#e9f5fb'],
    sea: '#2a7fa8',
    seaDeep: '#1c5c7d',
    land: '#c9b489',
    rock: '#a89574',
    wall: '#f5efe3',
    roof: '#c1613f',
    veg: '#6d8f4e',
    sun: '#ffd166',
  },
  atlantic: {
    sky: ['#9fc3dd', '#eef3f7'],
    sea: '#2c6d92',
    seaDeep: '#1e4d69',
    land: '#b9b092',
    rock: '#8e8b7d',
    wall: '#f2eee7',
    roof: '#b8593d',
    veg: '#5c7f52',
    sun: '#f7d9a0',
  },
  tropical: {
    sky: ['#a8e0e4', '#eefaf8'],
    sea: '#1f9b96',
    seaDeep: '#13706d',
    land: '#f0dfbe',
    rock: '#9ba86f',
    wall: '#fbf6ec',
    roof: '#7c8f4a',
    veg: '#2f7d4a',
    sun: '#ffd98a',
  },
  cold: {
    sky: ['#b8c9d6', '#eef1f4'],
    sea: '#5f7d92',
    seaDeep: '#42596b',
    land: '#a9ae98',
    rock: '#8a8f83',
    wall: '#e9e5de',
    roof: '#7c5a4c',
    veg: '#4e6b4c',
    sun: '#e8e2c9',
  },
  desert: {
    sky: ['#e8cfa6', '#faf1e2'],
    sea: '#3a9fb5',
    seaDeep: '#2a7a8c',
    land: '#e0c79a',
    rock: '#c3a87d',
    wall: '#f4ecdd',
    roof: '#d0a86f',
    veg: '#7f9a5c',
    sun: '#ffcb70',
  },
}

const PALETTE_BY_COUNTRY: Record<string, PaletteKey> = {
  greece: 'med',
  cyprus: 'med',
  spain: 'med',
  portugal: 'atlantic',
  italy: 'med',
  malta: 'med',
  croatia: 'med',
  montenegro: 'med',
  albania: 'med',
  bulgaria: 'cold',
  poland: 'cold',
  turkey: 'med',
  georgia: 'cold',
  uae: 'desert',
  thailand: 'tropical',
  'costa-rica': 'tropical',
  mexico: 'tropical',
  panama: 'tropical',
  usa: 'atlantic',
}

const TERRAIN_BY_COUNTRY: Record<string, Terrain> = {
  greece: 'harbour',
  cyprus: 'sand',
  spain: 'city',
  portugal: 'cliff',
  italy: 'harbour',
  malta: 'cliff',
  croatia: 'harbour',
  montenegro: 'mountain',
  albania: 'mountain',
  bulgaria: 'sand',
  poland: 'baltic',
  turkey: 'sand',
  georgia: 'city',
  uae: 'desert',
  thailand: 'tropical',
  'costa-rica': 'tropical',
  mexico: 'tropical',
  panama: 'tropical',
  usa: 'city',
}

/**
 * Where the country default gets the place wrong.
 *
 * Athens is not a fishing harbour, Gozo is not a city, and Chiang Mai has no
 * sea at all — the overrides are the towns whose picture would otherwise lie.
 */
const TERRAIN: Partial<Record<PlaceId, Terrain>> = {
  'athens-riviera': 'city',
  heraklion: 'city',
  thessaloniki: 'city',
  corfu: 'island',
  rhodes: 'harbour',
  kalamata: 'mountain',
  nicosia: 'inland',
  larnaca: 'city',
  protaras: 'cliff',
  'las-palmas': 'island',
  'costa-adeje': 'island',
  marbella: 'mountain',
  palma: 'harbour',
  alicante: 'city',
  cascais: 'cliff',
  carcavelos: 'sand',
  ericeira: 'cliff',
  funchal: 'island',
  portimao: 'cliff',
  'lagos-pt': 'cliff',
  monopoli: 'cliff',
  lecce: 'inland',
  cagliari: 'city',
  sanremo: 'mountain',
  mondello: 'sand',
  'aci-castello': 'mountain',
  sliema: 'city',
  gzira: 'city',
  mellieha: 'sand',
  gozo: 'cliff',
  split: 'city',
  sibenik: 'harbour',
  opatija: 'mountain',
  dubrovnik: 'cliff',
  bar: 'harbour',
  golem: 'sand',
  sofia: 'inland',
  krakow: 'inland',
  warsaw: 'inland',
  cesme: 'harbour',
  bodrum: 'harbour',
  fethiye: 'mountain',
  konyaalti: 'mountain',
  alanya: 'city',
  tbilisi: 'inland',
  kobuleti: 'sand',
  batumi: 'city',
  'chiang-mai': 'inland',
  'ao-nang': 'cliff',
  merida: 'inland',
  'puerto-vallarta': 'mountain',
  'panama-city': 'city',
  bocas: 'island',
  pedasi: 'sand',
  austin: 'inland',
  'san-diego': 'city',
  'st-petersburg': 'sand',
  'fort-lauderdale': 'city',
  'dubai-hills': 'desert',
  saadiyat: 'sand',
}

/**
 * What you would actually be renting.
 *
 * Follows the entry's own `house` field first — a town where whole houses are
 * rare draws a tower, because that is what is on offer — then the terrain, so
 * a stone house in Corfu does not come out as a Florida townhouse.
 */
export function houseFor(place: Place, terrain: Terrain): HouseKind {
  if (place.house === 'rare') return 'tower'
  if (terrain === 'tropical' || terrain === 'island') {
    return place.house === 'normal' ? 'wooden' : 'townhouse'
  }
  if (terrain === 'mountain' || terrain === 'harbour' || terrain === 'cliff') return 'stone'
  if (terrain === 'desert' || terrain === 'city') return 'townhouse'
  if (place.house === 'normal') return 'villa'
  return 'townhouse'
}

/**
 * What you would be standing on at the water.
 *
 * Read off the entry's own sentence about the sea, because that sentence was
 * written to be specific: "pebble", "rock", "lidos and ladders", "None".
 */
export function shoreFor(place: Place): ShoreKind {
  const text = place.beach.toLowerCase()
  if (/^(none|not really|no real|not in the city)/.test(text.trim())) return 'none'
  if (text.includes('no sea') || text.startsWith('none')) return 'none'
  if (/pebble|shingle/.test(text)) return 'pebble'
  if (/rock|lido|ladder|platform|cove|volcanic|limestone|cliff/.test(text)) return 'rock'
  return 'sand'
}

/** A stable pseudo-random seed, so a town's picture never changes between loads. */
export function seedOf(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

export type Scenery = {
  terrain: Terrain
  house: HouseKind
  shore: ShoreKind
  palette: Palette
  paletteKey: PaletteKey
  seed: number
  /** A committed photograph, when one exists, which beats anything drawn. */
  photo?: string
}

/**
 * Real photographs, once they are committed.
 *
 * Same arrangement as the firm logos: drop a file in public/places/ and add the
 * line here. An entry that is not in this map draws its scene instead, so a
 * missing file can never render as a broken image.
 */
export const PHOTOS: Partial<Record<PlaceId, string>> = {}

/** Exported so a typo in an override cannot silently fall back to the default. */
export const TERRAIN_OVERRIDES = TERRAIN

export function sceneryFor(place: Place): Scenery {
  const terrain = TERRAIN[place.id] ?? TERRAIN_BY_COUNTRY[place.country] ?? 'harbour'
  const paletteKey = PALETTE_BY_COUNTRY[place.country] ?? 'med'
  return {
    terrain,
    house: houseFor(place, terrain),
    shore: shoreFor(place),
    palette: PALETTES[paletteKey],
    paletteKey,
    seed: seedOf(place.id),
    photo: PHOTOS[place.id],
  }
}
