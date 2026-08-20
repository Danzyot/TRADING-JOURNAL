export const dynamic = 'force-dynamic'

/**
 * A personalised Windows launcher for the trade watcher: journal URL and
 * machine token already filled in, so setup is download-two-files and
 * double-click. Session-gated by the middleware — only the signed-in owner
 * can download it, and it deliberately contains their CRON_SECRET, the same
 * token every watcher invocation needs anyway.
 */
export async function GET(request: Request) {
  const token = process.env.CRON_SECRET
  if (!token) {
    return new Response('CRON_SECRET is not configured on the server.', { status: 500 })
  }

  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost !== null ? `${forwardedProto}://${forwardedHost}` : url.origin

  const bat = [
    '@echo off',
    'rem Trading journal — local trade watcher.',
    'rem Keep this file next to watcher.mjs. CSV exports dropped into the',
    'rem exports\\<account name> folders upload themselves; Tradovate syncs',
    'rem every 5 minutes while this window is open.',
    'cd /d "%~dp0"',
    'if not exist exports mkdir exports',
    'where node >nul 2>nul || (echo Node.js is not installed - get it at https://nodejs.org && pause && exit /b 1)',
    `node watcher.mjs --url ${origin} --token ${token} --dir "%~dp0exports"`,
    'pause',
    '',
  ].join('\r\n')

  return new Response(bat, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="start-watcher.bat"',
      'cache-control': 'no-store',
    },
  })
}
