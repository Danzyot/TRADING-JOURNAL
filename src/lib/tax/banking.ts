/**
 * Getting paid, holding it, and spending it — the account structure and the
 * rails that feed it.
 *
 * Researched August 2026; workings and sources in docs/BANKING.md.
 *
 * The shape of the answer is four layers, because the failure modes are
 * different at each one. A payout arriving is an FX problem. Money you spend
 * is an availability problem — a frozen card on a Tuesday. Money you keep is a
 * protection problem, where a deposit guarantee is the only thing that
 * actually matters. Past the guarantee it stops being a banking question at
 * all. One account cannot be good at four jobs, and the usual mistake is
 * asking a neobank to do all of them.
 *
 * This assumes Cyprus residence — the relocation table above is what makes the
 * tax side work. Where the money *sits* never changes what is owed on it;
 * where you live does.
 */

export const BANKING_VERIFIED = 'August 2026'

// ---------------------------------------------------------------------------
// The four layers
// ---------------------------------------------------------------------------

export type AccountLayer = {
  layer: number
  name: string
  role: string
  holds: string
  /** Why this provider, rather than the obvious alternative. */
  why: string
  /** The failure this layer is designed around. */
  watchOut: string
}

export const ACCOUNT_LAYERS: AccountLayer[] = [
  {
    layer: 1,
    name: 'Wise',
    role: 'Inbound and FX',
    holds: 'Transit only — days, not months',
    why: 'Real USD account details, so a USD payout arrives as a domestic-style transfer instead of an international wire with correspondent banks skimming it. You convert at 0.33–0.57% when you choose, not at whatever rate applies the moment the money lands.',
    watchOut:
      'Not a bank, so no deposit guarantee. That is survivable precisely because nothing stays here: the exposure is one payout cycle, never a balance.',
  },
  {
    layer: 2,
    name: 'Revolut',
    role: 'Daily spending',
    holds: 'One to two months of living costs',
    why: 'The card, Apple Pay, ATM access, splitting bills, virtual cards for subscriptions. Spending EUR from a EUR balance never touches the €1,000/month conversion allowance — that limit only bites if you convert inside Revolut, which this setup never does.',
    watchOut:
      'Freezes happen. Capping the balance at a month or two is what turns a freeze from a catastrophe into an inconvenience.',
  },
  {
    layer: 3,
    name: 'bunq',
    role: 'Reserve',
    holds: 'Everything else, up to €100,000',
    why: 'A full Dutch banking licence and €100,000 of Deposit Guarantee Scheme cover, on the free plan. Money arrives from your own account and sits in savings — no payment traffic, nothing that triggers a compliance review.',
    watchOut:
      'Do not spend abroad on it: the free plan covers €1,000/year of foreign-currency card spend, then charges 3%. This is the boring account, and boring is the feature.',
  },
  {
    layer: 4,
    name: 'Broker (Interactive Brokers)',
    role: 'Above the guarantee',
    holds: 'Anything past €100,000',
    why: 'The guarantee caps at €100,000 per bank. A second bank works, but a broker with segregated client assets and cash in a EUR overnight-rate ETF earns roughly the ECB rate instead of whatever a neobank decides to pay.',
    watchOut: 'Only relevant once you are meaningfully into six figures. Until then it is a distraction.',
  },
]

// ---------------------------------------------------------------------------
// Rails
// ---------------------------------------------------------------------------

export type Rail = {
  name: string
  /** Flat fee in USD. */
  flat: number
  /** Proportional cost as a fraction of the payout. */
  percent: number
  speed: string
  verdict: string
  /** Ranked for display: lower is better. */
  rank: number
}

/**
 * The ways a payout can actually reach you, priced.
 *
 * The firm picks the processor; you pick the exit. That distinction is the
 * whole game — Rise lets you choose fiat or stablecoin every cycle, and the
 * choice is worth more than the difference between a 90% and an 85% split at
 * any size worth caring about.
 */
export const RAILS: Rail[] = [
  {
    name: 'Rise → USDC → exchange → EUR',
    flat: 2,
    percent: 0.002,
    speed: 'Minutes',
    verdict: 'Cheapest, and the gap widens with size — the only variable cost is a small exchange spread.',
    rank: 1,
  },
  {
    name: 'Rise → USD → Wise → EUR',
    flat: 20,
    percent: 0.005,
    speed: 'T+1 to T+4',
    verdict: 'The fallback when EUR-direct is not offered, and cheaper than EUR-direct above roughly $1,500 anyway.',
    rank: 2,
  },
  {
    name: 'Firm → Wise directly (USD)',
    flat: 0,
    percent: 0.005,
    speed: '1–3 days',
    verdict: 'Best case. No processor in the middle at all — worth asking every firm whether it is possible.',
    rank: 0,
  },
  {
    name: 'Rise → EUR bank',
    flat: 10,
    percent: 0.0115,
    speed: 'T+1',
    verdict: 'Convenient, and the FX margin makes it the most expensive Rise exit. Not offered for every country.',
    rank: 3,
  },
  {
    name: 'WorkMarket → PayPal',
    flat: 0,
    percent: 0.035,
    speed: '1–3 days',
    verdict: "Avoid. PayPal's conversion runs 3–4%, and WorkMarket's bank leg expects a US bank tied to a US tax identity.",
    rank: 4,
  },
]

/** What a payout of `amount` costs to collect on a given rail, in USD. */
export function railCost(amount: number, rail: Rail): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return rail.flat + amount * rail.percent
}

/** Every rail costed against the same payout, cheapest first. */
export function compareRails(amount: number): { rail: Rail; cost: number }[] {
  return RAILS.map((rail) => ({ rail, cost: railCost(amount, rail) })).sort((a, b) => a.cost - b.cost)
}

/** What the wrong rail costs over a year of payouts. */
export function annualRailPenalty(payoutTotal: number, payoutCount: number): number {
  if (payoutCount <= 0 || payoutTotal <= 0) return 0
  const perPayout = payoutTotal / payoutCount
  const ranked = compareRails(perPayout)
  return (ranked[ranked.length - 1].cost - ranked[0].cost) * payoutCount
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const FEE_RULES: { rule: string; why: string }[] = [
  {
    rule: 'Convert USD → EUR only at Wise',
    why: "Revolut's free allowance is €1,000 a month, then a 1% fair-usage fee. One payout blows through it.",
  },
  {
    rule: 'Never convert Friday evening to Sunday evening',
    why: '1% weekend markup on Revolut Standard. Waiting costs nothing.',
  },
  {
    rule: 'Always choose EUR at a terminal or ATM',
    why: 'Dynamic currency conversion skims 3–8%. The single biggest avoidable cost while travelling.',
  },
  {
    rule: 'Batch ATM withdrawals',
    why: 'Wise is free to €250/month then 1.75%; Revolut Standard free to €200. One large withdrawal beats four small ones.',
  },
  {
    rule: 'Stay on free plans',
    why: 'Nothing here needs a paid tier. Revolut Premium only pays for itself if you convert inside Revolut, which this setup never does.',
  },
  {
    rule: 'Withdraw from Rise, never park in it',
    why: 'Rise Earn is yield on USDC through Aave — smart-contract and depeg risk on money meant to be in transit for 48 hours.',
  },
]

export const SETUP_NOTES: { title: string; body: string }[] = [
  {
    title: 'Open everything before you move',
    body: 'Use your current address, then update it in-app once you are there. A brand-new account receiving a large first payout from an unfamiliar sender is the textbook freeze trigger — season each account with small, ordinary transactions first.',
  },
  {
    title: 'The Polish passport is the KYC key',
    body: 'An EEA identity document is accepted everywhere without the residence-permit friction non-EU citizens hit. Onboarding is minutes rather than weeks.',
  },
  {
    title: 'Skip the Cypriot bank for a short stay',
    body: 'It needs you physically present with a Yellow Slip and takes four to eight weeks. Not worth it for a few months.',
  },
  {
    title: 'Do not change your address of record every move',
    body: 'Changing registered country re-triggers KYC at every provider at once — which is how people end up locked out of everything simultaneously while sitting in an Airbnb somewhere.',
  },
  {
    title: 'Keep the evidence folder ready',
    body: 'Payout confirmations, account statements and ID scans, reachable from your phone. Revolut asking for source of funds is a when, not an if, and answering within the hour is the difference between a two-day hold and a three-week one. The Documents page in this app is that folder.',
  },
  {
    title: 'Every crypto leg is a disposal',
    body: 'USDC → EUR is a near-zero gain, but it is still a transaction that needs recording. Log date, firm, gross, rail, fees and net — the same record that answers a compliance request.',
  },
]

export const RESIDENCY_NOTE = [
  'Where a payout lands does not change what is owed on it. Residence does — which is what the relocation table above is for, and why this structure assumes the move has actually happened rather than being a way to avoid it.',
  'Nor is a foreign fintech account invisible. Since 1 January 2026 the CRS 2.0 definition of a reportable account explicitly covers e-money and digital wallets, so Wise and Revolut balances are exchanged with your country of tax residence exactly like a bank account. Both ask you to self-certify that residence; certifying a country you do not live in is a false declaration rather than a loophole.',
]
