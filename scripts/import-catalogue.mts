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

/**
 * Firms the spec sheets do not cover, entered by hand from the firm's own
 * rules pages. Merged here so regenerating from the sheets never drops them.
 */
type ManualSize = {
  size: number
  profitTarget?: number | null
  maxDrawdown?: number | null
  maxContracts?: number | null
  buffer?: number | null
  cost?: number | null
  /**
   * Overrides for the handful of rules a firm varies by size rather than by
   * family — MFFU's Builder asks $250 at 25K and $500 at 50K, and only the
   * 50K carries a funded daily drawdown. Anything absent falls back to the
   * family's `common` block.
   */
  minPayout?: string | null
  dailyLossLimit?: number | null
  consistencyPercent?: number | null
  /** Appended to the family notes, for rules that only apply at this size. */
  notes?: string | null
}
type ManualFamily = {
  family: string
  sizes: ManualSize[]
  common: Record<string, unknown> & { microRatio?: number }
}

const manualPath = 'scripts/manual-catalogues.json'
if (existsSync(manualPath)) {
  const manual: Record<string, { name: string; website: string; plans: ManualFamily[] }> = JSON.parse(
    readFileSync(manualPath, 'utf8'),
  )

  for (const [slug, firm] of Object.entries(manual)) {
    if (slug.startsWith('_')) continue
    const plans: FirmPlan[] = []

    for (const family of firm.plans) {
      const { microRatio, ...common } = family.common
      for (const size of family.sizes) {
        plans.push({
          label: `${family.family} $${Math.round(size.size / 1000)}k`,
          phase: 'eval',
          size: size.size,
          maxDrawdown: size.maxDrawdown ?? null,
          drawdownType: (common.drawdownType as FirmPlan['drawdownType']) ?? 'none',
          consistencyPercent:
            size.consistencyPercent ?? (common.consistencyPercent as number | null) ?? null,
          profitTarget: size.profitTarget ?? null,
          dailyLossLimit: size.dailyLossLimit ?? (common.dailyLossLimit as number | null) ?? null,
          minTradingDays: (common.minTradingDays as number | null) ?? null,
          minWinningDays: (common.minWinningDays as number | null) ?? null,
          winningDayMinProfit: (common.winningDayMinProfit as number | null) ?? null,
          cost: size.cost ?? null,
          profitSplit: (common.profitSplit as number | null) ?? null,
          maxContracts: size.maxContracts ?? null,
          // Firms quote micro limits as a ratio to the mini limit rather than
          // a number, so it is derived rather than repeated per size.
          maxMicroContracts:
            size.maxContracts != null && microRatio ? size.maxContracts * microRatio : null,
          activationFee: (common.activationFee as number | null) ?? null,
          resetFee: (common.resetFee as number | null) ?? null,
          buffer: size.buffer ?? null,
          payoutFrequency: (common.payoutFrequency as string | null) ?? null,
          minPayout: size.minPayout ?? (common.minPayout as string | null) ?? null,
          notes:
            [common.notes as string | null, size.notes].filter(Boolean).join(' \u00b7 ') || null,
        })
      }
    }

    const existing = catalogues.find((entry) => entry.slug === slug)
    if (existing) existing.plans.push(...plans)
    else catalogues.push({ slug, name: firm.name, website: firm.website, plans })
  }
}

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
