/**
 * Where in the town, specifically.
 *
 * "Chania" is not an address. The difference between Halepa and Nerokourou is
 * forty minutes of your day, €400 a month, and whether you can walk to the gym
 * at 19:00 — and no amount of country-level research surfaces it.
 *
 * Each entry is a real neighbourhood, priced for a furnished let over late
 * September to December, with the three distances that actually shape a day:
 * to the mat, to the water, to a supermarket. The downside is the specific
 * thing about that street, not a general observation about the country.
 *
 * Written for the five countries on the shortlist — Malta, Italy, Spain, Greece
 * and Cyprus. Everywhere else still has town-level detail on its own card.
 */
import type { PlaceId } from './places'

export type StayOption = {
  name: string
  /** The kind of building and what you would get for the money. */
  what: string
  /** A furnished let, late September to December, per month. */
  rent: string
  /** To the named gym on the town's card. */
  toGym: string
  toBeach: string
  toShops: string
  /** Fibre at this address specifically. */
  net: string
  /** The concrete problem with this street. */
  downside: string
}

export const STAYS: Partial<Record<PlaceId, StayOption[]>> = {
  // ── Malta ─────────────────────────────────────────────────────────────────
  sliema: [
    {
      name: 'The Ferries / Tigné seafront',
      what: 'A furnished 2-bed in one of the newer blocks facing the water, lift, air conditioning, usually a small balcony.',
      rent: '€1,100–1,500 on a four-month let, against €1,600–2,000 in summer.',
      toGym: '10 minutes on foot to Malta Fight Co. on Triq Sant’ Antnin — everything taught in English.',
      toBeach: 'You swim off the rock ledges on the Sliema front — steps and ladders, 2 minutes, clean water, no sand anywhere.',
      toShops: 'Two large supermarkets within 5 minutes; The Point mall is at Tigné.',
      net: 'Melita and GO both do gigabit here. Universal FTTH — this is one of the few addresses on the whole list you do not need to check.',
      downside: 'The seafront road is loud until midnight and the Tigné construction is continuous. Ask for a flat facing away from Triq ix-Xatt.',
    },
    {
      name: 'Sliema back streets — Fond Għadir / Għar id-Dud',
      what: 'Older townhouse conversions, higher ceilings, no lift, often no air conditioning in the bedrooms.',
      rent: '€850–1,150 off-season.',
      toGym: '12 minutes on foot to Malta Fight Co., the same room.',
      toBeach: '4 minutes to the same rock ledges; the Exiles swimming spot is 6.',
      toShops: 'Everything within 5 minutes.',
      net: 'Fibre in the street, but an old conversion may still be on a shared line — ask which flat the router serves.',
      downside: 'Third-floor walk-ups are normal and Maltese stairs are steep. Winter damp in the old stone is real and there is no central heating anywhere on the island.',
    },
  ],
  gzira: [
    {
      name: 'Gżira seafront, facing Manoel Island',
      what: 'Modern 1- and 2-beds in blocks along Triq ix-Xatt, most with a balcony over the creek.',
      rent: '€750–1,000 off-season — the cheapest address that is still a 15-minute walk from Sliema.',
      toGym: '15 minutes on foot to Malta Fight Co., or 6 by bus.',
      toBeach: '12 minutes to the Sliema ledges. The creek itself is a marina, not for swimming.',
      toShops: 'A large Lidl and a Welbee’s within 5 minutes.',
      net: 'Gigabit fibre throughout.',
      downside: 'The Gżira seafront road is one of the worst traffic corridors on the island and the noise does not stop. The Manoel Island redevelopment is a building site.',
    },
  ],
  mellieha: [
    {
      name: 'Mellieħa town, above the bay',
      what: 'This is where a whole house with outdoor space is actually affordable in Malta — 3-bed maisonettes with a roof terrace.',
      rent: '€850–1,200 off-season, and you can negotiate hard for December.',
      toGym: 'There is nothing local. Malta Fight Co. is 35–45 minutes by car depending on the traffic, which is the whole objection to Mellieħa.',
      toBeach: 'Għadira, Malta’s biggest sand beach, is a 10-minute walk downhill and a 20-minute climb back.',
      toShops: 'A full supermarket in the town square.',
      net: "Fibre in the town from GO and Melita, gigabit, no address check needed.",
      downside: 'The town is on a hill and everything is a climb. Without a car you are dependent on a bus route that takes 50 minutes to Valletta.',
    },
  ],
  gozo: [
    {
      name: 'Marsalforn and Xlendi',
      what: 'Converted farmhouses with a private pool and a courtyard — the one place in Malta where the house you actually wanted is normal and affordable.',
      rent: '€700–1,000 for a farmhouse from October, against €1,800+ in August.',
      toGym: 'Commercial gyms in Victoria, 10 minutes. Every mat session is a 25-minute ferry plus 45 minutes of Malta.',
      toBeach: 'Xlendi Bay and Marsalforn are swimming-off-rock bays; Ramla’s red sand is 15 minutes by car.',
      toShops: 'Victoria has everything and is 10 minutes from either.',
      net: 'Fibre reaches both towns; outlying farmhouses may not — check the specific building.',
      downside: 'By December, Marsalforn is perhaps a third open and Xlendi mostly closed. You need a car, and the last ferry back is a thing you will plan evenings around.',
    },
  ],

  // ── Italy ─────────────────────────────────────────────────────────────────
  'aci-castello': [
    {
      name: 'Aci Trezza',
      what: 'Fishing-village flats above the harbour, most with a terrace, in buildings from the 1960s and 70s.',
      rent: "€600–850 furnished, against €700–1,200 on a twelve-month lease.",
      toGym: '15 minutes by car into Catania for BJJ Catania or Fundamental BJJ; there is nothing in the village.',
      toBeach: 'You swim off the lava rock at the Faraglioni, 3 minutes. La Playa sand is 25 minutes south.',
      toShops: 'A small supermarket in the village, a full Conad 5 minutes away in Aci Castello.',
      net: 'FTTH from TIM and Open Fiber along the coast road. Insist on FTTH — a lot of Sicilian listings say "fibra" and mean FTTC at 100/20.',
      downside: 'You need a car. The village is quiet by November and the Catania road is slow in the morning.',
    },
    {
      name: 'Catania — Corso Italia / Vittorio Veneto',
      what: 'Large flats in solid 20th-century blocks, the residential part of the city rather than the tourist centre.',
      rent: '€600–850 furnished, against €700–1,200 on a twelve-month lease.',
      toGym: '10–15 minutes on foot to two or three of the five academies.',
      toBeach: 'La Playa is 15 minutes by car or a short metro-plus-bus.',
      toShops: 'Everything on the doorstep, including the fish market you would actually be here for.',
      net: 'Best fibre in eastern Sicily.',
      downside: 'It is a working port city — noisy, scruffy, and parking is genuinely difficult. Etna ash falls on the cars a few times a year.',
    },
  ],
  mondello: [
    {
      name: 'Mondello — Valdesi',
      what: 'Villas and villa apartments behind the bay, gardens, mostly summer houses let cheaply out of season.',
      rent: '€600–900 from October, against €1,400 in August.',
      toGym: '20 minutes into Palermo for anything serious.',
      toBeach: 'Two minutes to white sand and shallow, sheltered water — the best swimming bay in Sicily.',
      toShops: 'Small shops in Mondello; the real supermarkets are on the Palermo road.',
      net: 'Fibre in the built-up part of Mondello; the villas at the back of Valdesi can still be on copper.',
      downside: 'Mondello is a summer suburb. By November it is very quiet, and you are 20 minutes from Palermo for everything.',
    },
  ],
  monopoli: [
    {
      name: 'Monopoli centro storico',
      what: 'Restored stone flats inside the old walls, thick walls, small windows, often a roof terrace.',
      rent: '€650–900 furnished from October.',
      toGym: 'Nothing in town. WCRA Bari is 40 minutes by car or a 45-minute train.',
      toBeach: 'Cala Porta Vecchia is inside the old town — you walk down steps to it. Rock coves every kilometre north and south.',
      toShops: "5 minutes on foot to supermarkets and the daily market outside the walls.",
      net: "FTTH on the plateau from TIM and Open Fiber — 1 Gbps for about €30.",
      downside: 'The old town has no parking and stone houses in an Adriatic December are cold — Puglia is 14°C in December and heating is expensive electric.',
    },
    {
      name: 'Polignano a Mare — outside the old town',
      what: 'Newer flats on the plateau above the cliffs, balconies, and easier parking.',
      rent: '€600–850 furnished off-season.',
      toGym: 'Same answer — Bari, 35 minutes.',
      toBeach: 'Lama Monachile is the famous cove, 5 minutes on foot and unswimmable in a swell.',
      toShops: '5 minutes on foot to a supermarket; the market is in Monopoli, 10 minutes away.',
      net: 'FTTH on the plateau from TIM and Open Fiber, 1 Gbps for about €30.',
      downside: 'Polignano is a day-trip town. Beautiful, and it empties completely after October.',
    },
  ],
  lecce: [
    {
      name: 'Lecce — Santa Rosa / Mazzini',
      what: 'Big student-city flats in the newer quarters, cheap and well served.',
      rent: "€450–700 furnished, the cheapest city rent of the five shortlisted countries.",
      toGym: 'University-town clubs in the city; nothing that runs a serious MMA schedule.',
      toBeach: 'You need a car. San Cataldo is 20 minutes, Torre dell’Orso 30, and both are empty by November.',
      toShops: "Everything on foot — this is a student city of 95,000 with a full centre.",
      net: 'FTTH across the city.',
      downside: 'Lecce is 25 minutes from the sea. Choosing the Salento and then living inland in it is the mistake to avoid.',
    },
  ],
  cagliari: [
    {
      name: 'Poetto — Quartu end',
      what: 'Flats along the beach road, most with a balcony facing the water, let long-term from October.',
      rent: "€550–800 furnished, and landlords expect a long winter let.",
      toGym: '15 minutes by car to CL Fight Team or Riot Academy in the city.',
      toBeach: 'Across the road. Poetto is 8 km of sand you can run on every morning.',
      toShops: 'Supermarkets along Viale Marconi, 5 minutes.',
      net: "FTTH across the old city, 1 Gbps for €25–35.",
      downside: 'The mistral makes the beachfront genuinely cold from November, and the Poetto strip is a summer economy — most of the kiosks shut.',
    },
    {
      name: 'Cagliari — Villanova / Bonaria',
      what: 'Old-city flats a short walk from the market and the port, high ceilings, no lift.',
      rent: '€550–800 furnished, and cheaper than the Poetto seafront.',
      toGym: '10 minutes on foot or a short bus.',
      toBeach: 'Poetto is 15 minutes by bus.',
      toShops: 'San Benedetto, the largest covered market in Italy, is a 10-minute walk.',
      net: "Gigabit FTTH, €30 a month, no address check needed in Spain.",
      downside: 'Steep streets, and the old buildings have the same December heating problem as Puglia.',
    },
  ],
  sanremo: [
    {
      name: 'Sanremo seafront',
      what: 'Flats along the Corso Imperatrice with a sea view.',
      rent: '€700–1,100 off-season.',
      toGym: 'Club-level only. Nice is an hour west.',
      toBeach: 'Pebble beaches across the road, and the 24 km coastal cycle path starts here.',
      toShops: "Everything in town on foot, at northern-Italian prices.",
      net: "FTTH from TIM and Fastweb, 1 Gbps, reliable.",
      downside: '12°C in December and grey — this is a northern winter with palm trees, and it costs more than Sicily.',
    },
  ],

  // ── Spain ─────────────────────────────────────────────────────────────────
  valencia: [
    {
      name: 'Ruzafa',
      what: 'Restored 19th-century flats, high ceilings, tiled floors, in the neighbourhood everyone actually wants.',
      rent: '€900–1,300 furnished on a short let; Valencia is barely seasonal so the discount is small.',
      toGym: '10 minutes on foot or by bike to two of the four academies; Michal Adamczak’s room is the one to start at.',
      toBeach: '20 minutes by bike down the Turia riverbed park to Malvarrosa.',
      toShops: 'Mercado de Ruzafa on the doorstep — the best everyday market food in Western Europe at these prices.',
      net: "Gigabit symmetric FTTH for €30 from four competing providers.",
      downside: 'Ruzafa is loud at night — it is the bar district, and Thursday to Sunday the street noise runs past 02:00. Ask for an interior-facing flat.',
    },
    {
      name: 'El Cabanyal / Patacona',
      what: 'Restored fisherman’s houses in the old maritime quarter, or newer flats in Patacona just north.',
      rent: '€800–1,200 furnished.',
      toGym: '15 minutes by bike into the city for the academies.',
      toBeach: 'Two to five minutes on foot to wide sand, with a paved promenade to run on.',
      toShops: 'Mercado del Cabanyal, and a Mercadona 5 minutes away.',
      net: "Gigabit FTTH from four providers — Spain has the deepest fibre network in Europe.",
      downside: 'El Cabanyal is half restored and half not — some streets are genuinely rough, and the difference is a block wide. Walk it before you sign.',
    },
  ],
  malaga: [
    {
      name: 'Málaga — Soho / Centro',
      what: 'Flats in the regenerated port quarter, walkable to everything.',
      rent: '€1,000–1,400 furnished; the Costa del Sol runs a winter season so the discount is small.',
      toGym: '10 minutes to Rilion Gracie; Scramble in Torremolinos is 20 minutes by cercanías train.',
      toBeach: 'Malagueta is a 10-minute walk.',
      toShops: 'Atarazanas market, 5 minutes.',
      net: "Gigabit FTTH from four providers — Spain has the deepest fibre network in Europe.",
      downside: 'The centre is a tourist quarter and the flats are priced for short lets. Rent goes up, not down, for December.',
    },
    {
      name: 'Torremolinos — La Carihuela',
      what: 'Old fishing-quarter flats and small townhouses on the seafront promenade.',
      rent: '€700–1,000 off-season — a third cheaper than Málaga centre.',
      toGym: '10 minutes on foot to Scramble Academy, which is the best BJJ room in southern Spain.',
      toBeach: 'On the promenade. 7 km of paved seafront to run.',
      toShops: 'Supermarkets and the Carihuela fish restaurants along the front.',
      net: "Gigabit FTTH throughout La Carihuela for about €30 a month.",
      downside: 'Torremolinos has a reputation and parts of it earn it — the strip inland from the beach is package-holiday Britain. La Carihuela itself is not that, but it is 400 metres away.',
    },
  ],
  alicante: [
    {
      name: 'Playa de San Juan',
      what: 'Modern flats in low blocks a street or two back from 7 km of sand, tram into the city.',
      rent: "€650–950 furnished, about a third under Playa de San Juan.",
      toGym: '15 minutes by tram to Fightzone Costa Blanca, which runs over 100 classes a week — genuine beginner slots at sensible hours.',
      toBeach: "2–5 minutes on foot to 7 km of sand with a paved promenade.",
      toShops: 'Supermarkets in the neighbourhood; the big centres are on the ring road.',
      net: "Gigabit FTTH on every street in the neighbourhood.",
      downside: 'San Juan is a summer suburb and by November it is quiet — good for training and working, thin on evenings.',
    },
    {
      name: 'Alicante centre — Mercado / Ensanche',
      what: 'City flats near the market, walkable, with the Postiguet beach at the end of the street.',
      rent: '€650–950 furnished, about a third under Playa de San Juan.',
      toGym: 'Fightzone is a 15-minute tram; Climent Club is in the city — worth watching, not worth starting at.',
      toBeach: 'Postiguet is 10 minutes on foot.',
      toShops: 'Mercado Central, 5 minutes.',
      net: "Gigabit FTTH, €30 a month, no address check needed in Spain.",
      downside: 'The city is less interesting than Valencia at every hour that is not training.',
    },
  ],
  marbella: [
    {
      name: 'Marbella old town / Nueva Andalucía',
      what: 'Flats in gated complexes with a pool and parking, the normal way to rent here.',
      rent: '€1,300–1,900 furnished.',
      toGym: 'Patrick Bittan Academy and a cluster of BJJ gyms, 10–15 minutes by car.',
      toBeach: "5–10 minutes on foot, and the January sea is 16°C.",
      toShops: 'Everything, priced for the market that lives here.',
      net: "Gigabit FTTH throughout the gated complexes.",
      downside: 'It costs more than Valencia and Málaga for a place where the median resident is retired and you would need a car for everything.',
    },
  ],
  palma: [
    {
      name: 'Santa Catalina',
      what: 'The good Palma neighbourhood — market, bars, walkable, flats in restored blocks.',
      rent: '€900–1,300 furnished off-season, a real discount on summer.',
      toGym: '10 minutes to SurUnion or BJJPalma.',
      toBeach: 'Cala Major is 10 minutes by bus; the city front is a marina.',
      toShops: 'Mercat de Santa Catalina on the doorstep.',
      net: "Gigabit FTTH across the city for about €30.",
      downside: 'The island outside Palma substantially closes from November, so you would be living in one neighbourhood of one city.',
    },
  ],
  'las-palmas': [
    {
      name: 'Las Canteras — La Puntilla end',
      what: 'Flats a street back from the beach in a real city neighbourhood, not a resort.',
      rent: '€900–1,300 — and these months are high season here, so this is the top of the range, not the bottom.',
      toGym: '10 minutes to Team Romero, which runs BJJ, grappling and Muay Thai.',
      toBeach: 'One to three minutes. Las Canteras is a 3 km protected bay that is swimmable every single month of the year.',
      toShops: 'Full city shopping; Mercado del Puerto is 10 minutes.',
      net: 'Gigabit FTTH — the Atlantic cables land here, so it is the best connection on any island on this list.',
      downside: 'Four hours further from Israel than mainland Europe, and December is peak season so you pay more and it is busy.',
    },
  ],
  'costa-adeje': [
    {
      name: 'La Caleta',
      what: 'A small village at the quiet end of the Adeje strip, flats and townhouses with sea views.',
      rent: '€900–1,300, again peak season in your months.',
      toGym: 'Commercial gyms locally; the serious rooms are 70 minutes north in Santa Cruz.',
      toBeach: '5 minutes to calm water at 22°C in December.',
      toShops: 'Supermarkets 5 minutes up the hill in Adeje.',
      net: 'Fibre through the resort strip.',
      downside: 'It is a resort with residents attached. The warmest winter on the list and the least like living somewhere.',
    },
  ],

  // ── Greece ────────────────────────────────────────────────────────────────
  chania: [
    {
      name: 'Halepa',
      what: 'The good residential quarter east of the old town — neoclassical houses and 1970s flats, mostly with balconies and sea views.',
      rent: '€500–750 furnished from October; the same flat is €1,200 in August.',
      toGym: '10 minutes on foot or 5 by scooter to Chania Combat Sports.',
      toBeach: 'Nea Chora is 15 minutes on foot along the front; the good sand at Marathi is 20 minutes by car.',
      toShops: 'Two supermarkets and the Saturday market within 10 minutes; the covered agora is 15.',
      net: 'Cosmote FTTH through Halepa. This is the part of Chania you can rely on — check the street number on the Cosmote map anyway.',
      downside: 'It is a hill, so everything is a climb, and the old stone flats are cold and damp in December with only air-conditioning units for heat.',
    },
    {
      name: 'Akrotiri — Kounoupidiana / Chorafakia',
      what: 'Detached houses with gardens and sea views, which is the thing you actually said you wanted.',
      rent: '€700–1,100 for a 3-bed house off-season, against €1,200–1,800 on an annual lease.',
      toGym: '10–12 minutes by car to Chania Combat Sports. Not walkable.',
      toBeach: '5–10 minutes to Kalathas, Stavros and Tersanas — small sheltered bays, warm into November.',
      toShops: 'Kounoupidiana has a full supermarket and the university is there, so it stays awake all winter.',
      net: 'FTTH reaches Kounoupidiana and Chorafakia. Go further out towards Stavros and it becomes VDSL — this is the exact address-level check that matters.',
      downside: 'You need a car, full stop. And the beaches empty completely in November — Stavros in December is you and a closed taverna.',
    },
  ],
  rethymno: [
    {
      name: 'Rethymno old town edge — Kastella',
      what: 'Venetian-era flats just behind the beach, walkable to everything.',
      rent: '€400–650 furnished off-season.',
      toGym: 'BJJ and striking clubs in town; for MMA you drive an hour to Chania.',
      toBeach: 'The 12 km sand beach starts at the end of the street.',
      toShops: 'Thursday market and supermarkets within 10 minutes.',
      net: "Cosmote FTTH in the old town and along the front.",
      downside: 'The training ceiling is low and February is genuinely quiet. Cheaper Chania with less to do.',
    },
  ],
  heraklion: [
    {
      name: 'Ammoudara',
      what: 'Flats along the beach strip 10 minutes west of the city, most with balconies.',
      rent: "€450–700 off-season, against €800–1,200 on an annual lease.",
      toGym: '10–15 minutes into the city, which has the biggest and most consistent scene on Crete.',
      toBeach: 'Across the road, and a long flat promenade to run on.',
      toShops: 'Full supermarkets on the strip.',
      net: 'The best fibre on the island, with two providers on most streets.',
      downside: 'Ammoudara is a package-holiday strip and it is bleak in December. The city itself is a working port, not the Crete of the brochure.',
    },
  ],
  'athens-riviera': [
    {
      name: 'Glyfada — Ano Glyfada',
      what: 'Good flats a few streets up from the shopping district, quieter and cheaper than the front.',
      rent: '€900–1,400 furnished; Athens is not seasonal so expect little discount.',
      toGym: '10–15 minutes to Alliance Jiu Jitsu Athens or Kimura — both run structured fundamentals programmes, which is the best beginner answer in Greece.',
      toBeach: '10 minutes on foot to the organised beaches; the tram runs the whole coast.',
      toShops: 'Everything, all year, including specialist and imported.',
      net: 'Full gigabit, multiple providers.',
      downside: 'It is the most expensive Greek option by a distance and it is a city suburb — €900–1,400 for a flat is roughly double Chania for a shorter commute to a better gym.',
    },
  ],
  kalamata: [
    {
      name: 'Kalamata seafront — Navarinou',
      what: 'Flats along the front with balconies over the bay.',
      rent: "€400–650 furnished — the cheapest seafront on the Greek mainland.",
      toGym: '10 minutes to The Camp 10, a full athletic club with MMA and BJJ — remarkable for a town this size.',
      toBeach: 'The pebble front is across the road; the Messinian sand beaches are 20–40 minutes west.',
      toShops: 'A real market town — producer-direct meat, oil and vegetables, and the cheapest good food in Greece.',
      net: 'FTTH along the front.',
      downside: 'Small. Everything beyond the town is a drive, and you connect through Athens to go anywhere.',
    },
  ],
  rhodes: [
    {
      name: 'Rhodes new town — Zefyros',
      what: 'Year-round residential flats, unlike the resort strips.',
      rent: '€400–650 off-season, and landlords are very negotiable from November.',
      toGym: 'Rhodes Knights BJJ is 10 minutes south. Striking is club-level.',
      toBeach: 'Two coasts within 10 minutes, and the warmest sea in Greece into December.',
      toShops: 'Full supermarkets and a market in the new town.',
      net: 'FTTH in the town and Ialysos.',
      downside: 'The island shuts hard in November. Rhodes Town keeps going; everything outside it, including most of the restaurants you would want, does not.',
    },
  ],
  thessaloniki: [
    {
      name: 'Kalamaria',
      what: 'Seafront-adjacent flats in the good residential district, walkable and well served.',
      rent: '€350–550 furnished — the cheapest real city living in Greece.',
      toGym: '10 minutes to one of several real MMA and BJJ clubs; this is the strongest scene outside Athens.',
      toBeach: 'None. The city waterfront is not swimmable and Halkidiki is 60–90 minutes.',
      toShops: 'The best food city in Greece, and the cheapest of the big ones.',
      net: "Full gigabit fibre, two providers on most streets.",
      downside: 'December is 10°C and grey and there is no sea. It fails your window on exactly the point you were worried about.',
    },
  ],
  corfu: [
    {
      name: 'Corfu Town — Garitsa',
      what: 'Venetian flats on the bay south of the old fortress, and stone houses with gardens just outside town.',
      rent: '€400–700 furnished; the island empties and the rent collapses.',
      toGym: 'Cloud9 BJJ, the only Jean Jacques Machado academy in Europe, is in town. Grappling is genuinely good here; MMA is not.',
      toBeach: 'Mon Repos is 10 minutes on foot; the good west-coast beaches are 30 minutes by car and shut.',
      toShops: 'Full market and supermarkets in town.',
      net: 'Fibre in the town and along the main coast road.',
      downside: 'The wettest place in Greece, in its wettest months — 14 rain days in November and 15 in December. That is the whole argument against it for this trip.',
    },
  ],

  // ── Cyprus ────────────────────────────────────────────────────────────────
  limassol: [
    {
      name: 'Potamos Germasogeias',
      what: 'Modern 2-beds in low blocks between the tourist strip and the sea, most with a pool in the building.',
      rent: '€1,100–1,600 furnished off-season.',
      toGym: '5–10 minutes to Checkmat Limassol or Gracie Barra Cyprus. The deepest grappling scene between Athens and Tel Aviv, all taught in English.',
      toBeach: 'Across the road, with a continuous promenade to run on and a sea at 24°C in November.',
      toShops: 'Large supermarkets within 5 minutes, including Middle Eastern staples.',
      net: 'Cyta gigabit FTTH, the most reliable connection on this entire list.',
      downside: 'It costs more than anywhere in Greece or Italy, and the neighbourhood is a finance-and-tourism suburb rather than a town.',
    },
  ],
  paphos: [
    {
      name: 'Coral Bay / Peyia',
      what: 'Villas with private pools — genuinely normal to rent here, unlike Limassol.',
      rent: '€800–1,300 for a villa from October, against €1,500–2,500 in summer.',
      toGym: '15 minutes by car to Furious Fighters or Kings BJJ in Paphos, both taking absolute beginners in English.',
      toBeach: '5 minutes to Coral Bay and Corallia — the warmest winter sea in the EU.',
      toShops: 'Supermarkets in Peyia and Coral Bay; the full ones are in Paphos.',
      net: 'Fibre through the coastal strip.',
      downside: 'You need a car, and the resident population skews retired British by a long way. It is quiet to the point of dull if you are 21.',
    },
  ],
  larnaca: [
    {
      name: 'Mackenzie / Oroklini',
      what: 'Flats on the Mackenzie beach strip, or houses inland at Oroklini and Pyla.',
      rent: '€650–1,000 furnished off-season.',
      toGym: 'Thin locally — Trojans ZR Team and Cyprus Top Team. Realistically you would drive 45 minutes to Limassol.',
      toBeach: 'Mackenzie is a town beach; better sand is 20 minutes north.',
      toShops: 'Everything, and cheaper than Limassol.',
      net: "Cyta gigabit FTTH, near-universal in the town.",
      downside: 'It is the airport town. Convenient, and not a reason to be anywhere.',
    },
  ],
  protaras: [
    {
      name: 'Protaras — Pernera',
      what: 'Villas priced for summer tourists, let cheaply on a long winter contract.',
      rent: '€600–1,000 from November — the biggest off-season discount in Cyprus.',
      toGym: 'Effectively nothing. Larnaca is 45 minutes, Limassol 70.',
      toBeach: 'Fig Tree Bay and Konnos are walkable and the best water on the island.',
      toShops: 'Two supermarkets stay open; most of the strip does not.',
      net: 'Fibre in the resort strip.',
      downside: 'It empties in November. Beautiful water attached to a town with no year-round life and no training — the two things you would be there for.',
    },
  ],
  nicosia: [
    {
      name: 'Nicosia — Engomi / Strovolos',
      what: 'The cheapest housing on the island, in a real working city.',
      rent: "€550–850 furnished, the cheapest housing on the island.",
      toGym: 'Several academies and good commercial gyms.',
      toBeach: 'None. The sea is 45 minutes in any direction.',
      toShops: 'Best supply and the lowest prices in Cyprus.',
      net: "Cyta gigabit FTTH, the most reliable network on this list.",
      downside: 'Choosing an island and then living inland on it defeats the exercise.',
    },
  ],
}

export function staysFor(id: PlaceId): StayOption[] {
  return STAYS[id] ?? []
}

/** The countries whose towns carry street-level detail so far. */
export const DETAILED_COUNTRIES = ['malta', 'italy', 'spain', 'greece', 'cyprus']
