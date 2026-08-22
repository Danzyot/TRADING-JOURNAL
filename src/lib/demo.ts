/**
 * Demo mode.
 *
 * A deployment with `DEMO_MODE=1` is a public, read-only copy of the app: no
 * password, no session, and every mutation refused. It exists so the site can
 * be shown to someone without handing them the password — and, more to the
 * point, without them seeing a single row of the owner's data.
 *
 * That privacy is why demo mode is a property of the *deployment* rather than
 * of the request. A demo visitor and the owner are never served by the same
 * process, so there is no per-request switch that could be got wrong and no
 * shared connection that could hand one of them the other's database. The demo
 * runs against its own DATABASE_URL, which it migrates and seeds itself.
 *
 * The functions take their environment as an argument so they can be tested;
 * the exported wrappers read `process.env`.
 */

export type DemoEnv = Record<string, string | undefined>

/** What a refused mutation says. Written for a stranger, not for the owner. */
export const DEMO_REFUSAL = 'This is the demo — nothing you change here is saved.'

/**
 * Only an explicit "1" counts: an empty or misspelled value must not open the
 * door. Neither does `DEMO_MODE` on a deployment that has an `APP_PASSWORD`.
 *
 * That second condition is the one that matters. Vercel offers to copy another
 * project's environment variables when you create one, so the likeliest way
 * this feature ever goes wrong is a demo project that arrives carrying the real
 * deployment's password — or, worse, a `DEMO_MODE` that ends up on the real
 * project. A deployment with a password is somebody's private journal, and it
 * stays private; the demo is the deployment that was given no password at all.
 */
export function isDemoDeployment(env: DemoEnv): boolean {
  return env.DEMO_MODE === '1' && !env.APP_PASSWORD
}

/**
 * True when someone asked for a demo but left a password in place.
 *
 * Failing closed protects the data but is silent, and a silent no-op reads as a
 * broken feature — so the login page says this out loud.
 */
export function demoBlockedByPassword(env: DemoEnv): boolean {
  return env.DEMO_MODE === '1' && Boolean(env.APP_PASSWORD)
}

/**
 * Whether the demo should fill its own database with sample data.
 *
 * On by default, because a journal with no trades demonstrates nothing — every
 * chart is an empty state. `DEMO_SEED=0` gives the empty version instead.
 */
export function shouldSeedDemo(env: DemoEnv): boolean {
  return isDemoDeployment(env) && env.DEMO_SEED !== '0'
}

/**
 * The demo's address, shown as a button on the login page.
 *
 * Absent means no button: a link to a demo that was never deployed is worse
 * than no link at all. Only absolute http(s) URLs are accepted — the value
 * lands in an anchor, and `javascript:` in an href is a script that runs on
 * the one page that has a password field on it.
 *
 * Read at request time, without the `NEXT_PUBLIC_` prefix: the login page is
 * server-rendered, so the value never needs to reach the browser bundle, and
 * changing it does not mean rebuilding.
 */
export function demoLinkFrom(env: DemoEnv): string | null {
  const raw = (env.DEMO_URL ?? '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function demoMode(): boolean {
  return isDemoDeployment(process.env)
}

export function demoLink(): string | null {
  return demoLinkFrom(process.env)
}

export function demoMisconfigured(): boolean {
  return demoBlockedByPassword(process.env)
}
