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

/** Our own origin, used as the second attempt if the browser cannot reach Wikipedia. */
export function proxyUrl(id: PlaceId): string {
  return `/api/place-photo/${encodeURIComponent(id)}`
}

/**
 * One request for fifty photographs.
 *
 * The MediaWiki API takes up to fifty titles at a time and `origin=*` makes it
 * answer anonymous cross-origin requests, so the whole page's photographs cost
 * two requests from the browser rather than ninety from the server. Doing it in
 * the browser also removes the one thing that cannot be tested from here —
 * whether the deployment itself is allowed to call out.
 */
export const TITLES_PER_REQUEST = 50

export function thumbnailsEndpoint(titles: string[], size = 800): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(size),
    redirects: '1',
    origin: '*',
    titles: titles.join('|'),
  })
  return `https://en.wikipedia.org/w/api.php?${params.toString()}`
}

export type ThumbnailResponse = {
  query?: {
    pages?: { title?: string; thumbnail?: { source?: string } }[]
    redirects?: { from?: string; to?: string }[]
    normalized?: { from?: string; to?: string }[]
  }
}

/**
 * Map the answer back onto our place ids.
 *
 * Wikipedia normalises and redirects titles — ask for "Rhodes (city)" and the
 * page comes back under a different name — so the mapping has to be followed
 * rather than assumed.
 */
export function thumbnailsById(
  response: ThumbnailResponse,
  asked: Record<string, PlaceId>,
): Record<PlaceId, string> {
  const trail = new Map<string, string>()
  for (const hop of [...(response.query?.normalized ?? []), ...(response.query?.redirects ?? [])]) {
    if (hop.from && hop.to) trail.set(hop.to, hop.from)
  }

  const found: Record<PlaceId, string> = {}
  for (const page of response.query?.pages ?? []) {
    const source = page.thumbnail?.source
    if (!page.title || !source) continue
    // Walk back through any redirects to the title we actually asked for.
    let title: string | undefined = page.title
    const seen = new Set<string>()
    while (title && !asked[title] && !seen.has(title)) {
      seen.add(title)
      title = trail.get(title)
    }
    const id = title ? asked[title] : undefined
    if (id) found[id] = source
  }
  return found
}
