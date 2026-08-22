/**
 * The rows out of a raw `db.execute`, whichever driver ran it.
 *
 * postgres-js hands back an array; PGlite — which the demo runs on — hands back
 * a result object with the rows inside it. Reading `result[0]` therefore works
 * against one and silently yields `undefined` against the other, which is not
 * an error anywhere: it looks exactly like a query that returned nothing.
 *
 * That cost ten seconds on every demo boot before this existed. The bootstrap
 * asks Postgres for an advisory lock, read the answer as "no lock", and sat
 * through its full twenty-attempt wait before continuing anyway.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object') {
    const rows = (result as { rows?: unknown }).rows
    if (Array.isArray(rows)) return rows as T[]
  }
  return []
}
