import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { readTradeScreenshot } from '@/server/trades'

export const dynamic = 'force-dynamic'

/** Only what a browser paints; nothing executable. */
const SERVEABLE = new Set(['image/png', 'image/jpeg', 'image/webp'])

/**
 * Serves one trade's chart to the signed-in owner.
 *
 * The same reasoning as the setup charts: the session is re-checked here rather
 * than trusted from the middleware, and the content type comes from a fixed
 * list rather than from the database, because `Content-Type` is what decides
 * whether a browser paints a picture or runs a script.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const image = await readTradeScreenshot(id)
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const type = SERVEABLE.has(image.type) ? image.type : 'application/octet-stream'

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      'content-type': type,
      'content-disposition': `inline; filename="trade-${id}"`,
      // A cached copy outlives the session that was allowed to see it.
      'cache-control': 'private, no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  })
}
