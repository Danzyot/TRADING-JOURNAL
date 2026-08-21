import { runJob } from '../_shared'
import { refreshUsdIls } from '@/server/fx'
import { materialiseSubscriptions } from '@/server/money'
import { regenerateInsights } from '@/server/insights'
import { rebuildAllAccounts } from '@/server/trades'
import { runEmailIngest } from '@/server/email-ingest'
import { gmailConfigured } from '@/server/gmail'

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

    // The inbox is read here as well as on its own schedule so that the email
    // automation still works on a host that allows only one cron a day.
    const email = gmailConfigured() ? await runEmailIngest({ days: 2 }) : null

    return {
      emailApplied: email?.applied ?? 'not configured',
      // Surfaced rather than thrown: the rest of the daily pass succeeded, and
      // the hourly email job is where a mailbox failure should go red.
      emailErrors: email?.errors.join('; ').slice(0, 200) || 0,
      subscriptionCharges,
      usdIls: usdIls ?? 'unchanged',
      accountsRebuilt: rebuilt.length,
      tradesRebuilt: rebuilt.reduce((sum, entry) => sum + entry.trades, 0),
      insightsGenerated: insights.generated,
      insightsResolved: insights.resolved,
    }
  })
}
