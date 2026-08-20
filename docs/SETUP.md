# Setup

About 20 minutes end to end. You need a GitHub account, a Vercel account, and a
Postgres database. All three have free tiers sufficient for this.

---

## 1. Get a database

Any Postgres works. Easiest options:

- **[Neon](https://neon.tech)** — free tier, serverless, pairs well with Vercel.
- **[Supabase](https://supabase.com)** — free tier, includes a table browser.
- **Vercel Postgres** — one click from the Vercel dashboard.
- **Railway** — if you are hosting the app there anyway.

Copy the connection string. **On serverless hosts use the pooled/pooler
connection string**, not the direct one — a direct connection per invocation
will exhaust your connection limit.

---

## 2. Generate your secrets

```bash
# Encrypts broker credentials at rest
openssl rand -base64 48

# Signs the session cookie — generate separately
openssl rand -base64 48

# Bearer token for cron jobs and the TradingView webhook
openssl rand -hex 32
```

Generate `ENCRYPTION_KEY` and `SESSION_SECRET` separately rather than reusing
one value. Rotating your login should not invalidate your stored broker
credentials, and vice versa.

---

## 3. Deploy

### Vercel (recommended)

1. Push this repository to GitHub.
2. In Vercel, *Add New → Project* and import it.
3. Add environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your pooled Postgres connection string |
   | `APP_PASSWORD` | the password you will sign in with |
   | `ENCRYPTION_KEY` | first generated secret |
   | `SESSION_SECRET` | second generated secret |
   | `CRON_SECRET` | the hex token |

4. Deploy.

The four scheduled jobs in `vercel.json` are picked up automatically. Vercel
sends `Authorization: Bearer $CRON_SECRET` with each one.

> Vercel's Hobby plan limits cron frequency. If the 30-minute sync does not
> fire, either upgrade or change the schedule in `vercel.json` to daily and
> press *Sync brokers* on the dashboard when you want fresh data.

### Railway / Fly / any Docker host

A `Dockerfile` is included and builds a standalone server.

```bash
docker build -t trading-journal .
docker run -p 3000:3000 --env-file .env trading-journal
```

There is no built-in scheduler outside Vercel. Point any cron service at the
four endpoints with the token as a query parameter:

```
https://your-app/api/cron/sync?token=YOUR_CRON_SECRET
https://your-app/api/cron/daily?token=YOUR_CRON_SECRET
https://your-app/api/cron/fx?token=YOUR_CRON_SECRET
https://your-app/api/cron/insights?token=YOUR_CRON_SECRET
```

---

## 4. Create the tables

From your machine, with `DATABASE_URL` set to the same database:

```bash
npm install
npm run db:push          # creates every table
npm run db:seed          # adds the prop firm presets
```

Add `-- --demo` to the seed for a synthetic account and 90 days of sample
trades, so every chart and insight has something to show before your real data
arrives. The demo account is flagged to be excluded from headline statistics, so
it cannot contaminate your real numbers even if you forget to delete it.

```bash
npm run db:seed -- --demo
```

---

## 5. First run

Sign in with `APP_PASSWORD`, then:

1. **Settings** — set your timezone (`Asia/Jerusalem`), reporting currency, and
   the trading-day boundary. Leave the boundary at `00:00` for calendar days,
   or set `18:00` to follow the CME session, where an evening fill belongs to
   the next trading day.

2. **Accounts → Add firm** — the presets are seeded; edit the profit split and
   payout policy to match your actual agreement.

3. **Accounts → Add account** — for each account you trade. Three fields matter
   most:
   - **Account size** and **max drawdown**
   - **Drawdown type** — intraday trailing is the punishing one, and the most
     common. Get this right or the risk warnings are wrong.
   - **Round-turn commission per contract** — roughly $1.20–$4.00. **Leaving
     this at zero makes every strategy look better than it is.**

4. **Import** or **Settings → Broker connections** — get your trades in. See
   `INTEGRATIONS.md`.

5. **Tax** — set your status, credit points (including the discharged-soldier
   credit if it applies), and reserve percentage.

6. **Money → allocation plan** — adjust the buckets. Defaults and reasoning are
   in `PAYOUT-STRATEGY.md`.

---

## Local development

```bash
cp .env.example .env.local     # fill in the values
npm install
npm run db:push
npm run dev                    # http://localhost:3000
```

```bash
npm run typecheck    # tsc, no emit
npm test             # vitest
npm run check        # both
npm run db:studio    # Drizzle Studio, a browser table editor
```

---

## Updating for a new tax year

Every Israeli rate lives in `src/lib/tax/rates.ts`. Each January:

1. Copy `RATES_2026` to `RATES_2027`, update the figures.
2. Add it to `RATE_TABLE`.

Bracket thresholds, the surtax threshold, the credit point value, National
Insurance bands and the osek patur ceiling all index annually. The tests in
`src/lib/tax/israel.test.ts` pin the arithmetic, not the rates, so they keep
working.

---

## Backups

Your database is the only thing that matters — the code is in git.

Neon and Supabase both provide point-in-time restore on paid tiers. On a free
tier, take a periodic dump:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

Worth doing before any schema change, and worth doing at all — this becomes the
record behind a tax filing.

---

## Troubleshooting

**"DATABASE_URL is not set"** — the app needs it at runtime, not just build
time. Check it is present in your host's environment variables, not only in a
local file.

**Cron jobs return 401** — `CRON_SECRET` differs between the environment and the
request. On Vercel it is sent automatically; elsewhere append
`?token=YOUR_CRON_SECRET`.

**Tradovate sync asks for a captcha** — sign in through the Tradovate web
platform once, then retry.

**Tradovate returns a pending ticket / time penalty** — too many login attempts.
Wait it out. The app caches its access token specifically to avoid this.

**Trades look wrong after an import** — open the account and press *Rebuild
trades*. Matching is a pure function of the fill history, so a rebuild is always
safe and always reproduces the same result.

**P&L is right but everything looks too profitable** — the commission rate on
the account is probably still zero. The dashboard flags this.
