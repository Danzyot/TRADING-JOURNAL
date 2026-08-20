import { NextResponse } from 'next/server'
import { authorizeMachineRequest } from '@/lib/auth'
import { log } from '@/server/sync'

/**
 * Shared wrapper for scheduled jobs.
 *
 * Every job is authorised by the same bearer token, logs its outcome to
 * `sync_log`, and never throws out of the handler — a cron endpoint that
 * returns 500 gets retried and can double-write, so failures are reported as a
 * 200 with `ok: false` and a message the Settings page can display.
 */
export async function runJob(
  request: Request,
  job: string,
  work: () => Promise<Record<string, unknown>>,
): Promise<NextResponse> {
  if (!authorizeMachineRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  try {
    const detail = await work()
    const durationMs = Date.now() - startedAt
    await log(job, 'ok', summarise(detail), detail, durationMs)
    return NextResponse.json({ ok: true, job, durationMs, ...detail })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure'
    await log(job, 'error', message, null, Date.now() - startedAt).catch(() => {})
    return NextResponse.json({ ok: false, job, error: message })
  }
}

function summarise(detail: Record<string, unknown>): string {
  const parts = Object.entries(detail)
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
    .map(([key, value]) => `${key}=${value}`)
  return parts.length > 0 ? parts.join(' ') : 'completed'
}
