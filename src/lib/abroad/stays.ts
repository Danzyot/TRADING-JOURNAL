/**
 * The exact spots, not the town.
 *
 * "Chania" is not an address. Halepa and Nerokourou are forty minutes of your
 * day and €400 a month apart, and no country-level research surfaces that.
 *
 * Everything here is built for scanning rather than reading: three numbers that
 * shape a day (to the mat, to the water, to a shop), a rent range for late
 * September to December, one line on what is wrong with the street, and links
 * out to the map, to listings for your actual dates, and to the gym.
 *
 * Written for the five countries on the shortlist — Malta, Italy, Spain, Greece
 * and Cyprus. Everywhere else keeps town-level detail on its own card.
 */
import type { PlaceId } from './places'

export type Spot = {
  name: string
  /** One line. What kind of home, and who lives there. */
  what: string
  /** Furnished, per month, late September to December. */
  rent: [low: number, high: number]
  /** Minutes, and how — the three distances that shape a day. */
  mat: string
  sea: string
  shop: string
  /** Fibre at this address, in a few words. */
  net: string
  /** The one thing wrong with this street. */
  snag: string
  /** Geocodable, for maps and listing searches. */
  area: string
  /** The gym you would actually train at, for a map search. */
  gym: string
  /** Its own site, where one verifiably exists. */
  gymUrl?: string
  /** A Wikipedia title for a photograph of this specific spot. */
  wiki?: string
}

export const SPOTS: Partial<Record<PlaceId, Spot[]>> = {
  // ── Malta ─────────────────────────────────────────────────────────────────
  sliema: [
    {
      name: 'Tigné Point / The Ferries',
      what: 'Furnished 2-beds in newer blocks facing the water, lift and air conditioning.',
      rent: [1100, 1500],
      mat: '10 min walk',
      sea: '2 min — rock ledges and ladders, no sand',
      shop: '5 min to two supermarkets',
      net: 'Gigabit, Melita or GO, universal here',
      snag: 'Seafront road is loud past midnight and Tigné is a permanent building site.',
      area: 'Tigné Point, Sliema, Malta',
      gym: 'Malta Fight Co Sliema',
      gymUrl: 'https://maltafightco.com/bjj/',
      wiki: 'Sliema',
    },
    {
      name: 'Fond Għadir / Għar id-Dud',
      what: 'Older townhouse conversions behind the front, high ceilings, no lift.',
      rent: [850, 1150],
      mat: '12 min walk',
      sea: '4 min to the ledges',
      shop: '5 min to everything',
      net: 'Fibre in the street; conversions may share a line',
      snag: 'Third-floor walk-ups are normal, and stone flats are 15°C indoors in December.',
      area: 'Għar id-Dud, Sliema, Malta',
      gym: 'Malta Fight Co Sliema',
      gymUrl: 'https://maltafightco.com/bjj/',
    },
  ],
  gzira: [
    {
      name: 'Gżira seafront',
      what: 'Modern 1- and 2-beds over Msida Creek — the cheapest address near Sliema.',
      rent: [750, 1000],
      mat: '15 min walk',
      sea: '12 min to the Sliema ledges',
      shop: '5 min to Lidl',
      net: 'Gigabit fibre throughout',
      snag: 'One of the worst traffic roads on the island, directly outside.',
      area: 'Gżira, Malta',
      gym: 'Malta Fight Co Sliema',
      gymUrl: 'https://maltafightco.com/bjj/',
      wiki: 'Gżira',
    },
  ],
  mellieha: [
    {
      name: 'Mellieħa town',
      what: '3-bed maisonettes with a roof terrace — a whole house, affordably, in Malta.',
      rent: [850, 1200],
      mat: '35–45 min drive — the whole objection',
      sea: '10 min downhill to Għadira sand',
      shop: '2 min to the square',
      net: 'Fibre in the town',
      snag: 'Everything is a hill, and the bus to Valletta takes 50 minutes.',
      area: 'Mellieħa, Malta',
      gym: 'Malta Fight Co Sliema',
      gymUrl: 'https://maltafightco.com/bjj/',
      wiki: 'Mellieħa',
    },
  ],
  gozo: [
    {
      name: 'Marsalforn & Xlendi',
      what: 'Converted farmhouses with a private pool and courtyard.',
      rent: [700, 1000],
      mat: 'Ferry + 45 min — every session',
      sea: '2 min to swim off rock; Ramla sand 15 min',
      shop: '10 min to Victoria',
      net: 'Fibre in both towns, not outlying farmhouses',
      snag: 'A third of Marsalforn open by December, and the last ferry shapes your evenings.',
      area: 'Marsalforn, Gozo, Malta',
      gym: 'Victoria Gozo gym',
      wiki: 'Marsalforn',
    },
  ],

  // ── Italy ─────────────────────────────────────────────────────────────────
  'aci-castello': [
    {
      name: 'Aci Trezza',
      what: 'Fishing-village flats above the harbour, most with a terrace.',
      rent: [550, 800],
      mat: '15 min drive to Catania',
      sea: '3 min — swim off lava rock',
      shop: '5 min to a Conad',
      net: 'FTTH on the coast road — insist on FTTH, not FTTC',
      snag: 'You need a car, and the village is quiet from November.',
      area: 'Aci Trezza, Catania, Italy',
      gym: 'Fundamental BJJ Catania',
      wiki: 'Aci Trezza',
    },
    {
      name: 'Catania — Corso Italia',
      what: 'Large flats in 20th-century blocks, the residential city rather than the tourist one.',
      rent: [600, 850],
      mat: '10–15 min walk to two academies',
      sea: '15 min to La Playa sand',
      shop: '5 min, and the fish market you came for',
      net: 'Best fibre in eastern Sicily',
      snag: 'A working port city — noisy, hard parking, Etna ash on the cars.',
      area: 'Corso Italia, Catania, Italy',
      gym: 'BJJ Catania Lavica Project',
      wiki: 'Catania',
    },
  ],
  mondello: [
    {
      name: 'Mondello — Valdesi',
      what: 'Villas and villa flats behind the bay, mostly summer houses let cheap off-season.',
      rent: [600, 900],
      mat: '20 min into Palermo',
      sea: '2 min to the best swimming bay in Sicily',
      shop: '5 min; the big ones are on the Palermo road',
      net: 'Fibre in built-up Mondello, not the back villas',
      snag: 'A summer suburb — very quiet by November.',
      area: 'Mondello, Palermo, Italy',
      gym: 'BJJ Palermo',
      wiki: 'Mondello',
    },
  ],
  monopoli: [
    {
      name: 'Monopoli centro storico',
      what: 'Restored stone flats inside the walls, thick walls, roof terraces.',
      rent: [650, 900],
      mat: '40 min drive or 45 min train to Bari',
      sea: '1 min — Cala Porta Vecchia is inside the old town',
      shop: '5 min outside the walls',
      net: 'FTTH in the centre',
      snag: 'No parking, and stone houses at 14°C on electric heating are expensive.',
      area: 'Centro Storico, Monopoli, Italy',
      gym: 'WCRA Bari',
      wiki: 'Monopoli',
    },
    {
      name: 'Polignano a Mare — the plateau',
      what: 'Newer flats above the cliffs with balconies and easy parking.',
      rent: [600, 850],
      mat: '35 min to Bari',
      sea: '5 min to Lama Monachile',
      shop: '5 min on foot',
      net: 'FTTH on the plateau',
      snag: 'A day-trip town that empties completely after October.',
      area: 'Polignano a Mare, Italy',
      gym: 'WCRA Bari',
      wiki: 'Polignano a Mare',
    },
  ],
  lecce: [
    {
      name: 'Lecce — Mazzini',
      what: 'Big student-city flats in the newer quarters.',
      rent: [450, 700],
      mat: 'University clubs only, no real MMA',
      sea: '20 min drive to San Cataldo, closed in winter',
      shop: 'Everything on foot',
      net: 'FTTH across the city',
      snag: 'It is 25 minutes from the sea — inland Salento defeats the point.',
      area: 'Lecce, Italy',
      gym: 'BJJ Lecce',
      wiki: 'Lecce',
    },
  ],
  cagliari: [
    {
      name: 'Poetto — Quartu end',
      what: 'Flats on the beach road, balconies over the water.',
      rent: [600, 900],
      mat: '15 min drive into the city',
      sea: 'Across the road — 8 km of sand to run',
      shop: '5 min on Viale Marconi',
      net: 'Fibre along the Poetto road',
      snag: 'The mistral makes the front cold from November and the kiosks shut.',
      area: 'Poetto, Cagliari, Italy',
      gym: 'CL Fight Team Cagliari',
      gymUrl: 'https://mmacagliari.it/',
      wiki: 'Poetto',
    },
    {
      name: 'Cagliari — Villanova',
      what: 'Old-city flats near the market and port, high ceilings, no lift.',
      rent: [550, 800],
      mat: '10 min walk',
      sea: '15 min by bus to Poetto',
      shop: '10 min to San Benedetto, Italy’s largest covered market',
      net: 'FTTH, 1 Gbps for €25–35',
      snag: 'Steep streets, and the same December heating problem.',
      area: 'Villanova, Cagliari, Italy',
      gym: 'Wolfpack Fighting Club Cagliari',
      gymUrl: 'https://www.wolfpackfightingclub.com/',
      wiki: 'Cagliari',
    },
  ],
  sanremo: [
    {
      name: 'Sanremo seafront',
      what: 'Flats along the Corso Imperatrice with a sea view.',
      rent: [700, 1100],
      mat: 'Club level only; Nice is an hour',
      sea: 'Across the road, pebble',
      shop: 'Everything in town',
      net: 'FTTH, reliable',
      snag: '12°C in December and grey — a northern winter with palm trees.',
      area: 'Sanremo, Italy',
      gym: 'Sanremo boxe',
      wiki: 'Sanremo',
    },
  ],

  // ── Spain ─────────────────────────────────────────────────────────────────
  valencia: [
    {
      name: 'Ruzafa',
      what: 'Restored 19th-century flats, high ceilings, in the neighbourhood everyone wants.',
      rent: [900, 1300],
      mat: '10 min walk or bike to two academies',
      sea: '20 min by bike down the Turia park',
      shop: 'Mercado de Ruzafa on the doorstep',
      net: 'Gigabit symmetric, €30, four providers',
      snag: 'It is the bar district — street noise past 02:00 Thursday to Sunday.',
      area: 'Ruzafa, Valencia, Spain',
      gym: 'Michal Adamczak BJJ Academy Valencia',
      wiki: 'Russafa',
    },
    {
      name: 'El Cabanyal / Patacona',
      what: 'Restored fisherman’s houses in the old maritime quarter, or newer flats in Patacona.',
      rent: [800, 1200],
      mat: '15 min by bike into the city',
      sea: '2–5 min on foot to wide sand',
      shop: 'Mercado del Cabanyal; Mercadona 5 min',
      net: 'Full FTTH',
      snag: 'Half restored, half not — the difference is one block. Walk it first.',
      area: 'El Cabanyal, Valencia, Spain',
      gym: 'S.H.O.O.T. MMA Valencia',
      wiki: 'El Cabanyal',
    },
  ],
  malaga: [
    {
      name: 'Málaga — Soho',
      what: 'Flats in the regenerated port quarter, walkable to everything.',
      rent: [1000, 1400],
      mat: '10 min to Rilion Gracie; 20 min train to Scramble',
      sea: '10 min walk to Malagueta',
      shop: '5 min to Atarazanas market',
      net: 'Full FTTH',
      snag: 'Priced for short lets — rent goes up for December, not down.',
      area: 'Soho, Málaga, Spain',
      gym: 'Rilion Gracie Málaga',
      wiki: 'Málaga',
    },
    {
      name: 'Torremolinos — La Carihuela',
      what: 'Old fishing-quarter flats and small townhouses on the promenade.',
      rent: [700, 1000],
      mat: '10 min walk to Scramble Academy',
      sea: 'On the promenade — 7 km to run',
      shop: '2 min along the front',
      net: 'Gigabit FTTH, €30',
      snag: 'The strip 400 m inland is package-holiday Britain.',
      area: 'La Carihuela, Torremolinos, Spain',
      gym: 'Scramble Academy Torremolinos',
      wiki: 'Torremolinos',
    },
  ],
  alicante: [
    {
      name: 'Playa de San Juan',
      what: 'Modern flats a street back from 7 km of sand, tram into the city.',
      rent: [700, 1000],
      mat: '15 min tram to Fightzone — 100+ classes a week',
      sea: '2–5 min on foot',
      shop: '5 min in the neighbourhood',
      net: 'Gigabit FTTH everywhere',
      snag: 'A summer suburb — quiet after 20:00 from November.',
      area: 'Playa de San Juan, Alicante, Spain',
      gym: 'Fightzone Costa Blanca',
      wiki: 'Playa de San Juan',
    },
    {
      name: 'Alicante — Mercado',
      what: 'City flats by the market with Postiguet beach at the end of the street.',
      rent: [650, 950],
      mat: '15 min tram to Fightzone',
      sea: '10 min walk to Postiguet',
      shop: '5 min to Mercado Central',
      net: 'Gigabit FTTH, €30',
      snag: 'Duller than Valencia at every hour that is not training.',
      area: 'Mercado Central, Alicante, Spain',
      gym: 'Climent Club Alicante',
      wiki: 'Alicante',
    },
  ],
  marbella: [
    {
      name: 'Nueva Andalucía',
      what: 'Flats in gated complexes with a pool and parking — the normal rental here.',
      rent: [1300, 1900],
      mat: '10–15 min drive',
      sea: '5–10 min; 16°C in January',
      shop: 'Everything, priced for the market',
      net: 'Gigabit FTTH',
      snag: 'Dearer than Valencia and Málaga, and you drive everywhere.',
      area: 'Nueva Andalucía, Marbella, Spain',
      gym: 'Patrick Bittan Academy Marbella',
      wiki: 'Marbella',
    },
  ],
  palma: [
    {
      name: 'Santa Catalina',
      what: 'The good Palma neighbourhood — market, bars, walkable.',
      rent: [900, 1300],
      mat: '10 min to SurUnion or BJJPalma',
      sea: '10 min by bus to Cala Major',
      shop: 'Mercat de Santa Catalina on the doorstep',
      net: 'Gigabit FTTH',
      snag: 'The island outside Palma closes from November.',
      area: 'Santa Catalina, Palma, Spain',
      gym: 'SurUnion BJJ Palma',
      wiki: 'Palma de Mallorca',
    },
  ],
  'las-palmas': [
    {
      name: 'Las Canteras — La Puntilla',
      what: 'Flats a street back from the beach, in a real city rather than a resort.',
      rent: [900, 1300],
      mat: '10 min to Team Romero',
      sea: '1–3 min — swimmable every month of the year',
      shop: '10 min to Mercado del Puerto',
      net: 'Gigabit; the Atlantic cables land here',
      snag: 'Your months are high season, so you pay more and it is busy.',
      area: 'Las Canteras, Las Palmas, Spain',
      gym: 'Team Romero BJJ Las Palmas',
      wiki: 'Las Canteras Beach',
    },
  ],
  'costa-adeje': [
    {
      name: 'La Caleta',
      what: 'A quiet village at the end of the Adeje strip, flats and townhouses.',
      rent: [900, 1300],
      mat: '70 min north to Santa Cruz for a real room',
      sea: '5 min — 22°C in December',
      shop: '5 min uphill in Adeje',
      net: 'Fibre through the strip',
      snag: 'A resort with residents attached, at peak-season prices.',
      area: 'La Caleta, Adeje, Tenerife, Spain',
      gym: 'BJJ Tenerife Sur',
      wiki: 'Adeje',
    },
  ],

  // ── Greece ────────────────────────────────────────────────────────────────
  chania: [
    {
      name: 'Halepa',
      what: 'Neoclassical houses and 1970s flats east of the old town, balconies, sea views.',
      rent: [500, 750],
      mat: '10 min walk to Chania Combat Sports',
      sea: '15 min walk to Nea Chora',
      shop: '10 min; covered market 15',
      net: 'Cosmote FTTH — check the street number',
      snag: 'It is a hill, and old stone flats are cold and damp in December.',
      area: 'Halepa, Chania, Greece',
      gym: 'Chania Combat Sports',
      wiki: 'Chania',
    },
    {
      name: 'Akrotiri — Kounoupidiana',
      what: 'Detached houses with gardens and sea views. The house you actually wanted.',
      rent: [700, 1100],
      mat: '12 min drive — not walkable',
      sea: '5–10 min to Kalathas, Stavros, Tersanas',
      shop: 'Full supermarket in the village; university keeps it awake',
      net: 'FTTH here; VDSL further out towards Stavros',
      snag: 'You need a car, and the beaches are empty from November.',
      area: 'Kounoupidiana, Akrotiri, Chania, Greece',
      gym: 'Chania Combat Sports',
      wiki: 'Akrotiri, Chania',
    },
  ],
  rethymno: [
    {
      name: 'Rethymno — Kastella',
      what: 'Venetian-era flats behind the beach, walkable to everything.',
      rent: [400, 650],
      mat: '1 hr drive to Chania for MMA',
      sea: 'End of the street — 12 km of sand',
      shop: '10 min; Thursday market',
      net: 'Cosmote FTTH in the old town',
      snag: 'Low training ceiling, and February is genuinely quiet.',
      area: 'Rethymno, Crete, Greece',
      gym: 'Rethymno BJJ',
      wiki: 'Rethymno',
    },
  ],
  heraklion: [
    {
      name: 'Ammoudara',
      what: 'Flats along the beach strip 10 minutes west of the city.',
      rent: [450, 700],
      mat: '10–15 min into the city — biggest scene on Crete',
      sea: 'Across the road, flat promenade to run',
      shop: 'Full supermarkets on the strip',
      net: 'Best fibre on the island, two providers',
      snag: 'A package-holiday strip, and bleak in December.',
      area: 'Ammoudara, Heraklion, Greece',
      gym: 'Heraklion BJJ MMA',
      wiki: 'Heraklion',
    },
  ],
  'athens-riviera': [
    {
      name: 'Ano Glyfada',
      what: 'Good flats a few streets above the shopping district, quieter and cheaper.',
      rent: [900, 1400],
      mat: '10–15 min to Alliance or Kimura — real fundamentals programmes',
      sea: '10 min walk; tram along the coast',
      shop: 'Everything, all year',
      net: 'Full gigabit, multiple providers',
      snag: '€900–1,400 is roughly double Chania for the same flat.',
      area: 'Glyfada, Athens, Greece',
      gym: 'Alliance Jiu Jitsu Athens',
      wiki: 'Glyfada',
    },
  ],
  kalamata: [
    {
      name: 'Kalamata — Navarinou',
      what: 'Flats along the front with balconies over the bay.',
      rent: [400, 650],
      mat: '10 min to The Camp 10',
      sea: 'Across the road; sand 20–40 min west',
      shop: 'Producer-direct market — cheapest good food in Greece',
      net: 'FTTH along the front',
      snag: 'Small, and everything routes through Athens.',
      area: 'Navarinou, Kalamata, Greece',
      gym: 'The Camp 10 Kalamata',
      wiki: 'Kalamata',
    },
  ],
  rhodes: [
    {
      name: 'Rhodes new town — Zefyros',
      what: 'Year-round residential flats, unlike the resort strips.',
      rent: [400, 650],
      mat: '10 min south to Rhodes Knights BJJ',
      sea: 'Two coasts within 10 min; warmest sea in Greece',
      shop: 'Full supermarkets and a market',
      net: 'FTTH in town and Ialysos',
      snag: 'The island shuts hard in November — the town does not.',
      area: 'Zefyros, Rhodes, Greece',
      gym: 'Rhodes Knights BJJ',
      wiki: 'Rhodes (city)',
    },
  ],
  thessaloniki: [
    {
      name: 'Kalamaria',
      what: 'Seafront-adjacent flats in the good residential district.',
      rent: [350, 550],
      mat: '10 min — strongest scene outside Athens',
      sea: 'None. Halkidiki is 60–90 min and closed',
      shop: 'Best food city in Greece, and the cheapest',
      net: 'Full fibre, two providers',
      snag: '10°C and grey in December, with no sea.',
      area: 'Kalamaria, Thessaloniki, Greece',
      gym: 'MMA Thessaloniki',
      wiki: 'Kalamaria',
    },
  ],
  corfu: [
    {
      name: 'Corfu Town — Garitsa',
      what: 'Venetian flats on the bay, and stone houses with gardens just outside.',
      rent: [400, 700],
      mat: '5 min to Cloud9 BJJ — the only Machado academy in Europe',
      sea: '10 min to Mon Repos',
      shop: 'Full market and supermarkets',
      net: 'Fibre in town and the coast road',
      snag: '14 rain days in November, 15 in December — the wettest place in Greece.',
      area: 'Garitsa, Corfu, Greece',
      gym: 'Cloud9 BJJ Corfu',
      wiki: 'Corfu (city)',
    },
  ],

  // ── Cyprus ────────────────────────────────────────────────────────────────
  limassol: [
    {
      name: 'Potamos Germasogeias',
      what: 'Modern 2-beds between the strip and the sea, most with a pool in the block.',
      rent: [1100, 1600],
      mat: '5–10 min to Checkmat or Gracie Barra, taught in English',
      sea: 'Across the road; 24°C in November',
      shop: '5 min, including Middle Eastern staples',
      net: 'Cyta gigabit — most reliable on this list',
      snag: 'A finance-and-tourism suburb, not a town, at twice Chania’s rent.',
      area: 'Potamos Germasogeias, Limassol, Cyprus',
      gym: 'Checkmat Limassol',
      wiki: 'Limassol',
    },
  ],
  paphos: [
    {
      name: 'Coral Bay / Peyia',
      what: 'Villas with private pools — genuinely normal to rent here.',
      rent: [800, 1300],
      mat: '15 min drive to Furious Fighters or Kings BJJ',
      sea: '5 min — warmest winter sea in the EU',
      shop: '5 min in Peyia; full ones in Paphos',
      net: 'Fibre through the coastal strip',
      snag: 'You need a car, and the resident population skews retired British.',
      area: 'Coral Bay, Peyia, Cyprus',
      gym: 'Furious Fighters Paphos',
      gymUrl: 'https://furiousfighterscy.com/',
      wiki: 'Coral Bay, Cyprus',
    },
  ],
  larnaca: [
    {
      name: 'Mackenzie',
      what: 'Flats on the Mackenzie beach strip, or houses inland at Oroklini.',
      rent: [650, 1000],
      mat: '45 min drive to Limassol, realistically',
      sea: 'On the strip; better sand 20 min north',
      shop: 'Everything, cheaper than Limassol',
      net: 'Cyta gigabit FTTH',
      snag: 'It is the airport town — convenient, and not a reason to be anywhere.',
      area: 'Mackenzie Beach, Larnaca, Cyprus',
      gym: 'Cyprus Top Team Larnaca',
      wiki: 'Larnaca',
    },
  ],
  protaras: [
    {
      name: 'Pernera',
      what: 'Villas priced for summer, let cheap on a winter contract.',
      rent: [600, 1000],
      mat: '45 min to Larnaca, 70 to Limassol',
      sea: 'Walkable to Fig Tree Bay — best water on the island',
      shop: 'Two supermarkets stay open; the strip does not',
      net: 'Fibre in the resort strip',
      snag: 'Four in five businesses close from November.',
      area: 'Pernera, Protaras, Cyprus',
      gym: 'Cyprus Top Team Larnaca',
      wiki: 'Protaras',
    },
  ],
  nicosia: [
    {
      name: 'Engomi',
      what: 'The cheapest housing on the island, in a real working city.',
      rent: [550, 850],
      mat: '10 min — several academies',
      sea: 'None. 45 min in any direction',
      shop: 'Best supply and lowest prices in Cyprus',
      net: 'Cyta gigabit FTTH',
      snag: 'Choosing an island and living inland on it defeats the exercise.',
      area: 'Engomi, Nicosia, Cyprus',
      gym: 'Nicosia BJJ',
      wiki: 'Nicosia',
    },
  ],
}

export function spotsFor(id: PlaceId): Spot[] {
  return SPOTS[id] ?? []
}

/** The countries whose towns carry street-level detail so far. */
export const DETAILED_COUNTRIES = ['malta', 'italy', 'spain', 'greece', 'cyprus']
