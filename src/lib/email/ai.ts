import { isoDate, stripLinks, type EmailEventDraft, type EmailEventKind, type RawEmail } from './parse'

/**
 * The AI half of the email automation — a fallback, not the main path.
 *
 * Rules handle the templates that exist today for free and identically every
 * time. Firms rewrite those templates without warning, and this catches what
 * the rules then miss: one call per unmatched message that still looks like it
 * carries money or an account change. When no key is configured the automation
 * simply runs without it.
 */

export const EMAIL_SYSTEM_PROMPT = [
  'You extract structured events from a futures prop-firm trader\'s email.',
  'Return JSON only — an array, empty when the email carries no event.',
  '',
  'Each event: {"kind","summary","date","accountExternalId","amount","currency","status","balance"}.',
  'kind is one of: payout, purchase, account_status, balance_snapshot, subscription, note.',
  '  payout — a withdrawal the firm requested, approved, paid or denied. status: requested|approved|paid|denied. amount required.',
  '  purchase — money the trader actually paid (evaluation fee, activation, reset). amount required, and it is the total charged after discounts.',
  '  account_status — an account passed, failed, was liquidated, closed or paused. status: passed|failed|closed|paused.',
  '  balance_snapshot — a stated end-of-day account balance. balance required.',
  '  subscription — a recurring plan started, renewed, cancelled or due.',
  '  note — anything else worth seeing in the log.',
  '',
  'Rules:',
  '- date is the date the email states the event happened, YYYY-MM-DD. Use the email\'s own date when it states none.',
  '- amount and balance are plain numbers: no currency symbol, no thousands separators.',
  '- Only report what the email says. Never estimate an amount, and never infer an account number that is not written.',
  '- Marketing, sale announcements, news warnings, webinars, support-ticket replies and surveys carry no event: return [].',
  '- An offer, a reminder to pay, or a price in an advertisement is not a purchase.',
  '- summary is one short factual line a person can scan in a list.',
].join('\n')

/**
 * Pulls the first complete JSON value out of a reply.
 *
 * The trade reviewer's extractor walks object braces only, because it asks for
 * one object; this asks for an array, so the walker has to balance brackets
 * too. Kept local rather than generalising the shared one: widening what that
 * accepts could change how an existing review reply is read.
 */
function extractJsonValue(reply: string): string | null {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : reply

  const first = [candidate.indexOf('['), candidate.indexOf('{')].filter((index) => index !== -1)
  if (first.length === 0) return null
  const start = Math.min(...first)

  let depth = 0
  let inString = false
  for (let i = start; i < candidate.length; i++) {
    const char = candidate[i]
    if (inString) {
      if (char === '\\') i++
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '[' || char === '{') depth++
    else if (char === ']' || char === '}') {
      depth--
      if (depth === 0) return candidate.slice(start, i + 1)
    }
  }
  return null
}

export function buildEmailPrompt(email: RawEmail): string {
  return [
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    `Received: ${isoDate(email.receivedAt)}`,
    '',
    'Body:',
    stripLinks(email.text).slice(0, 4000),
    '',
    'JSON array of events:',
  ].join('\n')
}

const KINDS: EmailEventKind[] = [
  'payout',
  'purchase',
  'account_status',
  'balance_snapshot',
  'subscription',
  'note',
]

const number = (value: unknown): number | undefined => {
  const parsed = typeof value === 'string' ? Number(value.replace(/[$,\s]/g, '')) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined
}

const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

/**
 * Reads the model's reply into events, keeping only what is well-formed.
 *
 * A hallucinated field is worse than a missing one here — these events write
 * to the money page — so anything that fails its shape check is dropped rather
 * than coerced, and an event whose kind requires an amount is dropped without
 * one.
 */
export function parseEmailEvents(reply: string, email: RawEmail, firm?: string): EmailEventDraft[] {
  const json = extractJsonValue(reply)
  if (!json) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed]
  const fallbackDate = isoDate(email.receivedAt)
  const drafts: EmailEventDraft[] = []

  rows.slice(0, 6).forEach((row, index) => {
    if (!row || typeof row !== 'object') return
    const record = row as Record<string, unknown>

    const kind = KINDS.find((candidate) => candidate === record.kind)
    if (!kind) return

    const amount = number(record.amount)
    const balance = number(record.balance)
    if ((kind === 'payout' || kind === 'purchase') && (amount === undefined || amount < 0)) return
    if (kind === 'balance_snapshot' && balance === undefined) return

    const date = text(record.date, 10)
    drafts.push({
      sourceId: index === 0 ? email.id : `${email.id}:ai${index}`,
      kind,
      summary: text(record.summary, 200) ?? `${firm ?? 'Prop firm'}: ${email.subject}`.slice(0, 200),
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallbackDate,
      firm,
      accountExternalId: text(record.accountExternalId, 120),
      amount,
      currency: text(record.currency, 8) ?? (amount === undefined ? undefined : 'USD'),
      status: text(record.status, 30),
      balance,
    })
  })

  return drafts
}
