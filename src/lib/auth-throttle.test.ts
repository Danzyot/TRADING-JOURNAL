import { describe, expect, it } from 'vitest'
import { FREE_ATTEMPTS, clientAddress, nextRecord, throttleState } from './auth-throttle'

const at = (iso: string) => new Date(iso)
const now = at('2026-08-22T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

describe('throttleState', () => {
  it('lets a first attempt through', () => {
    expect(throttleState(null, now)).toEqual({
      blocked: false,
      retryAfterSeconds: 0,
      remaining: FREE_ATTEMPTS,
    })
  })

  it('allows the free attempts before locking', () => {
    const state = throttleState({ attempts: 4, lastFailedAt: ago(1000) }, now)
    expect(state.blocked).toBe(false)
    expect(state.remaining).toBe(1)
  })

  it('locks out on the failure that spends the last free attempt', () => {
    // Five free attempts means the fifth failure locks, not the sixth: one
    // extra guess per window is one the policy never meant to give.
    const state = throttleState({ attempts: FREE_ATTEMPTS, lastFailedAt: ago(10_000) }, now)
    expect(state.blocked).toBe(true)
    expect(state.retryAfterSeconds).toBe(50)
    expect(state.remaining).toBe(0)
  })

  it('doubles the lockout with each further failure', () => {
    const first = throttleState({ attempts: 5, lastFailedAt: now }, now)
    const second = throttleState({ attempts: 6, lastFailedAt: now }, now)
    const third = throttleState({ attempts: 7, lastFailedAt: now }, now)
    expect(first.retryAfterSeconds).toBe(60)
    expect(second.retryAfterSeconds).toBe(120)
    expect(third.retryAfterSeconds).toBe(240)
  })

  it('caps the lockout so a forgotten password is not a day-long ban', () => {
    const state = throttleState({ attempts: 40, lastFailedAt: now }, now)
    expect(state.retryAfterSeconds).toBe(30 * 60)
  })

  it('releases once the lockout has elapsed', () => {
    const state = throttleState({ attempts: 5, lastFailedAt: ago(61_000) }, now)
    expect(state.blocked).toBe(false)
  })

  it('forgets a record that has aged out of the window', () => {
    const state = throttleState({ attempts: 20, lastFailedAt: ago(16 * 60 * 1000) }, now)
    expect(state.blocked).toBe(false)
    expect(state.remaining).toBe(FREE_ATTEMPTS)
  })
})

describe('nextRecord', () => {
  it('starts the count at one', () => {
    expect(nextRecord(null, now)).toEqual({ attempts: 1, lastFailedAt: now })
  })

  it('increments inside the window', () => {
    expect(nextRecord({ attempts: 3, lastFailedAt: ago(1000) }, now).attempts).toBe(4)
  })

  it('restarts after the window, rather than resuming an old count', () => {
    expect(nextRecord({ attempts: 30, lastFailedAt: ago(16 * 60 * 1000) }, now).attempts).toBe(1)
  })
})

describe('clientAddress', () => {
  const headers = (map: Record<string, string>) => ({
    get: (name: string) => map[name] ?? null,
  })

  it('takes the first forwarded address', () => {
    expect(clientAddress(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('ignores appended entries, which the client controls', () => {
    // Trusting the last entry would let an attacker mint a fresh identity per
    // guess and never be throttled at all.
    expect(clientAddress(headers({ 'x-forwarded-for': '203.0.113.7, 198.51.100.9' }))).toBe(
      '203.0.113.7',
    )
  })

  it('falls back to x-real-ip', () => {
    expect(clientAddress(headers({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('never returns empty, so the counter always has a key', () => {
    expect(clientAddress(headers({}))).toBe('unknown')
    expect(clientAddress(headers({ 'x-forwarded-for': '  ' }))).toBe('unknown')
  })
})
