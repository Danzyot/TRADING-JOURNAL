# The demo

A public copy of the app that anyone can look around without a password, and
without seeing a single row of your data.

It is a **second deployment**, not a second door into your own. That is the
whole design: the demo process can only reach the demo database, so there is no
per-visitor switch to get wrong, and no request that could return your trades to
a stranger. Your deployment keeps its password and never runs in this mode.

What the demo does:

- lets every page through with no sign-in
- refuses every save with *"This is the demo — nothing you change here is
  saved."* — the forms are half of what there is to show, so they stay
- says what it is, on every page, in a strip across the top
- hides Sign out and the wording-editor pencil, which have nothing to act on
- fills its own empty database on first boot: an account, 90 days of trades, two
  payouts, some costs, a subscription and a trading model

---

## Setting it up (~5 minutes)

**1. A database for it.** In the Neon project you already have, create a second
database — Neon's dashboard has a "New database" button, and it costs nothing on
the free plan because it shares the same compute. Call it `demo`. Copy its
connection string.

**2. A second Vercel project.** Import the same repository again
(Vercel → Add New → Project → the same repo) and name it something like
`yot-trading-journal-demo`. Give it these environment variables:

| Variable | Value |
|---|---|
| `DEMO_MODE` | `1` |
| `DATABASE_URL` | the **demo** database's connection string |

That is all it needs. No `APP_PASSWORD`, no `SESSION_SECRET`, no `CRON_SECRET`,
no Gmail, no `ANTHROPIC_API_KEY` — a demo with the scheduled jobs and the inbox
reader switched off is the point, and leaving those out is how they stay off.

> **If Vercel offers to copy the other project's environment variables, decline
> — or delete `APP_PASSWORD` afterwards.** A deployment that has a password is
> treated as a private one no matter what `DEMO_MODE` says, so the demo would
> simply keep asking for a password. Its login page tells you when that has
> happened. This is deliberate: the one accident worth engineering against is
> `DEMO_MODE` ending up on the deployment that holds your data, and this makes
> that accident harmless.

**3. Point your login page at it.** On your *real* project, add:

| Variable | Value |
|---|---|
| `DEMO_URL` | `https://yot-trading-journal-demo.vercel.app` |

Redeploy, and a **View demo** button appears under the password field. Without
this variable there is no button — a link to a demo nobody deployed is worse
than no link.

Both projects track the same branch, so a push updates the demo along with the
real thing.

---

## Options

| Variable | Effect |
|---|---|
| `DEMO_MODE=1` | Turns a deployment into the demo. Only the exact string `1` counts, and it is ignored on any deployment that also has an `APP_PASSWORD`. |
| `DEMO_SEED=0` | Leaves the demo's database empty instead of seeding it. Every page becomes its empty state, which is honest but shows very little. |
| `DEMO_URL` | On the real deployment: the address the View demo button opens. Must be an absolute `http(s)` URL. |

---

## Resetting it

The demo seeds itself only while its database holds no accounts. To start it
fresh — after someone has been clicking around, or after a schema change you
want to see from zero — drop the demo database's tables and let the next request
rebuild and re-seed them:

```bash
psql "<demo connection string>" -c 'drop schema public cascade; create schema public;'
```

The next page load migrates and seeds it again.

---

## What it is not

It is not a sandbox with accounts. Everyone who opens it sees the same data, and
nobody can change it. If you ever want visitors to be able to *use* the demo
rather than read it, that is a different feature — a per-visitor database — and
it is not what this is.
