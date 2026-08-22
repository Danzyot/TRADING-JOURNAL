import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'

export async function POST() {
  await destroySession()
  // A *relative* Location, resolved by the browser against the page it came
  // from. `new URL('/login', request.url)` builds an absolute one out of the
  // host Next saw internally — "localhost" behind a proxy — and a form posting
  // to one origin that lands on another is exactly what `form-action 'self'`
  // exists to stop, so the browser cancelled the sign-out and left the session
  // cookie looking alive. Relative means same origin by construction.
  return new NextResponse(null, { status: 303, headers: { Location: '/login' } })
}
