/**
 * Slowing down password guessing.
 *
 * The whole app is behind one password. That is the right shape for a private
 * journal, and it also means an attacker needs exactly one secret — so the
 * number of guesses they get per hour is the security property that matters
 * most after the strength of the password itself.
 *
 * The policy: a handful of free attempts, then a lockout that doubles with
 * each further failure, capped so a forgotten password never locks the owner
 * out for a whole day. Counting is per client address, and a success clears
 * the record.
 *
 * Deliberately not a global lockout. One counter shared by everyone would let
 * anybody on the internet lock the owner out of his own accounts page by
 * failing to log in a few times, which trades a small risk for a larger one.
 *
 * Pure: the caller supplies the record and the clock.
 */

/** Failures before the first lockout. Room for a typo and a wrong keyboard. */
export const FREE_ATTEMPTS = 5

/** Failures older than this are forgotten, so a slow trickle still resets. */
export const WINDOW_MS = 15 * 60 * 1000

const FIRST_LOCKOUT_MS = 60 * 1000
const MAX_LOCKOUT_MS = 30 * 60 * 1000

export type AttemptRecord = {
  /** Consecutive failures inside the window. */
  attempts: number
  /** When the most recent failure happened. */
  lastFailedAt: Date
}

export type ThrottleState = {
  blocked: boolean
  /** Whole seconds until the next attempt is allowed. Zero when not blocked. */
  retryAfterSeconds: number
  /** Attempts left before a lockout starts. Zero once locked out. */
  remaining: number
}

/**
 * How long a lockout lasts after `attempts` failures.
 *
 * Doubling means a script gets six guesses in the first minute and roughly
 * thirty an hour thereafter, while a person who mistyped twice waits a minute.
 */
function lockoutFor(attempts: number): number {
  // `attempts` is how many have already failed, so reaching FREE_ATTEMPTS means
  // they are spent — the lockout starts on the fifth failure, not the sixth.
  const over = attempts - FREE_ATTEMPTS + 1
  if (over <= 0) return 0
  return Math.min(MAX_LOCKOUT_MS, FIRST_LOCKOUT_MS * 2 ** (over - 1))
}

export function throttleState(record: AttemptRecord | null, now: Date): ThrottleState {
  if (!record || record.attempts <= 0) {
    return { blocked: false, retryAfterSeconds: 0, remaining: FREE_ATTEMPTS }
  }

  const since = now.getTime() - record.lastFailedAt.getTime()

  // A quiet spell wipes the slate: someone who got it wrong at breakfast
  // should not be paying for it at lunch.
  if (since >= WINDOW_MS) {
    return { blocked: false, retryAfterSeconds: 0, remaining: FREE_ATTEMPTS }
  }

  const lockout = lockoutFor(record.attempts)
  if (lockout > 0 && since < lockout) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((lockout - since) / 1000),
      remaining: 0,
    }
  }

  return {
    blocked: false,
    retryAfterSeconds: 0,
    remaining: Math.max(0, FREE_ATTEMPTS - record.attempts),
  }
}

/** The counter after one more failure, resetting a record that has aged out. */
export function nextRecord(record: AttemptRecord | null, now: Date): AttemptRecord {
  if (!record || now.getTime() - record.lastFailedAt.getTime() >= WINDOW_MS) {
    return { attempts: 1, lastFailedAt: now }
  }
  return { attempts: record.attempts + 1, lastFailedAt: now }
}

/**
 * The client's address, from the proxy headers a platform actually sets.
 *
 * Only the first entry of `x-forwarded-for` is used: the rest are appended by
 * whatever sent the request and can be forged, so trusting them would let an
 * attacker present a new identity per guess.
 */
export function clientAddress(headers: {
  get(name: string): string | null
}): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
