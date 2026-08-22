/**
 * Getting paid — the rails prop firms actually use, and what each account
 * type costs to receive USD into.
 *
 * Researched August 2026; sources and workings in docs/BANKING.md. Rules and
 * fee schedules here are published-terms summaries, not advice, and fintech
 * pricing moves faster than tax law — the verification date is carried into
 * the UI so a stale number is visible rather than assumed.
 *
 * On what this module deliberately does not do: it does not model receiving
 * payouts abroad as a way of not declaring them. An Israeli tax resident is
 * taxed on worldwide income wherever it lands (see RESIDENCY_NOTE), and since
 * 1 January 2026 CRS 2.0 covers e-money and digital wallets, so a Wise or
 * Revolut balance is reported exactly like a bank account. The savings here
 * are real but they are FX and fee savings, which is a different thing.
 */

export const BANKING_VERIFIED = 'August 2026'

// ---------------------------------------------------------------------------
// Rails
// ---------------------------------------------------------------------------

export type PayoutRail = {
  firm: string
  processor: string
  methods: string
  speed: string
  note: string
}

/**
 * How each firm pays, which decides what an account has to be able to receive.
 *
 * The practical split: firms on Rise can pay stablecoin in minutes, firms on
 * Deel or Plane move fiat in days, and a USD account with real local details
 * (ACH routing + account number) is what turns an expensive international wire
 * into a cheap domestic transfer at the sender's end.
 */
export const PAYOUT_RAILS: PayoutRail[] = [
  {
    firm: 'Apex Trader Funding',
    processor: 'Deel',
    methods: 'Bank transfer, some regions crypto',
    speed: '5–10 business days',
    note: 'Bi-weekly payout windows. Slowest of the firms you trade, and the wire lands in USD.',
  },
  {
    firm: 'Topstep',
    processor: 'Direct',
    methods: 'ACH, Wise, wire',
    speed: '1–3 business days',
    note: 'Pays Wise directly, which makes a Wise USD balance the cheapest destination of the lot.',
  },
  {
    firm: 'Lucid Trading',
    processor: 'Rise',
    methods: 'USDC/USDT, bank transfer',
    speed: 'Minutes on crypto, 2–5 days on bank',
    note: 'Daily-payout plans only pay quickly if the rail is quick — crypto is the reason those exist.',
  },
  {
    firm: 'MyFundedFutures',
    processor: 'Rise + direct crypto',
    methods: 'USDC/USDT, bank transfer',
    speed: 'Minutes to 3 days',
    note: 'Offers crypto without going through Rise.',
  },
  {
    firm: 'Take Profit Trader',
    processor: 'Rise',
    methods: 'USDC/USDT, bank transfer',
    speed: 'Same day to 3 days',
    note: 'Advertises near-instant withdrawals; that is the crypto rail, not the bank one.',
  },
  {
    firm: 'FundedNext',
    processor: 'Rise',
    methods: 'Crypto, bank transfer',
    speed: '1–3 business days',
    note: 'Futures arm follows the same Rise rails as the FX side.',
  },
  {
    firm: 'Alpha Futures',
    processor: 'Rise',
    methods: 'Crypto, bank transfer',
    speed: '1–5 business days',
    note: '',
  },
]

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type ReceivingAccount = {
  name: string
  /** What it costs to turn a received USD payout into spendable shekels. */
  fxCostPercent: number
  /** Does it give real local USD details a US sender can pay domestically? */
  usdDetails: boolean
  strength: string
  weakness: string
  verdict: string
}

/**
 * The cost of receiving is two things stacked: whatever the sender's rail
 * charges, and the spread applied when USD becomes ILS. The second one is
 * where the money actually goes — an Israeli bank's retail conversion spread
 * is roughly four times a specialist's, on every payout, forever.
 */
export const RECEIVING_ACCOUNTS: ReceivingAccount[] = [
  {
    name: 'Wise',
    fxCostPercent: 0.5,
    usdDetails: true,
    strength:
      'Real local details in USD (ACH routing + account number), EUR, GBP and ~10 more, so a US firm pays domestically instead of wiring internationally. Mid-market rate plus a stated fee from ~0.41%. Topstep pays Wise directly.',
    weakness:
      'Not a bank — no credit, and balances are held at partner institutions rather than deposit-insured in the usual sense. Card is fine but plainer than Revolut’s.',
    verdict: 'Best for receiving. This is the one that matters for payouts.',
  },
  {
    name: 'Revolut',
    fxCostPercent: 0.6,
    usdDetails: false,
    strength:
      'Strong card, app and spending controls, free FX up to a monthly plan cap, good for day-to-day and travel. Full EU bank licence (Lithuania) so balances are deposit-guaranteed.',
    weakness:
      'Local account details are mainly GBP and EUR — a USD payout usually arrives as an international transfer rather than a domestic one. Weekend FX markups, and fair-usage caps beyond the plan allowance.',
    verdict: 'Better card, weaker at collecting USD. Fine as the spending half of a pair.',
  },
  {
    name: 'Israeli bank (USD account)',
    fxCostPercent: 2,
    usdDetails: false,
    strength:
      'Local, familiar, and the account an Israeli accountant expects to reconcile against. Incoming USD can sit in a USD sub-account without forced conversion.',
    weakness:
      'Conversion spreads of roughly 1.5–2.5%, plus per-wire receiving fees of ~$10–25. On a year of payouts that is the largest single fee you pay to anyone.',
    verdict: 'Keep it for the accountant and for shekel life, not for converting payouts.',
  },
  {
    name: 'Stablecoin (USDC/USDT)',
    fxCostPercent: 1,
    usdDetails: false,
    strength:
      'Minutes rather than days, no banking hours, and the only rail some firms make genuinely fast. Rise, MyFundedFutures and Bulenox all support it.',
    weakness:
      'Off-ramping to shekels costs an exchange spread plus withdrawal fees, and every conversion is a separate record to keep. Israeli banks question crypto-sourced deposits and can demand a full paper trail.',
    verdict: 'Use for speed when a firm is slow on fiat; keep the paperwork.',
  },
]

/**
 * What it costs to receive `amount` USD through an account with a given
 * all-in FX cost, in USD.
 *
 * Deliberately simple: one percentage applied to the converted amount. The
 * fee schedules differ in shape (Wise charges a stated fee, a bank buries a
 * spread in the rate) but they land in the same place for someone converting
 * whole payouts, and a comparison you can check beats a model you cannot.
 */
export function conversionCost(amount: number, fxCostPercent: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return amount * (fxCostPercent / 100)
}

/** What switching from one account to another saves on the same volume. */
export function annualSaving(amount: number, fromPercent: number, toPercent: number): number {
  return Math.max(0, conversionCost(amount, fromPercent) - conversionCost(amount, toPercent))
}

// ---------------------------------------------------------------------------
// The part that is not optional
// ---------------------------------------------------------------------------

export const RESIDENCY_NOTE = [
  'Where a payout lands does not change what is owed on it. Israel taxes residents on worldwide income, and residence is decided by centre of life — family, home, economic and social ties — with a presumption of residence at 30 days in a year and 425 days across three years. A second passport does not change any of that while you live here; only actually moving does, which is what the relocation table above is for.',
  'Nor is a foreign fintech account invisible. Since 1 January 2026 the CRS 2.0 definition of a reportable account explicitly covers e-money and digital wallets, so Wise and Revolut balances are exchanged with your country of tax residence exactly like a bank account. Both providers ask you to self-certify that residence, and certifying a country you do not live in is a false declaration rather than a loophole.',
  'What is genuinely worth optimising: the FX spread on every payout, the rail each firm pays on, the timing of a payout across a tax year, the deductions you are entitled to, and — if the numbers justify it — where you actually live.',
]
