# Trading Journal — repo guide

Futures trading journal for a prop-firm trader in Israel. Next.js 15 App
Router + Drizzle + Postgres, single user, deployed on Vercel (fra1) with a
Neon database in eu-central-1.

## Commands

```bash
npm run check              # typecheck + unit tests — run before any commit
npm test                   # vitest only
npm run build              # needs DATABASE_URL set (any placeholder works)
npm run check:integration  # end-to-end against a real Postgres in DATABASE_URL
npm run db:generate        # new migration after editing src/db/schema.ts
```

The build needs env vars present but not valid; every page is force-dynamic.

## Architecture in one paragraph

`src/lib` is pure logic — no database, no clock — and is where the tests
live: FIFO fill→trade matching (`analytics/matching.ts`), the metrics engine,
Israeli tax (`tax/israel.ts` with rates isolated in `tax/rates.ts`), prop-firm
drawdown/payout rules (`propfirm/rules.ts`), the payout allocation waterfall
(`allocation.ts`), CSV importers, and the AI trade-review prompts/parsing
(`ai/model-review.ts` — the network half is `src/server/ai.ts`, needs
ANTHROPIC_API_KEY, degrades to clear "not configured" messages without it). `src/server` is the data layer (queries,
sync, Server Actions — every mutation is a Server Action in `actions.ts`).
`src/app` is UI. The database self-migrates on first use via
`src/db/bootstrap.ts`, called from `getSettings()`, which everything goes
through.

## Rules that exist for a reason

- **Trades are derived data.** Auto-generated trades are rebuilt from the
  executions table (`rebuildTradesForAccount`); never mutate them in place.
  User annotations survive rebuilds keyed on (entryAt, symbol) — that carry
  includes `modelId`/`modelReview`, and `model_reviews` history deliberately
  has no trade FK for the same reason.
- **Money is Postgres numeric surfaced as number.** New money columns use the
  `money`/`price`/`ratio` custom types in `schema.ts`.
- **The executions unique index is partial** (`WHERE external_id IS NOT
  NULL`); any ON CONFLICT against it must repeat that predicate or Postgres
  rejects the insert (42P10). This broke once — see `insertExecutions`.
- **Migrations are additive and never edited after commit** — the deployed app
  applies them itself at first request. Same for `tax/rates.ts`: add a new
  year's table, never rewrite an old year.
- **Nothing is pre-created for the user.** No seeded firms, no assumed data;
  presets are templates inside forms. The demo seed (`npm run db:seed --
  --demo`) is explicit opt-in.
- **Every statistic must be checkable.** Insights state their evidence;
  estimates say they are estimates. The tax module is arithmetic on published
  rates, not advice, and its docs carry sources.
- **Serverless + remote DB: no per-row awaits in loops.** Batch inserts, one
  VALUES-join update for linkage (array params with `::int[]` casts do not
  survive postgres.js — use a VALUES list).

## Known constraints

- Rithmic and Tradecopia have no retail APIs (licensing/product reality, not
  missing work) — CSV import is the path. Documented in docs/INTEGRATIONS.md.
- Tradovate fills carry no commission; per-account round-turn rates cost them
  at sync/import time, and changing the rate reprices rate-derived fills
  (source `tradovate_api` or stored zero) then rebuilds.
- Firm presets in `propfirm/rules.ts` were verified August 2026 and rot
  quickly; update notes carry the verification date.
