/**
 * Each firm's own logo.
 *
 * A wall of firm cards is scanned, not read: recognising Apex by its mark
 * before the name has been processed is most of what makes the page navigable.
 * Two shapes per firm, because they are not interchangeable — the square mark
 * goes in the card's avatar slot, the wordmark across the top of the firm's own
 * page where there is width for it.
 *
 * Matched on the firm's *name* rather than on a catalogue slug, so a firm added
 * by hand ("apex trader funding", "Apex") or an account row that predates the
 * catalogue still gets its logo. Anything unknown falls back to the two-letter
 * monogram the cards drew before these existed.
 */

export type FirmArt = {
  /** Square, for an avatar tile. */
  mark?: string
  /** Wide, for a page header. */
  wordmark?: string
}

/** Keyed by the firm's name with everything but letters and digits removed. */
const ART: Record<string, FirmArt> = {
  lucidtrading: { mark: '/firms/lucid-mark.jpeg', wordmark: '/firms/lucid-wordmark.jpeg' },
  myfundedfutures: {
    mark: '/firms/myfundedfutures-mark.webp',
    wordmark: '/firms/myfundedfutures-wordmark.png',
  },
  apextraderfunding: { mark: '/firms/apex-mark.png', wordmark: '/firms/apex-wordmark.jpeg' },
  takeprofittrader: {
    mark: '/firms/take-profit-trader-mark.jpeg',
    wordmark: '/firms/take-profit-trader-wordmark.jpeg',
  },
  fundednext: { mark: '/firms/fundednext-mark.png', wordmark: '/firms/fundednext-wordmark.png' },
  alphafutures: {
    mark: '/firms/alpha-futures-mark.png',
    wordmark: '/firms/alpha-futures-wordmark.png',
  },
  tradeify: { mark: '/firms/tradeify-mark.png', wordmark: '/firms/tradeify-wordmark.jpeg' },
  topstep: { mark: '/firms/topstep-mark.png', wordmark: '/firms/topstep-wordmark.png' },
}

/**
 * The shorter names people actually use, and the longer ones the firms use.
 *
 * "MFFU" is what the trader types; "FundedNext Futures" is what the firm calls
 * its futures arm. Both are the same logo.
 */
const ALIASES: Record<string, string> = {
  lucid: 'lucidtrading',
  mffu: 'myfundedfutures',
  myfundedfuturesllc: 'myfundedfutures',
  apex: 'apextraderfunding',
  apextrader: 'apextraderfunding',
  tpt: 'takeprofittrader',
  takeprofit: 'takeprofittrader',
  fundednextfutures: 'fundednext',
  alpha: 'alphafutures',
  alphacapitalfutures: 'alphafutures',
  topsteptrader: 'topstep',
  // The platform's name, and what the firm row usually ends up called.
  topstepx: 'topstep',
}

export function firmArtKey(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ALIASES[key] ?? key
}

export function firmArt(name: string | null | undefined): FirmArt {
  if (!name) return {}
  return ART[firmArtKey(name)] ?? {}
}
