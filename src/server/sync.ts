import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, brokerConnections, executions, syncLog, type NewExecution } from '@/db/schema'
import { decryptJson, encryptJson } from '@/lib/crypto'
import {
  TradovateClient,
  TradovateError,
  tradovateCredentialsSchema,
  type TradovateCredentials,
  type TradovateEnvironment,
} from '@/lib/integrations/tradovate'
import { tradingDayFor } from '@/lib/time'
import { getSettings } from './settings'
import { insertExecutions, rebuildTradesForAccount } from './trades'

export type SyncOutcome = {
  connectionId: number
  label: string
  status: 'ok' | 'error' | 'skipped'
  accountsSeen: number
  fillsSeen: number
  fillsImported: number
  tradesRebuilt: number
  message: string
}

/**
 * Pulls fills and balances from one Tradovate connection.
 *
 * The sync is safe to run as often as you like: fills carry Tradovate's own id,
 * the executions table is uniquely indexed on (source, externalId), and trades
 * are rebuilt from scratch afterwards. Re-running never duplicates anything.
 *
 * Accounts are matched by Tradovate's account name against `externalId`. An
 * unrecognised account is created automatically rather than silently dropping
 * its fills — an unjournalled account is worse than an unconfigured one.
 */
export async function syncTradovateConnection(connectionId: number): Promise<SyncOutcome> {
  const startedAt = Date.now()
  const [connection] = await db
    .select()
    .from(brokerConnections)
    .where(eq(brokerConnections.id, connectionId))
    .limit(1)

  const base = {
    connectionId,
    label: connection?.label ?? `#${connectionId}`,
    accountsSeen: 0,
    fillsSeen: 0,
    fillsImported: 0,
    tradesRebuilt: 0,
  }

  if (!connection) {
    return { ...base, status: 'error', message: 'Connection not found.' }
  }
  if (!connection.enabled) {
    return { ...base, status: 'skipped', message: 'Connection is disabled.' }
  }
  if (!connection.credentialsEncrypted) {
    return { ...base, status: 'error', message: 'No credentials stored for this connection.' }
  }

  try {
    const credentials = tradovateCredentialsSchema.parse(
      decryptJson<TradovateCredentials>(connection.credentialsEncrypted),
    )
    const settings = await getSettings()
    const client = new TradovateClient(connection.environment as TradovateEnvironment)

    // Reuse the stored token — Tradovate penalises repeated password logins.
    if (connection.accessToken && connection.accessTokenExpiresAt) {
      client.restoreSession({
        accessToken: connection.accessToken,
        expiresAt: connection.accessTokenExpiresAt,
        userId: 0,
      })
    }

    const session = await client.authenticate(credentials)
    await db
      .update(brokerConnections)
      .set({ accessToken: session.accessToken, accessTokenExpiresAt: session.expiresAt })
      .where(eq(brokerConnections.id, connectionId))

    const remoteAccounts = await client.listAccounts()
    base.accountsSeen = remoteAccounts.length

    const accountIdByRemote = new Map<number, number>()
    for (const remote of remoteAccounts) {
      accountIdByRemote.set(remote.id, await resolveAccount(remote.id, remote.name))
    }

    // Keep balances current so the drawdown line on each account is real.
    for (const remote of remoteAccounts) {
      const equity = await client.cashBalanceSnapshot(remote.id)
      const localId = accountIdByRemote.get(remote.id)
      if (equity !== null && localId) {
        await db
          .update(accounts)
          .set({ currentBalance: equity, balanceUpdatedAt: new Date() })
          .where(eq(accounts.id, localId))
      }
    }

    const fills = await client.listFills()
    base.fillsSeen = fills.length

    const commissionByAccount = new Map<number, number>()
    for (const localId of accountIdByRemote.values()) {
      const [row] = await db
        .select({ rate: accounts.commissionPerContract })
        .from(accounts)
        .where(eq(accounts.id, localId))
        .limit(1)
      commissionByAccount.set(localId, row?.rate ?? 0)
    }

    const rows: NewExecution[] = []
    for (const fill of fills) {
      // Fills do not name their account, so they are attributed via the order's
      // account. Where that is unavailable, a single-account connection is
      // unambiguous; anything else is skipped rather than mis-attributed.
      const localId =
        accountIdByRemote.size === 1
          ? [...accountIdByRemote.values()][0]
          : accountIdByRemote.get((fill as { accountId?: number }).accountId ?? -1)
      if (!localId) continue

      const contract = await client.contractName(fill.contractId)
      const fillAt = new Date(fill.timestamp)
      const rate = commissionByAccount.get(localId) ?? 0

      rows.push({
        accountId: localId,
        externalId: String(fill.id),
        source: 'tradovate_api',
        contract,
        symbol: contract,
        side: fill.action === 'Buy' ? 'buy' : 'sell',
        qty: fill.qty,
        fillPrice: fill.price,
        fillAt,
        tradingDay: tradingDayFor(fillAt, settings.timezone, settings.dayBoundary),
        // Tradovate fills carry no commission; charge half the round turn per side.
        commission: (rate * fill.qty) / 2,
        fees: 0,
        raw: fill,
      })
    }

    base.fillsImported = await insertExecutions(rows)

    for (const localId of accountIdByRemote.values()) {
      base.tradesRebuilt += await rebuildTradesForAccount(localId)
    }

    await db
      .update(brokerConnections)
      .set({ lastSyncedAt: new Date(), lastSyncStatus: 'ok', lastSyncError: null })
      .where(eq(brokerConnections.id, connectionId))

    const outcome: SyncOutcome = {
      ...base,
      status: 'ok',
      message: `Imported ${base.fillsImported} new fills across ${base.accountsSeen} accounts.`,
    }
    await log('tradovate_sync', 'ok', outcome.message, outcome, Date.now() - startedAt)
    return outcome
  } catch (error) {
    const message =
      error instanceof TradovateError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown sync failure.'

    await db
      .update(brokerConnections)
      .set({ lastSyncedAt: new Date(), lastSyncStatus: 'error', lastSyncError: message })
      .where(eq(brokerConnections.id, connectionId))

    await log('tradovate_sync', 'error', message, { connectionId }, Date.now() - startedAt)
    return { ...base, status: 'error', message }
  }
}

/** Finds the local account for a broker account, creating it if new. */
async function resolveAccount(remoteId: number, remoteName: string): Promise<number> {
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.platform, 'tradovate'), eq(accounts.externalId, remoteName)))
    .limit(1)
  if (existing) return existing.id

  const [byId] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.platform, 'tradovate'), eq(accounts.externalId, String(remoteId))))
    .limit(1)
  if (byId) return byId.id

  const [created] = await db
    .insert(accounts)
    .values({
      label: remoteName,
      externalId: remoteName,
      platform: 'tradovate',
      phase: 'eval',
      status: 'active',
      notes: 'Created automatically by Tradovate sync. Set the size, drawdown and commission rate.',
    })
    .returning({ id: accounts.id })

  return created.id
}

export async function syncAllConnections(): Promise<SyncOutcome[]> {
  const connections = await db
    .select({ id: brokerConnections.id })
    .from(brokerConnections)
    .where(and(eq(brokerConnections.enabled, true), eq(brokerConnections.provider, 'tradovate')))

  const out: SyncOutcome[] = []
  for (const connection of connections) {
    out.push(await syncTradovateConnection(connection.id))
  }
  return out
}

export async function saveTradovateCredentials(
  connectionId: number,
  credentials: TradovateCredentials,
): Promise<void> {
  const parsed = tradovateCredentialsSchema.parse(credentials)
  await db
    .update(brokerConnections)
    .set({
      credentialsEncrypted: encryptJson(parsed),
      // A credential change invalidates any cached token.
      accessToken: null,
      accessTokenExpiresAt: null,
      lastSyncError: null,
    })
    .where(eq(brokerConnections.id, connectionId))
}

export async function log(
  job: string,
  status: 'ok' | 'error' | 'skipped',
  message: string,
  detail?: unknown,
  durationMs?: number,
): Promise<void> {
  await db.insert(syncLog).values({ job, status, message, detail: detail ?? null, durationMs })
}

/** Deletes an account's fills and derived trades. Used before a clean re-import. */
export async function clearAccountData(accountId: number): Promise<void> {
  await db.delete(executions).where(eq(executions.accountId, accountId))
  await rebuildTradesForAccount(accountId)
}
