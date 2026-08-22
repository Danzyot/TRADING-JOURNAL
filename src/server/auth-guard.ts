import 'server-only'
import { eq, lt } from 'drizzle-orm'
import { db } from '@/db'
import { authAttempts } from '@/db/schema'
import { WINDOW_MS, nextRecord, throttleState, type ThrottleState } from '@/lib/auth-throttle'

/**
 * The persistent half of login throttling.
 *
 * Every function here fails open. A database blip must not lock the owner out
 * of his own journal: the throttle is a brake on guessing, and a brake that
 * jams shut is worse than one that occasionally slips.
 */

export async function checkLoginThrottle(address: string): Promise<ThrottleState> {
  try {
    const [row] = await db
      .select()
      .from(authAttempts)
      .where(eq(authAttempts.address, address))
      .limit(1)

    return throttleState(
      row ? { attempts: row.attempts, lastFailedAt: row.lastFailedAt } : null,
      new Date(),
    )
  } catch {
    return { blocked: false, retryAfterSeconds: 0, remaining: 0 }
  }
}

export async function recordLoginFailure(address: string): Promise<void> {
  try {
    const now = new Date()
    const [row] = await db
      .select()
      .from(authAttempts)
      .where(eq(authAttempts.address, address))
      .limit(1)

    const next = nextRecord(
      row ? { attempts: row.attempts, lastFailedAt: row.lastFailedAt } : null,
      now,
    )

    await db
      .insert(authAttempts)
      .values({ address, attempts: next.attempts, lastFailedAt: next.lastFailedAt })
      .onConflictDoUpdate({
        target: authAttempts.address,
        set: { attempts: next.attempts, lastFailedAt: next.lastFailedAt },
      })

    // Swept here rather than on a schedule: failures are rare, so this costs
    // nothing, and it keeps the table from growing one row per scanner.
    await db.delete(authAttempts).where(lt(authAttempts.lastFailedAt, new Date(now.getTime() - WINDOW_MS)))
  } catch {
    // Counted on a best-effort basis; a failure to record is not a failure to
    // reject the wrong password, which has already happened by now.
  }
}

export async function clearLoginFailures(address: string): Promise<void> {
  try {
    await db.delete(authAttempts).where(eq(authAttempts.address, address))
  } catch {
    // The record ages out on its own within the window.
  }
}
