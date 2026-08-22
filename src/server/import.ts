'use server'

/**
 * CSV import.
 *
 * The flow is deliberately one round trip: pick an account, hand over the file,
 * get back a full report of what happened. A multi-step preview wizard sounds
 * safer but is not — the import is idempotent (fills carry the broker's own id,
 * and the executions table is uniquely indexed on it), so re-running a file
 * costs nothing and there is no state to lose between steps.
 */

import { revalidatePath } from 'next/cache'
import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, importBatches, trades, type NewExecution } from '@/db/schema'
import { parseCsv, SOURCE_LABELS, type ImportSource } from '@/lib/integrations/importers'
import { rMultiple } from '@/lib/analytics/matching'
import { getSettings } from './settings'
import { insertExecutions, rebuildTradesForAccount, rollupDailyStats } from './trades'

export type ImportReport = {
  ok: boolean
  message: string
  source: string
  shape: 'executions' | 'trades'
  rowsSeen: number
  rowsImported: number
  rowsSkipped: number
  tradesBuilt: number
  duplicates: number
  errors: string[]
  unmappedHeaders: string[]
}

export async function importCsvFile(formData: FormData): Promise<ImportReport> {
  const empty: ImportReport = {
    ok: false,
    message: '',
    source: '',
    shape: 'executions',
    rowsSeen: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    tradesBuilt: 0,
    duplicates: 0,
    errors: [],
    unmappedHeaders: [],
  }

  try {
    const accountId = Number(formData.get('accountId'))
    if (!Number.isFinite(accountId)) {
      return { ...empty, message: 'Choose the account these trades belong to.' }
    }

    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1)
    if (!account) return { ...empty, message: 'That account no longer exists.' }

    const file = formData.get('file')
    const pasted = String(formData.get('pasted') ?? '').trim()

    let content = pasted
    let filename: string | null = null

    if (file instanceof File && file.size > 0) {
      content = await file.text()
      filename = file.name
    }

    if (!content) {
      return { ...empty, message: 'Upload a CSV file or paste its contents.' }
    }

    const settings = await getSettings()
    const forced = String(formData.get('source') ?? '')
    const sourceTimezone = String(formData.get('sourceTimezone') ?? '').trim() || undefined

    const parsed = parseCsv(content, {
      timezone: settings.timezone,
      dayBoundary: settings.dayBoundary,
      sourceTimezone,
      commissionPerContract: account.commissionPerContract,
      source: forced ? (forced as ImportSource) : undefined,
    })

    const [batch] = await db
      .insert(importBatches)
      .values({
        source: parsed.source,
        filename,
        accountId,
        rowsSeen: parsed.rowsSeen,
        errors: parsed.errors,
      })
      .returning({ id: importBatches.id })

    let imported = 0
    let built = 0

    if (parsed.shape === 'executions') {
      const rows: NewExecution[] = parsed.executions.map((execution) => ({
        accountId,
        externalId: execution.externalId,
        source: parsed.source,
        batchId: batch.id,
        contract: execution.contract,
        symbol: execution.symbol,
        side: execution.side,
        qty: execution.qty,
        fillPrice: execution.fillPrice,
        fillAt: execution.fillAt,
        tradingDay: execution.tradingDay,
        commission: execution.commission,
        fees: execution.fees,
        raw: execution.raw,
      }))

      imported = await insertExecutions(rows)
      // Trades are always rebuilt from the full fill history, never appended to,
      // so a backfill of older fills reorders correctly rather than producing
      // an orphaned round trip.
      built = await rebuildTradesForAccount(accountId)
    } else {
      // Round-trip exports are already complete trades. They are inserted as
      // manual records so a later rebuild from fills cannot wipe them.
      //
      // Idempotence: the trades table has no broker id, so re-uploads are
      // filtered on the natural key — entry instant, symbol, direction,
      // quantity and entry price identify the same trade however many times
      // the file arrives. One indexed query covers the whole file's window.
      const entryTimes = parsed.trades.length > 0 ? parsed.trades.map((t) => t.entryAt.getTime()) : [0]
      const windowStart = new Date(Math.min(...entryTimes))
      const windowEnd = new Date(Math.max(...entryTimes))
      const existing = await db
        .select({
          entryAt: trades.entryAt,
          symbol: trades.symbol,
          direction: trades.direction,
          qty: trades.qty,
          avgEntry: trades.avgEntry,
        })
        .from(trades)
        .where(
          and(
            eq(trades.accountId, accountId),
            gte(trades.entryAt, windowStart),
            lte(trades.entryAt, windowEnd),
          ),
        )
      const seen = new Set(
        existing.map(
          (t) => `${t.entryAt.getTime()}|${t.symbol}|${t.direction}|${t.qty}|${t.avgEntry}`,
        ),
      )

      for (const trade of parsed.trades) {
        const key = `${trade.entryAt.getTime()}|${trade.symbol}|${trade.direction}|${trade.qty}|${trade.avgEntry}`
        if (seen.has(key)) continue
        seen.add(key)
        await db.insert(trades).values({
          accountId,
          symbol: trade.symbol,
          contract: trade.contract,
          direction: trade.direction,
          qty: trade.qty,
          entryAt: trade.entryAt,
          exitAt: trade.exitAt,
          tradingDay: trade.tradingDay,
          avgEntry: trade.avgEntry,
          avgExit: trade.avgExit,
          grossPnl: trade.grossPnl,
          commission: trade.commission,
          fees: trade.fees,
          netPnl: trade.netPnl,
          maeBase: trade.maeBase,
          mfeBase: trade.mfeBase,
          rMultiple: rMultiple(trade.netPnl, null),
          durationSeconds:
            trade.exitAt !== null
              ? Math.max(0, Math.round((trade.exitAt.getTime() - trade.entryAt.getTime()) / 1000))
              : null,
          status: trade.exitAt ? 'closed' : 'open',
          autoGenerated: false,
        })
        imported += 1
      }
      built = imported
      await rollupDailyStats(accountId)
    }

    const duplicates = Math.max(
      0,
      (parsed.shape === 'executions' ? parsed.executions.length : parsed.trades.length) - imported,
    )

    await db
      .update(importBatches)
      .set({ rowsImported: imported, rowsSkipped: parsed.rowsSkipped, tradesBuilt: built })
      .where(eq(importBatches.id, batch.id))

    for (const path of ['/', '/trades', '/accounts', '/import']) revalidatePath(path)

    const parts = [`Read ${parsed.rowsSeen} rows as ${SOURCE_LABELS[parsed.source]}.`]
    if (imported > 0) parts.push(`Imported ${imported}.`)
    if (duplicates > 0) parts.push(`${duplicates} were already stored and were skipped.`)
    if (parsed.rowsSkipped > 0) parts.push(`${parsed.rowsSkipped} could not be read.`)
    if (parsed.shape === 'executions') parts.push(`${built} trades now built from this account's fills.`)

    return {
      ok: imported > 0 || duplicates > 0,
      message: parts.join(' '),
      source: SOURCE_LABELS[parsed.source],
      shape: parsed.shape,
      rowsSeen: parsed.rowsSeen,
      rowsImported: imported,
      rowsSkipped: parsed.rowsSkipped,
      tradesBuilt: built,
      duplicates,
      errors: parsed.errors,
      unmappedHeaders: parsed.unmappedHeaders,
    }
  } catch (error) {
    return {
      ...empty,
      message: error instanceof Error ? error.message : 'The import failed.',
    }
  }
}
