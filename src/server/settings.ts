import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { settings, type Settings } from '@/db/schema'
import { DEFAULT_ALLOCATION_PLAN } from '@/lib/allocation'
import { DEFAULT_TAX_PROFILE } from '@/lib/tax/israel'
import { DEFAULT_TIMEZONE } from '@/lib/time'

export const DEFAULT_RISK_RULES = {
  maxTradesPerDay: 5,
  maxLossPerDayBase: 500,
  maxConsecutiveLosses: 3,
  maxDailyLossR: 3,
  sessionStart: '15:30',
  sessionEnd: '23:00',
  maxRiskPercentPerTrade: 0.01,
}

/**
 * Reads the single settings row, creating it on first run.
 *
 * Everything downstream — timezone, day boundary, tax profile, allocation plan —
 * depends on this existing, so it self-heals rather than making every caller
 * handle a null.
 */
export async function getSettings(): Promise<Settings> {
  const existing = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
  if (existing.length > 0) return withDefaults(existing[0])

  const [created] = await db
    .insert(settings)
    .values({
      id: 1,
      timezone: DEFAULT_TIMEZONE,
      taxProfile: DEFAULT_TAX_PROFILE,
      allocationPlan: DEFAULT_ALLOCATION_PLAN,
      riskRules: DEFAULT_RISK_RULES,
    })
    .onConflictDoNothing()
    .returning()

  if (created) return withDefaults(created)

  // A concurrent request won the insert; read what it wrote.
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
  return withDefaults(row)
}

/** Backfills JSON columns that predate a schema addition. */
function withDefaults(row: Settings): Settings {
  return {
    ...row,
    taxProfile: row.taxProfile ?? DEFAULT_TAX_PROFILE,
    allocationPlan: row.allocationPlan ?? DEFAULT_ALLOCATION_PLAN,
    riskRules: row.riskRules ?? DEFAULT_RISK_RULES,
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  await getSettings()
  const [updated] = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning()
  return withDefaults(updated)
}
