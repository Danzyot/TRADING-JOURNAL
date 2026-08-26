/**
 * The candidates, scored against the criteria in ./criteria.ts.
 *
 * Every number here has a source and a date, because a relocation decision made
 * on a half-remembered figure is a decision made twice. Where a claim is a
 * judgement rather than a figure — "the MMA scene is thin" — it says so.
 *
 * Scores are 0–5 and always relative to the same question: how well does this
 * place serve *this* person — a 21-year-old EU-passport prop trader who wants
 * sun, sea, a gym and an MMA room, unprocessed food, fibre he can trade on, and
 * a rent that is not Tel Aviv's.
 *
 * The tax scores are deliberately shallow. The tax page carries the real
 * comparison, and repeating it here is how the two drift apart.
 */
import type { CriterionKey } from './criteria'

export const ABROAD_VERIFIED = 'August 2026'

export type Source = { label: string; url: string }

export type Candidate = {
  slug: string
  flag: string
  country: string
  /** The specific places worth looking at, not the country as an abstraction. */
  spots: string[]
  headline: string
  scores: Record<CriterionKey, number>
  /** What it costs a single person to live comfortably, per month, all in. */
  monthlyCost: string
  /** The rate a prop trader would actually pay once genuinely resident. */
  taxLine: string
  /**
   * A constraint no weighting can outvote — a live travel advisory, no right to
   * be there. A country with one is shown last with the reason, rather than
   * being averaged into fifth place by its beaches.
   */
  hardStop?: string
  /** October to March in one line, since that is the part being worried about. */
  winter: string
  /** The thing that would make you leave after a year. */
  theCatch: string
  notes: string[]
  sources: Source[]
}

/**
 * Israel is the benchmark, not a candidate: everything below is "compared to
 * staying". Numbeo and Expatistan disagree by a few points, which is why the
 * range is quoted rather than a single figure.
 */
export const BENCHMARK = {
  label: 'Tel Aviv today',
  cost: 'Israel runs ~52% above Greece country-to-country; Tel Aviv specifically is ~82–87% above Athens.',
  sources: [
    {
      label: 'Numbeo — Greece vs Israel',
      url: 'https://www.numbeo.com/cost-of-living/compare_countries_result.jsp?country1=Greece&country2=Israel',
    },
    {
      label: 'Expatistan — Athens vs Tel Aviv',
      url: 'https://www.expatistan.com/cost-of-living/comparison/athens-greece/tel-aviv',
    },
  ] satisfies Source[],
}

export const CANDIDATES: Candidate[] = [
  {
    slug: 'greece',
    flag: '🇬🇷',
    country: 'Greece',
    spots: ['Chania, Crete', 'Rethymno, Crete', 'Athens Riviera (Voula / Glyfada)', 'Kalamata'],
    headline: 'The one that fits the life you described, if you pick the town carefully.',
    scores: {
      cost: 5,
      tax: 4,
      climate: 4,
      beach: 5,
      training: 3,
      food: 5,
      connectivity: 3,
      admin: 4,
      home: 4,
      proximity: 5,
      safety: 4,
    },
    monthlyCost: '€1,800–2,600 comfortable in Chania; €2,400–3,400 on the Athens Riviera',
    taxLine:
      '50% of business income exempt for 7 years under Article 5C, and EFKA is a fixed monthly class (~€150 for the first five years, €250–680 after) rather than a percentage — which is what makes it work at a trader’s income.',
    winter:
      'Crete: 17°C days in December, 14°C in January, and rain on more days than not. Mild and wet, not cold.',
    theCatch:
      'Winter is mild but wet: December and January are the rainiest months of the Cretan year. And rural fibre is a lottery — a beautiful house 20 minutes outside town can be on 10 Mbps copper.',
    notes: [
      'Article 5C: 50% exemption on employment or individual business activity income for up to 7 years, for someone who was not Greek-resident 5 of the last 6 years, moving from an EU/EEA or treaty country, committing to stay 2 years. Law 5222/2025 dropped the "new position" requirement.',
      'EFKA for the self-employed is a chosen class, not a rate — six classes, roughly €250–680/month, with reduced starter classes around €145–155 for the first five years, plus €10 unemployment.',
      'Same time zone as Israel (EET/EEST), so the trading day does not move at all — the New York open stays at 16:30 local.',
      'Flight time Athens–Tel Aviv is under 2 hours, with daily direct flights from both Athens and Heraklion in season.',
      'A Polish passport makes this a registration, not an immigration case: AFM, then AMKA, then the EU registration certificate at the local police Aliens Department.',
    ],
    sources: [
      {
        label: 'PwC — Greece, 50% exemption for relocating individuals',
        url: 'https://taxsummaries.pwc.com/greece/individual/other-tax-credits-and-incentives',
      },
      {
        label: 'Amoiridis — Article 5C after Law 5222/2025',
        url: 'https://www.greeklawfirm.co.uk/legal-articles-and-media-gb/greece-strengthens-its-brain-gain-strategy-the-new-era-of-the-50-tax-regime-article-5c/',
      },
      { label: 'EFKA contributions 2026', url: 'https://aptax.gr/en/blog/efka-contributions-2026' },
      {
        label: 'AFM / AMKA / EU certificate, step order',
        url: 'https://xpat.gr/afm-amka-greece/',
      },
    ],
  },
  {
    slug: 'cyprus',
    flag: '🇨🇾',
    country: 'Cyprus',
    spots: ['Limassol (Germasogeia)', 'Paphos', 'Larnaca'],
    headline: 'Warmer and drier than Greece in winter, and 45 minutes from home.',
    scores: {
      cost: 3,
      tax: 5,
      climate: 5,
      beach: 5,
      training: 5,
      food: 4,
      connectivity: 4,
      admin: 4,
      home: 3,
      proximity: 5,
      safety: 5,
    },
    monthlyCost: '€2,500–3,500 comfortable in Limassol, of which rent is the problem',
    taxLine:
      'Non-dom status for 17 years: 0% on dividends and interest, which is what makes a Cyprus Ltd paying itself dividends the standard structure. 60-day residency rule if you are not tax-resident anywhere else.',
    winter:
      'The warmest and driest winter in the EU. 18–19°C days on the coast, sea still swimmable in November.',
    theCatch:
      'Limassol rents rose 25–40% since 2020 and the city is full of people doing exactly this. It is the least Greek-feeling option — a finance town, not a beach town.',
    notes: [
      'January daytime highs around 17°C in Paphos, 19°C in Limassol, and roughly 180 hours of December sunshine — the mildest winter of any EU option here.',
      'A single professional lives comfortably on €1,600–2,200 excluding the worst of the rent; entrepreneurs quote €2,500–3,500 all in.',
      'Israelis are everywhere, Hebrew is widely heard, and Tel Aviv is a 45-minute flight — the easiest "try it without burning the bridge" option.',
    ],
    sources: [
      { label: 'Paphos climate averages', url: 'https://www.weather-atlas.com/en/cyprus/paphos-climate' },
      { label: 'Cost of living in Limassol 2026', url: 'https://www.cyprustaxlife.com/cost-of-living/limassol' },
      { label: 'Climates to Travel — Cyprus', url: 'https://www.climatestotravel.com/climate/cyprus' },
    ],
  },
  {
    slug: 'spain',
    flag: '🇪🇸',
    country: 'Spain',
    spots: ['Valencia', 'Málaga', 'Alicante'],
    headline: 'The best day-to-day life on the list, and the worst tax answer.',
    scores: {
      cost: 4,
      tax: 1,
      climate: 4,
      beach: 5,
      training: 4,
      food: 5,
      connectivity: 5,
      admin: 3,
      home: 3,
      proximity: 2,
      safety: 2,
    },
    monthlyCost: '€1,600–2,400 in Valencia, €1,800–2,500 in Málaga',
    taxLine:
      'The Beckham regime does not cover freelancers. As an autónomo you are on the ordinary 19–47% scale on worldwide income plus €350–400/month of social security — the worst effective rate of any candidate here.',
    winter:
      'Málaga is 17–18°C in January, the warmest on mainland Europe. Valencia 16°C. The Canaries never drop below 20°C.',
    theCatch:
      'Tax. Everything else about Spain fits: the gyms, the food, the fibre, the sea. The money does not.',
    notes: [
      'Beckham excludes autónomos explicitly; the only door is founding an ENISA-certified startup, which is a different life to being a prop trader.',
      'Valencia is the value pick — beaches 20 minutes from the centre, a real city, and rents well below Barcelona or Madrid.',
      'Deepest martial-arts scene of any option here by a distance.',
    ],
    sources: [
      {
        label: 'Beckham Law 2026 — the freelancer trap',
        url: 'https://solandworld.com/spain-beckham-law-2026-the-24-flat-tax-regime-deep-dive-including-the-freelancer-trap/',
      },
      { label: 'Málaga vs Valencia cost of living', url: 'https://citycost.org/compare/malaga-vs-valencia/' },
    ],
  },
  {
    slug: 'portugal',
    flag: '🇵🇹',
    country: 'Portugal',
    spots: ['Lagos / Algarve', 'Cascais', 'Ericeira'],
    headline: 'Atlantic, not Mediterranean — and the tax break probably will not cover you.',
    scores: {
      cost: 4,
      tax: 2,
      climate: 3,
      beach: 4,
      training: 4,
      food: 4,
      connectivity: 5,
      admin: 3,
      home: 3,
      proximity: 1,
      safety: 4,
    },
    monthlyCost: '€1,800–2,600 outside Lisbon',
    taxLine:
      'IFICI (NHR 2.0) is 20% flat for 10 years, but only on Portuguese-source income from a listed high-value activity. Working for foreign prop firms generally does not qualify, which puts you back on the ordinary scale.',
    winter:
      '16°C and wet on the Algarve, cooler and windier on the Lisbon coast. Mild, grey, and the Atlantic stays cold all year.',
    theCatch:
      'The Atlantic is cold and rough — this is a surf coast, not a swim coast — and it is a 5-hour flight plus a connection from Israel.',
    notes: [
      'IFICI requires the qualifying activity to be met every year, and remote work for foreign clients is the case it is written to exclude.',
      'Best English of the southern-European options, and the fibre is excellent.',
    ],
    sources: [
      { label: 'IFICI / NHR 2.0 eligibility 2026', url: 'https://fresh-legal.com/ifici-nhr-2-portugal-tax-guide/' },
      { label: 'Immigrant Invest — IFICI regime', url: 'https://immigrantinvest.com/blog/portugal-ifici-regime/' },
    ],
  },
  {
    slug: 'uae',
    flag: '🇦🇪',
    country: 'UAE (Dubai)',
    spots: ['JBR / Dubai Marina', 'Palm Jumeirah'],
    headline: 'Zero tax, and a summer you will spend indoors.',
    scores: {
      cost: 2,
      tax: 5,
      climate: 2,
      beach: 4,
      training: 5,
      food: 3,
      connectivity: 5,
      admin: 4,
      home: 2,
      proximity: 4,
      safety: 4,
    },
    monthlyCost: '$3,500–5,000 for the life you would actually want there',
    taxLine: '0% personal income tax; Small Business Relief keeps sole traders at 0% under AED 3M revenue.',
    winter:
      'Perfect from November to March — 25°C, dry, the outdoor season. It is May to September that is unliveable.',
    theCatch:
      'May to September is 40°C and 60% humidity — no beach, no running, no outdoor anything. You would be trading the exact lifestyle you are moving for, six months a year.',
    notes: [
      'World-class MMA — UFC gyms, world champions in residence — and every fitness facility you could ask for.',
      'The tax saving is real and the cost of living eats a large part of it; rents are Tel Aviv-shaped.',
      'Organic and unprocessed food is available and expensive: almost everything is imported.',
    ],
    sources: [
      { label: 'Existing tax comparison — see the Tax page', url: '/tax' },
    ],
  },
  {
    slug: 'italy',
    flag: '🇮🇹',
    country: 'Italy',
    spots: ['Puglia (Monopoli / Polignano)', 'Sicily (Catania)', 'Sardinia (Cagliari)'],
    headline: 'The food and the sea are the best here. The bureaucracy is the worst.',
    scores: {
      cost: 4,
      tax: 3,
      climate: 4,
      beach: 5,
      training: 3,
      food: 5,
      connectivity: 3,
      admin: 1,
      home: 4,
      proximity: 3,
      safety: 4,
    },
    monthlyCost: '€1,700–2,500 in the south',
    taxLine:
      'The impatriate regime exempts a share of income for new residents, and the flat-tax-for-newcomers route exists but is priced for wealth, not for a first year of payouts.',
    winter:
      'Sicily 16°C, Puglia 14°C, and the Ligurian coast 13°C and grey. The south is mild; the north is a northern winter.',
    theCatch:
      'Italian administration is a full-time job in itself, and southern fibre is patchy outside the cities.',
    notes: [
      'Houses with land near the sea in Puglia rent for less than a flat in Athens.',
      'Weakest of the EU options for MMA outside the big northern cities.',
    ],
    sources: [{ label: 'Existing tax comparison — see the Tax page', url: '/tax' }],
  },
  {
    slug: 'thailand',
    flag: '🇹🇭',
    country: 'Thailand',
    spots: ['Phuket (Rawai / Chalong)', 'Koh Samui'],
    headline: 'The best training on earth for this sport, and the furthest from everything.',
    scores: {
      cost: 5,
      tax: 4,
      climate: 3,
      beach: 5,
      training: 5,
      food: 4,
      connectivity: 4,
      admin: 3,
      home: 5,
      proximity: 0,
      safety: 5,
    },
    monthlyCost: '$1,500–2,500 for a very comfortable life',
    taxLine:
      'Remitted-income rules mean foreign income brought in during the year it is earned is taxable; the LTR visa and careful remittance are the usual answers.',
    winter:
      '30°C every day. Phuket is dry November to April; Samui takes its rain in exactly Q4.',
    theCatch:
      'The trading day. Thailand is UTC+7 — the New York session opens at 20:30 and the US close is past 04:00. Everything else fits; the clock does not.',
    notes: [
      'Phuket is the world capital of Muay Thai and has serious MMA camps (Tiger, Bangtao) with day rates.',
      'A house with a pool rents for what a flat costs in Chania.',
      '11 hours and a connection from Israel, and a 4-hour time difference to family.',
    ],
    sources: [{ label: 'Existing tax comparison — see the Tax page', url: '/tax' }],
  },
  {
    slug: 'bulgaria',
    flag: '🇧🇬',
    country: 'Bulgaria',
    spots: ['Varna', 'Burgas', 'Sofia'],
    headline: 'The cheapest EU answer, with a winter that defeats the point of moving.',
    scores: {
      cost: 5,
      tax: 5,
      climate: 1,
      beach: 2,
      training: 3,
      food: 4,
      connectivity: 5,
      admin: 3,
      home: 4,
      proximity: 3,
      safety: 4,
    },
    monthlyCost: '€1,200–1,800 on the coast',
    taxLine: '10% flat on everything, 5% on dividends, capped social contributions.',
    winter:
      'A proper continental winter: 5°C highs, snow, and a sea at 8°C. The coast closes.',
    theCatch:
      'The Black Sea coast is closed for half the year — January highs around 5°C, the resorts shuttered, the beach a place you walk past in a coat.',
    notes: [
      'Sofia has the best internet in the region and a real gym scene; the coast does not.',
      'If tax were the only criterion this would win. It is not.',
    ],
    sources: [{ label: 'Existing tax comparison — see the Tax page', url: '/tax' }],
  },
  {
    slug: 'malta',
    flag: '🇲🇹',
    country: 'Malta',
    spots: ['Sliema / St Julian’s', 'Gżira', 'Mellieħa', 'Gozo'],
    headline: 'English, EU, one hour from home, and the least room to breathe on this list.',
    scores: {
      cost: 2,
      tax: 4,
      climate: 5,
      beach: 3,
      training: 5,
      food: 3,
      connectivity: 5,
      admin: 5,
      home: 2,
      proximity: 5,
      safety: 3,
    },
    monthlyCost: '€1,900 on Gozo, €2,800 in Sliema',
    taxLine:
      'Resident non-dom: foreign income is taxed only when remitted, and foreign capital gains never — but a €5,000 minimum tax applies once foreign income passes €35,000, remitted or not.',
    winter:
      '16°C days, wet from November to February, and wind. Never cold, rarely still.',
    theCatch:
      'A whole house near a beach effectively does not exist outside Gozo, the island is over-built, and the traffic on a rock 27 km long is genuinely bad.',
    notes: [
      'Everything runs in English, including the tax office and the banks — the lowest-friction settling on this list.',
      'Malta Fight Co. in Sliema is a real academy: BJJ under a Bustamante black belt, MMA, Muay Thai, ~20 classes a week for €70–100.',
      'The familiar 15% Maltese rate belongs to elective programmes (GRP and similar), not to ordinary non-dom residence. Do not plan on it without advice.',
      'Sea swimming is off rocks and ladders rather than sand, which suits some people and not others.',
    ],
    sources: [
      {
        label: 'Malta non-dom regime and the €5,000 minimum tax',
        url: 'https://immigrantinvest.com/blog/malta-non-dom-regime/',
      },
      { label: 'Malta Fight Co.', url: 'https://maltafightco.com/bjj/' },
    ],
  },
  {
    slug: 'croatia',
    flag: '🇭🇷',
    country: 'Croatia',
    spots: ['Split', 'Zadar', 'Šibenik', 'Opatija / Rijeka'],
    headline: 'The best-value Adriatic coast, with a winter that is cold rather than wet-warm.',
    scores: {
      cost: 4,
      tax: 4,
      climate: 2,
      beach: 4,
      training: 3,
      food: 4,
      connectivity: 4,
      admin: 4,
      home: 4,
      proximity: 3,
      safety: 3,
    },
    monthlyCost: '€1,650–2,000 on the coast',
    taxLine:
      'Paušalni obrt — the flat-rate sole trader — assumes 85% costs and taxes the remaining 15%, which works out to roughly 11–13% of gross including fixed contributions, up to €60,000 of revenue.',
    winter:
      '10°C in January on the Dalmatian coast with the bura behind it. The coldest Mediterranean winter on this list.',
    theCatch:
      'January on the Dalmatian coast sits around 10°C with the bura wind behind it, and the €60,000 ceiling on the flat-rate regime is low for a trader having a good year.',
    notes: [
      'EU member and in the euro and Schengen, so a Polish passport makes this pure registration.',
      'Mizfits BJJ in Split has two mat halls and an MMA cage; Zadar hosts the ADCC Croatia Open.',
      'Above €60,000 of revenue you leave paušalni obrt for full bookkeeping and much higher effective rates — model that before committing.',
    ],
    sources: [
      { label: 'Paušalni obrt — flat-rate sole trader, 2026', url: 'https://www.fiskai.hr/en/vodic/pausalni-obrt/' },
      { label: 'Mizfits BJJ Academy Split', url: 'https://mizfitsbjjsplit.com/en/mizfits-bjj-academy-split/' },
    ],
  },
  {
    slug: 'montenegro',
    flag: '🇲🇪',
    country: 'Montenegro',
    spots: ['Budva', 'Tivat', 'Herceg Novi', 'Bar'],
    headline: 'Adriatic living at Balkan prices, outside the EU and outside the safety net.',
    scores: {
      cost: 5,
      tax: 4,
      climate: 3,
      beach: 4,
      training: 2,
      food: 4,
      connectivity: 3,
      admin: 2,
      home: 5,
      proximity: 3,
      safety: 3,
    },
    monthlyCost: '€1,300–1,900 on the coast',
    taxLine:
      'Personal income at 9–15%, with the first €8,400 of self-employment income untaxed; corporate tax 9%.',
    winter:
      'Mild at 12°C and among the wettest in Europe — the Bay of Kotor takes serious rain from November.',
    theCatch:
      'Not in the EU, so the Polish passport buys you nothing — residence is an application, renewed. And the coast has one real MMA club for the whole country.',
    notes: [
      'MMA Klub Budva at the SCR sports centre and PitBull BJJ in Podgorica are the scene, and that is the whole scene.',
      'Uses the euro without being in the eurozone, which keeps prices legible and the banking awkward.',
      'Winter on the Bay of Kotor is mild and very wet — Herceg Novi is one of the rainiest towns on the Adriatic.',
    ],
    sources: [
      { label: 'Montenegro tax rates 2026', url: 'https://taxratesbycountry.com/tax-rates-in-montenegro/' },
      { label: 'MMA Klub Budva', url: 'https://www.montenegrofortravellers.com/en/place/mma-klub-budva' },
    ],
  },
  {
    slug: 'albania',
    flag: '🇦🇱',
    country: 'Albania',
    spots: ['Vlorë', 'Sarandë', 'Himarë', 'Durrës / Golem'],
    headline: 'The cheapest coast in Europe, and the least finished.',
    scores: {
      cost: 5,
      tax: 5,
      climate: 4,
      beach: 4,
      training: 1,
      food: 5,
      connectivity: 3,
      admin: 2,
      home: 5,
      proximity: 4,
      safety: 4,
    },
    monthlyCost: '€1,100–1,250 anywhere on the coast',
    taxLine:
      'Self-employed at 23% on net income in principle — but commercial individuals and the self-employed with gross income up to ALL 14 million (~€135,000) pay 0% personal income tax until 31 December 2029.',
    winter:
      '14–15°C on the Ionian coast, wet in December and January, and the towns empty out.',
    theCatch:
      'The training answer is essentially no: one jiu-jitsu club in Sarandë and everything else in Tirana. And the coast is a construction site.',
    notes: [
      'Israelis and EU citizens can stay a year visa-free, which makes trying it before committing unusually easy.',
      'Food is farm-to-table because the industrial supply chain never arrived — the produce is exceptional and costs almost nothing.',
      'The Ionian coast south of Vlorë is genuinely beautiful. The Adriatic coast north of it is not.',
      'The 0% band is legislated to 2029, not forever — build the plan around it ending.',
    ],
    sources: [
      { label: 'Albania — individual taxes on personal income (PwC)', url: 'https://taxsummaries.pwc.com/albania/individual/taxes-on-personal-income' },
    ],
  },
  {
    slug: 'poland',
    flag: '🇵🇱',
    country: 'Poland',
    spots: ['Gdańsk / Sopot', 'Gdynia', 'Kraków', 'Warsaw'],
    headline: 'Your passport country: the easiest paperwork on earth, attached to the wrong weather.',
    scores: {
      cost: 5,
      tax: 3,
      climate: 1,
      beach: 2,
      training: 5,
      food: 5,
      connectivity: 5,
      admin: 5,
      home: 3,
      proximity: 3,
      safety: 3,
    },
    monthlyCost: '€1,500–1,900',
    taxLine:
      'Ryczałt — lump sum on revenue, not profit — at 8.5% or 12% depending on how the activity classifies, plus fixed ZUS contributions of PLN 2,425–3,422 a month. Effective burden lands around 20–26%.',
    winter:
      '2°C in December, dark by 15:30, and the Baltic is decorative from October to May.',
    theCatch:
      'December in Gdańsk is 2°C and dark at 15:30, and the Baltic is swimmable for about six weeks. Everything in the brief except the weather is here.',
    notes: [
      'You are already a citizen. No registration, no permit, no waiting — you can be resident the day you land, and this is the only country on the list where that is true.',
      'Poland is a serious MMA country: Akademia Sarmatia in Gdańsk, Atos Warsaw, Akademia Gorila, MMA Academy Kraków, and 120 BJJ gyms nationally.',
      'Food quality per euro is among the best in Europe, and organic is mainstream rather than a premium tier.',
      'ZUS is a fixed monthly cost regardless of a bad month — which is the wrong shape for trading income, unlike Greece where the class is chosen but comparable.',
      'Worth holding as the fallback: if a country you try does not work, this one cannot refuse you.',
    ],
    sources: [
      { label: 'Ryczałt rates by activity, 2026', url: 'https://www.podnik.io/en/blog/poland/faq-ryczalt-rates-2026' },
      { label: 'Self-employment in Poland — ZUS and registration', url: 'https://cgolegal.com/taxes-in-poland/self-employment-in-poland/' },
    ],
  },
  {
    slug: 'turkey',
    flag: '🇹🇷',
    country: 'Turkey',
    spots: ['Antalya (Konyaaltı)', 'Çeşme / Alaçatı', 'Fethiye / Kaş', 'Bodrum'],
    headline: 'Warm, cheap, an hour and a half away — and financially unpredictable.',
    scores: {
      cost: 5,
      tax: 2,
      climate: 5,
      beach: 5,
      training: 2,
      food: 5,
      connectivity: 4,
      admin: 2,
      home: 5,
      proximity: 5,
      safety: 1,
    },
    monthlyCost: '€1,050–1,600',
    taxLine:
      'Progressive 15–40% on income, with none of the expat regimes the EU countries offer. There is no tax argument for Turkey.',
    hardStop:
      'Israel has a standing “do not travel” advisory for Turkey at its most severe level, after an armed incident near the Israeli consulate in Istanbul in April 2026. Ruled out on safety until that changes, whatever it costs.',
    winter:
      'Antalya is 15–16°C in January with 300 days of sun a year — the best winter climate per euro on this list.',
    theCatch:
      'Inflation. Every euro figure here is a snapshot, rents reset annually against a lira that moves, and residence permits for Europeans have been tightened rather than eased.',
    notes: [
      'Antalya is a real year-round city of 2.5 million with a 7 km beach and the Taurus mountains behind it — the best climate-per-euro on this list.',
      'Corvos Combat in Antalya and NEST Combatfitness in İzmir are the rooms; the scene is growing but shallow compared to Spain or Poland.',
      'Direct flights Tel Aviv–Antalya are short and cheap when the political relationship allows them, which is not always.',
      'The produce is exceptional — Antalya province grows most of Turkey’s vegetables.',
    ],
    sources: [
      { label: 'Corvos Combat BJJ & MMA, Antalya', url: 'https://www.facebook.com/p/Corvos-Combat-BJJ-MMA-Antalya-100064118200475/' },
    ],
  },
  {
    slug: 'georgia',
    flag: '🇬🇪',
    country: 'Georgia',
    spots: ['Tbilisi', 'Batumi', 'Kobuleti'],
    headline: 'A 1% tax rate, the best food per euro anywhere, and no summer sea worth the name.',
    scores: {
      cost: 5,
      tax: 5,
      climate: 2,
      beach: 2,
      training: 3,
      food: 5,
      connectivity: 4,
      admin: 4,
      home: 4,
      proximity: 4,
      safety: 5,
    },
    monthlyCost: '€900–1,250',
    taxLine:
      'Individual Entrepreneur with Small Business Status: 1% of turnover up to GEL 500,000 (~€165,000), 3% above it. Registered in an afternoon, no residency requirement, and services to foreign clients are outside VAT.',
    winter:
      'Batumi is 10°C and one of the rainiest places in Europe; Tbilisi is colder and drier.',
    theCatch:
      'Batumi takes over 2,000 mm of rain a year — more than double Chania — and Tbilisi has no sea at all. The tax is the best on the list and the climate is not.',
    notes: [
      'Israelis get 365 days visa-free, which makes a trial run trivially easy.',
      'Warriors Tbilisi, GLADIUS, Legion BJJ and Gymnasia Sports make the capital a genuinely good training city; the coast is not.',
      'The 1% regime is on turnover, so a losing month still pays — small in absolute terms, but model it.',
      'A land border with Russia is a political risk you would be taking on knowingly.',
    ],
    sources: [
      { label: 'Georgia 1% small business status, 2026 updates', url: 'https://expathub.ge/2026-updates-to-the-special-tax-regimes/' },
    ],
  },
  {
    slug: 'costa-rica',
    flag: '🇨🇷',
    country: 'Costa Rica',
    spots: ['Tamarindo', 'Santa Teresa', 'Playas del Coco', 'Jacó'],
    headline: 'Territorial tax, real jungle-and-beach living, and a timezone that cuts you off from home.',
    scores: {
      cost: 3,
      tax: 5,
      climate: 4,
      beach: 5,
      training: 4,
      food: 4,
      connectivity: 3,
      admin: 2,
      home: 5,
      proximity: 1,
      safety: 4,
    },
    monthlyCost: '€1,700–2,400 on the Pacific coast',
    taxLine:
      'Territorial: only Costa Rican-source income is taxed, so foreign prop payouts fall outside the system entirely. The Rentista residency needs $2,500/month of certified foreign income and pulls you into CCSS social security.',
    winter:
      '28°C year-round. Guanacaste is dry December to April; the south Pacific rains most of the year.',
    theCatch:
      'Israel is 8 hours ahead. Your family is asleep when you are working and awake when you are not, and a weekend home is a 20-hour trip with two connections.',
    notes: [
      'Hero Academy in Tamarindo, Santa Teresa MMA and Coco Beach MMA all run real adult schedules — better training than the Balkans, worse than Spain.',
      'The New York open lands at 07:30 local, which is the best trading clock on this entire list.',
      'September and October on the Pacific coast are a wall of rain; Guanacaste is the dry exception and turns brown for it.',
      'Starlink is the normal fallback outside the towns, and most people run it as primary.',
    ],
    sources: [
      { label: 'Costa Rica Rentista residency, 2026', url: 'https://visawisely.com/en/visa/costa-rica/costa-rica-rentista/' },
      { label: 'Hero Academy, Tamarindo', url: 'https://herobjj.com/' },
    ],
  },
  {
    slug: 'mexico',
    flag: '🇲🇽',
    country: 'Mexico',
    spots: ['Playa del Carmen', 'Puerto Escondido', 'Puerto Vallarta', 'Tulum'],
    headline: 'Caribbean water, a real jiu-jitsu scene, and a tax system that taxes you worldwide.',
    scores: {
      cost: 4,
      tax: 3,
      climate: 5,
      beach: 5,
      training: 4,
      food: 5,
      connectivity: 4,
      admin: 3,
      home: 4,
      proximity: 1,
      safety: 4,
    },
    monthlyCost: '€1,400–2,100',
    taxLine:
      'RESICO taxes small self-employed residents at 1–2.5% of gross up to ~MXN 3.5 million — very low. But Mexican residents are taxed on worldwide income, so this is a regime you enter deliberately with advice, not by accident.',
    winter:
      '27°C on the Caribbean, dry and clear from November to April. The best winter on this list.',
    theCatch:
      'Distance and the security picture. Quintana Roo is not what it was five years ago, and sargassum can close the beach for weeks between April and August.',
    notes: [
      'Gracie Barra Playa del Carmen and Team Balance are established rooms; B-Team is opening a permanent base outside Tulum.',
      'Temporary residency is straightforward on proof of income and converts to permanent after four years.',
      'The food is the best-value argument in the Americas — Oaxaca in particular.',
      'Same timezone problem as Costa Rica, with a good trading clock and a bad family clock.',
    ],
    sources: [
      { label: 'Gracie Barra Playa del Carmen', url: 'https://www.facebook.com/GracieBarraRM/' },
    ],
  },
  {
    slug: 'panama',
    flag: '🇵🇦',
    country: 'Panama',
    spots: ['Playa Coronado', 'Panama City', 'Bocas del Toro'],
    headline: 'Territorial tax and dollarised banking, wrapped around a country with very little to do.',
    scores: {
      cost: 3,
      tax: 5,
      climate: 3,
      beach: 3,
      training: 2,
      food: 3,
      connectivity: 4,
      admin: 3,
      home: 4,
      proximity: 1,
      safety: 5,
    },
    monthlyCost: '€1,500–2,400',
    taxLine:
      'Territorial: foreign-source income is not taxed at all, and the country runs on US dollars so there is no currency risk on your balance.',
    winter:
      '30°C and humid all year, with a dry season December to April on the Pacific side.',
    theCatch:
      'The Pacific beaches near the capital are grey and muddy, the Caribbean side is remote and rains constantly, and there is one serious mat in the country.',
    notes: [
      'Punta Pacífica hospital is Johns Hopkins-affiliated and Tocumen is the best-connected airport in the region.',
      'Playa Coronado BJJ and an Atos affiliate in the city are the training answer, and it is a thin one.',
      'Banking is the easiest in Latin America for a foreigner, which is the actual reason people choose Panama.',
      'Humidity is 80%+ year-round on both coasts.',
    ],
    sources: [
      { label: 'Playa Coronado BJJ', url: 'https://www.bjjglobetrotters.com/featured-affiliated-academy-playa-coronado-bjj-panama/' },
    ],
  },
  {
    slug: 'usa',
    flag: '🇺🇸',
    country: 'United States',
    spots: ['Miami / Fort Lauderdale', 'Tampa / St Petersburg', 'San Diego', 'Austin'],
    headline: 'The best training and the right trading clock, behind an immigration wall.',
    scores: {
      cost: 1,
      tax: 2,
      climate: 5,
      beach: 5,
      training: 5,
      food: 5,
      connectivity: 5,
      admin: 1,
      home: 2,
      proximity: 2,
      safety: 4,
    },
    monthlyCost: '€3,200–4,200',
    taxLine:
      'Federal tax on worldwide income at 10–37% plus self-employment tax; Florida and Texas add no state tax, California adds up to 13.3%.',
    hardStop:
      'No right to live there. Both your passports give 90 visa-free days as a visitor with no work rights; the E-2 and O-1 routes are years, lawyers and real money. Ruled out as a move, available as a 90-day visit.',
    winter:
      'South Florida is 25°C and dry in winter; San Diego is 20°C and sunny. Both are at their best in Q4.',
    theCatch:
      'You have no right to be there. An Israeli or Polish passport is 90 visa-free days as a visitor with no work rights; E-2 and O-1 are years, lawyers and real money. Everything else about South Florida fits the brief better than anywhere else on this list, and none of it is available to you.',
    notes: [
      'South Florida has the densest elite jiu-jitsu outside Rio: American Top Team, Fight Sports, Atos Miami, Valente Brothers.',
      'San Diego is the American training mecca — Legion, Victory MMA, The Arena — with the best climate in the country.',
      'The market opens at 09:30 where you live, which removes the single biggest friction in every other option.',
      'Included so the comparison is honest, not because it is actionable. Revisit only if a visa route opens.',
    ],
    sources: [
      { label: 'Gold BJJ — San Diego gyms', url: 'https://goldbjj.com/blogs/gyms/san-diego' },
    ],
  },
]
