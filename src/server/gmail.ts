import 'server-only'
import { ImapFlow, type ListResponse } from 'imapflow'
import { simpleParser } from 'mailparser'
import { readMailboxes, type Mailbox } from '@/lib/email/mailboxes'
import { gmailQuery, htmlToText, type RawEmail } from '@/lib/email/parse'

/**
 * Reads prop-firm mail over IMAP.
 *
 * Gmail's REST API would mean a Google Cloud project, an OAuth consent screen
 * and a refresh token that expires while the app is in testing — a setup that
 * breaks silently weeks later. An app password is two clicks in Google account
 * settings, works from any server, keeps working, and is revocable on its own
 * without touching the account. IMAP is also the same protocol for every other
 * mail provider, so a future non-Gmail inbox costs nothing.
 *
 * Read-only in the strongest sense the protocol offers: mailboxes are opened
 * with `readOnly: true`, so nothing here can mark, move or delete a message.
 */

export type { Mailbox } from '@/lib/email/mailboxes'

/** The inboxes this deployment is configured to read. */
export function mailboxes(): Mailbox[] {
  return readMailboxes(process.env).mailboxes
}

/** Configuration that looks intended but is unusable — shown in Settings. */
export function mailboxProblems(): string[] {
  return readMailboxes(process.env).problems
}

export function gmailConfigured(): boolean {
  return mailboxes().length > 0
}

/** Never let one huge run blow the function's time budget. */
const MAX_MESSAGES_PER_MAILBOX = 40

/**
 * Fetches messages from the tracked firms received in the last `days` days.
 *
 * Errors are returned rather than thrown: one inbox with a stale password must
 * not stop the other from being read, and the caller reports failures in the
 * run log where they are visible.
 */
export async function fetchRecentMail(days = 2): Promise<{ emails: RawEmail[]; errors: string[] }> {
  const emails: RawEmail[] = []
  const errors: string[] = []

  for (const box of mailboxes()) {
    try {
      emails.push(...(await fetchFromMailbox(box, days)))
    } catch (error) {
      errors.push(`${box.user}: ${error instanceof Error ? error.message.slice(0, 160) : 'IMAP failure'}`)
    }
  }

  // Two addresses on the same firm alert would otherwise be processed twice;
  // the Message-ID is identical across copies, so keeping the first wins.
  const seen = new Set<string>()
  return { emails: emails.filter((email) => !seen.has(email.id) && seen.add(email.id)), errors }
}

async function fetchFromMailbox(box: Mailbox, days: number): Promise<RawEmail[]> {
  const client = new ImapFlow({
    host: box.host,
    port: 993,
    secure: true,
    auth: { user: box.user, pass: box.password },
    logger: false,
    // A serverless invocation has a hard ceiling; failing fast leaves room for
    // the rest of the job to still record what it did manage to read.
    //
    // connectionTimeout is the one that matters and defaults to 90 seconds: a
    // host that blackholes port 993 — a firewalled network, a wrong IMAP_HOST —
    // hangs at TCP connect, which is before a greeting or socket timeout can
    // apply. Left at the default, the run and the Settings button both stall
    // past the function's own limit and report nothing at all.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 25_000,
  })

  await client.connect()
  try {
    const path = await allMailPath(client)
    const lock = await client.getMailboxLock(path, { readOnly: true })
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const uids = await search(client, days, since)
      const recent = uids.slice(-MAX_MESSAGES_PER_MAILBOX)
      if (recent.length === 0) return []

      const emails: RawEmail[] = []
      for await (const message of client.fetch(
        recent,
        { uid: true, source: true, envelope: true },
        { uid: true },
      )) {
        const email = await toRawEmail(message.source, message.envelope, box.user, message.uid)
        if (email) emails.push(email)
      }
      return emails
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/**
 * Prefers Gmail's All Mail folder so an archived alert is still read.
 *
 * Its name is localised, so it is found by the `\All` special-use flag rather
 * than by path; anything else (including non-Gmail IMAP) falls back to INBOX.
 */
async function allMailPath(client: ImapFlow): Promise<string> {
  try {
    const boxes: ListResponse[] = await client.list()
    const all = boxes.find((entry) => entry.specialUse === '\\All')
    if (all?.path) return all.path
  } catch {
    // Fall through to INBOX.
  }
  return 'INBOX'
}

/**
 * Finds the candidate messages.
 *
 * Gmail exposes its own search through the X-GM-EXT-1 capability, which lets
 * the *server* apply the same query the rest of this feature is written
 * against — far cheaper than downloading a fortnight of mail to filter it
 * here. Any other server (or a Gmail account with the extension disabled)
 * falls back to a date search, and the sender filter happens in the parser.
 */
async function search(client: ImapFlow, days: number, since: Date): Promise<number[]> {
  if (client.capabilities.has('X-GM-EXT-1')) {
    try {
      const uids = await client.search({ gmraw: gmailQuery(days) }, { uid: true })
      if (uids) return uids
    } catch {
      // Fall through to the portable search.
    }
  }
  return (await client.search({ since }, { uid: true })) || []
}

async function toRawEmail(
  source: Buffer | undefined,
  envelope: { messageId?: string; subject?: string; date?: Date; from?: { address?: string }[] } | undefined,
  mailboxUser: string,
  uid: number,
): Promise<RawEmail | null> {
  if (!source) return null
  // skipHtmlToText keeps mailparser's own HTML-to-text conversion out of the
  // path: it pulls in html-to-text, which carries a stack-exhaustion advisory,
  // and the fallback below is a tested twenty-line function over the same
  // input. mailparser is still doing the part that is genuinely hard — MIME
  // structure, transfer encodings, charsets.
  const parsed = await simpleParser(source, {
    skipImageLinks: true,
    skipTextToHtml: true,
    skipHtmlToText: true,
  })

  const from =
    parsed.from?.value?.[0]?.address ?? envelope?.from?.[0]?.address ?? ''
  const text = parsed.text ?? (typeof parsed.html === 'string' ? htmlToText(parsed.html) : '')
  if (!from || !text) return null

  // The Message-ID is the same string in every copy of a message and survives
  // being moved between folders, which a UID does not — and this id is the
  // dedupe key that stops an event being applied twice.
  const messageId = (parsed.messageId ?? envelope?.messageId ?? '').replace(/[<>]/g, '').trim()

  return {
    id: messageId || `${mailboxUser}:${uid}`,
    from,
    subject: parsed.subject ?? envelope?.subject ?? '',
    text,
    receivedAt: parsed.date ?? envelope?.date ?? new Date(),
  }
}
