/**
 * Route-transition skeleton.
 *
 * Every page here is server-rendered against the database, so navigation waits
 * on real queries. Without this file the old page just freezes until the new
 * one arrives, which reads as lag; with it, the click responds instantly and
 * the wait is visibly the data loading.
 */
export default function Loading() {
  return (
    <div aria-busy className="animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-48 rounded-md bg-[var(--surface-sunken)]" />
        <div className="mt-2 h-4 w-80 max-w-full rounded-md bg-[var(--surface-sunken)]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="card h-24 p-4">
            <div className="h-3 w-20 rounded bg-[var(--surface-sunken)]" />
            <div className="mt-3 h-6 w-28 rounded bg-[var(--surface-sunken)]" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card h-72 xl:col-span-2" />
        <div className="card h-72" />
      </div>
    </div>
  )
}
