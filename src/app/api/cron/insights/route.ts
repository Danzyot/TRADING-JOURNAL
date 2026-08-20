import { runJob } from '../_shared'
import { regenerateInsights } from '@/server/insights'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  return runJob(request, 'cron_insights', async () => regenerateInsights())
}
