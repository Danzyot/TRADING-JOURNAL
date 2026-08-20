# Setup

Two things to create — a database and a deployment — then you sign in. About
ten minutes, all in the browser. **No terminal, no Node install, no commands.**

The app creates its own database tables the first time you sign in.

---

## 1. Create the database (~3 minutes)

1. Go to **[neon.tech](https://neon.tech)** and sign up (the free tier is plenty
   — you can sign in with GitHub).
2. Create a project. Any name; pick the region closest to you (`Europe` if you
   are in Israel).
3. On the dashboard you will see **Connection string**. Make sure the toggle
   says **Pooled connection**, then copy it.

It looks like:

```
postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

> **Pooled matters.** The unpooled string opens a new connection per request and
> will exhaust the connection limit. If you only see one string, look for the
> "Connection pooling" toggle.

Supabase, Railway and Vercel Postgres all work identically — any Postgres does.

---

## 2. Deploy (~5 minutes)

1. Go to **[vercel.com/new](https://vercel.com/new)** and sign in with GitHub.
2. Find **TRADING-JOURNAL** in the list and click **Import**.
3. Expand **Environment Variables**. Vercel accepts a whole block at once —
   paste all five lines from the message where I gave you your secrets, then
   fill in `DATABASE_URL` with the string from step 1.
4. Click **Deploy** and wait ~2 minutes.

That is it. The scheduled jobs in `vercel.json` are picked up automatically.

> Nothing else to run. The first time you sign in, the app creates all 14 tables
> and loads the prop firm presets by itself.

### If the deploy fails

It will not fail for a missing environment variable — the build does not need
the database. If it does fail, the Vercel build log names the reason.

### Vercel's free plan

Hobby limits cron frequency. If the 30-minute broker sync does not fire, either
upgrade, or change the schedules in `vercel.json` to once daily and press **Sync
brokers** on the dashboard when you want fresh data.

---

## 3. First sign-in (~5 minutes)

Open your new URL and sign in with `APP_PASSWORD`. Then, in order:

**Settings** — check the timezone is `Asia/Jerusalem` and the currency is `USD`.
Leave the trading-day boundary at `00:00` unless you want to follow the CME
session, where an evening fill belongs to the next trading day.

**Accounts → Add account** — one per account you trade. Four fields decide
whether every warning in the app is right or wrong:

| Field | Why it matters |
|---|---|
| Account size | The base for everything |
| Max drawdown | e.g. `2500` on a 50k Apex |
| **Drawdown type** | Intraday trailing is the punishing one, and the most common. Get this wrong and the risk warnings are wrong. |
| **Round-turn commission** | Roughly `$1.24`–`$4.00`. **Leave it at zero and every strategy looks better than it is.** |

The firms are already there — edit the profit split to match your actual
agreement.

**Import** — drop in a CSV from Tradovate, Rithmic or NinjaTrader. Or
**Settings → Broker connections** to connect Tradovate for automatic syncing.
See [INTEGRATIONS.md](INTEGRATIONS.md).

**Tax** — set your status and credit points. If you have finished army service
you are entitled to extra credit points for 36 months after release; it is worth
real money and easy to miss. See [TAX-ISRAEL.md](TAX-ISRAEL.md).

---

## Want to see it populated before your own data arrives?

The demo data needs a terminal, so it is genuinely optional — everything else
does not:

```bash
git clone https://github.com/Danzyot/TRADING-JOURNAL.git
cd TRADING-JOURNAL && npm install
DATABASE_URL="<your neon string>" npm run db:seed -- --demo
```

That generates 90 days of synthetic trades so every chart and insight has
something to show. **Delete "Demo 50k (sample data)" on the Accounts page before
you trust any number** — it is counted in your statistics like any other
account.

---

## Later

### Changing a secret

Vercel → Project → Settings → Environment Variables → edit → **Redeploy**.

Changing `ENCRYPTION_KEY` makes stored broker credentials unreadable; you would
re-enter them in Settings. Changing `SESSION_SECRET` just signs you out.

### Backups

The database is the only thing that matters — the code is in git. Neon keeps
point-in-time restore on paid tiers. On the free tier, take a dump occasionally,
especially before a tax filing:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

### A new tax year

Every Israeli rate lives in one file, `src/lib/tax/rates.ts`. Each January: copy
`RATES_2026` to `RATES_2027`, update the figures, add it to `RATE_TABLE`. Never
edit a past year in place — prior-year estimates must stay reproducible.

The weekly maintenance routine checks this each January and opens the change for
you.

### Local development

```bash
cp .env.example .env.local     # fill in the values
npm install && npm run dev     # http://localhost:3000
npm run check                  # typecheck + 165 tests
```

---

## Troubleshooting

**"DATABASE_URL is not set"** — it is missing from the Vercel environment, or
was added after the last deploy. Add it and redeploy.

**Pages error with "relation … does not exist"** — the schema did not get
created. Check the Vercel function logs for a bootstrap message; the usual cause
is an unpooled connection string hitting its limit.

**Cron jobs return 401** — `CRON_SECRET` differs between the environment and the
request. Vercel sends it automatically; elsewhere append
`?token=YOUR_CRON_SECRET`.

**Tradovate sync asks for a captcha** — sign in to the Tradovate web platform
once, then retry.

**Trades look wrong after an import** — open the account and press **Rebuild
trades**. Matching is a pure function of the fill history, so a rebuild is
always safe and always gives the same result.

**Everything looks too profitable** — the commission rate on the account is
still zero. The dashboard flags this.
