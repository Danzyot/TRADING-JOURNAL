# Accounts, plans and balances

## Where the plan numbers come from

`src/lib/propfirm/catalogue.ts` is generated — never edit it by hand. It is
built by `scripts/import-catalogue.mts` from two sources:

- the published spec sheets extracted to `/tmp/extract/plans.json`;
- `scripts/manual-catalogues.json`, entered by hand from a firm's own rules
  pages for plans the sheets do not cover.

Values a source does not state stay `null`. They are never inferred, because a
missing drawdown that reads as zero turns off every warning the app exists to
give.

`manual-catalogues.json` does two things: `plans` adds families the sheets do
not cover, and `patch` corrects plans that came from a sheet since gone stale.
A patch matches on label prefix and is keyed by size, so a term the firm has
changed is edited in place rather than left beside a corrected copy.

Regenerate with:

```bash
npx tsx scripts/import-catalogue.mts
```

### Two things the sources disagree about

**Buffers.** Firms state the same rule two ways. Take Profit Trader writes
`$1,600`, the profit you must be up. Lucid and Apex write `$26,100`, the
balance a $25k account must reach. The column means the first, so
`bufferProfit` subtracts the account size from a balance-style figure.

**Minimum payouts.** `$500` is a number to test a payout against; `1% of
balance` is not. `parsePlainMoney` accepts only a bare amount, so a rule
phrased as a percentage stays text rather than becoming a floor of one dollar.

## From a plan to an account

`/firms` lists every plan every firm sells. Adding one copies its eighteen rule
fields onto a new account and creates the firm row if it does not exist yet.
Two deliberate choices:

- a **funded** account gets no profit target — carrying one over would show
  progress toward a bar that no longer exists;
- the firm is matched on name, so a firm added by hand is reused rather than
  duplicated into two rows with the economics split across both.

An account is allowed to differ from the plan it came from. Firm terms change,
and the plan is a starting point, not a contract.

## How a balance stays current

Equity is an **anchor** plus the trades after it. An anchor is a balance that
was true on a stated day, from whichever source spoke last:

| Source | Balance | True as of |
| --- | --- | --- |
| `start` | the account size | before every trade |
| `manual` | `openingBalance` | the close of `openingBalanceAt` |
| `sync` | `currentBalance` | the day of `balanceUpdatedAt` |

Later wins, because a later statement already contains everything the earlier
one did. On the same day the trader's own figure wins — they typed it knowing
what the sync said.

Trades on or before the anchor's day are already inside its number and are
skipped; trades after it are added. This is what makes an account you started
journalling halfway through report a balance that keeps moving, rather than
freezing at whatever was last typed in.

Both the balance and its date are required together. A balance with no date
cannot say which trades it already contains, so saving one without the other
stores neither.

**Profit is always measured against the account size, never against the
anchor.** An account funded at $50k and anchored at $52,300 is $2,300 up, and
the buffer, the profit target and the payout all key off that number.

**Everything else counts every tracked trade.** Consistency, win rate and
best-day all include trades from before the anchor: they happened on the
account and the firm counts them. Only the balance excludes them, and only to
avoid adding the same P&L twice. For an anchored account the journal sees fewer
days than the firm does, so treat a consistency figure as the best the tracked
history can say.

## Payout eligibility

`payoutEligibility` in `src/lib/propfirm/rules.ts` reads the account's own
`buffer` and `minPayout`:

- **buffer** — profit the firm makes you leave behind. You withdraw down to
  that line, not to the account size, so $2,300 of profit against a $2,100
  buffer is $200 of payout, not $2,300.
- **minPayout** — the smallest request the firm processes. An account over its
  buffer can still have nothing to ask for.

`toFirstPayout` is the two combined: how much more profit is needed before the
first dollar can be requested.

## Prices

**Expense tracking does not depend on these.** A purchase email carries the
amount actually paid — discount codes included — and `applyEmailEvents` logs
that figure. A catalogue price only pre-fills `costBase` when an account is
created from a plan, and feeds the planning figures on `/firms`.

So a missing price costs nothing that matters, and a wrong one is corrected on
the account. Prices are recorded only from a source that stated them, with the
source and date in the plan's notes; where no source stated one it stays null
rather than being interpolated from its neighbours.

To fill them in bulk: add the firm, then use the plan catalogue editor on the
Accounts page — one row per plan with a cost column, saved in one go.
