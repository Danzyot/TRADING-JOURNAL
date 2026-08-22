/**
 * Crypto rails: the assets, the networks, and how to check a transaction.
 *
 * Prop firms increasingly settle in stablecoins, and evaluation fees are often
 * paid the same way — so a payout or an expense can land as USDC on Arbitrum
 * rather than USD in a bank. Recording those as "USD, somehow" loses the two
 * things that make them auditable later: which chain it moved on, and the hash
 * that proves it.
 *
 * That matters twice over. A compliance request wants the trail; a tax return
 * wants each leg, because a stablecoin conversion is still a disposal even
 * when the gain rounds to nothing.
 *
 * Pure — no network calls. Prices are recorded as what actually settled rather
 * than fetched, so every figure stays checkable against the block explorer.
 */

export type CryptoAsset = {
  code: string
  label: string
  /** A stablecoin's fiat value is ~1:1, which the forms use as a default. */
  stable: boolean
}

export const CRYPTO_ASSETS: CryptoAsset[] = [
  { code: 'USDC', label: 'USD Coin', stable: true },
  { code: 'USDT', label: 'Tether', stable: true },
  { code: 'BTC', label: 'Bitcoin', stable: false },
  { code: 'ETH', label: 'Ethereum', stable: false },
  { code: 'SOL', label: 'Solana', stable: false },
]

export function isCryptoCurrency(code: string | null | undefined): boolean {
  if (!code) return false
  return CRYPTO_ASSETS.some((asset) => asset.code === code.toUpperCase())
}

export function isStablecoin(code: string | null | undefined): boolean {
  if (!code) return false
  return CRYPTO_ASSETS.some((asset) => asset.code === code.toUpperCase() && asset.stable)
}

export type Network = {
  id: string
  label: string
  /** Where a hash can be checked. `%s` is the transaction id. */
  explorerTx: string
  explorerAddress: string
  /** Rough shape of an address on this chain, for catching a paste error. */
  addressPattern: RegExp
}

export const NETWORKS: Network[] = [
  {
    id: 'arbitrum',
    label: 'Arbitrum',
    explorerTx: 'https://arbiscan.io/tx/%s',
    explorerAddress: 'https://arbiscan.io/address/%s',
    addressPattern: /^0x[a-fA-F0-9]{40}$/,
  },
  {
    id: 'ethereum',
    label: 'Ethereum',
    explorerTx: 'https://etherscan.io/tx/%s',
    explorerAddress: 'https://etherscan.io/address/%s',
    addressPattern: /^0x[a-fA-F0-9]{40}$/,
  },
  {
    id: 'polygon',
    label: 'Polygon',
    explorerTx: 'https://polygonscan.com/tx/%s',
    explorerAddress: 'https://polygonscan.com/address/%s',
    addressPattern: /^0x[a-fA-F0-9]{40}$/,
  },
  {
    id: 'optimism',
    label: 'Optimism',
    explorerTx: 'https://optimistic.etherscan.io/tx/%s',
    explorerAddress: 'https://optimistic.etherscan.io/address/%s',
    addressPattern: /^0x[a-fA-F0-9]{40}$/,
  },
  {
    id: 'base',
    label: 'Base',
    explorerTx: 'https://basescan.org/tx/%s',
    explorerAddress: 'https://basescan.org/address/%s',
    addressPattern: /^0x[a-fA-F0-9]{40}$/,
  },
  {
    id: 'tron',
    label: 'Tron',
    explorerTx: 'https://tronscan.org/#/transaction/%s',
    explorerAddress: 'https://tronscan.org/#/address/%s',
    addressPattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  },
  {
    id: 'solana',
    label: 'Solana',
    explorerTx: 'https://solscan.io/tx/%s',
    explorerAddress: 'https://solscan.io/account/%s',
    addressPattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  },
  {
    id: 'bitcoin',
    label: 'Bitcoin',
    explorerTx: 'https://blockchair.com/bitcoin/transaction/%s',
    explorerAddress: 'https://blockchair.com/bitcoin/address/%s',
    addressPattern: /^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  },
]

export function networkFor(id: string | null | undefined): Network | undefined {
  return id ? NETWORKS.find((network) => network.id === id) : undefined
}

/** A link to the transaction, or null when there is nothing to link to. */
export function explorerTxUrl(networkId: string | null | undefined, hash: string | null | undefined): string | null {
  const network = networkFor(networkId)
  if (!network || !hash?.trim()) return null
  return network.explorerTx.replace('%s', encodeURIComponent(hash.trim()))
}

export function explorerAddressUrl(
  networkId: string | null | undefined,
  address: string | null | undefined,
): string | null {
  const network = networkFor(networkId)
  if (!network || !address?.trim()) return null
  return network.explorerAddress.replace('%s', encodeURIComponent(address.trim()))
}

/**
 * Whether an address looks right for its chain.
 *
 * Deliberately a shape check, not a checksum: the job is catching a truncated
 * paste or an address entered against the wrong network, which is the mistake
 * that actually happens. A wrong-but-well-formed address cannot be caught here
 * by any amount of cleverness.
 */
export function addressLooksValid(networkId: string | null | undefined, address: string): boolean {
  const network = networkFor(networkId)
  if (!network) return false
  return network.addressPattern.test(address.trim())
}

/** Shortens an address or hash for display: 0x1234…abcd. */
export function shorten(value: string | null | undefined, lead = 6, tail = 4): string {
  const text = (value ?? '').trim()
  if (text.length <= lead + tail + 1) return text
  return `${text.slice(0, lead)}…${text.slice(-tail)}`
}

/**
 * The fiat value of a crypto amount.
 *
 * `rate` is what one unit was worth when it settled — recorded, never fetched,
 * because a price looked up months later is not the price you received, and a
 * figure nobody can check is worse than no figure at all.
 */
export function fiatValue(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) return 0
  return amount * rate
}
