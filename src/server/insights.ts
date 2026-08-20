import 'server-only'
import { desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { insights, type Insight } from '@/db/schema'
import { generateInsights } from '@/lib/analytics/insights'
import { ratesFor } from '@/lib/tax/rates'
import { getSettings } from './settings'
import { equityHistory, listAccounts, listTradesForStats } from './trades'
import { listExpenses, listPayouts, listSubscriptions, revenueForYear } from './money'

/**
 * Regenerates every insight and reconciles them with what is stored.
 *
 * Insights are keyed, not appended: re-running updates an existing observation
 * in place and drops ones that no longer hold. That matters because a dismissed
 * warning should stay dismissed, but a warning that comes *back* — the tax
 * reserve slipping short again — should reappear rather than staying hidden
 * forever under an old dismissal.
 */
export async function regenerateInsights(): Promise<{ generated: number; resolved: number }> {
  const settings = await getSettings()
  const year = new Date().getFullYear()
  const rates = ratesFor(year)

  const [trades, accounts, equityByAccount, expenses, subscriptions, payouts, revenue] =
    await Promise.all([
      listTradesForStats(),
      listAccounts(),
      equityHistory(),
      listExpenses(),
      listSubscriptions(),
      listPayouts(),
      revenueForYear(year),
    ])

  const profile = settings.taxProfile!
  const capped = profile.status === 'osek_patur' || profile.status === 'osek_zair'
  // The ceiling is a shekel figure; compare it in the reporting currency.
  const ceilingBase =
    capped
      ? settings.baseCurrency === 'ILS'
        ? rates.vat.osekPaturCeiling
        : rates.vat.osekPaturCeiling / settings.usdIls
      : null

  const generated = generateInsights({
    trades,
    accounts,
    equityByAccount,
    expenses,
    subscriptions,
    payouts,
    timezone: settings.timezone,
    reservePercent: profile.reservePercent,
    statusCeilingBase: ceilingBase,
    annualRevenueBase: revenue,
  })

  const liveKeys = new Set(generated.map((insight) => insight.key))
  const stored = await db.select().from(insights)
  const dismissed = new Map(stored.filter((row) => row.dismissedAt).map((row) => [row.key, row.dismissedAt!]))

  for (const insight of generated) {
    const previouslyDismissed = dismissed.get(insight.key)
    await db
      .insert(insights)
      .values({
        key: insight.key,
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        body: insight.body,
        impactBase: insight.impactBase,
        evidence: insight.evidence,
        dismissedAt: previouslyDismissed ?? null,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: insights.key,
        set: {
          category: insight.category,
          severity: insight.severity,
          title: insight.title,
          body: insight.body,
          impactBase: insight.impactBase,
          evidence: insight.evidence,
          generatedAt: new Date(),
        },
      })
  }

  // An insight that no longer fires has been resolved — delete it rather than
  // leaving a stale claim about the account on screen.
  const obsolete = stored.filter((row) => !liveKeys.has(row.key))
  for (const row of obsolete) {
    await db.delete(insights).where(eq(insights.id, row.id))
  }

  return { generated: generated.length, resolved: obsolete.length }
}

export async function listInsights(includeDismissed = false): Promise<Insight[]> {
  const rank = sql`case ${insights.severity}
    when 'critical' then 0
    when 'warn' then 1
    when 'good' then 2
    else 3 end`

  return db
    .select()
    .from(insights)
    .where(includeDismissed ? undefined : isNull(insights.dismissedAt))
    .orderBy(rank, desc(insights.generatedAt))
}

export async function dismissInsight(id: number): Promise<void> {
  await db.update(insights).set({ dismissedAt: new Date() }).where(eq(insights.id, id))
}

export async function restoreInsight(id: number): Promise<void> {
  await db.update(insights).set({ dismissedAt: null }).where(eq(insights.id, id))
}
