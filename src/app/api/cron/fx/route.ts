import { runJob } from '../_shared'
import { updateSettings } from '@/server/settings'

export const dynamic = 'force-dynamic'

/**
 * Refreshes the USD/ILS rate the tax estimate converts with.
 *
 * A stale rate quietly skews every shekel figure on the tax page, and the
 * difference between 3.4 and 3.9 on a year of payouts is thousands. The source
 * is deliberately a free, key-less endpoint so this keeps working without a
 * subscription to maintain; if it is unreachable the stored rate simply stays
 * as it is rather than being zeroed.
 */
export async function GET(request: Request) {
  return runJob(request, 'cron_fx', async () => {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=ILS', {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) throw new Error(`FX provider returned ${response.status}`)

    const json = (await response.json()) as { rates?: Record<string, number> }
    const rate = json.rates?.ILS

    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new Error('FX provider returned no usable USD/ILS rate')
    }

    await updateSettings({ usdIls: rate, fxUpdatedAt: new Date() })
    return { usdIls: rate }
  })
}
