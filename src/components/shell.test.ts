import { describe, expect, it } from 'vitest'
import { activeHref } from './shell'

const NAV = [
  { href: '/', label: 'Dashboard', glyph: '◧' },
  { href: '/trades', label: 'Journal', glyph: '✎' },
  { href: '/abroad', label: 'Where to live', glyph: '◎' },
  { href: '/abroad/places', label: 'Every place', glyph: '⌖' },
  { href: '/abroad/greece', label: 'Greece in depth', glyph: '⛱' },
]

describe('activeHref', () => {
  it('lights the deepest match, not every prefix of it', () => {
    expect(activeHref('/abroad/greece', NAV)).toBe('/abroad/greece')
    expect(activeHref('/abroad/places', NAV)).toBe('/abroad/places')
    expect(activeHref('/abroad', NAV)).toBe('/abroad')
  })

  it('keeps the dashboard from matching everything', () => {
    expect(activeHref('/trades', NAV)).toBe('/trades')
    expect(activeHref('/', NAV)).toBe('/')
  })

  it('matches a section from one of its own sub-pages', () => {
    expect(activeHref('/trades/42', NAV)).toBe('/trades')
  })

  it('does not match a sibling that merely shares a prefix', () => {
    expect(activeHref('/abroadish', NAV)).toBeNull()
  })

  it('has no answer for a path outside the nav', () => {
    expect(activeHref('/login', NAV)).toBeNull()
  })
})
