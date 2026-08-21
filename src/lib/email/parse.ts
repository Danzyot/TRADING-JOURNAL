/**
 * Turns prop-firm emails into journal events.
 *
 * This is the deterministic half of the email automation: no network, no
 * database, no clock — an email in, zero or more events out, which is why it
 * is the part that has tests. `src/server/email-ingest.ts` does the fetching
 * and the writing.
 *
 * The rules below were written against real messages from the seven firms the
 * journal tracks (August 2026). Firms change their templates, so every rule is
 * anchored on the one line that carries the fact — an amount, an account
 * number, a balance — rather than on the surrounding wording, and anything
 * that matches nothing is simply ignored. Marketing outnumbers transactional
 * mail by roughly ten to one, so silence is the correct default: a missed
 * event costs one manual entry, a wrong one corrupts the money page.
 */

export type EmailEventKind =
  | 'payout'
  | 'purchase'
  | 'account_status'
  | 'balance_snapshot'
  | 'subscription'
  | 'note'

export type EmailEventDraft = {
  /** Unique per event — the message id, suffixed when one email yields several. */
  sourceId: string
  kind: EmailEventKind
  summary: string
  /** ISO date the event happened, taken from the email when it states one. */
  date: string
  firm?: string
  accountExternalId?: string
  amount?: number
  currency?: string
  status?: string
  balance?: number
}

export type RawEmail = {
  /** Stable per-message id (Gmail's message id, or the RFC822 Message-ID). */
  id: string
  from: string
  subject: string
  text: string
  /** When the message arrived — the fallback date when the body states none. */
  receivedAt: Date
}

// ---------------------------------------------------------------------------
// Senders
// ---------------------------------------------------------------------------

/**
 * The domains worth fetching, and the firm name each maps to.
 *
 * The firm name is matched fuzzily against the user's own firm rows later, so
 * it has to read like the name someone would type — "Apex Trader Funding",
 * not "apextraderfunding.com".
 */
export const FIRM_DOMAINS: { domain: string; firm: string }[] = [
  { domain: 'apextraderfunding.com', firm: 'Apex Trader Funding' },
  { domain: 'topstep.com', firm: 'Topstep' },
  { domain: 'lucidtrading.com', firm: 'Lucid Trading' },
  { domain: 'myfundedfutures.com', firm: 'MyFundedFutures' },
  { domain: 'takeprofittrader.com', firm: 'Take Profit Trader' },
  { domain: 'fundednext.com', firm: 'FundedNext' },
  { domain: 'alpha-futures.com', firm: 'Alpha Futures' },
  { domain: 'tradeify.co', firm: 'Tradeify' },
  { domain: 'bulenox.com', firm: 'Bulenox' },
  { domain: 'elitetraderfunding.com', firm: 'Elite Trader Funding' },
]

/**
 * Senders that only ever carry marketing.
 *
 * Firms send campaigns from a subdomain or a separate mailbox and keep
 * transactional mail on the bare domain, so dropping these before any rule
 * runs removes most of the volume — and most of the chances to be wrong.
 */
const MARKETING_SENDERS = [
  'send.myfundedfutures.com',
  'team@takeprofittrader.com',
  'updates@fundednext.com',
  'news@',
  'marketing@',
  'newsletter@',
  'helpdesk.', // support-ticket notifications, not account events
]

/** The Gmail search this automation runs, as a single query string. */
export function gmailQuery(days = 2): string {
  const from = FIRM_DOMAINS.map((entry) => `from:${entry.domain}`).join(' ')
  return `{${from}} newer_than:${days}d`
}

export function firmForSender(from: string): string | undefined {
  const address = from.toLowerCase()
  return FIRM_DOMAINS.find((entry) => address.includes(entry.domain))?.firm
}

export function isMarketingSender(from: string): boolean {
  const address = from.toLowerCase()
  return MARKETING_SENDERS.some((needle) => address.includes(needle))
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Strips an HTML body down to readable text.
 *
 * Only used when a message has no text/plain part. It is deliberately crude:
 * the rules that read the result are anchored on short phrases, so block-level
 * tags becoming newlines is all the structure that matters.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;|&#38;/g, '&')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;|&#60;/g, '<')
    .replace(/&gt;|&#62;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Removes the link furniture that dominates marketing-platform emails.
 *
 * Tracking URLs are hundreds of characters long and contain arbitrary
 * base64-ish text, which is enough to produce false matches on any rule that
 * looks for a code or an account number. Link *labels* are kept: "Your PA
 * Payout" sometimes lives inside one.
 */
export function stripLinks(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\((?:[^)]*)\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Formats a Date as a plain YYYY-MM-DD in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Reads the date an email states, in either of the two forms firms use:
 * "Aug 21, 2026" / "August 16, 2026", and "8/20/2026".
 *
 * US month-first ordering is assumed because every firm here bills and writes
 * in US English. A misread would move an event by a few days at worst, and
 * only for days 1-12; the caller falls back to the message's own timestamp.
 */
export function parseLooseDate(text: string): string | null {
  const named = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(text)
  if (named) {
    const month = MONTHS[named[1].slice(0, 3).toLowerCase()]
    if (month) {
      const value = iso(Number(named[3]), month, Number(named[2]))
      if (value) return value
    }
  }

  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(text)
  if (numeric) {
    return iso(Number(numeric[3]), Number(numeric[1]), Number(numeric[2]))
  }

  return null
}

/** Reads "$1,500.00" / "1500" / "-$424" as a number. */
export function parseMoney(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '')
  if (!cleaned || cleaned === '-') return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

type RuleContext = {
  email: RawEmail
  /** Body with links stripped, whitespace-collapsed. */
  body: string
  subject: string
  firm: string
  /** The date the email states, or the day it arrived. */
  fallbackDate: string
}

type Rule = {
  /** Which firm's mail this rule reads, or 'any' for cross-firm patterns. */
  firm: string | 'any'
  run: (context: RuleContext) => EmailEventDraft[]
}

const trim = (value: string, max = 200) => value.replace(/\s+/g, ' ').trim().slice(0, max)

function base(context: RuleContext, kind: EmailEventKind, summary: string, suffix?: string): EmailEventDraft {
  return {
    sourceId: suffix ? `${context.email.id}:${suffix}` : context.email.id,
    kind,
    summary: trim(summary),
    date: context.fallbackDate,
    firm: context.firm,
  }
}

const RULES: Rule[] = [
  // --- Apex ---------------------------------------------------------------
  {
    firm: 'Apex Trader Funding',
    run: (context) => {
      const payout = /PA Payout(?: request(?:ed)?)? for \$?([\d,]+(?:\.\d{2})?)\s*(?:has been|was|is)?\s*(approved|paid|sent|requested|denied|declined)?/i.exec(
        context.body,
      )
      if (payout || /payout/i.test(context.subject)) {
        const amount = parseMoney(payout?.[1]) ?? parseMoney(/\$([\d,]+(?:\.\d{2})?)/.exec(context.body)?.[1])
        const word = (payout?.[2] ?? context.subject).toLowerCase()
        if (amount && amount > 0) {
          const status = word.includes('paid') || word.includes('sent')
            ? 'paid'
            : word.includes('denied') || word.includes('declined')
              ? 'denied'
              : word.includes('request')
                ? 'requested'
                : 'approved'
          return [
            {
              ...base(context, 'payout', `Apex payout $${amount} ${status}`),
              date: parseLooseDate(context.body) ?? context.fallbackDate,
              amount,
              currency: 'USD',
              status,
            },
          ]
        }
      }

      if (/deactivat|has been closed|was closed|liquidat/i.test(`${context.subject} ${context.body}`)) {
        const account = /\b(PA-APEX-[A-Z0-9-]+|APEX-[A-Z0-9-]+)\b/i.exec(context.body)?.[1]
        return [
          {
            ...base(context, 'account_status', `Apex account ${account ?? ''} deactivated`.replace('  ', ' ')),
            accountExternalId: account,
            status: 'failed',
          },
        ]
      }

      if (/subscription\s+(?:to\s+"[^"]*"\s+)?is\s+cancell?ed|subscription cancelled/i.test(`${context.subject} ${context.body}`)) {
        const plan = /subscription to "([^"]{3,120})"/i.exec(context.body)?.[1]
        return [
          {
            ...base(context, 'subscription', `Apex subscription cancelled${plan ? `: ${plan}` : ''}`),
            status: 'cancelled',
          },
        ]
      }

      return []
    },
  },

  // --- Lucid --------------------------------------------------------------
  {
    firm: 'Lucid Trading',
    run: (context) => {
      // The Daily Wire carries one snapshot per account: the eval template
      // labels them "Account Number: X", the funded template "Account
      // Snapshot — X". Both are followed by "Account Balance $N".
      if (/daily wire|daily snapshot/i.test(`${context.subject} ${context.body}`)) {
        const pattern =
          /(?:Account Number:?|Account Snapshot\s*[—–-])\s*([A-Z0-9][A-Z0-9-]{5,40})[\s\S]{0,240}?Account Balance\s*\$?\s*(-?[\d,]+(?:\.\d{1,2})?)/gi
        const date = parseLooseDate(context.body) ?? context.fallbackDate
        const drafts: EmailEventDraft[] = []
        for (const match of context.body.matchAll(pattern)) {
          const account = match[1]
          const balance = parseMoney(match[2])
          if (balance === undefined) continue
          drafts.push({
            ...base(context, 'balance_snapshot', `Lucid daily snapshot ${account}: $${balance}`, account),
            date,
            accountExternalId: account,
            balance,
          })
        }
        return drafts
      }

      if (/order (processing|receipt|confirmation)/i.test(context.subject)) {
        // `[^a-z]` before the word so "Subtotal:" — which precedes the
        // discount line — cannot be mistaken for the amount actually charged.
        const total = parseMoney(/(?:^|[^a-z])total:?\s*\|?\s*\$?([\d,]+\.\d{2})/i.exec(context.body)?.[1])
        const product = /\|\s*(Lucid[^|]{2,60}?)\s*\|\s*\d+\s*\|/i.exec(context.body)?.[1]
        return [
          {
            ...base(context, 'purchase', `Lucid order${product ? `: ${trim(product, 60)}` : ''}${total !== undefined ? ` — $${total}` : ''}`),
            date: parseLooseDate(context.body) ?? context.fallbackDate,
            amount: total,
            currency: 'USD',
          },
        ]
      }

      if (/account (active|activated)/i.test(context.subject)) {
        return [base(context, 'note', 'Lucid account activated')]
      }

      if (/inactivity/i.test(context.subject)) {
        return [base(context, 'note', trim(`Lucid inactivity warning: ${context.subject}`))]
      }

      return []
    },
  },

  // --- MyFundedFutures ----------------------------------------------------
  {
    firm: 'MyFundedFutures',
    run: (context) => {
      const account = /Account ID:?\s*([A-Z0-9]{6,40})/i.exec(context.body)?.[1]

      if (/subscription .*cancell?ed/i.test(`${context.subject} ${context.body}`)) {
        return [
          {
            ...base(context, 'subscription', `MyFundedFutures subscription cancelled${account ? ` (${account})` : ''}`),
            accountExternalId: account,
            status: 'cancelled',
          },
        ]
      }

      if (/renewal/i.test(`${context.subject} ${context.body}`)) {
        const price = parseMoney(/Renewal Price:?\s*\$?([\d,]+(?:\.\d{2})?)/i.exec(context.body)?.[1])
        return [
          {
            // A renewal *notice* is not a charge — recorded so it shows up in
            // the log, with no effect on the money page until it is paid.
            ...base(context, 'subscription', `MyFundedFutures renewal due${account ? ` (${account})` : ''}${price ? ` — $${price}` : ''}`),
            accountExternalId: account,
            amount: price,
            currency: 'USD',
            status: 'renewal_due',
          },
        ]
      }

      return []
    },
  },

  // --- Take Profit Trader -------------------------------------------------
  {
    firm: 'Take Profit Trader',
    run: (context) => {
      const cancelled = /subscription has been cancell?ed for\s*([A-Z0-9]{6,40})/i.exec(context.body)
      if (cancelled) {
        return [
          {
            ...base(context, 'subscription', `Take Profit Trader subscription cancelled (${cancelled[1]})`),
            accountExternalId: cancelled[1],
            status: 'cancelled',
          },
        ]
      }

      if (/setting up your trading test/i.test(context.subject)) {
        return [base(context, 'note', 'Take Profit Trader test account setup email')]
      }

      return []
    },
  },

  // --- Alpha Futures ------------------------------------------------------
  {
    firm: 'Alpha Futures',
    run: (context) => {
      const breach = /Account number\s*([A-Z0-9]{6,40})\s*has violated\s*([^.]{3,60})/i.exec(context.body)
      if (breach) {
        return [
          {
            ...base(context, 'account_status', `Alpha Futures ${breach[1]} breached ${trim(breach[2], 60)}`),
            accountExternalId: breach[1],
            status: 'failed',
          },
        ]
      }
      return []
    },
  },

  // --- Cross-firm fallbacks ----------------------------------------------
  //
  // Anything a firm-specific rule did not claim gets one pass of generic
  // patterns, so a firm changing its template — or a firm with no rules yet —
  // still lands the events that matter most.
  {
    firm: 'any',
    run: (context) => {
      const all = `${context.subject}\n${context.body}`

      const payout =
        /(?:payout|withdrawal|payment)[^.\n]{0,60}?(approved|paid|processed|completed|sent|requested|denied|declined)/i.exec(
          all,
        )
      if (payout) {
        const amount = parseMoney(/\$\s?([\d,]+(?:\.\d{2})?)/.exec(all)?.[1])
        if (amount && amount > 0) {
          const word = payout[1].toLowerCase()
          const status = ['paid', 'processed', 'completed', 'sent'].includes(word)
            ? 'paid'
            : ['denied', 'declined'].includes(word)
              ? 'denied'
              : word === 'requested'
                ? 'requested'
                : 'approved'
          return [
            {
              ...base(context, 'payout', `${context.firm} payout $${amount} ${status}`),
              date: parseLooseDate(all) ?? context.fallbackDate,
              amount,
              currency: 'USD',
              status,
            },
          ]
        }
      }

      if (/congratulations[^.\n]{0,80}(pass(ed)?|funded)|you (have )?passed[^.\n]{0,40}(evaluation|combine|eval|challenge)/i.test(all)) {
        return [
          {
            ...base(context, 'account_status', `${context.firm}: evaluation passed`),
            accountExternalId: accountLike(all),
            status: 'passed',
          },
        ]
      }

      if (/(breach|violat)(ed|ion)?[^.\n]{0,60}(drawdown|loss limit|daily loss|rule)|account (has been )?(liquidated|deactivated|suspended|closed)/i.test(all)) {
        return [
          {
            ...base(context, 'account_status', trim(`${context.firm}: ${context.subject}`)),
            accountExternalId: accountLike(all),
            status: 'failed',
          },
        ]
      }

      if (/(order (confirmation|receipt)|invoice|payment (received|successful)|thank you for your (purchase|order))/i.test(all)) {
        const amount = parseMoney(/(?:^|[^a-z])total:?\s*\$?\s?([\d,]+\.\d{2})/i.exec(all)?.[1])
        if (amount !== undefined) {
          return [
            {
              ...base(context, 'purchase', trim(`${context.firm}: ${context.subject}`)),
              date: parseLooseDate(all) ?? context.fallbackDate,
              amount,
              currency: 'USD',
            },
          ]
        }
      }

      return []
    },
  },
]

/** Pulls an account-number-shaped token out of a body, if there is one. */
function accountLike(text: string): string | undefined {
  const labelled = /\bAccount(?: number| ID| #)?:?\s*([A-Z0-9][A-Z0-9-]{5,40})\b/i.exec(text)
  return labelled?.[1]
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Reads one email into zero or more journal events.
 *
 * Firm-specific rules run first and win; the generic rules only see mail that
 * nothing else claimed. Mail from a marketing sender, or from a domain the
 * journal does not track, produces nothing at all.
 */
export function classifyEmail(email: RawEmail): EmailEventDraft[] {
  if (isMarketingSender(email.from)) return []
  const firm = firmForSender(email.from)
  if (!firm) return []

  const body = stripLinks(email.text).slice(0, 8000)
  const context: RuleContext = {
    email,
    body,
    subject: email.subject ?? '',
    firm,
    fallbackDate: isoDate(email.receivedAt),
  }

  for (const rule of RULES) {
    if (rule.firm !== 'any' && rule.firm !== firm) continue
    const drafts = rule.run(context)
    if (drafts.length > 0) return drafts
  }

  return []
}

/**
 * Whether an unmatched email is worth spending an AI call on.
 *
 * The signal is money or account language in a message that is not a campaign.
 * Everything else — news warnings, webinars, "50% off" — is dropped for free.
 */
export function looksTransactional(email: RawEmail): boolean {
  if (isMarketingSender(email.from)) return false
  if (!firmForSender(email.from)) return false
  const all = `${email.subject}\n${stripLinks(email.text).slice(0, 3000)}`
  if (/unsubscribe from|% off|flash sale|webinar|giveaway|last chance/i.test(all)) return false
  return /\$\s?\d|payout|withdrawal|invoice|receipt|subscription|account (number|id)|balance|breach|passed|funded/i.test(all)
}
