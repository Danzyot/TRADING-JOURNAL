import { describe, expect, it } from 'vitest'
import { DEFAULT_LOGO, LOGOS, LOGO_SETS, isLogoId, logoOrDefault, logoPath } from './logos'

describe('logo catalogue', () => {
  it('has six colours in each of the two sets', () => {
    expect(LOGOS).toHaveLength(12)
    for (const set of LOGO_SETS) {
      expect(LOGOS.filter((logo) => logo.set === set.id)).toHaveLength(6)
    }
  })

  it('gives every mark a unique id', () => {
    expect(new Set(LOGOS.map((logo) => logo.id)).size).toBe(LOGOS.length)
  })

  it('defaults to a mark that exists', () => {
    expect(isLogoId(DEFAULT_LOGO)).toBe(true)
  })
})

describe('logoOrDefault', () => {
  it('keeps a valid id', () => {
    expect(logoOrDefault('neon-teal')).toBe('neon-teal')
  })

  it('carries the old unprefixed ids forward to the set they came from', () => {
    // The first six shipped as bare colours; a choice already made should
    // survive rather than silently reverting.
    expect(logoOrDefault('gold')).toBe('ember-gold')
    expect(logoOrDefault('blue')).toBe('ember-blue')
  })

  it('falls back for anything unrecognised', () => {
    expect(logoOrDefault('chartreuse')).toBe(DEFAULT_LOGO)
    expect(logoOrDefault(null)).toBe(DEFAULT_LOGO)
    expect(logoOrDefault(42)).toBe(DEFAULT_LOGO)
  })
})

describe('logoPath', () => {
  it('points at the generated files', () => {
    expect(logoPath('neon-blue', 'icon-192')).toBe('/logos/neon-blue/icon-192.png')
    expect(logoPath('ember-red', 'apple-touch-icon')).toBe('/logos/ember-red/apple-touch-icon.png')
  })
})
