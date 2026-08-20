import { runJob } from '../_shared'
import { refreshUsdIls } from '@/server/fx'
import { materialiseSubscriptions } from '@/server/money'
import { regenerateInsights } from '@/server/insights'
import { rebuildAllAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * The daily housekeeping pass.
 *
 * Subscriptions are materialised first so the day's costs are present before
 * insights are generated — otherwise the tax and cost warnings are computed
 * against a stale expense total. The FX refresh rides along here too, so the
 * whole daily pass is one scheduled job: Vercel's Hobby plan allows a cron to
 * fire only once a day, and one job that does everything deploys on any plan.
 */
export async function GET(request: Request) {
  return runJob(request, 'cron_daily', async () => {
    const subscriptionCharges = await materialiseSubscriptions()
    const usdIls = await refreshUsdIls()
    const rebuilt = await rebuildAllAccounts()
    const insights = await regenerateInsights()

    return {
      subscriptionCharges,
      usdIls: usdIls ?? 'unchanged',
      accountsRebuilt: rebuilt.length,
      tradesRebuilt: rebuilt.reduce((sum, entry) => sum + entry.trades, 0),
      insightsGenerated: insights.generated,
      insightsResolved: insights.resolved,
    }
  })
}
