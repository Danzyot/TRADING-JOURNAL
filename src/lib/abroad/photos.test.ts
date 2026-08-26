import { describe, expect, it } from 'vitest'
import { PLACES } from './places'
import {
  TITLES_PER_REQUEST,
  WIKI_TITLE,
  proxyUrl,
  thumbnailsById,
  thumbnailsEndpoint,
} from './photos'

describe('the photograph titles', () => {
  it('cover every town and nothing else', () => {
    const ids = new Set(PLACES.map((place) => place.id))
    expect(PLACES.filter((place) => !WIKI_TITLE[place.id]).map((place) => place.id)).toEqual([])
    expect(Object.keys(WIKI_TITLE).filter((id) => !ids.has(id))).toEqual([])
  })

  it('fits every town into two requests', () => {
    expect(Math.ceil(Object.keys(WIKI_TITLE).length / TITLES_PER_REQUEST)).toBeLessThanOrEqual(2)
  })
})

describe('thumbnailsEndpoint', () => {
  it('asks the MediaWiki API for a batch, with anonymous CORS enabled', () => {
    const url = new URL(thumbnailsEndpoint(['Chania', 'Sliema'], 800))
    expect(url.origin).toBe('https://en.wikipedia.org')
    expect(url.pathname).toBe('/w/api.php')
    expect(url.searchParams.get('titles')).toBe('Chania|Sliema')
    expect(url.searchParams.get('pithumbsize')).toBe('800')
    // origin=* is what makes Wikipedia answer a cross-origin request from a page.
    expect(url.searchParams.get('origin')).toBe('*')
    expect(url.searchParams.get('redirects')).toBe('1')
    expect(url.searchParams.get('formatversion')).toBe('2')
  })
})

describe('thumbnailsById', () => {
  // The shape the API actually returns, including the two ways it rewrites a
  // title on you: normalisation, and following a redirect.
  const response = {
    query: {
      normalized: [{ from: 'Rhodes (city)', to: 'Rhodes (city)' }],
      redirects: [{ from: 'Rhodes (city)', to: 'Rhodes, Greece' }],
      pages: [
        {
          title: 'Chania',
          thumbnail: {
            source:
              'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Chania.jpg/800px-Chania.jpg',
          },
        },
        {
          title: 'Rhodes, Greece',
          thumbnail: {
            source:
              'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Rhodes.jpg/800px-Rhodes.jpg',
          },
        },
        { title: 'Gżira' },
      ],
    },
  }

  const asked = { Chania: 'chania', 'Rhodes (city)': 'rhodes', Gżira: 'gzira' }

  it('maps a straightforward answer back to its town', () => {
    expect(thumbnailsById(response, asked).chania).toContain('Chania.jpg')
  })

  it('follows a redirect back to the title we asked for', () => {
    // We asked for "Rhodes (city)"; the page came back as "Rhodes, Greece".
    expect(thumbnailsById(response, asked).rhodes).toContain('Rhodes.jpg')
  })

  it('skips a page that has no photograph rather than inventing one', () => {
    expect(thumbnailsById(response, asked).gzira).toBeUndefined()
  })

  it('survives an empty or broken answer', () => {
    expect(thumbnailsById({}, asked)).toEqual({})
    expect(thumbnailsById({ query: {} }, asked)).toEqual({})
    expect(thumbnailsById({ query: { pages: [] } }, asked)).toEqual({})
  })

  it('does not loop on a redirect that points at itself', () => {
    const circular = {
      query: {
        redirects: [{ from: 'A', to: 'A' }],
        pages: [{ title: 'A', thumbnail: { source: 'https://upload.wikimedia.org/a.jpg' } }],
      },
    }
    expect(thumbnailsById(circular, { B: 'b' })).toEqual({})
  })
})

describe('proxyUrl', () => {
  it('points at our own route, so it needs no content-policy exception', () => {
    expect(proxyUrl('chania')).toBe('/api/place-photo/chania')
  })
})
