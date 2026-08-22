import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { readDocument } from '@/server/documents'

export const dynamic = 'force-dynamic'

/**
 * Serves one document to the signed-in owner.
 *
 * The session is re-checked here rather than relying on the middleware alone:
 * this route hands back a decrypted passport scan, and a single misconfigured
 * matcher should not be all that stands between that and the open internet.
 *
 * `no-store` matters as much as the auth check — a cached copy in a CDN or a
 * browser's disk cache outlives the session that was allowed to see it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const document = await readDocument(id)
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(document.bytes), {
    headers: {
      'content-type': document.mimeType,
      // Quoted and stripped of quotes in the name: a filename is user input,
      // and an unescaped one can forge extra header fields.
      'content-disposition': `attachment; filename="${document.filename.replace(/["\\\r\n]/g, '')}"`,
      'cache-control': 'private, no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  })
}
