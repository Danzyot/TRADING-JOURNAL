/**
 * Greece in detail: the winter question, and the specific places.
 *
 * "Greece" is not a decision — Chania and Thessaloniki share a country and
 * nothing else that matters here. What follows is town by town, with the
 * figures that decide it: what December actually feels like, whether there is
 * an MMA room, whether the fibre reaches the house, and what a whole house
 * near the sea costs to rent for a year.
 */
import type { Source } from './countries'

export const GREECE_VERIFIED = 'August 2026'

/**
 * The Q4 answer, in numbers.
 *
 * The worry was cold. The honest reading is that Q4 in Crete is not cold —
 * October still swims, November is a mild spring day, December is Tel Aviv in
 * January — but it is *wet*, and the wet arrives exactly when the light goes.
 */
export type MonthClimate = {
  month: string
  /** Average daily high, °C. */
  high: number
  /** Average daily low, °C. */
  low: number
  /** Rain days in the month. */
  rainDays: number
  /** Total rainfall, mm. */
  rainMm: number
  note: string
}

export const CHANIA_YEAR: MonthClimate[] = [
  { month: 'October', high: 24, low: 17, rainDays: 6, rainMm: 60, note: 'Sea still ~23°C. Swimming, running, everything.' },
  { month: 'November', high: 20, low: 14, rainDays: 9, rainMm: 95, note: 'The last easy month. Sea ~21°C, locals stop swimming, you would not.' },
  { month: 'December', high: 17, low: 11, rainDays: 13, rainMm: 168, note: 'Warmer than a Tel Aviv January by day — and the wettest month of the year.' },
  { month: 'January', high: 14, low: 8, rainDays: 18, rainMm: 91, note: 'The coldest month. ~6 hours of sun a day; rain on more days than not.' },
  { month: 'February', high: 15, low: 8, rainDays: 12, rainMm: 80, note: 'Turning. Almond blossom, cold sea.' },
  { month: 'March', high: 17, low: 9, rainDays: 9, rainMm: 55, note: 'Outdoors again.' },
]

export const CLIMATE_VERDICT =
  'Q4 is not the problem you think it is. October in Crete is a Tel Aviv September; November is mild; December days sit around 17°C, which is warmer than a Tel Aviv January. What Q4 brings is rain and darkness rather than cold — December is the wettest month of the Cretan year at ~168mm across ~13 days, and January is wetter still by day count at ~18 rain days. January, not Q4, is the month to plan around: if you are somewhere with a gym, an MMA room and fibre, it is six weeks of good indoor life; if you are in a village 20 minutes from anything, it is six weeks of staring at rain.'

export const CLIMATE_SOURCES: Source[] = [
  { label: 'Chania climate averages — Weather Atlas', url: 'https://www.weather-atlas.com/en/greece/chania-climate' },
  { label: 'Chania monthly rainfall and sunshine', url: 'https://weather-and-climate.com/average-monthly-Rainfall-Temperature-Sunshine,chania,Greece' },
  { label: 'Crete climate by season — Climates to Travel', url: 'https://www.climatestotravel.com/climate/greece/crete' },
]

export type Place = {
  slug: string
  name: string
  region: string
  /** One line: who this is for. */
  pitch: string
  /** 0–5 against this brief, not in general. */
  fit: number
  house: string
  training: string
  practical: string
  winter: string
  watchOut: string
}

/**
 * Ordered by fit for the brief: a house near a beach, in a town with a real
 * gym and a real hospital, that does not empty out in November.
 */
export const PLACES: Place[] = [
  {
    slug: 'chania',
    name: 'Chania',
    region: 'Crete, west',
    pitch:
      'The one to try first. A real town that lives all year, a Venetian harbour, an airport, a hospital, and beaches on both sides.',
    fit: 5,
    house:
      'Whole houses are normal here rather than exotic. Akrotiri and the villages behind Souda have detached houses with sea views from about €1,200/month long-term; Kounoupidiana and Chorafakia are the sweet spot for being 10 minutes from town and 5 from the water. Nerokourou and Mournies are cheaper and inland.',
    training:
      'Chania Combat Sports runs MMA, Muay Thai and no-gi BJJ with a real weekly schedule — the thing most Greek towns of this size do not have. Commercial gyms are plentiful and cheap; the Akrotiri roads and the Koum Kapi seafront are the running.',
    practical:
      'Chania airport (CHQ) flies to Athens hourly and direct to Tel Aviv in season. Public hospital plus private clinics. The old town is touristy; the neighbourhoods behind it are not.',
    winter: 'Mild and wet. The town stays open — this is not a resort that shuts.',
    watchOut:
      'Fibre. Chania town has it; the villages you would want the house in may be on VDSL or worse. Ask for a speed test from the actual address before signing, and price Starlink as the backup.',
  },
  {
    slug: 'rethymno',
    name: 'Rethymno',
    region: 'Crete, centre',
    pitch: 'Quieter Chania. Same coast, smaller town, cheaper, less to do in February.',
    fit: 4,
    house:
      'Cheaper than Chania for the same house — the villages east toward Panormo and south into the foothills are full of them.',
    training: 'Gyms yes; a serious MMA room is a 70-minute drive to Heraklion or back to Chania.',
    practical: 'University town, so it has a year-round population and a decent hospital. No airport of its own.',
    winter: 'As Chania. The seafront is exposed to the north wind.',
    watchOut: 'If MMA is non-negotiable, this is the compromise that will annoy you weekly.',
  },
  {
    slug: 'athens-riviera',
    name: 'Athens Riviera — Voula, Glyfada, Vouliagmeni',
    region: 'Attica',
    pitch:
      'City infrastructure with a beach at the end of the tram line. The option that never feels remote.',
    fit: 4,
    house:
      'Houses exist but this is apartment country, and the prices are the highest in Greece: Vouliagmeni runs ~€20.5/m²/month, Glyfada €14–17. Budget €2,000+ for something with outdoor space, more near the water.',
    training:
      'Everything. Alliance BJJ, EFL Academy, Ultimate Fight Team and others are all in Athens, with real competition teams and multiple sessions a day.',
    practical:
      'Two airports’ worth of flights, private hospitals, fibre everywhere, and every food shop you could want. Tel Aviv is 90 minutes in the air.',
    winter: 'Colder and greyer than Crete — January highs around 13°C and ~53mm of December rain, but the city carries you through it.',
    watchOut: 'It is Athens. Traffic, noise, and the summer heat is worse than the islands.',
  },
  {
    slug: 'kalamata',
    name: 'Kalamata',
    region: 'Peloponnese',
    pitch: 'The mainland value pick: a real city, a long beach, mountains behind, and rents that still start with a 5.',
    fit: 3,
    house: 'Houses with land are ordinary here. Rents are among the lowest of any Greek city with a hospital and an airport.',
    training: 'Gyms and a growing scene, but thin for MMA. Running and hiking are exceptional.',
    practical: 'General Hospital, airport with seasonal international flights, 2.5 hours to Athens by motorway.',
    winter: 'Drier than Athens in December (~39mm vs ~53mm) and mild, sheltered by the Taygetos range.',
    watchOut: 'Quiet. Genuinely quiet, for a 21-year-old, in February.',
  },
  {
    slug: 'rhodes',
    name: 'Rhodes',
    region: 'Dodecanese',
    pitch: 'The mildest winter in Greece, on an island that empties in November.',
    fit: 3,
    house: 'Cheap out of season, and the good long-term stock is fought over by people who live there year-round.',
    training: 'Limited. This is the trade-off for the climate.',
    practical: 'Big airport, hospital, and a large medieval town that stays alive in winter.',
    winter: 'Warmest of the lot — January highs around 16°C, nights around 13°C.',
    watchOut: 'Seasonality. A lot of what makes it good in June is shut in January.',
  },
]

/** What to check before signing a lease on a house, in order of what bites. */
export const HOUSE_CHECKLIST = [
  {
    title: 'Run a speed test from inside the house',
    detail:
      'Not from the village, not the landlord’s word: the address. Crete’s towns have fibre and its villages often do not, and a trading day on 8 Mbps ADSL is not a trading day. If it is thin, price Starlink (~150–300 Mbps, available in Greece) into the rent before you decide.',
  },
  {
    title: 'Ask what heats it, and what that costs in January',
    detail:
      'Greek houses are built for August. Many have no insulation and heat with oil or a single air-conditioner; a badly heated stone house in a wet January is the single most common reason people leave after one winter.',
  },
  {
    title: 'Go in the rain, not in the sun',
    detail:
      'See the road to the house in December weather. Dirt tracks that are charming in June are a problem when they wash out, and "10 minutes from the beach" can mean a track you will not drive at night.',
  },
  {
    title: 'Check what is open in February',
    detail:
      'Walk the village mid-week out of season. If the two tavernas and the shop are shuttered, that is your winter, not the summer version you visited.',
  },
  {
    title: 'Long-term lease, not a holiday let',
    detail:
      'Spitogatos is where long-term stock lives; the villa sites are quoting nightly rates that annualise to nonsense. Expect to pay a deposit plus first month, and expect the good ones to go by word of mouth in the town, not online.',
  },
]

/** The order of operations for an EU citizen, which is shorter than it looks. */
export const SETUP_STEPS = [
  {
    title: 'AFM — the tax number',
    detail: 'Obtainable before you have any residence status at all, and everything else depends on it.',
  },
  {
    title: 'AMKA — the social security number',
    detail:
      'An EU citizen needs no residence permit for this: an AFM and proof of a Greek address (a lease, or a hospitality declaration).',
  },
  {
    title: 'Bank account',
    detail: 'With the AFM. A Greek IBAN makes EFKA, rent and the tax office ordinary rather than a monthly fight.',
  },
  {
    title: 'EU registration certificate',
    detail:
      'Required after 3 months of residence, applied for at the Aliens Department of the local police. This is registration, not immigration — the Polish passport does the work.',
  },
  {
    title: 'Register the business activity and pick an EFKA class',
    detail:
      'Sole trader ("atomiki epicheirisi") with the right activity code, then choose a contribution class. Get the Article 5C application in with it: the 50% exemption has a filing deadline, and it is worth more than everything else on this page.',
  },
]

export const SETUP_SOURCES: Source[] = [
  { label: 'AFM and AMKA, order and documents', url: 'https://xpat.gr/afm-amka-greece/' },
  { label: 'EU registration certificate in Greece', url: 'https://www.nestia.gr/en/residency-visas/eu-registration-certificate-greece' },
  { label: 'Greek internet coverage and fibre reality', url: 'https://www.onoff.gr/blog/en/telecom/gigabit-internet-ellada-2026/' },
  { label: 'Chania Combat Sports', url: 'https://www.chaniacombatsports.com/' },
  { label: 'EFL Academy, Athens', url: 'https://eflmma.gr/' },
]
