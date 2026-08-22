import 'server-only'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index'
import { shouldSeedDemo } from '../lib/demo'

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
/** A second key, so seeding never contends with migrating. */
const SEED_LOCK_KEY = 8_140_233_907_115_443

let started: Promise<BootstrapResult> | null = null

export type BootstrapResult = {
  ok: boolean
  migrated: boolean
  message: string
}

/**
 * Memoised: runs at most once per process — but only a *successful* run is
 * remembered. A database that was unreachable on the first request must not
 * pin its failure for the process's whole life, or a single Neon cold-start
 * blip would silently stop future migrations from ever applying.
 */
export function bootstrapDatabase(): Promise<BootstrapResult> {
  started ??= run()
    .then(async (result) => {
      if (result.ok) await seedDemoIfEmpty()
      return result
    })
    .then((result) => {
      if (!result.ok) started = null
      return result
    })
  return started
}

/**
 * Fills a demo deployment's own database on first boot.
 *
 * A demo is worth nothing empty — every chart is a placeholder and there is no
 * feature left to look at. This runs only when `DEMO_MODE=1`, only against
 * whatever database that deployment was given, and only while it holds no
 * accounts, so it can never touch or overwrite real data: the deployment that
 * has the owner's data is a different deployment, with this switched off.
 */
async function seedDemoIfEmpty(): Promise<void> {
  if (!shouldSeedDemo(process.env)) return

  let locked = false
  try {
    const existing = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from accounts`,
    )
    if (Number(existing[0]?.count ?? 0) > 0) return

    // Several cold starts can race on a first deploy; whoever loses simply
    // leaves it to the winner rather than seeding a second copy.
    const rows = await db.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_lock(${SEED_LOCK_KEY}) as locked`,
    )
    locked = Boolean(rows[0]?.locked)
    if (!locked) return

    const again = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from accounts`,
    )
    if (Number(again[0]?.count ?? 0) > 0) return

    // Imported here rather than at module scope: the seeder pulls in the trade
    // matcher and the firm presets, and a deployment that is not a demo should
    // not carry any of it.
    const { seedDatabase } = await import('./seed')
    await seedDatabase({ demo: true })
  } catch {
    // A demo that fails to seed is an empty demo, not a broken app. The next
    // cold start tries again.
  } finally {
    if (locked) {
      await db.execute(sql`select pg_advisory_unlock(${SEED_LOCK_KEY})`).catch(() => {})
    }
  }
}

async function run(): Promise<BootstrapResult> {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      migrated: false,
      message: 'DATABASE_URL is not set — skipping database bootstrap.',
    }
  }

  const folder = join(process.cwd(), 'drizzle')
  if (!existsSync(folder)) {
    return {
      ok: false,
      migrated: false,
      message: `No migrations folder at ${folder}. Run "npm run db:generate" and redeploy.`,
    }
  }

  // Fast path, taken on every cold start after the first: when the journal
  // already records every local migration there is nothing to do, so skip the
  // advisory lock entirely. This keeps the per-cold-start cost at one indexed
  // read instead of four round trips — which matters when the database is a
  // network hop away.
  const expected = localMigrationCount(folder)
  if (expected > 0 && (await appliedCount()) >= expected) {
    return { ok: true, migrated: false, message: 'Database already up to date.' }
  }

  let locked = false
  try {
    // pg_try_advisory_lock rather than pg_advisory_lock: through a
    // transaction-pooling proxy (Neon's -pooler endpoint) session locks are not
    // reliable, and the blocking variant has no timeout — a leaked lock would
    // hang every page load forever. Try, poll the fast path while someone else
    // migrates, and after the wait window proceed anyway: the migrator's worst
    // case in a race is an "already exists" error, which is handled below as a
    // healthy database.
    for (let attempt = 0; attempt < 20 && !locked; attempt++) {
      const rows = await db.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_lock(${LOCK_KEY}) as locked`,
      )
      locked = Boolean(rows[0]?.locked)
      if (!locked) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (expected > 0 && (await appliedCount()) >= expected) {
          return { ok: true, migrated: false, message: 'Database already up to date.' }
        }
      }
    }

    const before = await appliedCount()
    await migrate(db, { migrationsFolder: folder })
    const after = await appliedCount()
    const migrated = after > before

    return {
      ok: true,
      migrated,
      message: migrated
        ? `Database ready — applied ${after - before} migration(s).`
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
        message: 'Schema already present (created outside the migration history). Continuing.',
      }
    }

    return { ok: false, migrated: false, message: `Database bootstrap failed: ${message}` }
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

function localMigrationCount(folder: string): number {
  try {
    return readdirSync(folder).filter((file) => file.endsWith('.sql')).length
  } catch {
    return 0
  }
}

// Note on what this deliberately does NOT do any more: it used to seed a list
// of well-known prop firms on first run. Pre-creating rows the user never asked
// for is presumptuous, and worse, "seed while empty" meant deleting every firm
// brought all of them back on the next cold start. Firm presets now live only
// in the add-firm form, as optional templates the user chooses to apply.
