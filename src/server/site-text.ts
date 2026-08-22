import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { siteText } from '@/db/schema'

/**
 * Text overrides — the wording the user has changed.
 *
 * Read once per request in the app layout and handed to the whole tree, so
 * making every heading editable costs one query rather than one per heading.
 */

export type TextOverrides = Record<string, string>

export async function getSiteText(): Promise<TextOverrides> {
  try {
    const rows = await db.select().from(siteText)
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  } catch {
    // A database that is unreachable, or a migration that has not run yet,
    // must not blank the whole interface — the defaults in code are a complete
    // interface on their own.
    return {}
  }
}

export async function setSiteText(key: string, value: string): Promise<void> {
  const trimmed = value.trim()

  // Saving the default back, or emptying the box, removes the override rather
  // than storing a copy — so "reset" needs no separate mechanism.
  if (trimmed === '') {
    await db.delete(siteText).where(eq(siteText.key, key))
    return
  }

  await db
    .insert(siteText)
    .values({ key, value: trimmed })
    .onConflictDoUpdate({ target: siteText.key, set: { value: trimmed, updatedAt: new Date() } })
}
