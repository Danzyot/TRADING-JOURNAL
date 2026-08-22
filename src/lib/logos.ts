/**
 * The app's marks.
 *
 * One design, two finishes, six colours each, cut from the artwork sheets by
 * scripts/generate-logos.mjs. The chosen one drives the sidebar, the browser
 * tab, and the icon on the phone's home screen.
 *
 * Pure data: the id is what settings store, and it is validated against this
 * list on the way out, so a stale or hand-edited value can never point the app
 * at a file that does not exist.
 */

export type LogoSet = 'neon' | 'ember'
export type LogoId = `${LogoSet}-${'purple' | 'gold' | 'red' | 'teal' | 'blue' | 'magenta'}`

export type Logo = {
  id: LogoId
  set: LogoSet
  label: string
  /** Roughly the seam colour — tints the selected state in Settings. */
  accent: string
}

export const LOGO_SETS: { id: LogoSet; label: string; note: string }[] = [
  { id: 'neon', label: 'Neon', note: 'Brighter, sharper edges' },
  { id: 'ember', label: 'Ember', note: 'Softer glow, deeper stone' },
]

const COLOURS: { key: string; label: string; accent: string }[] = [
  { key: 'blue', label: 'Blue', accent: '#3b82f6' },
  { key: 'teal', label: 'Teal', accent: '#2de2c4' },
  { key: 'purple', label: 'Purple', accent: '#8b5cf6' },
  { key: 'magenta', label: 'Magenta', accent: '#e879f9' },
  { key: 'gold', label: 'Gold', accent: '#f5c542' },
  { key: 'red', label: 'Red', accent: '#ef4444' },
]

export const LOGOS: Logo[] = LOGO_SETS.flatMap((set) =>
  COLOURS.map((colour) => ({
    id: `${set.id}-${colour.key}` as LogoId,
    set: set.id,
    label: colour.label,
    accent: colour.accent,
  })),
)

export const DEFAULT_LOGO: LogoId = 'neon-blue'

/**
 * The first set shipped without a prefix. Mapping the old ids forward means a
 * choice already made survives the change instead of silently reverting.
 */
const LEGACY: Record<string, LogoId> = Object.fromEntries(
  COLOURS.map((colour) => [colour.key, `ember-${colour.key}` as LogoId]),
)

export function isLogoId(value: unknown): value is LogoId {
  return typeof value === 'string' && LOGOS.some((logo) => logo.id === value)
}

/** Falls back rather than throwing: a bad value must not break the page. */
export function logoOrDefault(value: unknown): LogoId {
  if (isLogoId(value)) return value
  if (typeof value === 'string' && LEGACY[value]) return LEGACY[value]
  return DEFAULT_LOGO
}

export function logoPath(
  id: LogoId,
  file: 'icon-512' | 'icon-192' | 'icon-64' | 'apple-touch-icon',
): string {
  return `/logos/${id}/${file}.png`
}
