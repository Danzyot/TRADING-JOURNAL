/**
 * The paths a browser may fetch without a session.
 *
 * Extracted from the middleware so the rule can be tested directly: this list
 * is the whole difference between a private journal and a public one, and a
 * prefix typed slightly wrong here would not show up in any page test.
 */

/** Files a browser must be able to fetch before the user has signed in. */
export const PUBLIC_FILES = new Set([
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.svg',
  '/favicon.ico',
  // Named by the service worker on every push notification.
  '/icon-192.png',
])

/**
 * Prefixes that are public.
 *
 * The API routes here carry their own bearer tokens (see
 * `authorizeMachineRequest`) — a scheduled sync has no cookie jar. The rest are
 * the installable-app files: iOS fetches the manifest and the icon before
 * anyone signs in, and a service worker that 302s to the login page cannot
 * register at all, which would take push notifications down with it. None of
 * them expose data; sw.js caches only static assets, and every page it fetches
 * still passes through the session check.
 */
export const PUBLIC_PREFIXES = [
  '/api/login',
  '/api/cron',
  '/api/webhook',
  // Machine upload + email ingest.
  '/api/upload',
  '/api/ingest',
  '/_next',
  // The app marks, under /logos/<colour>/.
  '/logos/',
]

export function isPublicPath(pathname: string): boolean {
  if (pathname === '/login') return true
  if (PUBLIC_FILES.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
