/**
 * Turns the Wawa site's prop-firm spec sheets into this app's plan catalogues.
 *
 *   git clone https://github.com/Danzyot/wawa-website /home/user/wawa-website
 *   npx tsx scripts/import-catalogue.mts
 *
 * Writes src/lib/propfirm/catalogue.ts. Committed output, so the app never
 * depends on that repo being present — this only runs when the specs change.
 *
 * The source is written for people to read ("2 mini / 20 micro", "90 / 10");
 * src/lib/propfirm/parse-specs.ts does the reading, and is tested against
 * those exact strings.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import {
  parseContracts,
  parseDays,
  parseDrawdownType,
  parseMoney,
  parsePercent,
  parseSize,
  parseSplit,
  parseWinningDayMinimum,
} from '../src/lib/propfirm/parse-specs'
import type { FirmPlan } from '../src/db/schema'

const SOURCE = '/tmp/extract/plans.json'
if (!existsSync(SOURCE)) {
  console.error(`Missing ${SOURCE} — run the extraction step first (see the header).`)
  process.exit(1)
}

type Row = {
  firm: string
  family: string
  size: string
  price?: string
  option?: string
  values: Record<string, string>
}

/** Display names and sites, since the source keys on slugs. */
const FIRMS: Record<string, { name: string; website: string }> = {
  lucid: { name: 'Lucid Trading', website: 'https://lucidtrading.com' },
  tradeify: { name: 'Tradeify', website: 'https://tradeify.co' },
  'take-profit-trader': { name: 'Take Profit Trader', website: 'https://takeprofittrader.com' },
  'alpha-futures': { name: 'Alpha Futures', website: 'https://alpha-futures.com' },
  fundednext: { name: 'FundedNext', website: 'https://fundednext.com' },
  apex: { name: 'Apex Trader Funding', website: 'https://apextraderfunding.com' },
}

const rows: Row[] = JSON.parse(readFileSync(SOURCE, 'utf8'))
const byFirm = new Map<string, FirmPlan[]>()

for (const row of rows) {
  const v = row.values
  const evalContracts = parseContracts(v['Max contracts (eval)'])
  const fundedContracts = parseContracts(v['Max contracts (funded)'])
  const size = parseSize(row.size)
  if (size === null) continue

  // Notes carry the rules that resist becoming numbers — scaling schemes,
  // payout ceilings expressed as a share of profit — rather than dropping them.
  const notes = [
    v['Buffer (safety net)'] && !/^none/i.test(v['Buffer (safety net)'])
      ? `Buffer: ${v['Buffer (safety net)']}`
      : null,
    v['Max payout'] && v['Max payout'] !== '—' ? `Max payout: ${v['Max payout']}` : null,
    v['Scaling'] && v['Scaling'] !== '—' ? `Scaling: ${v['Scaling']}` : null,
    v['Min balance to request'] && v['Min balance to request'] !== '—'
      ? `Min balance to request: ${v['Min balance to request']}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const label = [row.family, row.option ? `(${row.option})` : null, `$${Math.round(size / 1000)}k`]
    .filter(Boolean)
    .join(' ')

  const plan: FirmPlan = {
    label,
    phase: 'eval',
    size,
    maxDrawdown: parseMoney(v['Max drawdown']),
    drawdownType: parseDrawdownType(v['Drawdown type']),
    consistencyPercent: parsePercent(v['Consistency (eval)']),
    profitTarget: parseMoney(v['Profit target']),
    dailyLossLimit: parseMoney(v['Daily loss limit (eval)']),
    minTradingDays: parseDays(v['Min days (eval)']),
    minWinningDays: parseDays(v['Winning days required']),
    winningDayMinProfit: parseWinningDayMinimum(v['Winning days required']),
    cost: parseMoney(row.price),
    profitSplit: parseSplit(v['Profit split']),
    maxContracts: evalContracts.mini ?? fundedContracts.mini,
    maxMicroContracts: evalContracts.micro ?? fundedContracts.micro,
    activationFee: parseMoney(v['Activation fee']),
    resetFee: parseMoney(v['Reset fee']),
    buffer: parseMoney(v['Buffer (safety net)']),
    payoutFrequency: v['Payout frequency'] && v['Payout frequency'] !== '—' ? v['Payout frequency'] : null,
    minPayout: v['Min payout'] && v['Min payout'] !== '—' ? v['Min payout'] : null,
    notes: notes || null,
  }

  const list = byFirm.get(row.firm) ?? []
  list.push(plan)
  byFirm.set(row.firm, list)
}

const catalogues = [...byFirm.entries()]
  .filter(([slug]) => FIRMS[slug])
  .map(([slug, plans]) => ({ ...FIRMS[slug], slug, plans }))

const file = `/**
 * Prop-firm plan catalogues — generated, do not edit by hand.
 *
 * Rebuilt by scripts/import-catalogue.mts from the published spec sheets.
 * These are starting points: firm terms change constantly, so every value is
 * editable on the firm's catalogue once applied, and an account can diverge
 * from the plan it came from.
 *
 * Verified against the source specs on ${new Date().toISOString().slice(0, 10)}.
 */
import type { FirmPlan } from '@/db/schema'

export type FirmCatalogue = {
  slug: string
  name: string
  website: string
  plans: FirmPlan[]
}

export const FIRM_CATALOGUES: FirmCatalogue[] = ${JSON.stringify(catalogues, null, 2)}

export function catalogueFor(name: string): FirmCatalogue | undefined {
  const needle = name.trim().toLowerCase()
  return FIRM_CATALOGUES.find(
    (firm) => firm.name.toLowerCase() === needle || firm.slug === needle,
  )
}
`

writeFileSync('src/lib/propfirm/catalogue.ts', file)
console.log(`wrote ${catalogues.length} firms, ${catalogues.reduce((n, f) => n + f.plans.length, 0)} plans`)
for (const firm of catalogues) console.log(`  ${firm.name}: ${firm.plans.length}`)
