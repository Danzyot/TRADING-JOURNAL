'use client'

import { useState } from 'react'
import type { Place } from '@/lib/abroad/places'
import { photoUrl } from '@/lib/abroad/photos'
import { sceneryFor } from '@/lib/abroad/scenery'
import { PlaceScene } from './scene'

/**
 * The photograph, with the drawing underneath it.
 *
 * The photograph comes from Wikipedia through our own route, which can fail —
 * no article image, a timeout, no network. When it does, this swaps to the
 * drawn scene rather than showing a broken frame, so there is always something
 * in the slot.
 */
export function PlacePhoto({
  place,
  className,
  sizes,
}: {
  place: Place
  className?: string
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)
  const scenery = sceneryFor(place)
  const alt = `${place.name}, ${place.where}`

  if (failed || scenery.photo) {
    return <PlaceScene scenery={scenery} alt={alt} className={className} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- proxied through our own route, already cached
    <img
      src={photoUrl(place.id)}
      alt={alt}
      loading="lazy"
      decoding="async"
      sizes={sizes}
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
