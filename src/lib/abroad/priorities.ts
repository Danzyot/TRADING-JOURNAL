/**
 * Ranking what matters, instead of guessing at numbers.
 *
 * Ten sliders is a worse interface than one ordered list: nobody knows whether
 * beaches are a 4 or a 5, and everybody knows whether beaches matter more than
 * tax. So the model is an order — first, second, third — and the weights are
 * derived from it. Dropping something out of the list entirely takes it out of
 * the comparison, which is the honest way to say "I do not care about this".
 *
 * The weight curve is deliberately gentle: first place is worth roughly three
 * times last place, not thirty, because a ranking is an opinion about order and
 * not a claim about ratios.
 */
import { CRITERIA, type CriterionKey, type Weights } from './criteria'

export type Priorities = {
  /** Most important first. */
  order: CriterionKey[]
  /** Criteria taken out of the comparison entirely. */
  ignored: CriterionKey[]
}

export const ALL_KEYS: CriterionKey[] = CRITERIA.map((criterion) => criterion.key)

/** The starting order, taken from the brief as written. */
export const DEFAULT_ORDER: CriterionKey[] = [
  'cost',
  'climate',
  'beach',
  'training',
  'connectivity',
  'food',
  'safety',
  'home',
  'proximity',
  'tax',
  'admin',
]

export const DEFAULT_PRIORITIES: Priorities = { order: DEFAULT_ORDER, ignored: [] }

/** First place scores 5, last scores 1.5, everything in between is linear. */
export function weightsFrom(priorities: Priorities): Weights {
  const active = priorities.order.filter((key) => !priorities.ignored.includes(key))
  const weights = Object.fromEntries(ALL_KEYS.map((key) => [key, 0])) as Weights
  const span = Math.max(1, active.length - 1)
  active.forEach((key, index) => {
    weights[key] = 5 - (index / span) * 3.5
  })
  return weights
}

export function move(priorities: Priorities, key: CriterionKey, by: number): Priorities {
  const order = [...priorities.order]
  const from = order.indexOf(key)
  if (from < 0) return priorities
  const to = Math.min(order.length - 1, Math.max(0, from + by))
  if (to === from) return priorities
  order.splice(from, 1)
  order.splice(to, 0, key)
  return { ...priorities, order }
}

export function toggleIgnored(priorities: Priorities, key: CriterionKey): Priorities {
  const ignored = priorities.ignored.includes(key)
    ? priorities.ignored.filter((item) => item !== key)
    : [...priorities.ignored, key]
  return { ...priorities, ignored }
}

/** Repairs a stored value that predates a criterion being added or removed. */
export function normalise(stored: unknown): Priorities {
  const value = (stored ?? {}) as Partial<Priorities>
  const known = (value.order ?? []).filter((key): key is CriterionKey => ALL_KEYS.includes(key))
  const missing = DEFAULT_ORDER.filter((key) => !known.includes(key))
  return {
    order: [...known, ...missing],
    ignored: (value.ignored ?? []).filter((key): key is CriterionKey => ALL_KEYS.includes(key)),
  }
}

export const STORAGE_KEY = 'tj-abroad-priorities'
