/**
 * A trade setup: entry, stop, target, and the risk-reward that falls out.
 *
 * Every one of these can be written two ways — a price, or a distance in
 * points from the entry — and a trader has whichever one their platform put in
 * front of them. Asking for both and deriving neither means typing the same
 * fact twice; deriving silently means a typo in one field quietly rewrites the
 * other.
 *
 * So: fill in whatever is missing from whatever is present, and when both are
 * present and disagree, say so rather than picking a winner. A stop the
 * journal thinks is at 20150 when the order was at 20105 is worse than no stop
 * recorded at all, because it makes every R-multiple downstream wrong.
 *
 * Points are price distance, which is what they are on index futures — the
 * contract's tick size affects money per point, not the arithmetic here.
 *
 * Pure: no clock, no database.
 */

export type SetupInput = {
  direction?: 'long' | 'short' | null
  entryPrice?: number | null
  stopPrice?: number | null
  stopPoints?: number | null
  targetPrice?: number | null
  targetPoints?: number | null
  /** An override; normally computed from the two distances. */
  riskReward?: number | null
}

export type SetupDerived = {
  direction: 'long' | 'short' | null
  entryPrice: number | null
  stopPrice: number | null
  stopPoints: number | null
  targetPrice: number | null
  targetPoints: number | null
  riskReward: number | null
  /** Things the trader should look at before saving. Never blocks a save. */
  warnings: string[]
}

/** Prices agree to the cent; anything looser hides a real typo. */
const TOLERANCE = 0.005

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

/**
 * Which way the trade goes, from whatever says so.
 *
 * The stop is the more reliable teller: a target can sit either side of the
 * entry in the trader's head while they are still deciding, but a stop below
 * the entry is a long, always.
 */
function resolveDirection(input: SetupInput): 'long' | 'short' | null {
  if (input.direction) return input.direction
  const entry = input.entryPrice
  if (entry === null || entry === undefined) return null
  if (input.stopPrice != null && Math.abs(input.stopPrice - entry) > TOLERANCE) {
    return input.stopPrice < entry ? 'long' : 'short'
  }
  if (input.targetPrice != null && Math.abs(input.targetPrice - entry) > TOLERANCE) {
    return input.targetPrice > entry ? 'long' : 'short'
  }
  return null
}

export function deriveSetup(input: SetupInput): SetupDerived {
  const warnings: string[] = []
  const direction = resolveDirection(input)
  const entryPrice = input.entryPrice ?? null

  /**
   * One leg of the setup. `away` is which way the level sits from the entry
   * for this direction: a long's stop is below and its target above.
   */
  const leg = (
    price: number | null | undefined,
    points: number | null | undefined,
    below: boolean,
    name: string,
  ): { price: number | null; points: number | null } => {
    let outPrice = price ?? null
    let outPoints = points ?? null

    if (outPoints !== null && outPoints < 0) {
      warnings.push(`${name} distance cannot be negative — using its absolute value.`)
      outPoints = Math.abs(outPoints)
    }

    if (entryPrice !== null && outPrice !== null) {
      const measured = round(Math.abs(outPrice - entryPrice))
      if (outPoints === null) outPoints = measured
      else if (Math.abs(measured - outPoints) > TOLERANCE) {
        // Both given and inconsistent. The price is the one the broker saw, so
        // it wins — but the trader is told, because one of the two is a typo.
        warnings.push(
          `${name} is ${outPoints} points by your figure but ${measured} from the prices. Using the prices.`,
        )
        outPoints = measured
      }
      if (direction !== null) {
        const shouldBeBelow = direction === 'long' ? below : !below
        const isBelow = outPrice < entryPrice
        if (measured > TOLERANCE && isBelow !== shouldBeBelow) {
          warnings.push(
            `${name} at ${outPrice} is on the wrong side of a ${direction} entry at ${entryPrice}.`,
          )
        }
      }
    } else if (entryPrice !== null && outPoints !== null && direction !== null) {
      const shouldBeBelow = direction === 'long' ? below : !below
      outPrice = round(shouldBeBelow ? entryPrice - outPoints : entryPrice + outPoints)
    }

    return { price: outPrice, points: outPoints === null ? null : round(outPoints) }
  }

  const stop = leg(input.stopPrice, input.stopPoints, true, 'Stop')
  const target = leg(input.targetPrice, input.targetPoints, false, 'Target')

  let riskReward = input.riskReward ?? null
  if (stop.points !== null && target.points !== null && stop.points > 0) {
    const computed = round(target.points / stop.points)
    if (riskReward === null) riskReward = computed
    else if (Math.abs(computed - riskReward) > 0.01) {
      warnings.push(
        `Risk-reward of ${riskReward} does not match the ${target.points} / ${stop.points} points entered, which is ${computed}.`,
      )
    }
  }

  if (stop.points === 0) {
    warnings.push('A stop at the entry price risks nothing — check the stop.')
  }

  return {
    direction,
    entryPrice,
    stopPrice: stop.price,
    stopPoints: stop.points,
    targetPrice: target.price,
    targetPoints: target.points,
    riskReward,
    warnings,
  }
}
