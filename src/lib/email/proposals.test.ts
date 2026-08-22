import { describe, expect, it } from 'vitest'
import { describeProposal, proposalFor } from './proposals'
import type { EmailEventDraft } from './parse'

function draft(overrides: Partial<EmailEventDraft> = {}): EmailEventDraft {
  return {
    sourceId: 'msg-1',
    kind: 'note',
    summary: 'Something happened',
    date: '2026-08-22',
    ...overrides,
  }
}

describe('proposalFor', () => {
  it('turns a balance snapshot into a balance change', () => {
    const proposal = proposalFor(
      draft({
        kind: 'balance_snapshot',
        balance: 24_755,
        accountExternalId: 'LFE025-7TEP3J61-TEST002',
        firm: 'Lucid Trading',
        summary: 'Lucid daily snapshot LFE025-7TEP3J61-TEST002: $24755',
      }),
    )
    expect(proposal).toEqual({
      type: 'balance',
      externalId: 'LFE025-7TEP3J61-TEST002',
      firm: 'Lucid Trading',
      balance: 24_755,
      cutoff: '2026-08-22T23:59:00Z',
      summary: 'Lucid daily snapshot LFE025-7TEP3J61-TEST002: $24755',
    })
  })

  it('turns a pass or a blow-up into a status change', () => {
    expect(proposalFor(draft({ kind: 'account_status', status: 'passed' }))?.type).toBe(
      'account_status',
    )
    expect(proposalFor(draft({ kind: 'account_status', status: 'failed' }))).toMatchObject({
      status: 'failed',
    })
  })

  it('proposes nothing for an event that names no change', () => {
    expect(proposalFor(draft({ kind: 'note' }))).toBeNull()
    expect(proposalFor(draft({ kind: 'subscription' }))).toBeNull()
    // A status the journal does not model is not a change it can make.
    expect(proposalFor(draft({ kind: 'account_status', status: 'upgraded' }))).toBeNull()
    // A snapshot with no number in it is just an email.
    expect(proposalFor(draft({ kind: 'balance_snapshot' }))).toBeNull()
  })

  it('keeps a zero balance, which is a real reading and not a missing one', () => {
    expect(proposalFor(draft({ kind: 'balance_snapshot', balance: 0 }))).toMatchObject({
      balance: 0,
    })
  })

  it('normalises an absent account or firm to null rather than an empty string', () => {
    const proposal = proposalFor(
      draft({ kind: 'balance_snapshot', balance: 100, accountExternalId: '  ', firm: '' }),
    )
    expect(proposal).toMatchObject({ externalId: null, firm: null })
  })
})

describe('describeProposal', () => {
  it('says what applying it would do', () => {
    expect(
      describeProposal({
        type: 'balance',
        externalId: null,
        firm: null,
        balance: 24_755,
        cutoff: '2026-08-22T23:59:00Z',
        summary: '',
      }),
    ).toBe('Set the balance to $24,755, as of 2026-08-22')

    expect(
      describeProposal({
        type: 'account_status',
        externalId: null,
        firm: null,
        status: 'passed',
        summary: '',
      }),
    ).toBe('Mark the account passed')
  })
})
