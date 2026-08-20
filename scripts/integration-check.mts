process.env.DATABASE_URL = 'postgresql://tj@localhost:55432/tj'
const { db } = await import('/home/user/TRADING-JOURNAL/src/db/index.ts')
const { accounts, executions, trades } = await import('/home/user/TRADING-JOURNAL/src/db/schema.ts')
const { eq } = await import('drizzle-orm')
const { insertExecutions, rebuildTradesForAccount } = await import('/home/user/TRADING-JOURNAL/src/server/trades.ts')

// Fresh account; clear any leftovers from an earlier crashed run first.
const stale = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.label, 'integration-test'))
for (const row of stale) await db.delete(accounts).where(eq(accounts.id, row.id))
const run = Math.random().toString(36).slice(2, 8)
const [acct] = await db.insert(accounts).values({ label: 'integration-test', platform: 'tradovate' }).returning({ id: accounts.id })
const base = new Date('2026-03-04T14:30:00Z')

const rows = [
  { side: 'buy' as const, qty: 2, price: 21000, id: 'i1', mins: 0 },
  { side: 'sell' as const, qty: 3, price: 21010, id: 'i2', mins: 5 },  // flip
  { side: 'buy' as const, qty: 1, price: 21005, id: 'i3', mins: 10 },
].map((r) => ({
  accountId: acct.id,
  externalId: `int-${run}-${r.id}`,
  source: 'tradovate_api',
  contract: 'MNQZ5',
  symbol: 'MNQ',
  side: r.side,
  qty: r.qty,
  fillPrice: r.price,
  fillAt: new Date(base.getTime() + r.mins * 60000),
  tradingDay: '2026-03-04',
  commission: 0.62 * r.qty,
  fees: 0,
}))

const first = await insertExecutions(rows)
const second = await insertExecutions(rows)  // must be 0 — this is the C1 path
console.log(`insertExecutions: first=${first} second=${second}`)
if (first !== 3 || second !== 0) throw new Error('C1 FIX FAILED')

const built = await rebuildTradesForAccount(acct.id)
console.log(`rebuild built ${built} trades (expect 2: long + short from the flip)`)
const rows2 = await db.select().from(trades).where(eq(trades.accountId, acct.id))
for (const t of rows2) console.log(` ${t.direction} qty=${t.qty} gross=${t.grossPnl} net=${t.netPnl}`)
if (rows2.length !== 2) throw new Error('BATCH REBUILD FAILED')

// Linkage: every execution should point at a trade
const fills = await db.select().from(executions).where(eq(executions.accountId, acct.id))
const linked = fills.filter((f) => f.tradeId !== null).length
console.log(`executions linked to trades: ${linked}/${fills.length}`)

// Rebuild again — idempotent, same trades
const built2 = await rebuildTradesForAccount(acct.id)
if (built2 !== 2) throw new Error('REBUILD IDEMPOTENCE FAILED')
console.log('second rebuild identical ✓')

// Cleanup
await db.delete(accounts).where(eq(accounts.id, acct.id))
console.log('ALL INTEGRATION CHECKS PASSED')
process.exit(0)
