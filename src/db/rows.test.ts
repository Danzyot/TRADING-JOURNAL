import { describe, expect, it } from 'vitest'
import { rowsOf } from './rows'

describe('rowsOf', () => {
  it('reads the array postgres-js returns', () => {
    expect(rowsOf<{ n: number }>([{ n: 1 }, { n: 2 }])).toEqual([{ n: 1 }, { n: 2 }])
  })

  it('reads the result object PGlite returns', () => {
    expect(rowsOf<{ n: number }>({ rows: [{ n: 1 }], fields: [] })).toEqual([{ n: 1 }])
  })

  it('treats anything else as no rows rather than throwing', () => {
    expect(rowsOf(null)).toEqual([])
    expect(rowsOf(undefined)).toEqual([])
    expect(rowsOf({})).toEqual([])
    expect(rowsOf({ rows: 'nope' })).toEqual([])
    expect(rowsOf(42)).toEqual([])
  })

  it('keeps an empty result empty, which is not the same as a missing one', () => {
    expect(rowsOf([])).toEqual([])
    expect(rowsOf({ rows: [] })).toEqual([])
  })
})
