/**
 * Single-user auth.
 *
 * This is one person's private journal, so there is no user table: a password
 * from the environment mints a signed, httpOnly session cookie. Everything
 * under `/` except `/login` requires it (see src/middleware.ts).
 */
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { createHash } from 'node:crypto'
import { safeEqual } from './crypto'

const COOKIE = 'tj_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function secret(): Uint8Array {
  const raw = process.env.SESSION_SECRET ?? process.env.ENCRYPTION_KEY
  if (!raw || raw.length < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters.')
  }
  return new TextEncoder().encode(raw)
}

export function passwordMatches(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD
  if (!expected) throw new Error('APP_PASSWORD is not set.')
  // Hash both sides so the comparison length is fixed regardless of input.
  const a = createHash('sha256').update(candidate).digest('hex')
  const b = createHash('sha256').update(expected).digest('hex')
  return safeEqual(a, b)
}

export async function createSession(): Promise<void> {
  const token = await new SignJWT({ sub: 'owner' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    await jwtVerify(token, secret())
    return true
  } catch {
    return false
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return verifyToken(store.get(COOKIE)?.value)
}

export const SESSION_COOKIE = COOKIE

/**
 * Guards cron and webhook routes. Vercel Cron sends `Authorization: Bearer
 * $CRON_SECRET`; the same secret is accepted as `?token=` so the endpoints can
 * be driven from Railway, GitHub Actions, or curl.
 */
export function authorizeMachineRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const query = new URL(request.url).searchParams.get('token') ?? ''
  return (bearer !== '' && safeEqual(bearer, expected)) || (query !== '' && safeEqual(query, expected))
}
