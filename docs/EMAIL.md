# Email automation

Prop firms announce almost everything by email: a payout is requested,
approved and paid; an evaluation is bought, passed or blown; a subscription
renews; a daily balance lands every evening. Typing all of that into a journal
by hand is exactly the work the journal exists to remove.

So the app reads the mail itself, on the server, on a schedule. Nothing runs on
your computer, and nothing depends on a chat session being open.

## What it logs

| Email | What happens in the journal |
| --- | --- |
| Payout requested / approved / paid / denied | A payout row on **Earnings**, with the amount, the firm and the right status |
| Order receipt, activation or evaluation fee | An expense, categorised `eval_fee` and marked deductible at the usual rate |
| Account passed | The account's status becomes `passed` |
| Breach, liquidation, deactivation | The account's status becomes `failed` |
| Lucid Daily Wire (and similar snapshots) | The account's balance, if the email is newer than the balance already stored |
| Subscription started, cancelled or due | Recorded in the log — no money moves until you say so |

Firms covered by name today: Apex, Topstep, Lucid, MyFundedFutures, Take Profit
Trader, FundedNext, Alpha Futures, Tradeify, Bulenox, Elite. Any firm in that
list is also covered by generic payout/pass/fail/receipt patterns, so a
template change degrades rather than breaks.

Marketing is dropped before anything else runs — campaign senders (`team@`,
`updates@`, `send.` subdomains), sale announcements, webinars, news warnings and
support-ticket replies never produce an event.

## Setting it up

1. **Create a Google app password.** Turn on 2-Step Verification for the
   account, then go to
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   and create one. Google shows sixteen characters once.
2. **Add it to the app.** In Vercel → Settings → Environment Variables, add
   `GMAIL_USER` (the address) and `GMAIL_APP_PASSWORD` (those sixteen
   characters), scoped to Production, then redeploy. A second inbox goes in
   `GMAIL_ACCOUNTS` as `address:apppassword`, one per line.
3. **Turn on the hourly beat.** In the GitHub repository → Settings → Secrets
   and variables → Actions, add `JOURNAL_URL` (`https://your-app.vercel.app`)
   and `CRON_SECRET` (the same value the app uses). The `Email ingest` workflow
   then runs every hour.
4. **Backfill.** Open **Settings** in the app and press *Backfill 30 days*.

Step 3 is optional: the daily cron reads the mail too, so skipping it costs
frequency, not function.

An app password is used rather than the Gmail API because the API path means a
Google Cloud project, an OAuth consent screen and a refresh token that expires
after a week while the app is unverified — a setup that breaks silently a month
later. The app password keeps working, is revocable on its own, and reads any
IMAP mailbox, not just Gmail.

## How it works

```
IMAP (read-only)  →  rules  →  AI fallback  →  effects  →  email_events
```

- **Reading** (`src/server/gmail.ts`) opens Gmail's All Mail folder read-only
  and asks the *server* to run the search, using Gmail's own query syntax over
  the X-GM-EXT-1 capability. Only mail from tracked firms in the last two days
  comes back.
- **Rules** (`src/lib/email/parse.ts`) are pure functions with no clock and no
  database, tested against real messages from the inbox. Each is anchored on
  the line carrying the fact — an amount, an account number, a balance — not on
  the wording around it. Anything unrecognised produces nothing.
- **The AI fallback** (`src/lib/email/ai.ts`) sees only what the rules could not
  read *and* that still looks like it carries money or an account change, at
  most six messages a run, and only when `ANTHROPIC_API_KEY` is set. Its reply
  is validated field by field; a payout with no amount is dropped rather than
  guessed at.
- **Effects** are grouped by kind and written in batches, because the database
  is a network hop away.
- **`email_events`** records every applied event against the email's
  `Message-ID`. That is what makes the whole thing re-runnable: the hourly job
  reads a two-day window on purpose, so any outage shorter than two days heals
  itself, and re-reading costs one indexed lookup per message.

Two rules protect data that already exists: a balance snapshot only ever moves
a balance *forward* in time, so a late-processed old email cannot overwrite a
fresher figure from broker sync; and an event whose firm or account is not in
the journal yet is recorded in the log without creating anything.

## Running it by hand

```bash
# The scheduled job, on demand.
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/email?days=2"

# Backfill a wider window (safe — deduped).
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/email?days=30"
```

Or post events extracted somewhere else — a mail webhook, a forwarder — to
`/api/ingest/email` with `CRON_SECRET` or `INGEST_SECRET`:

```json
{ "events": [
  { "sourceId": "unique-id", "kind": "payout", "summary": "Apex payout paid",
    "date": "2026-08-21", "firm": "Apex", "amount": 1500, "status": "paid" }
] }
```

## When something looks wrong

Every run is in **Settings → Recent automated runs** as `cron_email`, with how
many emails were scanned, how many events were applied and how many were
already known. `applied=0 skipped=12` is the normal steady state: the window
overlaps, and nothing new arrived.

- *Nothing at all is found* — check `GMAIL_USER`/`GMAIL_APP_PASSWORD` are in
  the Production scope and the app has been redeployed since.
- *`Invalid credentials`* — the app password was revoked, or 2-Step
  Verification was turned off, which revokes them all.
- *An event landed on the wrong account* — accounts are matched on the external
  id or label written in the email. Set the account's **Broker id** on the
  Accounts page to the id the firm uses.
