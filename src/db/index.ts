import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __tradingJournalSql: ReturnType<typeof postgres> | undefined
}

type Database = ReturnType<typeof drizzle<typeof schema>>

let instance: Database | undefined

function connect(): Database {
  const url = process.env.DATABASE_URL
  if (!url) {
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
