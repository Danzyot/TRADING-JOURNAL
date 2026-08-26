/**
 * What "best place" means for this trader, made explicit.
 *
 * A relocation comparison is only as honest as its weights: rank on tax alone
 * and Dubai wins every time, rank on beaches alone and it loses to a Greek
 * island with 12 Mbps internet. So the criteria are named, weighted, and the
 * weights are the reader's to change — the ranking recomputes rather than
 * being asserted.
 */

export type CriterionKey =
  | 'cost'
  | 'tax'
  | 'climate'
  | 'beach'
  | 'training'
  | 'food'
  | 'connectivity'
  | 'admin'
  | 'home'
  | 'proximity'
  | 'safety'

export type Criterion = {
  key: CriterionKey
  label: string
  /** What a 5 means, so a score can be argued with. */
  meaning: string
  /** Starting weight, 0–5. */
  weight: number
}

export const CRITERIA: Criterion[] = [
  {
    key: 'cost',
    label: 'Cost of living',
    meaning: 'What a comfortable month costs against the same month in Israel.',
    weight: 5,
  },
  {
    key: 'tax',
    label: 'Tax on prop payouts',
    meaning: 'Effective rate on business income once genuinely resident, contributions included.',
    weight: 4,
  },
  {
    key: 'climate',
    label: 'Winter warmth',
    meaning: 'October to March outdoors without a coat, and how much rain comes with it.',
    weight: 5,
  },
  {
    key: 'beach',
    label: 'Beach and sea',
    meaning: 'Swimmable sea within a short drive, and for how many months of the year.',
    weight: 5,
  },
  {
    key: 'training',
    label: 'Gym, MMA, running',
    meaning:
      'Somewhere a beginner can walk in next week: a fundamentals class, coaching in a language you speak, and a month you can pay for without a contract.',
    weight: 5,
  },
  {
    key: 'food',
    label: 'Food quality',
    meaning: 'Everyday access to unprocessed, local produce, meat and fish.',
    weight: 4,
  },
  {
    key: 'connectivity',
    label: 'Internet for trading',
    meaning: 'Fibre you can hold a position on, and a fallback when it drops.',
    weight: 5,
  },
  {
    key: 'admin',
    label: 'Ease of settling',
    meaning: 'Getting a number, a bank account and a lease without a lawyer.',
    weight: 3,
  },
  {
    key: 'home',
    label: 'Renting a house',
    meaning: 'A whole house near the sea, long-term, at a rent that is not a joke.',
    weight: 4,
  },
  {
    key: 'proximity',
    label: 'Distance to Israel',
    meaning: 'How easily you get home for a weekend.',
    weight: 3,
  },
  {
    key: 'safety',
    label: 'Being Israeli there',
    meaning:
      'A community and a Chabad within reach, kosher food if you want it, and a street where an Israeli passport is unremarkable.',
    weight: 4,
  },
]

export type Weights = Record<CriterionKey, number>

export const DEFAULT_WEIGHTS: Weights = Object.fromEntries(
  CRITERIA.map((criterion) => [criterion.key, criterion.weight]),
) as Weights
