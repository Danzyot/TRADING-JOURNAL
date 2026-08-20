import 'server-only'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index'
import { propFirms } from './schema'
import { FIRM_PRESETS } from '../lib/propfirm/rules'

/**
 * Brings an empty database up to date on its own.
 *
 * The alternative is telling someone to install Node, clone the repo, set
 * DATABASE_URL locally and run a migration command before their deployment
 * works — four steps that exist only because the schema lives in files rather
 * than in the database. Running migrations on first use removes all four.
 *
 * `getSettings()` calls this, and every page and scheduled job goes through
 * `getSettings()`, so the first request after a deploy creates the schema.
 *
 * Three things make this safe to call on every request:
 *
 *  1. A Postgres advisory lock. Serverless platforms boot many instances at
 *     once, and two concurrent migrations against one database corrupt it.
 *     The lock serialises them; whoever loses waits and then finds nothing to do.
 *  2. Drizzle's journal table. Once a migration is recorded it is never re-run,
 *     so after the first boot this costs one indexed read.
 *  3. It never throws. A database that is unreachable at boot must not take the
 *     whole app down — the request that needs it will fail with its own clear
 *     error, and the next boot retries.
 */

// An arbitrary but fixed key, within the safe integer range so it survives the
// trip through JSON. Any other process using the same key would serialise
// against us, which is why it is namespaced to this app.
const LOCK_KEY = 8_140_233_907_115_442

let started: Promise<BootstrapResult> | null = null

export type BootstrapResult = {
  ok: boolean
  migrated: boolean
  seededFirms: number
  message: string
}

/** Memoised: runs at most once per process, however many callers there are. */
export function bootstrapDatabase(): Promise<BootstrapResult> {
  started ??= run()
  return started
}

async function run(): Promise<BootstrapResult> {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      migrated: false,
      seededFirms: 0,
      message: 'DATABASE_URL is not set — skipping database bootstrap.',
    }
  }

  const folder = join(process.cwd(), 'drizzle')
  if (!existsSync(folder)) {
    return {
      ok: false,
      migrated: false,
      seededFirms: 0,
      message: `No migrations folder at ${folder}. Run "npm run db:generate" and redeploy.`,
    }
  }

  let locked = false
  try {
    await db.execute(sql`select pg_advisory_lock(${LOCK_KEY})`)
    locked = true

    const before = await appliedCount()
    await migrate(db, { migrationsFolder: folder })
    const after = await appliedCount()

    const seededFirms = await seedFirmPresets()
    const migrated = after > before

    return {
      ok: true,
      migrated,
      seededFirms,
      message: migrated
        ? `Database ready — applied ${after - before} migration(s)${seededFirms > 0 ? `, added ${seededFirms} prop firm presets` : ''}.`
        : 'Database already up to date.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // A schema created by `drizzle-kit push` has the tables but no journal, so
    // the migrator tries to create them again. That is a healthy database, not
    // a failure — say so rather than alarming anyone.
    if (/already exists/i.test(message)) {
      return {
        ok: true,
        migrated: false,
        seededFirms: 0,
        message: 'Schema already present (created outside the migration history). Continuing.',
      }
    }

    return { ok: false, migrated: false, seededFirms: 0, message: `Database bootstrap failed: ${message}` }
  } finally {
    if (locked) {
      await db.execute(sql`select pg_advisory_unlock(${LOCK_KEY})`).catch(() => {})
    }
  }
}

async function appliedCount(): Promise<number> {
  try {
    const rows = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    )
    return Number(rows[0]?.count ?? 0)
  } catch {
    // The table does not exist yet on a first run.
    return 0
  }
}

/**
 * Puts the common prop firms in the database so the account form has something
 * to pick from on day one. Idempotent: only inserts when the table is empty, so
 * a firm the user has deleted does not reappear on the next deploy.
 */
async function seedFirmPresets(): Promise<number> {
  const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(propFirms)
  if ((existing?.count ?? 0) > 0) return 0

  const inserted = await db
    .insert(propFirms)
    .values(
      FIRM_PRESETS.map((preset) => ({
        name: preset.name,
        platform: preset.platform,
        profitSplit: preset.profitSplit,
        payoutPolicy: preset.note,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: propFirms.id })

  return inserted.length
}
