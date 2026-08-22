import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE = 'tj_session'

/** Files a browser must be able to fetch before the user has signed in. */
const PUBLIC_FILES = new Set([
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.svg',
  // Named by the service worker on every push notification.
  '/icon-192.png',
])

/** The app marks, under /logos/<colour>/. Same reasoning as PUBLIC_FILES. */
const PUBLIC_PREFIXES = ['/logos/']

/**
 * Gate every page behind the session cookie.
 *
 * Cron and webhook routes are exempt because they carry their own bearer token
 * (see `authorizeMachineRequest`) — a scheduled sync has no cookie jar.
 *
 * Verification happens here rather than in each page so a new route is private
 * by default. Getting that backwards is how private data leaks.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/webhook') ||
    // Machine upload + email ingest — carry their own bearer tokens.
    pathname.startsWith('/api/upload') ||
    pathname.startsWith('/api/ingest') ||
    pathname.startsWith('/_next') ||
    // The installable-app files. These have to be readable without a session:
    // iOS fetches the manifest and the icon before anyone signs in, and a
    // service worker that 302s to the login page cannot register at all —
    // which would take push notifications down with it. None of them expose
    // any data; sw.js caches only static assets and every page it fetches
    // still passes through this same check.
    PUBLIC_FILES.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === '/favicon.ico'

  if (isPublic) return NextResponse.next()

  const token = request.cookies.get(COOKIE)?.value
  const secret = process.env.SESSION_SECRET ?? process.env.ENCRYPTION_KEY

  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret))
      return NextResponse.next()
    } catch {
      // Fall through to the redirect below.
    }
  }

  const login = request.nextUrl.clone()
  login.pathname = '/login'
  // Remember where they were headed so signing in lands them there.
  login.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
