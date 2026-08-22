import { describe, expect, it } from 'vitest'
import { explainMailError, readMailboxes } from './mailboxes'

const users = (env: Record<string, string | undefined>) =>
  readMailboxes(env).mailboxes.map((box) => box.user)

describe('readMailboxes', () => {
  it('reads a single inbox', () => {
    const { mailboxes, problems } = readMailboxes({
      GMAIL_USER: 'yotdanz@gmail.com',
      GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
    })

    expect(mailboxes).toEqual([
      { user: 'yotdanz@gmail.com', password: 'abcdefghijklmnop', host: 'imap.gmail.com' },
    ])
    expect(problems).toEqual([])
  })

  it('reads numbered pairs', () => {
    expect(
      users({
        GMAIL_USER_1: 'yotdanz@gmail.com',
        GMAIL_APP_PASSWORD_1: 'aaaabbbbccccdddd',
        GMAIL_USER_2: 'pikedrop2@gmail.com',
        GMAIL_APP_PASSWORD_2: 'eeeeffffgggghhhh',
      }),
    ).toEqual(['yotdanz@gmail.com', 'pikedrop2@gmail.com'])
  })

  it('accepts GMAIL_PASSWORD_n as well as GMAIL_APP_PASSWORD_n', () => {
    expect(users({ GMAIL_USER_1: 'a@gmail.com', GMAIL_PASSWORD_1: 'pw' })).toEqual(['a@gmail.com'])
  })

  it('combines every form and keeps the first copy of a repeated address', () => {
    expect(
      users({
        GMAIL_USER: 'one@gmail.com',
        GMAIL_APP_PASSWORD: 'pw1',
        GMAIL_USER_1: 'ONE@gmail.com',
        GMAIL_APP_PASSWORD_1: 'pw-again',
        GMAIL_USER_2: 'two@gmail.com',
        GMAIL_APP_PASSWORD_2: 'pw2',
        GMAIL_ACCOUNTS: 'three@gmail.com:pw3',
      }),
    ).toEqual(['one@gmail.com', 'two@gmail.com', 'three@gmail.com'])
  })

  it('reports an address with no password instead of skipping it silently', () => {
    const { mailboxes, problems } = readMailboxes({
      GMAIL_USER_1: 'yotdanz@gmail.com',
      GMAIL_APP_PASSWORD_1: 'aaaabbbbccccdddd',
      GMAIL_USER_2: 'pikedrop2@gmail.com',
    })

    expect(mailboxes).toHaveLength(1)
    expect(problems).toEqual(['GMAIL_USER_2: no password for pikedrop2@gmail.com'])
  })

  it('reports a malformed GMAIL_ACCOUNTS line', () => {
    expect(readMailboxes({ GMAIL_ACCOUNTS: 'not-a-pair' }).problems).toEqual([
      'GMAIL_ACCOUNTS: "not-a-pair" is not address:password',
    ])
  })

  it('splits an account line on the last colon, so a password may contain one', () => {
    const [box] = readMailboxes({ GMAIL_ACCOUNTS: 'a@gmail.com:pw:with:colons' }).mailboxes
    expect(box).toMatchObject({ user: 'a@gmail.com', password: 'pw:with:colons' })
  })

  it('honours a non-Gmail IMAP host', () => {
    const [box] = readMailboxes({
      GMAIL_USER: 'me@fastmail.com',
      GMAIL_APP_PASSWORD: 'pw',
      IMAP_HOST: 'imap.fastmail.com',
    }).mailboxes
    expect(box.host).toBe('imap.fastmail.com')
  })

  it('finds nothing when nothing is configured', () => {
    expect(readMailboxes({})).toEqual({ mailboxes: [], problems: [] })
  })
})

describe('quoted values', () => {
  it('drops quotes pasted from documentation into a hosting dashboard', () => {
    const { mailboxes, problems } = readMailboxes({
      GMAIL_USER_1: '"yotdanz@gmail.com"',
      GMAIL_APP_PASSWORD_1: '"abcd efgh ijkl mnop"',
    })

    expect(mailboxes[0]).toMatchObject({
      user: 'yotdanz@gmail.com',
      password: 'abcdefghijklmnop',
    })
    expect(problems).toEqual([])
  })

  it('keeps a quote that is genuinely part of a password', () => {
    const [box] = readMailboxes({ GMAIL_USER: 'a@b.com', GMAIL_APP_PASSWORD: 'pw"word' }).mailboxes
    expect(box.password).toBe('pw"word')
  })
})

describe('explainMailError', () => {
  it('explains rejected credentials with the address that failed', () => {
    const message = explainMailError('pikedrop2@gmail.com', 'Invalid credentials (Failure)')
    expect(message).toContain('pikedrop2@gmail.com')
    expect(message).toContain('created in')
  })

  it('spots the account password being used instead of an app password', () => {
    expect(explainMailError('a@b.com', 'Application-specific password required')).toContain(
      'apppasswords',
    )
  })

  it('explains an unreachable server', () => {
    expect(explainMailError('a@b.com', 'Failed to establish connection in required time')).toContain(
      'could not reach',
    )
  })

  it('passes an unrecognised failure through, still naming the address', () => {
    expect(explainMailError('a@b.com', 'Something odd')).toBe('a@b.com: Something odd')
  })
})
