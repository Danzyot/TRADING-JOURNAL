import { describe, expect, it } from 'vitest'
import { buildEmailPrompt, parseEmailEvents } from './ai'
import type { RawEmail } from './parse'

const email: RawEmail = {
  id: 'abc123',
  from: 'noreply@topstep.com',
  subject: 'Payout processed',
  text: 'Your payout of $2,750 was processed. Visit [dashboard](https://topstep.com/x) for details.',
  receivedAt: new Date('2026-08-20T10:00:00Z'),
}

describe('buildEmailPrompt', () => {
  it('includes the headers and a link-stripped body', () => {
    const prompt = buildEmailPrompt(email)
    expect(prompt).toContain('From: noreply@topstep.com')
    expect(prompt).toContain('Received: 2026-08-20')
    expect(prompt).toContain('dashboard')
    expect(prompt).not.toContain('https://topstep.com/x')
  })
})

describe('parseEmailEvents', () => {
  it('reads a well-formed event and stamps the firm', () => {
    const [event] = parseEmailEvents(
      '[{"kind":"payout","summary":"Topstep payout paid","date":"2026-08-19","amount":"2,750","status":"paid"}]',
      email,
      'Topstep',
    )

    expect(event).toMatchObject({
      sourceId: 'abc123',
      kind: 'payout',
      amount: 2750,
      status: 'paid',
      date: '2026-08-19',
      firm: 'Topstep',
      currency: 'USD',
    })
  })

  it('drops a payout with no amount rather than inventing one', () => {
    expect(parseEmailEvents('[{"kind":"payout","summary":"a payout happened"}]', email)).toEqual([])
  })

  it('drops a balance snapshot with no balance', () => {
    expect(parseEmailEvents('[{"kind":"balance_snapshot","summary":"balance"}]', email)).toEqual([])
  })

  it('drops an unknown kind', () => {
    expect(parseEmailEvents('[{"kind":"invoice_maybe","summary":"?"}]', email)).toEqual([])
  })

  it('falls back to the received date when the model states none', () => {
    const [event] = parseEmailEvents('[{"kind":"note","summary":"account activated"}]', email)
    expect(event.date).toBe('2026-08-20')
  })

  it('keeps sourceIds unique when one email yields several events', () => {
    const events = parseEmailEvents(
      '[{"kind":"note","summary":"one"},{"kind":"note","summary":"two"}]',
      email,
    )
    expect(events.map((event) => event.sourceId)).toEqual(['abc123', 'abc123:ai1'])
  })

  it('returns nothing for an empty array or unparseable reply', () => {
    expect(parseEmailEvents('[]', email)).toEqual([])
    expect(parseEmailEvents('I could not read that email.', email)).toEqual([])
  })

  it('handles the model wrapping its JSON in prose', () => {
    const events = parseEmailEvents(
      'Here you go:\n```json\n[{"kind":"note","summary":"ID verification required"}]\n```',
      email,
    )
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe('ID verification required')
  })
})
