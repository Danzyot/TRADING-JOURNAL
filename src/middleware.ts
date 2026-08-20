import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE = 'tj_session'

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
    // Machine upload — carries its own bearer token, like the cron routes.
    pathname.startsWith('/api/upload') ||
    pathname.startsWith('/_next') ||
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
