/**
 * Late September to December, which is the only window that matters.
 *
 * A year-round average is useless for a trip that starts in late September and
 * ends around New Year. Two things change over those fourteen weeks and both
 * decide the trip: the weather turns, and the tourist economy switches off.
 * A town can be 24°C and perfect on 25 September and a shuttered seafront with
 * three restaurants open by 10 November — that is the same town, and the second
 * half is the half you would be living in.
 *
 * The other thing this window changes is money. The short-let premiums in
 * ./stay.ts are peak-season numbers; late September to December is shoulder
 * turning to low season almost everywhere on the Mediterranean, so a furnished
 * let over these months is normally CHEAPER than the annual-lease figure, not
 * dearer. That is priced here rather than there.
 *
 * Sea temperatures are the reason to go in September rather than April: the
 * Mediterranean lags the air by about six weeks, so late September water is at
 * its warmest of the year and October is still swimmable almost everywhere.
 */
import type { Place, PlaceId } from './places'

export type MonthKey = 'sep' | 'oct' | 'nov' | 'dec'

export const MONTHS: { key: MonthKey; label: string }[] = [
  { key: 'sep', label: 'Late Sep' },
  { key: 'oct', label: 'October' },
  { key: 'nov', label: 'November' },
  { key: 'dec', label: 'December' },
]

export type MonthFacts = {
  /** Average daytime high, °C. */
  day: number
  /** Average sea temperature, °C. A swim is pleasant from about 21. */
  sea: number | null
  /** Days with measurable rain in the month. */
  rain: number
  /** What the month is actually like to live in. */
  note: string
}

export type Zone = {
  label: string
  months: Record<MonthKey, MonthFacts>
  /** What is still trading in November and December. */
  open: string
  /**
   * A furnished let for these months against the twelve-month lease figure.
   * Below 1 means the off-season is cheaper, which is usually the case.
   */
  offSeasonRent: number
  /** The one-line answer for this window. */
  verdict: string
}

export const ZONES: Record<string, Zone> = {
  crete: {
    label: 'Crete',
    months: {
      sep: { day: 27, sea: 25, rain: 2, note: 'Peak swimming. The sea is at its warmest of the year and the crowds have gone.' },
      oct: { day: 24, sea: 24, rain: 6, note: 'The best month on the island. Everything open, warm sea, empty beaches.' },
      nov: { day: 20, sea: 22, rain: 9, note: 'Still swimmable on a good day. The resorts close, the towns carry on.' },
      dec: { day: 17, sea: 19, rain: 13, note: 'Wet. 168 mm over about 13 days, and the wettest month of the Cretan year.' },
    },
    open: 'Chania, Rethymno and Heraklion are real towns and stay fully open. The beach resorts at Platanias and Malia shut from early November.',
    offSeasonRent: 0.85,
    verdict: 'The best possible window here. Late September and October are the two best months of the year, and only December is genuinely wet.',
  },
  athens: {
    label: 'Athens and the Riviera',
    months: {
      sep: { day: 29, sea: 25, rain: 3, note: 'Hot and dry, sea at its warmest.' },
      oct: { day: 24, sea: 23, rain: 6, note: 'Warm, dry, the best month in the city.' },
      nov: { day: 19, sea: 21, rain: 8, note: 'Mild, the last swimmable weeks on the Riviera beaches.' },
      dec: { day: 16, sea: 18, rain: 10, note: 'Cool and showery, and the city does not notice.' },
    },
    open: 'A capital city. Nothing closes at any point.',
    offSeasonRent: 1,
    verdict: 'Reliable rather than spectacular: warm to the end of October, then a mild city winter with everything still running.',
  },
  'north-greece': {
    label: 'Northern Greece',
    months: {
      sep: { day: 27, sea: 24, rain: 4, note: 'Still summer, and Halkidiki is an hour away.' },
      oct: { day: 21, sea: 21, rain: 6, note: 'Turning. Last swimming weekends.' },
      nov: { day: 15, sea: 18, rain: 9, note: 'Coat weather. The sea is finished.' },
      dec: { day: 10, sea: 15, rain: 10, note: 'Cold and grey, 10°C days.' },
    },
    open: 'A university city, open all year, and the sea an hour away and closed.',
    offSeasonRent: 0.95,
    verdict: 'Two good months and then a northern winter. Fails the window on exactly the point you were worried about.',
  },
  ionian: {
    label: 'Corfu and the Ionian',
    months: {
      sep: { day: 26, sea: 25, rain: 5, note: 'Warm and green, the sea at its best.' },
      oct: { day: 22, sea: 23, rain: 10, note: 'Beautiful, and the rain starts in earnest.' },
      nov: { day: 18, sea: 21, rain: 14, note: 'Very wet. Corfu takes over 1,100 mm a year and much of it lands now.' },
      dec: { day: 15, sea: 18, rain: 15, note: 'The wettest place in Greece, in its wettest month.' },
    },
    open: 'Corfu Town lives all year. The island outside it — Paleokastritsa, Sidari, Kavos — is shut by late October.',
    offSeasonRent: 0.7,
    verdict: 'September is lovely and November is fifteen rain days. The cheapest Greek rent of the window, for a reason.',
  },
  dodecanese: {
    label: 'Rhodes and the Dodecanese',
    months: {
      sep: { day: 28, sea: 26, rain: 2, note: 'The warmest sea in Greece and still summer.' },
      oct: { day: 24, sea: 24, rain: 5, note: 'Excellent. Swimming into November is normal here.' },
      nov: { day: 20, sea: 22, rain: 9, note: 'Mild, and the island starts emptying fast.' },
      dec: { day: 17, sea: 20, rain: 12, note: 'Warm for the date and largely closed.' },
    },
    open: 'Rhodes Town stays open. Faliraki, Lindos and the whole east coast shut in early November — hotels, restaurants, car hire, most of it.',
    offSeasonRent: 0.65,
    verdict: 'The warmest option in Greece and the emptiest. Excellent to the end of October, then a ghost island with a functioning old town in it.',
  },
  peloponnese: {
    label: 'Messenia and the Peloponnese',
    months: {
      sep: { day: 28, sea: 25, rain: 3, note: 'Hot, dry, olive harvest coming.' },
      oct: { day: 24, sea: 23, rain: 6, note: 'Warm and the harvest is on — the region is at its busiest and best.' },
      nov: { day: 19, sea: 21, rain: 9, note: 'Mild, working, and drier than Athens.' },
      dec: { day: 16, sea: 18, rain: 10, note: 'Drier in December than Athens is, which is unusual for the mainland.' },
    },
    open: 'Kalamata runs on agriculture, not tourism, so it is fully open all four months. The olive harvest peaks in November.',
    offSeasonRent: 0.9,
    verdict: 'The most functional Greek option for this window: a real town that does not close, and a drier December than anywhere else on the mainland.',
  },
  cyprus: {
    label: 'Cyprus',
    months: {
      sep: { day: 31, sea: 27, rain: 1, note: 'Still properly hot. The sea is 27°C, the warmest in the Mediterranean.' },
      oct: { day: 27, sea: 26, rain: 3, note: 'Perfect. Warm sea, warm air, no rain to speak of.' },
      nov: { day: 23, sea: 24, rain: 5, note: 'Still swimming — 23°C water, and 23°C days on land.' },
      dec: { day: 19, sea: 21, rain: 8, note: 'The warmest December in the EU, and swimmable on a good day.' },
    },
    open: 'Limassol, Larnaca and Paphos are year-round cities. Ayia Napa and Protaras close almost completely by early November.',
    offSeasonRent: 0.85,
    verdict: 'The best weather of the whole window, without exception. You can swim in December.',
  },
  'valencia-coast': {
    label: 'Valencia and the Costa Blanca',
    months: {
      sep: { day: 28, sea: 26, rain: 4, note: 'Hot, and the gota fría storm season starts.' },
      oct: { day: 24, sea: 24, rain: 6, note: 'Warm and often the wettest month of the year here — short, violent storms.' },
      nov: { day: 20, sea: 21, rain: 5, note: 'Mild and dry again. Last swims.' },
      dec: { day: 17, sea: 18, rain: 4, note: 'Cool, bright and dry. Genuinely pleasant.' },
    },
    open: 'Both are real cities. Nothing closes, and the Christmas season in Valencia is a proper one.',
    offSeasonRent: 0.95,
    verdict: 'Warm through October, dry and bright by December, and the city is fully alive the whole way.',
  },
  andalusia: {
    label: 'Málaga and the Costa del Sol',
    months: {
      sep: { day: 29, sea: 24, rain: 3, note: 'Hot and dry, and the sea is at its warmest of the year.' },
      oct: { day: 25, sea: 23, rain: 6, note: 'Excellent — warm sea, warm days, thinning crowds.' },
      nov: { day: 21, sea: 20, rain: 7, note: 'Mild. The sea gets marginal.' },
      dec: { day: 18, sea: 18, rain: 7, note: 'The warmest winter on mainland Europe. 18°C and mostly sunny.' },
    },
    open: 'Málaga is a working city and the Costa del Sol has a large permanent population, so it stays open all year unlike most Spanish resorts.',
    offSeasonRent: 0.9,
    verdict: 'The mildest mainland European December there is, and a city that never shuts.',
  },
  balearics: {
    label: 'Mallorca',
    months: {
      sep: { day: 27, sea: 26, rain: 5, note: 'Warm sea, thinner crowds.' },
      oct: { day: 23, sea: 23, rain: 8, note: 'The wettest month, and still swimmable.' },
      nov: { day: 19, sea: 20, rain: 7, note: 'Mild and very quiet — most of the island has closed by now.' },
      dec: { day: 16, sea: 17, rain: 6, note: 'Cool, and the island is very empty.' },
    },
    open: 'Palma stays open; the rest of the island substantially closes from November, including most of the coast road.',
    offSeasonRent: 0.6,
    verdict: 'The rent collapses out of season, and so does the island. Palma itself is fine.',
  },
  canaries: {
    label: 'The Canaries',
    months: {
      sep: { day: 27, sea: 24, rain: 1, note: 'Summer, and it does not really end.' },
      oct: { day: 26, sea: 24, rain: 2, note: 'The warmest sea of the year here.' },
      nov: { day: 24, sea: 23, rain: 3, note: 'Still beach weather. Nothing has changed.' },
      dec: { day: 22, sea: 22, rain: 3, note: 'Swimming in December, in Europe, without qualification.' },
    },
    open: 'High season here is exactly the European winter, so everything is open and busier in December than in June.',
    offSeasonRent: 1.25,
    verdict: 'The only place in Europe where your whole window is beach weather — and the only one where these months are peak season and cost more.',
  },
  'lisbon-coast': {
    label: 'The Lisbon coast',
    months: {
      sep: { day: 26, sea: 19, rain: 4, note: 'Warm air, cold Atlantic. The sea never really warms here.' },
      oct: { day: 22, sea: 18, rain: 9, note: "Turning wet, and the Atlantic is already too cold to swim." },
      nov: { day: 18, sea: 17, rain: 13, note: 'Grey and wet, and the wind off the Atlantic is constant.' },
      dec: { day: 16, sea: 16, rain: 14, note: 'Mild, dark and wet. 14 rain days.' },
    },
    open: 'Cascais and Lisbon are year-round. Nothing closes.',
    offSeasonRent: 0.85,
    verdict: 'Mild, never cold, and wet from November. The Atlantic is 17°C in September — this is not a swimming trip.',
  },
  algarve: {
    label: 'The Algarve',
    months: {
      sep: { day: 27, sea: 22, rain: 3, note: 'The one month the Atlantic is properly swimmable.' },
      oct: { day: 23, sea: 21, rain: 6, note: 'Warm, quiet, and the water is going.' },
      nov: { day: 19, sea: 19, rain: 9, note: 'Mild and empty. Half the town has closed.' },
      dec: { day: 17, sea: 17, rain: 9, note: 'Mild and wet, and Lagos is very quiet.' },
    },
    open: 'Lagos and Portimão lose most of their restaurants and bars from early November. Portimão, being a working town, keeps more.',
    offSeasonRent: 0.55,
    verdict: 'The rent halves and so does the town. Good in late September, hollow by November.',
  },
  madeira: {
    label: 'Madeira',
    months: {
      sep: { day: 26, sea: 24, rain: 4, note: "Warm and green, and the sea is 24°C — swimmable off the lidos." },
      oct: { day: 25, sea: 24, rain: 7, note: 'Still warm, the wettest of the four.' },
      nov: { day: 23, sea: 23, rain: 8, note: "Mild and damp, 23°C, and the island is filling up for its high season." },
      dec: { day: 21, sea: 21, rain: 8, note: '21°C in December, and the sea still swimmable.' },
    },
    open: 'Funchal is a year-round city and December is one of its busiest months.',
    offSeasonRent: 1.1,
    verdict: 'Mild the whole way, and no real beach — you swim off lidos and rock platforms.',
  },
  sicily: {
    label: 'Sicily',
    months: {
      sep: { day: 29, sea: 26, rain: 4, note: 'Still summer, sea at its warmest, and the tourists are gone.' },
      oct: { day: 25, sea: 24, rain: 7, note: 'Excellent. Warm, the harvest is in, everything cheap.' },
      nov: { day: 21, sea: 22, rain: 9, note: 'Mild. Catania is completely unaffected.' },
      dec: { day: 18, sea: 19, rain: 8, note: 'Mild and bright, with Etna in snow behind the city.' },
    },
    open: 'Catania is a working city of 300,000 and closes for nothing. Taormina and the resort coast empty out.',
    offSeasonRent: 0.85,
    verdict: 'The best value in the window: warm to November, a city that never shuts, and the lowest prices in Western Europe.',
  },
  puglia: {
    label: 'Puglia',
    months: {
      sep: { day: 27, sea: 25, rain: 4, note: 'Warm and still swimmable, the sea at its best.' },
      oct: { day: 23, sea: 23, rain: 7, note: 'The olive harvest. The region is working and the food is at its peak.' },
      nov: { day: 18, sea: 20, rain: 9, note: 'Cool and quiet. The coast towns have gone to sleep.' },
      dec: { day: 14, sea: 17, rain: 8, note: '14°C — the coolest of the Italian options, and often clear.' },
    },
    open: 'Monopoli and Polignano keep a real year-round population and stay open. The smaller Salento coast villages close entirely.',
    offSeasonRent: 0.7,
    verdict: 'Superb in September and October, genuinely quiet by December, and a cooler winter than Sicily.',
  },
  sardinia: {
    label: 'Sardinia',
    months: {
      sep: { day: 27, sea: 25, rain: 4, note: 'Warm sea, empty beaches.' },
      oct: { day: 23, sea: 23, rain: 7, note: 'Good, and Poetto is still usable.' },
      nov: { day: 18, sea: 20, rain: 8, note: "Cool and windy — the mistral makes 18°C feel like 13 on the beachfront." },
      dec: { day: 15, sea: 17, rain: 7, note: 'Cool and bright, with the mistral making it feel colder.' },
    },
    open: 'Cagliari is a capital city, open all year. The rest of the island shuts hard.',
    offSeasonRent: 0.8,
    verdict: 'A capital city on a beach, with two warm months and then a windy, bright winter.',
  },
  liguria: {
    label: 'The Italian Riviera',
    months: {
      sep: { day: 24, sea: 23, rain: 6, note: 'Pleasant, the last of the season.' },
      oct: { day: 20, sea: 21, rain: 9, note: 'Cool and often wet.' },
      nov: { day: 15, sea: 18, rain: 11, note: 'Grey. The Riviera closes.' },
      dec: { day: 12, sea: 15, rain: 8, note: '12°C. This is a northern European winter with palm trees.' },
    },
    open: 'Sanremo has a permanent population but the seafront economy is seasonal and quiet.',
    offSeasonRent: 0.7,
    verdict: 'Fails the window. Cold by November and there are better versions of this everywhere south of it.',
  },
  malta: {
    label: 'Malta and Gozo',
    months: {
      sep: { day: 29, sea: 26, rain: 2, note: 'Hot and dry, sea at its warmest, and the summer crowds thinning.' },
      oct: { day: 25, sea: 25, rain: 6, note: 'The best month of the Maltese year. Warm sea, warm air, everything open.' },
      nov: { day: 21, sea: 23, rain: 9, note: 'Still swimming off the rocks. Wet and windy in bursts.' },
      dec: { day: 18, sea: 20, rain: 10, note: 'Mild and wet. 18°C, and rain on about a third of days.' },
    },
    open: 'Sliema, St Julian’s and Valletta run all year on a resident population, not tourists. Gozo is much quieter in December but its towns stay open.',
    offSeasonRent: 0.75,
    verdict: 'Warm to the end of November, everything in English, rent a quarter cheaper than summer, and the whole island still working.',
  },
  dalmatia: {
    label: 'The Dalmatian coast',
    months: {
      sep: { day: 25, sea: 23, rain: 6, note: 'Warm and the crowds have gone.' },
      oct: { day: 20, sea: 21, rain: 9, note: 'The last swimmable weeks.' },
      nov: { day: 15, sea: 18, rain: 11, note: 'Cold, wet, and the bura wind starts.' },
      dec: { day: 11, sea: 15, rain: 10, note: '11°C, dark and windy.' },
    },
    open: 'Split and Zadar are real cities and stay open. Šibenik goes quiet. Dubrovnik and the islands shut almost completely — ferries drop to a skeleton timetable.',
    offSeasonRent: 0.55,
    verdict: 'One good month then a cold, windy winter. Rent nearly halves, which tells you what the demand is.',
  },
  kvarner: {
    label: 'Kvarner',
    months: {
      sep: { day: 24, sea: 23, rain: 8, note: "Mild and green, and the last month you would get in the water." },
      oct: { day: 19, sea: 20, rain: 11, note: "Wet — 11 rain days, and the Opatija promenade starts closing." },
      nov: { day: 14, sea: 17, rain: 13, note: 'The wettest corner of Croatia, in its wettest season.' },
      dec: { day: 10, sea: 14, rain: 11, note: "Cold and grey at 10°C, with the bura wind funnelling down the coast." },
    },
    open: 'Rijeka is a working port city. Opatija is a seasonal promenade and closes.',
    offSeasonRent: 0.6,
    verdict: 'The wrong end of the Adriatic for this window.',
  },
  'montenegro-coast': {
    label: 'The Montenegrin coast',
    months: {
      sep: { day: 26, sea: 24, rain: 6, note: 'Warm, the season winding down.' },
      oct: { day: 21, sea: 22, rain: 10, note: 'Mild and the rain arrives.' },
      nov: { day: 16, sea: 19, rain: 14, note: 'Very wet — the Bay of Kotor is among the rainiest places in Europe.' },
      dec: { day: 12, sea: 16, rain: 14, note: 'Wet and dark, and everything on the coast is closed.' },
    },
    open: 'Budva empties completely in November — the strip is boarded up. Tivat keeps Porto Montenegro open. Herceg Novi and Bar keep a small year-round life.',
    offSeasonRent: 0.5,
    verdict: 'Cheap for the exact reason you would not want to be there: two of the four months are near-empty and very wet.',
  },
  'albania-coast': {
    label: 'The Albanian coast',
    months: {
      sep: { day: 27, sea: 25, rain: 4, note: 'Still summer, and the Ionian water is superb.' },
      oct: { day: 22, sea: 23, rain: 8, note: 'Warm and emptying fast.' },
      nov: { day: 18, sea: 20, rain: 13, note: 'Mild and wet, and the coast has shut.' },
      dec: { day: 14, sea: 17, rain: 13, note: 'Wet. Sarandë and Himarë are effectively closed towns.' },
    },
    open: 'Vlorë and Durrës keep a year-round population. Sarandë, Ksamil and Himarë close almost entirely from November — restaurants, shops, transport.',
    offSeasonRent: 0.5,
    verdict: 'One excellent month and three empty ones. The cheapest window on the list and the loneliest.',
  },
  'black-sea': {
    label: 'The Bulgarian Black Sea',
    months: {
      sep: { day: 25, sea: 23, rain: 5, note: 'The last good month, and the sea is still warm.' },
      oct: { day: 19, sea: 19, rain: 7, note: 'Cool. Swimming is over.' },
      nov: { day: 13, sea: 15, rain: 9, note: "Cold and grey at 13°C, and the resort strip is already boarded up." },
      dec: { day: 8, sea: 11, rain: 10, note: '8°C, and the coast is completely shut.' },
    },
    open: 'Varna and Burgas are real cities and stay open. Sozopol, Sunny Beach and Golden Sands are boarded up from October.',
    offSeasonRent: 0.6,
    verdict: 'Fails the window badly. Three of your four months are a cold, closed coast.',
  },
  baltic: {
    label: 'The Polish coast',
    months: {
      sep: { day: 18, sea: 17, rain: 11, note: "Already autumn — 18°C, 11 rain days, and the beach season is over." },
      oct: { day: 13, sea: 13, rain: 12, note: 'Cold, wet, dark by 17:00.' },
      nov: { day: 7, sea: 10, rain: 14, note: '7°C and dark by 16:00.' },
      dec: { day: 3, sea: 6, rain: 14, note: '3°C, dark by 15:30, and the Baltic is unswimmable.' },
    },
    open: 'The Tri-City is a metropolis of 1.5 million and works all year. Sopot’s seafront is dead from October.',
    offSeasonRent: 0.85,
    verdict: 'The worst possible window for Poland. Go in June or do not go.',
  },
  'poland-inland': {
    label: 'Inland Poland',
    months: {
      sep: { day: 19, sea: null, rain: 10, note: 'Pleasant, the last warm weeks.' },
      oct: { day: 13, sea: null, rain: 11, note: "Autumn proper: 13°C, wet, and dark by 17:00." },
      nov: { day: 6, sea: null, rain: 13, note: 'Grey, and Kraków smog season begins.' },
      dec: { day: 2, sea: null, rain: 14, note: '2°C, and Christmas markets are the compensation.' },
    },
    open: 'Full cities, everything open, and December is one of the best months to be in Kraków if you like a European Christmas.',
    offSeasonRent: 1,
    verdict: 'No sea and a real winter. It only makes sense as the passport fallback, not as this trip.',
  },
  'georgia-coast': {
    label: 'Adjara',
    months: {
      sep: { day: 25, sea: 24, rain: 11, note: 'Warm, humid, and already raining.' },
      oct: { day: 20, sea: 21, rain: 12, note: "Wet — 12 rain days, and Batumi is emptying fast." },
      nov: { day: 15, sea: 18, rain: 13, note: 'Very wet. Batumi takes over 2,000 mm a year.' },
      dec: { day: 11, sea: 14, rain: 13, note: 'Cold and pouring, and the seafront is deserted.' },
    },
    open: 'Batumi in winter is a half-empty city of empty towers. The old town keeps a small year-round life.',
    offSeasonRent: 0.55,
    verdict: 'The rainiest option here. The 1% tax is real and this is the wrong season to test it.',
  },
  'georgia-inland': {
    label: 'Tbilisi',
    months: {
      sep: { day: 26, sea: null, rain: 5, note: 'Warm and dry, and the best month in the city.' },
      oct: { day: 20, sea: null, rain: 6, note: 'Excellent — clear, mild, harvest season in the wine country.' },
      nov: { day: 12, sea: null, rain: 5, note: 'Cold and dry. Coat weather.' },
      dec: { day: 7, sea: null, rain: 5, note: '7°C, dry and grey.' },
    },
    open: 'A capital city, open all year, and the cheapest one on this list.',
    offSeasonRent: 0.95,
    verdict: 'Two genuinely good months, then a cold dry winter with no sea. Excellent value and the wrong brief.',
  },
  gulf: {
    label: 'The Gulf',
    months: {
      sep: { day: 38, sea: 33, rain: 0, note: '38°C. Still unliveable outdoors.' },
      oct: { day: 34, sea: 31, rain: 0, note: 'Coming out of it. Evenings become possible.' },
      nov: { day: 29, sea: 28, rain: 1, note: 'The season starts. Perfect — 29°C and dry.' },
      dec: { day: 25, sea: 25, rain: 2, note: 'Ideal. 25°C, dry, and the whole city lives outdoors.' },
    },
    open: 'Everything, and November and December are peak season — which is why they cost the most.',
    offSeasonRent: 1.3,
    verdict: 'Backwards from everywhere else: your first month is the worst of the year and your last is the best.',
  },
  andaman: {
    label: 'Phuket and the Andaman coast',
    months: {
      sep: { day: 30, sea: 29, rain: 21, note: 'Monsoon. 21 rain days and the sea is rough and brown.' },
      oct: { day: 30, sea: 29, rain: 19, note: 'Still monsoon. The wettest month on this coast.' },
      nov: { day: 31, sea: 29, rain: 12, note: 'Turning. The dry season starts mid-month.' },
      dec: { day: 31, sea: 29, rain: 5, note: 'Perfect. Dry, hot, flat sea. High season begins.' },
    },
    open: 'The gyms and towns run all year. Beach clubs and boat trips are weather-dependent through September and October.',
    offSeasonRent: 0.8,
    verdict: 'Exactly out of phase with you: your first two months are the monsoon and only December is the Phuket people fly for.',
  },
  'gulf-thailand': {
    label: 'Koh Samui',
    months: {
      sep: { day: 31, sea: 29, rain: 14, note: 'Wet but the Gulf side is calmer than the Andaman.' },
      oct: { day: 30, sea: 29, rain: 17, note: "Rain building towards the wettest month of the Samui year." },
      nov: { day: 29, sea: 28, rain: 21, note: 'The wettest month of the Samui year, by a distance.' },
      dec: { day: 29, sea: 28, rain: 15, note: 'Still wet, and clearing towards the end.' },
    },
    open: 'The island runs all year.',
    offSeasonRent: 0.85,
    verdict: 'The worst-timed option on the list. Samui takes its monsoon in exactly October to December.',
  },
  'north-thailand': {
    label: 'Chiang Mai',
    months: {
      sep: { day: 31, sea: null, rain: 18, note: 'The end of the wet season.' },
      oct: { day: 31, sea: null, rain: 10, note: 'Drying out and green.' },
      nov: { day: 30, sea: null, rain: 4, note: 'The best month of the year here — dry, 30°C, clear air.' },
      dec: { day: 28, sea: null, rain: 2, note: 'Perfect and cool at night. Before burning season, which starts in February.' },
    },
    open: 'Everything, and this is high season.',
    offSeasonRent: 1.1,
    verdict: 'November and December are the two best months of the Chiang Mai year, and you would miss burning season entirely.',
  },
  guanacaste: {
    label: 'Guanacaste',
    months: {
      sep: { day: 31, sea: 29, rain: 20, note: 'The heart of the green season. It rains most afternoons.' },
      oct: { day: 31, sea: 29, rain: 21, note: 'The wettest month of the Costa Rican year.' },
      nov: { day: 32, sea: 29, rain: 11, note: 'Clearing. The dry season starts.' },
      dec: { day: 32, sea: 28, rain: 4, note: 'Dry, hot, and the start of high season.' },
    },
    open: 'Tamarindo and Coco run all year; September and October are their quietest months and some restaurants close for a few weeks.',
    offSeasonRent: 0.7,
    verdict: 'Two months of serious rain then two excellent ones, and the flights are the real objection.',
  },
  'cr-south': {
    label: 'The southern Pacific coast',
    months: {
      sep: { day: 30, sea: 29, rain: 24, note: 'One of the wettest places in the Americas, at its wettest.' },
      oct: { day: 30, sea: 29, rain: 25, note: 'It rains on 25 days.' },
      nov: { day: 30, sea: 29, rain: 18, note: "Easing to 18 rain days, which is still rain on most days." },
      dec: { day: 31, sea: 28, rain: 10, note: 'Drying out at last.' },
    },
    open: 'Small towns that run all year on a thin population.',
    offSeasonRent: 0.7,
    verdict: 'Rules itself out. Three of your four months are near-continuous rain.',
  },
  'riviera-maya': {
    label: 'The Riviera Maya',
    months: {
      sep: { day: 32, sea: 29, rain: 14, note: 'Hurricane season peak, and humid.' },
      oct: { day: 31, sea: 29, rain: 12, note: 'Still hurricane season, still humid.' },
      nov: { day: 29, sea: 28, rain: 7, note: 'Turning excellent. Dry season begins, sargassum gone.' },
      dec: { day: 28, sea: 27, rain: 5, note: 'Perfect. 28°C, dry, clear Caribbean water.' },
    },
    open: 'Playa del Carmen and Tulum run all year and December is peak season.',
    offSeasonRent: 0.8,
    verdict: 'A hurricane-season start and a perfect finish. November and December are the best months of the year here.',
  },
  'oaxaca-coast': {
    label: 'The Oaxaca coast',
    months: {
      sep: { day: 31, sea: 29, rain: 16, note: 'Wet season, and the surf is at its biggest.' },
      oct: { day: 31, sea: 29, rain: 12, note: "Clearing, and the big summer surf is settling down." },
      nov: { day: 31, sea: 28, rain: 4, note: "Dry and superb — 31°C, four rain days, and the town wakes up." },
      dec: { day: 30, sea: 27, rain: 2, note: 'Dry, hot, and the town fills up for the season.' },
    },
    open: 'Puerto Escondido runs all year with a growing year-round foreign population.',
    offSeasonRent: 0.8,
    verdict: 'A wet start and two excellent months to finish.',
  },
  jalisco: {
    label: 'Puerto Vallarta',
    months: {
      sep: { day: 32, sea: 30, rain: 17, note: 'The wettest month and peak hurricane risk.' },
      oct: { day: 32, sea: 30, rain: 10, note: 'Clearing and still very humid.' },
      nov: { day: 31, sea: 29, rain: 3, note: 'Excellent — dry and warm.' },
      dec: { day: 29, sea: 27, rain: 1, note: 'Perfect and busy.' },
    },
    open: 'A year-round city, and December is its high season.',
    offSeasonRent: 0.85,
    verdict: 'September is the one month to avoid; the rest of the window is very good.',
  },
  yucatan: {
    label: 'Mérida',
    months: {
      sep: { day: 33, sea: null, rain: 15, note: "Hot and wet: 33°C at high humidity, 15 rain days." },
      oct: { day: 32, sea: null, rain: 11, note: "Easing to 11 rain days, and the humidity starts to break." },
      nov: { day: 30, sea: null, rain: 5, note: 'The best month — dry and 30°C.' },
      dec: { day: 29, sea: null, rain: 3, note: 'Dry, warm, and the pleasant season.' },
    },
    open: 'A full city, open all year.',
    offSeasonRent: 0.9,
    verdict: 'Fine weather from November, and still 35 minutes from a mediocre beach.',
  },
  'panama-pacific': {
    label: 'Panama, Pacific side',
    months: {
      sep: { day: 30, sea: 28, rain: 19, note: 'Wet season, and it is a serious one.' },
      oct: { day: 30, sea: 28, rain: 21, note: 'The wettest month.' },
      nov: { day: 30, sea: 28, rain: 19, note: "Still pouring — 19 rain days, and the dry season has not arrived." },
      dec: { day: 31, sea: 28, rain: 9, note: 'The dry season finally starts around the middle of the month.' },
    },
    open: 'Panama City runs all year; the beach towns are quiet until the dry season.',
    offSeasonRent: 0.85,
    verdict: 'Three wet months and half a good one. The worst-timed of the Latin American options.',
  },
  'panama-caribbean': {
    label: 'Bocas del Toro',
    months: {
      sep: { day: 30, sea: 29, rain: 15, note: 'One of the drier spells here, which is not saying much.' },
      oct: { day: 30, sea: 29, rain: 17, note: "Wet: 17 rain days, and boat crossings get cancelled." },
      nov: { day: 29, sea: 29, rain: 21, note: 'The wettest month of the year.' },
      dec: { day: 29, sea: 28, rain: 20, note: 'Still pouring, and the boats stop when it is rough.' },
    },
    open: 'The islands run all year on a small population.',
    offSeasonRent: 0.8,
    verdict: 'Rules itself out for this window.',
  },
  'south-florida': {
    label: 'South Florida',
    months: {
      sep: { day: 31, sea: 30, rain: 17, note: 'Peak hurricane season, and very humid.' },
      oct: { day: 29, sea: 29, rain: 12, note: 'Clearing towards the end.' },
      nov: { day: 27, sea: 27, rain: 7, note: 'Excellent — the humidity breaks.' },
      dec: { day: 25, sea: 25, rain: 5, note: 'Perfect. 25°C, dry, and the season starts.' },
    },
    open: 'Everything, all year, and December is high season.',
    offSeasonRent: 1.2,
    verdict: 'A hurricane-season start and a perfect finish — and you have no right to live there anyway.',
  },
  'gulf-florida': {
    label: 'The Florida Gulf coast',
    months: {
      sep: { day: 31, sea: 30, rain: 13, note: 'Hurricane season and humid.' },
      oct: { day: 28, sea: 27, rain: 7, note: "Improving fast — the humidity breaks and hurricane season ends." },
      nov: { day: 25, sea: 24, rain: 5, note: "Excellent: 25°C, dry, and the winter season begins." },
      dec: { day: 22, sea: 21, rain: 5, note: 'Mild, dry and bright.' },
    },
    open: 'Year-round cities.',
    offSeasonRent: 1.15,
    verdict: 'Good from mid-October, and the same immigration wall.',
  },
  socal: {
    label: 'Southern California',
    months: {
      sep: { day: 26, sea: 21, rain: 1, note: 'The warmest sea of the year, and the best month in San Diego.' },
      oct: { day: 24, sea: 20, rain: 2, note: "Excellent — 24°C, two rain days, and the sea still at 20°C." },
      nov: { day: 21, sea: 18, rain: 4, note: "Mild and dry at 21°C, with four rain days all month." },
      dec: { day: 19, sea: 16, rain: 6, note: '19°C and sunny. The best American winter.' },
    },
    open: 'Everything.',
    offSeasonRent: 1,
    verdict: 'The best weather in the United States across your exact window, behind a wall you cannot get over.',
  },
  texas: {
    label: 'Austin',
    months: {
      sep: { day: 32, sea: null, rain: 6, note: "Still hot — 32°C, and the good months have not started." },
      oct: { day: 27, sea: null, rain: 7, note: 'The best month of the year here.' },
      nov: { day: 21, sea: null, rain: 6, note: 'Mild and pleasant.' },
      dec: { day: 16, sea: null, rain: 6, note: 'Cool, and the odd hard freeze.' },
    },
    open: 'Everything.',
    offSeasonRent: 1,
    verdict: 'Pleasant and landlocked, and you cannot live there.',
  },
}

/** Which weather a town actually gets. */
const ZONE_OF: Record<PlaceId, string> = {
  chania: 'crete', rethymno: 'crete', heraklion: 'crete',
  'athens-riviera': 'athens', thessaloniki: 'north-greece', corfu: 'ionian',
  rhodes: 'dodecanese', kalamata: 'peloponnese',
  limassol: 'cyprus', paphos: 'cyprus', larnaca: 'cyprus', protaras: 'cyprus', nicosia: 'cyprus',
  valencia: 'valencia-coast', alicante: 'valencia-coast',
  malaga: 'andalusia', marbella: 'andalusia',
  palma: 'balearics', 'las-palmas': 'canaries', 'costa-adeje': 'canaries',
  cascais: 'lisbon-coast', carcavelos: 'lisbon-coast', ericeira: 'lisbon-coast',
  'lagos-pt': 'algarve', portimao: 'algarve', funchal: 'madeira',
  'aci-castello': 'sicily', mondello: 'sicily',
  monopoli: 'puglia', lecce: 'puglia', cagliari: 'sardinia', sanremo: 'liguria',
  sliema: 'malta', gzira: 'malta', mellieha: 'malta', gozo: 'malta',
  split: 'dalmatia', zadar: 'dalmatia', sibenik: 'dalmatia', dubrovnik: 'dalmatia', opatija: 'kvarner',
  budva: 'montenegro-coast', tivat: 'montenegro-coast', 'herceg-novi': 'montenegro-coast', bar: 'montenegro-coast',
  vlore: 'albania-coast', sarande: 'albania-coast', golem: 'albania-coast', himare: 'albania-coast',
  varna: 'black-sea', burgas: 'black-sea', sozopol: 'black-sea', sofia: 'poland-inland',
  sopot: 'baltic', gdynia: 'baltic', krakow: 'poland-inland', warsaw: 'poland-inland',
  batumi: 'georgia-coast', kobuleti: 'georgia-coast', tbilisi: 'georgia-inland',
  jbr: 'gulf', 'dubai-hills': 'gulf', saadiyat: 'gulf',
  rawai: 'andaman', bangtao: 'andaman', 'ao-nang': 'andaman',
  'koh-samui': 'gulf-thailand', 'chiang-mai': 'north-thailand',
  tamarindo: 'guanacaste', 'playas-del-coco': 'guanacaste', jaco: 'guanacaste',
  'santa-teresa': 'guanacaste', uvita: 'cr-south',
  'playa-del-carmen': 'riviera-maya', tulum: 'riviera-maya',
  'puerto-escondido': 'oaxaca-coast', 'puerto-vallarta': 'jalisco', merida: 'yucatan',
  'panama-city': 'panama-pacific', coronado: 'panama-pacific', pedasi: 'panama-pacific',
  bocas: 'panama-caribbean',
  'fort-lauderdale': 'south-florida', 'st-petersburg': 'gulf-florida',
  'san-diego': 'socal', austin: 'texas',
}

export function autumnFor(place: Place): Zone | null {
  return ZONES[ZONE_OF[place.id]] ?? null
}

export function zoneKeyOf(place: Place): string | undefined {
  return ZONE_OF[place.id]
}

/**
 * A single number for how well a town suits late September to December.
 *
 * Warm enough to be outside, dry enough to want to be, a sea worth swimming in,
 * and a town that has not shut. Averaged over the four months, so a place that
 * is perfect in December and a monsoon in October does not score as "fine".
 */
export function autumnScore(place: Place): number {
  const zone = autumnFor(place)
  if (!zone) return 0
  const scores = MONTHS.map(({ key }) => {
    const month = zone.months[key]
    // Warmth peaks around 25°C and falls away on both sides: 31°C and humid is
    // not better than 25°C and dry, it is worse, and an average that says
    // otherwise puts a monsoon above a Cretan October.
    const warmth = Math.max(0, 5 - Math.abs(25 - month.day) * 0.35)
    const dryness = Math.max(0, Math.min(5, (18 - month.rain) / 3))
    const swim = month.sea === null ? 1 : Math.max(0, Math.min(5, (month.sea - 16) / 1.6))
    return warmth * 0.4 + dryness * 0.35 + swim * 0.25
  })
  return scores.reduce((sum, value) => sum + value, 0) / scores.length
}

/**
 * A country's score for this window, taken from its best town.
 *
 * Greece is Chania and it is also Thessaloniki; ranking the country on an
 * average of the two describes neither. The best town is the one you would
 * actually pick, so that is the one the country is judged on.
 */
export function countryAutumnScore(slug: string, places: Place[]): number {
  const own = places.filter((place) => place.country === slug)
  if (own.length === 0) return 0
  return Math.max(...own.map(autumnScore))
}
