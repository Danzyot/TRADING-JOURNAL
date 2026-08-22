/**
 * What an email event would change, when the journal cannot be sure by itself.
 *
 * The ingest applies what it can prove: an email naming an account it can find
 * updates that account, and a payout email books a payout. Everything else used
 * to be logged and dropped — the line in the log said "Lucid daily snapshot
 * LFE025-7TEP3J61-TEST002: $24,755" and nothing anywhere moved, because no
 * account in the journal carries that id.
 *
 * A proposal is that same reading, kept: the change it would make, and the
 * identifier it could not resolve, so it can be offered as "apply this to which
 * account?" rather than thrown away. Pure and separately tested, because the
 * decision of what an email *means* is the part worth being sure about.
 */
import type { EmailEventDraft } from './parse'

export type EmailProposal =
  | {
      type: 'balance'
      /** What the email called the account. */
      externalId: string | null
      firm: string | null
      balance: number
      /** End of the day the email describes; a balance never moves backwards. */
      cutoff: string
      summary: string
    }
  | {
      type: 'account_status'
      externalId: string | null
      firm: string | null
      status: 'passed' | 'failed' | 'closed' | 'paused'
      summary: string
    }

const STATUSES = ['passed', 'failed', 'closed', 'paused'] as const

/**
 * The change an unresolved event is asking for, or null when it is only news.
 *
 * "Evaluation passed" with no account named is a real proposal — the trader
 * knows which account it was. "Your subscription renews on the 4th" is not: it
 * names no change to make.
 */
export function proposalFor(draft: EmailEventDraft): EmailProposal | null {
  const externalId = draft.accountExternalId?.trim() || null
  const firm = draft.firm?.trim() || null

  if (draft.kind === 'balance_snapshot' && typeof draft.balance === 'number') {
    return {
      type: 'balance',
      externalId,
      firm,
      balance: draft.balance,
      cutoff: `${draft.date}T23:59:00Z`,
      summary: draft.summary,
    }
  }

  if (draft.kind === 'account_status') {
    const status = STATUSES.find((candidate) => candidate === draft.status)
    if (status) return { type: 'account_status', externalId, firm, status, summary: draft.summary }
  }

  return null
}

/** One line saying what pressing Apply would do. */
export function describeProposal(proposal: EmailProposal, currency = 'USD'): string {
  if (proposal.type === 'balance') {
    const amount = proposal.balance.toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
    return `Set the balance to ${amount}, as of ${proposal.cutoff.slice(0, 10)}`
  }
  return `Mark the account ${proposal.status}`
}
