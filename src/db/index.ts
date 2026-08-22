import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { demoMode } from '@/lib/demo'

declare global {
  // eslint-disable-next-line no-var
  var __tradingJournalSql: ReturnType<typeof postgres> | undefined
  // eslint-disable-next-line no-var
  var __tradingJournalPglite: import('@electric-sql/pglite').PGlite | undefined
}

/** Where the demo's in-process Postgres keeps its files. */
const DEMO_DATA_DIR = `${process.env.TMPDIR ?? '/tmp'}/trading-journal-demo`

type Database = ReturnType<typeof drizzle<typeof schema>>

let instance: Database | undefined

function connect(): Database {
  const url = process.env.DATABASE_URL
  if (!url) {
    // A demo deployment is allowed to have no database at all: it runs one
    // inside itself. This is what makes the demo a single environment variable
    // rather than a second database to create, and it also means the process
    // shown to strangers holds no credentials that could reach anything.
    if (demoMode()) return connectInMemory()

    throw new Error(
      'DATABASE_URL is not set. Add it in your host\'s environment variables (Vercel: Project → Settings → Environment Variables), or copy .env.example to .env.local for local development.',
    )
  }

  // Serverless functions get a fresh module instance per cold start but can be
  // reused across invocations; one pooled client per process is the right shape.
  // `max: 1` keeps us inside Neon/Supabase pooler connection budgets.
  const client =
    globalThis.__tradingJournalSql ??
    postgres(url, {
      max: process.env.VERCEL ? 1 : 10,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
    })

  if (process.env.NODE_ENV !== 'production') globalThis.__tradingJournalSql = client

  return drizzle(client, { schema })
}

/**
 * Postgres itself, compiled to WebAssembly and running in this process.
 *
 * PGlite is a real Postgres 18 — the same numeric, jsonb and partial-index
 * behaviour the app depends on — so the migrations and the seeder run against
 * it unchanged. Nothing else would do: a stubbed query layer would have to
 * imitate every query in `src/server`, and would drift out of agreement with
 * the real one silently.
 *
 * It is stored under the platform's temporary directory, which on a serverless
 * host means one copy per warm instance: the first request an instance serves
 * migrates and seeds it, and the rest reuse it. Instances do not share it, and
 * it does not survive them — which is exactly right for a demo whose data is
 * generated deterministically and which refuses every write anyway.
 *
 * `require` rather than `import`: this function is called from a synchronous
 * proxy, and the package ships a CommonJS build for precisely this case.
 */
function connectInMemory(): Database {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require('@electric-sql/pglite') as typeof import('@electric-sql/pglite')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzlePglite } = require('drizzle-orm/pglite') as typeof import('drizzle-orm/pglite')

  const client = globalThis.__tradingJournalPglite ?? new PGlite(DEMO_DATA_DIR)
  globalThis.__tradingJournalPglite = client

  // The two drivers expose the same query builder; only their connection
  // plumbing differs, which is all this cast is asserting.
  return drizzlePglite(client, { schema }) as unknown as Database
}

/**
 * Connects on first use rather than at import.
 *
 * `next build` imports every route module to collect page data. Connecting at
 * module scope meant a build with no DATABASE_URL failed with a stack trace
 * pointing at a webpack chunk — which is exactly what happens when someone
 * deploys before filling in their environment variables, and a confusing way to
 * start. Deferring the connection lets the build succeed and moves the error to
 * the first request that genuinely needs a database, where the message is
 * actionable.
 */
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    instance ??= connect()
    return Reflect.get(instance, property, receiver)
  },
})

export { schema }
