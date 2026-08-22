# Trading Journal

A futures trading journal built for prop-firm accounts — performance, costs,
payouts and Israeli tax in one place, with as much of it automated as the
platforms actually allow.

Built for trading MNQ/ES-style futures across multiple prop firms and accounts,
through Tradovate, Rithmic and TradingView, with Tradecopia copying between them.

---

## What it does

**Trades**
- Pulls fills from Tradovate automatically; imports CSV from anything else
- Matches raw fills into round trips FIFO — handles scale-ins, partial exits,
  and fills that flip the position
- Costs every trade properly, because a journal that ignores commission will
  tell you a losing scalping strategy is profitable

**Analysis**
- Expectancy, profit factor, payoff ratio, R-multiples, drawdown, streaks,
  Sharpe, Kelly
- Breakdowns by symbol, session, weekday, hour, direction, size, hold time,
  setup, tag and mistake
- An insights engine that states its evidence: not "cut your losses" but "trades
  taken within five minutes of a loss average −$41 against your +$18 baseline,
  across 23 trades"

**Accounts**
- Trailing drawdown tracked properly — intraday, end-of-day or static — so you
  know the real distance to the line, not the one you assume
- Evaluation progress, consistency-rule checks before you request a payout
- Cost per funded account and return on evaluation spend, per firm

**Money**
- Expenses, recurring subscriptions that log themselves, payouts with profit
  splits and processing fees
- A payout allocation waterfall: tax reserve first, then operating float, then
  emergency fund, then investing
- Advice on when adding accounts is investment and when it is gambling

**Tax (Israel)**
- Models prop payouts correctly as **business income, not capital gains** —
  the thing most funded traders get wrong
- 2026 brackets, National Insurance, surtax, credit points, VAT
- Compares osek patur / osek zair / osek murshe / company on your real numbers
- Reserve tracking and the advance-payment schedule

---

## Getting it running

Two things to create, both in the browser. **No terminal, no Node install, no
commands** — the app creates its own database tables on first sign-in.

1. **Database** — [neon.tech](https://neon.tech), create a project, copy the
   **pooled** connection string.
2. **Deploy** — [vercel.com/new](https://vercel.com/new), import this repo,
   paste five environment variables, click Deploy.
3. **Sign in** and add your accounts.

Step-by-step, with the exact fields: **[docs/SETUP.md](docs/SETUP.md)**

Environment variables, all set once in Vercel:

| Name | What it is |
|---|---|
| `DATABASE_URL` | Your pooled Postgres connection string |
| `APP_PASSWORD` | What you sign in with |
| `ENCRYPTION_KEY` | Encrypts broker credentials at rest (32+ chars) |
| `SESSION_SECRET` | Signs the session cookie (32+ chars) |
| `CRON_SECRET` | Bearer token for scheduled jobs and the TradingView webhook |

---

## Documentation

| Document | What's in it |
|---|---|
| **[SETUP.md](docs/SETUP.md)** | Deploy to Vercel or Docker, first-run checklist, troubleshooting |
| **[INTEGRATIONS.md](docs/INTEGRATIONS.md)** | Tradovate, Rithmic, Tradecopia, TradingView — what connects and what honestly doesn't |
| **[EMAIL.md](docs/EMAIL.md)** | Reading prop-firm mail on the server: payouts, fees, passes, fails and balances logging themselves |
| **[TAX-ISRAEL.md](docs/TAX-ISRAEL.md)** | Business income vs capital gains, which status to register, deductions, travelling and leaving |
| **[BANKING.md](docs/BANKING.md)** | Getting paid: which rail each firm uses, Wise vs Revolut vs an Israeli bank, and what a foreign account does and does not do |
| **[TAX-RELOCATION.md](docs/TAX-RELOCATION.md)** | Why an S corp is a dead end, and the honest country-by-country comparison (Cyprus, Greece, Dubai, Bulgaria, Georgia, Thailand, Costa Rica…) |
| **[PAYOUT-STRATEGY.md](docs/PAYOUT-STRATEGY.md)** | The allocation waterfall and the reasoning behind it |

---

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Postgres via Drizzle ·
Recharts · Vitest. Deploys to Vercel with cron, or anywhere via the included
Dockerfile.

Migrations run themselves on the first request after a deploy, guarded by a
Postgres advisory lock so concurrent cold starts cannot race. The build needs no
database, so a deploy never fails on a missing environment variable.

Single-user by design: one password, a signed session cookie, everything private
behind middleware. Broker credentials are AES-256-GCM encrypted before they
touch the database.

---

## What is automated, honestly

| | |
|---|---|
| Tradovate fills and balances | ✅ Daily, plus a button for on demand |
| Trade matching from fills | ✅ Automatic |
| Subscription charges | ✅ Logged as they fall due |
| USD/ILS rate | ✅ Daily |
| Insights regeneration | ✅ Daily, plus a button for on demand |
| Tax reserve per payout | ✅ On entry |
| Rithmic fills | ❌ CSV — no retail API exists |
| Tradecopia | ❌ CSV from the broker it copies into |
| TradingView stops/targets | ⚠️ Webhook, if you configure the alert |

The reasons for the ❌ rows are in
[INTEGRATIONS.md](docs/INTEGRATIONS.md) — they are licensing and product
limitations, not missing work.

---

## Project layout

```
src/
├── db/schema.ts              Postgres schema (Drizzle)
├── lib/
│   ├── symbols.ts            Futures contract specs, parameterised by point value
│   ├── time.ts               Trading-day boundaries, tolerant timestamp parsing
│   ├── allocation.ts         Payout waterfall + deployment advice
│   ├── analytics/
│   │   ├── matching.ts       FIFO fills → round trips
│   │   ├── metrics.ts        Every statistic the app reports
│   │   └── insights.ts       The tips engine
│   ├── tax/
│   │   ├── rates.ts          One file to edit each January
│   │   └── israel.ts         Income tax, NI, VAT, status comparison
│   ├── propfirm/rules.ts     Drawdown, consistency, payout eligibility
│   └── integrations/         Tradovate client, CSV importers
├── server/                   Queries, sync, server actions
└── app/                      Pages and API routes
```

The pure logic in `src/lib` has no database and no clock, and is covered by
**165 tests**:

```bash
npm test
```

---

## Notes

The tax module is arithmetic on published rates, researched carefully and
sourced — but it is not advice, and the classification questions in it have real
consequences. [TAX-ISRAEL.md](docs/TAX-ISRAEL.md) is written to be handed to an
Israeli accountant.
