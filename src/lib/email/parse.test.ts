import { describe, expect, it } from 'vitest'
import {
  classifyEmail,
  gmailQuery,
  htmlToText,
  looksTransactional,
  parseLooseDate,
  parseMoney,
  type RawEmail,
} from './parse'

/**
 * Every fixture below is a real message from the user's inbox (August 2026),
 * trimmed to the part a rule reads. Rules written against invented email text
 * pass their tests and fail on the first real inbox, so these stay verbatim.
 */

const email = (overrides: Partial<RawEmail> & Pick<RawEmail, 'from' | 'subject' | 'text'>): RawEmail => ({
  id: 'msg1',
  receivedAt: new Date('2026-08-21T21:40:40Z'),
  ...overrides,
})

describe('classifyEmail — Apex', () => {
  it('reads an approved payout, with the date the email states', () => {
    const [event] = classifyEmail(
      email({
        from: 'noreply@apextraderfunding.com',
        subject: 'PA Payout Approved',
        text: 'Hi,\n\nYour requested PA Payout for $1500 has been approved on Aug 21, 2026.\nFunds will be sent within 3–4 business days.',
      }),
    )

    expect(event).toMatchObject({
      kind: 'payout',
      firm: 'Apex Trader Funding',
      amount: 1500,
      status: 'approved',
      date: '2026-08-21',
      currency: 'USD',
    })
  })

  it('reads a deactivated performance account as a failure', () => {
    const [event] = classifyEmail(
      email({
        from: 'noreply@apextraderfunding.com',
        subject: 'Your Performance Account has been deactivated for Apex Trader Funding',
        text: 'We are so sorry your Performance Account PA-APEX-563301-29 was closed today. The two reasons an account can be liquidated is you had trades',
      }),
    )

    expect(event).toMatchObject({
      kind: 'account_status',
      status: 'failed',
      accountExternalId: 'PA-APEX-563301-29',
    })
  })

  it('reads a cancelled subscription with its plan name', () => {
    const [event] = classifyEmail(
      email({
        from: 'noreply@apextraderfunding.com',
        subject: 'Apex Trader Platform: Subscription cancelled',
        text: 'Your subscription to "100k PA Tradovate Intraday Activation Account Lifetime Fee" is cancelled. Invoice number: 6QWKKUC',
      }),
    )

    expect(event.kind).toBe('subscription')
    expect(event.status).toBe('cancelled')
    expect(event.summary).toContain('100k PA Tradovate Intraday')
  })

  it('ignores helpdesk ticket mail', () => {
    expect(
      classifyEmail(
        email({
          from: 'customer-support@helpdesk.apextraderfunding.com',
          subject: 'Re: PAYOUT NOT PAID',
          text: 'Once a payout request is submitted, it is reviewed by Apex within 2 business days. If approved, $1500 is sent.',
        }),
      ),
    ).toEqual([])
  })
})

describe('classifyEmail — Lucid daily wire', () => {
  it('reads the eval snapshot', () => {
    const [event] = classifyEmail(
      email({
        from: 'admin@lucidtrading.com',
        subject: 'LucidEval Daily Wire',
        text: 'LucidEval YOUR DAILY SNAPSHOT 8/20/2026\nAccount Number: LFE025-EYPW9158-TEST003\nAccount Balance $24577\nTotal Profit -$424\nSession PnL -$487\nDays Traded 4\nProfit Target $1260\nMinimum Balance $24492',
      }),
    )

    expect(event).toMatchObject({
      kind: 'balance_snapshot',
      accountExternalId: 'LFE025-EYPW9158-TEST003',
      balance: 24577,
      date: '2026-08-20',
    })
  })

  it('splits a funded wire that covers several accounts into one event each', () => {
    const events = classifyEmail(
      email({
        id: 'wire9',
        from: 'admin@lucidtrading.com',
        subject: 'LucidFunded Daily Wire',
        text: [
          'LucidFunded',
          'Your Daily Snapshot · 8/14/2026',
          'Funded Account Snapshot — LTF150-6S74MR9Y-PRO001',
          'Account Balance',
          '$150,159',
          'Total Profit',
          '$159',
          'Funded Account Snapshot — LFF050-H517UPC2-PRO001',
          'Account Balance',
          '$48,178',
          'Total Profit',
          '-$1,822',
        ].join('\n'),
      }),
    )

    expect(events).toHaveLength(2)
    expect(events.map((event) => event.accountExternalId)).toEqual([
      'LTF150-6S74MR9Y-PRO001',
      'LFF050-H517UPC2-PRO001',
    ])
    expect(events.map((event) => event.balance)).toEqual([150159, 48178])
    // One email, two events: the dedupe key has to stay unique per account.
    expect(new Set(events.map((event) => event.sourceId)).size).toBe(2)
    expect(events[0].sourceId).toBe('wire9:LTF150-6S74MR9Y-PRO001')
  })

  it('takes the discounted total from an order, not the subtotal', () => {
    const [event] = classifyEmail(
      email({
        from: 'support@lucidtrading.com',
        subject: 'Lucid Trading - Order Processing',
        text: '| # Order Processing |\n| ### Order number: 8472684 | ### Order date: August 16, 2026 |\n| Product | Quantity | Price |\n| LucidFlex 25K Rithmic | 1 | $79.00 |\n| Subtotal: | $79.00 |\n| Discount: | -$79.00 |\n| Total: | $0.00 |',
      }),
    )

    expect(event).toMatchObject({ kind: 'purchase', amount: 0, date: '2026-08-16' })
    expect(event.summary).toContain('LucidFlex 25K Rithmic')
  })

  it('ignores the recurring news warning', () => {
    expect(
      classifyEmail(
        email({
          from: 'admin@lucidtrading.com',
          subject: 'Tier 1 News Warning',
          text: 'Red folder news trading is not permitted on Lucid Daily. Review the restricted windows before you trade.',
        }),
      ),
    ).toEqual([])
  })
})

describe('classifyEmail — other firms', () => {
  it('reads a MyFundedFutures cancellation with its account id', () => {
    const [event] = classifyEmail(
      email({
        from: 'support@myfundedfutures.com',
        subject: 'Your Subscription Has Been Cancelled',
        text: 'Your subscription for your Tradovate $ account has been cancelled. Account ID: MFFUEVPRO499319006 Cancelation Reason:',
      }),
    )

    expect(event).toMatchObject({
      kind: 'subscription',
      status: 'cancelled',
      accountExternalId: 'MFFUEVPRO499319006',
    })
  })

  it('records a renewal notice without treating it as a payment', () => {
    const [event] = classifyEmail(
      email({
        from: 'support@myfundedfutures.com',
        subject: '[Action Needed] Your Account Requires Renewal',
        text: 'Your account is due for a renewal! Account ID: MFFUEVRPD499319007 Renewal Price: 97.00',
      }),
    )

    expect(event).toMatchObject({ kind: 'subscription', status: 'renewal_due', amount: 97 })
  })

  it('reads a Take Profit Trader cancellation', () => {
    const [event] = classifyEmail(
      email({
        from: 'support@takeprofittrader.com',
        subject: 'Take Profit Trader - Your Subscription Has Been Cancelled',
        text: 'This is a confirmation that your subscription has been cancelled for TAKEPROFIT236411531 Your user will continue to have access until the end of the billing period.',
      }),
    )

    expect(event).toMatchObject({ kind: 'subscription', accountExternalId: 'TAKEPROFIT236411531' })
  })

  it('reads an Alpha Futures breach', () => {
    const [event] = classifyEmail(
      email({
        from: 'info@alpha-futures.com',
        subject: 'Account Suspension Notice - Details Regarding the Breach',
        text: 'Unfortunately it has come to our attention that the Maximum Loss Limit on your 50K Evaluation has been breached. Account number ADVEV2026071701718 has violated Maximum Loss.',
      }),
    )

    expect(event).toMatchObject({
      kind: 'account_status',
      status: 'failed',
      accountExternalId: 'ADVEV2026071701718',
    })
    expect(event.summary).toContain('Maximum Loss')
  })

  it('falls back to the generic payout rule for a firm with no rules of its own', () => {
    const [event] = classifyEmail(
      email({
        from: 'noreply@topstep.com',
        subject: 'Your payout request has been approved',
        text: 'Good news — your withdrawal of $2,750.00 has been approved and will be processed shortly.',
      }),
    )

    expect(event).toMatchObject({ kind: 'payout', amount: 2750, status: 'approved', firm: 'Topstep' })
  })
})

describe('noise', () => {
  it.each([
    ['support@send.myfundedfutures.com', 'How to find free evals', 'Pack 2 is ready to open'],
    ['team@takeprofittrader.com', '⏰ Only 3 Days Left', '50% off is ending soon…'],
    ['updates@fundednext.com', 'How a $40,000 payout changed Michael’s family forever', 'Last week was packed with major updates'],
  ])('drops marketing from %s', (from, subject, text) => {
    expect(classifyEmail(email({ from, subject, text }))).toEqual([])
    expect(looksTransactional(email({ from, subject, text }))).toBe(false)
  })

  it('drops mail from a domain the journal does not track', () => {
    expect(
      classifyEmail(email({ from: 'billing@some-broker.com', subject: 'Invoice', text: 'Total: $99.00' })),
    ).toEqual([])
  })

  it('flags an unmatched but money-shaped message for the AI pass', () => {
    expect(
      looksTransactional(
        email({
          from: 'support@fundednext.com',
          subject: 'Your account update',
          text: 'Your account ADV123456 balance is now $52,300 following your recent activity.',
        }),
      ),
    ).toBe(true)
  })
})

describe('helpers', () => {
  it('parses both date shapes firms use', () => {
    expect(parseLooseDate('approved on Aug 21, 2026.')).toBe('2026-08-21')
    expect(parseLooseDate('Order date: August 16, 2026')).toBe('2026-08-16')
    expect(parseLooseDate('YOUR DAILY SNAPSHOT 8/20/2026')).toBe('2026-08-20')
    expect(parseLooseDate('no date here')).toBeNull()
  })

  it('parses money with separators and signs', () => {
    expect(parseMoney('$1,500.00')).toBe(1500)
    expect(parseMoney('-$424')).toBe(-424)
    expect(parseMoney('97.00')).toBe(97)
    expect(parseMoney(undefined)).toBeUndefined()
    expect(parseMoney('n/a')).toBeUndefined()
  })

  it('reduces an HTML body to readable text', () => {
    expect(htmlToText('<div>Balance<br/>$24,577</div><style>p{}</style>')).toBe('Balance\n$24,577')
  })

  it('builds a Gmail query covering every tracked firm', () => {
    const query = gmailQuery(3)
    expect(query).toContain('from:apextraderfunding.com')
    expect(query).toContain('from:alpha-futures.com')
    expect(query).toContain('newer_than:3d')
  })
})
