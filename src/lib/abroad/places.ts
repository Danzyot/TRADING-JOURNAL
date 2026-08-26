/**
 * The places themselves, not the countries as abstractions.
 *
 * A country is the wrong unit for this decision. "Greece" is Chania and it is
 * also a mountain village on 8 Mbps; "Spain" is Valencia and it is also a
 * Marbella at €3,000 a month. So the comparison happens at the level of
 * a town you could actually sign a lease in.
 *
 * Every entry answers the same eight questions, in the same order, so two towns
 * can be read against each other without re-reading the prose:
 *
 *   what it costs · what a home costs · the sea · the training · the food ·
 *   the internet · what the town has · what is wrong with it
 *
 * Named gyms are ones that verifiably exist and run an adult schedule as of
 * August 2026. Where a town has no real room, it says so rather than padding
 * the line — a place with no MMA is a fact about the place, not a gap in the
 * research. Monthly figures are euros for one person living comfortably, rent
 * included, and are deliberately round: they are for ordering towns, not for
 * budgeting.
 */

import { monthlyOf } from './costs'

export type PlaceId = string

export type Place = {
  id: PlaceId
  /** Country slug, matching CANDIDATES in ./countries.ts. */
  country: string
  name: string
  where: string
  /** How well this specific town serves the brief, 1–5. */
  fit: number
  /** What a long-term home costs, and what kind of home it is. */
  rent: string
  /** Is renting a whole house long-term normal, possible, or fantasy? */
  house: 'normal' | 'possible' | 'rare'
  /** Distance to swimmable sea, and for how much of the year. */
  beach: string
  /** Named rooms. Grappling and striking, with an honest verdict. */
  train: string
  /** Whether a real MMA or BJJ room runs an adult schedule here. */
  mma: boolean
  /** Markets, fish, meat, and whether "organic" means anything. */
  food: string
  /** Fibre reality, and the fallback. */
  net: string
  /** Hospital, airport, and whether the town lives all year. */
  town: string
  /** The thing that would make you leave. */
  catch: string
}

export const TIERS = [
  { key: 'lean', label: 'Under €1,500', max: 1500 },
  { key: 'mid', label: '€1,500–2,200', max: 2200 },
  { key: 'high', label: '€2,200–3,000', max: 3000 },
  { key: 'top', label: 'Over €3,000', max: Infinity },
] as const

export type TierKey = (typeof TIERS)[number]['key']

export function tierOf(monthly: number): TierKey {
  return (TIERS.find((tier) => monthly <= tier.max) ?? TIERS[TIERS.length - 1]).key
}


export const PLACES: Place[] = [
  // ── Greece ────────────────────────────────────────────────────────────────
  {
    id: 'chania',
    country: 'greece',
    name: 'Chania',
    where: 'Crete, west',
    fit: 5,
    rent: '€1,200–1,800 for a detached 3-bed with sea view in Akrotiri or behind Souda; €700–1,000 in Nerokourou or Mournies, inland.',
    house: 'normal',
    beach: 'Sea on both sides of the peninsula. Nea Chora is in the town; Marathi and Stavros are 15 minutes. Swimmable May–November, ~23°C in October.',
    train: 'Chania Combat Sports runs MMA, Muay Thai and no-gi BJJ on a real weekly schedule — the thing most Greek towns this size do not have. Commercial gyms are plentiful and cheap.',
    mma: true,
    food: 'A daily market, Cretan meat and fish, and an olive-oil culture that is not a marketing line. Organic is the default rather than a premium aisle.',
    net: 'Fibre through the town and Akrotiri. Ten minutes inland it becomes a lottery — check the specific address, not the village.',
    town: 'Public hospital plus private clinics. CHQ flies to Athens hourly and direct to Tel Aviv in season. Lives all year, not a resort that shuts.',
    catch:
      'January is 18 rain days and about six hours of sun a day. Everything outside town — Stavros, Marathi, the tavernas on the coast road — is shut from November to April.',
  },
  {
    id: 'rethymno',
    country: 'greece',
    name: 'Rethymno',
    where: 'Crete, centre',
    fit: 4,
    rent: '€900–1,400 for a house with a garden in the villages behind the town; €600–900 for a flat on the front.',
    house: 'normal',
    beach: 'A 12 km sand beach starting at the old town. Nothing to drive to — you walk.',
    train: 'A smaller scene than Chania: BJJ and striking clubs exist, MMA is thin. Realistically you drive to Chania an hour west for the serious sessions.',
    mma: false,
    food: 'Same Cretan supply as Chania, one notch cheaper, with a proper Thursday market.',
    net: 'Fibre in town. Same rural caveat as everywhere on the island.',
    town: 'General hospital, university town so it stays awake in winter, but the airport is Chania or Heraklion, an hour either way.',
    catch:
      'The nearest MMA room is an hour away in Chania, so you would be driving two hours round trip for a session. The town loses roughly half its restaurants in February.',
  },
  {
    id: 'heraklion',
    country: 'greece',
    name: 'Heraklion',
    where: 'Crete, centre-east',
    fit: 4,
    rent: '€800–1,200 flats in town; houses realistically in Gournes or Ammoudara, €1,000–1,600.',
    house: 'possible',
    beach: 'Ammoudara is 10 minutes west; the city front itself is a port, not a beach.',
    train: 'The biggest combat-sports scene on Crete, several BJJ and MMA clubs, and the only one that keeps a full schedule through winter.',
    mma: true,
    food: 'The island’s main market city — best fish and meat supply on Crete, and the cheapest.',
    net: 'The best fibre on the island, and a second provider almost everywhere.',
    town: 'University hospital, the island’s main airport with year-round direct flights, and a city that does not notice the season.',
    catch:
      'It is a working port: container traffic, concrete apartment blocks, and traffic on the coast road at 08:00. The Crete people move for starts 40 minutes outside it.',
  },
  {
    id: 'athens-riviera',
    country: 'greece',
    name: 'Athens Riviera',
    where: 'Glyfada · Voula · Vouliagmeni',
    fit: 4,
    rent: '€14–20.5/m²/month — so €1,400–2,000 for a good 100 m² flat. Detached houses exist in Voula and Vouliagmeni at €2,500–4,000.',
    house: 'possible',
    beach: 'Organised beaches the length of the coast, tram to the city, Vouliagmeni for the good water.',
    train: 'The deepest scene in the country: Alliance Jiu Jitsu Athens, MMA Draculino Team Greece, Kimura BJJ, Pirates HQ, Grind Athens. Nothing here is a compromise.',
    mma: true,
    food: 'Everything, all year, including the imported and the specialist. The one place in Greece where diet is never a constraint.',
    net: 'Full fibre, multiple providers, gigabit normal.',
    town: 'Best hospitals in the country, a 25-minute drive to ATH, and daily direct flights to Tel Aviv.',
    catch:
      '€14–20.5 per square metre per month means €1,400–2,000 for a decent 100 m² flat, which is the only Greek option that is not meaningfully cheaper than Israel. July and August hit 38°C in a heat island.',
  },
  {
    id: 'kalamata',
    country: 'greece',
    name: 'Kalamata',
    where: 'Messenia, Peloponnese',
    fit: 4,
    rent: '€700–1,200 for a house with land in the villages above the town; €500–800 in town.',
    house: 'normal',
    beach: 'A long pebble front in the town, and the Messinian sand beaches 20–40 minutes west.',
    train: 'The Camp 10 is a full multipurpose athletic club with MMA and BJJ — unusually good for a town this size, and the reason Kalamata is on this list at all.',
    mma: true,
    food: 'The olive and fig country. Producer-direct meat, oil and vegetables, and prices well under the islands.',
    net: 'Fibre in the town; the mountain villages are copper.',
    town: 'General hospital, its own airport with seasonal European flights, and a town that lives all year on agriculture rather than tourism.',
    catch:
      'Population 70,000, one airport with three or four European routes in season, and everything else routed through Athens — 2.5 hours by road or a 45-minute flight.',
  },
  {
    id: 'rhodes',
    country: 'greece',
    name: 'Rhodes Town',
    where: 'Dodecanese',
    fit: 3,
    rent: '€800–1,300 for a house in Ialysos or Koskinou; €600–900 for a flat in the new town.',
    house: 'normal',
    beach: 'Two coasts within ten minutes: Ixia for wind, Kallithea for calm water. The warmest sea in Greece by October.',
    train: 'Rhodes Knights BJJ, just south of the town, is the real room. Striking is club-level.',
    mma: false,
    food: 'Good in season, thinner in February when half the supply chain is aimed at hotels.',
    net: 'Fibre in the town and Ialysos.',
    town: 'General hospital, an international airport, but the island empties from November and a lot of it shuts.',
    catch:
      'From early November the east coast closes: Faliraki, Lindos, most restaurants, most car hire. Everything on the island arrives by ferry or plane, so groceries cost 15–20% more than Athens.',
  },
  {
    id: 'thessaloniki',
    country: 'greece',
    name: 'Thessaloniki',
    where: 'Macedonia, north',
    fit: 3,
    rent: '€500–850 for a flat in Kalamaria; houses mean the suburbs, €900–1,400.',
    house: 'possible',
    beach: 'Not really. The city waterfront is not swimmable; Halkidiki is 60–90 minutes.',
    train: 'A real fight city — several MMA and BJJ clubs, the strongest scene in Greece outside Athens.',
    mma: true,
    food: 'The best food city in Greece, and the cheapest of the big ones. Modiano market, proper butchers, everything in season.',
    net: 'Full fibre.',
    town: 'University hospitals, an international airport, a student city that never goes quiet.',
    catch:
      'December and January are 5–10°C, the city waterfront is not swimmable, and the nearest real beach is 60–90 minutes away in Halkidiki, closed for the season.',
  },
  {
    id: 'corfu',
    country: 'greece',
    name: 'Corfu Town',
    where: 'Ionian',
    fit: 3,
    rent: '€800–1,400 for a stone house with a garden outside the town — this is the island where that is the normal thing to rent.',
    house: 'normal',
    beach: 'Green island, clear water, everything within 20 minutes. Sea warm May–October.',
    train: 'Cloud9 BJJ is the only Jean Jacques Machado academy in Europe, plus Solar Club for karate and BJJ. Grappling is genuinely good here; MMA is not.',
    mma: false,
    food: 'Ionian rather than Aegean — more greens, more beef, good oil, and a real market.',
    net: 'Fibre in the town and the main coast road.',
    town: 'General hospital, international airport, 40 minutes by ferry to Italy-bound routes.',
    catch:
      'Over 1,100 mm of rain a year, more than double Athens, and it falls in October to January — 14 rain days in November, 15 in December.',
  },

  // ── Cyprus ────────────────────────────────────────────────────────────────
  {
    id: 'limassol',
    country: 'cyprus',
    name: 'Limassol',
    where: 'Germasogeia · Potamos Germasogeias',
    fit: 4,
    rent: '€1,400–2,200 for a 2-bed near the beach; houses inland at Palodia or Parekklisia, €1,800–2,800.',
    house: 'possible',
    beach: 'Continuous city beach with a promenade, and the sea stays swimmable into November.',
    train: 'Checkmat Limassol, Gracie Barra Cyprus, BJJ Cyprus Academy, Sparta MMA at Parekklisia. The deepest grappling scene between Athens and Tel Aviv.',
    mma: true,
    food: 'Everything Israeli-familiar, including the Middle Eastern staples, plus a Russian-run import trade that fills the gaps.',
    net: 'Gigabit fibre citywide, and the most reliable connection on this entire list.',
    town: 'Private hospitals to a genuinely high standard, Larnaca airport 45 minutes, and 45 minutes in the air to Tel Aviv.',
    catch:
      'A furnished 2-bed near the sea is €1,100–1,600 even off-season, twice what the same thing costs in Chania. The population is Russian and Israeli finance staff; it is a business district with a beach, not a Cypriot town.',
  },
  {
    id: 'paphos',
    country: 'cyprus',
    name: 'Paphos',
    where: 'Kato Paphos · Coral Bay',
    fit: 4,
    rent: '€900–1,500 for a villa with a pool — genuinely normal here, unlike Limassol.',
    house: 'normal',
    beach: 'Coral Bay and Corallia, 15 minutes from town, and the warmest winter sea in the EU.',
    train: 'Furious Fighters for MMA and striking, Kings BJJ, International Jiu-Jitsu School, Aidinidis Fight Club. Small scene, but four real options.',
    mma: true,
    food: 'Good local produce and fish, thinner on specialist supply than Limassol.',
    net: 'Fibre through the town and the coastal strip.',
    town: 'General and private hospitals, its own international airport, and a town with a large permanent foreign population so it does not shut.',
    catch:
      'The resident foreign population is largely retired British — the median age in Peyia is over 50. Without a car you cannot reach the gym, the beach or a supermarket.',
  },
  {
    id: 'larnaca',
    country: 'cyprus',
    name: 'Larnaca',
    where: 'Finikoudes · Oroklini',
    fit: 3,
    rent: '€800–1,300 for a flat; houses in Oroklini and Pyla, €1,200–1,900.',
    house: 'possible',
    beach: 'Town beach and the Mackenzie strip; better sand 20 minutes north.',
    train: 'Thinner than Limassol — Trojans ZR Team and Cyprus Top Team are the names, and you would end up driving to Limassol.',
    mma: false,
    food: 'Fine, unremarkable, cheaper than Limassol.',
    net: 'Fibre.',
    town: 'The island’s main airport is here — a 10-minute drive and you are at check-in for Tel Aviv.',
    catch:
      'The serious training is 45 minutes away in Limassol, so you would drive 90 minutes round trip several times a week. The town itself has one beach strip and little else.',
  },
  {
    id: 'protaras',
    country: 'cyprus',
    name: 'Protaras',
    where: 'Paralimni · Ayia Napa',
    fit: 3,
    rent: '€800–1,400 for a villa off-season; landlords price for summer tourists so a 12-month lease is the negotiation.',
    house: 'normal',
    beach: 'The best water on the island — Fig Tree Bay and Konnos, both walkable from residential streets.',
    train: 'Effectively nothing. You drive 45 minutes to Larnaca or 70 to Limassol.',
    mma: false,
    food: 'Tourist supply in season, a short list of supermarkets out of it.',
    net: 'Fibre in the resort strip.',
    town: 'Paralimni hospital, and Larnaca airport 45 minutes away.',
    catch:
      'From early November roughly four in five restaurants, bars and shops close until April. There is no mat within 45 minutes.',
  },
  {
    id: 'nicosia',
    country: 'cyprus',
    name: 'Nicosia',
    where: 'Inland capital',
    fit: 2,
    rent: 'The cheapest housing on the island: €700–1,100 for a good flat, €1,200–1,800 for a house.',
    house: 'possible',
    beach: 'None. The sea is 45 minutes in any direction.',
    train: 'A handful of academies, decent commercial gyms.',
    mma: true,
    food: 'The best supply and the lowest prices in Cyprus.',
    net: 'Fibre.',
    town: 'The main hospitals, the government offices, and a real working city.',
    catch:
      'It is 45 minutes from the sea in every direction and hits 40°C in August. You would be on an island and never see it.',
  },

  // ── Spain ─────────────────────────────────────────────────────────────────
  {
    id: 'valencia',
    country: 'spain',
    name: 'Valencia',
    where: 'Ruzafa · El Cabanyal · Patacona',
    fit: 5,
    rent: '€1,100–1,600 for a good 2-bed in Ruzafa or a restored fisherman’s house in El Cabanyal; houses proper mean Alboraya or El Puig, €1,400–2,000.',
    house: 'possible',
    beach: 'Malvarrosa and Patacona are city beaches you cycle to, wide sand, 20 minutes from the centre by bike lane.',
    train: 'ASES Jiu-Jitsu (Ezekiel Zayas), Fight4Life with a full cage and mat hall, S.H.O.O.T. MMA, Michal Adamczak BJJ. Four serious rooms in one city.',
    mma: true,
    food: 'Mercado Central and Mercado de Ruzafa — the best everyday market food in Western Europe at these prices. Horchata, rice, fish, and cheap good meat.',
    net: 'Gigabit fibre for €30. Spain has the best fibre coverage in Europe and Valencia is fully covered.',
    town: 'Excellent public hospitals, an international airport 20 minutes out, 4-hour flight to Tel Aviv with a stop.',
    catch:
      'Spain taxes a self-employed trader at 19–47% plus €350–400 a month of social security, and the Beckham regime excludes autónomos by name — so the headline expat tax break does not apply to you.',
  },
  {
    id: 'malaga',
    country: 'spain',
    name: 'Málaga',
    where: 'Costa del Sol · Torremolinos',
    fit: 4,
    rent: '€1,200–1,800 in the city; townhouses in Torremolinos or Benalmádena, €1,500–2,200.',
    house: 'possible',
    beach: 'Malagueta in the city, and 100 km of coast either side. Swimmable June–October, cool but usable in between.',
    train: 'Scramble Academy in Torremolinos, run by ADCC veteran Santeri Lilius, is a genuinely world-class BJJ room. Plus Rilion Gracie Málaga and The Honorable for MMA.',
    mma: true,
    food: 'Atarazanas market, Mediterranean supply, strong fish. Organic is normal and not expensive.',
    net: 'Full fibre.',
    town: 'Regional hospital, a major international airport, and the warmest winter on mainland Europe — 17–18°C in January.',
    catch:
      'The same Spanish tax answer, and the Costa del Sol is now expensive: €1,000–1,400 for a furnished flat in the centre even in December, because these months are a season here rather than a lull.',
  },
  {
    id: 'alicante',
    country: 'spain',
    name: 'Alicante',
    where: 'Costa Blanca · San Juan',
    fit: 4,
    rent: '€900–1,400 for a flat near Playa San Juan; villas inland at San Vicente or Mutxamel, €1,300–1,900.',
    house: 'normal',
    beach: 'Playa San Juan is 7 km of sand with a tram to the centre. Postiguet is in the town.',
    train: 'The undisputed MMA capital of Spain. Climent Club produces UFC fighters; Fightzone Costa Blanca runs over 100 classes a week. If training is the deciding criterion, this is the best town on the list outside Thailand.',
    mma: true,
    food: 'Good, cheap, Mediterranean. Slightly below Valencia for markets.',
    net: 'Full fibre.',
    town: 'Hospital General, international airport 15 minutes, and a city with a real year-round population.',
    catch:
      'Playa de San Juan is a summer suburb — by November the beachfront bars are shut and the neighbourhood is quiet after 20:00. The city is duller than Valencia at every hour that is not training.',
  },
  {
    id: 'marbella',
    country: 'spain',
    name: 'Marbella / Estepona',
    where: 'Costa del Sol, west',
    fit: 3,
    rent: '€2,000–3,500 for a villa; €1,300–2,000 for a good flat in a gated complex.',
    house: 'normal',
    beach: 'Continuous beach with the Sierra Blanca behind it, and the mildest January in Spain.',
    train: 'Patrick Bittan Academy and a cluster of BJJ and boxing gyms serving a wealthy expat market — good facilities, less depth than Alicante.',
    mma: true,
    food: 'Excellent and priced for the market that lives here.',
    net: 'Full fibre.',
    town: 'Best private healthcare in southern Spain, Málaga airport 45 minutes.',
    catch:
      '€1,300–1,900 for a flat in a gated complex, more than Valencia and Málaga, in a town where the median resident is retired and you need a car for everything.',
  },
  {
    id: 'palma',
    country: 'spain',
    name: 'Palma de Mallorca',
    where: 'Balearics',
    fit: 3,
    rent: '€1,300–2,000 for a flat; a house near the sea is €2,200 and up, and the market is brutal in summer.',
    house: 'rare',
    beach: 'Cala Major and Illetes are 10 minutes; the good coves need a car and an hour.',
    train: 'SurUnion (Checkmat), a Luta Livre no-gi academy, and BJJPalma. Solid grappling, thin MMA.',
    mma: true,
    food: 'Mercat de l’Olivar is excellent. Island prices on everything imported.',
    net: 'Full fibre.',
    town: 'Son Espases hospital is one of Spain’s best, and the airport is a major hub.',
    catch:
      'From November most of the island outside Palma closes — the coast road restaurants, the coves, the bus routes. You would be living in one neighbourhood of one city.',
  },
  {
    id: 'las-palmas',
    country: 'spain',
    name: 'Las Palmas',
    where: 'Gran Canaria, Canaries',
    fit: 4,
    rent: '€900–1,400 for a flat walking distance from Las Canteras; houses mean the hills behind, €1,300–1,900.',
    house: 'possible',
    beach: 'Las Canteras is a 3 km protected city beach that is swimmable every month of the year — the only place in Europe where that is simply true.',
    train: 'Team Romero BJJ (BJJ, grappling, MMA, Muay Thai), TheZenClub BJJ, Club Felipe Marden. A real scene for a city this size.',
    mma: true,
    food: 'Atlantic fish, year-round local vegetables, and the Canaries’ own low-VAT regime keeps prices under the mainland.',
    net: 'Full fibre. The submarine cables land here.',
    town: 'University hospital, an international airport, and a working city rather than a resort.',
    catch:
      'Four hours further from Israel than mainland Europe, with no direct flights, and your months are peak season here so rent is 25% above the annual rate rather than below it.',
  },
  {
    id: 'costa-adeje',
    country: 'spain',
    name: 'Costa Adeje',
    where: 'Tenerife, Canaries',
    fit: 3,
    rent: '€1,000–1,600 for a flat or small townhouse in Adeje or La Caleta.',
    house: 'possible',
    beach: 'Playa del Duque and La Caleta, calm water, and 22°C sea in January.',
    train: 'Commercial gyms everywhere, BJJ clubs in Santa Cruz and Los Cristianos, but the serious rooms are the 70 minutes north in the capital.',
    mma: false,
    food: 'Tourist-facing in the south; the real markets are in La Laguna and Santa Cruz.',
    net: 'Fibre through the resort strip.',
    town: 'Hospiten private hospitals, TFS airport 20 minutes.',
    catch:
      'A resort with residents attached. The nearest serious mat is 70 minutes north in Santa Cruz, and your months are high season so you pay the most and it is busiest.',
  },

  // ── Portugal ──────────────────────────────────────────────────────────────
  {
    id: 'cascais',
    country: 'portugal',
    name: 'Cascais',
    where: 'Lisbon coast',
    fit: 4,
    rent: '€1,500–2,400 for a 2-bed; a house in Birre or Quinta da Marinha is €2,500–4,000.',
    house: 'possible',
    beach: 'Guincho for wind and surf, Conceição and Rainha in the town, Carcavelos a train stop away.',
    train: 'Flow MMA in Cascais runs Muay Thai and BJJ with small classes; Lisbon is 30 minutes by train for Gracie Barra Campolide, Nova União and Five Elements.',
    mma: true,
    food: 'Best fish in Europe, a good market, and organic produce that is genuinely cheap for Western Europe.',
    net: 'Full fibre, and Portugal’s network is among the best in the EU.',
    town: 'Private hospitals, 25 minutes to Lisbon airport, one of the safest towns in Europe.',
    catch:
      'The Atlantic is 16–19°C and never warms, so this is not a swimming trip. IFICI, the regime that replaced NHR, excludes remote work for foreign clients — the tax reason people move here does not apply to you.',
  },
  {
    id: 'carcavelos',
    country: 'portugal',
    name: 'Carcavelos / Parede',
    where: 'Lisbon coast',
    fit: 4,
    rent: '€1,100–1,700 for a flat; houses at €1,800–2,600.',
    house: 'possible',
    beach: 'Carcavelos is the big sand beach of the Lisbon coast, and the train runs along it into the city.',
    train: 'Everything Lisbon has, 20 minutes away, plus local BJJ clubs. Depth is not an issue on this coast.',
    mma: true,
    food: 'Same as Cascais at 80% of the price.',
    net: 'Full fibre.',
    town: 'Between Cascais and Lisbon — hospitals both ways, airport 20 minutes.',
    catch:
      'A commuter suburb between Cascais and Lisbon, with the same cold Atlantic and the same tax answer, and less to do than either end of the line.',
  },
  {
    id: 'lagos-pt',
    country: 'portugal',
    name: 'Lagos',
    where: 'Western Algarve',
    fit: 4,
    rent: '€900–1,500 out of season, and landlords who want €2,500 for July. A 12-month lease is the whole negotiation.',
    house: 'normal',
    beach: 'Meia Praia is 4 km of sand; the cove beaches at Dona Ana and Camilo are the postcard ones.',
    train: 'Shinobi Academy, Rey BJJ and Santos Gym are all in the town; Bear Bones Jiujitsu (Roger Gracie black belt) is up the coast at Aljezur.',
    mma: false,
    food: 'Excellent fish and a Saturday market; the supermarket end is thinner than the cities.',
    net: 'Fibre in the town.',
    town: 'Health centre in town, hospital at Portimão 20 minutes, Faro airport 80 minutes.',
    catch:
      'From early November most of the town closes and rent halves — €900–1,500 becomes negotiable — because there is nobody there. 9 rain days a month and a 19°C sea.',
  },
  {
    id: 'portimao',
    country: 'portugal',
    name: 'Portimão / Alvor',
    where: 'Central Algarve',
    fit: 3,
    rent: '€700–1,200 — the cheapest real housing on the Algarve coast.',
    house: 'normal',
    beach: 'Praia da Rocha and Alvor, both wide and sheltered.',
    train: 'Gym culture yes, dedicated MMA no. Lagos is 25 minutes.',
    mma: false,
    food: 'Good market, working fishing port, genuinely cheap.',
    net: 'Fibre.',
    town: 'The Algarve’s main hospital, Faro airport an hour.',
    catch:
      'A working fishing and industrial town with a resort strip attached. The nearest BJJ is 25 minutes in Lagos, and there is no MMA in the Algarve at all.',
  },
  {
    id: 'ericeira',
    country: 'portugal',
    name: 'Ericeira',
    where: 'Lisbon coast, north',
    fit: 3,
    rent: '€1,000–1,600 for a house near the coast road.',
    house: 'normal',
    beach: 'A World Surfing Reserve — the best waves in Europe. Cold, exposed, and rarely a swimming beach.',
    train: 'Surf-first town. BJJ exists at club level; anything serious is Lisbon, 45 minutes.',
    mma: false,
    food: 'Small-town Portuguese: fish, bread, produce, all good.',
    net: 'Fibre in the town.',
    town: 'Health centre only; Mafra and Lisbon for hospitals. Airport 50 minutes.',
    catch:
      'A surf village. If you do not surf it is a windy town of 7,000 people with expensive rent, 13 rain days in November, and the nearest mat 45 minutes away in Lisbon.',
  },
  {
    id: 'funchal',
    country: 'portugal',
    name: 'Funchal',
    where: 'Madeira',
    fit: 3,
    rent: '€800–1,400 for a flat with a sea view; houses on the hillside €1,200–1,900.',
    house: 'normal',
    beach: 'Volcanic — lidos and rock platforms rather than sand. Sea 19–24°C all year.',
    train: 'A handful of BJJ clubs and good commercial gyms. Small island, small scene.',
    mma: false,
    food: 'The Mercado dos Lavradores, tropical fruit, Atlantic fish. Imported goods carry the island tax.',
    net: 'Full fibre, and a large remote-work population that depends on it.',
    town: 'Central hospital, an airport with direct Lisbon flights hourly, and a mild 19°C January.',
    catch:
      'No sand anywhere on the island — you swim off lidos and rock platforms. Every road is a 10% gradient, and the nearest real BJJ scene is a two-hour flight away in Lisbon.',
  },

  // ── Italy ─────────────────────────────────────────────────────────────────
  {
    id: 'aci-castello',
    country: 'italy',
    name: 'Catania / Aci Castello',
    where: 'Sicily, east',
    fit: 4,
    rent: '€700–1,200 for a flat on the lava coast at Aci Trezza or Aci Castello; houses with a garden inland, €900–1,500.',
    house: 'normal',
    beach: 'Black rock and clear water at Aci Trezza; the sand is at La Playa, 20 minutes south.',
    train: 'BJJ Catania (Lavica Project), Ares Combat Society, LegionariVs Sakara Team, Fundamental BJJ, Be-Muay Club. Five rooms — the best training in southern Italy.',
    mma: true,
    food: 'The single best argument for Sicily. Catania’s fish market is a working one, the produce is the best in the Mediterranean, and it costs nothing.',
    net: 'Fibre in Catania and the coastal towns.',
    town: 'University hospitals, an international airport, Etna behind you, and a city that lives all year.',
    catch:
      'Sicilian paperwork is slow in a specific way: a residency registration that takes a week in Milan takes six to eight in Catania, and offices open 08:30–12:30 on three or four mornings a week. Catania itself is a scruffy port city — graffiti, uncollected bins on some streets, and Etna ash on the cars a few times a year. Neither is dangerous; both take getting used to.',
  },
  {
    id: 'mondello',
    country: 'italy',
    name: 'Palermo / Mondello',
    where: 'Sicily, west',
    fit: 3,
    rent: '€800–1,400 for a villa in Mondello; €500–900 for a flat in Palermo proper.',
    house: 'normal',
    beach: 'Mondello is the good one — a sheltered white sand bay 20 minutes from the city.',
    train: 'Club-level BJJ and boxing. Less depth than Catania.',
    mma: false,
    food: 'Ballarò and Capo markets; street food culture; the cheapest good eating in Italy.',
    net: 'Fibre in the city.',
    town: 'Major hospitals, an international airport, a real capital city.',
    catch:
      'A summer suburb of Palermo that empties in November, 20 minutes from the city for anything serious, and Palermo traffic makes that 40 in the morning.',
  },
  {
    id: 'monopoli',
    country: 'italy',
    name: 'Monopoli / Polignano',
    where: 'Puglia',
    fit: 4,
    rent: '€700–1,300 for a trullo or a masseria-style house with land — this is the part of Italy where that is the ordinary rental.',
    house: 'normal',
    beach: 'Rock coves and small sand beaches every kilometre; the clearest water on the Italian mainland.',
    train: 'Nothing in the towns themselves. Bari is 40 minutes and has WCRA Bari Centro for BJJ and grappling, plus the city clubs.',
    mma: false,
    food: 'Puglia is the vegetable and olive-oil heartland of Italy. Burrata, orecchiette, sea urchin, and a weekly market in every town.',
    net: 'Fibre in the towns; rural masserie are a genuine problem — check the address.',
    town: 'Hospitals at Monopoli and Bari, Bari airport an hour, and towns that stay alive in winter on their own economy.',
    catch:
      'You need a car for everything, and the nearest mat is a 40-minute drive or a 45-minute train to Bari — each way. Stone houses at 14°C in December with electric heating are expensive to keep warm.',
  },
  {
    id: 'lecce',
    country: 'italy',
    name: 'Lecce / Salento',
    where: 'Puglia, heel',
    fit: 3,
    rent: '€600–1,100 in Lecce; a house near the sea at Torre dell’Orso or San Foca, €800–1,400.',
    house: 'normal',
    beach: 'Two coasts within 30 minutes: Adriatic sand to the east, Ionian to the west.',
    train: 'University-town clubs, thin on MMA.',
    mma: false,
    food: 'Same Puglian supply as Monopoli, plus a university city’s restaurants.',
    net: 'Fibre in Lecce.',
    town: 'Vito Fazzi hospital, Brindisi airport 40 minutes.',
    catch:
      'It is 25 minutes from the sea and the coastal towns it serves close in November. The training is university-club level with no serious MMA.',
  },
  {
    id: 'cagliari',
    country: 'italy',
    name: 'Cagliari',
    where: 'Sardinia',
    fit: 4,
    rent: '€700–1,200 for a flat; houses in Quartu or Pula, €1,000–1,700.',
    house: 'possible',
    beach: 'Poetto is an 8 km city beach you can reach by bus, and the water is Caribbean-clear.',
    train: 'Nova União Sardegna, CL Fight Team, Wolfpack Fighting Club, Riot Academy BJJ. Four real rooms including proper MMA.',
    mma: true,
    food: 'Sardinian meat and cheese, San Benedetto market — the largest covered market in Italy.',
    net: 'Fibre in the city.',
    town: 'University hospital, an international airport, a capital city on a beach.',
    catch:
      'The mistral makes the beachfront genuinely cold from November, and most of the Poetto kiosks and beach bars shut. Everything shipped to the island costs 10–15% more.',
  },
  {
    id: 'sanremo',
    country: 'italy',
    name: 'Sanremo',
    where: 'Liguria',
    fit: 2,
    rent: '€900–1,600 for a flat with a sea view.',
    house: 'rare',
    beach: 'Pebble beaches, a long seafront cycle path, and the mildest winter in northern Italy.',
    train: 'Club-level. Nice and Monaco are an hour west for anything serious.',
    mma: false,
    food: 'Ligurian: excellent, and priced for the Riviera.',
    net: 'Fibre.',
    town: 'Hospital in town, Nice airport 50 minutes.',
    catch:
      '12°C in December, grey, and the seafront economy is seasonal and quiet. It costs more than Sicily for a worse winter.',
  },

  // ── Malta ─────────────────────────────────────────────────────────────────
  {
    id: 'sliema',
    country: 'malta',
    name: 'Sliema / St Julian’s',
    where: 'Northern Harbour',
    fit: 4,
    rent: '€1,300–2,000 for a 2-bed with a sea view. Houses effectively do not exist here.',
    house: 'rare',
    beach: 'Rock lidos and ladders rather than sand — you swim off the promenade. Sea usable May–November.',
    train: 'Malta Fight Co. in Sliema is the real one: BJJ under a Bustamante black belt, Muay Thai, MMA, ~20 classes a week, €70–100/month unlimited.',
    mma: true,
    food: 'Everything imported, so quality is good and prices are high. Local fish and tomatoes are the exceptions.',
    net: 'Full fibre island-wide — Malta has near-universal gigabit coverage.',
    town: 'Mater Dei is a good hospital, the airport is 15 minutes from everywhere, English is an official language, and the whole island works in English.',
    catch:
      'A whole house effectively does not exist here at any price — the island is flats. The Gżira–Sliema seafront road is one of the worst traffic corridors in Malta and it is loud until midnight, and there is no central heating anywhere on Malta, so a stone flat in December is 15°C indoors.',
  },
  {
    id: 'gzira',
    country: 'malta',
    name: 'Gżira / Msida',
    where: 'Northern Harbour',
    fit: 3,
    rent: '€900–1,400 — the cheapest addresses that are still walking distance from Sliema.',
    house: 'rare',
    beach: 'Same rock-swim coast, 10 minutes on foot.',
    train: 'Malta Fight Co. is a 15-minute walk.',
    mma: true,
    food: 'Same island supply.',
    net: 'Full fibre.',
    town: 'University of Malta is here, so it is young and awake in winter.',
    catch:
      'Continuous construction noise, the worst traffic road on the island outside your window, and the Manoel Island redevelopment is an active building site.',
  },
  {
    id: 'mellieha',
    country: 'malta',
    name: 'Mellieħa',
    where: 'North Malta',
    fit: 3,
    rent: '€900–1,500, and you can actually get a house with outdoor space here.',
    house: 'possible',
    beach: 'Għadira is Malta’s biggest sand beach, and Golden Bay is 10 minutes.',
    train: 'Nothing local. Sliema is 35–45 minutes by car depending on the traffic.',
    mma: false,
    food: 'Village supply plus supermarkets; you drive for choice.',
    net: 'Fibre.',
    town: 'Health centre; Mater Dei is 30 minutes. Gozo ferry is 10 minutes.',
    catch:
      'The nearest mat is 35–45 minutes away by car depending on traffic, which is most of the reason to be in Malta gone. The town is on a hill and the bus to Valletta takes 50 minutes.',
  },
  {
    id: 'gozo',
    country: 'malta',
    name: 'Gozo',
    where: 'Victoria · Marsalforn · Xlendi',
    fit: 3,
    rent: '€700–1,200 for a farmhouse with a pool — the one place in Malta where the house you wanted is normal and affordable.',
    house: 'normal',
    beach: 'Ramla Bay red sand, Xlendi and Dwejra for swimming off rock. Quiet, clean water.',
    train: 'Commercial gyms only. Every mat session is a ferry ride.',
    mma: false,
    food: 'Farm produce, cheese, and a genuinely rural food economy.',
    net: 'Fibre reaches the main towns.',
    town: 'Gozo General Hospital, and everything else is 25 minutes of ferry plus 45 of Malta.',
    catch:
      'By December perhaps a third of Marsalforn is open and Xlendi mostly is not. Every training session is a 25-minute ferry plus 45 minutes of Malta, and the last ferry back shapes your evenings.',
  },

  // ── Croatia ───────────────────────────────────────────────────────────────
  {
    id: 'split',
    country: 'croatia',
    name: 'Split',
    where: 'Dalmatia',
    fit: 4,
    rent: '€800–1,300 for a flat out of season; houses in Podstrana or Kaštela, €1,100–1,800.',
    house: 'possible',
    beach: 'Bačvice in the city, Kašjuni under the Marjan pines, and the islands an hour by ferry.',
    train: 'Mizfits BJJ (Ivo Vatavuk, Roger Gracie black belt) has two mat areas and an MMA cage; plus Infinity BJJ Split. A serious room in a city this size.',
    mma: true,
    food: 'Adriatic fish, Dalmatian meat, the green market under Diocletian’s walls. Very good, and not cheap in summer.',
    net: 'Fibre in the city.',
    town: 'Clinical hospital centre, an international airport, and a city that keeps working out of season.',
    catch:
      '11°C in December with the bura wind behind it, and the ferries to the islands drop to a skeleton timetable. The old town belongs to cruise passengers from May to September.',
  },
  {
    id: 'zadar',
    country: 'croatia',
    name: 'Zadar',
    where: 'North Dalmatia',
    fit: 4,
    rent: '€600–1,000 for a flat; houses in Bibinje or Sukošan, €900–1,400.',
    house: 'normal',
    beach: 'Kolovare in the town, and the Zadar riviera south of it — quieter water than Split.',
    train: 'Ju-Jitsu Klub Zadar and Checkmat Zadar, and the ADCC Croatia Open is held here. Real grappling, thin MMA.',
    mma: false,
    food: 'Excellent market, cheaper than Split, strong fish supply.',
    net: 'Fibre.',
    town: 'General hospital, an international airport, a university town that stays busy.',
    catch:
      'The same cold Adriatic winter as Split with less to do in it, and no dedicated MMA — Ju-Jitsu Klub Zadar and Checkmat are grappling only.',
  },
  {
    id: 'sibenik',
    country: 'croatia',
    name: 'Šibenik',
    where: 'Central Dalmatia',
    fit: 3,
    rent: '€500–900 — the cheapest coastal town in Croatia that is still a real town.',
    house: 'normal',
    beach: 'Solaris and the Krka river mouth; the good beaches are 15 minutes out.',
    train: 'Club level only. Split is 45 minutes.',
    mma: false,
    food: 'Market town supply, very cheap.',
    net: 'Fibre in the centre.',
    town: 'General hospital; airports at Split or Zadar, an hour either way.',
    catch:
      'Population 34,000, no mat, and Split is 45 minutes each way. In December it is a quiet stone town at 11°C.',
  },
  {
    id: 'opatija',
    country: 'croatia',
    name: 'Opatija / Rijeka',
    where: 'Kvarner',
    fit: 3,
    rent: '€600–1,100; Rijeka is the cheap side, Opatija the pretty one.',
    house: 'possible',
    beach: 'Rock and concrete swimming platforms along the Lungomare, warm water into October.',
    train: 'Rijeka is a real city with real clubs; Opatija is not.',
    mma: true,
    food: 'Kvarner scampi, Istrian truffle and oil an hour away, a proper market in Rijeka.',
    net: 'Fibre.',
    town: 'Rijeka clinical hospital, an airport on Krk, and Trieste or Ljubljana within two hours.',
    catch:
      'The wettest corner of Croatia in its wettest season — 13 rain days in November. Opatija itself is a seasonal promenade that closes; Rijeka is a working port 15 minutes away.',
  },
  {
    id: 'dubrovnik',
    country: 'croatia',
    name: 'Dubrovnik',
    where: 'South Dalmatia',
    fit: 2,
    rent: '€900–1,600, and landlords would rather rent nightly.',
    house: 'rare',
    beach: 'Banje and the Lapad coves — beautiful, and full for four months.',
    train: 'Essentially nothing. Split is three hours up the coast.',
    mma: false,
    food: 'Priced for tourists year-round.',
    net: 'Fibre.',
    town: 'General hospital, an international airport, and a town whose economy is one thing only.',
    catch:
      'Landlords would rather rent nightly than to you, so a winter lease is a negotiation. In December the old town is nearly empty and there is essentially no training on the whole southern coast.',
  },

  // ── Montenegro ────────────────────────────────────────────────────────────
  {
    id: 'budva',
    country: 'montenegro',
    name: 'Budva',
    where: 'Montenegrin coast',
    fit: 3,
    rent: '€500–900 for a flat; houses in Bečići or Rafailovići, €800–1,300.',
    house: 'normal',
    beach: 'Mogren and Jaz, and the Sveti Stefan coast 10 minutes south.',
    train: 'MMA Klub Budva at the SCR Budva sports centre does BJJ and MMA. PitBull BJJ is the national club, based in Podgorica an hour inland.',
    mma: true,
    food: 'Balkan meat and Adriatic fish, cheap. Organic in the sense that the supply chain is short, not certified.',
    net: 'Fibre in the town, and it is adequate rather than good.',
    town: 'Health centre in town, hospital at Kotor, Tivat airport 25 minutes.',
    catch:
      'From November the beach strip is boarded up — the bars, most restaurants, the promenade kiosks. Montenegro is not in the EU, so your Polish passport buys you 90 days and then an application.',
  },
  {
    id: 'tivat',
    country: 'montenegro',
    name: 'Tivat',
    where: 'Bay of Kotor',
    fit: 3,
    rent: '€700–1,300 near Porto Montenegro; cheaper in Donja Lastva.',
    house: 'possible',
    beach: 'The bay is calm and warm but not a swimming beach; Plavi Horizonti is 15 minutes.',
    train: 'Thin locally. Budva is 20 minutes.',
    mma: false,
    food: 'Good, and Porto Montenegro prices sit on top of a cheap country.',
    net: 'Fibre around the marina.',
    town: 'The country’s main international airport is here, and the private clinics serve a yachting market.',
    catch:
      'A marina with a town attached. Porto Montenegro prices sit on top of a cheap country, and the Bay of Kotor takes 14 rain days in November and December alike.',
  },
  {
    id: 'herceg-novi',
    country: 'montenegro',
    name: 'Herceg Novi',
    where: 'Bay entrance',
    fit: 3,
    rent: '€400–800 for a flat with a sea view; stone houses above the town, €700–1,200.',
    house: 'normal',
    beach: 'A 7 km promenade with swimming platforms the whole way, and open sea rather than bay water.',
    train: 'Club level, and Dubrovnik is 40 minutes for anything else.',
    mma: false,
    food: 'Cheap market, good fish.',
    net: 'Fibre in the town.',
    town: 'General hospital, Tivat airport 30 minutes, Dubrovnik airport 40.',
    catch:
      'One of the rainiest towns on the Adriatic — 14 rain days in November — and the town is built up a steep hill, so everything is stairs.',
  },
  {
    id: 'bar',
    country: 'montenegro',
    name: 'Bar',
    where: 'South coast',
    fit: 2,
    rent: '€300–600. The cheapest coastal rent in Europe that is still a functioning town.',
    house: 'normal',
    beach: 'Long pebble beaches, and the sand at Ulcinj 30 minutes south.',
    train: 'Almost nothing. Podgorica is 45 minutes inland for PitBull BJJ, and that is the only real option.',
    mma: false,
    food: 'Olives, citrus, and the cheapest market on the Adriatic.',
    net: 'Fibre in the centre.',
    town: 'General hospital, the country’s main port, a rail line to Belgrade.',
    catch:
      'A working container port chosen purely on price. No mat, no scene, and the nearest of either is Podgorica, 45 minutes inland.',
  },

  // ── Albania ───────────────────────────────────────────────────────────────
  {
    id: 'vlore',
    country: 'albania',
    name: 'Vlorë',
    where: 'Where the Adriatic meets the Ionian',
    fit: 3,
    rent: '€300–600 for a new-build flat on the front; €500–900 for a house.',
    house: 'normal',
    beach: 'The city front is average; drive 20 minutes south to Radhimë and Orikum for the clear Ionian water.',
    train: 'Thin. Albanian BJJ is young — Prof. Dorian Lapaj is the country’s first black belt and the scene is Tirana-centred.',
    mma: false,
    food: 'Genuinely farm-to-table because the industrial supply chain never arrived. Excellent produce, cheap meat and fish.',
    net: 'Fibre in the city and it is surprisingly good — Albania rebuilt its network late and therefore new.',
    town: 'Regional hospital, Tirana airport 2 hours, and the new Vlorë airport opening changes that.',
    catch:
      'Continuous construction along the whole seafront, driving that is genuinely chaotic, and the nearest jiu-jitsu club is an hour south in Sarandë. Out of season the town is very quiet.',
  },
  {
    id: 'sarande',
    country: 'albania',
    name: 'Sarandë',
    where: 'Ionian, opposite Corfu',
    fit: 3,
    rent: '€300–650 with a sea view; houses in Ksamil, €600–1,000.',
    house: 'normal',
    beach: 'Ksamil, 15 minutes south, is the best water in Albania and one of the best in the Mediterranean.',
    train: 'HISTORIA jiu-jitsu club is here, which makes Sarandë the only Albanian beach town with a mat.',
    mma: false,
    food: 'Ionian fish, citrus, and prices roughly a third of Greece across the water.',
    net: 'Fibre in the town.',
    town: 'Regional hospital, a 30-minute ferry to Corfu, and Ioannina in Greece 2.5 hours by road.',
    catch:
      'From November Sarandë and Ksamil close almost entirely — restaurants, shops, most transport. It was built out fast and badly in the last fifteen years and it shows.',
  },
  {
    id: 'golem',
    country: 'albania',
    name: 'Durrës / Golem',
    where: 'Central coast',
    fit: 2,
    rent: '€250–550 for a flat, and €500–900 buys a house with a yard.',
    house: 'normal',
    beach: 'Long shallow sand, warm early, and crowded and murky in August.',
    train: 'Tirana is 40 minutes and has the country’s gyms.',
    mma: false,
    food: 'The main agricultural region — the cheapest good food on this entire list.',
    net: 'Fibre.',
    town: 'Regional hospital, the country’s main port, Tirana airport 30 minutes.',
    catch:
      'The beach is shallow, crowded and murky in summer and empty in winter, and the Durrës–Tirana road is one of the worst traffic corridors in the Balkans.',
  },
  {
    id: 'himare',
    country: 'albania',
    name: 'Himarë',
    where: 'Albanian Riviera',
    fit: 3,
    rent: '€350–700 for a house with a terrace over the sea.',
    house: 'normal',
    beach: 'Livadhi, Jala and Dhërmi — the best stretch of coast in the country and genuinely beautiful.',
    train: 'Nothing. The nearest mat is HISTORIA in Sarandë, an hour down a mountain road.',
    mma: false,
    food: 'Village supply: olive oil, citrus, goat, fish. Very good and very limited in choice.',
    net: 'Fibre reaches the town; the coves do not.',
    town: 'Health centre only. Vlorë is 90 minutes for a hospital.',
    catch:
      'A village on a mountain road with no mat within an hour and a half, a health centre rather than a hospital, and almost everything closed from November to May.',
  },

  // ── Bulgaria ──────────────────────────────────────────────────────────────
  {
    id: 'varna',
    country: 'bulgaria',
    name: 'Varna',
    where: 'Black Sea coast',
    fit: 3,
    rent: '€400–700 for a good flat in Briz or the Sea Garden; houses in Vinitsa, €700–1,100.',
    house: 'normal',
    beach: 'A city beach below the Sea Garden, and Golden Sands 20 minutes north. Swimmable June–September only.',
    train: 'House of Jiu-Jitsu Varna, and Yagadome runs grappling and MMA camps out of the city. A real scene, unusually strong for the size.',
    mma: true,
    food: 'The best-value market food in the EU. Bulgarian produce, dairy and meat are excellent and cost a third of Israel.',
    net: 'Bulgaria has some of the fastest and cheapest fibre in Europe — gigabit for €15.',
    town: 'University hospital, an international airport, and the country’s third city so it works all year.',
    catch:
      'The sea is 8°C in February and the season is four months, not eight. December is 8°C and the whole coastal strip is shut.',
  },
  {
    id: 'burgas',
    country: 'bulgaria',
    name: 'Burgas',
    where: 'Black Sea, south',
    fit: 3,
    rent: '€300–600 for a flat; houses in Sarafovo and Meden Rudnik, €600–1,000.',
    house: 'normal',
    beach: 'A city beach and the Sunny Beach strip 30 minutes north; the good water is south at Sozopol.',
    train: 'Bulgarian Bulls BJJ and GFTeam Burgas — two proper affiliated academies.',
    mma: false,
    food: 'Same excellent Bulgarian supply, slightly cheaper than Varna.',
    net: 'Gigabit fibre.',
    town: 'Regional hospital, an international airport, an oil-refinery economy that does not depend on tourists.',
    catch:
      'An oil-refinery city, flat and industrial, with the same four-month beach season and a coast that closes completely in October.',
  },
  {
    id: 'sozopol',
    country: 'bulgaria',
    name: 'Sozopol',
    where: 'Black Sea, south',
    fit: 2,
    rent: '€300–650 out of season.',
    house: 'normal',
    beach: 'The best water on the Bulgarian coast, in a walled old town on a peninsula.',
    train: 'None. Burgas is 30 minutes.',
    mma: false,
    food: 'Seasonal; the supermarkets are in Burgas.',
    net: 'Fibre in the town.',
    town: 'Health centre; Burgas for everything else.',
    catch:
      'A summer town of about 5,000 people. In December it is a stone village in the wind with no gym, no mat and two shops open.',
  },
  {
    id: 'sofia',
    country: 'bulgaria',
    name: 'Sofia',
    where: 'Inland capital',
    fit: 2,
    rent: '€500–900 for a good flat in Lozenets or Vitosha.',
    house: 'possible',
    beach: 'None. Vitosha mountain instead, 20 minutes from the centre.',
    train: 'Champions Academy Bulgaria and a full set of city gyms.',
    mma: true,
    food: 'Best supply in the country, still cheap.',
    net: 'Gigabit fibre.',
    town: 'The main hospitals, a hub airport with direct Tel Aviv flights, and a capital city.',
    catch:
      'Landlocked, cold, and with genuinely bad winter air quality — Sofia regularly exceeds EU particulate limits from November to February.',
  },

  // ── Poland ────────────────────────────────────────────────────────────────
  {
    id: 'sopot',
    country: 'poland',
    name: 'Gdańsk / Sopot',
    where: 'Baltic coast',
    fit: 3,
    rent: '€600–1,000 for a flat in Sopot or Wrzeszcz; houses in Oliwa, €1,000–1,600.',
    house: 'possible',
    beach: 'A genuine white sand beach and a pine forest behind it — and a sea that reaches 20°C for about six weeks.',
    train: 'Akademia Sarmatia Gdańsk is one of the best BJJ and MMA clubs in Poland, and Poland is a serious MMA country.',
    mma: true,
    food: 'Excellent and cheap: Polish meat, dairy and bread, plus Baltic fish. Organic is mainstream and affordable.',
    net: 'Full fibre, cheap.',
    town: 'University hospitals, an international airport with direct Tel Aviv flights, and a real tri-city of 1.5 million.',
    catch:
      'December is 3°C and dark by 15:30, and the Baltic is 6°C and unswimmable for eight months of the year. The Sopot seafront is dead from October.',
  },
  {
    id: 'gdynia',
    country: 'poland',
    name: 'Gdynia',
    where: 'Baltic coast',
    fit: 3,
    rent: '€500–900 for a flat — cheaper than Sopot for the same stretch of coast; houses in Orłowo, €1,100–1,600.',
    house: 'possible',
    beach: 'Orłowo and the cliff, and the Hel peninsula for wind sports.',
    train: 'The Tri-City scene is shared — Sarmatia and the Gdańsk clubs are 20 minutes by train.',
    mma: true,
    food: 'Same as Gdańsk.',
    net: 'Full fibre.',
    town: 'Modernist port city, hospital, and the airport 25 minutes.',
    catch:
      'The same Baltic winter as Sopot with less of a town to spend it in, and the beach is decorative from September.',
  },
  {
    id: 'krakow',
    country: 'poland',
    name: 'Kraków',
    where: 'Lesser Poland',
    fit: 3,
    rent: '€500–900 in Kazimierz or Podgórze.',
    house: 'rare',
    beach: 'None. The Tatras are 2 hours for hiking and skiing.',
    train: 'MMA Academy Kraków and Kotwica MMA Team — 16 BJJ gyms in the city.',
    mma: true,
    food: 'Very good markets, very cheap, and the best restaurant city in Poland.',
    net: 'Full fibre.',
    town: 'University hospitals, an international airport with Tel Aviv flights, a large young international population.',
    catch:
      'No sea at all, and Kraków winter smog is a measured problem — the city regularly exceeds EU particulate limits from November to February.',
  },
  {
    id: 'warsaw',
    country: 'poland',
    name: 'Warsaw',
    where: 'Mazovia',
    fit: 3,
    rent: '€700–1,200 for a good flat in Mokotów or Wola.',
    house: 'rare',
    beach: 'A river beach on the Vistula, and that is it.',
    train: 'Atos Warsaw, Akademia Gorila, and 20 BJJ gyms — the deepest scene in the country.',
    mma: true,
    food: 'Everything, all year, and cheap for a capital.',
    net: 'Full fibre.',
    town: 'The best hospitals in Poland, a hub airport with several daily Tel Aviv flights, and the place your Polish paperwork gets done fastest.',
    catch:
      'A landlocked capital at 52° north. December is 2°C and dark by 15:30, and the nearest sea is a four-hour drive to a closed Baltic coast.',
  },


  // ── Georgia ───────────────────────────────────────────────────────────────
  {
    id: 'batumi',
    country: 'georgia',
    name: 'Batumi',
    where: 'Black Sea',
    fit: 3,
    rent: '€300–700 for a sea-view flat in a new tower; houses in the hills behind, €500–900.',
    house: 'possible',
    beach: 'A pebble city beach and a long boulevard. Sea usable June–September.',
    train: 'Batumi Boxing Academy does MMA and kickboxing; Georgian wrestling and judo culture is world-class but the BJJ is in Tbilisi.',
    mma: false,
    food: 'Georgian food is one of the genuine reasons to go. Real markets, real meat, real vegetables, almost free by Israeli standards.',
    net: 'Fibre in the city, and a large crypto and remote-work population that stress-tests it.',
    town: 'Republican hospital, an international airport, and Turkey 20 minutes down the road.',
    catch:
      'Over 2,000 mm of rain a year, more than double Chania, and 13 rain days in each of November and December. In winter it is a half-empty city of empty towers.',
  },
  {
    id: 'tbilisi',
    country: 'georgia',
    name: 'Tbilisi',
    where: 'Inland capital',
    fit: 3,
    rent: '€400–800 in Vake or Saburtalo.',
    house: 'possible',
    beach: 'None. The Caucasus instead, 90 minutes for real mountains.',
    train: 'Warriors Tbilisi, GLADIUS, Legion BJJ, Gymnasia Sports. For a city of a million this is a deep scene, and the wrestling base makes the rooms hard.',
    mma: true,
    food: 'Dezerter Bazaar. The best food-per-euro on this list, without exception.',
    net: 'Fibre, cheap and reliable.',
    town: 'Good private hospitals, a hub airport with direct Tel Aviv flights, and the 1% small-business regime registered in an afternoon.',
    catch:
      'No sea, a 7°C grey December, and a land border with Russia that makes any long-term plan a political question.',
  },
  {
    id: 'kobuleti',
    country: 'georgia',
    name: 'Kobuleti',
    where: 'Black Sea, north of Batumi',
    fit: 2,
    rent: '€200–450. The cheapest entry on this list.',
    house: 'normal',
    beach: 'A long quiet pebble beach with no towers on it.',
    train: 'Nothing here. Batumi is 30 minutes for the boxing academy, Tbilisi six hours for the mats.',
    mma: false,
    food: 'Village markets, subtropical fruit, tea plantations.',
    net: 'Fibre in the town, patchy outside.',
    town: 'Health centre; Batumi 30 minutes for everything.',
    catch:
      'A quiet strip town with no mat, no scene and a hospital 30 minutes away in Batumi, in the rainiest part of the Black Sea.',
  },

  // ── UAE ───────────────────────────────────────────────────────────────────
  {
    id: 'jbr',
    country: 'uae',
    name: 'Dubai Marina / JBR',
    where: 'Dubai',
    fit: 3,
    rent: 'AED 90,000–140,000/year for a 1-bed — €2,100–3,300 a month, paid in one or two cheques up front.',
    house: 'rare',
    beach: 'JBR beach with a running track along it, and 30°C sea water for most of the year.',
    train: 'The Forge x Roger Gracie Dubai, Alliance Dubai, Atrixion, 971 MMA, Gracie Barra. Jiu-jitsu is a state-backed sport here — the mats are world class.',
    mma: true,
    food: 'Everything on earth is imported and available. It is excellent and it costs Zurich prices.',
    net: 'Gigabit fibre everywhere, and the most reliable infrastructure on this list.',
    town: 'World-class private hospitals, a hub airport, a 3-hour flight home, and no tax on personal income.',
    catch:
      'A furnished 1-bed is €2,100–3,300 a month and often demands one or two cheques up front. May to September is 40–45°C and you live indoors — and your window starts in exactly the hottest month.',
  },
  {
    id: 'dubai-hills',
    country: 'uae',
    name: 'Dubai Hills / Arjan',
    where: 'Dubai, inland',
    fit: 2,
    rent: 'AED 70,000–110,000/year — the cheaper end of a good Dubai address.',
    house: 'possible',
    beach: 'None nearby. The beach is a 25-minute drive in traffic.',
    train: 'The city’s academies are all within 20 minutes.',
    mma: true,
    food: 'Same imported abundance.',
    net: 'Gigabit fibre.',
    town: 'New hospitals, parks, and villa communities where a whole house is realistic.',
    catch:
      'A suburb in a desert with no beach within 25 minutes of traffic, at a rent higher than Tel Aviv, where you would drive everywhere.',
  },
  {
    id: 'saadiyat',
    country: 'uae',
    name: 'Abu Dhabi (Saadiyat)',
    where: 'Abu Dhabi',
    fit: 3,
    rent: 'AED 80,000–130,000/year, and more space per dirham than Dubai.',
    house: 'possible',
    beach: 'Saadiyat public beach is the best natural beach in the UAE — real sand, turtles, no towers on it.',
    train: 'Abu Dhabi is the home of the UAE Jiu-Jitsu Federation and the World Pro. Every school is federation-accredited.',
    mma: true,
    food: 'Same as Dubai, marginally cheaper.',
    net: 'Gigabit fibre.',
    town: 'Cleveland Clinic Abu Dhabi, an international airport, and a calmer city than Dubai.',
    catch:
      'Quiet to the point of dull if you are 21, with the same five months of unliveable heat and Dubai an hour away for anything that happens at night.',
  },

  // ── Thailand ──────────────────────────────────────────────────────────────
  {
    id: 'rawai',
    country: 'thailand',
    name: 'Phuket — Rawai / Chalong',
    where: 'South Phuket',
    fit: 4,
    rent: '฿25,000–45,000/month (€650–1,150) for a 2–3 bed pool villa. A whole house with a pool is the ordinary rental here.',
    house: 'normal',
    beach: 'Rawai is a longtail harbour rather than a swimming beach; Nai Harn and Ya Nui are 5 minutes and are excellent.',
    train: 'Tiger Muay Thai, AKA Thailand, Southside MMA — the highest concentration of professional fight gyms on earth, with daily MMA and BJJ. Nothing anywhere else on this list comes close.',
    mma: true,
    food: 'Fresh markets daily, exceptional seafood, and a large health-food economy built around the gyms. Eating clean here is easier than in Tel Aviv.',
    net: 'Fibre is universal and cheap — ฿600/month for 500 Mbps. Power cuts are the real risk, so a UPS is not optional.',
    town: 'Bangkok Hospital Phuket is genuinely international-standard, and the airport has direct flights across Asia.',
    catch:
      'The New York open is 20:30 local and the close is 03:00, so you would trade every night for four months. September and October are the monsoon — 21 and 19 rain days.',
  },
  {
    id: 'bangtao',
    country: 'thailand',
    name: 'Phuket — Bangtao / Cherngtalay',
    where: 'North-west Phuket',
    fit: 4,
    rent: '฿40,000–70,000/month (€1,000–1,800) for a villa in the Laguna area.',
    house: 'normal',
    beach: 'Bang Tao is 6 km of open sand, the best long beach on the island.',
    train: 'Bangtao Muay Thai & MMA — multiple rings, MMA mats, BJJ, strength and conditioning, one of the most respected gyms in Asia.',
    mma: true,
    food: 'The most developed organic and health-food scene in Thailand outside Bangkok.',
    net: 'Fibre.',
    town: 'International schools, private hospitals, and the largest Western population on the island.',
    catch:
      'Same night-trading problem, same monsoon start, and it is the expensive end of Phuket at €1,000–1,800 for a villa.',
  },
  {
    id: 'koh-samui',
    country: 'thailand',
    name: 'Koh Samui',
    where: 'Gulf of Thailand',
    fit: 3,
    rent: '฿25,000–50,000/month for a villa in Lamai or Maenam.',
    house: 'normal',
    beach: 'Chaweng and Lamai, calm Gulf water, and a different monsoon timing from Phuket — Samui’s rain is October to December.',
    train: 'Superpro Samui has four rings, an MMA cage and a large BJJ dojo; Lamai Muay Thai and Punch It for striking.',
    mma: true,
    food: 'Good markets, excellent seafood, a smaller organic scene than Phuket.',
    net: 'Fibre in the main towns; the island depends on a submarine link that occasionally fails.',
    town: 'Bangkok Hospital Samui, and a small airport where flights cost several times the Phuket equivalent.',
    catch:
      'The worst-timed place on this list: Samui takes its monsoon in October, November and December, with November the wettest month of its year at 21 rain days.',
  },
  {
    id: 'chiang-mai',
    country: 'thailand',
    name: 'Chiang Mai',
    where: 'Northern Thailand',
    fit: 2,
    rent: '฿15,000–30,000/month for a house with a garden — the cheapest good living on this list.',
    house: 'normal',
    beach: 'None. Mountains and waterfalls instead.',
    train: 'Tiger Muay Thai has a Chiang Mai location, Santai for stadium-style Muay Thai, and a real BJJ scene in a city full of remote workers.',
    mma: true,
    food: 'Northern Thai markets, cheap and excellent, plus the largest vegan and organic scene in Asia.',
    net: 'The best and cheapest fibre on this list. Gigabit for €20.',
    town: 'Excellent private hospitals, an international airport, and a huge established foreign community.',
    catch:
      'No sea at all, and the same 20:30 New York open. Burning season starts in February with air quality regularly above 200 AQI — you would be leaving just as it begins.',
  },
  {
    id: 'ao-nang',
    country: 'thailand',
    name: 'Krabi / Ao Nang',
    where: 'Andaman coast',
    fit: 2,
    rent: '฿15,000–30,000/month for a house.',
    house: 'normal',
    beach: 'Railay and the limestone islands — the most dramatic coastline in Thailand, 15 minutes by longtail.',
    train: 'Muay Thai gyms yes, serious MMA no. Phuket is 3 hours by road.',
    mma: false,
    food: 'Market towns, southern Thai food, very cheap.',
    net: 'Fibre in Ao Nang.',
    town: 'Krabi hospital, an international airport, and a town that is quieter than Phuket in every way.',
    catch:
      'No serious MMA, and Phuket is three hours by road. September and October are 19–21 rain days of monsoon.',
  },

  // ── Costa Rica ────────────────────────────────────────────────────────────
  {
    id: 'tamarindo',
    country: 'costa-rica',
    name: 'Tamarindo',
    where: 'Guanacaste',
    fit: 4,
    rent: '$1,200–2,200 for a house with a pool in Tamarindo or Langosta.',
    house: 'normal',
    beach: 'A long surf beach with beginner-friendly waves, warm water all year, and Playa Grande next door.',
    train: 'Hero Academy runs BJJ, MMA and boxing in the centre of town on a full weekly schedule — the strongest mat in Guanacaste.',
    mma: true,
    food: 'Farmers markets, tropical fruit, grass-fed beef, and a large health-conscious expat economy. Imported goods are heavily taxed.',
    net: 'Fibre in the town, and Starlink is the standard fallback for anywhere outside it.',
    town: 'Private clinics locally, Liberia international airport 75 minutes with direct US flights.',
    catch:
      'Israel is eight hours ahead, so your family is asleep while you work and awake while you sleep, and a flight home is 20 hours with two connections. September and October are 20–21 rain days.',
  },
  {
    id: 'santa-teresa',
    country: 'costa-rica',
    name: 'Santa Teresa',
    where: 'Nicoya peninsula',
    fit: 4,
    rent: '$1,000–2,000 for a jungle house near the beach.',
    house: 'normal',
    beach: 'One of the best surf beaches in Central America, and 5 km of sand with almost nothing built on it.',
    train: 'Santa Teresa MMA runs MMA and BJJ year-round for a town of this size, which is genuinely unusual.',
    mma: true,
    food: 'Small organic supply, excellent fish, and everything else is trucked in expensively.',
    net: 'Fibre reached the town recently; Starlink is still what most people run.',
    town: 'A clinic, not a hospital. The nearest real one is 90 minutes.',
    catch:
      'The access road is dirt — dust in the dry season, mud in October — and getting here is a ferry plus two hours. The nearest hospital is 90 minutes away.',
  },
  {
    id: 'jaco',
    country: 'costa-rica',
    name: 'Jacó',
    where: 'Central Pacific',
    fit: 3,
    rent: '$900–1,600 for a condo or a small house.',
    house: 'possible',
    beach: 'A long grey-sand surf beach, and Playa Hermosa next door for the serious waves.',
    train: 'Jaco Jiu Jitsu trains on a rooftop with an ocean view; Soca BJJ also runs classes in town.',
    mma: false,
    food: 'Supermarkets and a Friday feria; better supply than the remote towns because San José is 90 minutes.',
    net: 'Fibre.',
    town: 'Clinic in town, hospital in Puntarenas, and San José’s international airport 90 minutes.',
    catch:
      'It is the nightlife and party town of the Pacific coast, with the prostitution and drug trade that comes with that. September and October are the wettest months of the year.',
  },
  {
    id: 'playas-del-coco',
    country: 'costa-rica',
    name: 'Playas del Coco',
    where: 'Guanacaste, north',
    fit: 3,
    rent: '$800–1,500 — the best value on the Costa Rican coast.',
    house: 'normal',
    beach: 'A calm swimming bay rather than a surf beach, which is rare here.',
    train: 'Coco Beach MMA runs BJJ and MMA in town.',
    mma: true,
    food: 'Decent supermarkets, a real town economy, cheaper than Tamarindo.',
    net: 'Fibre.',
    town: 'Clinics locally, Liberia airport 25 minutes — the shortest airport run in the country.',
    catch:
      'The driest part of Costa Rica, which means brown and dusty from January, and everything imported is heavily taxed — a supermarket shop costs close to European prices.',
  },
  {
    id: 'uvita',
    country: 'costa-rica',
    name: 'Uvita / Dominical',
    where: 'South Pacific',
    fit: 3,
    rent: '$700–1,400 for a house in the hills with a view.',
    house: 'normal',
    beach: 'Marino Ballena national park, whale watching, and empty sand.',
    train: 'Small BJJ community, no fixed MMA room.',
    mma: false,
    food: 'The best organic farmers market in Costa Rica, on Saturdays in Uvita.',
    net: 'Fibre in the town, Starlink in the hills.',
    town: 'Clinic; the hospital is in San Isidro, an hour inland.',
    catch:
      'Over 4,000 mm of rain a year, and 24–25 rain days in each of September and October. The hospital is an hour inland at San Isidro.',
  },

  // ── Mexico ────────────────────────────────────────────────────────────────
  {
    id: 'playa-del-carmen',
    country: 'mexico',
    name: 'Playa del Carmen',
    where: 'Riviera Maya',
    fit: 4,
    rent: '$700–1,400 for a 2-bed with a pool in Zazil-Ha or Playacar.',
    house: 'possible',
    beach: 'Caribbean water at 28°C, and Cozumel across the channel for diving.',
    train: 'Gracie Barra Playa del Carmen (jiu-jitsu, Muay Thai, MMA) and Team Balance Mexico. A real, established scene.',
    mma: true,
    food: 'Mercado 28 and Chedraui Selecto; excellent produce, cheap meat, and a large health-food sector serving the expat population.',
    net: 'Fibre through the city, and Starlink as a cheap backup.',
    town: 'Private hospitals to international standard, Cancún airport 50 minutes, and direct flights across the Americas and Europe.',
    catch:
      'September and October are peak hurricane season and very humid. Sargassum seaweed can make the beach unusable for weeks between April and August, and the Quintana Roo security picture has worsened since 2020.',
  },
  {
    id: 'tulum',
    country: 'mexico',
    name: 'Tulum',
    where: 'Riviera Maya, south',
    fit: 3,
    rent: '$900–1,800, and prices have gone up faster than the infrastructure.',
    house: 'possible',
    beach: 'The most photographed beach in Mexico, and the cenotes inland.',
    train: 'Jiujitsu Tulum, and the B-Team academy is opening a permanent base at the Zamaya resort outside town.',
    mma: true,
    food: 'Organic everything, priced for people on holiday.',
    net: 'Fibre in the town centre; the beach road is unreliable and expensive.',
    town: 'Clinics only; Playa del Carmen 45 minutes for a hospital. New Tulum airport opened 2023.',
    catch:
      'The power and water infrastructure has not kept up with the building — the beach zone runs on generators more often than anyone admits, and the internet on the beach road is unreliable and expensive.',
  },
  {
    id: 'puerto-escondido',
    country: 'mexico',
    name: 'Puerto Escondido',
    where: 'Oaxaca coast',
    fit: 3,
    rent: '$500–1,000 for a house in La Punta or Rinconada.',
    house: 'normal',
    beach: 'Zicatela is a world-class barrel; Carrizalillo and Puerto Angelito are the swimming ones.',
    train: 'La Colonia Jiu Jitsu is the local academy, and BJJ in Paradise runs camps here.',
    mma: false,
    food: 'Oaxaca is the best food region in Mexico and the market prices are local, not expat.',
    net: 'Fibre in town, and it is the weak point — most remote workers run a backup.',
    town: 'Small hospital, a domestic airport with Mexico City flights, and a growing year-round foreign population.',
    catch:
      'Getting anywhere means Mexico City first. September is 16 rain days and the summer is 31°C at high humidity.',
  },
  {
    id: 'puerto-vallarta',
    country: 'mexico',
    name: 'Puerto Vallarta',
    where: 'Jalisco, Pacific',
    fit: 3,
    rent: '$700–1,300 in Versalles or Fluvial — the neighbourhoods where people actually live.',
    house: 'possible',
    beach: 'The Banderas Bay beaches, calm water, and Sayulita 45 minutes north.',
    train: 'City gyms and BJJ clubs; a solid scene without a standout room.',
    mma: false,
    food: 'A real Mexican city market economy plus everything an expat wants.',
    net: 'Fibre.',
    town: 'Good private hospitals, an international airport with direct US and Canadian flights, a city that works all year.',
    catch:
      'September is the wettest month and peak hurricane risk, at 32°C and around 80% humidity.',
  },
  {
    id: 'merida',
    country: 'mexico',
    name: 'Mérida',
    where: 'Yucatán',
    fit: 2,
    rent: '$500–1,000 for a colonial house with a pool in Centro or Santiago.',
    house: 'normal',
    beach: 'Progreso is 35 minutes and it is a flat, shallow, unremarkable Gulf beach.',
    train: 'A real city scene with several BJJ academies.',
    mma: true,
    food: 'Yucatecan food, huge markets, and the lowest prices of any Mexican city this size.',
    net: 'Fibre.',
    town: 'The safest city in Mexico by a distance, with excellent private hospitals and an international airport.',
    catch:
      'It is inland and reaches 38°C in May with no sea to escape to — Progreso is 35 minutes and is a flat, shallow, unremarkable Gulf beach.',
  },

  // ── Panama ────────────────────────────────────────────────────────────────
  {
    id: 'panama-city',
    country: 'panama',
    name: 'Panama City',
    where: 'Costa del Este · Punta Pacífica',
    fit: 3,
    rent: '$1,000–1,800 for a modern high-rise 2-bed.',
    house: 'rare',
    beach: 'Not in the city — the Pacific here is muddy. The beach towns are 60–90 minutes west.',
    train: 'An Atos Jiu-Jitsu affiliate runs in the city, plus commercial MMA gyms.',
    mma: true,
    food: 'Everything imported and available, priced in US dollars.',
    net: 'The best connectivity in Central America — the region’s internet lands here.',
    town: 'Punta Pacífica hospital is Johns Hopkins-affiliated, and Tocumen is the hub airport of the Americas.',
    catch:
      'The Pacific here is muddy and not swimmable, the beach towns are 60–90 minutes west, and September to November are the three wettest months of the year at 19–21 rain days each.',
  },
  {
    id: 'coronado',
    country: 'panama',
    name: 'Playa Coronado',
    where: 'Pacific coast',
    fit: 3,
    rent: '$800–1,500 for a house with a pool.',
    house: 'normal',
    beach: 'A long black-and-white sand beach, and the surf breaks at Santa Catalina further west.',
    train: 'Playa Coronado BJJ, at Nueva Gorgona nearby, is an established BJJ Globetrotters academy.',
    mma: false,
    food: 'Supermarkets serving a large expat community, and a produce market at the highway.',
    net: 'Fibre along the coastal highway.',
    town: 'Clinics locally, Panama City 75 minutes for hospitals and the airport.',
    catch:
      'A retirement coast where the median age is not yours, hot and humid year-round, and Panama City is 75 minutes away for a hospital or an airport.',
  },
  {
    id: 'bocas',
    country: 'panama',
    name: 'Bocas del Toro',
    where: 'Caribbean, north',
    fit: 3,
    rent: '$600–1,200 for a wooden house over the water.',
    house: 'normal',
    beach: 'Caribbean islands, reef, and Red Frog and Starfish beaches by boat.',
    train: 'Bocas Fight Gym runs no-gi BJJ three evenings a week plus open mat — remarkable for an island this remote.',
    mma: false,
    food: 'Island supply: expensive, limited, and the fish is the good part.',
    net: 'Fibre reached the main island, and it still goes down.',
    town: 'A small hospital, a domestic airstrip, and a boat for everything else.',
    catch:
      'November and December are the wettest months of the year at 20–21 rain days, the boats stop when it is rough, and the nearest real hospital is a flight away.',
  },
  {
    id: 'pedasi',
    country: 'panama',
    name: 'Pedasí',
    where: 'Azuero peninsula',
    fit: 2,
    rent: '$500–1,000 for a house in the village.',
    house: 'normal',
    beach: 'Playa Venao, 30 minutes, is one of the best surf beaches in Central America.',
    train: 'Nothing, and nothing within an hour. Panama City is four hours away.',
    mma: false,
    food: 'Village markets and cattle country.',
    net: 'Fibre in the village.',
    town: 'A clinic; Chitré is an hour for a hospital, Panama City four hours.',
    catch:
      'A village four hours from Panama City with no mat, no scene, and a clinic rather than a hospital — Chitré is an hour away.',
  },

  // ── United States ─────────────────────────────────────────────────────────
  {
    id: 'fort-lauderdale',
    country: 'usa',
    name: 'Miami / Fort Lauderdale',
    where: 'South Florida',
    fit: 3,
    rent: '$2,200–3,500 for a 1-bed anywhere near the water.',
    house: 'rare',
    beach: 'Warm Atlantic all year, a beachfront running path, and an outdoor culture that never stops.',
    train: 'American Top Team, Fight Sports Miami (Cyborg Abreu), Atos Miami, Valente Brothers, Mario Sperry. The densest elite jiu-jitsu in the world outside Rio.',
    mma: true,
    food: 'Everything, including a large kosher and Israeli food economy in Aventura and Surfside.',
    net: 'Gigabit fibre and cable, and the market’s data centres are in the same time zone.',
    town: 'Every hospital and every flight, a large Israeli community, and the trading day starts at 09:30 where you live.',
    catch:
      'You have no right to be there. Both your passports give 90 visa-free days as a visitor with no work rights, and E-2 or O-1 are years and lawyers. September is peak hurricane season.',
  },
  {
    id: 'st-petersburg',
    country: 'usa',
    name: 'Tampa / St Petersburg',
    where: 'Gulf coast, Florida',
    fit: 3,
    rent: '$1,700–2,600, and a house with a yard is realistic here in a way it is not in Miami.',
    house: 'possible',
    beach: 'St Pete Beach and Clearwater — calm Gulf water, white sand, warm from March to November.',
    train: 'South Tampa Jiu-Jitsu & MMA, De La Riva BJJ, Gracie Tampa South. A deep scene, less famous than Miami.',
    mma: true,
    food: 'Excellent and cheaper than South Florida.',
    net: 'Gigabit.',
    town: 'Good hospitals, an international airport, no state income tax.',
    catch:
      'The same 90-day visitor limit, and this coast takes a direct hurricane threat most years — September is the peak of it.',
  },
  {
    id: 'san-diego',
    country: 'usa',
    name: 'San Diego',
    where: 'Southern California',
    fit: 3,
    rent: '$2,400–3,800 for a 1-bed in Pacific Beach or North Park.',
    house: 'rare',
    beach: 'The best climate in the United States — 20°C in January, sun most days, and the Pacific at 17–21°C.',
    train: 'The American mecca: Legion American Jiu Jitsu (Keenan Cornelius), Victory MMA (Jocko Willink, Dean Lister), The Arena, BJJ Revolution two blocks from Pacific Beach.',
    mma: true,
    food: 'Year-round Californian produce, the best farmers markets in the US.',
    net: 'Gigabit.',
    town: 'Excellent hospitals, an international airport, and a running and outdoor culture that matches the brief exactly.',
    catch:
      'California taxes worldwide income at up to 13.3% on top of federal, a 1-bed in Pacific Beach is $2,400–3,800, and you still have only 90 visa-free days.',
  },
  {
    id: 'austin',
    country: 'usa',
    name: 'Austin',
    where: 'Texas',
    fit: 2,
    rent: '$1,600–2,600 for a 1-bed, and a house with a yard is realistic outside the centre.',
    house: 'possible',
    beach: 'None. Lakes and rivers instead.',
    train: 'Onnit Academy, Gracie Humaitá Austin, and a strong scene around the local fight community.',
    mma: true,
    food: 'Very good, and Texas has no state income tax.',
    net: 'Gigabit.',
    town: 'Good hospitals, a major airport, and a large trading and tech population.',
    catch:
      'Landlocked, 38°C for four months, and the same 90-day visitor limit. It is here for the tax and the training only.',
  },
]

/**
 * The monthly total, built from ./costs.ts rather than stored here.
 *
 * Keeping one number in two files is how the two stop agreeing, so the total is
 * always the sum of the lines.
 */
const monthly = (place: Place) => monthlyOf(place)

export type PlaceFilter = {
  /** Highest acceptable monthly all-in cost; Infinity for no ceiling. */
  budget?: number
  /** Only towns with a real MMA or BJJ room running an adult schedule. */
  mmaOnly?: boolean
  /** Only towns where renting a whole house long-term is normal. */
  houseOnly?: boolean
  /** Country slugs to keep; empty means all. */
  countries?: string[]
  /** Free text over the name, region and the prose. */
  query?: string
}

const HAYSTACK = (place: Place) =>
  [place.name, place.where, place.train, place.beach, place.town, place.catch]
    .join(' ')
    .toLowerCase()

export function filterPlaces(places: Place[], filter: PlaceFilter): Place[] {
  const query = filter.query?.trim().toLowerCase()
  return places.filter((place) => {
    if (filter.budget != null && monthly(place) > filter.budget) return false
    if (filter.mmaOnly && !place.mma) return false
    if (filter.houseOnly && place.house !== 'normal') return false
    if (filter.countries?.length && !filter.countries.includes(place.country)) return false
    if (query && !HAYSTACK(place).includes(query)) return false
    return true
  })
}

export type SortKey = 'fit' | 'cost' | 'name'

export function sortPlaces(places: Place[], key: SortKey): Place[] {
  const sorted = [...places]
  if (key === 'cost') return sorted.sort((a, b) => monthly(a) - monthly(b) || b.fit - a.fit)
  if (key === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name))
  return sorted.sort((a, b) => b.fit - a.fit || monthly(a) - monthly(b))
}

export function placesOf(country: string): Place[] {
  return PLACES.filter((place) => place.country === country)
}

/** What a country costs, as the range its towns actually span. */
export function costRange(places: Place[]): { low: number; high: number } | null {
  if (places.length === 0) return null
  const costs = places.map((place) => monthly(place))
  return { low: Math.min(...costs), high: Math.max(...costs) }
}
