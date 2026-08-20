/**
 * Futures contract specifications.
 *
 * Everything monetary in this app derives from `pointValue`: the dollar value of
 * a 1.00 move in the price *as the broker quotes it*. That single parameter is
 * enough for equities, energies, metals, FX and grains alike, and it sidesteps
 * the usual mess of "contract size x cents-per-bushel" conversions — for corn,
 * quoted at 432.25 cents, 5,000 bushels means one cent is worth $50, so
 * pointValue is 50 and a quarter-cent tick is $12.50.
 *
 *   tickValue === pointValue * tickSize
 */

export type ContractSpec = {
  root: string
  name: string
  exchange: string
  /** Dollar value of a 1.00 move in the quoted price, per contract. */
  pointValue: number
  tickSize: number
  currency: string
  /** Micro contracts get grouped with their full-size sibling in reports. */
  family: string
  micro: boolean
  category: 'equity_index' | 'energy' | 'metal' | 'rate' | 'fx' | 'ag' | 'crypto' | 'other'
}

const SPEC_LIST: ContractSpec[] = [
  // --- Equity index -------------------------------------------------------
  s('ES', 'E-mini S&P 500', 50, 0.25, 'equity_index', 'SP500'),
  s('MES', 'Micro E-mini S&P 500', 5, 0.25, 'equity_index', 'SP500', true),
  s('NQ', 'E-mini Nasdaq-100', 20, 0.25, 'equity_index', 'NASDAQ'),
  s('MNQ', 'Micro E-mini Nasdaq-100', 2, 0.25, 'equity_index', 'NASDAQ', true),
  s('YM', 'E-mini Dow', 5, 1, 'equity_index', 'DOW'),
  s('MYM', 'Micro E-mini Dow', 0.5, 1, 'equity_index', 'DOW', true),
  s('RTY', 'E-mini Russell 2000', 50, 0.1, 'equity_index', 'RUSSELL'),
  s('M2K', 'Micro E-mini Russell 2000', 5, 0.1, 'equity_index', 'RUSSELL', true),
  s('NKD', 'Nikkei 225 (USD)', 5, 5, 'equity_index', 'NIKKEI'),
  s('EMD', 'E-mini S&P MidCap 400', 100, 0.1, 'equity_index', 'MIDCAP'),

  // --- Energy -------------------------------------------------------------
  s('CL', 'Crude Oil (WTI)', 1000, 0.01, 'energy', 'CRUDE'),
  s('MCL', 'Micro WTI Crude Oil', 100, 0.01, 'energy', 'CRUDE', true),
  s('NG', 'Henry Hub Natural Gas', 10000, 0.001, 'energy', 'NATGAS'),
  s('MNG', 'Micro Henry Hub Natural Gas', 1000, 0.001, 'energy', 'NATGAS', true),
  s('RB', 'RBOB Gasoline', 42000, 0.0001, 'energy', 'GASOLINE'),
  s('HO', 'NY Harbor ULSD', 42000, 0.0001, 'energy', 'HEATOIL'),
  s('BZ', 'Brent Crude (Last Day)', 1000, 0.01, 'energy', 'BRENT'),

  // --- Metals -------------------------------------------------------------
  s('GC', 'Gold', 100, 0.1, 'metal', 'GOLD'),
  s('MGC', 'Micro Gold', 10, 0.1, 'metal', 'GOLD', true),
  s('SI', 'Silver', 5000, 0.005, 'metal', 'SILVER'),
  s('SIL', 'Micro Silver', 1000, 0.005, 'metal', 'SILVER', true),
  s('HG', 'Copper', 25000, 0.0005, 'metal', 'COPPER'),
  s('MHG', 'Micro Copper', 2500, 0.0005, 'metal', 'COPPER', true),
  s('PL', 'Platinum', 50, 0.1, 'metal', 'PLATINUM'),
  s('PA', 'Palladium', 100, 0.1, 'metal', 'PALLADIUM'),

  // --- Interest rates -----------------------------------------------------
  // Quoted in points; a 32nd is 0.03125 and a 64th 0.015625.
  s('ZB', '30-Year U.S. Treasury Bond', 1000, 1 / 32, 'rate', 'BONDS'),
  s('UB', 'Ultra U.S. Treasury Bond', 1000, 1 / 32, 'rate', 'BONDS'),
  s('ZN', '10-Year U.S. Treasury Note', 1000, 1 / 64, 'rate', 'NOTES'),
  s('TN', 'Ultra 10-Year Note', 1000, 1 / 64, 'rate', 'NOTES'),
  s('ZF', '5-Year U.S. Treasury Note', 1000, 1 / 128, 'rate', 'NOTES'),
  s('ZT', '2-Year U.S. Treasury Note', 2000, 1 / 256, 'rate', 'NOTES'),
  s('ZQ', '30-Day Fed Funds', 4167, 0.0025, 'rate', 'SHORTRATE'),
  s('SR3', '3-Month SOFR', 2500, 0.0025, 'rate', 'SHORTRATE'),

  // --- FX -----------------------------------------------------------------
  s('6E', 'Euro FX', 125000, 0.00005, 'fx', 'EUR'),
  s('M6E', 'Micro Euro FX', 12500, 0.0001, 'fx', 'EUR', true),
  s('6B', 'British Pound', 62500, 0.0001, 'fx', 'GBP'),
  s('M6B', 'Micro British Pound', 6250, 0.0001, 'fx', 'GBP', true),
  s('6J', 'Japanese Yen', 12500000, 0.0000005, 'fx', 'JPY'),
  s('6A', 'Australian Dollar', 100000, 0.0001, 'fx', 'AUD'),
  s('M6A', 'Micro Australian Dollar', 10000, 0.0001, 'fx', 'AUD', true),
  s('6C', 'Canadian Dollar', 100000, 0.00005, 'fx', 'CAD'),
  s('6S', 'Swiss Franc', 125000, 0.0001, 'fx', 'CHF'),
  s('6N', 'New Zealand Dollar', 100000, 0.0001, 'fx', 'NZD'),
  s('6M', 'Mexican Peso', 500000, 0.00001, 'fx', 'MXN'),
  s('DX', 'U.S. Dollar Index', 1000, 0.005, 'fx', 'DXY'),

  // --- Agriculture --------------------------------------------------------
  // Quoted in cents; pointValue is dollars per 1 cent of move.
  s('ZC', 'Corn', 50, 0.25, 'ag', 'CORN'),
  s('ZS', 'Soybeans', 50, 0.25, 'ag', 'SOYBEANS'),
  s('ZW', 'Chicago Wheat', 50, 0.25, 'ag', 'WHEAT'),
  s('KE', 'KC Hard Red Winter Wheat', 50, 0.25, 'ag', 'WHEAT'),
  s('ZM', 'Soybean Meal', 100, 0.1, 'ag', 'SOYMEAL'),
  s('ZL', 'Soybean Oil', 600, 0.01, 'ag', 'SOYOIL'),
  s('ZO', 'Oats', 50, 0.25, 'ag', 'OATS'),
  s('LE', 'Live Cattle', 400, 0.025, 'ag', 'CATTLE'),
  s('HE', 'Lean Hogs', 400, 0.025, 'ag', 'HOGS'),
  s('GF', 'Feeder Cattle', 500, 0.025, 'ag', 'CATTLE'),

  // --- Crypto -------------------------------------------------------------
  s('BTC', 'Bitcoin', 5, 5, 'crypto', 'BITCOIN'),
  s('MBT', 'Micro Bitcoin', 0.1, 5, 'crypto', 'BITCOIN', true),
  s('ETH', 'Ether', 50, 0.5, 'crypto', 'ETHER'),
  s('MET', 'Micro Ether', 0.1, 0.5, 'crypto', 'ETHER', true),
]

function s(
  root: string,
  name: string,
  pointValue: number,
  tickSize: number,
  category: ContractSpec['category'],
  family: string,
  micro = false,
  exchange = 'CME',
): ContractSpec {
  return { root, name, pointValue, tickSize, category, family, micro, exchange, currency: 'USD' }
}

const SPECS = new Map(SPEC_LIST.map((spec) => [spec.root, spec]))

export const ALL_SPECS = SPEC_LIST

const MONTH_CODES = 'FGHJKMNQUVXZ'

/**
 * Reduces any broker's contract string to its root symbol.
 *
 *   MNQZ5        -> MNQ   (Tradovate / Rithmic)
 *   MNQZ25       -> MNQ
 *   "MNQ 12-25"  -> MNQ   (NinjaTrader)
 *   /MNQ:XCME    -> MNQ
 *   MNQ1!        -> MNQ   (TradingView continuous)
 *   ESM2026      -> ES
 *
 * Anything unrecognised is returned upper-cased and unchanged, so a new product
 * still journals correctly — it just needs a spec added before P&L can be
 * derived from price rather than taken from the broker.
 */
export function rootSymbol(contract: string): string {
  let value = (contract ?? '').trim().toUpperCase()
  if (!value) return ''

  value = value.replace(/^\//, '') // /MNQ
  value = value.split(':')[0] // MNQ:XCME
  value = value.replace(/[!]+$/, '') // MNQ1!
  value = value.replace(/\s+\d{1,2}-\d{2,4}$/, '') // "MNQ 12-25"
  value = value.replace(/\s+/g, '')

  // Longest-prefix match wins so MES is never mistaken for ES.
  const direct = [...SPECS.keys()]
    .filter((root) => value.startsWith(root))
    .sort((a, b) => b.length - a.length)[0]
  if (direct) {
    const rest = value.slice(direct.length)
    // Bare root, a continuous-contract digit, or a month+year suffix.
    if (rest === '' || /^\d{0,2}$/.test(rest) || /^[A-Z]\d{1,4}$/.test(rest)) return direct
  }

  // Unknown product: strip a trailing month-code + year if one is present.
  const expiry = value.match(/^([A-Z0-9]{1,5}?)([FGHJKMNQUVXZ])(\d{1,4})$/)
  if (expiry && MONTH_CODES.includes(expiry[2])) return expiry[1]

  return value
}

export function specFor(contractOrRoot: string): ContractSpec | undefined {
  return SPECS.get(rootSymbol(contractOrRoot))
}

/** Dollar value of a 1.00 price move. Falls back to 1 for unknown products. */
export function pointValue(contractOrRoot: string): number {
  return specFor(contractOrRoot)?.pointValue ?? 1
}

export function tickSize(contractOrRoot: string): number {
  return specFor(contractOrRoot)?.tickSize ?? 0.01
}

export function tickValue(contractOrRoot: string): number {
  const spec = specFor(contractOrRoot)
  return spec ? spec.pointValue * spec.tickSize : 0.01
}

/** Signed P&L in account currency for a price move over `qty` contracts. */
export function pnlFromPrices(
  contractOrRoot: string,
  direction: 'long' | 'short',
  entry: number,
  exit: number,
  qty: number,
): number {
  const move = direction === 'long' ? exit - entry : entry - exit
  return move * qty * pointValue(contractOrRoot)
}

/** Price distance converted to ticks — the unit stops are actually set in. */
export function priceToTicks(contractOrRoot: string, distance: number): number {
  const size = tickSize(contractOrRoot)
  return size > 0 ? distance / size : 0
}

export function displayName(contractOrRoot: string): string {
  return specFor(contractOrRoot)?.name ?? rootSymbol(contractOrRoot)
}
