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
      training: 4,
      food: 5,
      connectivity: 3,
      admin: 4,
      home: 4,
      proximity: 5,
    },
    monthlyCost: '€1,800–2,600 comfortable in Chania; €2,400–3,400 on the Athens Riviera',
    taxLine:
      '50% of business income exempt for 7 years under Article 5C, and EFKA is a fixed monthly class (~€150 for the first five years, €250–680 after) rather than a percentage — which is what makes it work at a trader’s income.',
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
      training: 3,
      food: 4,
      connectivity: 4,
      admin: 4,
      home: 3,
      proximity: 5,
    },
    monthlyCost: '€2,500–3,500 comfortable in Limassol, of which rent is the problem',
    taxLine:
      'Non-dom status for 17 years: 0% on dividends and interest, which is what makes a Cyprus Ltd paying itself dividends the standard structure. 60-day residency rule if you are not tax-resident anywhere else.',
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
      training: 5,
      food: 5,
      connectivity: 5,
      admin: 3,
      home: 3,
      proximity: 2,
    },
    monthlyCost: '€1,600–2,400 in Valencia, €1,800–2,500 in Málaga',
    taxLine:
      'The Beckham regime does not cover freelancers. As an autónomo you are on the ordinary 19–47% scale on worldwide income plus €350–400/month of social security — the worst effective rate of any candidate here.',
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
    },
    monthlyCost: '€1,800–2,600 outside Lisbon',
    taxLine:
      'IFICI (NHR 2.0) is 20% flat for 10 years, but only on Portuguese-source income from a listed high-value activity. Working for foreign prop firms generally does not qualify, which puts you back on the ordinary scale.',
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
    },
    monthlyCost: '$3,500–5,000 for the life you would actually want there',
    taxLine: '0% personal income tax; Small Business Relief keeps sole traders at 0% under AED 3M revenue.',
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
    },
    monthlyCost: '€1,700–2,500 in the south',
    taxLine:
      'The impatriate regime exempts a share of income for new residents, and the flat-tax-for-newcomers route exists but is priced for wealth, not for a first year of payouts.',
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
    },
    monthlyCost: '$1,500–2,500 for a very comfortable life',
    taxLine:
      'Remitted-income rules mean foreign income brought in during the year it is earned is taxable; the LTR visa and careful remittance are the usual answers.',
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
    },
    monthlyCost: '€1,200–1,800 on the coast',
    taxLine: '10% flat on everything, 5% on dividends, capped social contributions.',
    theCatch:
      'The Black Sea coast is closed for half the year — January highs around 5°C, the resorts shuttered, the beach a place you walk past in a coat.',
    notes: [
      'Sofia has the best internet in the region and a real gym scene; the coast does not.',
      'If tax were the only criterion this would win. It is not.',
    ],
    sources: [{ label: 'Existing tax comparison — see the Tax page', url: '/tax' }],
  },
]
