/**
 * A real photograph of each place.
 *
 * These cannot be committed: there are eighty-six of them, each with its own
 * licence, and a hardcoded image URL is a broken image within a year. So the
 * app asks Wikipedia for the town's lead photograph at request time, through
 * our own /api/place-photo route, and caches it.
 *
 * What is stored here is only the article title, which is far more stable than
 * any file path. If the fetch fails — offline, article moved, no lead image —
 * the card falls back to the drawn scene, so a place can never render as a
 * broken image.
 *
 * A committed file in public/places/ still beats both; see PHOTOS in
 * ./scenery.ts.
 */
import type { PlaceId } from './places'

export const WIKI_TITLE: Record<PlaceId, string> = {
  chania: 'Chania',
  rethymno: 'Rethymno',
  heraklion: 'Heraklion',
  'athens-riviera': 'Glyfada',
  kalamata: 'Kalamata',
  rhodes: 'Rhodes (city)',
  thessaloniki: 'Thessaloniki',
  corfu: 'Corfu (city)',
  limassol: 'Limassol',
  paphos: 'Paphos',
  larnaca: 'Larnaca',
  protaras: 'Protaras',
  nicosia: 'Nicosia',
  valencia: 'Valencia',
  malaga: 'Málaga',
  alicante: 'Alicante',
  marbella: 'Marbella',
  palma: 'Palma de Mallorca',
  'las-palmas': 'Las Palmas de Gran Canaria',
  'costa-adeje': 'Adeje',
  cascais: 'Cascais',
  carcavelos: 'Carcavelos',
  'lagos-pt': 'Lagos, Portugal',
  portimao: 'Portimão',
  ericeira: 'Ericeira',
  funchal: 'Funchal',
  'aci-castello': 'Aci Castello',
  mondello: 'Mondello',
  monopoli: 'Monopoli',
  lecce: 'Lecce',
  cagliari: 'Cagliari',
  sanremo: 'Sanremo',
  sliema: 'Sliema',
  gzira: 'Gżira',
  mellieha: 'Mellieħa',
  gozo: 'Gozo',
  split: 'Split, Croatia',
  zadar: 'Zadar',
  sibenik: 'Šibenik',
  opatija: 'Opatija',
  dubrovnik: 'Dubrovnik',
  budva: 'Budva',
  tivat: 'Tivat',
  'herceg-novi': 'Herceg Novi',
  bar: 'Bar, Montenegro',
  vlore: 'Vlorë',
  sarande: 'Sarandë',
  golem: 'Durrës',
  himare: 'Himarë',
  varna: 'Varna, Bulgaria',
  burgas: 'Burgas',
  sozopol: 'Sozopol',
  sofia: 'Sofia',
  sopot: 'Sopot',
  gdynia: 'Gdynia',
  krakow: 'Kraków',
  warsaw: 'Warsaw',
  batumi: 'Batumi',
  tbilisi: 'Tbilisi',
  kobuleti: 'Kobuleti',
  jbr: 'Dubai Marina',
  'dubai-hills': 'Dubai',
  saadiyat: 'Saadiyat Island',
  rawai: 'Rawai',
  bangtao: 'Bang Tao',
  'koh-samui': 'Ko Samui',
  'chiang-mai': 'Chiang Mai',
  'ao-nang': 'Ao Nang',
  tamarindo: 'Tamarindo, Costa Rica',
  'santa-teresa': 'Santa Teresa, Puntarenas',
  jaco: 'Jacó, Costa Rica',
  'playas-del-coco': 'Playas del Coco',
  uvita: 'Uvita',
  'playa-del-carmen': 'Playa del Carmen',
  tulum: 'Tulum',
  'puerto-escondido': 'Puerto Escondido, Oaxaca',
  'puerto-vallarta': 'Puerto Vallarta',
  merida: 'Mérida, Yucatán',
  'panama-city': 'Panama City',
  coronado: 'Coronado, Panama',
  bocas: 'Bocas del Toro',
  pedasi: 'Pedasí',
  'fort-lauderdale': 'Fort Lauderdale, Florida',
  'st-petersburg': 'St. Petersburg, Florida',
  'san-diego': 'San Diego',
  austin: 'Austin, Texas',
}

/** Where the page asks for the photograph. Our own origin, so no CSP change. */
export function photoUrl(id: PlaceId): string {
  return `/api/place-photo/${encodeURIComponent(id)}`
}
