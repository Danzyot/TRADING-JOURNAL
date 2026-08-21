/**
 * Structures and relocation — the research behind the Tax page's
 * "beyond Israel" section, kept as data so the annual re-verification is
 * one file. Researched August 2026; full write-up with sources in
 * docs/TAX-RELOCATION.md. These are published-rule summaries, not advice.
 */

export const RELOCATION_VERIFIED = 'August 2026'

export type EntityVerdict = {
  name: string
  verdict: string
  detail: string
}

export const ENTITY_VERDICTS: EntityVerdict[] = [
  {
    name: 'US S corporation',
    verdict: 'Not available to you',
    detail:
      'An S corp legally cannot have a non-US-resident shareholder (IRC §1361) — one ineligible owner voids the election. Its famous benefit is a US self-employment-tax split that has no Israeli equivalent. US-resident advice that does not transfer.',
  },
  {
    name: 'US LLC',
    verdict: 'Same tax, or worse — buy it for banking only',
    detail:
      'ITA Circular 5/2004 lets you treat an LLC as transparent (income flows to you, taxed exactly like today, plus ~$500–1,000/yr of US filings and a $25,000 Form 5472 penalty if missed) or as a company — which, run from Israel, becomes an Israeli company via management-and-control: 23% corporate + 30–33% dividend ≈ 46–48% combined. Worth having only for US banking rails and payout plumbing.',
  },
  {
    name: 'Israeli Ltd (חברה בע"מ)',
    verdict: 'Only at high income with profits retained',
    detail:
      '23% corporate + dividend tax on what you take out beats personal rates only when you consistently earn well above living costs and can leave profits in the company. The comparison table above computes the crossover on your real numbers.',
  },
  {
    name: 'Write-offs (any structure)',
    verdict: 'Identical everywhere — no entity adds deductions',
    detail:
      'Deductions attach to the expense, not the wrapper. Your osek already deducts everything a company would: evaluations, resets, data feeds, platform subscriptions, hardware, home-office and internet share, courses, accountant fees, business travel.',
  },
]

/** Common deductibles for a prop trader registered as an osek. */
export const DEDUCTIBLE_CHECKLIST: { item: string; note: string }[] = [
  { item: 'Evaluation fees, resets, activations', note: 'Fully deductible business input — log every one' },
  { item: 'Data feeds & platform subscriptions', note: 'Tradovate, Rithmic, copier, VPS, TradingView' },
  { item: 'Hardware', note: 'Computers and screens — depreciated over ~3 years' },
  { item: 'Home office share', note: 'A reasonable share of rent, electricity, arnona for the room you trade from' },
  { item: 'Internet & phone share', note: 'The business portion, typically 50–80%' },
  { item: 'Courses & trading education', note: 'Maintaining/improving an existing profession is deductible; career change is not' },
  { item: 'Accountant & legal fees', note: 'Fully deductible' },
  { item: 'Business travel', note: 'With a documented business purpose — partial deductions per published rates' },
  { item: 'Input VAT back', note: 'Your payouts are zero-rated exports (s.30(a)(5)); VAT you pay on Israeli purchases is reclaimable as osek murshe' },
]

export type RelocationOption = {
  flag: string
  country: string
  regime: string
  /** Rough all-in on ~$100k of prop payouts. */
  effective: string
  presence: string
  complexity: 'Low' | 'Mid' | 'High'
  theCatch: string
  detail: string
}

export const RELOCATION_OPTIONS: RelocationOption[] = [
  {
    flag: '🇦🇪',
    country: 'UAE (Dubai)',
    regime: '0% personal; Small Business Relief 0% under AED 3M revenue (through 2026)',
    effective: '≈0–3%',
    presence: 'Actually live there',
    complexity: 'Low',
    theCatch: 'Cost of living can eat the saving; a visa without truly moving changes nothing',
    detail:
      'Freelance permit + residency from ~$2.3k for two years. 9% corporate only above AED 375k profit for sole traders, and Small Business Relief elects 0% under AED 3M revenue through end-2026. Israel–UAE tax treaty since 2021; the standard move for Israeli traders who really relocate.',
  },
  {
    flag: '🇬🇪',
    country: 'Georgia',
    regime: 'Individual Entrepreneur, Small Business Status: 1% of turnover up to 500k GEL',
    effective: '≈1–5%',
    presence: '183 days for residency',
    complexity: 'Low',
    theCatch: 'Some trading/financial activities are excluded from the 1% — get written confirmation that prop payouts qualify',
    detail:
      'Registration takes a day, foreign clients are fine, and Israelis get 365 days visa-free. Not EU; weigh banking and geopolitical risk. If the activity is ruled ineligible you fall to the standard 20%.',
  },
  {
    flag: '🇧🇬',
    country: 'Bulgaria',
    regime: '10% flat on all income, dividends 5%',
    effective: '≈12–15%',
    presence: '183 days / centre of life',
    complexity: 'Low',
    theCatch: 'No special regime to qualify for — and none to lose. Unglamorous',
    detail:
      'EU member, capped social contributions, low cost of living. Most 2026 comparisons rank it the cleanest EU answer for a freelancer profile.',
  },
  {
    flag: '🇨🇾',
    country: 'Cyprus',
    regime: '60-day residency + non-dom (17 yrs, 0% on dividends) via a Cyprus Ltd',
    effective: '≈15–20%',
    presence: '60 days + permanent home',
    complexity: 'Mid',
    theCatch: 'Corporate rate rises to 15% under the 2026 reform; company upkeep ~€2–4k/yr',
    detail:
      'The standard European answer: company earns the payouts at 15% CIT, you take dividends free of SDC as a non-dom (only ~2.65% GESY, capped). From 2026 the 60-day rule no longer requires proving non-residency elsewhere. English-speaking professionals, 4 hours from Israel.',
  },
  {
    flag: '🇬🇷',
    country: 'Greece',
    regime: 'Article 5C: 50% of self-employment income exempt for 7 years',
    effective: '≈15–20%',
    presence: 'Real residency',
    complexity: 'Mid',
    theCatch: 'Full social contributions still due; lose the regime if activity stops 12+ months',
    detail:
      'A freelancer physically working from Greece for foreign clients qualifies — the work counts as Greek-sourced, which is what the regime rewards. The €100k lump-sum non-dom needs €500k invested; not relevant.',
  },
  {
    flag: '🇮🇹',
    country: 'Italy',
    regime: 'Impatriati: 50% of income exempt for 5 years (cap €600k)',
    effective: '≈18–24%',
    presence: 'Real residency, commitment to stay',
    complexity: 'Mid',
    theCatch: 'Requires prior non-residency and staying — leaving early claws it back',
    detail: 'Decent, not a headline. Spain’s Beckham law is employment-only — wrong shape for a self-employed trader.',
  },
  {
    flag: '🇨🇷',
    country: 'Costa Rica',
    regime: 'Territorial: foreign income exempt; nomad framework confirms it explicitly',
    effective: '≈0% locally',
    presence: 'Visa terms (~$3k/mo income proof)',
    complexity: 'Low',
    theCatch: 'Only works once Israel has released you; far away; slow bureaucracy',
    detail:
      'Genuinely territorial, and the digital-nomad rules explicitly exempt foreign-earned income even past 183 days — cleaner than Thailand. NY-open trading hours land in the Costa Rican morning.',
  },
  {
    flag: '🇹🇭',
    country: 'Thailand',
    regime: 'Resident at 180 days; foreign income taxed when remitted (post-2024 rule)',
    effective: '0–35% on remittances',
    presence: '<180 days = visitor',
    complexity: 'Low',
    theCatch: 'Work physically done in Thailand is arguably Thai-source regardless of remittance — a real gray zone',
    detail:
      'The DTV nomad visa permits remote work but exempts nothing. The LTR visa’s statutory exemption needs an $80k income history with an established employer — prop traders rarely fit. Visit under 180 days and it is simply tax-free travel; but then you have not left Israel either.',
  },
  {
    flag: '🇦🇩',
    country: 'Andorra',
    regime: 'Personal income tax capped at 10%',
    effective: '≈10%',
    presence: '90–183 days + local company/deposit',
    complexity: 'Mid',
    theCatch: 'A tiny mountain country — lifestyle decision first, tax second',
    detail: 'Real, transparent, and small. Active residency runs through a local company plus a government deposit.',
  },
  {
    flag: '🇲🇹',
    country: 'Malta',
    regime: 'Non-dom remittance basis',
    effective: 'Wrong shape',
    presence: '—',
    complexity: 'High',
    theCatch: 'Work performed while sitting in Malta is Malta-source — a trader cannot call the payouts foreign income',
    detail: 'The famous structures need two companies and real substance. Skip unless a Maltese advisor shows a working trader-specific setup.',
  },
  {
    flag: '🇵🇹',
    country: 'Portugal',
    regime: 'NHR closed to new applicants; successor (IFICI) is tech/research only',
    effective: 'High',
    presence: '—',
    complexity: 'Mid',
    theCatch: 'The door closed in 2024–25; standard Portuguese rates are steep',
    detail: 'No longer a trader destination.',
  },
]

/** The one rule that gates everything else. */
export const RESIDENCY_REALITY =
  'None of these rates exist for you until Israel lets go. Israeli residency follows your centre of life, helped by day counts (183+ days presumes residency; a 2025 draft reform makes day counts near-conclusive). A foreign visa while your life stays in Israel changes nothing. The order is: pick the life you want, move it for real, then the destination’s regime applies. Below roughly $70–100k/yr of payouts, Israel’s low brackets and credit points usually mean relocation does not pay at all.'
