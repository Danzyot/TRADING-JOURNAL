/**
 * The app's marks.
 *
 * Six colourways of the same glowing-seam tile, cut from the artwork by
 * scripts/generate-logos.mjs. The chosen one drives the sidebar, the browser
 * tab, and the icon on the phone's home screen.
 *
 * Pure data: the id is what is stored in settings, and it is validated against
 * this list on the way in, so a stale or hand-edited value can never point the
 * app at a file that does not exist.
 */

export type LogoId = 'purple' | 'gold' | 'red' | 'teal' | 'blue' | 'magenta'

export type Logo = {
  id: LogoId
  label: string
  /** Roughly the seam colour — used to tint the selected state in Settings. */
  accent: string
}

export const LOGOS: Logo[] = [
  { id: 'blue', label: 'Blue', accent: '#3b82f6' },
  { id: 'teal', label: 'Teal', accent: '#2de2c4' },
  { id: 'purple', label: 'Purple', accent: '#8b5cf6' },
  { id: 'magenta', label: 'Magenta', accent: '#e879f9' },
  { id: 'gold', label: 'Gold', accent: '#f5c542' },
  { id: 'red', label: 'Red', accent: '#ef4444' },
]

export const DEFAULT_LOGO: LogoId = 'blue'

export function isLogoId(value: unknown): value is LogoId {
  return typeof value === 'string' && LOGOS.some((logo) => logo.id === value)
}

/** Falls back rather than throwing: a bad value must not break the whole page. */
export function logoOrDefault(value: unknown): LogoId {
  return isLogoId(value) ? value : DEFAULT_LOGO
}

export function logoPath(id: LogoId, file: 'icon-512' | 'icon-192' | 'icon-64' | 'apple-touch-icon'): string {
  return `/logos/${id}/${file}.png`
}
