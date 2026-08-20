import 'server-only'
import { updateSettings } from './settings'

/**
 * Refreshes the USD/ILS rate the tax estimate converts with.
 *
 * A stale rate quietly skews every shekel figure on the tax page, and the
 * difference between 3.4 and 3.9 across a year of payouts is thousands. The
 * source is deliberately a free, key-less endpoint so this keeps working
 * without a subscription to maintain.
 *
 * Returns null rather than throwing when the provider is unreachable — the
 * stored rate simply stays as it is, which is far better than zeroing it.
 */
export async function refreshUsdIls(): Promise<number | null> {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=ILS', {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null

    const json = (await response.json()) as { rates?: Record<string, number> }
    const rate = json.rates?.ILS
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null

    await updateSettings({ usdIls: rate, fxUpdatedAt: new Date() })
    return rate
  } catch {
    return null
  }
}
