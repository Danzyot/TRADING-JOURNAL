/**
 * A town's photograph, proxied from Wikipedia.
 *
 * Going through our own origin rather than linking Wikimedia directly does
 * three things: the page needs no content-security-policy exception, the image
 * is cached at our edge instead of hot-linking someone else's bandwidth, and a
 * failure upstream becomes a clean 404 that the card can fall back from rather
 * than a broken image.
 *
 * Everything here fails closed. No article, no lead image, a slow response, a
 * non-image content type — all return 404, and the card draws its scene.
 */
import { NextResponse } from 'next/server'
import { WIKI_TITLE } from '@/lib/abroad/photos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 4000
const WIDTH = 800
/** A day in the browser, a week at the edge: these photographs do not change. */
const CACHE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800'

async function withTimeout(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        // Wikimedia requires a real user agent and blocks anonymous scripts.
        'user-agent': 'TradingJournal/1.0 (https://github.com/Danzyot/TRADING-JOURNAL) personal relocation research',
        ...headers,
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const title = WIKI_TITLE[id]
  if (!title) return new NextResponse(null, { status: 404 })

  try {
    const summary = await withTimeout(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { accept: 'application/json' },
    )
    if (!summary.ok) return new NextResponse(null, { status: 404 })

    const data = (await summary.json()) as {
      thumbnail?: { source?: string }
      originalimage?: { source?: string }
    }
    const source = data.thumbnail?.source ?? data.originalimage?.source
    if (!source) return new NextResponse(null, { status: 404 })

    // Wikimedia thumbnails carry their width in the filename; ask for a bigger
    // one than the default 320px so the banner is not soft.
    const wide = source.replace(/\/(\d+)px-/, `/${WIDTH}px-`)

    const image = await withTimeout(wide)
    if (!image.ok) return new NextResponse(null, { status: 404 })
    const type = image.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return new NextResponse(null, { status: 404 })

    return new NextResponse(await image.arrayBuffer(), {
      headers: { 'content-type': type, 'cache-control': CACHE },
    })
  } catch {
    // Offline, timed out, or upstream changed shape. The card draws its scene.
    return new NextResponse(null, { status: 404 })
  }
}
