import { redirect } from 'next/navigation'
import { DEFAULT_LOGO, logoOrDefault, logoPath } from '@/lib/logos'
import { getSettings } from '@/server/settings'

export const dynamic = 'force-dynamic'

/**
 * A stable path for the notification icon.
 *
 * The service worker is a static file, so it cannot know which mark is
 * currently chosen — it has to name one path and have that path resolve to the
 * right image. It was naming `/icon-192.png`, which nothing served: the
 * middleware answered with a redirect to the login page, so every push
 * notification arrived without an icon.
 *
 * Public, like the manifest and the marks themselves: it is an app icon, and a
 * notification is delivered whether or not a session cookie is at hand.
 */
export async function GET() {
  let logo = DEFAULT_LOGO
  try {
    logo = logoOrDefault((await getSettings()).logo)
  } catch {
    // An unreachable database must not cost the notification its icon.
  }
  redirect(logoPath(logo, 'icon-192'))
}
