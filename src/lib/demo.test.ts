import { describe, expect, it } from 'vitest'
import {
  DEMO_REFUSAL,
  demoBlockedByPassword,
  demoLinkFrom,
  isDemoDeployment,
  shouldSeedDemo,
} from './demo'
import { isPublicPath } from './public-paths'

describe('demo deployment flag', () => {
  it('is off unless DEMO_MODE is exactly "1"', () => {
    expect(isDemoDeployment({})).toBe(false)
    expect(isDemoDeployment({ DEMO_MODE: '' })).toBe(false)
    expect(isDemoDeployment({ DEMO_MODE: '0' })).toBe(false)
    expect(isDemoDeployment({ DEMO_MODE: 'true' })).toBe(false)
    expect(isDemoDeployment({ DEMO_MODE: '1' })).toBe(true)
  })

  it('refuses to open a deployment that has a password, whatever DEMO_MODE says', () => {
    // The likeliest real accident: a demo project created by copying the real
    // project's environment variables, password and all.
    expect(isDemoDeployment({ DEMO_MODE: '1', APP_PASSWORD: 'hunter2' })).toBe(false)
    expect(shouldSeedDemo({ DEMO_MODE: '1', APP_PASSWORD: 'hunter2' })).toBe(false)
    expect(demoBlockedByPassword({ DEMO_MODE: '1', APP_PASSWORD: 'hunter2' })).toBe(true)
  })

  it('does not cry misconfiguration on a normal private deployment', () => {
    expect(demoBlockedByPassword({ APP_PASSWORD: 'hunter2' })).toBe(false)
    expect(demoBlockedByPassword({ DEMO_MODE: '1' })).toBe(false)
  })

  it('refuses writes with wording aimed at a stranger', () => {
    expect(DEMO_REFUSAL).toMatch(/demo/i)
    expect(DEMO_REFUSAL).toMatch(/not saved|nothing/i)
  })
})

describe('demo seeding', () => {
  it('seeds by default, because an empty demo shows nothing', () => {
    expect(shouldSeedDemo({ DEMO_MODE: '1' })).toBe(true)
  })

  it('can be turned off for an empty demo', () => {
    expect(shouldSeedDemo({ DEMO_MODE: '1', DEMO_SEED: '0' })).toBe(false)
  })

  it('never seeds a deployment that is not a demo', () => {
    expect(shouldSeedDemo({ DEMO_SEED: '1' })).toBe(false)
    expect(shouldSeedDemo({})).toBe(false)
  })
})

describe('the demo link on the login page', () => {
  it('is absent when unset, so there is no link to a demo nobody deployed', () => {
    expect(demoLinkFrom({})).toBeNull()
    expect(demoLinkFrom({ DEMO_URL: '   ' })).toBeNull()
  })

  it('accepts an absolute http(s) URL', () => {
    expect(demoLinkFrom({ DEMO_URL: 'https://demo.example.com' })).toBe(
      'https://demo.example.com/',
    )
    expect(demoLinkFrom({ DEMO_URL: ' http://localhost:3000/ ' })).toBe(
      'http://localhost:3000/',
    )
  })

  it('refuses a script URL — this lands in an href on the page with the password field', () => {
    expect(demoLinkFrom({ DEMO_URL: 'javascript:alert(1)' })).toBeNull()
    expect(demoLinkFrom({ DEMO_URL: 'data:text/html,<script>' })).toBeNull()
  })

  it('refuses anything that is not a URL at all', () => {
    expect(demoLinkFrom({ DEMO_URL: '/demo' })).toBeNull()
    expect(demoLinkFrom({ DEMO_URL: 'demo.example.com' })).toBeNull()
  })
})

describe('paths reachable without a session', () => {
  it('lets the installable-app files through', () => {
    for (const path of ['/login', '/manifest.webmanifest', '/sw.js', '/favicon.ico', '/icon-192.png']) {
      expect(isPublicPath(path)).toBe(true)
    }
    expect(isPublicPath('/logos/emerald/icon-192.png')).toBe(true)
  })

  it('lets the token-guarded machine routes through', () => {
    expect(isPublicPath('/api/cron/daily')).toBe(true)
    expect(isPublicPath('/api/webhook/tradingview')).toBe(true)
    expect(isPublicPath('/api/ingest/email')).toBe(true)
    expect(isPublicPath('/api/upload')).toBe(true)
  })

  it('keeps every page and every data route private', () => {
    for (const path of [
      '/',
      '/trades',
      '/accounts',
      '/money',
      '/documents',
      '/settings',
      '/api/day',
      '/api/logout',
      '/api/documents/1',
      '/api/setups/1/chart',
    ]) {
      expect(isPublicPath(path)).toBe(false)
    }
  })

  it('is not fooled by a path that merely contains a public prefix', () => {
    expect(isPublicPath('/accounts/api/cron')).toBe(false)
    expect(isPublicPath('/documents/logos/')).toBe(false)
  })
})
