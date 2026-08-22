# The demo

A public copy of the app that anyone can look around without a password, and
without seeing a single row of your data.

It is a **second deployment**, not a second door into your own. That is the
whole design: the demo process holds no connection string at all, so there is no
per-visitor switch to get wrong and no request that could return your trades to
a stranger. Your deployment keeps its password and never runs in this mode.

What the demo does:

- lets every page through with no sign-in
- refuses every save with *"This is the demo — nothing you change here is
  saved."* — the forms are half of what there is to show, so they stay
- says what it is, on every page, in a strip across the top
- hides Sign out and the wording-editor pencil, which have nothing to act on
- runs its own Postgres inside the serverless function and fills it on first
  boot: an account, 90 days of trades, two payouts, some costs, a subscription
  and a trading model

---

## Setting it up (~2 minutes)

**1. A second Vercel project.** Import the same repository again
(Vercel → Add New → Project → the same repo) and name it something like
`yot-trading-journal-demo`. Give it **one** environment variable:

| Variable | Value |
|---|---|
| `DEMO_MODE` | `1` |

That is genuinely all. **No database** — the demo runs Postgres inside its own
process (see below) — and no `APP_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`,
Gmail or `ANTHROPIC_API_KEY`. A demo with the scheduled jobs and the inbox
reader switched off is the point, and giving it no credentials at all is how
they stay off.

> **If Vercel offers to copy the other project's environment variables, decline
> — or delete `APP_PASSWORD` afterwards.** A deployment that has a password is
> treated as a private one no matter what `DEMO_MODE` says, so the demo would
> simply keep asking for a password. Its login page tells you when that has
> happened. This is deliberate: the one accident worth engineering against is
> `DEMO_MODE` ending up on the deployment that holds your data, and this makes
> that accident harmless.

**2. Point your login page at it.** On your *real* project, add:

| Variable | Value |
|---|---|
| `DEMO_URL` | `https://yot-trading-journal-demo.vercel.app` |

Redeploy, and a **View demo** button appears under the password field. Without
this variable there is no button — a link to a demo nobody deployed is worse
than no link.

Both projects track the same branch, so a push updates the demo along with the
real thing.

---

## Where its data lives

The demo has no database of its own to create, because it *is* one: with
`DEMO_MODE=1` and no `DATABASE_URL`, the app starts PGlite — real PostgreSQL 18
compiled to WebAssembly — inside the serverless function, migrates it, and seeds
it. The first request an instance serves takes about three seconds; every
request after that is normal speed.

Because every visitor gets the same sample data and nothing there can be
changed, the demo's pages are marked `public, s-maxage=3600,
stale-while-revalidate=86400`, so Vercel's CDN answers them without waking a
function at all. The first visit after a deploy pays the boot; the rest are
served from the edge, and the hourly refresh happens behind someone else's fast
response. That header is emitted **only** by a build with `DEMO_MODE=1` and no
`APP_PASSWORD` — the same fail-closed rule as everywhere else, because a
deployment holding real data must never mark a page `public`.

Three consequences worth knowing:

- **Nothing persists.** The database lives in that instance's temporary
  directory and disappears with it. Anyone who finds a way to change something
  gets it back the way it was, on the next instance.
- **Nothing to reset.** There is no leftover state to clean up, ever.
- **No credentials.** The demo process holds no connection string, so it cannot
  reach your data even in principle.
- **A cold visit is slow.** Booting Postgres inside a function takes a few
  seconds, and a demo nobody visits is nearly always cold. The edge cache above
  hides that from everyone but the first visitor; if you would rather it never
  happen at all, give the demo project its own `DATABASE_URL` (a separate Neon
  database, never yours) and the boot becomes an ordinary connection.

If you ever want the demo to keep what people do to it, give that project a
`DATABASE_URL` of its own — a separate Neon database, never yours — and it will
use that instead, migrating and seeding it the same way.

---

## Options

| Variable | Effect |
|---|---|
| `DEMO_MODE=1` | Turns a deployment into the demo. Only the exact string `1` counts, and it is ignored on any deployment that also has an `APP_PASSWORD`. |
| `DEMO_SEED=0` | Leaves the demo's database empty instead of seeding it. Every page becomes its empty state, which is honest but shows very little. |
| `DATABASE_URL` | Optional on a demo. Set it and the demo uses that database (and keeps what happens in it) instead of the in-process one. Never point it at your own database. |
| `DEMO_URL` | On the real deployment: the address the View demo button opens. Must be an absolute `http(s)` URL. |

---

## Resetting it

There is nothing to reset — see *Where its data lives* above. Each serverless
instance builds its own copy from the seed and throws it away.

If you gave the demo a `DATABASE_URL` of its own, that one does persist; drop its
tables and the next request rebuilds and re-seeds them:

```bash
psql "<demo connection string>" -c 'drop schema public cascade; create schema public;'
```

---

## What it is not

It is not a sandbox with accounts. Everyone who opens it sees the same data, and
nobody can change it. If you ever want visitors to be able to *use* the demo
rather than read it, that is a different feature — a per-visitor database — and
it is not what this is.
