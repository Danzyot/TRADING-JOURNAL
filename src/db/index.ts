import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __tradingJournalSql: ReturnType<typeof postgres> | undefined
}

function connect() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Postgres instance.',
    )
  }
  // Serverless functions get a fresh module instance per cold start but can be
  // reused across invocations; one pooled client per process is the right shape.
  // `max: 1` keeps us inside Neon/Supabase pooler connection budgets.
  return postgres(url, {
    max: process.env.VERCEL ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  })
}

const client = globalThis.__tradingJournalSql ?? connect()
if (process.env.NODE_ENV !== 'production') globalThis.__tradingJournalSql = client

export const db = drizzle(client, { schema })
export const sqlClient = client
export { schema }
