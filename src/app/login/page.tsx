import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { clientAddress } from '@/lib/auth-throttle'
import {
  checkLoginThrottle,
  clearLoginFailures,
  recordLoginFailure,
} from '@/server/auth-guard'
import { createSession, isAuthenticated, passwordMatches, safeRedirectPath } from '@/lib/auth'

export const metadata = { title: 'Sign in — Trading Journal' }

/**
 * The whole app is behind one password, so the number of guesses an attacker
 * gets is the security property that matters most after the password itself.
 * Attempts are counted per client address, with a lockout that doubles.
 */
async function signIn(formData: FormData) {
  'use server'

  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/')
  const tail = next !== '/' ? `&next=${encodeURIComponent(next)}` : ''
  const address = clientAddress(await headers())

  const throttle = await checkLoginThrottle(address)
  if (throttle.blocked) {
    redirect(`/login?wait=${throttle.retryAfterSeconds}${tail}`)
  }

  if (!passwordMatches(password)) {
    await recordLoginFailure(address)
    redirect(`/login?error=1${tail}`)
  }

  await clearLoginFailures(address)
  await createSession()
  // Only ever redirect within this app — never to a URL supplied in the query.
  redirect(safeRedirectPath(next))
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; wait?: string }>
}) {
  if (await isAuthenticated()) redirect('/')
  const params = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            TJ
          </span>
          <div>
            <h1 className="text-base font-semibold text-[var(--ink)]">Trading Journal</h1>
            <p className="text-xs text-[var(--ink-secondary)]">Futures · prop accounts</p>
          </div>
        </div>

        <form action={signIn} className="card-raised space-y-4 p-5">
          <input type="hidden" name="next" value={params.next ?? '/'} />

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoFocus
              autoComplete="current-password"
              required
            />
          </div>

          {params.error && (
            <p className="text-xs text-[var(--critical)]" role="alert">
              That password is not correct.
            </p>
          )}

          {params.wait && (
            <p className="text-xs text-[var(--critical)]" role="alert">
              Too many attempts. Try again in {Math.ceil(Number(params.wait) / 60) || 1} minute
              {Math.ceil(Number(params.wait) / 60) === 1 ? '' : 's'}.
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full">
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--ink-muted)]">
          Set <code>APP_PASSWORD</code> in your environment to change this.
        </p>
      </div>
    </div>
  )
}
