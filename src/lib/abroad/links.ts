/**
 * Links out to the places themselves.
 *
 * Constructed rather than stored, because a search URL built from a place name
 * cannot rot the way a hand-copied listing link does. Every one of these opens
 * a real search for a real place; none of them is a link to a specific property,
 * because a specific property is let by the time you read this.
 *
 * The dates default to the trip you described — late September to just before
 * the new year — so the prices you land on are the prices for your window
 * rather than August's.
 */

/** Late September to just before the new year. */
export const WINDOW = { from: '2026-09-25', to: '2026-12-20' }

export function mapsSearch(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function airbnbSearch(area: string, from = WINDOW.from, to = WINDOW.to): string {
  const params = new URLSearchParams({
    checkin: from,
    checkout: to,
    adults: '1',
    room_types: 'Entire home/apt',
  })
  return `https://www.airbnb.com/s/${encodeURIComponent(area)}/homes?${params.toString()}`
}

export function bookingSearch(area: string, from = WINDOW.from, to = WINDOW.to): string {
  const params = new URLSearchParams({
    ss: area,
    checkin: from,
    checkout: to,
    group_adults: '1',
    no_rooms: '1',
  })
  return `https://www.booking.com/searchresults.html?${params.toString()}`
}

/** Long-let listings, which is what a three-month stay actually needs. */
export function longLetSearch(area: string, country: string): string {
  const sites: Record<string, (area: string) => string> = {
    greece: (value) => `https://www.spitogatos.gr/en/to_rent-homes/${encodeURIComponent(value)}`,
    cyprus: (value) => `https://www.bazaraki.com/real-estate-to-rent/?q=${encodeURIComponent(value)}`,
    spain: (value) => `https://www.idealista.com/en/alquiler-viviendas/${encodeURIComponent(value)}/`,
    italy: (value) => `https://www.immobiliare.it/en/affitto-case/${encodeURIComponent(value)}/`,
    malta: (value) => `https://www.maltapark.com/search?q=${encodeURIComponent(value)}`,
  }
  const build = sites[country]
  return build ? build(area) : bookingSearch(area)
}
