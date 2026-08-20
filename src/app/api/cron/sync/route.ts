import { runJob } from '../_shared'
import { syncAllConnections } from '@/server/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Pulls fills and balances from every enabled broker connection. */
export async function GET(request: Request) {
  return runJob(request, 'cron_sync', async () => {
    const outcomes = await syncAllConnections()
    return {
      connections: outcomes.length,
      fillsImported: outcomes.reduce((sum, outcome) => sum + outcome.fillsImported, 0),
      tradesRebuilt: outcomes.reduce((sum, outcome) => sum + outcome.tradesRebuilt, 0),
      failures: outcomes.filter((outcome) => outcome.status === 'error').length,
    }
  })
}
