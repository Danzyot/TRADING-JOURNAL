import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

/**
 * Serves the local trade watcher for download from the Settings page, so
 * setting it up never involves the git repository. Session-gated by the
 * middleware like every page.
 */
export async function GET() {
  try {
    const file = await readFile(path.join(process.cwd(), 'tools', 'watcher.mjs'), 'utf8')
    return new Response(file, {
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'content-disposition': 'attachment; filename="watcher.mjs"',
      },
    })
  } catch {
    return new Response('watcher.mjs is missing from this deployment.', { status: 500 })
  }
}
