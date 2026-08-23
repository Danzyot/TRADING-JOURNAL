/**
 * Ranking the candidates against the weights.
 *
 * Deliberately a plain weighted mean rather than anything cleverer: the reader
 * has to be able to see why one place is above another, and a score they cannot
 * reconstruct is a score they cannot argue with.
 *
 * A criterion nobody weighted (0) contributes nothing at all — not a small
 * amount — so "I do not care about proximity" removes it from the comparison
 * rather than quietly keeping a tenth of it.
 */
import type { CriterionKey, Weights } from './criteria'

export type Scored<T extends { scores: Record<CriterionKey, number> }> = T & {
  /** 0–5, the weighted mean of the scores. */
  total: number
  /** Where it ranks, 1 being best. */
  rank: number
}

export function scoreOne(
  scores: Record<CriterionKey, number>,
  weights: Weights,
): number {
  const entries = Object.entries(weights) as [CriterionKey, number][]
  const weighted = entries.reduce((sum, [key, weight]) => sum + (scores[key] ?? 0) * weight, 0)
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  return total === 0 ? 0 : weighted / total
}

export function rank<T extends { scores: Record<CriterionKey, number> }>(
  candidates: T[],
  weights: Weights,
): Scored<T>[] {
  return candidates
    .map((candidate) => ({ ...candidate, total: scoreOne(candidate.scores, weights), rank: 0 }))
    .sort((a, b) => b.total - a.total)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }))
}

/**
 * Which criteria are carrying a candidate, and which are dragging it.
 *
 * The gap from a perfect score, weighted — so a 2 on something that matters a
 * lot outranks a 1 on something that does not.
 */
export function drivers<T extends { scores: Record<CriterionKey, number> }>(
  candidate: T,
  weights: Weights,
): { best: CriterionKey[]; worst: CriterionKey[] } {
  const entries = (Object.entries(weights) as [CriterionKey, number][]).filter(
    ([, weight]) => weight > 0,
  )
  const byLift = [...entries].sort(
    (a, b) => (candidate.scores[b[0]] ?? 0) * b[1] - (candidate.scores[a[0]] ?? 0) * a[1],
  )
  const byDrag = [...entries].sort(
    (a, b) => (5 - (candidate.scores[b[0]] ?? 0)) * b[1] - (5 - (candidate.scores[a[0]] ?? 0)) * a[1],
  )
  return {
    best: byLift.slice(0, 2).map(([key]) => key),
    worst: byDrag.slice(0, 2).map(([key]) => key),
  }
}
