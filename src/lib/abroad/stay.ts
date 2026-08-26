/**
 * Three months is a different question from three years.
 *
 * You asked whether a test run means paying tax somewhere. Short answer: no,
 * and not for the reason people usually give. Ninety days does not make you tax
 * resident anywhere on this list — every one of these countries uses a 183-day
 * test, and the ones that do not (Cyprus at 60 days) still require that you are
 * not tax resident anywhere else, which you would be. Israel keeps taxing you
 * exactly as it does now, because Israeli residency ends when your centre of
 * life moves, not when your body does.
 *
 * What a test run does change is everything practical. Rent is a short-let
 * market at a different price. There is no tax number, no health registration,
 * no bank account, no EU registration certificate — none of that friction is
 * yours yet, so the criteria that measure it stop mattering. And the flights
 * home stop being an annual cost and become part of the trip.
 *
 * Two things stay true in both modes and are worth saying once: your prop firm
 * is paying a person, not a company, so nothing about the payout changes; and
 * being physically outside Israel does not reduce Israeli tax by one shekel.
 */
import type { CriterionKey, Weights } from './criteria'
import type { Place } from './places'
import { CATEGORIES, type CostLines, costsFor, totalOf } from './costs'

export type StayKey = 'test' | 'move'

export type Stay = {
  key: StayKey
  label: string
  detail: string
  /** How many months the plan covers. */
  months: number
}

export const STAYS: Stay[] = [
  {
    key: 'test',
    label: 'Test run · 3 months',
    detail: 'Furnished, short let, nothing registered. You stay Israeli tax resident.',
    months: 3,
  },
  {
    key: 'move',
    label: 'Moving · a year or more',
    detail: 'A real lease, a tax number, local health cover, and residency that follows.',
    months: 12,
  },
]

/**
 * Criteria that only exist once you are staying.
 *
 * On a three-month trip the tax regime is irrelevant (you pay Israeli tax
 * either way) and so is the ease of settling (you register nothing). Leaving
 * them weighted would rank Cyprus first for a holiday, which is nonsense.
 */
export const IRRELEVANT_ON_A_TEST_RUN: CriterionKey[] = ['tax', 'admin']

export function weightsForStay(weights: Weights, stay: StayKey): Weights {
  if (stay === 'move') return weights
  const adjusted = { ...weights }
  for (const key of IRRELEVANT_ON_A_TEST_RUN) adjusted[key] = 0
  return adjusted
}

/**
 * What a furnished short let costs against a twelve-month lease.
 *
 * A resort town prices three months against its summer season and a working
 * city barely notices. The premium is on rent only — groceries and a gym
 * membership cost the same whoever you are.
 */
export const SHORT_LET: Record<string, number> = {
  greece: 1.5, cyprus: 1.4, spain: 1.5, portugal: 1.6, italy: 1.45, malta: 1.35,
  croatia: 1.7, montenegro: 1.6, albania: 1.5, bulgaria: 1.5, poland: 1.35,
  turkey: 1.6, georgia: 1.3, uae: 1.5, thailand: 1.3, 'costa-rica': 1.5,
  mexico: 1.45, panama: 1.4, usa: 1.5,
}

/** Towns that live off a summer and price a short let accordingly. */
export const SEASONAL_PREMIUM: Record<string, number> = {
  protaras: 2.2, dubrovnik: 2.2, 'lagos-pt': 2, cesme: 2.1, bodrum: 2, sozopol: 2,
  mondello: 1.9, rhodes: 1.8, budva: 1.9, himare: 1.9, sarande: 1.8, mellieha: 1.7,
  tulum: 1.8, tamarindo: 1.7, 'santa-teresa': 1.7, ericeira: 1.7, marbella: 1.7,
  palma: 1.8, 'costa-adeje': 1.6, bangtao: 1.5, 'ao-nang': 1.6,
}

export function shortLetFactor(place: Place): number {
  return SEASONAL_PREMIUM[place.id] ?? SHORT_LET[place.country] ?? 1.5
}

/**
 * The month, priced for the way you would actually be living it.
 *
 * On a test run: a furnished short let, travel insurance instead of a health
 * system, and a bit more eating out because you have no kitchen you love yet.
 */
export function costsForStay(place: Place, stay: StayKey): CostLines {
  const lines = costsFor(place)
  if (stay === 'move') return lines
  return {
    ...lines,
    rent: Math.round((lines.rent * shortLetFactor(place)) / 10) * 10,
    // Travel insurance for a 21-year-old is cheap and flat, wherever you go.
    health: 45,
    eatingOut: Math.round((lines.eatingOut * 1.2) / 5) * 5,
  }
}

export function monthlyForStay(place: Place, stay: StayKey): number {
  return totalOf(costsForStay(place, stay))
}

/** Return flights from Tel Aviv, roughly, for the trip total. */
export const FLIGHT_HOME: Record<string, number> = {
  greece: 220, cyprus: 150, spain: 320, portugal: 380, italy: 260, malta: 300,
  croatia: 320, montenegro: 340, albania: 300, bulgaria: 220, poland: 260,
  turkey: 250, georgia: 200, uae: 350, thailand: 750, 'costa-rica': 1250,
  mexico: 1150, panama: 1300, usa: 900,
}

export type Entry = {
  /** What a Polish passport gets you, since that is the one that matters. */
  polish: string
  /** What an Israeli passport gets you, for the trips where you would use it. */
  israeli: string
  /** When you would have to do something about it. */
  limit: string
}

export const ENTRY: Record<string, Entry> = {
  greece: { polish: 'Free movement. No limit, no permit, nothing to file.', israeli: '90 days in any 180 under the Schengen rules.', limit: 'Past 90 days you register with the local police as an EU citizen — a form, not an application.' },
  cyprus: { polish: 'Free movement, no limit.', israeli: '90 days in any 180.', limit: 'Registration certificate after 90 days.' },
  spain: { polish: 'Free movement, no limit.', israeli: '90 days in any 180.', limit: 'NIE and central register after 90 days.' },
  portugal: { polish: 'Free movement, no limit.', israeli: '90 days in any 180.', limit: 'Registration at the câmara after 90 days.' },
  italy: { polish: 'Free movement, no limit.', israeli: '90 days in any 180.', limit: 'Iscrizione anagrafica after 90 days.' },
  malta: { polish: 'Free movement, no limit.', israeli: '90 days in any 180.', limit: 'eResidence card after 90 days.' },
  croatia: { polish: 'Free movement, no limit.', israeli: '90 days in any 180.', limit: 'Temporary residence registration after 90 days.' },
  montenegro: { polish: '90 days visa-free.', israeli: '90 days visa-free.', limit: 'A border run resets it; longer means a residence permit, tied to property or a company.' },
  albania: { polish: '90 days visa-free.', israeli: 'One year visa-free — among the most generous in the world for an Israeli passport.', limit: 'The Israeli passport is the better one to enter on here.' },
  bulgaria: { polish: 'Free movement, no limit.', israeli: '90 days in any 180.', limit: 'Registration after 90 days.' },
  poland: { polish: 'Citizen. Nothing at all, ever.', israeli: 'Not needed — use the Polish passport.', limit: 'None. This is the one country that cannot ask you to leave.' },
  turkey: { polish: '90 days in any 180.', israeli: '90 days in any 180 — but Israel currently advises against travel entirely.', limit: 'The advisory, not the visa, is the binding constraint.' },
  georgia: { polish: '365 days visa-free.', israeli: '365 days visa-free.', limit: 'A full year without paperwork of any kind. The easiest long test run on this list.' },
  uae: { polish: '90 days in any 180, visa-free.', israeli: '90 days visa-free.', limit: 'Longer means a residence visa, usually through a free-zone company.' },
  thailand: { polish: '60 days visa-exempt, extendable by 30 at an immigration office.', israeli: '60 days visa-exempt, same extension.', limit: 'For longer, the DTV gives 180 days a visit over five years.' },
  'costa-rica': { polish: 'Up to 180 days as a visitor.', israeli: 'Up to 180 days as a visitor.', limit: 'Rentista residency needs $2,500 a month of certified income.' },
  mexico: { polish: 'Up to 180 days as a visitor.', israeli: 'Up to 180 days as a visitor.', limit: 'Temporary residency on proof of income for longer.' },
  panama: { polish: '90 days visa-free.', israeli: '90 days visa-free.', limit: 'Friendly Nations residency exists and is straightforward.' },
  usa: { polish: 'ESTA under the Visa Waiver Programme — 90 days.', israeli: 'ESTA — Israel joined the Visa Waiver Programme in 2023 — 90 days.', limit: 'A 90-day visit is genuinely available. Living there is not: no work rights, and remote work on ESTA is a grey area you should not build a life on.' },
}

/**
 * The tax answer for a stay this short, which is the same answer everywhere and
 * worth saying plainly rather than repeating per country.
 */
export const SHORT_STAY_TAX = {
  headline: 'Three months makes you tax resident nowhere. Israel keeps taxing you exactly as now.',
  points: [
    'Every country on this list uses a 183-day presence test. Ninety days is not close to it.',
    'Cyprus has a 60-day rule, which looks like an exception and is not: it requires that you are not tax resident in another country, and you would still be Israeli tax resident.',
    'Israeli residency ends when your centre of life moves — home, family, ties, habits — not when you board a plane. A three-month trip does not move it, and does not reduce Israeli tax at all.',
    'Prop payouts are foreign-source income wherever you are sitting, so no country on this list taxes them at source on a visitor.',
    'The one thing to actually do: keep the dates. Boarding passes and entry stamps, because presence is measured in days and the burden of proof is yours.',
  ],
  caveat:
    'This is arithmetic on published residency rules, not advice. Before a stay that runs past 90 days in one place, check the specific country with someone qualified.',
}

/** Everything you do not have to do on a test run, which is most of it. */
export const SKIPPED_ON_A_TEST_RUN = [
  'No tax number — no AFM, no NIF, no AMKA, no equivalent anywhere.',
  'No local bank account. Revolut or Wise covers a three-month stay entirely.',
  'No social security registration and no monthly contribution.',
  'No residency certificate, no permit, no lawyer.',
  'No car to buy or register — rent monthly, or a scooter.',
  'No twelve-month lease, and no deposit you will argue about from another country.',
]

export const KEEP_IN_MIND_ON_A_TEST_RUN = [
  'Travel insurance, not local health cover. About €45 a month at your age, and buy the one that covers training injuries — most policies exclude combat sports by name.',
  'A short let costs 30–120% more than a lease, and the seasonal towns are at the top of that range.',
  'Gyms will sell you a month without a contract almost everywhere; ask before you pay for three.',
  'Go in the season you are worried about. Testing Crete in June proves nothing — the question is January.',
]

export const STAY_CATEGORIES = CATEGORIES
