import { describe, expect, it } from 'vitest'
import { readMailboxes } from './mailboxes'

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
