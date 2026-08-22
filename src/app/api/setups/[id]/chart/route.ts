import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { readScreenshot } from '@/server/setups'

export const dynamic = 'force-dynamic'

/** Only what the vision API and browsers both handle; nothing executable. */
const SERVEABLE = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'])

/**
 * Serves one chart screenshot to the signed-in owner.
 *
 * The session is re-checked here rather than trusting the middleware alone: a
 * chart shows a funded account's levels and size, and one misconfigured
 * matcher should not be all that stands between that and the open internet.
 *
 * The stored content type is re-checked too. It was validated on upload, but
 * this route renders inline, and `Content-Type` is what decides whether a
 * browser paints a picture or runs a script — so it is taken from a fixed list
 * here rather than echoed from the database.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const image = await readScreenshot(id)
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const type = SERVEABLE.has(image.type) ? image.type : 'application/octet-stream'

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      'content-type': type,
      'content-disposition': `inline; filename="chart-${id}"`,
      // A cached copy in a CDN or a browser's disk cache outlives the session
      // that was allowed to see it.
      'cache-control': 'private, no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      // Belt and braces for the octet-stream fallback: nothing served from
      // here should ever be able to execute in the app's origin.
      'content-security-policy': "default-src 'none'; sandbox",
    },
  })
}
