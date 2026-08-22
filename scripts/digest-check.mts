/**
 * Exercises the check-in digest against a real database.
 *
 * The interesting cases are the silent ones: a notification that fires on a
 * quiet Tuesday is the fastest way to train someone to ignore notifications.
 */
import { buildDigest } from '../src/lib/analytics/digest'
import { runDigest, weekSummary } from '../src/server/digest'

console.log('--- morning (should never summarise) ---')
console.log(await runDigest('morning'))

console.log('\n--- evening (real data) ---')
console.log(await runDigest('evening'))

// The Friday query itself, over a window wide enough to catch the seeded data.
console.log('\n--- weekSummary over the last 60 days (exercises the SQL) ---')
const to = new Date().toISOString().slice(0, 10)
const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
console.log(await weekSummary(from, to))

console.log('\n--- shapes, against the same builder the job uses ---')
const cases = [
  {
    name: 'quiet Tuesday evening',
    input: { slot: 'evening' as const, isFriday: false, currency: 'USD', today: null, week: null },
  },
  {
    name: 'traded Tuesday evening',
    input: {
      slot: 'evening' as const,
      isFriday: false,
      currency: 'USD',
      today: { pnl: 430, wins: 3, losses: 2, trades: 5 },
      week: null,
    },
  },
  {
    name: 'Friday wrap',
    input: {
      slot: 'evening' as const,
      isFriday: true,
      currency: 'USD',
      today: { pnl: -120, wins: 1, losses: 2, trades: 3 },
      week: {
        evalPnl: 300,
        fundedPnl: 940,
        wins: 12,
        losses: 8,
        passed: 2,
        failed: 1,
        payoutCount: 2,
        payoutTotal: 3000,
        expenses: 450,
      },
    },
  },
]

for (const testCase of cases) {
  const digest = buildDigest(testCase.input)
  console.log(`\n[${testCase.name}]`)
  if (!digest) console.log('  (silent)')
  else console.log(`  ${digest.title}\n` + digest.body.split('\n').map((l) => `  ${l}`).join('\n'))
}

process.exit(0)
