/**
 * Works out which inboxes the email automation should read.
 *
 * Prop-firm accounts spread across addresses — one signed up with years ago,
 * one opened for a firm that would not take a duplicate email — so more than
 * one mailbox is the normal case, not an edge case.
 *
 * Three ways to declare them are accepted, because a deployment already
 * configured one way should never have to be re-typed:
 *
 *   GMAIL_USER / GMAIL_APP_PASSWORD              a single inbox
 *   GMAIL_USER_1 / GMAIL_APP_PASSWORD_1, _2, …   numbered pairs
 *   GMAIL_ACCOUNTS                               address:password, one per line
 *
 * Pure, so the rules above are testable without a mail server: the caller
 * hands in `process.env`.
 */

export type Mailbox = { user: string; password: string; host: string }

export type MailboxConfig = {
  mailboxes: Mailbox[]
  /**
   * Configuration that looks intended but cannot be used — an address with no
   * password, or the reverse. Surfaced in Settings, because the alternative is
   * an inbox silently never being read.
   */
  problems: string[]
}

/** How many numbered pairs to look for. Well past anyone's account count. */
const MAX_NUMBERED = 10

type Env = Record<string, string | undefined>

const clean = (value: string | undefined): string => (value ?? '').trim()

/** Google displays app passwords in groups of four; the spaces are cosmetic. */
const cleanPassword = (value: string | undefined): string => clean(value).replace(/\s+/g, '')

export function readMailboxes(env: Env): MailboxConfig {
  const host = clean(env.IMAP_HOST) || 'imap.gmail.com'
  const mailboxes: Mailbox[] = []
  const problems: string[] = []
  const seen = new Set<string>()

  const add = (user: string, password: string, source: string) => {
    if (!user && !password) return
    if (!user || !password) {
      problems.push(
        user
          ? `${source}: no password for ${user}`
          : `${source}: a password with no address`,
      )
      return
    }
    const key = user.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    mailboxes.push({ user, password, host })
  }

  add(clean(env.GMAIL_USER), cleanPassword(env.GMAIL_APP_PASSWORD), 'GMAIL_USER')

  for (let index = 1; index <= MAX_NUMBERED; index++) {
    const user = clean(env[`GMAIL_USER_${index}`])
    // GMAIL_PASSWORD_n is accepted as well: it is the name people reach for,
    // and a mailbox that goes unread because of a variable name is a bad way
    // to find that out.
    const password = cleanPassword(
      env[`GMAIL_APP_PASSWORD_${index}`] ?? env[`GMAIL_PASSWORD_${index}`],
    )
    add(user, password, `GMAIL_USER_${index}`)
  }

  for (const entry of clean(env.GMAIL_ACCOUNTS).split(/[\n,]+/)) {
    const line = entry.trim()
    if (!line) continue
    // Split on the *first* colon: an address never contains one, and a
    // password on a non-Gmail host might, so everything after it is the
    // password.
    const at = line.indexOf(':')
    if (at < 1) {
      problems.push(`GMAIL_ACCOUNTS: "${line.slice(0, 40)}" is not address:password`)
      continue
    }
    add(line.slice(0, at).trim(), cleanPassword(line.slice(at + 1)), 'GMAIL_ACCOUNTS')
  }

  return { mailboxes, problems }
}
