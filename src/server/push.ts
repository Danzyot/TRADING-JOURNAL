import 'server-only'
import { eq, inArray } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'

/**
 * Push notifications to the phone.
 *
 * Web Push rather than a native app: on iOS 16.4 and later a site added to the
 * home screen can receive real notifications through a service worker, which
 * is the whole reason the app is installable. No App Store review, no yearly
 * developer fee, and one codebase that updates when the site deploys.
 *
 * Sending is best-effort by design. A notification that fails must never take
 * down the job that raised it — a payout still has to be recorded even if the
 * phone is unreachable — so every failure here is swallowed after pruning the
 * subscription if the push service says it is gone.
 */

export type PushMessage = {
  title: string
  body: string
  /** Where tapping it should land. */
  url?: string
  /** Notifications sharing a tag replace each other instead of stacking. */
  tag?: string
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

/** The key the browser needs to create a subscription. Safe to expose. */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null
}

function configure(): boolean {
  if (!pushConfigured()) return false
  webpush.setVapidDetails(
    // A contact address is required by the spec so a push service can reach
    // the sender about problems; it is never shown to anyone.
    process.env.VAPID_SUBJECT ?? 'mailto:journal@example.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  return true
}

/**
 * Sends to every registered device.
 *
 * Returns how many got through, so a "test notification" button can say
 * something true rather than an optimistic success.
 */
export async function sendPush(message: PushMessage): Promise<{ sent: number; failed: number }> {
  if (!configure()) return { sent: 0, failed: 0 }

  const devices = await db.select().from(pushSubscriptions)
  if (devices.length === 0) return { sent: 0, failed: 0 }

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? '/',
    tag: message.tag ?? 'trading-journal',
  })

  const expired: number[] = []
  const delivered: number[] = []
  let failed = 0

  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: 60 * 60 * 12 },
        )
        delivered.push(device.id)
      } catch (error) {
        failed += 1
        // 404/410 mean the subscription is dead — the app was reinstalled, or
        // the browser dropped it. Keeping it would retry forever.
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) expired.push(device.id)
      }
    }),
  )

  if (expired.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, expired)).catch(() => {})
  }
  if (delivered.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastSentAt: new Date() })
      .where(inArray(pushSubscriptions.id, delivered))
      .catch(() => {})
  }

  return { sent: delivered.length, failed }
}

/** Never let a notification failure break the caller. */
export async function notify(message: PushMessage): Promise<void> {
  try {
    await sendPush(message)
  } catch {
    // Deliberately silent: see the note at the top of the file.
  }
}

export async function listDevices() {
  return db.select().from(pushSubscriptions).orderBy(pushSubscriptions.createdAt)
}

export async function saveDevice(input: {
  endpoint: string
  p256dh: string
  auth: string
  label?: string | null
}): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      label: input.label ?? null,
    })
    // Re-subscribing on the same device returns the same endpoint; refresh the
    // keys rather than failing or duplicating.
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: input.p256dh, auth: input.auth, label: input.label ?? null },
    })
}

export async function forgetDevice(id: number): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))
}
