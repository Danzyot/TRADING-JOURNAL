import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { accounts } from '@/db/schema'
import { authorizeMachineRequest } from '@/lib/auth'
import { importCsvFile } from '@/server/import'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Machine CSV import — the endpoint the local trade watcher posts to.
 *
 * Same bearer token as the cron routes, same import pipeline as the Import
 * page, so an upload here is exactly as idempotent as a manual one: re-sending
 * a file costs nothing. The account may be named by id, label or broker id,
 * because the watcher maps folders to accounts by name, not database id.
 */
export async function POST(request: Request) {
  if (!authorizeMachineRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Send multipart form data with a "file" field.' },
      { status: 400 },
    )
  }

  let accountId = Number(form.get('accountId'))
  if (!Number.isFinite(accountId) || accountId <= 0) {
    const name = String(form.get('account') ?? '').trim()
    if (!name) {
      return NextResponse.json(
        { ok: false, error: 'Name the account: pass "accountId" or "account" (label or broker id).' },
        { status: 400 },
      )
    }
    const [match] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        sql`lower(${accounts.label}) = lower(${name}) or lower(coalesce(${accounts.externalId}, '')) = lower(${name})`,
      )
      .limit(1)
    if (!match) {
      return NextResponse.json(
        { ok: false, error: `No account matches "${name}" by label or broker id.` },
        { status: 404 },
      )
    }
    accountId = match.id
  }

  form.set('accountId', String(accountId))
  const report = await importCsvFile(form)
  return NextResponse.json({ accountId, ...report })
}
