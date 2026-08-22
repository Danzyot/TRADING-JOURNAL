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

  // One nonce per request. Next stamps it on the inline scripts it emits, but
  // only when it can find it — which it does by parsing the policy off the
  // *request* headers, so the same policy goes on both sides.
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const policy = contentSecurityPolicy(nonce)
  request.headers.set('x-nonce', nonce)
  request.headers.set('Content-Security-Policy', policy)

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

  const proceed = () => NextResponse.next({ request: { headers: request.headers } })

  if (isPublic) return harden(proceed(), policy)

  const token = request.cookies.get(COOKIE)?.value
  const secret = process.env.SESSION_SECRET ?? process.env.ENCRYPTION_KEY

  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret))
      return harden(proceed(), policy)
    } catch {
      // Fall through to the redirect below.
    }
  }

  const login = request.nextUrl.clone()
  login.pathname = '/login'
  // Remember where they were headed so signing in lands them there.
  login.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
  return harden(NextResponse.redirect(login), policy)
}

/**
 * The headers a browser needs in order to defend the page.
 *
 * Applied here rather than in next.config so every response carries them,
 * including the redirects this file returns — a login redirect is still a page
 * a browser will render.
 *
 * The content policy is the strict-dynamic pattern Next is built for: its own
 * bootstrap scripts carry a nonce, and anything they load inherits trust from
 * them, so no external origin has to be listed. `unsafe-inline` is present for
 * older browsers only — any browser that understands `strict-dynamic` ignores
 * it, and any that doesn't would otherwise refuse to run the app at all.
 *
 * Styles keep `unsafe-inline`: Next inlines critical CSS, and the components
 * here set colours through style attributes. Scripts are where injection
 * actually matters, and those are locked down.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    // data: for inline SVG marks, blob: for anything rendered client-side.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // Nothing on this site should ever be framed, or frame anything else.
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    // A form that posts anywhere but here is a form someone else added.
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

function harden(response: NextResponse, policy: string): NextResponse {
  response.headers.set('Content-Security-Policy', policy)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  // Referrers leak which account or document was open; the origin is enough.
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  )
  // Two years, subdomains included — this app is HTTPS-only in production and
  // the login form must never be reachable over plaintext.
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
