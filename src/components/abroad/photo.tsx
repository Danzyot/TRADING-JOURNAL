'use client'

import { useEffect, useState } from 'react'
import type { Place, PlaceId } from '@/lib/abroad/places'
import {
  TITLES_PER_REQUEST,
  WIKI_TITLE,
  proxyUrl,
  thumbnailsById,
  thumbnailsEndpoint,
  type ThumbnailResponse,
} from '@/lib/abroad/photos'
import { sceneryFor } from '@/lib/abroad/scenery'
import { clsx } from '@/components/ui'
import { PlaceScene } from './scene'

/**
 * The photographs, fetched once for the whole page.
 *
 * Two requests to the MediaWiki API cover all ninety-one towns, and the answer
 * is kept in sessionStorage so moving between pages costs nothing. The fetch
 * happens in the browser rather than on the server for a practical reason: a
 * deployment may or may not be allowed to call out, and the browser loading
 * this page demonstrably can.
 *
 * Three attempts, in order, and the last cannot fail:
 *   1. the batch lookup below
 *   2. /api/place-photo/<id>, which proxies the same thing server-side
 *   3. the drawn scene
 */

const CACHE_KEY = 'tj-abroad-photos'

let inflight: Promise<Record<PlaceId, string>> | null = null

function readCache(): Record<PlaceId, string> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<PlaceId, string>) : null
  } catch {
    return null
  }
}

async function loadThumbnails(): Promise<Record<PlaceId, string>> {
  const cached = readCache()
  if (cached) return cached

  const entries = Object.entries(WIKI_TITLE) as [PlaceId, string][]
  const asked: Record<string, PlaceId> = {}
  for (const [id, title] of entries) asked[title] = id

  const batches: string[][] = []
  for (let index = 0; index < entries.length; index += TITLES_PER_REQUEST) {
    batches.push(entries.slice(index, index + TITLES_PER_REQUEST).map(([, title]) => title))
  }

  const found: Record<PlaceId, string> = {}
  await Promise.all(
    batches.map(async (titles) => {
      try {
        const response = await fetch(thumbnailsEndpoint(titles), { headers: { accept: 'application/json' } })
        if (!response.ok) return
        Object.assign(found, thumbnailsById((await response.json()) as ThumbnailResponse, asked))
      } catch {
        // Offline, blocked, or the API changed shape. The other attempts remain.
      }
    }),
  )

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(found))
  } catch {
    // A full or blocked store just means we look it up again next page.
  }
  return found
}

function usePhoto(id: PlaceId): { url: string | null; settled: boolean } {
  const [state, setState] = useState<{ url: string | null; settled: boolean }>({
    url: null,
    settled: false,
  })

  useEffect(() => {
    let alive = true
    const cached = readCache()
    if (cached) {
      setState({ url: cached[id] ?? null, settled: true })
      return
    }
    inflight = inflight ?? loadThumbnails()
    inflight
      .then((found) => {
        if (alive) setState({ url: found[id] ?? null, settled: true })
      })
      .catch(() => {
        if (alive) setState({ url: null, settled: true })
      })
    return () => {
      alive = false
    }
  }, [id])

  return state
}

/**
 * A photograph of an arbitrary Wikipedia title — a neighbourhood rather than a
 * town. Looked up on its own because these are not in the batch, and quietly
 * absent when there is no article, which is the common case for a suburb.
 */
export function WikiPhoto({
  title,
  alt,
  className,
}: {
  title?: string
  alt: string
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!title) return
    let alive = true
    ;(async () => {
      try {
        const response = await fetch(thumbnailsEndpoint([title], 400), {
          headers: { accept: 'application/json' },
        })
        if (!response.ok) return
        const found = thumbnailsById((await response.json()) as ThumbnailResponse, { [title]: 'one' })
        if (alive && found.one) setUrl(found.one)
      } catch {
        // No photograph is a fine outcome for a suburb.
      }
    })()
    return () => {
      alive = false
    }
  }, [title])

  if (!url || failed) {
    return (
      <div
        className={clsx(className, 'flex items-center justify-center bg-[var(--surface-sunken)]')}
        aria-hidden
      >
        <span className="text-[0.625rem] text-[var(--ink-muted)]">no photo</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote by design
    <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={className} />
  )
}

export function PlacePhoto({
  place,
  className,
}: {
  place: Place
  className?: string
}) {
  const scenery = sceneryFor(place)
  const { url, settled } = usePhoto(place.id)
  const [failed, setFailed] = useState(0)
  const alt = `${place.name}, ${place.where}`

  // A committed file always wins, and never needs the network.
  if (scenery.photo) {
    // eslint-disable-next-line @next/next/no-img-element -- a committed still
    return <img src={scenery.photo} alt={alt} className={className} loading="lazy" />
  }

  // In order, and the last one cannot fail. Nothing is requested until the batch
  // lookup has answered, so a page of ninety cards makes two requests, not ninety.
  const candidates = settled ? [url, proxyUrl(place.id)].filter(Boolean as unknown as (value: string | null) => value is string) : []
  const src = candidates[failed]

  if (!src) return <PlaceScene scenery={scenery} alt={alt} className={className} />

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote by design, with two fallbacks
    <img
      key={src}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed((step) => step + 1)}
      className={className}
    />
  )
}
