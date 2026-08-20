import { runJob } from '../_shared'
import { refreshUsdIls } from '@/server/fx'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return runJob(request, 'cron_fx', async () => {
    const usdIls = await refreshUsdIls()
    if (usdIls === null) throw new Error('FX provider returned no usable USD/ILS rate')
    return { usdIls }
  })
}
